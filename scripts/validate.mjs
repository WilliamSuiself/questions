#!/usr/bin/env node
/**
 * 合并各批次题库 -> data/questions.json
 * 并做完整性与文本质量校验：
 *   1. JSON 合法性
 *   2. id 唯一且符合 ^sg-[0-9]{3}$
 *   3. options 恰为 A/B/C/D，answer 必须命中其中一个
 *   4. 同题四个选项文本不得重复
 *   5. 必填字段非空、长度合规
 *   6. difficulty / category 取值合法
 *   7. source.chapter 必须在 1~120 或为 null
 *   8. 中文字段里不得混入拉丁字母/替换字符（防止出图或改写时产生的脏文本）
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const batchDir = join(root, 'data', '_batches')
const outDir = join(root, 'data')
const outFile = join(outDir, 'questions.json')

const VALID_CATEGORY = new Set([
  '人物字号', '人物生平', '经典场景', '谋略计策',
  '经典战役', '诗词原文', '兵器坐骑', '地名官职', '成语典故',
])

const errors = []
const warnings = []
const err = (id, msg) => errors.push(`[${id}] ${msg}`)
const warn = (id, msg) => warnings.push(`[${id}] ${msg}`)

// ---------- 1. 读取并合并 ----------
const files = readdirSync(batchDir).filter((f) => f.endsWith('.json')).sort()
if (!files.length) {
  console.error('批次目录为空')
  process.exit(1)
}

const all = []
for (const f of files) {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(join(batchDir, f), 'utf8'))
  } catch (e) {
    errors.push(`[${f}] JSON 解析失败: ${e.message}`)
    continue
  }
  if (!Array.isArray(parsed)) {
    errors.push(`[${f}] 顶层不是数组`)
    continue
  }
  parsed.forEach((q, i) => all.push({ ...q, __file: f, __index: i }))
}

// ---------- 2. 重新编号 sg-001 ... ----------
all.forEach((q, i) => {
  q.id = `sg-${String(i + 1).padStart(3, '0')}`
})

// ---------- 3. 校验 ----------
const seen = new Set()
for (const q of all) {
  const id = q.id
  if (seen.has(id)) err(id, 'id 重复')
  seen.add(id)

  if (!/^sg-\d{3}$/.test(id)) err(id, 'id 格式不合法')

  if (q.type !== 'single') err(id, `type 必须是 single，实际 ${q.type}`)

  if (typeof q.stem !== 'string' || q.stem.trim().length < 6) err(id, 'stem 缺失或过短')
  if (q.stem && q.stem.length > 120) err(id, `stem 过长(${q.stem.length})`)
  if (q.stem && !/[？?]$/.test(q.stem.trim())) warn(id, 'stem 未以问号结尾')

  const keys = Object.keys(q.options || {})
  if (keys.length !== 4 || !['A', 'B', 'C', 'D'].every((k) => keys.includes(k))) {
    err(id, `options 必须恰含 A/B/C/D，实际 [${keys.join(',')}]`)
  }
  const vals = Object.values(q.options || {})
  if (new Set(vals).size !== vals.length) err(id, '同一题内存在重复选项')

  if (!['A', 'B', 'C', 'D'].includes(q.answer)) err(id, `answer 非法: ${q.answer}`)
  else if (keys.length && !(q.answer in q.options)) err(id, 'answer 在 options 中不存在')

  if (typeof q.analysis !== 'string' || q.analysis.trim().length < 10) err(id, 'analysis 缺失或过短')
  if (q.analysis && q.analysis.length > 300) warn(id, `analysis 偏长(${q.analysis.length})`)

  if (![1, 2, 3].includes(q.difficulty)) err(id, `difficulty 非法: ${q.difficulty}`)
  if (!VALID_CATEGORY.has(q.category)) err(id, `category 非法: ${q.category}`)

  if (!Array.isArray(q.tags) || q.tags.length < 1 || q.tags.length > 5) err(id, 'tags 必须是 1~5 项的数组')

  const s = q.source
  if (!s || typeof s !== 'object') {
    err(id, '缺少 source')
  } else {
    if (!(s.chapter === null || (Number.isInteger(s.chapter) && s.chapter >= 1 && s.chapter <= 120))) {
      err(id, `source.chapter 非法: ${s.chapter}`)
    }
    if (!s.scene || s.scene.trim().length < 2) err(id, 'source.scene 缺失')
    if (!s.evidence || s.evidence.trim().length < 4) err(id, 'source.evidence 缺失')
  }

  // 文本污染扫描：中文内容里不应混入拉丁字母或替换字符
  const textFields = { stem: q.stem, analysis: q.analysis }
  for (const [k, v] of Object.entries(q.options || {})) textFields[`options.${k}`] = v
  if (s) {
    textFields['source.scene'] = s.scene
    textFields['source.evidence'] = s.evidence
  }
  for (const [k, v] of Object.entries(textFields)) {
    if (typeof v !== 'string') continue
    if (/[A-Za-z]/.test(v)) {
      // 例外：解析里用单个大写 A/B/C/D 指代选项，属于正常写法
      for (const run of v.match(/[A-Za-z]+/g) || []) {
        if (!/^[ABCD]$/.test(run)) err(id, `${k} 中混入拉丁字符: ${run}`)
      }
    }
    if (/[\uFFFD]/.test(v)) err(id, `${k} 含替换字符 U+FFFD`)
    if (/\s{2,}/.test(v)) warn(id, `${k} 含连续空格`)
  }
  for (const t of q.tags || []) {
    if (/[A-Za-z\uFFFD]/.test(String(t))) err(id, `tag 含异常字符: ${t}`)
  }
}

// ---------- 4. 查重：题干归一化后比对 ----------
const norm = (s) => String(s).replace(/[\s，。、？！；：“”「」《》（）()·]/g, '')
const byStem = new Map()
for (const q of all) {
  const k = norm(q.stem)
  if (byStem.has(k)) err(q.id, `题干与 ${byStem.get(k)} 重复`)
  else byStem.set(k, q.id)
}

// ---------- 4b. 题干里写明的回数必须与 source.chapter 一致 ----------
const CN_DIGIT = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
const cnNum = (s) => {
  let total = 0, num = 0
  for (const ch of s) {
    if (ch in CN_DIGIT) num = CN_DIGIT[ch]
    else if (ch === '十') { total += (num || 1) * 10; num = 0 }
    else if (ch === '百') { total += (num || 1) * 100; num = 0 }
  }
  return total + num
}
for (const q of all) {
  const ch = q.source?.chapter
  if (typeof ch !== 'number') continue
  const mentioned = [...String(q.stem).matchAll(/第([一二三四五六七八九十百零]+)回/g)]
    .map((m) => cnNum(m[1]))
  if (mentioned.length && !mentioned.includes(ch)) {
    err(q.id, `题干写明第${mentioned.join('、')}回，但 source.chapter = ${ch}`)
  }
}

// ---------- 5. 分布统计 ----------
const byCat = {}
const byDiff = { 1: 0, 2: 0, 3: 0 }
for (const q of all) {
  byCat[q.category] = (byCat[q.category] || 0) + 1
  byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1
}

// ---------- 6. 输出 ----------
if (errors.length === 0) {
  mkdirSync(outDir, { recursive: true })
  const clean = all.map((q) => {
    const { __file, __index, ...rest } = q
    return rest
  })
  writeFileSync(outFile, JSON.stringify(clean, null, 2) + '\n', 'utf8')
}

console.log(`批次文件: ${files.join(', ')}`)
console.log(`题目总数: ${all.length}`)
console.log(`分类分布: ${JSON.stringify(byCat, null, 0)}`)
console.log(`难度分布: 1易=${byDiff[1]} 2中=${byDiff[2]} 3难=${byDiff[3]}`)
console.log(`空章节标记(null): ${all.filter((q) => q.source?.chapter === null).length}`)

if (warnings.length) {
  console.log(`\n警告 ${warnings.length} 条:`)
  warnings.forEach((w) => console.log('  ! ' + w))
}
if (errors.length) {
  console.log(`\n错误 ${errors.length} 条:`)
  errors.forEach((e) => console.log('  x ' + e))
  process.exit(1)
}
console.log(`\n校验通过，已写出: ${outFile}`)

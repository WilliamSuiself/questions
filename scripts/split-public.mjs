#!/usr/bin/env node
/**
 * 拆分线上/开发两份题包：
 *   questions.public.json  —— 题面 + 选项 + 分类 + 难度 + 标签（不含答案解析）
 *   questions.answers.json —— 答案 + 解析 + 原文依据（线上建议由服务端下发）
 *
 * 同时更新 questions.meta.json（版本、题量、分类与难度分布）。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = join(root, 'data')
const all = JSON.parse(readFileSync(join(dataDir, 'questions.json'), 'utf8'))

const publicPack = all.map((q) => ({
  id: q.id,
  type: q.type,
  stem: q.stem,
  options: q.options,
  difficulty: q.difficulty,
  category: q.category,
  tags: q.tags,
}))

const answerPack = all.map((q) => ({
  id: q.id,
  answer: q.answer,
  analysis: q.analysis,
  source: q.source,
}))

const byCategory = {}
const byDifficulty = { 1: 0, 2: 0, 3: 0 }
const byAnswer = { A: 0, B: 0, C: 0, D: 0 }
for (const q of all) {
  byCategory[q.category] = (byCategory[q.category] || 0) + 1
  byDifficulty[q.difficulty] += 1
  byAnswer[q.answer] += 1
}

const meta = {
  version: '1.1.0',
  source: '罗贯中《三国演义》一百二十回',
  total: all.length,
  generatedAt: new Date().toISOString().slice(0, 10),
  byCategory,
  byDifficulty,
  byAnswer,
}

writeFileSync(join(dataDir, 'questions.public.json'), JSON.stringify(publicPack, null, 2) + '\n', 'utf8')
writeFileSync(join(dataDir, 'questions.answers.json'), JSON.stringify(answerPack, null, 2) + '\n', 'utf8')
writeFileSync(join(dataDir, 'questions.meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8')

console.log(`公共包 ${publicPack.length} 题 -> data/questions.public.json`)
console.log(`答案包 ${answerPack.length} 题 -> data/questions.answers.json`)
console.log(`元信息 -> data/questions.meta.json`)

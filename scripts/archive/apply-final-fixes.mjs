#!/usr/bin/env node
/** 最后一轮校对修正：5 处字号/回目/原文依据 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'data', '_batches')

const P = {
  'sg-006': {
    analysis: '第十回马腾举义时，原著交代「那将即马腾之子马超，字孟起，年方十七岁，英勇无敌」。子龙是赵云字，翼德是张飞字，文远是张辽字。',
    source: { chapter: 10, scene: '马腾举义·马超字孟起', evidence: '那将即马腾之子马超，字孟起，年方十七岁，英勇无敌。' },
  },
  'sg-010': {
    analysis: '第十五回孙策起兵途中遇周瑜：「策视其人，乃庐江舒城人：姓周，名瑜，字公瑾。」子敬是鲁肃字，公覆是黄盖字，文长是魏延字。',
    source: { chapter: 15, scene: '孙策起兵·周瑜字公瑾', evidence: '策视其人，乃庐江舒城人：姓周，名瑜，字公瑾。' },
  },
  'sg-012': {
    analysis: '第十回程昱向荀彧举荐郭嘉：「公之乡人姓郭，名嘉，字奉孝，乃当今贤士，何不罗而致之？」文若是荀彧字，孝直是法正字，元直是徐庶字。',
    source: { chapter: 10, scene: '程昱举荐郭嘉·郭嘉字奉孝', evidence: '公之乡人姓郭，名嘉，字奉孝，乃当今贤士。' },
  },
  'sg-017': {
    stem: '《三国演义》中关羽被曹军射中毒箭，华佗前来医治，用的办法是什么？',
    options: {
      A: '用尖刀割开皮肉直至于骨，刮去骨上的箭毒',
      B: '先灌麻沸散麻醉，再割肉开刀',
      C: '以针灸封住毒经再拔毒',
      D: '放血敷药并静养三月',
    },
    answer: 'A',
    analysis: '第七十五回华佗（字元化）说：立一标柱钉大环，请关羽将臂穿入环中，以绳系之、被蒙其首，「吾用尖刀割开皮肉，直至于骨，刮去骨上箭毒，用药敷之，以线缝其口」。关羽饮酒食肉、谈笑弈棋，全无痛苦之色，帐上帐下见者皆掩面失色。原著这一段里并没有「麻沸散」——那是《后汉书·华佗传》中的记载。',
    difficulty: 2,
    source: {
      chapter: 75,
      scene: '关云长刮骨疗毒',
      evidence: '佗曰：「吾用尖刀割开皮肉，直至于骨，刮去骨上箭毒，用药敷之，以线缝其口，方可无事。」',
    },
  },
  'sg-093': {
    analysis: '第五十六回孔明三气周瑜，周瑜箭疮未愈，因怒气冲激，疮口迸裂，昏绝于地，被众将救醒后逃回柴桑。诸葛亮与鲁肃在江边遇庞统，庞统笑曰：「汝气死周郎，却又来吊孝，明欺东吴无人耶？」',
    source: {
      chapter: 56,
      scene: '孔明三气周公瑾',
      evidence: '箭疮未癒，因怒气冲激，疮口迸裂，昏绝于地。',
    },
  },
}

const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
const batches = new Map()
const index = new Map()
for (const f of files) {
  const arr = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  batches.set(f, arr)
  arr.forEach((q) => index.set(q.id, q))
}

for (const [id, patch] of Object.entries(P)) {
  const q = index.get(id)
  if (!q) {
    console.error('未找到 ' + id)
    process.exit(1)
  }
  Object.assign(q, patch)
}

for (const [f, arr] of batches) {
  writeFileSync(join(dir, f), JSON.stringify(arr, null, 2) + '\n', 'utf8')
}
console.log(`已应用 ${Object.keys(P).length} 条最终修正`)

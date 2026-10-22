#!/usr/bin/env node
/**
 * batch-04 的 id 按位置规整为 sg-061 ~ sg-081（连续、与合并后的题号一一对应）。
 * 起因：早先手工写过��个非法 id「sg-059b」，导致该批 id 序列错位一位。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const p = join(root, 'data', '_batches', 'batch-04.json')
const arr = JSON.parse(readFileSync(p, 'utf8'))

arr.forEach((q, i) => {
  q.id = `sg-${String(61 + i).padStart(3, '0')}`
})

writeFileSync(p, JSON.stringify(arr, null, 2) + '\n', 'utf8')

const ids = arr.map((q) => q.id)
const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
console.log(`batch-04: ${ids.length} 题，id ${ids[0]} ~ ${ids[ids.length - 1]}`)
console.log(dup.length ? `仍有重复: ${[...new Set(dup)].join(',')}` : '无重复 id')
arr.forEach((q, i) => {
  if (i >= 8 && i <= 14) console.log(`  ${q.id}  ch${String(q.source.chapter).padStart(3)}  ${q.stem.slice(0, 32)}`)
})

#!/usr/bin/env node
/**
 * ascf convert 是从 miniprogram/ 转换过来的，页面内文案用的是小程序端的展示名
 * 「三国问答」（微信那边因为重名换的）。但鸿蒙这边 AGC 上登记的元服务名称是
 * 「三国最强大脑」，为了页面内容和系统级名称（最近任务列表、隐私弹窗等，见
 * AppScope/entry 的 string.json）保持一致，每次转换完之后把 ascf_src 里的
 * 「三国问答」统一替换成「三国最强大脑」。
 *
 * 不改 miniprogram/ 源码本身——微信/抖音端的展示名还是「三国问答」，两边各自独立。
 *
 * 用法：npm run convert:harmonyos 会自动跑这个脚本，手动执行：
 *   node scripts/patch-harmonyos-name.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ascfSrcDir = join(root, 'harmonyos', 'ascf', 'ascf_src')

const FROM = '三国问答'
const TO = '三国最强大脑'
const EXTS = new Set(['.json', '.js', '.hxml', '.css'])

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (name === '__ascfConvertReport') continue
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, files)
    else files.push(full)
  }
  return files
}

let patched = 0
for (const file of walk(ascfSrcDir)) {
  const ext = file.slice(file.lastIndexOf('.'))
  if (!EXTS.has(ext)) continue
  const content = readFileSync(file, 'utf8')
  if (!content.includes(FROM)) continue
  writeFileSync(file, content.split(FROM).join(TO), 'utf8')
  patched += 1
  console.log(`已替换 -> ${file.replace(root + '/', '')}`)
}

console.log(`完成，共改了 ${patched} 个文件：「${FROM}」-> 「${TO}」`)

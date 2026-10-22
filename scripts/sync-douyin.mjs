#!/usr/bin/env node
/**
 * 把题库同步进抖音小程序包目录。
 *
 * douyin/project.config.json 里 miniprogramRoot = "miniprogram/"，
 * 开发者工具只会打包这个目录下的文件；data/questions.json 在仓库根目录，
 * 不属于小程序包，必须同步一份到 douyin/miniprogram/data/ 下才能被 require 到。
 *
 * 注意：抖音小程序不支持直接 require JSON 文件（微信可以，抖音编译会报
 * "Import/require JSON files as modules is not supported"），所以这里把
 * questions.json 包成一个 questions.js（module.exports = [...]）再同步过去。
 *
 * 每次改完题库（跑完 validate / split-public）都要跑一下这个脚本。
 * （微信小程序那份同步用 scripts/sync-miniprogram.mjs，两端题库同源，分开同步。）
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'data', 'questions.json')
const destDir = join(root, 'douyin', 'miniprogram', 'data')
const legacyJson = join(destDir, 'questions.json')
const dest = join(destDir, 'questions.js')

mkdirSync(destDir, { recursive: true })
const content = readFileSync(src, 'utf8')
writeFileSync(dest, `module.exports = ${content}\n`, 'utf8')
if (existsSync(legacyJson)) rmSync(legacyJson) // 清理旧版本遗留的 .json 同步产物

console.log(`已同步题库 -> ${dest}`)

#!/usr/bin/env node
/**
 * 把题库同步进小程序包目录。
 *
 * project.config.json 里 miniprogramRoot = "miniprogram/"，
 * 开发者工具只会打包这个目录下的文件；data/questions.json 在仓库根目录，
 * 不属于小程序包，必须同步一份到 miniprogram/data/ 下才能被 require 到。
 *
 * 每次改完题库（跑完 validate / split-public）都要跑一下这个脚本。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'data', 'questions.json')
const destDir = join(root, 'miniprogram', 'data')
const dest = join(destDir, 'questions.json')

mkdirSync(destDir, { recursive: true })
const content = readFileSync(src, 'utf8')
writeFileSync(dest, content, 'utf8')

console.log(`已同步题库 -> ${dest}`)

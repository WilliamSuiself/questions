// 修复批次文件里被写坏的 JSON 结构：options 对象收尾误写为 "],"
// 规则：形如 `      "D": "..."` 紧跟 `    ],` 的行，把 `],` 改成 `},`
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'data', '_batches')
const files = ['batch-01.json', 'batch-02.json', 'batch-03.json', 'batch-04.json', 'batch-05.json']

for (const f of files) {
  const p = join(dir, f)
  const lines = readFileSync(p, 'utf8').split('\n')
  let fixed = 0
  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i].trim()
    const next = lines[i + 1].trim()
    if (cur.startsWith('"D":') && next === '],') {
      lines[i + 1] = '    },'
      fixed++
    }
  }
  if (fixed) {
    writeFileSync(p, lines.join('\n'), 'utf8')
  }
  console.log(`${f}: 修复 ${fixed} 处`)
}

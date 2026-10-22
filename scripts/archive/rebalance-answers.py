#!/usr/bin/env python3
"""
答案位置重排（一次性修补脚本）
=================================
问题：首批 100 题（batch-01~05）的 answer 全部落在 A，batch-07/08/09 也明显偏 A，
      整库 300 题里 A 占 188 题。只要有一处不做选项打乱（练习模式、导出卷面、
      第三方对接），玩家就能靠位置蒙答案。

做法：只改「哪个字母装正确答案」和「选项文本落到哪个字母」，**选项文本本身一个
      都不改**，题干、解析、来源、难度、分类全部保持原样。
      - 正确答案：按固定随机种子在 A/B/C/D 上均匀分配（300 题 → 各 75 题）
      - 干扰项：按题序轮转分配到剩余三个字母，避免正确答案总是排在最前
      - 解析：少数解析里引用了「B 出自……」「C 是……」这类选项字母，按文本内容
        反查新的字母并同步改写（内容不变）

用法：
  python3 scripts/archive/rebalance-answers.py --check    # 只报告不写
  python3 scripts/archive/rebalance-answers.py --apply    # 真正写回
"""

import argparse
import json
import os
import random
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BATCH_DIR = os.path.join(ROOT, 'data', '_batches')
SEED = 20240614
LETTERS = ['A', 'B', 'C', 'D']

# 解析里出现的 A/B/C/D 一定是选项引用（check-batch.py 已禁止其它拉丁字母进解析）
LETTER_RE = re.compile(r'[ABCD]')


def load_batches():
    files = sorted(f for f in os.listdir(BATCH_DIR) if f.endswith('.json'))
    data = {}
    for f in files:
        path = os.path.join(BATCH_DIR, f)
        data[f] = json.load(open(path, encoding='utf-8'))
    return data


def build_targets(total):
    """均匀分配正确答案位置，并打散顺序。"""
    base = (LETTERS * (total // 4 + 1))[:total]
    rng = random.Random(SEED)
    rng.shuffle(base)
    return base


def rebalance_one(q, target, offset):
    opts = q['options']
    correct_text = opts[q['answer']]
    distractors = [t for k, t in opts.items() if k != q['answer']]
    # 轮转，保证「正确项不是恒定排第一个」时，干扰项的相对顺序也在变
    r = offset % len(distractors)
    distractors = distractors[r:] + distractors[:r]

    others = [k for k in LETTERS if k != target]
    new_opts = {k: '' for k in LETTERS}
    for k, text in zip(others, distractors):
        new_opts[k] = text
    new_opts[target] = correct_text

    # 解析里的字母引用：按「旧字母 -> 文本 -> 新字母」换算
    new_letter_of_text = {t: k for k, t in new_opts.items()}
    analysis = q['analysis']
    if LETTER_RE.search(analysis):
        def sub(m):
            return new_letter_of_text[opts[m.group(0)]]
        analysis = LETTER_RE.sub(sub, analysis)

    out = {}
    for key, val in q.items():
        if key == 'options':
            out['options'] = {k: new_opts[k] for k in LETTERS}
        elif key == 'answer':
            out['answer'] = target
        elif key == 'analysis':
            out['analysis'] = analysis
        else:
            out[key] = val
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='真正写回文件')
    ap.add_argument('--check', action='store_true', help='只报告不写（默认）')
    args = ap.parse_args()

    batches = load_batches()
    total = sum(len(v) for v in batches.values())
    targets = build_targets(total)

    # 直接按批次重建
    new_batches = {}
    idx = 0
    for fname, arr in batches.items():
        rebuilt = []
        for q in arr:
            rebuilt.append(rebalance_one(q, targets[idx], idx))
            idx += 1
        new_batches[fname] = rebuilt

    dist = {L: 0 for L in LETTERS}
    for arr in new_batches.values():
        for q in arr:
            dist[q['answer']] += 1
    print('题数 %d  重排后答案位置分布: %s' % (total, dist))

    # 校验：选项文本集合不变、答案仍命中、解析里没有悬空字母
    old_batches = load_batches()
    problems = []
    for fname in old_batches:
        for oq, nq in zip(old_batches[fname], new_batches[fname]):
            if sorted(oq['options'].values()) != sorted(nq['options'].values()):
                problems.append('%s 选项文本被改动' % oq['id'])
            if nq['answer'] not in nq['options']:
                problems.append('%s answer 不在 options 中' % oq['id'])
            if nq['options'][nq['answer']] != oq['options'][oq['answer']]:
                problems.append('%s 正确答案文本错位' % oq['id'])
            for key in ('stem', 'analysis', 'difficulty', 'category', 'tags', 'source', 'type'):
                if oq[key] != nq[key] and key != 'analysis':
                    problems.append('%s 字段 %s 被改动' % (oq['id'], key))
            if oq['analysis'] != nq['analysis']:
                # 只允许字母发生变化
                if LETTER_RE.sub('#', oq['analysis']) != LETTER_RE.sub('#', nq['analysis']):
                    problems.append('%s 解析非字母部分被改动' % oq['id'])
    if problems:
        print('\n发现 %d 处问题:' % len(problems))
        for p in problems[:40]:
            print('  x ' + p)
        sys.exit(1)
    print('自检通过：选项文本、答案内容、其余字段均未改动。')

    if args.apply:
        for fname, arr in new_batches.items():
            path = os.path.join(BATCH_DIR, fname)
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(arr, f, ensure_ascii=False, indent=2)
                f.write('\n')
        print('已写回 %d 个批次文件。' % len(new_batches))
    else:
        print('（--check 模式，未写文件；加 --apply 执行重排）')


if __name__ == '__main__':
    main()

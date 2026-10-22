#!/usr/bin/env python3
"""
跨题近似撞车检测
================
用法：python3 scripts/check-similarity.py [阈值，默认 0.62]

合并后的题库光靠「题干归一化后完全相同」的查重不够——
换了个问法、换了个切入角度的同一考点也会撞车。
本脚本按字符三元组的 Jaccard 相似度两两比对题干，
把超过阈值的题对列出来，人工判断是否重复。

同一考点反复出现会直接影响线上答题体验，所以这一关必须人工过一遍。
"""

import json
import os
import re
import sys
from itertools import combinations

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PUNCT = re.compile(r'[\s，。、？！；：“”「」《》（）()·…—\-]')


def norm(s):
    return PUNCT.sub('', str(s))


def trigrams(s):
    s = norm(s)
    if len(s) < 3:
        return {s}
    return {s[i:i + 3] for i in range(len(s) - 2)}


def jaccard(a, b):
    if not a or not b:
        return 0.0
    inter = len(a & b)
    return inter / (len(a) + len(b) - inter)


def main():
    threshold = float(sys.argv[1]) if len(sys.argv) > 1 else 0.62
    qs = json.load(open(os.path.join(ROOT, 'data', 'questions.json'), encoding='utf-8'))
    grams = [(q['id'], q['stem'], trigrams(q['stem'])) for q in qs]

    hits = []
    for (i1, s1, g1), (i2, s2, g2) in combinations(grams, 2):
        score = jaccard(g1, g2)
        if score >= threshold:
            hits.append((score, i1, s1, i2, s2))

    hits.sort(reverse=True)
    print('题库总数: %d' % len(qs))
    print('相似度阈值: %.2f' % threshold)
    print('疑似重复题对: %d\n' % len(hits))
    for score, i1, s1, i2, s2 in hits:
        print('  [%.3f] %s × %s' % (score, i1, i2))
        print('      A: %s' % s1)
        print('      B: %s\n' % s2)
    if not hits:
        print('没有相似度超阈值的题对。')


if __name__ == '__main__':
    main()

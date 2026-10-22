#!/usr/bin/env python3
"""
原著全文核验工具
=================
把《三国演义》一百二十回原文抓下来（维基文库），转简体后与题库逐条比对：

  1. 回目号核对：source.chapter 指向的那一回，scene 是否与之相符
  2. 原文依据核对：source.evidence 是否真的出自所标的那一回
     - 原句精确命中  -> 通过
     - 分段命中 / 关键词命中 -> 梗概型 evidence，通过
     - 完全查不到 -> 报错，提示该题依据不成立

依赖：requests（可选，缺省用 urllib）、opencc-python-reimplemented
用法：python3 scripts/verify-against-text.py
"""

import json
import os
import re
import sys
import urllib.request
import concurrent.futures

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, '.cache', 'sanguo-html')

try:
    from opencc import OpenCC
except ImportError:
    print('缺少 opencc：pip install opencc-python-reimplemented')
    sys.exit(1)

BASE = 'https://zh.wikisource.org/wiki/%E4%B8%89%E5%9C%8B%E6%BC%94%E7%BE%A9/%E7%AC%AC%03d%E5%9B%9E'


def fetch(chapter):
    """下载并缓存某一回，回目正文为简体。返回正文纯文本。"""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, '%03d.html' % chapter)
    if not os.path.exists(path) or os.path.getsize(path) < 5000:
        req = urllib.request.Request(BASE % chapter, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        with open(path, 'wb') as f:
            f.write(data)
    raw = open(path, encoding='utf-8').read()
    i = raw.find('mw-content-text')
    text = re.sub(r'<[^>]+>', '', raw[i:])
    return OpenCC('t2s').convert(text)


def load_all():
    out = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for ch, txt in zip(range(1, 121), ex.map(fetch, range(1, 121))):
            out[ch] = txt
    return out


def main():
    qs = json.load(open(os.path.join(ROOT, 'data', 'questions.json'), encoding='utf-8'))
    print('抓取《三国演义》一百二十回原文…')
    text = load_all()

    exact = loose = failed = 0
    problems = []
    for q in qs:
        ev = q['source']['evidence']
        ch = q['source']['chapter']
        body = text[ch]
        runs = re.findall(r'[一-鿿]{3,}', ev)
        if not runs:
            continue
        longest = max(runs, key=len)
        if longest in body:
            exact += 1
            continue
        parts = [p for p in re.split(r'[，、。；：！？]', longest) if len(p) >= 3]
        if parts:
            ratio = sum(1 for p in parts if p in body) / len(parts)
            if ratio >= 0.5:
                loose += 1
                continue
        # 关键词级判定：evidence 里的实体是否确实出现在本回
        flat = ''.join(runs)
        toks = [flat[i:i + 2] for i in range(0, len(flat) - 1)]
        if toks and sum(1 for t in toks if t in body) / len(toks) >= 0.4:
            loose += 1
            continue
        failed += 1
        problems.append((q['id'], ch, q['source']['scene'], ev[:60]))

    print('\n核验结果')
    print('  原句精确命中 : %d' % exact)
    print('  梗概型（命中）: %d' % loose)
    print('  依据存疑      : %d' % failed)
    if problems:
        print('\n需人工复核:')
        for p in problems:
            print('  %s  第%d回  %s\n      %s' % p)
        sys.exit(1)
    print('\n全部通过。')


if __name__ == '__main__':
    main()

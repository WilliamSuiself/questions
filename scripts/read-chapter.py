#!/usr/bin/env python3
"""
读取《三国演义》某一回正文（简体，本地缓存）
============================================
用法：
  python3 scripts/read-chapter.py 42            # 读第 42 回
  python3 scripts/read-chapter.py 40 45          # 读第 40~45 回
  python3 scripts/read-chapter.py --grep 甘宁   # 全书检索关键词

正文来自维基文库《三国演义》一百二十回，已离线转成简体纯文本放在
`.cache/texts/NNN.txt`，**默认完全离线，不联网**。
本地缓存缺失时才会去抓取维基文库（需要网络），并自动写回 `.cache/texts/`。
"""

import os
import re
import sys
import html
import urllib.request
import concurrent.futures

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEXT_DIR = os.path.join(ROOT, '.cache', 'texts')
HTML_CACHE = os.path.join(ROOT, '.cache', 'sanguo-html')
BASE = 'https://zh.wikisource.org/wiki/%E4%B8%89%E5%9C%8B%E6%BC%94%E7%BE%A9/%E7%AC%AC%03d%E5%9B%9E'


def _build_from_html(chapter):
    """从 HTML 缓存生成简体纯文本（仅在纯文本缓存缺失时调用）。"""
    try:
        from opencc import OpenCC
    except ImportError:
        raise RuntimeError('缺少 opencc：pip install opencc-python-reimplemented')

    os.makedirs(HTML_CACHE, exist_ok=True)
    path = os.path.join(HTML_CACHE, '%03d.html' % chapter)
    if not os.path.exists(path) or os.path.getsize(path) < 5000:
        req = urllib.request.Request(BASE % chapter, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        with open(path, 'wb') as f:
            f.write(data)

    raw = open(path, encoding='utf-8').read()
    i = raw.find('mw-content-text')
    t = re.sub(r'<[^>]+>', '', raw[i:])
    t = OpenCC('t2s').convert(t)
    for marker in ('infalsefalse', 'mw-parser-output .licenseContainer',
                   '此作品在全世界都属于公有领域', '本作品在全世界都属于公有领域'):
        j = t.find(marker)
        if j > 0:
            t = t[:j]
    t = html.unescape(t)
    t = re.sub(r'\n{3,}', '\n\n', t).strip()
    m = re.search(r'第[一二三四五六七八九十百零]+回\s*[^\n]{2,40}', t)
    title = re.sub(r'下一回.*$', '', m.group(0).strip()).strip() if m else ''
    out = '【第%d回】%s\n\n%s\n' % (chapter, title, t)
    os.makedirs(TEXT_DIR, exist_ok=True)
    with open(os.path.join(TEXT_DIR, '%03d.txt' % chapter), 'w', encoding='utf-8') as f:
        f.write(out)
    return out


def load(chapter):
    path = os.path.join(TEXT_DIR, '%03d.txt' % chapter)
    if os.path.exists(path):
        return open(path, encoding='utf-8').read()
    return _build_from_html(chapter)


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(2)
    if args[0] == '--grep':
        kw = args[1]
        hits = []
        for ch in range(1, 121):
            txt = load(ch)
            for m in re.finditer(re.escape(kw), txt):
                s = max(0, m.start() - 45)
                hits.append((ch, txt[s:m.end() + 45].replace('\n', ' ')))
        print('「%s」全书命中 %d 处：' % (kw, len(hits)))
        for ch, ctx in hits:
            print('  ch%-4d %s' % (ch, ctx))
        return
    start = int(args[0])
    end = int(args[1]) if len(args) > 1 else start
    for ch in range(start, end + 1):
        print('\n' + '=' * 70)
        print(load(ch))


if __name__ == '__main__':
    main()

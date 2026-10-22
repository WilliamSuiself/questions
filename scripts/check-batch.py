#!/usr/bin/env python3
"""
单批次自检工具（不写任何文件，纯只读）
=====================================
用法：python3 scripts/check-batch.py data/_batches/batch-06.json [更多文件...]

只检查你指定的批次文件：
  1. JSON 合法性、顶层是数组
  2. 单题结构：type/stem/options(A-D)/answer/analysis/difficulty/category/tags/source
  3. 选项文本互不重复；answer 必须命中 options
  4. 中文文本字段不得混入拉丁字母（解析里单独指代 A/B/C/D 除外）与替换字符
  5. source.evidence 是否真的出自 source.chapter 那一回（原著全文比对）
  6. 与「其他批次 + 现有题库」比对题干，判断是否与已有题目撞车

第 6 项只做「题干高度重合」的机械比对（同字/同义前缀），语义撞车仍需人工判断。

依赖：opencc-python-reimplemented（用于繁转简比对）
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, '.cache', 'sanguo-html')

try:
    from opencc import OpenCC
except ImportError:
    print('缺少 opencc：pip install opencc-python-reimplemented')
    sys.exit(1)

VALID_CATEGORY = {
    '人物字号', '人物生平', '经典场景', '谋略计策',
    '经典战役', '诗词原文', '兵器坐骑', '地名官职', '成语典故',
}

CC = OpenCC('t2s')
_TEXTS = {}


def chapter_text(ch):
    if ch in _TEXTS:
        return _TEXTS[ch]
    path = os.path.join(CACHE, '%03d.html' % ch)
    if not os.path.exists(path):
        return None
    raw = open(path, encoding='utf-8').read()
    i = raw.find('mw-content-text')
    txt = CC.convert(re.sub(r'<[^>]+>', '', raw[i:]))
    _TEXTS[ch] = txt
    return txt


def norm(s):
    return re.sub(r'[\s，。、？！；：“”「」《》（）()·…—]', '', str(s))


def evidence_status(ev, body):
    """返回 (状态, 说明) 状态 ∈ exact / loose / miss"""
    runs = re.findall(r'[一-鿿]{3,}', ev)
    if not runs:
        return 'miss', 'evidence 里没有足够的中文片段'
    longest = max(runs, key=len)
    if longest in body:
        return 'exact', '原句精确命中'
    parts = [p for p in re.split(r'[，、。；：！？]', longest) if len(p) >= 3]
    if parts:
        ratio = sum(1 for p in parts if p in body) / len(parts)
        if ratio >= 0.5:
            return 'loose', '分段命中 %.0f%%' % (ratio * 100)
    flat = ''.join(runs)
    toks = [flat[i:i + 2] for i in range(0, len(flat) - 1)]
    if toks and sum(1 for t in toks if t in body) / len(toks) >= 0.4:
        return 'loose', '关键词命中'
    return 'miss', '在本回查不到'


def collect_others(my_files):
    """收集本批次之外的所有题目，用于撞车检查。"""
    others = []
    bdir = os.path.join(ROOT, 'data', '_batches')
    if os.path.isdir(bdir):
        for f in sorted(os.listdir(bdir)):
            if not f.endswith('.json') or os.path.join(bdir, f) in my_files:
                continue
            try:
                others += json.load(open(os.path.join(bdir, f), encoding='utf-8'))
            except Exception:
                pass
    return others


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)

    my_files = [os.path.abspath(p) for p in sys.argv[1:]]
    others = collect_others(set(my_files))
    other_stems = [(norm(q.get('stem', '')), q.get('id', '?')) for q in others]

    errors, warns, misses = [], [], []
    total = 0
    cat_count, diff_count = {}, {}

    for path in my_files:
        try:
            arr = json.load(open(path, encoding='utf-8'))
        except Exception as e:
            errors.append('%s: JSON 解析失败 %s' % (path, e))
            continue
        if not isinstance(arr, list):
            errors.append('%s: 顶层不是数组' % path)
            continue
        total += len(arr)
        for i, q in enumerate(arr):
            tag = '%s[%d]' % (os.path.basename(path), i)
            for key in ('id', 'type', 'stem', 'options', 'answer', 'analysis',
                        'difficulty', 'category', 'tags', 'source'):
                if key not in q:
                    errors.append('%s: 缺字段 %s' % (tag, key))
            if q.get('type') != 'single':
                errors.append('%s: type 必须是 single' % tag)
            stem = q.get('stem')
            if not isinstance(stem, str) or not (6 <= len(stem) <= 120):
                errors.append('%s: stem 长度不合规 (%s)' % (tag, len(stem or '')))
            opts = q.get('options') or {}
            if sorted(opts.keys()) != ['A', 'B', 'C', 'D']:
                errors.append('%s: options 必须恰含 A/B/C/D，实际 %s' % (tag, sorted(opts.keys())))
            elif len(set(opts.values())) != 4:
                errors.append('%s: 同题内选项文本重复' % tag)
            if q.get('answer') not in ('A', 'B', 'C', 'D'):
                errors.append('%s: answer 非法 %r' % (tag, q.get('answer')))
            elif opts and q.get('answer') not in opts:
                errors.append('%s: answer 不在 options 中' % tag)
            ana = q.get('analysis')
            if not isinstance(ana, str) or not (10 <= len(ana) <= 300):
                errors.append('%s: analysis 长度不合规 (%s)' % (tag, len(ana or '')))
            if q.get('difficulty') not in (1, 2, 3):
                errors.append('%s: difficulty 非法 %r' % (tag, q.get('difficulty')))
            if q.get('category') not in VALID_CATEGORY:
                errors.append('%s: category 非法 %r' % (tag, q.get('category')))
            cat_count[q.get('category')] = cat_count.get(q.get('category'), 0) + 1
            diff_count[q.get('difficulty')] = diff_count.get(q.get('difficulty'), 0) + 1
            tags = q.get('tags')
            if not isinstance(tags, list) or not (1 <= len(tags) <= 5):
                errors.append('%s: tags 必须是 1~5 项数组' % tag)
            src = q.get('source')
            if not isinstance(src, dict):
                errors.append('%s: source 必须是对象' % tag)
                continue
            ch = src.get('chapter')
            if not (isinstance(ch, int) and 1 <= ch <= 120):
                errors.append('%s: source.chapter 非法 %r' % (tag, ch))
            if not isinstance(src.get('scene'), str) or len(src['scene']) < 2:
                errors.append('%s: source.scene 缺失' % tag)
            ev = src.get('evidence')
            if not isinstance(ev, str) or len(ev) < 4:
                errors.append('%s: source.evidence 缺失' % tag)
                ev = ''
            # 文本污染
            fields = {'stem': stem, 'analysis': ana}
            for k, v in (opts or {}).items():
                fields['options.%s' % k] = v
            fields['source.scene'] = src.get('scene')
            fields['source.evidence'] = ev
            for k, v in fields.items():
                if not isinstance(v, str):
                    continue
                for run in re.findall(r'[A-Za-z]+', v):
                    if not re.fullmatch(r'[ABCD]', run):
                        errors.append('%s: %s 混入拉丁字符 %s' % (tag, k, run))
                if '\ufffd' in v:
                    errors.append('%s: %s 含替换字符' % (tag, k))
            # 撞车检查
            if isinstance(stem, str):
                ns = norm(stem)
                for other, oid in other_stems:
                    if not other:
                        continue
                    if ns == other:
                        errors.append('%s: 题干与既有题 %s 完全重复' % (tag, oid))
                        break
                    if len(ns) >= 12 and len(other) >= 12:
                        shorter, longer = sorted([ns, other], key=len)
                        if longer[:12] == shorter[:12]:
                            warns.append('%s: 题干开头与 %s 高度相似，请确认是否重复' % (tag, oid))
                            break
            # 原著核验
            if isinstance(ch, int) and 1 <= ch <= 120 and ev:
                body = chapter_text(ch)
                if body is None:
                    warns.append('%s: 本地无第%d回缓存，跳过原文核验' % (tag, ch))
                else:
                    st, why = evidence_status(ev, body)
                    if st == 'miss':
                        misses.append('%s: 第%d回 查不到 —— %s | %s' % (tag, ch, ev[:70], why))

    print('批次题数: %d' % total)
    print('分类分布: %s' % json.dumps(cat_count, ensure_ascii=False))
    print('难度分布: %s' % json.dumps(diff_count, ensure_ascii=False))
    if warns:
        print('\n提醒 %d 条:' % len(warns))
        for w in warns[:40]:
            print('  ! ' + w)
    if errors:
        print('\n错误 %d 条:' % len(errors))
        for e in errors[:60]:
            print('  x ' + e)
    if misses:
        print('\n原文核验不通过 %d 条:' % len(misses))
        for m in misses[:60]:
            print('  ? ' + m)
    if errors or misses:
        sys.exit(1)
    print('\n本批次自检通过。')


if __name__ == '__main__':
    main()

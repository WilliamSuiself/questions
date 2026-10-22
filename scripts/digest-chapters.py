#!/usr/bin/env python3
"""
回目浓缩提要（供写题时快速取料）
================================
用法：python3 scripts/digest-chapters.py 6 25      # 第 6~25 回
      python3 scripts/digest-chapters.py 6 25 --full  # 附完整正文

对每一回输出三块东西：
  1. 回目名 + 「后人有诗」原句（诗词原文类题目的直接素材）
  2. 本回人物名单及各自首次出现的上下文（人物字号/生平类题目的素材）
  3. 本回带引号的「名句」（对话、军令、书信、判词），这是最可靠的原文依据素材

全部读本地 `.cache/texts/`，不联网。
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEXT_DIR = os.path.join(ROOT, '.cache', 'texts')

ROSTER = """
刘备 关羽 张飞 诸葛亮 庞统 法正 赵云 马超 黄忠 魏延 严颜 马岱 姜维 邓艾 钟会 诸葛诞
曹操 曹丕 曹叡 曹芳 曹真 夏侯惇 夏侯渊 夏侯楙 曹仁 张辽 张郃 徐晃 于禁 郭淮 荀彧 荀攸
贾诩 郭嘉 许攸 田丰 沮授 审配 陈宫 高览 颜良 文丑 张绣 张济 贾诩 典韦 曹昂 许褚
孙权 孙坚 孙策 孙皓 孙登 步练 凌统 周瑜 鲁肃 吕蒙 陆逊 太史慈 周泰 甘宁 黄盖 韩当
蒋钦 丁奉 潘璋 虞翻 诸葛瑾 张昭 蒋干 程普 陆抗 徐盛 朱然
孔融 祢衡 阮瑀 陈琳 华佗 董承 伏完 蔡邕 左慈 管辂 许劭 陈登 司马徽 黄承彦
张松 孟达 马良 马谡 关兴 张苞 刘封 廖化 张翼 蒋琬 费祎 董允 诸葛瞻 诸葛尚
张鲁 严白虎 刘繇 刘表 刘璋 刘晔 蒋干 陈武 董袭 甘夫人 糜竺 简雍 孙乾 伊籍 秦宓 许靖
张翼 严颜 杨洪 高沛 魏延 彭祖 罗尚 孟达 费诗 王平 句安 李严
文鸯 曹髦 王经 贾充 钟繇 王昶 郭淮 毌丘俭 文钦 诸葛诞 曹纯 曹休
王双 邓艾 桓温 陆抗 孙盛 严畯 钟会 蒋琬 费祎 姜维 诸葛瞻
""".split()
ROSTER = sorted(set(ROSTER))


def load(ch):
    p = os.path.join(TEXT_DIR, '%03d.txt' % ch)
    if not os.path.exists(p):
        return None
    return open(p, encoding='utf-8').read()


def title_of(txt):
    first = txt.split('\n')[0]
    return first.replace('【第', '').replace('】', ' ').strip()


def body_of(txt):
    parts = txt.split('\n\n', 1)
    body = parts[1] if len(parts) > 1 else txt
    # 去掉维基文库页眉（目录 / ◀上一回 / 回目名 / 下一回▶）
    i = body.find('下一回▶')
    if 0 <= i < 200:
        body = body[i + len('下一回▶'):]
    return body.strip()


def sentences(txt):
    t = re.sub(r'　+', ' ', txt)
    # 句末标点后可能跟着闭引号，断句时要把闭引号留在同一句里
    parts = re.split(r'(?<=[。！？])(?![」』])', t)
    out = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        # 把跟在后面的闭引号补回上一句
        out.append(p)
    merged = []
    for p in out:
        if merged and p and p[0] in '」』':
            merged[-1] += p[0]
            p = p[1:].strip()
            if not p:
                continue
        if len(p) >= 8:
            merged.append(p)
    return merged



def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    full = '--full' in sys.argv
    tight = '--tight' in sys.argv
    if len(args) < 2:
        print(__doc__)
        sys.exit(2)
    start, end = int(args[0]), int(args[1])

    for ch in range(start, end + 1):
        txt = load(ch)
        if txt is None:
            print('!! 第%d回无本地文本' % ch)
            continue
        body = body_of(txt)
        print('\n' + '=' * 76)
        print(title_of(txt))
        print('=' * 76)

        if full:
            print(body)
            continue

        sents = sentences(body)

        # 1. 后人有诗
        poems = [s for s in sents if '后人有诗' in s or '有诗叹曰' in s or '有诗为证' in s]
        if poems:
            print('【后人有诗】')
            for p in poems:
                print('  ' + p[:200])

        # 2. 人物首次出现
        people = []
        for name in ROSTER:
            hit = next((s for s in sents if name in s), None)
            if hit:
                people.append((name, hit))

        if tight:
            # 精简模式：只列人物与出现次数，省 token
            print('【人物】' + '、'.join(
                '%s×%d' % (n, body.count(n)) for n, _ in people))
            continue

        if people:
            print('【人物与首现】')
            for name, hit in people:
                print('  · %s：%s' % (name, hit[:105]))

        # 3. 名句（含引号）
        quotes = [s for s in sents if '「' in s]
        if quotes:
            print('【名句】')
            for q in quotes[:22]:
                print('  ' + q[:135])




if __name__ == '__main__':
    main()

# 三国问答 · 题库工程

《三国演义》原著问答小程序的内容工程：**一道题目 = 一条可校验的数据**。
题干、选项、答案、解析全部以罗贯中《三国演义》一百二十回为唯一依据，
评书 / 戏曲 / 民间演绎的设定不作为正确答案来源。

## 当前进度

- 题库：**302 道单选题**（`data/questions.json`）
- 分类：人物字号 37 / 人物生平 30 / 经典场景 60 / 谋略计策 38 / 经典战役 45 / 诗词原文 23 / 兵器坐骑 16 / 地名官职 22 / 成语典故 31
- 难度：易 67 / 中 169 / 难 66
- 答案位置：A 75 / B 76 / C 75 / D 76，基本均匀（任何一版都不存在「蒙答案」的位置规律）
- 每题带 `source.chapter`（回目号）、`source.scene`（情节名）、`source.evidence`（原文依据）三件套，可回查原著
- 全部 302 题已用《三国演义》一百二十回全文逐条核验：**285 题 evidence 为原著原句精确命中，17 题为原文情节的忠实梗概，0 题依据存疑**
- 取材覆盖全部 **120 个回目**，每回至少一题；与前 100 题无重复考点

## 目录

```
data/
  questions.json              # 主题库（开发用，含答案解析）
  questions.public.json       # 线上面包（拆掉答案解析）
  questions.answers.json      # 答案包（线上建议服务端下发）
  questions.meta.json         # 元信息 + 分布统计
  schema/question.schema.json # JSON Schema (draft-07)
  _batches/                   # 分批编辑源文件（合并脚本的输入）
scripts/
  validate.mjs                # 合并 + 校验（提交前必跑）
  split-public.mjs            # 拆包 + 生成元信息
  verify-against-text.py      # 原著全文核验（抓 120 回原文逐题比对）
  check-batch.py              # 单批次只读自检（字段/答案/原文命中/撞车）
  check-similarity.py         # 跨题近似撞车检测（字符三元组 Jaccard）
  read-chapter.py             # 离线读某一回正文 / 全书检索
  digest-chapters.py          # 回目提要（回目名 / 后人有诗 / 人物表）
  archive/                    # 一次性修补脚本（历史记录，可删）
docs/
  DATA_STRUCTURE.md           # 数据结构设计详解
miniprogram/
  utils/questionBank.js       # 取题 / 判分 / 错题本 / 统计
  pages/quiz/                 # 答题页示例
```

## 常用命令

```bash
# 合并批次 + 全量校验（改完题必须跑，有错会 exit 1）
node scripts/validate.mjs

# 拆出线上面包与答案包
node scripts/split-public.mjs

# 原著全文核验（需要网络；首次会缓存到 .cache/sanguo-html）
pip install opencc-python-reimplemented
python3 scripts/verify-against-text.py
```

## 校验脚本查什么

`scripts/validate.mjs` 在合并时逐题检查，有错直接失败退出：

- JSON 合法性、顶层结构
- id 唯一、格式为 `sg-001`
- `options` 恰好含 A/B/C/D 四个键，值不重复
- `answer` 必须命中 `options` 中的键
- `analysis` / `source.evidence` 非空、长度合规
- `difficulty` ∈ {1,2,3}，`category` ∈ 九类白名单，`tags` 1~5 项
- `source.chapter` ∈ 1~120 或 `null`
- 题干归一化后查重
- **题干里写明的回数必须与 `source.chapter` 一致**（内置中文数字解析器，`第九十四回` ↔ `94`）
- **中文字段里混入拉丁字母 / 替换字符**（防止批量生成时混进脏文本）

辅助校验（不改文件，只报告）：

```bash
python3 scripts/check-batch.py data/_batches/batch-10.json   # 单批字段/答案/原文命中/撞车
python3 scripts/check-similarity.py 0.62                     # 跨题近似撞车，默认 0.62
python3 scripts/read-chapter.py 114                          # 离线读第 114 回
python3 scripts/read-chapter.py --grep 辛宪英                 # 全书检索
python3 scripts/digest-chapters.py 94 118 --tight             # 回目/后人有诗/人物表提要
```

## 加题流程

1. 在 `data/_batches/` 新建 `batch-11.json`（数组，字段照抄现有批次）
2. `python3 scripts/check-batch.py data/_batches/batch-11.json` —— 单批自检（含原文核验与撞车检查）
3. `node scripts/validate.mjs` —— 会重新编号 `sg-001`… 并全量校验
4. `python3 scripts/verify-against-text.py` —— 回原著核对新题的 `evidence` 是否真的出自所标回目
5. `python3 scripts/check-similarity.py` —— 全库近似撞车检测
6. `node scripts/split-public.mjs` —— 重新拆包
7. `npm run sync`（即 `sync-miniprogram.mjs` + `sync-douyin.mjs`）—— 同步题库到微信 / 抖音两个小程序包目录
8. 提交

批次文件按文件名排序合并，**顺序决定最终题号**。批次内部的 `id` 会被覆盖，随便写。

## 用微信开发者工具运行

本仓库根目录就是一个完整的小程序项目：

1. 打开「微信开发者工具」→「导入项目」，目录选本仓库根目录（`question/`）。
2. AppID 填自己的小程序 AppID；没有的话选「测试号」（`project.config.json` 里默认写的是
   `touristappid` 占位值，导入时工具会提示替换）。
3. `project.config.json` 里 `miniprogramRoot` 是 `miniprogram/`，开发者工具只会编译这个目录，
   题库 JSON 不在里面是打不进包的——所以仓库里放了一份同步脚本：

   ```bash
   node scripts/sync-miniprogram.mjs   # 把 data/questions.json 拷贝进 miniprogram/data/
   ```

   **改完题库（跑完 validate / split-public 之后）一定要重跑这一步**，否则小程序里看到的还是旧题。
   `npm run build` 已经把这一步串进去了。
4. 开发者工具里点「编译」即可预览；没问题后用「上传」按钮提交体验版 / 审核。

### 页面结构

```
miniprogram/
  app.js / app.json / app.wxss / sitemap.json
  data/questions.json          # 由 scripts/sync-miniprogram.mjs 同步，不要手改
  utils/questionBank.js        # 取题 / 判分 / 错题本 / 统计
  pages/
    index/      # 首页：夺标模式（推荐位）/ 快速一局 / 分类练习 / 错题本 / 学习报告 入口
    challenge/  # 夺标模式：从 0 分开始、错 3 题结束，答对题数即分数，自动刷新历史最高分
    category/   # 分类选择列表
    quiz/       # 答题页，支持 ?category=xxx、?count=10、?mode=wrong（错题重练）
    wrongbook/  # 错题本：查看 + 一键重练 + 清空
    report/     # 学习报告：累计数据 + 各分类掌握度
```

## 用抖音开发者工具运行

`douyin/` 目录是抖音小程序版本，页面逻辑和微信版一一对应，只是：

- `.wxml` → `.ttml`，`.wxss` → `.ttss`，模板指令 `wx:if/for/key` → `tt:if/for/key`
- API 调用 `wx.xxx` → `tt.xxx`（`getStorageSync`/`setStorageSync`/`navigateTo`/`navigateBack`/`redirectTo`/`setNavigationBarTitle` 等命名一致，直接替换前缀）
- `getCurrentPages()` 是全局函数，两端都一样，不用改

运行步骤：

1. 打开「抖音开发者工具」→「导入项目」，目录选 `douyin/`（不是仓库根目录）。
2. AppID 填自己的抖音小程序 AppID；没有的话先用占位的 `touristappid`，工具会提示注册 / 替换。
3. 同理，`douyin/project.config.json` 的 `miniprogramRoot` 是 `miniprogram/`，题库也要单独同步：

   ```bash
   node scripts/sync-douyin.mjs   # 把 data/questions.json 包成 douyin/miniprogram/data/questions.js
   ```

   `npm run sync` / `npm run build` 已经把微信、抖音两份同步脚本都串进去了，**改完题库记得跑一遍**。
4. 开发者工具里点「编译」预览，没问题后「上传」提交审核，和微信小程序同步发布。

两端共用同一份 `data/questions.json`，题库只在仓库根目录改一处，分别同步到 `miniprogram/data/` 和 `douyin/miniprogram/data/` 即可，不会出现内容不一致。

```
douyin/
  project.config.json
  miniprogram/
    app.js / app.json / app.ttss
    data/questions.js            # 由 scripts/sync-douyin.mjs 同步生成（抖音不支持 require JSON，打包成 .js 模块），不要手改
    utils/questionBank.js        # 与微信版 API 完全一致，仅 wx.* 换成 tt.*
    pages/                       # index / challenge / category / quiz / wrongbook / report，逻辑与微信版一一对应
```

## 用华为 ASCF 工具转鸿蒙元服务

`harmonyos/` 是用华为官方 `@atomicservice/ascf-toolkit` 把 `miniprogram/`（微信小程序版）
转换出来的 HarmonyOS 元服务（Atomic Service）工程骨架：

```bash
npm install                 # 装 @atomicservice/ascf-toolkit（devDependency）
npm run convert:harmonyos   # 等价于 ascf convert -i miniprogram -o harmonyos -c
```

转换本身不需要 DevEco Studio；但编译签名出 HAP/APP 包需要鸿蒙 SDK（无论装不装 DevEco
Studio 的图形界面，SDK 本体都要 ~7GB），建议在另一台磁盘空间够用的电脑上完成，具体步骤
（替换占位 appId、配签名、编译打包）写在 `harmonyos/README.md` 里。

## 小程序端接入（题库 API）

```js
const bank = require('./utils/questionBank')

const list = bank.pickQuestions({ count: 10 })            // 随机抽 10 题
const list2 = bank.pickQuestions({ category: '谋略计策' })  // 按分类抽题
const list3 = bank.pickByIds(['sg-001', 'sg-002'])         // 按 id 取题（错题重练用）
const res = bank.judge(list[0], 'B')                      // 判分
const detail = bank.getAnalysis(list[0].id)               // 取解析 + 出处
bank.recordAnswer(list[0].id, res.correct)                // 记错题本 / 统计（答对会自动清出错题本）

const best = bank.getChallengeBest()                      // 夺标模式历史最高分（答对题数）
bank.recordChallengeScore(score)                          // 结算一局夺标模式，超过历史最高就刷新
```

`pickQuestions` / `pickByIds` 打乱的是选项**文本**的顺序，但展示用的字母徽标
（`options[i].key`）永远按屏幕位置重新贴成 `A → D`，保证界面上看到的选项永远是
`A/B/C/D` 从上到下顺序排列，不会出现「乱序」的观感。原始题库里的字母（`originalKey`）
只在内部用于比对 `judge`，不直接等于正确答案，不会在作答前就暴露给前端。

## 图标 / Logo

仓库根目录的 `icon.png`（原图 1536×1536）是设计稿；代码里实际用的是用 `sips` 压缩到
256×256 的 `miniprogram/images/logo.png`（微信、抖音两份一致），已经加到首页 hero
区域展示，并作为 `onShareAppMessage` 的转发封面图（`pages/index/index.js`）。

**注意**：小程序在「发现 / 搜索」里显示的头像图标，微信和抖音都是在各自的管理后台设置的
（微信公众平台「小程序管理」→「小程序信息」→头像；抖音开放平台「小程序信息」里同理），
**不是在代码里配置的**，代码里也没有类似 `app.json` 的 `icon` 字段可以改。
真要上线，拿根目录这份原图 `icon.png`（已经是方形、分辨率够高）去两边后台各传一次头像即可。
如果以后加了底部 tabBar，再另外准备一套 81×81 的 tabBar 图标放进 `images/` 并在
`app.json` 里配置 `tabBar.list[].iconPath`。

## 上线前的安全建议

`questions.json` 里同时含答案和解析，直接打进小程序包会被反编译看到。
线上请用 `questions.public.json`（随包）+ `questions.answers.json`（云函数下发、服务端判分）。
详见 `docs/DATA_STRUCTURE.md` 第四节。

## 校对说明

- `source.evidence` 是判卷依据：写题时凡在原著中找不到出处的句子，要么改写要么删题。
- `source.chapter` 允许为 `null`——跨回情节或存疑时留空，不硬填一个可能错的号，
  以 `scene` + `evidence` 为准。
- **只认《三国演义》正文**：曹操的《观沧海》《龟虽寿》《蒿里行》原著并未收录，
  《三国志》的「跨有荆益」也不是原著措辞；评书、戏曲、民间演绎的设定不作为答案来源。
- 原著与史传不一致时以原著为准（如第四十一回写曹昂为曹操妾室刘氏所生）。

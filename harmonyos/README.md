# 三国问答 —— 鸿蒙元服务（ASCF 工程）

这个目录是用华为官方 **ASCF**（元服务转换框架）工具，从 `../miniprogram`（微信小程序源码）
自动转换出来的 HarmonyOS 元服务（Atomic Service）工程。转换本身不需要装 DevEco Studio，
只有「编译签名出 HAP/APP 包」这一步才需要鸿蒙的 SDK / 构建工具链，建议在另一台磁盘空间
充足、装好 DevEco Studio（或至少装了 command-line-tools）的电脑上完成。

## 这个工程是怎么来的

```bash
npm install                          # 装 @atomicservice/ascf-toolkit（devDependency）
npm run convert:harmonyos            # 等价于：ascf convert -i miniprogram -o harmonyos -c
```

转换后的小程序源码在 `ascf/ascf_src/`（app.js/app.json/app.css + pages/ + utils/ + data/，
和微信小程序的 wxml/wxss 对应改成了 hxml/css），`ascf` 构建插件会在真正编译时把这些内容
转换成 ArkTS 产物。**以后只要 `miniprogram/` 里的内容（页面、题库）有更新，重新跑一遍
`npm run convert:harmonyos` 同步过来就行，不要手改 `ascf/ascf_src/` 里的文件**（会被下次
转换覆盖）。

官方转换报告在 `ascf/ascf_src/__ascfConvertReport/index.html`（已 gitignore，不进仓库），
这次转换结果：**0 处不支持的组件/API**，全部题库页面（首页、夺标模式、分类练习、答题、
错题本、学习报告）转换干净。

## 到另一台电脑上要做的事

### 1. 装环境

二选一：

- 完整 **DevEco Studio**（推荐，图形界面能直接签名、跑模拟器预览）
- 只装 **HarmonyOS command-line-tools**（没有 IDE 界面，纯命令行构建签名；注意 SDK 本体
  还是要 ~7GB，装不装 IDE 省不了这部分空间）

### 2. 在 AppGallery Connect 创建元服务，拿到真实 appId

登录 [AppGallery Connect](https://developer.huawei.com/consumer/cn/service/josp/agc/index.html)
→ 我的项目 → 创建项目 → 添加元服务，拿到真实的 **AppID**（数字）和由它派生出的
**bundleName**（格式固定是 `com.atomicservice.<AppID>`）。

### 3. 替换这个工程里的占位 AppID

当前工程是用占位 `appId=1234567890` 生成的骨架，**必须替换成上一步拿到的真实值**，
至少改这一处：

```json5
// AppScope/app.json5
"bundleName": "com.atomicservice.1234567890"   // 改成 com.atomicservice.<你的真实 AppID>
```

如果用 DevEco Studio 打开工程、在项目设置里关联 AGC 账号下的元服务，它通常会帮你自动
改对；手动改的话记得同时检查 `entry/src/main/module.json5` 里有没有引用到旧 appId
的地方。

### 4. 配置签名

`build-profile.json5` 里 `signingConfigs` 当前是空的 `[]`。在 DevEco Studio 里用
「File > Project Structure > Signing Configs」勾选自动签名最省事；纯命令行的话需要自己
生成/导入 `.p12`、`.cer`、`.p7b`（HAP Provision Profile），可以用 ASCF 工具自带的签名辅助：

```bash
ascf generate-p12   # 生成 .p12
ascf generate-csr   # 生成证书请求文件（.csr），拿去 AGC 后台申请证书
ascf signtools       # 查看签名指纹等
```

证书、Provision Profile 本身还是要去 AGC 后台「证书管理 / HAP Provision Profile 管理」里
申请，参考华为官方文档「编译元服务」。

### 5. 编译 + 安装/打包

```bash
ascf compile .                          # 把 ascf_src 编译进 entry/src/main/resources/rawfile
ascf build assembleHap -r . -m debug    # 出 HAP/HSP（调试包）
ascf build assembleApp -r . -m release  # 出上架用的 APP 包
```

或者直接用 hvigorw（如果装的是 command-line-tools，需要先配好 `DEVECO_SDK_HOME` 环境变量
指向 SDK 根目录）：

```bash
hvigorw assembleHap -p product=default
hvigorw assembleApp -p product=default --mode module -p buildMode=release
```

打出来的 APP 包去 AppGallery Connect「版本管理」里提审发布即可。

## 已知局限 / TODO

- 这份转换是基于**微信小程序版**（`miniprogram/`）转的，没有转抖音版（`douyin/`），
  ASCF 工具本身是按通用小程序语法识别的，微信版本就够用了。
- 占位信息（appId、vendor、签名）都要在另一台机器上换成真实的，上面第 3、4 步不能跳过，
  否则签名/上架会失败。当前 `AppScope/app.json5` 的 `vendor` 还是占位值 `example`，
  **必须替换成真实的开发者/公司名称**才能提审。
- 如果 ASCF 运行时对某些 API 的支持随版本变化，转换报告里会列出「不支持」的组件/API 和
  对应的 TODO 注释，下次转换前记得看一眼报告（这次是 0 个，但以后题库/页面改多了可能会
  用到不支持的新组件，要留意）。
- `ascf/ascf_src/app.json` 里的 `navigationBarTitleText`（页面内顶部标题）跟着
  `miniprogram/` 同步，显示的是「三国问答」；而 `AppScope`/`entry` 这边的系统级名称
  （`app_name`/`EntryAbility_label`）是「三国最强大脑」，跟 AGC 上登记的元服务名称保持一致
  （见下面「审核整改记录」）。这两个名字目前不一样：系统级的（最近任务列表、隐私弹窗等）
  看到的是「三国最强大脑」，元服务内容页面顶部看到的是「三国问答」。如果觉得这样不够
  统一，有两个选择：要么去 AGC 后台把元服务名称也改成「三国问答」，要么在
  `npm run convert:harmonyos` 之后额外加一步脚本把 `ascf_src/app.json` 的标题也改成
  「三国最强大脑」（目前没加这一步，怕后续改动被转换覆盖又要重改，先维持现状）。

## 审核整改记录（第一轮）

| 审核问题 | 处理方式 |
| --- | --- |
| 图标未用官方工具生成、尺寸不规范、最近任务列表显示系统图标 | `AppScope/.../app_icon.png` 之前是 ASCF 模板的示例图标，`entry/.../startIcon.png` 之前甚至是个 **1×1 空白像素**——这就是"显示系统图标"的直接原因。已经用根目录 `icon.png` 裁出人物+问号的主体部分，加了安全区留白，生成了两张 512×512 的新图标替换上去。**这只是应急替换，不是最终合规图标**——华为明确要求必须用 DevEco Studio 的 **Image Asset 工具**重新生成（它会自动做前景/背景分层、适配"睫毛"遮罩、多密度切图），到另一台装了 DevEco Studio 的机器后，这一步必须补做：Image Asset 工具里选当前 `app_icon.png` 作为前景图样（或者重新设计一版更简洁的图标，毕竟现在这版还是从宣传海报里抠出来的，细节略多），生成后替换这两个文件。 |
| 隐私弹窗 / 最近任务列表显示的元服务名称与 AGC 提交的不一致 | 问题根源是代码里的系统级名称字符串（`AppScope/resources/base/element/string.json` 的 `app_name`，`entry/.../element/string.json` 的 `EntryAbility_label`，base/zh_CN/en_US 三份）之前还是生成工程时用的占位名「三国问答」，和 AGC 上实际登记的元服务名称「三国最强大脑」不一致。已经把这几处全部改成「三国最强大脑」，跟 AGC 对齐。 |
| vendor（开发者/公司名称）占位 | `AppScope/app.json5` 的 `vendor` 字段还是脚手架占位值 `example`，**还没改**，需要换成你华为开发者账号里登记的开发者显示名称或公司名，等确认后再改一次提交。 |
| 学习报告：没练过的分类显示 100% 掌握度 | 根因是 `questionBank.js` 的 `getCategoryReport()` 只统计"做错过的题数"，从没做过的分类自然 0 错 = 100%"掌握"，但其实根本没练过。已经加了一个"练过的题"记录（`recordAnswer` 里不论对错都会记一笔），掌握度只在"练过的题"范围内计算；没练过的分类现在会显示"未练习"，不会再误导成 100%。微信、抖音两端 `questionBank.js` 和 `pages/report/` 的逻辑同步改了，鸿蒙这边是从微信版转换过来的，自动带上了这个修复。 |

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
  否则签名/上架会失败。
- 如果 ASCF 运行时对某些 API 的支持随版本变化，转换报告里会列出「不支持」的组件/API 和
  对应的 TODO 注释，下次转换前记得看一眼报告（这次是 0 个，但以后题库/页面改多了可能会
  用到不支持的新组件，要留意）。

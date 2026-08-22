---
version: alpha
name: ComfyDesk-design-system
description: >
  ComfyDesk 双面设计系统:桌面「工作站」与移动「随身 App」是同一品牌语言的两
  种表达。桌面强调专业创作工位的横向信息密度;移动端是一个临时的 PWA App,
  遵循 iOS HIG 的单手单列节奏。所有 UI 由编码代理依据本文件生成与评审。

colors:
  primary: "#4f46e5"            # indigo-600 — 唯一交互色
  primary-hover: "#4338ca"      # indigo-700
  primary-soft: "#eef2ff"       # indigo-50 — 选中底/软按钮底
  primary-border: "#c7d2fe"     # indigo-200
  ink: "#0f172a"                # slate-900 — 标题
  body: "#1e293b"               # slate-800 — 正文
  body-muted: "#64748b"         # slate-500 — 说明文字
  ink-faint: "#94a3b8"          # slate-400 — 占位/时间戳
  canvas: "#ffffff"             # 桌面页面底
  canvas-app: "#f4f4f5"         # zinc-50 — 画布/画廊/移动端页面底
  surface: "#ffffff"            # 卡片面
  hairline: "#e2e8f0"           # slate-200 — 卡片描边/分隔
  success: "#059669"            # emerald-600
  success-soft: "#ecfdf5"
  danger: "#dc2626"
  danger-soft: "#fef2f2"
  warning-soft: "#fffbeb"
  on-primary: "#ffffff"

typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 30px
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: -0.5px
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.3
  large-title-ios:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 28px
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: -0.4px
  body-strong:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.5
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.08em
    transform: uppercase
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
  chip:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.2

rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  pill: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  section: 40px

motion:
  fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)"
  base: "300ms cubic-bezier(0.4, 0, 0.2, 1)"
  progress: "width 300ms linear"
  rules:
    - 进度条宽度过渡用 {motion.progress};连接等待态用 pulse
    - 悬停只变色/加深阴影,不做位移缩放;active 允许 scale(0.98)
    - 移动端禁止入场动画堆砌;新内容直接出现,状态变化用颜色与微过渡表达
---

# ComfyDesk Design System

## 品牌哲学

ComfyDesk 把「本地 AI 创作工厂」的复杂度藏在一层安静的 UI 后面:**用户表达意图,系统决定工艺**。
因此设计的第一原则是**意图优先**——任何需要用户做技术决策(选模型、调参数)的地方,
默认都必须存在一条零配置路径;专家参数永远可见但永远可选。

品牌气质:专业工具的克制 + 创作工具的温度。冷灰底上的白卡片承载内容,唯一的 indigo
交互色标记所有可点击与进行中状态;成功/失败用语义色瞬间表达,不堆装饰。

## 双面形态(One brand, two shells)

| | Web 工作站(桌面) | 随身 App(移动 PWA) |
|---|---|---|
| 定位 | 专业创作工位,多面板并置 | 临时 App:随手提交、等通知、看结果 |
| 外壳 | 顶部全局导航(56px,毛玻璃) + 内容区 `max-w-7xl` | 独立 PWA:大标题 + 单列 `max-w-md`,无桌面导航 |
| 导航 | 顶部水平链接(生成/画廊/训练) | 无 tab 或底部 tab;页面即任务流 |
| 密度 | 双栏 5/7 分割(控制/画布) | 单列纵向流;卡片全宽 |
| 输入 | 键盘为主,精确数值输入 | 触控为主:文本框 + 相册/相机上传 |
| 反馈 | 右侧画布内进度环+进度条 | 卡片内嵌线性进度条 + 完成即内嵌播放 |
| 通知 | 页面内即可见 | 应用内实时 + 锁屏 Web Push |
| 断点 | `lg ≥ 1024` 启用双栏;以下退化为单列(规则同移动) | 390×844 基准,`viewport-fit=cover` + safe-area |

**铁律:同一功能在两面都必须存在零配置路径;桌面可以多出专家面板,移动端永远不出现技术参数。**

## 布局骨架

### Web 工作站
- 全局导航:`sticky top-0 bg-white/80 backdrop-blur border-b border-slate-200`,高 56px;
  左 Logo+版本 chip,右系统状态徽标(圆点+文字,`idle` 灰 / 工作中蓝 pulse)
- 工作区:`max-w-7xl mx-auto px-6 py-10`,`grid lg:grid-cols-12`,控制列 `col-span-5`,画布列 `col-span-7`
- 卡片:`bg-white ring-1 ring-slate-200 shadow-sm rounded-2xl p-5`,卡片间距 `gap-6`
- 区块标签:`{typography.label}` 全大写 slate-400,值用 indigo-600 chip

### 随身 App(移动)
- 页面底 `bg-zinc-50`;内容 `max-w-md mx-auto px-4 pb-24`
- 顶栏:`sticky bg-white/80 backdrop-blur border-b`,左大标题/品牌,右状态点(绿=实时连接)
- 卡片:同 Web 卡片 token;卡片内主操作按钮全宽 `py-3 rounded-xl`
- 安全区:`env(safe-area-inset-bottom)` 计入底部留白;`viewport-fit=cover`
- 媒体结果:`<video playsInline>` 全宽圆角,下方主色下载按钮

## 组件契约

- **button-primary**:`bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 text-sm font-bold`,
  禁用态 `bg-slate-100 text-slate-400`;主 CTA 全宽
- **button-soft**:`bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200 text-xs rounded-lg`
- **chip-select**:选项芯片,选中 `bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm`,
  未选 `bg-white text-slate-500 border-slate-200`;`text-xs font-bold px-4 py-2 rounded-lg`
- **card**:见布局骨架;禁止双层嵌套卡片
- **input/textarea**:`bg-slate-50 border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none`
- **progress-linear**:`h-2 rounded-full bg-slate-100` 内 `bg-indigo-600 transition-[width] duration-300 ease-linear`
- **status-chip**:语义色软底圆角 chip(排队灰/规划蓝 pulse/运行蓝/完成绿/失败红)
- **media-result**:圆角媒体 + 悬停/常驻下载按钮;视频必须 `playsInline controls`
- **empty-state**:居中 `text-slate-300` 图标 + `text-slate-400` 一句话

## 文案语调

- 中文为主,按钮 ≤4 字;技术名词保留英文(Steps/CFG/Seed)
- 状态文案说人话:「Agent 规划中…」「引擎生成中 62%」,不暴露内部术语
- 错误信息 = 一句人话 + 可执行动作;禁止裸抛堆栈

## 可访问性

- 所有交互色对比度 ≥ 4.5:1(indigo-600 on white ✓)
- 触控目标 ≥ 44×44px;`focus-visible` 必须有 ring
- 媒体必须 `alt`/`playsInline`;状态不得仅靠颜色表达(chip 内含文字)

## 设计-开发循环(先设计再开发)

1. **Brief**:一句话说清为谁解决什么
2. **Tokens**:只允许使用本文件的 colors/typography/spacing/rounded;新值先进本文件再进代码
3. **Skeleton**:先写布局骨架(纯灰盒)确认信息层级
4. **Build**:按组件契约填充;禁止发明本文件之外的视觉模式
5. **Review**:对照双面形态表逐条自查;移动端用 390×844 视口验收

---
name: comfydesk-mobile-app
description: |
  随身 App(/m 移动 PWA)的设计与实现规范。触发于修改 frontend/src/app/m、
  sw.js、manifest 或任何移动端交互时。
triggers:
  - "移动端"
  - "手机"
  - "/m"
  - "PWA"
  - "mobile"
---

# 随身 App(移动 PWA)设计规范

## 定位

临时 App:没有封装原生壳的替代品。单手、单列、任务流式——
输入意图(文本 + 可选参考图)→ 实时进度 → 完成即看即下载,离开页面靠推送召回。

## 外壳与节奏

- 独立布局(`app/m/layout.tsx`):无桌面 NavBar;`viewport-fit=cover` + safe-area 底部留白
- 顶栏:`sticky bg-white/80 backdrop-blur`,左品牌(ComfyDesk + Studio chip),
  右连接状态点(绿=SSE 在线)+「开启通知」按钮(未订阅时)
- 内容:`max-w-md mx-auto px-4 pb-24`,卡片纵向流 `space-y-4`
- 大标题气质:区块标题用 `{typography.large-title-ios}`;正文 14px

## 任务流模式

1. **Composer 卡**:多行文本(必填)→ 附件行(🖼 角色参考图 + 缩略图可移除 +
   快速预览开关)→ 可选「高级」折叠(负向提示词)→ 全宽主 CTA
2. **请求卡片流**(新→旧):状态 chip + 时间 → 消息正文 → 线性进度
   (`h-2 bg-slate-100` + indigo)→ detail 一行 → 完成卡内嵌 `<video playsInline controls>`
   + 全宽下载按钮 → 失败红字 detail
3. **通知**:权限授予 → SW `/sw.js` push 事件 → `notificationclick` 聚焦/回开 `/m`

## 硬性规则

- 永不出现:工作流选择器、steps/cfg/seed、任何引擎术语;工艺由 agent/预制工作流决定
- API 基址运行时推导(`apiBase()`)::3000 直连走 `host:8001`,经边缘走同源 `/api/v1`
- 媒体 URL 经 `mediaOrigin()` 解析;视频必须 `playsInline`
- 新状态先更新既有卡片(按 id 合并排序),不闪烁整列表
- PWA 三件套(`/manifest.json`、图标 192/512、`/sw.js`)改动需过 390×844 视口回归

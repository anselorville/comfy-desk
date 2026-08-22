---
name: comfydesk-web-workstation
description: |
  桌面 Web 工作站(生成/画廊/训练页)的布局骨架与页面模式。
  触发于修改 frontend/src/app 下非 /m 页面、或新增桌面功能面板时。
triggers:
  - "工作站"
  - "桌面页面"
  - "generate page"
  - "gallery"
  - "training page"
---

# Web 工作站设计规范

## 外壳

- 根布局:`Inter` 字体 + 顶部全局导航(NavBar,56px 毛玻璃);/m 路由自动隐藏 NavBar
- 页面容器:`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10`

## 页面模式

### 生成页(双栏工位)
- `grid lg:grid-cols-12`:控制列 col-span-5 / 画布列 col-span-7;<1024px 退化为单列
- 控制列自上而下:提示词卡 → 模型选择+画幅卡 → 参数卡(仅显式工作流)→ 主 CTA 全宽
- **「✨ 智能生成」是默认且置顶的模型选项**:该模式下面板只剩提示词+画幅,
  提交走 `POST /api/v1/generate/auto`(multipart,可附参考图)
- 附带参考图时语义变为「以参考图为首帧的锚定视频」,按钮文案随之切换,画布渲染 `<video>`
- 显式工作流:切换时从 `GET /workflows` 的 meta fields 回填 steps/cfg/seed/lora_strength;
  参数卡仅在显式模式下渲染;**负向提示词常驻可见**(可留空,属用户偏好)

### 画廊/训练
- 沿用 card token 与瀑布流/表单骨架;新增面板前先对照 DESIGN.md 双面形态表

## 禁止

- 面板里出现未在 meta 声明的参数输入(如已删除的「LoRA 模型名」)
- 任何把用户引向手工调参的默认路径;专家参数必须藏在显式工作流之后
- 硬编码 API 地址:一律经 `lib/api.ts` 的 `API_BASE`(运行时按 location 推导)

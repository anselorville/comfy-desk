---
name: comfydesk-design-system
description: |
  ComfyDesk 项目设计系统的唯一权威入口。任何涉及 frontend/ 下页面、组件、
  视觉样式的创建或修改,必须先读本技能与 frontend/DESIGN.md。
triggers:
  - "design"
  - "设计"
  - "DESIGN.md"
  - "UI 改版"
  - "页面重构"
---

# ComfyDesk Design System

## 权威文件

- 契约本体:`frontend/DESIGN.md`(tokens / 双面形态 / 组件契约 / 设计-开发循环)
- 上游方法论:
  - DESIGN.md 协议:https://github.com/VoltAgent/awesome-design-md(结构化 tokens + 设计哲学叙述)
  - Skill 组织:https://github.com/nexu-io/open-design(skills/<name>/SKILL.md,frontmatter+triggers)
  - 动效规范:https://github.com/greensock/gsap-skills(本项目暂以 CSS transition 表达,见 DESIGN.md motion)

## 硬性规则

1. **先读 DESIGN.md 再写任何一行 UI 代码**;禁止凭记忆或旧页面复制样式
2. 新颜色/字号/圆角/间距必须先加入 `frontend/DESIGN.md` tokens,再进代码;
   禁止在组件里发明 token 之外的字面值(一次性内容图除外)
3. 交互色唯一:indigo-600 系;语义色仅 success/danger/warning 软底 chip
4. 双面形态铁律:同一功能两面都要有零配置路径;移动端不出现技术参数面板
5. 每次改 UI 必须跑「设计-开发循环」第 5 步 Review 清单,移动端用 390×844 视口

## 设计-开发循环

Brief → Tokens(查本文件)→ Skeleton 灰盒 → Build(组件契约)→ Review(双面形态表逐条)

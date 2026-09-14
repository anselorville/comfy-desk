# 人物创作工作流：转弯顺露 + 角色参考板

把南鸢的摄影美姿（转、弯、顺、露）和 バナーナ 的角色设计图方法
整合成 Comfy-Desk 上的人物图像策略。

## 组合 skill

| Skill | 用途 | Workflow |
|---|---|---|
| `portrait-character-reference-sheet` | 把一张人物参考图变成可复用的角色设计图（正面 / 3/4 / 侧面 / 背面 + 脸部结构 + 表情 + 服装细节 + 体型） | `image_z_image_turbo` |
| `portrait-pose-generation` | 在已有角色设定基础上，按 转 / 弯 / 顺 / 露 写人像文生图提示词 | `image_z_image_turbo` |
| `portrait-pose-retouch` | 基于人物参考图，低幅度重绘只修姿态和手部可见性，保留身份 | `photo_cinematic_retouch` |

## 推荐工作流

1. **建立角色档案**：用 `portrait-character-reference-sheet` 把目标人物做成一张参考板。
2. **正文生图**：调用 `portrait-pose-generation`，让 `subject` / `framing` / `stance` / `facing` /
   `bend` / `gesture` / `line_flow` / `hand_visibility` / `silhouette` /
   `scene` / `lighting` 描述想要的姿态，`identity_anchor` 钉死参考板中的面部结构、发型、
   体型、肤质与年龄，`view_consistency` 强调多视图一致。
3. **局部姿态修正**：对生成结果不满意时，用 `portrait-pose-retouch` 做低幅度重绘，
   只改「顺、露」相关变量，保留身份、场景与构图。

## 设计原则

- 先有角色设计图，再有提示词，避免每次重新刻画人物细节。
- 转 / 弯 / 顺 / 露 是独立的修正入口，每次只改一个变量。
- 负向提示词常驻强调：身份漂移、脸平均化、发型变化、服装变化、体型漂移、
  多余手指、缺手指、手部不可见、关节异常折角。

## API 调用

```bash
# 1) 生成角色参考板
curl -X POST http://localhost:8001/api/v1/skills/portrait-character-reference-sheet/run \
  -H "Content-Type: application/json" \
  -d '{"character_subject":"the adult woman in the attached photo"}'

# 2) 在该角色基础上生成新姿态
curl -X POST http://localhost:8001/api/v1/skills/portrait-pose-generation/run \
  -H "Content-Type: application/json" \
  -d '{
    "identity_anchor":"match the character sheet identity",
    "subject":"adult woman in casual autumn outfit",
    "stance":"three-quarter seated on a window bench",
    "facing":"torso turned slightly away, face turned back to the camera",
    "bend":"one knee softly bent, head slightly tilted",
    "gesture":"one hand resting on knee, the other lightly touching a coffee cup",
    "line_flow":"forearm continues into relaxed hand, leg line continues into pointed foot",
    "hand_visibility":"both hands have clear resting points and visible fingers",
    "silhouette":"upper body open, lower body gathered",
    "view_consistency":"match the character sheet identity across views"
  }'

# 3) 用参考图姿态重绘（保留身份）
curl -X POST http://localhost:8001/api/v1/skills/portrait-pose-retouch/run \
  -H "Content-Type: application/json" \
  -d '{
    "image_filename":"upload_xxx.jpg",
    "denoise":0.38,
    "stance":"retain the original stance",
    "facing":"turn the torso slightly away, keep the face toward the camera",
    "bend":"add a slight head tilt",
    "gesture":"give each hand a clear resting point",
    "line_flow":"keep forearm-to-hand and leg-to-foot lines continuous",
    "hand_visibility":"make hands legible and key fingers visible"
  }'
```

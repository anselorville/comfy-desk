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

## 按需加载：身份锁定协议

当任务出现“同一个 AI 人物反复生成”“角色固定”“多角度设定图”“人物一致性下降”
或“把一张照片变成角色设定表”时，先读取本节，再调用
`portrait-character-reference-sheet`。

### 身份来源与优先级

- 上传的参考图是**唯一身份来源**，不能把风格图、姿势图或另一张脸混作身份参考。
- 优先级固定为：身份与面部几何 > 体型和头身比 > 发型发色与肤质 > 服装配件 > 姿态 > 场景与风格。
- 明确写出：不要美化、理想化、换脸、性别转换、年龄漂移、民族特征改变或生成相似脸。
- 对可见的自然不对称、痣、疤、发际线、眼眉、鼻唇和下颌线，要求跨面板保留；看不见的细节不要擅自补造。

### 参考板的最小生产规格

- 全身：正面、真实 90° 侧面、背面、可选 3/4；手臂自然、脚完整、站姿中性。
- 头部：正面、左右 3/4、左右真实侧面、轻微高低角度、后脑勺/头发。
- 细节：脸部结构、肤质、眼眉唇、手指、鞋、面料/缝线/褶皱、珠宝和其他配件。
- 统一条件：相同人物、发型、衣服、比例、光线方向和尺度；面板之间用清晰分隔和少量标签。

### 使用边界

参考板适合做身份锚点，不等于模型真正锁定身份。多面板中的文字、手指和极细节仍可能出错；
生成后要检查“是否同一张脸、是否同一体型、是否同一套服装”，发现漂移时只修一个变量，
不要一次重写整段提示词。

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

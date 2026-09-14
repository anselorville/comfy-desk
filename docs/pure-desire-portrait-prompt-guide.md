# DD.Cherry「纯欲风」写实人像经验

> 研究对象：[@sdjn_wgc / DD.Cherry](https://x.com/sdjn_wgc)
>
> 主页简介为“AI 写实人像提示词 · 生活感 · 纯欲”。由于 X 时间线在未登录状态下不完整，本文结合主页可见信息、搜索索引及 OpenNana 标注来源为该账号的公开提示词镜像进行归纳；示例是方法抽象，不声称还原其全部作品或固定参数。
>
> 本文仅整理**明确成年、非露骨**的时装与生活方式写真。性感来自气质、姿态、服装剪裁、湿润/透气材质、视线和摄影语言，不使用裸露或露骨性行为。

## 一、这个账号最值得学习的结构

### 1. 先写“一个瞬间”，而不是先写性感

典型场景都有一个可视化动作：

- 海边：低头看掌心的小海螺，指尖和海螺成为交互焦点。
- 苗族生活方式：刚整理胸前银铃，手停在银饰边缘。
- 彝族节庆：刚把火把插入石座，离手后顺势回眸。
- 车站抓拍：通过环境和服装快速建立人物印象。

这会让眼神、手部和重心有理由，避免“摆一个性感姿势”的空洞感。

### 2. 用“生活感”稀释摆拍感

账号样例反复使用以下组合：

```text
一个正在发生的动作 + 轻微未整理状态 + 环境中的小道具 + 不完全对称的构图
```

可用细节包括湿发束、贴脸碎发、衣物受力、海风带动披巾、木地板反光、前景虚化海草、被使用过的家具等。细节要服务动作和空间，不要把每一项都堆在脸部。

### 3. “纯欲”不是单一关键词，而是三组张力

| 张力 | 正向控制 | 视觉结果 |
|---|---|---|
| 亲近感 | 轻微低头、柔和眼神、自然唇妆、生活化动作 | 像被镜头偶然捕捉 |
| 吸引力 | 明确成年、自然曲线、肩颈/锁骨/腰线、服装剪裁 | 有性感但不露骨 |
| 克制感 | 低对比、正常覆盖、动作简洁、留白和环境叙事 | 不廉价、不媚俗 |

## 二、可迁移的提示词公式

```text
明确成年身份
→ 主题 / 正在发生的动作
→ 表情、视线和交互点
→ 体型与比例边界
→ 发型、妆容、皮肤质感
→ 服装结构与材质受力
→ 场景前中后景
→ 主光、辅光、阴影方向
→ 镜头、机位、画幅、裁切
→ 摄影质感
→ 针对性负面词
```

### 推荐字段拆分

- `adult_identity`：年龄信号与自然外观
- `micro_action`：正在发生的单一动作
- `gaze_interaction`：视线和交互物
- `body_proportion`：体型边界，防止夸张
- `hair_makeup_skin`：发丝、妆面、毛孔和水珠
- `wardrobe_structure`：领口、系带、腰线、裙摆等结构
- `material_behavior`：面料的重量、褶皱、湿润、反光
- `environment_depth`：前景 / 主体 / 背景
- `lighting`：主光方向、阴影、补光和色温
- `camera_composition`：焦段、机位、占画面比例、焦点
- `finish`：低对比、克制饱和、轻微颗粒、自然锐度

## 三、纯欲风的关键技巧

### A. 表情：轻微，不要“用力诱惑”

优先写可见动作：

- `chin slightly tucked`
- `subtle smile at the corners of the lips`
- `calm, gentle, confident gaze`
- `natural tear bags and small catchlights`
- `gaze accurately falling on the object in hand`

避免只写 `seductive expression`。纯欲感更稳定的做法是“视线有去处 + 表情幅度小 + 眼神光明确”。

### B. 姿态：一个重心变化 + 一个微弯

- 一条腿承重，另一条腿轻微弯曲。
- 肩线与髋线不要完全平行。
- 手接触物件或环境，明确接触面和受力方向。
- 回眸时先写身体运动方向，再写脸回到镜头。
- 复杂动作拆成动作前后的一瞬间，不要同时编排多组手指动作。

### C. 服装：写结构和受力，不只写款式名

比“性感内衣 / 性感裙子”更有效的是：

```text
领口形状 + 面料厚薄/光泽 + 贴合部位 + 系带或褶皱的受力 + 覆盖边界
```

示例：

- `matte fine-density woven fabric, realistic tension at the neck and back ties`
- `slightly glossy satin, wide embroidered edge supporting the garment structure`
- `wet fabric slightly darkened while maintaining normal coverage`

### D. 光线：用主次关系塑造吸引力

账号样例常见的光线逻辑：

- 暖色主光照亮眼睛、唇峰、锁骨、肩头和交互道具。
- 冷色环境光只托起阴影，不冲掉暖光主次。
- 阴影方向明确，不能让人物像被均匀贴亮。
- 生活写真用低对比和自然血色；节庆/夜景才提高色温反差。

### E. 构图：焦点往往是“眼睛 + 道具”

不要只把焦点写成“脸部”。可以指定：

```text
focal plane locked on the near eye and the object in hand, both clear
```

再用前景虚化、视线留白、主体偏左/偏右、自然裁切制造抓拍感。海边样例使用 50mm、主体约占 68%、大腿中段裁切；民族风样例使用 85–105mm 压缩背景，突出服装和饰品结构。

## 四、四类可复用模板

### 1. 海边湿润生活感

```text
Clearly adult East Asian woman, [age] years old, fashionable, gentle and confident,
standing beside [wet reef / shallow water] at [dusk / early morning]. She is [single
micro-action], with her gaze accurately falling on [small object], which is held with
clear fingertip contact. One leg bears the weight, the other knee is slightly bent,
shoulders relaxed, natural restrained S-curve. [hair] with a few windblown strands
sticking to the cheek, natural makeup, realistic pores and small water droplets.

[covered fashion swimwear / summer outfit], [fabric behavior], normal coverage,
realistic tension and wetness. Foreground [blurred seaweed / wet reflections], middle
ground the subject and [foam / rocks], background [low-saturation sea and horizon].
Warm side sunlight from [direction], faint cool ambient reflection in the shadows.
50mm equivalent, [3:4 or 4:5] vertical, [head to mid-thigh / full body], eye-level
slightly from the side, focus on the near eye and [object], shallow depth of field,
low contrast, restrained saturation, subtle film grain, realistic fashion photography.
```

### 2. 民族风生活方式写真

```text
Clearly adult [age]-year-old East Asian woman, contemporary [Miao / Yi / other
cultural] fashion portrait, fashionable, confident and gentle. She has [hair and
makeup], natural skin texture and apparent adult age. She has just finished
[action with a culturally relevant accessory], one hand resting on the accessory's
edge with clear contact, body weight shifted to the back leg, face [looking directly
at camera / turning back after the action].

[garment structure] made of [cotton-linen / satin / wool], [embroidered or woven
pattern] concentrated at [neckline / waist / hem], layered [jewelry and props] with
clear separation. [architecture / platform / festival] creates foreground, middle
ground and background depth. [morning skylight / torchlight] illuminates eyes,
collarbones and material highlights; preserve readable skin tone and shadow direction.
[85mm or 105mm], 9:16 vertical, [half-body to thigh / two-thirds body], large aperture,
creamy bokeh, high-end lifestyle photography, realistic texture, restrained sensuality.
```

### 3. 室内自然抓拍

```text
Clearly adult woman in a minimal [station / apartment / living room], captured in a
realistic unposed moment while [single everyday action]. She is [age] years old with
[natural adult facial features], [hair], subtle makeup and a calm, slightly shy but
confident expression. Her shoulders are relaxed, torso turned slightly away and face
returns toward the camera; one hand has a clear resting point on [prop], the other
hand remains natural and visible.

She wears [covered outfit], with [specific neckline / sleeve / waist / hem] and
[material behavior: knit folds / chiffon translucency with normal coverage / leather
highlights]. Include [two or three environmental anchors], realistic contact shadows
and small signs of use. Soft window light from [direction] plus gentle ambient fill,
neutral or warm restrained palette. 50–85mm equivalent, eye-level, [4:5 or 9:16],
intentional negative space, natural perspective, realistic skin pores, clean
mirrorless-camera snapshot, no glamour over-processing.
```

### 4. 节庆夜景回眸

```text
Clearly adult [age]-year-old woman at [festival / night market], walking along
[action-oriented location]. She has just [completed a single action], her hand has
left [object], body naturally turns slightly while the face fully returns to camera.
[signature hair, accessory and covered outfit] move subtly in the night wind. The
foreground contains [near prop], middle ground [lights / stone wall / people kept
unobtrusive], background [dark mountain / street / architecture]. Warm practical
lights illuminate the eyes, lips, collarbones and fabric texture; cool night ambience
separates the silhouette. 85–105mm, vertical 9:16, two-thirds body, compressed
background, shallow depth of field, cinematic but physically coherent lighting,
realistic skin texture and restrained sensuality.
```

## 五、负面词与迭代方法

通用负面词：

```text
minor, childlike face, ambiguous age, mature middle-aged appearance,
exaggerated or prosthetic body proportions, nudity, exposed intimate areas,
transparent clothing revealing the body, explicit sexual act, incorrect clothing
construction, clipped straps, floating props, failed fingertip contact, fused fingers,
extra fingers, missing fingers, extra limbs, distorted joints, plastic skin,
over-smoothed face, harsh flash, tilted horizon, unreadable text, logo, watermark
```

迭代顺序：

1. **先看年龄和角色标志物**：成年感、发型、服装和饰品是否齐全。
2. **再看交互点**：眼睛看哪里，手碰到什么，物件是否真正接触。
3. **再看重心和裁切**：脚、膝盖、腰胯是否在画面内，身体是否像站稳/坐稳。
4. **最后调性感**：只改领口、材质、光线、表情或留白中的一项。

每轮只改一类变量。参考图重绘时从低 denoise 开始，优先保留身份、原始光向和场景。

## 六、对 Comfy-Desk 的落地

- 新增 `adult-pure-desire-portrait` skill，绑定现有 `image_z_image_turbo` 工作流。
- 将“纯欲”拆成 `micro_action`、`gaze_interaction`、`wardrobe_structure`、`material_behavior`、`environment_depth` 和 `lighting` 字段。
- 默认模板使用成年、非露骨和自然比例约束，避免将 `sexy` 作为唯一控制词。
- 需要身份一致时，先运行 `portrait-character-reference-sheet`，再进入本 skill 或 `portrait-pose-retouch`。

## 来源与边界

本次可直接读取到的主页信息确认该账号的定位为“AI 写实人像提示词 / 生活感 / 纯欲”；可检索的账号镜像样例集中在海边、车站、苗族时尚和彝族节庆等场景。本文提炼的是其中稳定出现的摄影化结构：单一动作、明确交互点、服装材质受力、前中后景、主辅光关系和镜头参数。镜像页面的转载、模型差异和页面截断都可能影响细节，因此不要将其数值当作通用最佳参数。

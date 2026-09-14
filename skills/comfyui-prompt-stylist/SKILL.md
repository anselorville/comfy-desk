---
name: comfyui-prompt-stylist
description: |
  Visual prompt synthesis, JoyCaption auto-tagging, and style taxonomy skill for ComfyUI.
  Use when rewriting plain user requests into high-fidelity image prompts, especially portraits,
  female subjects, identity-preserving edits, composition, camera, lighting, anatomy, or negative constraints.
triggers:
  - "prompt"
  - "提示词"
  - "润色"
  - "画风"
  - "joycaption"
  - "style"
  - "negative prompt"
---

# ComfyUI Prompt Stylist Skill

## Core Styles Taxonomy

### 1. 🎬 Cinematic Photorealism
- **Keywords**: `cinematic still, 35mm photograph, arri alexa lf, anamorphic lens flare, shallow depth of field, natural volumetric lighting, photorealistic textures, master composition, 8k resolution`
- **Negative**: `cgi, 3d render, cartoon, anime, illustration, oversaturated, plastic skin, blur, watermark`

### 2. 🌸 Anime & Cel Shading (Makoto Shinkai / Kyoto Animation)
- **Keywords**: `anime aesthetic, Makoto Shinkai style, vibrant sky with detailed cumulus clouds, expressive eyes, crisp line art, beautiful color palette, ray tracing reflections`
- **Negative**: `lowres, bad anatomy, bad hands, missing fingers, extra digit, cropped, worst quality`

### 3. 🌆 Cyberpunk & Sci-Fi
- **Keywords**: `cyberpunk neo-tokyo aesthetics, neon glow, holographic HUD elements, rain-slicked pavement reflections, chromatic aberration, octan render, ultra-detailed mechanical parts`
- **Negative**: `vintage, sepia, rustic, low quality, washed out`

### 4. 👾 Retro Pixel Art
- **Keywords**: `masterpiece pixel art, 16-bit color depth, crisp pixel grid, isometric perspective, nostalgic retro game aesthetic, vibrant palette, sharp pixels`
- **Negative**: `anti-aliased, blurry, modern 3d, vector art, smooth gradients`

### 5. 🎨 3D Animation & Pixar
- **Keywords**: `Pixar 3D animation style, subsurface scattering, stylized character design, warm studio lighting, playful atmosphere, octane render 8k`
- **Negative**: `flat 2d, sketch, horror, gloomy, low polygon`

### 6. 📸 Full-Journey Travel Photography Taxonomy (全旅程旅拍精修全场景矩阵)
- **Concept**: Transforms amateur phone snapshots into masterwork cinematography. Translates layperson requests into real-world camera optics, lens focal lengths, film stocks, volumetric lighting, and scene cleaning.
- **8 Major Travel Categories & 23 Sub-Scenarios**:
  1. **🏛️ 地标建筑与景区去路人 (Landmarks & Anti-Crowd)**
     - `landmark_crowd_clean`: 著名地标·包场去路人 (`Leica M6, 35mm f/1.4 ASPH, Kodak Portra 400, tourists removed, clean historic square`)
     - `landmark_epic_scale`: 古典宫殿·史诗纵深感 (`Canon EOS R5, 24mm ultra-wide, cathedral vertical perspective, dust shafts`)
     - `landmark_night_lit`: 地标夜色·泛光辉煌 (`Sony A7R V, 35mm f/1.4 GM, golden architectural floodlights vs indigo twilight`)
  2. **🌅 黄金时刻与日落逆光 (Golden Hour & Sunsets)**
     - `sunset_beach_rim`: 海边日落·发丝逆光金晕 (`Sony A7R V, 85mm f/1.4 GM, radiant golden hair rim light, shimmering waves`)
     - `sunset_cliff_epic`: 绝美断崖·落日海平线 (`Hasselblad X2D 100C, 45mm f/4 P, fiery orange horizon, medium format depth`)
     - `blue_hour_twilight`: 蓝调时刻·日暮初上 (`Leica SL2, 50mm f/2 ASPH, cool cyan twilight vs warm streetlamp`)
  3. **✈️ 启程与交通窗景 (Transit & Journey)**
     - `transit_plane_window`: 飞机舷窗·云海晨昏金光 (`Leica Q3, 28mm f/1.7, passenger window sunbeam, golden cloud sea`)
     - `transit_train_speed`: 高铁列车·流动窗景光影 (`Fujifilm X-T5, Classic Chrome, dynamic window motion blur, Wong Kar-wai mood`)
     - `transit_road_trip`: 公路自驾·海滨敞篷兜风 (`Canon EOS R5, 28-70mm f/2L, Kodachrome 64, coastal road movie snapshot`)
  4. **🍜 市井烟火与深夜食堂 (Food & Street Life)**
     - `street_food_steam`: 夜市摊位·热气腾腾烟火气 (`Sony A7R V, 50mm f/1.2 GM, CineStill 800T halation, warm rising steam`)
     - `cozy_cafe_afternoon`: 街角咖啡馆·树影斑驳午后 (`Leica M11, Summilux 50mm f/1.4, dappled tree shadows, Parisian chic`)
     - `izakaya_lantern`: 居酒屋小巷·红灯笼微醺 (`Fujifilm X-T5, 23mm f/1.4, glowing crimson lanterns, Midnight Diner feel`)
  5. **🌃 都市天际线与赛博夜景 (Cityscapes & Neon Nights)**
     - `cyber_rain_reflections`: 赛博雨夜·湿地霓虹倒影 (`Sony A7R V, 50mm f/1.2, wet asphalt puddles, anamorphic lens flares`)
     - `rooftop_skyline_night`: 高空天台·繁华天际线散景 (`Canon EOS R5, 85mm f/1.2L DS, illuminated skyscrapers, luxury bokeh`)
  6. **🏞️ 自然山海旷野与雪原 (Nature & Wilderness)**
     - `nature_misty_forest`: 迷雾森林·清晨丁达尔光 (`Hasselblad X2D 100C, Velvia 50 greens, volumetric god rays through canopy`)
     - `nature_snow_mountain`: 巍峨雪山·日照金山史诗 (`Nikon Z9, 70-200mm f/2.8, alpenglow golden summit, crystal thin air`)
     - `nature_tropical_island`: 热带海岛·纯净玻璃海 (`Sony A7R V, 24-70mm f/2.8, crystal turquoise lagoon, caustic ripples`)
  7. **🌸 废片拯救与光影重打 (Flaw Rescue & Relighting)**
     - `rescue_overcast_flat`: 阴天拯救·重构立体暖阳 (`Leica M6, 35mm, transform flat overcast into directional golden side light`)
     - `rescue_backlit_dark_face`: 逆光黑脸拯救·通透立体五官 (`Sony A7R V, 50mm f/1.2, luminous facial fill light, catchlights in eyes`)
     - `rescue_harsh_flash`: 手机直闪拯救·柔化为电影光 (`Leica SL2, giant softbox diffuse illumination, eliminate oily flash shine`)
  8. **🎞️ 经典名机与胶片模拟 (Master Film & Camera)**
     - `film_leica_portra`: Leica M6 + Kodak Portra 400 (温暖人文)
     - `film_fuji_velvia`: Fujifilm X-T5 + Velvia 50 (浓郁风光)
     - `film_cinestill_800t`: CineStill 800T (夜景电影红晕)

- **Negative Prompt Core**: `harsh direct flash, flat washed-out lighting, crowded background, tourists, bystanders, blurry face, distorted eyes, bad hands, plastic artificial skin, oversaturated cartoonish colors, cgi render, low quality phone snapshot`
- **Optimal Denoise Range**:
  - `0.45 - 0.55`: Gentle enhancement (preserves 90% original pixels, enhances color/light).
  - `0.60 - 0.65`: **Recommended Masterpiece Mode** (reconstructs lighting, film grain, cleans tourists while keeping exact facial identity & pose).
  - `0.70 - 0.75`: Creative re-imagination (drastic atmosphere and background overhaul).

## 9. 📰 纸刊美学·AI 图像美化 (Editorial Paper Art Styles)

源自 GitHub 开源视觉风格 Skill 精选，6 个最能打的「照片/主题 → 纸刊/编辑/抽象风格」方法论，已注册为 comfy-desk 技能（`gateway/skills/*.json`），可通过 `/api/v1/skills` 调用或前端点选：

| Skill ID | 风格 | 输入 | 工作流 |
|---|---|---|---|
| `gc-minimal-zine-poster` | 📰 极简纸刊海报 | 一句话/主题 | `image_z_image_turbo` (文生图) |
| `pixel-style-poster` | 🔳 像素点阵海报 | 主题（花卉/动物/近景人脸最佳） | `image_z_image_turbo` (文生图) |
| `photo-abstract-editorial` | 🎨 克制美学·几何编辑 | 照片 | `photo_cinematic_retouch` (图生图) |
| `photo-relic-editorial` | 🖼️ 纸上留影·版画印记 | 照片（建筑/天际线/水面） | `photo_cinematic_retouch` (图生图) |
| `travel-photo-abstraction` | 🗺️ 旅行照片抽象 | 旅行照片 | `photo_cinematic_retouch` (图生图) |
| `gathered-scenes-zine` | 🧩 拾景纸刊·撕纸拼贴 | 照片 | `photo_cinematic_retouch` (图生图) |

**通用风格语法**（各 skill prompt 已内嵌）：
- 纸刊风：`large negative space, paper texture, print scan reproduction, single color accent, restrained typography`
- 编辑风：`upper photo preserved, lower panel abstract/geometric/ink reconstruction, clean negative space, small title`
- 负向约束：`commercial ad, glossy magazine, chaotic collage, watermark, oversaturated`

**去噪建议**：文生图走 turbo（steps 8 / cfg 1.0）；图生图走 retouch（steps 12 / cfg 1.5 / denoise 0.62~0.65）。

## 8.5 Plain Request → High-Fidelity Prompt Rewrite

When the user gives a short request such as “白底坐姿兔女郎”“自然的女生街拍” or “把这张照片拍得更高级”,
rewrite it into a production-ready visual specification before sending it to a workflow. Do not merely append
quality adjectives.

### Rewrite order

1. **Safety and subject**: explicitly establish an adult subject when age could be ambiguous; preserve identity
   when a reference image is supplied; do not invent a second person.
2. **Composition**: aspect ratio, shot size, camera height, viewing angle, subject placement, crop boundaries,
   and which body parts or props must remain visible.
3. **Pose and gesture**: describe torso/head/leg orientations separately; use one or two observable actions;
   specify hand resting points, finger visibility, weight distribution, and natural balance.
4. **Appearance**: hair shape and texture, facial features, makeup, clothing construction, materials, seams,
   accessories, skin texture and age appearance. Distinguish visible facts from creative additions.
5. **Light and optics**: source direction and size, fill/bounce, shadow behavior, contrast, focal-length range,
   depth of field, focus priorities, and photographic medium or era.
6. **Texture and finish**: pores, flyaway hair, fabric behavior, film/digital grain, highlight roll-off and
   restrained color processing. Use “high resolution” only after these concrete details.
7. **Negative constraints**: list mutually exclusive errors—wrong age, identity drift, extra people, missing
   clothing parts, bad hands, cropped feet, plastic skin, unwanted lighting—not a generic wall of negatives.

### Rewrite contract

Return or internally construct these labeled slots:

```text
Subject / age:
Reference role and invariants:
Composition / framing:
Pose / gesture:
Appearance / wardrobe:
Scene / background:
Lighting:
Camera / optics:
Texture / finish:
Must keep:
Avoid:
```

Resolve contradictions before generation. For example, “shallow depth of field” conflicts with “face, hands,
foreground legs and shoes all sharp”; prefer a nearly textureless background and moderate aperture when several
planes must remain legible. If the user asks for “natural” or “高级”, translate it into visible choices instead
of leaving those words unexplained.

### Female portrait fidelity checklist

Use only when relevant to the user's request; do not add glamour, nudity or sexual framing without being asked.

- Establish **clearly adult** subject when age is not otherwise clear.
- Describe hair as shape + length + texture + flyaways, not only a color.
- Describe skin as tone + pores + subtle irregularity + matte/gloss behavior; avoid “flawless plastic skin”.
- Separate makeup into eyes, brows, lips and blush; keep intensity proportional to the requested mood.
- Describe clothing as garment pieces and construction (collar, cuffs, seams, closures, fabric, coverage).
- For seated or folded poses, specify weight-bearing points, overlapping diagonals, knees, feet and crop limits.
- Give every visible hand a location and a function; request natural curled fingers rather than enumerating every digit.
- Keep breasts, buttocks and intimate areas covered unless the user explicitly requests a permitted adult fashion or
  artistic context; never infer explicit content from “美女”, “性感” or a costume name.
- Keep lighting physically coherent: large soft source + bounce for gentle portraits; hard light only when requested.
- For high-fidelity retro/digital looks, specify grain, sharpening, highlight behavior and color processing rather
  than applying “cinematic” indiscriminately.

### Comfy-Desk parameter mapping

- `image_z_image_turbo`: text-to-image; use compact but concrete positive prompt, `steps: 8`, `cfg: 1.0`.
- `photo_cinematic_retouch`: reference-photo edit; preserve identity and scene, start at `denoise: 0.38–0.55`.
  Raise only when the user explicitly wants pose, wardrobe or background reconstruction.
- `portrait-character-reference-sheet`: use when identity consistency or repeated character generation is the
  real task; generate the sheet before scene variations.
- `portrait-pose-generation` / `portrait-pose-retouch`: use the `转、弯、顺、露` slots as independent controls;
  change one slot per iteration when diagnosing a bad pose.

Use JoyCaption endpoint `http://localhost:8000/v1/chat/completions` with base64 image to extract:
1. Subject details (clothing, pose, hairstyle, expressions)
2. Environment details (lighting angle, color temperature, background elements)
3. Composition metadata (camera angle, shot size, focal length)
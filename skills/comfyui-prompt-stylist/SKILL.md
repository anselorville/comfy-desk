---
name: comfyui-prompt-stylist
description: |
  Visual prompt synthesis, JoyCaption auto-tagging, and style taxonomy skill for ComfyUI.
  Transforms simple user prompts into rich visual descriptions with lighting, medium, camera,
  and rendering styles.
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

## JoyCaption Reverse Prompting
Use JoyCaption endpoint `http://localhost:8000/v1/chat/completions` with base64 image to extract:
1. Subject details (clothing, pose, hairstyle, expressions)
2. Environment details (lighting angle, color temperature, background elements)
3. Composition metadata (camera angle, shot size, focal length)

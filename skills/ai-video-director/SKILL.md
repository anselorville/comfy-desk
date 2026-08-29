---
name: ai-video-director
description: |
  Storyboarding, cinematography, and multi-shot video direction skill.
  Deconstructs narrative stories into shot sequences, assigns camera motions,
  and coordinates Image-to-Video / Text-to-Video generation pipelines.
triggers:
  - "director"
  - "storyboard"
  - "分镜"
  - "导演"
  - "运镜"
  - "视频转场"
  - "video sequence"
  - "cinematic video"
---

# AI Video Director & Storyboarding Skill

## Overview
Guides agents to think like a film director when creating AI video content. It structures storytelling into:
1. **Script Decomposition**: Split story into cohesive scenes and 3-5 second shots.
2. **Keyframe Conception**: Generate prompt & reference frame for character, lighting, environment.
3. **Camera Choreography**: Direct camera movements (pan, tilt, zoom, dolly, orbit, crane).
4. **Video Generation**: Execute T2V or I2V with anchor frames for temporal consistency.
5. **Shot Chaining**: Pass the final frame of Shot N as the first frame of Shot N+1 for continuous action.

## Camera Movement Vocabulary

| Movement Token | Description | Best Used For |
|---|---|---|
| `[Camera: Slow Dolly In]` | Smooth forward movement towards subject | Building emotional intensity, focus |
| `[Camera: Slow Dolly Out]` | Smooth backward movement revealing surroundings | Context reveal, isolation, grandeur |
| `[Camera: Pan Left / Right]` | Horizontal rotation from fixed pivot | Following characters, environment sweep |
| `[Camera: Orbit 360 / Arc]` | Curved path circling the subject | Hero shots, showcase 3D presence |
| `[Camera: Crane Up / Down]` | Vertical ascent/descent | Establishing scale, rising dramatic tension |
| `[Camera: Static Close-Up]` | No camera movement, focus on micro-expression | Dialogue, emotional resonance |
| `[Camera: Dynamic Tracking]` | Moving alongside fast-moving subject | Action, chase, sports, energy |

## Multi-Shot Storyboard Recipe

### Shot 1: Establishing Shot (Wide / Drone)
- **Prompt**: `Wide-angle cinematic drone shot, ancient mystical mountain temple at sunset, volumetric golden sun rays through mist, camera slowly descending towards the entrance`
- **Engine**: MiniMax H3 T2V or Wan2.1 T2V
- **Duration**: 5 seconds

### Shot 2: Medium Action Shot (First-Frame Anchored)
- **Prompt**: `Medium shot of a warrior standing on temple steps, holding a glowing katana, cherry blossoms swirling in wind, slow orbit camera movement`
- **Engine**: MiniMax H3 I2V (anchored to character image)
- **Duration**: 5 seconds

### Shot 3: Close-Up Climax
- **Prompt**: `Extreme close-up on the warrior's intense eyes reflecting thunder and lightning, dramatic cinematic lighting, wind blowing hair, static camera with high frame dynamics`
- **Engine**: MiniMax H3 I2V
- **Duration**: 5 seconds

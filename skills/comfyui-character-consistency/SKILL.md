---
name: comfyui-character-consistency
description: |
  Techniques and workflows for maintaining consistent characters across multiple images
  and video shots using ComfyUI.
triggers:
  - "character consistency"
  - "一致性"
  - "同一个人"
  - "角色一致"
  - "连续镜头"
  - "fixed character"
---

# ComfyUI Character Consistency Skill

## Principles of Character Consistency
1. **Character Anchor Sheet**: Always generate a canonical front/three-quarter portrait first.
2. **Specific Descriptors**: Avoid generic prompts ("a girl"). Use distinct identifiers:
   - `Specific hairstyle & color`: e.g. "asymmetrical silver bob haircut with violet tips"
   - `Distinctive apparel`: e.g. "cybernetic obsidian coat with orange glowing collar"
   - `Unique facial features`: e.g. "heterochromia (left cyan, right gold), subtle scar over right eyebrow"
3. **First-Frame Video Anchoring**:
   Feed the canonical portrait into `video_minimax_h3_i2v` or `video_wan22_ti2v_5b_i2v` as the `image` input to keep the face/character 100% faithful to the source asset.
4. **Shot-to-Shot Chaining**:
   Extract frame from Shot N-1 -> Inpaint / adjust pose -> Feed as start frame for Shot N.

# Workflows — 版本管理约定

`gateway/workflows/` 是 ComfyDesk 的图像/视频工作流注册表，gateway 自动发现（无需改代码），前端与 `/api/v1/workflows` 列表随文件增删实时变化。

## 文件规范

每个工作流 = 一对文件：

- `<wf_id>.json` — ComfyUI API 格式，参数用哨兵符（`__POSITIVE_PROMPT__`、`__SEED__` 等）
- `<wf_id>.meta.json` — 展示名、字段定义、引擎说明、默认参数

`wf_id` 必须匹配 `[a-zA-Z0-9_-]{1,64}`，建议前缀分类：

| 前缀 | 用途 |
|---|---|
| `image_` | 图像生成（t2i / i2i / pose-control 等） |
| `video_` | 视频生成（t2v / i2v / ti2v） |

## 已注册工作流

| wf_id | 引擎 | 用途 |
|---|---|---|
| `image_z_image_turbo` | Z-Image Turbo bf16 | 默认文生图（8 步 cfg1.0） |
| `image_z_image_pixel` | Z-Image + pixel LoRA | 像素画风 |
| `image_z_image_pose` | Z-Image + Fun ControlNet Union 2.1 lite | **姿势参考控制**（白膜姿势库 → 保持姿态出图） |
| `image_qwen21_t2i` | Qwen-Image-2.1 GGUF | 无限制文生图（NSFW 提示词无审查） |
| `photo_cinematic_retouch` | Z-Image i2i | 照片电影感重塑 |
| `video_wan22_ti2v_5b` / `_i2v` | Wan2.2 5B | 默认视频引擎（22GB 友好） |
| `video_minimax_h3_t2v` / `_i2v` | MiniMax H3 | 高质量视频（带原生音频，慢） |

## 依赖模型（宿主机路径）

引擎由 systemd 直跑（`comfydesk-comfyui.service`），模型目录：
`comfy-ui/models/`

| 文件 | 位置 | 来源 |
|---|---|---|
| z_image_turbo_bf16.safetensors | diffusion_models/ | Comfy-Org/Z-Image-Turbo |
| qwen_3_4b.safetensors | text_encoders/ | Comfy-Org/Z-Image-Turbo |
| ae.safetensors | vae/ | Z-Image VAE |
| Z-Image-Turbo-Fun-Controlnet-Union-2.1-lite-2602-8steps.safetensors | model_patches/ | alibaba-pai (HF)，sha256 见 `.sha256` 旁车文件 |
| qwen-image-2.1-Q4_K_M.gguf | diffusion_models/ | Qwen-Image-2.1 |

## 姿势参考工作流（image_z_image_pose）

- 用途：以白膜姿势图（`volumes/dataset/pose-ref/pose-db-01/`，288 姿势 × 5 角度，NSFW）为 ControlNet 输入，生成保持该姿态的图像
- 关键参数：`image_filename`（姿势图，需先上传到 ComfyUI `input/`，gateway 的 `generation_runner` 传 `image_filename` 参数时自动上传）、`controlnet_strength`（0.6–0.9 推荐，白膜线稿 0.8 起步）
- 姿势索引：`volumes/dataset/pose-ref/pose-db-01/index.json`（全中文名称/分类/文件映射）
- 分辨率建议：跟随参考图比例 3:4 → 832×1109；9:16 → 832×1472
- 版本管理：工作流 JSON 纳入 git（本仓库）；模型权重不进 git（体积），用 `.sha256` 旁车文件记录校验和

## 修改约定

1. 改工作流 JSON 必须同步改 meta（字段/默认值），一次 commit 成对提交
2. 哨兵符只允许出现在字符串值位置；`generation_runner` 的 `image_filename` 参数会自动确保文件在 ComfyUI `input/`
3. 大改前先跑通一次实际生成再 commit（附输出缩略图到 PR/commit message 更佳）

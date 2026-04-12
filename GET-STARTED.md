# GET-STARTED — 本地开发环境初始化

> 本指南面向**本地开发/调试**场景，不依赖 Docker。  
> 生产部署请直接参考 `README.md` 中的 Docker Compose 方式。

---

## 前提条件

| 工具 | 版本要求 | 说明 |
|------|--------|------|
| Python | ≥ 3.10 | 网关 & 训练脚本 |
| Node.js | ≥ 20 LTS | Next.js 前端 |
| Git | 任意 | |
| CUDA | ≥ 12.1 | GPU 推理（非必须，可用 CPU 调试） |
| ComfyUI | 已安装 | 本地运行在 `localhost:8188` |

---

## 1. 克隆项目 & 配置环境变量

```powershell
git clone https://github.com/yourname/comfy-desk
cd comfy-desk
copy .env.example .env   # Windows
# cp .env.example .env   # Linux/Mac
```

编辑 `.env`，主要修改：

```env
# 指向本地的 ComfyUI 和 JoyCaption 服务
COMFYUI_URL=http://localhost:8188
JOYCAPTION_URL=http://localhost:8000

# 本地开发时前端直接连接网关
NEXT_PUBLIC_API_BASE=http://localhost:8001/api/v1
```

---

## 2. 创建挂载目录（必须手动）

```powershell
# Windows (PowerShell)
New-Item -ItemType Directory -Force `
  volumes\models\checkpoints, volumes\models\loras, volumes\models\unet, `
  volumes\models\clip, volumes\models\vae, `
  volumes\output\comfydesk, volumes\hf_cache, volumes\dataset
```

```bash
# Linux / Mac
mkdir -p volumes/models/{checkpoints,loras,unet,clip,vae}
mkdir -p volumes/{output/comfydesk,hf_cache,dataset}
```

---

## 3. 启动 ComfyUI（本地）

> 如果你已有独立安装的 ComfyUI，跳过此步骤直接启动即可。

```powershell
# ComfyUI 目录下
python main.py --listen 0.0.0.0 --port 8188
```

验证：访问 `http://localhost:8188` 能看到 ComfyUI 界面。

---

## 4. FastAPI 网关

```powershell
# 在项目根目录（已激活 .venv）
cd gateway
pip install -r requirements.txt

# 启动（开发模式，支持热重载）
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

验证：
```powershell
# 健康检查
curl http://localhost:8001/api/health

# 查看 Swagger UI
start http://localhost:8001/api/docs
```

---

## 5. JoyCaption（可选，需 GPU）

**方式 A：vLLM（推荐，需 GPU ≥ 10GB）**

```powershell
pip install vllm
vllm serve fancyfeast/llama-joycaption-beta-one-hf-llava `
  --max-model-len 4096 `
  --enable-prefix-caching `
  --port 8000
```

**方式 B：跳过（不需要 caption 功能时）**

网关代码在 JoyCaption 不可用时会报 `connection refused`，不影响其他接口。

---

## 6. Next.js 前端

```powershell
cd frontend
npm install
npm run dev
```

访问 `http://localhost:3000`

> 前端会调用 `NEXT_PUBLIC_API_BASE=http://localhost:8001/api/v1`，  
> 确保第 4 步的网关已启动。

**常见问题：**

| 错误 | 原因 | 解决 |
|------|------|------|
| `ECONNREFUSED localhost:8001` | 网关未启动 | 执行步骤 4 |
| `Image src not allowed` | Next.js 图片域限制 | 已在 `next.config.ts` 放行所有域 |
| 画廊无图片 | output 目录为空 | 先生成一张图 |

---

## 7. 训练脚本

```powershell
# 安装训练脚本依赖（独立于网关）
pip install -r training/requirements.txt

# 步骤一：图片预处理（resize + 格式统一）
python training/resize_images.py `
  --input  .\raw_images `
  --output .\processed `
  --size   1024 `
  --dedupe

# 步骤二：批量生成 caption（需要网关运行中）
python training/prepare_dataset.py `
  --input  .\processed `
  --output .\train_dataset `
  --style  training `
  --api    http://localhost:8001/api/v1

# 步骤三：验证数据集完整性
python training/verify_dataset.py --dataset .\train_dataset

# 步骤四：LoRA 训练（需 kohya_ss）
# Windows 下用 Git Bash 或 WSL 执行
bash training/launch_lora.sh --model sdxl --dataset .\train_dataset --name my_lora
```

---

## 8. 同时启动所有服务（一键开发脚本）

你可以直接双击运行项目根目录下的 **`start-dev.bat`**。

这个脚本会自动：
1. 打开新窗口启动 FastAPI 网关
2. 打开新窗口启动 Next.js 前端

控制台会显示：
```
✅ Gateway: http://localhost:8001/api/docs
✅ Frontend: http://localhost:3000
⚠️  ComfyUI 需手动启动在 :8188
```

---

## 目录结构速查

```
comfy-desk/
├── .venv/                  ← Python 虚拟环境（项目根）
├── gateway/
│   └── requirements.txt    ← 网关依赖
├── training/
│   ├── requirements.txt    ← 训练脚本依赖（独立）
│   ├── resize_images.py    ← 图片预处理
│   ├── prepare_dataset.py  ← 批量 caption 生成
│   ├── verify_dataset.py   ← 数据集完整性验证
│   └── launch_lora.sh      ← LoRA 训练启动器
└── frontend/
    ├── package.json        ← Node.js 依赖
    └── src/app/            ← Next.js 页面
```

---

## 端口规划

| 服务 | 本地端口 | Docker 端口 |
|------|---------|------------|
| Nginx (反向代理) | — | 80 |
| Next.js 前端 | 3000 | 3000（内部） |
| FastAPI 网关 | 8001 | 8000（内部） |
| ComfyUI | 8188 | 8188 |
| JoyCaption (vLLM) | 8000 | 8000（内部） |

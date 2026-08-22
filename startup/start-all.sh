#!/bin/bash
# ComfyDesk 全栈一键启动(GPU 重启/开机后运行一次即可)
# 用法: bash startup/start-all.sh   ;日志见 logs/
set -a
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
[ -f .env ] && source .env
# 本地单机拓扑:引擎固定在本机,忽略 .env 里的 docker 主机名
export COMFYUI_URL=http://localhost:8188
set +a
mkdir -p logs

echo "[1/4] ComfyUI 引擎 :8188"
(cd comfy-ui && exec "$ROOT/.venv/bin/python" main.py --listen 0.0.0.0 --port 8188) \
  >"$ROOT/logs/comfyui.log" 2>&1 &

echo "[2/4] FastAPI 网关 :8001"
(
  cd gateway
  exec "$ROOT/.venv/bin/python" -m uvicorn main:app --host 0.0.0.0 --port 8001
) >"$ROOT/logs/gateway.log" 2>&1 &

echo "[3/4] Next.js 前端 :3000"
(cd frontend && exec npm run dev) >"$ROOT/logs/frontend.log" 2>&1 &

sleep 2
echo "[4/4] HTTPS 边缘 :8443/:9443"
exec bun scripts/https-edge.ts >"$ROOT/logs/edge.log" 2>&1

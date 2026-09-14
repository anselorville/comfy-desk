#!/usr/bin/env python3
"""
Video Generation Watchdog Script for ComfyDesk / ComfyUI.
Monitors the current video generation.
1. Checks every 5 minutes (300 seconds).
2. If generation completes:
   - Queries history for generated output files.
   - Calls ComfyUI /free to unload models and release GPU memory.
   - Logs completion and exits.
3. If elapsed time exceeds 3 hours (10800 seconds):
   - Calls ComfyUI /interrupt to cancel execution.
   - Calls ComfyUI /free to unload models and release GPU memory.
   - Logs timeout interruption and exits.
"""
import time
import json
import logging
import sys
from datetime import datetime, timedelta
import httpx

COMFYUI_BASE = "http://127.0.0.1:8188"
TARGET_PROMPT_ID = "65acf322-4583-42d5-a1cb-2d4b04ca4110"
MAX_SECONDS = 3 * 3600  # 3 hours
POLL_INTERVAL = 300     # 5 minutes (300s)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("logs/video_watchdog.log", mode="a", encoding="utf-8")
    ]
)
logger = logging.getLogger("video_watchdog")

def free_gpu():
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(f"{COMFYUI_BASE}/free", json={"unload_models": True, "free_memory": True})
            if resp.status_code == 200:
                logger.info("✅ GPU 显存释放成功 (已卸载模型并清空显存缓存)")
            else:
                logger.warning("GPU 显存释放返回状态码: %s", resp.status_code)
    except Exception as e:
        logger.error("调用 /free 释放显存异常: %s", e)

def interrupt_comfyui():
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(f"{COMFYUI_BASE}/interrupt")
            logger.info("🛑 已发送中断指令到 ComfyUI: %s", resp.status_code)
    except Exception as e:
        logger.error("发送中断指令异常: %s", e)

def get_history_outputs(prompt_id):
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(f"{COMFYUI_BASE}/history/{prompt_id}")
            if resp.status_code == 200:
                data = resp.json()
                outputs = data.get(prompt_id, {}).get("outputs", {})
                files = []
                for node_id, node_out in outputs.items():
                    for key in ("images", "videos", "gifs"):
                        for item in node_out.get(key, []):
                            if isinstance(item, dict) and "filename" in item:
                                files.append(item["filename"])
                            elif isinstance(item, str):
                                files.append(item)
                return files
    except Exception as e:
        logger.warning("查询历史输出异常: %s", e)
    return []

def main():
    start_time = time.time()
    deadline = start_time + MAX_SECONDS
    deadline_str = datetime.fromtimestamp(deadline).strftime("%Y-%m-%d %H:%M:%S")
    logger.info("==================================================")
    logger.info("启动视频生成看门狗 (Watchdog - 5分钟轮询)")
    logger.info(f"目标 Prompt ID: {TARGET_PROMPT_ID}")
    logger.info(f"轮询间隔: 5 分钟 (300 秒)")
    logger.info(f"最长等待时间: 3 小时 (截止时间: {deadline_str})")
    logger.info("==================================================")

    with httpx.Client(timeout=15) as client:
        while True:
            now = time.time()
            elapsed_min = (now - start_time) / 60.0
            remaining_min = max(0.0, (deadline - now) / 60.0)

            # Check timeout (3 hours)
            if now >= deadline:
                logger.warning("⚠️ 已超过 3 小时最长等待时间！正在中断程序并释放 GPU 显存...")
                interrupt_comfyui()
                time.sleep(2)
                free_gpu()
                logger.info("看门狗任务结束：超时强制中断。")
                break

            # Query queue
            try:
                q_resp = client.get(f"{COMFYUI_BASE}/queue")
                if q_resp.status_code == 200:
                    q_data = q_resp.json()
                    running = q_data.get("queue_running", [])
                    
                    # Check if target prompt is still in queue_running
                    running_prompts = [item[1] for item in running if len(item) > 1]
                    
                    if TARGET_PROMPT_ID in running_prompts:
                        logger.info(f"⏳ 任务渲染进行中... 已监控 {elapsed_min:.1f} 分钟 (距离3小时超时剩余 {remaining_min:.1f} 分钟)")
                    elif len(running) == 0:
                        logger.info("🎉 视频生成已顺利完成！")
                        files = get_history_outputs(TARGET_PROMPT_ID)
                        if files:
                            logger.info(f"📁 生成的文件列表: {files}")
                        else:
                            logger.info("📁 未在历史记录中找到输出文件名，请查看 comfy-ui/output 目录")
                        
                        logger.info("🧹 正在卸载模型以恢复 GPU 空载...")
                        free_gpu()
                        logger.info("看门狗任务结束：生成完成且显存已清空。")
                        break
                    else:
                        logger.info(f"⏳ 目标任务已结束当前节点，队列中仍有其他节点运行中 (剩余超时: {remaining_min:.1f} 分钟)")
            except Exception as e:
                logger.warning("查询 /queue 发生网络异常 (可能正在高负载): %s", e)

            time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()

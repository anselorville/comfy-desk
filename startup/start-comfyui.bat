@echo off
title ComfyDesk - ComfyUI Only
echo ==============================================
echo Starting ComfyUI Locally...
echo ==============================================

:: Change directory to the parent folder so relative paths work
cd %~dp0..

:: Check python virtual environment
if not exist ".venv\Scripts\activate.bat" (
    echo [ERROR] .venv not found! You need to set it up first.
    pause
    exit /b 1
)

:: Start ComfyUI Engine
echo - Starting ComfyUI Backend...
call .\.venv\Scripts\activate.bat
cd comfy-ui
python main.py --listen 0.0.0.0 --port 8188

pause

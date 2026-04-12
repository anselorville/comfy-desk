@echo off
title ComfyDesk Start Script
echo ==============================================
echo Starting ComfyDesk Local Services...
echo ==============================================

:: Change directory to the parent folder so relative paths work
cd %~dp0..

:: Check python virtual environment
if not exist ".venv\Scripts\activate.bat" (
    echo [WARNING] .venv not found! You might need to set it up.
)

:: Start ComfyUI Engine
echo - Starting ComfyUI Backend...
start "ComfyUI Backend" cmd /k "if exist .\.venv\Scripts\activate.bat (.\.venv\Scripts\activate.bat) & cd comfy-ui & python main.py --listen 0.0.0.0 --port 8188"

:: Start FastAPI Gateway
echo - Starting FastAPI Gateway...
start "FastAPI Gateway" cmd /k "if exist .\.venv\Scripts\activate.bat (.\.venv\Scripts\activate.bat) & cd gateway & uvicorn main:app --reload --host 0.0.0.0 --port 8001"

:: Start Next.js Frontend
echo - Starting Next.js Frontend...
start "Next.js Frontend" cmd /k "cd frontend & npm run dev"

timeout /t 2 /nobreak >nul

echo.
echo ==============================================
echo [SUCCESS] Services are starting in new windows!
echo ==============================================
echo * ComfyUI Engine  : http://localhost:8188
echo * FastAPI Gateway : http://localhost:8001
echo * Swagger API Docs: http://localhost:8001/api/docs  (or /docs)
echo * Next.js Frontend: http://localhost:3000
echo.
echo [NOTE] JoyCaption required for annotation endpoints.
echo [NOTE] Run vllm locally or via docker for JoyCaption on port 8000.
echo ==============================================
echo.
pause

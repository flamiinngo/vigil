@echo off
title Vigil Setup — Decentralized On-Chain Intelligence Network
color 0D

echo.
echo  ============================================================
echo   VIGIL — SETUP
echo   Decentralized On-Chain Intelligence Network
echo   ETHGlobal Open Agents 2026
echo  ============================================================
echo.

:: ── Check prerequisites ──────────────────────────────────────────

echo [1/6] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Python not found. Install Python 3.11+ from https://python.org
    pause & exit /b 1
)
python --version

echo [2/6] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js not found. Install from https://nodejs.org
    pause & exit /b 1
)
node --version

echo [3/6] Checking Ollama...
ollama --version >nul 2>&1
if errorlevel 1 (
    echo  WARNING: Ollama not found. Install from https://ollama.com
    echo  After installing, run:  ollama pull llama3
    echo  Then re-run this setup.
) else (
    echo  Ollama found. Pulling llama3 model (this may take a few minutes)...
    ollama pull llama3
)

:: ── Python dependencies ──────────────────────────────────────────

echo.
echo [4/6] Installing Python dependencies...
cd /d "%~dp0"
pip install websockets httpx python-dotenv --quiet
if errorlevel 1 (
    echo  ERROR: pip install failed. Check your Python environment.
    pause & exit /b 1
)
echo  Python deps installed.

:: ── Frontend dependencies ─────────────────────────────────────────

echo.
echo [5/6] Installing frontend dependencies...
cd /d "%~dp0frontend"
npm install --silent
if errorlevel 1 (
    echo  ERROR: npm install failed.
    pause & exit /b 1
)
echo  Frontend deps installed.

:: ── .env setup ────────────────────────────────────────────────────

echo.
echo [6/6] Setting up .env file...
cd /d "%~dp0"
if not exist .env (
    copy .env.example .env >nul
    echo  Created .env from .env.example
    echo.
    echo  *** ACTION REQUIRED ***
    echo  Edit .env and set your ALCHEMY_API_KEY before running Vigil.
    echo  Get a free key at: https://dashboard.alchemy.com
    echo.
) else (
    echo  .env already exists — skipping.
)

:: ── Done ──────────────────────────────────────────────────────────

echo.
echo  ============================================================
echo   SETUP COMPLETE
echo  ============================================================
echo.
echo  Next steps:
echo.
echo    1. Edit .env and add your ALCHEMY_API_KEY
echo.
echo    2. Start AXL (in a separate terminal):
echo         axl start
echo.
echo    3. Start Ollama (in a separate terminal):
echo         ollama serve
echo.
echo    4. Start Vigil Node 1 (in a terminal):
echo         cd agent
echo         python main.py
echo.
echo    5. Start Vigil Node 2 (in another terminal):
echo         cd agent
echo         set NODE_ID=vigil-node-2 ^&^& python main.py
echo.
echo    6. Start the signals API server (in another terminal):
echo         cd agent
echo         python server.py
echo.
echo    7. Start the dashboard (in another terminal):
echo         cd frontend
echo         npm start
echo.
echo    Dashboard opens at: http://localhost:3000
echo.
pause

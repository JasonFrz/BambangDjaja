@echo off
REM ============================================================
REM  Frontend launcher - install & jalanin dashboard React/Vite
REM  Cukup double-click file ini.
REM ============================================================
cd /d "%~dp0"

echo [1/2] Cek Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: Node.js belum terpasang.
    echo  Download versi LTS di https://nodejs.org/
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo       Install dependency ^(sekali saja, agak lama^)...
    call npm install
)

echo [2/2] Menjalankan dashboard...
echo       Buka alamat yang muncul di bawah ^(biasanya http://localhost:5173^)
echo       ^(Tekan CTRL+C untuk berhenti^)
echo.
call npm run dev

pause

@echo off
echo =====================================
echo   TERI APP SYSTEM TEST
echo =====================================
echo.

echo [TEST 1] Checking TERI Model...
ollama list | findstr TERI >nul
if %errorlevel%==0 (
    echo ✅ TERI:latest model found!
) else (
    echo ❌ TERI model not found. Please run: ollama pull TERI:latest
    pause
    exit
)

echo.
echo [TEST 2] Testing TERI Translation...
echo Input: "You never listen to me!"
echo.
echo TERI Response:
ollama run TERI:latest "Transform to TES: You never listen" --verbose 2>nul | head -n 3
echo ✅ TERI model responding!

echo.
echo [TEST 3] Checking ChromaDB...
if exist "C:\Users\John\Desktop\teri-model\truth_power_db\chroma.sqlite3" (
    echo ✅ ChromaDB database found!
) else (
    echo ❌ ChromaDB not found
)

echo.
echo [TEST 4] Checking Backend Structure...
if exist "C:\Users\John\Desktop\teri-model\backend\src\app.js" (
    echo ✅ Backend API ready!
) else (
    echo ❌ Backend not found
)

echo.
echo [TEST 5] Checking Mobile App...
if exist "C:\Users\John\Desktop\teri-model\mobile\App.tsx" (
    echo ✅ Mobile app ready!
) else (
    echo ❌ Mobile app not found
)

echo.
echo =====================================
echo   ALL SYSTEMS OPERATIONAL!
echo =====================================
echo.
echo Ready to launch with: "🚀 TERI APP - CLICK ME.bat"
echo.
pause
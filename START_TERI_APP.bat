@echo off
echo ========================================
echo    TERI - Truth Empowered Relationships
echo          One-Click App Launcher
echo ========================================
echo.

:: Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    timeout /t 10 /nobreak >nul
)

:: Start all services
echo [1/5] Starting Database Services...
cd "%~dp0"
docker-compose up -d postgres redis chromadb >nul 2>&1

echo [2/5] Starting TERI Model...
start /min cmd /c "ollama serve & ollama run TERI:latest"

echo [3/5] Starting Backend API...
cd "%~dp0backend"
if not exist node_modules (
    echo     Installing backend dependencies...
    call npm install >nul 2>&1
)
start /min cmd /c "node src/app.js"

echo [4/5] Starting Mobile App...
cd "%~dp0mobile"
if not exist node_modules (
    echo     Installing mobile dependencies...
    call npm install >nul 2>&1
)

echo [5/5] Launching TERI App...
timeout /t 3 /nobreak >nul

:: Open the app
echo.
echo ========================================
echo    TERI App is Starting!
echo ========================================
echo.
echo   Backend API:  http://localhost:5000
echo   Mobile App:   Starting React Native...
echo   TERI Model:   Ready
echo.
echo   Opening mobile app in 5 seconds...
timeout /t 5 /nobreak >nul

:: Launch React Native
call npx react-native run-android >nul 2>&1 || call npx react-native run-ios >nul 2>&1

:: Open web dashboard
start http://localhost:5000/health

echo.
echo ========================================
echo    TERI App is Running!
echo ========================================
echo.
echo Press any key to stop all services...
pause >nul

:: Cleanup
echo.
echo Stopping services...
docker-compose down
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im ollama.exe >nul 2>&1
echo.
echo TERI App stopped successfully.
pause
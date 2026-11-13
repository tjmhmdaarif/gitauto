@echo off
REM Daily automation pipeline wrapper - invoked by the Windows scheduled task.
REM TZ=UTC keeps the pipeline's date logic on the UTC boundary the README promises.
set TZ=UTC
cd /d "C:\Users\muham\daily-automation"
if not exist "logs" mkdir "logs"
echo. >> "logs\daily.log"
echo ==== %DATE% %TIME% ==== >> "logs\daily.log"
REM Make sure the local AI gateway is up so enrichment does not fall back to heuristics.
"C:\Program Files\nodejs\node.exe" "deploy\ensure-gateway.mjs" >> "logs\daily.log" 2>&1
"C:\Program Files\nodejs\node.exe" "dist\scripts\scheduler.js" --run-now >> "logs\daily.log" 2>&1
echo EXIT=%ERRORLEVEL% >> "logs\daily.log"

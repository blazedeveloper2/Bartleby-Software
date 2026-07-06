@echo off
REM ============================================================
REM  Bartleby Software - one-click sync to GitHub
REM  Double-click this file to save all changes and publish.
REM ============================================================
cd /d "%~dp0"

echo Staging changes...
git add -A

echo Committing...
git commit -m "Update %date% %time%"
if errorlevel 1 (
  echo.
  echo Nothing new to commit ^(or commit failed^). See message above.
)

echo Pushing to GitHub...
git push

echo.
echo Done. Your site will redeploy in about a minute.
pause

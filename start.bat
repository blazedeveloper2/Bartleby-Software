@echo off
REM ============================================================
REM  Bartleby Web - run locally
REM
REM  Double-click THIS file instead of index.html.
REM
REM  The apps are ES modules, which browsers refuse to load from a
REM  file:// path (that's why opening index.html directly shows a
REM  blank page). This serves the folder over http:// and opens it.
REM ============================================================
cd /d "%~dp0"

echo Starting local server on http://localhost:4321 ...
echo.
echo Leave this window OPEN while you use the app.
echo Close it when you're done.
echo.

start "" http://localhost:4321
npx --yes serve -l 4321 . >nul

echo.
echo Server stopped.
pause

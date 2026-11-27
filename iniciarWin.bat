@echo off
chcp 65001 >nul
title Odramech
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo  [X] Node.js nao encontrado. Instale o Node 22 LTS em https://nodejs.org
  pause
  exit /b 1
)

rem Primeira vez? roda o setup automaticamente
if not exist "odramech-backend\node_modules" goto setup
if not exist "odramech-frontend\node_modules" goto setup
if not exist "node_modules\embedded-postgres" goto setup
if not exist "odramech-assinaturas\node_modules" goto setup
goto run

:setup
echo  Primeira execucao: preparando o ambiente...
node scripts\setup.mjs
if errorlevel 1 (
  pause
  exit /b 1
)

:run
node scripts\dev.mjs
pause

@echo off
chcp 65001 >nul
title Odramech - Setup
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [X] Node.js nao encontrado.
  echo      Instale o Node 22 LTS em https://nodejs.org e rode este arquivo de novo.
  echo.
  pause
  exit /b 1
)

node scripts\setup.mjs
if errorlevel 1 (
  echo.
  echo  [X] O setup falhou. Veja a mensagem acima.
  pause
  exit /b 1
)
pause

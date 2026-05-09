#!/bin/zsh

cd "/Users/huangguanlun/Documents/New project" || exit 1
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/nvm.sh" ] && nvm use 20 >/dev/null 2>&1

if ! command -v npm >/dev/null 2>&1; then
  echo "找不到 npm，請先確認 Node.js 已安裝。"
  exit 1
fi

npm run dev

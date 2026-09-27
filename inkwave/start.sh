#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

command -v python3 >/dev/null || { echo "Python 3 is required." >&2; exit 1; }
command -v lsof >/dev/null || { echo "lsof is required; see README.md for manual startup." >&2; exit 1; }

# 查找一个空闲端口（优先从 8088 开始）
PORT=8088
while lsof -Pi :"$PORT" -sTCP:LISTEN -t >/dev/null ; do
    PORT=$((PORT + 1))
done

echo "======================================================="
echo "   INKWAVE 本地服务启动中..."
echo "   访问地址: http://127.0.0.1:$PORT"
echo "======================================================="

# 打开默认浏览器
if command -v open >/dev/null && [[ "$(uname -s)" == Darwin ]]; then
    (sleep 1; open "http://127.0.0.1:$PORT" || true) &
elif command -v xdg-open >/dev/null; then
    (sleep 1; xdg-open "http://127.0.0.1:$PORT" >/dev/null 2>&1 || true) &
fi

# 启动 python3 静态服务器
exec python3 -m http.server "$PORT" --bind 127.0.0.1

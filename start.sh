#!/bin/bash

# OpenClaw Jarvis Dashboard 启动脚本

echo "🚀 Starting OpenClaw Jarvis Dashboard..."

# 进入项目目录
cd "$(dirname "$0")"

# 启动后端服务器
echo "📦 Starting backend server on port 3001..."
npm run server &
BACKEND_PID=$!

# 等待后端启动
sleep 2

# 启动前端
echo "🎨 Starting frontend dev server on port 5173..."
npm run dev &
FRONTEND_PID=$!

echo "✅ Dashboard started!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop all servers"

# 等待用户中断
wait

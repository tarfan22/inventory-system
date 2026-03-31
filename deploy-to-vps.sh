#!/bin/bash

# Deployment script for inventory system
# Usage: ./deploy-to-vps.sh

VPS_HOST="100.74.117.90"
VPS_USER="dhively"
VPS_PASSWORD="TarBee22@@"
APP_DIR="~/inventory-app"

echo "🚀 Deploying to VPS..."

# Install sshpass if not present
if ! command -v sshpass &> /dev/null; then
    echo "📦 Installing sshpass..."
    brew install sshpass 2>/dev/null || echo "Please install sshpass manually"
fi

# Upload files to VPS
echo "📤 Uploading files..."
sshpass -p "$VPS_PASSWORD" rsync -avz --delete \
  --exclude 'venv/' \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude '.git/' \
  --exclude '.gitignore' \
  --exclude 'README.md' \
  --exclude '*.md' \
  --exclude 'inventory.db' \
  --exclude 'uploads/' \
  ./ $VPS_USER@$VPS_HOST:$APP_DIR/

# Restart application on VPS
echo "🔄 Restarting application..."
sshpass -p "$VPS_PASSWORD" ssh $VPS_USER@$VPS_HOST << 'ENDSSH'
  cd ~/inventory-app
  docker-compose down
  docker-compose up -d --build
  sleep 5
  echo "✅ Deployment complete!"
  echo "🌐 App is running at: http://100.74.117.90:8000"
ENDSSH

echo "✨ Deployment finished!"

# Quick VPS Deployment Guide

## Step 1: SSH Into Your VPS
```bash
ssh dhively@100.74.117.90
```
Enter your password when prompted.

## Step 2: Copy the Setup Script to VPS

From your local machine (in a new terminal):
```bash
cd Documents/LLMOS/50_Projects/inventory-system
scp vps-setup.sh dhively@100.74.117.90:~/
```

## Step 3: Run the Setup Script on VPS

Back in your SSH terminal:
```bash
sudo chmod +x ~/vps-setup.sh
~/vps-setup.sh
```

Enter your sudo password when prompted.

## Step 4: Upload Your App Files

From your local machine:
```bash
./deploy.sh
```

Or manually:
```bash
rsync -av --progress ./ dhively@100.74.117.90:~/inventory-app/
```

## Step 5: Start Your App on VPS

Back in your SSH terminal:
```bash
cd ~/inventory-app
docker-compose up -d --build
```

## Step 6: Access Your App!

Open your browser and go to:
**http://100.74.117.90:8000**

## 🎉 Done!

Your inventory app is now running on your VPS!

## Management Commands (run on VPS):
```bash
cd ~/inventory-app

# View logs
docker-compose logs -f

# Restart app
docker-compose restart

# Stop app
docker-compose down

# Update app (after uploading new files)
docker-compose down
docker-compose up -d --build
```

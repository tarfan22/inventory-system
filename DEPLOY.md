# Deploy Inventory App to VPS

## Prerequisites
- VPS with Ubuntu/Debian
- SSH access to VPS
- Domain name (optional) pointed to VPS IP

## Quick Deploy Instructions

### Option 1: Using SCP (Manual Upload)

1. **Upload files to VPS:**
```bash
scp -r dhively@100.74.117.90:~/inventory-app
```

2. **SSH into your VPS:**
```bash
ssh dhively@100.74.117.90
```

3. **Navigate to app directory:**
```bash
cd ~/inventory-app
```

4. **Install Docker (if not installed):**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

5. **Install Docker Compose:**
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

6. **Build and start the container:**
```bash
docker-compose up -d --build
```

7. **Check if it's running:**
```bash
docker-compose logs -f
```

Your app will be available at: http://100.74.117.90:8000

### Option 2: Using Rsync (Faster for Updates)

```bash
rsync -av --progress \
    --exclude 'venv/' \
    --exclude '__pycache__/' \
    --exclude '*.pyc' \
    --exclude '.git/' \
    --exclude '*.db' \
    ./ dhively@100.74.117.90:~/inventory-app/
```

## Managing Your Container

### View logs:
```bash
ssh dhively@100.74.117.90
cd ~/inventory-app
docker-compose logs -f
```

### Stop the app:
```bash
docker-compose down
```

### Start the app:
```bash
docker-compose up -d
```

### Restart the app:
```bash
docker-compose restart
```

### Update the app:
```bash
# 1. Upload new files
rsync -av --progress ./ dhively@100.74.117.90:~/inventory-app/

# 2. SSH and rebuild
ssh dhively@100.74.117.90
cd ~/inventory-app
docker-compose down
docker-compose up -d --build
```

## Security Notes

### Optional: Set up Firewall
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 8000/tcp  # Your app
sudo ufw enable
```

### Optional: Set up Nginx Reverse Proxy (for HTTPS)
```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/inventory
```

Nginx config:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/inventory /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Then use Certbot for free SSL:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Database Backup

To backup your database:
```bash
scp dhively@100.74.117.90:~/inventory-app/inventory.db ./backup.db
```

To restore:
```bash
scp ./backup.db dhively@100.74.117.90:~/inventory-app/inventory.db
ssh dhively@100.74.117.90 "cd ~/inventory-app && docker-compose restart"
```

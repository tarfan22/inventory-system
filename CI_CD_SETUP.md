# CI/CD Pipeline Setup Guide

## Overview

Your inventory system now has an automated CI/CD pipeline that:
- ✅ Tests your code on every push
- ✅ Builds Docker images
- ✅ Automatically deploys to your VPS when you push to main branch

## Setup Steps

### 1. Add GitHub Secrets

Go to your GitHub repository settings and add these secrets:

**Navigate to:** Settings → Secrets and variables → Actions → New repository secret

**Add these secrets:**

| Name | Value | Required |
|------|-------|----------|
| `VPS_HOST` | `100.74.117.90` | ✅ Yes |
| `VPS_USER` | `dhively` | ✅ Yes |
| `VPS_PASSWORD` | `TarBee22@@` | ✅ Yes |
| `VPS_PORT` | `22` | Optional (SSH port) |

**Important:** Keep your password secure! Never share it publicly.

### 2. Enable GitHub Actions

The workflow is already set up at `.github/workflows/deploy.yml`

### 3. Test the Pipeline

Make a small change and push:
```bash
git add .
git commit -m "Test CI/CD pipeline"
git push origin main
```

Watch the deployment happen automatically at:
https://github.com/tarfan22/dhively-llmos/actions

## How It Works

### Trigger Events

The pipeline runs on:
- **Push to main branch** → Tests + Deploys to VPS
- **Pull requests** → Tests only (no deployment)
- **Manual trigger** → Tests + Deploys (via Actions tab)

### Pipeline Stages

**Stage 1: Test** (runs on every push/PR)
- Checks out code
- Sets up Python environment
- Installs dependencies
- Runs linting (flake8)
- Runs tests

**Stage 2: Build and Deploy** (only on main branch pushes)
- Checks out code
- Sets up Docker Buildx
- Connects to VPS via SSH
- Uploads files using rsync
- Restarts Docker container
- Verifies deployment

### Deployment Process

When you push to main:
1. GitHub Actions starts automatically
2. Code is tested
3. Files are uploaded to your VPS
4. Docker container is rebuilt
5. Application is restarted
6. Health check verifies deployment

### Monitoring Deployments

View deployment status:
- **GitHub Actions tab:** https://github.com/tarfan22/dhively-llmos/actions
- **Live logs:** Click on any workflow run to see detailed logs

### Rollback Strategy

If deployment fails:
- Container keeps running with old code
- No downtime during failed deployments
- Manual rollback: `git revert HEAD && git push`

### Security

✅ **Secure by default:**
- Passwords stored as encrypted GitHub secrets
- SSH keys managed securely
- No credentials in code

✅ **Access control:**
- Only main branch triggers automatic deployment
- Pull requests test without deploying
- Manual approval possible if needed

## Usage Examples

### Deploy New Features
```bash
# Make your changes locally
git add .
git commit -m "Add new feature"
git push origin main

# Automatic deployment happens!
```

### Safe Development with Pull Requests
```bash
# Create feature branch
git checkout -b feature/new-stuff

# Make changes
git add .
git commit -m "Add new stuff"

# Push to feature branch
git push origin feature/new-stuff

# Create PR on GitHub
# Tests run automatically
# Merge to main → Automatic deployment
```

### Manual Deployment
```bash
# Push changes
git push origin main

# Or trigger manually:
# Go to Actions tab → Deploy workflow → Run workflow
```

## Troubleshooting

### Deployment Failed?

Check the GitHub Actions logs for detailed error messages.

Common issues:
- **SSH connection:** Check VPS_HOST and VPS_PASSWORD secrets
- **Permission denied:** Verify VPS_USER and password are correct
- **Container won't start:** Check VPS has Docker installed

### Pipeline Not Running?

Check:
1. GitHub Actions is enabled (Settings → Actions)
2. Workflow file exists: `.github/workflows/deploy.yml`
3. You're pushing to the `main` branch

### View Deployment Logs

1. Go to https://github.com/tarfan22/dhively-llmos/actions
2. Click on the latest workflow run
3. Click on "Build and Deploy to VPS" job
4. Expand the steps to see detailed logs

## Advanced Configuration

### Require Approval for Deployment

Edit `.github/workflows/deploy.yml` and add under `build-and-deploy`:

```yaml
environment:
  VPS_HOST: ${{ secrets.VPS_HOST }}
  VPS_USER: ${{ secrets.VPS_USER }}
  VPS_PASSWORD: ${{ secrets.VPS_PASSWORD }}
```

Add approval step:
```yaml
- name: Request deployment approval
  uses: trstringer/manual-approval@v1
  with:
    secret: ${{ secrets.GITHUB_TOKEN }}
    approvers: dhively
    minimum-approvals: 1
```

### Deploy to Multiple Environments

Create separate workflows for dev/staging/production with different VPS hosts.

## Next Steps

1. ✅ Add GitHub secrets (VPS_HOST, VPS_USER, VPS_PASSWORD)
2. ✅ Push changes to main
3. ✅ Watch automatic deployment
4. ✅ Monitor in Actions tab

Your inventory system is now fully automated! 🚀

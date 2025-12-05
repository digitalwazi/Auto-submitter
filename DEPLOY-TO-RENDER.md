# Deploy Full App to Render (Alternative to Vercel)

## Overview

Deploy the entire Auto Submitter system to Render.com - everything in one place with Playwright working natively.

---

## Step 1: Prepare the Main App

### 1.1 Create `render.yaml`

Create in project root:

```yaml
services:
  - type: web
    name: autocommenter
    env: docker
    dockerfilePath: ./Dockerfile.render
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: autocommenter-db
          property: connectionString
      - key: SUBMISSION_NAME
        value: Your Company Name
      - key: SUBMISSION_EMAIL  
        value: contact@yourcompany.com
      - key: SUBMISSION_MESSAGE
        value: Hi, we'd like to connect with you.
    disk:
      name: blob-storage
      mountPath: /app/storage
      sizeGB: 1

databases:
  - name: autocommenter-db
    databaseName: autocommenter
    user: autocommenter
```

### 1.2 Create `Dockerfile.render`

```dockerfile
FROM node:18-slim

# Install Playwright dependencies
RUN apt-get update && apt-get install -y \
    wget ca-certificates fonts-liberation \
    libappindicator3-1 libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 \
    libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
    libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 \
    libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
    libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
    libxss1 libxtst6 lsb-release xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Install Playwright browsers
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Generate Prisma client
RUN npx prisma generate

# Copy app code
COPY . .

# Build Next.js
RUN npm run build

EXPOSE 3000

# Run migrations and start
CMD npx prisma db push --accept-data-loss && npm start
```

---

## Step 2: Update Code for Render

### 2.1 Use Local Playwright (No External Service)

Keep the original `form-submitter.js` and `comment-submitter.js` that use Playwright directly (revert the HTTP changes).

### 2.2 Update `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'playwright'];
    }
    return config;
  },
}

module.exports = nextConfig
```

---

## Step 3: Deploy to Render

### 3.1 Push to GitHub

```bash
git add .
git commit -m "Add Render deployment configuration"
git push origin main
```

### 3.2 Create Render Account

1. Go to https://render.com
2. Sign up with GitHub
3. Authorize Render to access your repositories

### 3.3 Deploy from Dashboard

1. Click "New +" → "Blueprint"
2. Connect your repo: `99proteam/autocommenter`
3. Render will detect `render.yaml` automatically
4. Click "Apply"
5. Wait for deployment (~10 minutes)

### 3.4 Your App is Live!

- **URL:** `https://autocommenter.onrender.com`
- **Database:** Automatically provisioned
- **Playwright:** Works natively!

---

## Step 4: Configure Blob Storage (Optional)

For file uploads in Render:

1. Go to your service → "Storage"
2. Create a disk
3. Mount at `/app/storage`
4. Update upload handler to use local disk instead of Vercel Blob

---

## Architecture (All-in-One)

```
Render Web Service
├── Next.js App (UI)
├── API Routes
├── Playwright (Browser Automation)
├── PostgreSQL Database
└── Disk Storage (File Uploads)
```

**Everything runs in one container!**

---

## Costs 

**Free Tier:**
- 750 hours/month
- 512 MB RAM
- Spins down after 15 min inactivity
- Cold start: ~30 seconds

**Starter Plan ($7/month):**
- Always on
- 512 MB RAM
- No cold starts

**Standard Plan ($25/month):**
- 2 GB RAM
- Better for production

---

## Comparison: Render vs Vercel

| Feature | Render | Vercel + Render |
|---------|--------|-----------------|
| Setup | Simple | Complex |
| Playwright | ✅ Native | ⚠️ External service |
| Speed | Medium | Fast (Edge) |
| Cost (Free) | $0 | $0 |
| Cold Starts | Yes | Vercel: No, Render: Yes |
| Maintenance | Easy | Medium |

---

## Recommendation

**Use Render if:**
- You want simplicity
- Cold starts are acceptable
- You need Playwright working natively

**Use Vercel + Render if:**
- You need blazing fast response times
- Global edge network is important
- You're okay with more complexity

---

**Want me to set this up for you?** I can:
1. Create the Dockerfile and render.yaml
2. Revert the Vercel-specific changes
3. Prepare everything for Render deployment

Just say "yes" and I'll do it!

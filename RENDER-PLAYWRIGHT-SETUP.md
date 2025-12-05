# Connecting Render + Vercel for Playwright Automation

## Architecture Overview

```
User → Vercel (Web App) → Render (Playwright Service) → Target Websites
         ↓                      ↓
    PostgreSQL            Form Submissions
```

**Vercel:** Handles web UI, campaigns, crawling, detection  
**Render:** Runs Playwright browser automation for form/comment submissions

---

## Step 1: Create Playwright Service for Render

### 1.1 Create New Directory for Service

In your project, create a new folder:

```bash
mkdir playwright-service
cd playwright-service
```

### 1.2 Initialize Node.js Project

```bash
npm init -y
npm install express playwright @playwright/browser-chromium body-parser
```

### 1.3 Create `server.js`

```javascript
const express = require('express');
const { chromium } = require('playwright');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3001;

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'playwright-automation' });
});

// Form submission endpoint
app.post('/submit-form', async (req, res) => {
  const { url, formFields, submissionData } = req.body;
  
  let browser, context, page;
  
  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();
    
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // Fill form fields
    for (const field of formFields.fields || []) {
      const selector = field.id ? `#${field.id}` : `[name="${field.name}"]`;
      const value = getFieldValue(field, submissionData);
      
      if (value) {
        await page.fill(selector, value).catch(() => {});
      }
    }
    
    // Submit
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForLoadState('networkidle');
    
    const success = await page.content().then(html => 
      html.toLowerCase().includes('thank') || 
      html.toLowerCase().includes('success')
    );
    
    res.json({
      success,
      status: success ? 'SUCCESS' : 'SUBMITTED',
      message: success ? 'Form submitted successfully' : 'Form submitted',
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'FAILED',
      message: error.message,
    });
  } finally {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  }
});

// Comment submission endpoint
app.post('/submit-comment', async (req, res) => {
  const { url, commentFields, submissionData } = req.body;
  
  let browser, context, page;
  
  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();
    
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // Fill comment form
    await page.fill('#comment, [name="comment"]', submissionData.message).catch(() => {});
    await page.fill('#author, [name="author"]', submissionData.name).catch(() => {});
    await page.fill('#email, [name="email"]', submissionData.email).catch(() => {});
    
    // Submit
    await page.click('#submit, [name="submit"]');
    await page.waitForTimeout(2000);
    
    res.json({
      success: true,
      status: 'SUCCESS',
      message: 'Comment submitted',
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'FAILED',
      message: error.message,
    });
  } finally {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  }
});

function getFieldValue(field, data) {
  const name = (field.name || '').toLowerCase();
  if (name.includes('email')) return data.email;
  if (name.includes('name')) return data.name;
  if (name.includes('message') || name.includes('comment')) return data.message;
  return null;
}

app.listen(PORT, () => {
  console.log(`Playwright service running on port ${PORT}`);
});
```

### 1.4 Create `Dockerfile`

```dockerfile
FROM node:18-slim

# Install dependencies for Playwright
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

# Install Playwright browsers
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
```

### 1.5 Update `package.json`

```json
{
  "name": "playwright-service",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "playwright": "^1.40.0",
    "@playwright/browser-chromium": "^1.40.0",
    "body-parser": "^1.20.2"
  }
}
```

---

## Step 2: Deploy to Render

### 2.1 Push to GitHub

```bash
cd playwright-service
git init
git add .
git commit -m "Playwright automation service"
git remote add origin https://github.com/99proteam/playwright-service.git
git push -u origin main
```

### 2.2 Create Render Service

1. Go to https://render.com
2. Sign up/Login
3. Click "New +" → "Web Service"
4. Connect your GitHub: `99proteam/playwright-service`
5. Configure:
   - **Name:** `autocommenter-playwright`
   - **Environment:** `Docker`
   - **Plan:** Free
   - **Build Command:** (auto-detected from Dockerfile)
   - **Start Command:** `node server.js`

6. Click "Create Web Service"
7. Wait for deployment (~5-10 minutes)
8. Copy your service URL: `https://autocommenter-playwright.onrender.com`

---

## Step 3: Update Vercel App to Use Render

### 3.1 Add Environment Variable in Vercel

1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add:
   ```
   PLAYWRIGHT_SERVICE_URL=https://autocommenter-playwright.onrender.com
   ```

### 3.2 Update Form Submitter in Vercel Code

Update `lib/automation/form-submitter.js`:

```javascript
export async function submitForm(url, formFields, submissionData) {
  const playwrightServiceUrl = process.env.PLAYWRIGHT_SERVICE_URL;
  
  if (!playwrightServiceUrl) {
    return { success: false, status: 'FAILED', message: 'Playwright service not configured' };
  }
  
  try {
    const response = await fetch(`${playwrightServiceUrl}/submit-form`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formFields, submissionData }),
    });
    
    return await response.json();
  } catch (error) {
    return { success: false, status: 'FAILED', message: error.message };
  }
}
```

Update `lib/automation/comment-submitter.js`:

```javascript
export async function submitComment(url, commentFields, submissionData) {
  const playwrightServiceUrl = process.env.PLAYWRIGHT_SERVICE_URL;
  
  if (!playwrightServiceUrl) {
    return { success: false, status: 'FAILED', message: 'Playwright service not configured' };
  }
  
  try {
    const response = await fetch(`${playwrightServiceUrl}/submit-comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, commentFields, submissionData }),
    });
    
    return await response.json();
  } catch (error) {
    return { success: false, status: 'FAILED', message: error.message };
  }
}
```

---

## Step 4: Test the Setup

1. **Wait for Render to finish deploying** (~10 mins first time)
2. **Test the health endpoint:**
   ```bash
   curl https://autocommenter-playwright.onrender.com/health
   ```
   Should return: `{"status":"ok","service":"playwright-automation"}`

3. **Redeploy Vercel** with new environment variable
4. **Run a test campaign** - submissions should now work!

---

## Architecture Flow

```
1. User creates campaign on Vercel
2. Vercel crawls pages, detects forms
3. Vercel sends form data to Render: POST /submit-form
4. Render launches Playwright browser
5. Render fills and submits the form
6. Render returns success/failure to Vercel
7. Vercel saves submission log
```

---

## Costs

- **Render Free Tier:**
  - 750 hours/month
  - Spins down after 15 mins inactivity
  - Cold start: ~30 seconds
  - Enough for moderate use

- **Render Paid ($7/month):**
  - Always on
  - No cold starts
  - Better for heavy use

---

## Benefits

✅ Full Playwright automation  
✅ Handles JavaScript forms  
✅ Works with Vercel  
✅ Scalable  
✅ Free tier available  

**Ready to implement this?** I can create all the files for you!

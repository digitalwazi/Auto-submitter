# Deploy Auto Submitter to Render

## ✅ **Everything is Ready!**

All code is configured for Render deployment with Playwright working natively.

---

## **Quick Deploy (5 Minutes)**

### Step 1: Create Render Account
1. Go to https://render.com
2. Sign up with GitHub account: `99proteam`
3. Authorize Render to access your repositories

### Step 2: Deploy from Blueprint
1. Click "New +" → "Blueprint"
2. Connect repository: `99proteam/autocommenter`
3. Render will detect `render.yaml` automatically
4. Click "Apply"
5. Wait for deployment (~10-15 minutes first time)

### Step 3: Done! 🎉
Your app will be live at: `https://autocommenter.onrender.com`

---

## **What Gets Deployed**

✅ Next.js web application  
✅ Playwright automation (forms & comments)  
✅ PostgreSQL database (auto-provisioned)  
✅ All dependencies installed  
✅ Browsers installed (Chromium)  

**Everything works out of the box!**

---

## **After Deployment**

### Update Environment Variables (Optional)
1. Go to Dashboard → autocommenter → Environment
2. Update:
   - `SUBMISSION_NAME` = Your company name
   - `SUBMISSION_EMAIL` = Your email
   - `SUBMISSION_MESSAGE` = Your message template

### Access Your App
- **URL:** `https://autocommenter.onrender.com`
- **Test Page:** `https://autocommenter.onrender.com/test`

---

## **Free Tier Limitations**

⚠️ **Cold Starts:** Spins down after 15 min inactivity  
⚠️ **RAM:** 512 MB (enough for light use)  
⚠️ **Hours:** 750/month free  

**Upgrade to [$7/month](https://render.com/pricing) for:**
- Always-on service
- No cold starts
- Better performance

---

## **Testing the Deployment**

1. Visit your Render URL
2. Click "New Campaign"
3. Upload a domains.txt file (1-3 domains for testing)
4. Select "Manual" processing
5. Click "Manual Process" button
6. Watch it work! ✨

---

## **Troubleshooting**

### Build Fails?
- Check Render logs in Dashboard
- Most common: Database connection issue
- Solution: Wait for database to finish provisioning

### Playwright Errors?
- Render installs browsers automatically
- If issues, check Dockerfile logs
- Chromium should install during build

### Slow Performance?
- Normal on free tier after cold start
- First request: ~30 seconds
- Subsequent: fast
- Upgrade to paid plan for always-on

---

## **Architecture**

```
Render Web Service (Docker Container)
├── Next.js App (Port 3000)
├── Playwright Chromium Browser
├── API Routes
├── Queue Processor
└── Connected to PostgreSQL Database
```

**Single container, everything included!**

---

## **Costs**

| Plan | Price | RAM | Always On |
|------|-------|-----|-----------|
| Free | $0 | 512MB | No (15min timeout) |
| Starter | $7/mo | 512MB | Yes |
| Standard | $25/mo | 2GB | Yes |

**Recommendation:** Start with free tier, upgrade if you need it.

---

## **Ready to Deploy?**

1. Go to https://render.com/deploy
2. Connect your `99proteam/autocommenter` repo
3. Click "Apply Blueprint"
4. Wait ~10 minutes
5. Your app is LIVE!

**That's it!** 🚀

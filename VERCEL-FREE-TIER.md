# Vercel Free Tier Configuration

## Cron Job Limitation

Vercel **Hobby (Free)** plan only allows **daily** cron jobs, not frequent intervals.

### Current Setup (Free Tier Compatible)

✅ **Cron Schedule:** Once daily at midnight (00:00 UTC)
- Schedule: `0 0 * * *`
- Runs: Every day at midnight
- Processes all pending campaigns automatically

### How to Use on Free Tier

#### Option 1: Daily Automatic Processing (Current Setup)
- Campaigns run automatically once per day
- Good for non-urgent campaigns
- No manual intervention needed

#### Option 2: Manual Processing (Recommended)
Since you can't run cron every 5 minutes on free tier, use **Manual Mode**:

1. **Create campaigns in "Manual" mode**
2. **Click "Manual Process"** button whenever you want to run
3. **Process on-demand** - full control
4. **No cron limitations!**

### Manual Processing Button Locations

- **Dashboard:** Click "🚀 Manual Process" button
- **Campaign Details:** Process individual campaign
- **API Endpoint:** `POST /api/process/manual`

### Upgrade to Pro for More Frequent Cron

If you need automatic processing more than once per day:

**Vercel Pro Plan ($20/month)**
- ✓ Cron jobs can run every minute
- ✓ Longer function execution time (300s vs 60s)
- ✓ More bandwidth and features

### Alternative: External Cron Service (Free)

Use external services to trigger your API:

1. **GitHub Actions** (Free)
   - Create workflow that calls `/api/cron/process-campaigns`
   - Runs every 5 minutes

2. **Cron-job.org** (Free)
   - Setup: https://cron-job.org
   - Configure to call: `https://your-app.vercel.app/api/cron/process-campaigns`
   - Set `CRON_SECRET` header for security

3. **EasyCron** (Free tier)
   - Similar to cron-job.org
   - More reliability

### Recommended Setup for Free Tier

**Best approach without upgrading:**

1. Set campaign mode to **"Manual"**
2. Use the **"Manual Process"** button in the dashboard
3. Or setup external cron service (GitHub Actions recommended)

This gives you full functionality without paying for Pro! 🎉

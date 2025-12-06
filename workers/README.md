# Queue Worker - Background Processing

## What is it?

The Queue Worker is a background process that continuously monitors and processes tasks from the database queue **without needing cron jobs**.

## How It Works

1. **Continuous Loop**: Runs indefinitely, checking for new tasks every 5 seconds
2. **Parallel Processing**: Processes up to 3 tasks simultaneously
3. **Auto-Restart**: Automatically picks up new tasks as they arrive
4. **Graceful Shutdown**: Handles termination signals cleanly

## Running Locally

### Terminal 1: Next.js App
```bash
npm run dev
```

### Terminal 2: Queue Worker
```bash
npm run worker
```

You'll see output like:
```
🚀 Queue Worker Started
⚙️  Poll Interval: 5000ms
⚙️  Batch Size: 3 parallel tasks
---
🔄 Worker loop starting...

✅ Processed 3 tasks (Total: 3)
✅ Processed 2 tasks (Total: 5)
```

## Deploying to Render

### Option 1: Background Worker (Recommended - Continuous Processing)

Add to `render.yaml`:

```yaml
services:
  # Main web service
  - type: web
    name: auto-submitter
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    
  # Background worker (processes queue continuously)
  - type: worker
    name: queue-worker
    env: node
    buildCommand: npm install
    startCommand: npm run worker
    
  # Database
  - type: pgsql
    name: auto-submitter-db
    databaseName: autosubmitter
    plan: free
```

**Cost:** $7/month for worker  
**Benefits:** 
- ✅ Continuous processing (no delays)
- ✅ Parallel task handling
- ✅ Auto-restarts on crash
- ✅ Real-time responsiveness

---

### Option 2: Cron Job (Free Alternative)

Add to `render.yaml`:

```yaml
services:
  # Main web service
  - type: web
    name: auto-submitter
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    
  # Cron job (runs every 5 minutes)
  - type: cron
    name: process-queue
    env: node
    schedule: "*/5 * * * *"
    buildCommand: npm install
    command: node -e "import('./lib/queue/processor.js').then(m => m.processQueue())"
    
  # Database
  - type: pgsql
    name: auto-submitter-db
    databaseName: autosubmitter
    plan: free
```

**Cost:** Free  
**Limitations:**
- ⚠️ Runs only every 5 minutes (not continuous)
- ⚠️ Single task at a time
- ⚠️ Up to 5-minute delay

---

## Worker Features

### Parallel Processing
```javascript
const BATCH_SIZE = 3 // Process 3 domains at once
```

Adjust in `workers/queue-worker.js` to process more/less simultaneously.

### Poll Interval
```javascript
const POLL_INTERVAL = 5000 // Check every 5 seconds
```

Lower for faster response, higher to reduce CPU usage.

### Stats Tracking
The worker tracks:
- ✅ Total tasks processed
- ❌ Total errors
- 📊 Current status

### Graceful Shutdown
Press `Ctrl+C` to stop:
```
⏹️  SIGINT received, shutting down gracefully...
📊 Final Stats: 42 processed, 2 errors
```

---

## Monitoring

### Check if Worker is Running
```bash
# Render dashboard shows worker status
# Locally: Check if process is running
ps aux | grep queue-worker
```

###View Logs
```bash
# Render dashboard → Workers → Logs
# Locally: stdout in terminal
```

---

## Troubleshooting

### Worker Not Processing

**Check:**
1. Worker is running (`npm run worker`)
2. Database connected (`DATABASE_URL` set)
3. Tasks in queue (check Prisma Studio)

### Memory Issues

Reduce batch size in `workers/queue-worker.js`:
```javascript
const BATCH_SIZE = 1 // Process one at a time
```

### Too Slow

Increase batch size:
```javascript
const BATCH_SIZE = 5 // Process 5 simultaneously
```

---

## Comparison

| Feature | Background Worker | Cron Job |
|---------|------------------|----------|
| **Cost** | $7/month | Free |
| **Speed** | Immediate | Up to 5min delay |
| **Parallel** | Yes (3 tasks) | No |
| **Continuous** | Yes | No |
| **Best For** | Production | Testing/Budget |

---

## Recommendation

**For Testing:** Use Cron Job (free)  
**For Production:** Use Background Worker ($7/month)

The continuous worker is much better for user experience - tasks start immediately instead of waiting up to 5 minutes.

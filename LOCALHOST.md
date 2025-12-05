# 🚀 Localhost Testing Guide

## Quick Setup for Local Testing

### Option 1: Using Free Online PostgreSQL (Easiest - No Installation)

1. **Get Free Database from Vercel:**
   - Go to https://vercel.com/dashboard
   - Create new project (or use existing)
   - Go to Storage tab
   - Click "Create Database" → Choose "Postgres"
   - Copy the connection strings

2. **Create `.env.local` file** in the project root:
   ```bash
   # In: c:\Users\digit\Downloads\auto submitter\.env.local
   
   # Paste your Vercel Postgres URLs here
   DATABASE_URL="postgres://..."
   
   # Your submission details
   SUBMISSION_NAME="Test Company"
   SUBMISSION_EMAIL="test@example.com"
   SUBMISSION_MESSAGE="Hi, this is a test message."
   
   # Settings for testing
   MAX_PAGES_DEFAULT=5
   CRAWL_DELAY_MS=1000
   ```

3. **Setup database and run:**
   ```bash
   npm run db:push
   npm run dev
   ```

4. **Access at:** http://localhost:3000

---

### Option 2: Using Local PostgreSQL (If You Have It Installed)

1. **Install PostgreSQL** (if not installed):
   - Download from https://www.postgresql.org/download/windows/
   - Or use Docker: `docker run -p 5432:5432 -e POSTGRES_PASSWORD=password postgres`

2. **Create database:**
   ```bash
   # If using psql command
   createdb autosubmitter
   ```

3. **Create `.env.local` file:**
   ```bash
   DATABASE_URL="postgresql://postgres:password@localhost:5432/autosubmitter"
   SUBMISSION_NAME="Test Company"
   SUBMISSION_EMAIL="test@example.com"
   SUBMISSION_MESSAGE="Hi, this is a test message."
   MAX_PAGES_DEFAULT=5
   ```

4. **Setup and run:**
   ```bash
   npm run db:push
   npm run dev
   ```

5. **Access at:** http://localhost:3000

---

### Option 3: Skip Database Setup (Test UI Only)

If you just want to see the UI without database:

1. **Create minimal `.env.local`:**
   ```bash
   DATABASE_URL="postgresql://temp:temp@localhost:5432/temp"
   SUBMISSION_NAME="Test"
   SUBMISSION_EMAIL="test@example.com"
   SUBMISSION_MESSAGE="Test message"
   ```

2. **Run dev server:**
   ```bash
   npm run dev
   ```

3. **Access at:** http://localhost:3000
   - UI will load
   - Database operations will fail (expected)
   - You can see the design and layout

---

## What Port and URL?

**Your app runs on:**
- **URL:** http://localhost:3000
- **Port:** 3000 (default Next.js port)

To change port:
```bash
npm run dev -- -p 3001
```

---

## Testing Workflow

Once running on localhost:3000:

1. **Dashboard** - View at http://localhost:3000
2. **Create Campaign** - Click "New Campaign" button
3. **Upload Domains** - Create domains.txt:
   ```
   example.com
   github.com
   ```
4. **Configure Settings** - Set name, email, message
5. **Manual Process** - Click "Manual Process" to test
6. **View Results** - Check campaign details page

---

## Troubleshooting

**Port already in use:**
```bash
# Kill process on port 3000
npx kill-port 3000
# Or use different port
npm run dev -- -p 3001
```

**Database connection error:**
- Check DATABASE_URL in .env.local
- Ensure PostgreSQL is running
- Or use Vercel's free database (Option 1)

**Prisma errors:**
```bash
npx prisma generate
npx prisma db push
```

---

## Recommended: Use Vercel Free Database

**Easiest way to test:**
1. Sign up at vercel.com (free)
2. Create Postgres database (free tier)
3. Copy connection string
4. Paste in .env.local
5. Run `npm run db:push`
6. Start testing!

No local PostgreSQL installation needed! ✨

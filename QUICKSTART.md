# Quick Start Guide

## Local Development Setup

1. **Copy environment template**
   ```bash
   cp .env.example .env.local
   ```

2. **Edit .env.local with your values:**
   ```env
   # Local PostgreSQL
   DATABASE_URL="postgresql://user:password@localhost:5432/autosubmitter"
   
   # Your submission details
   SUBMISSION_NAME="Your Company"
   SUBMISSION_EMAIL="contact@company.com"
   SUBMISSION_MESSAGE="Your default message..."
   
   # Optional
   NEXT_PUBLIC_DEFAULT_NAME="Your Name"
   NEXT_PUBLIC_DEFAULT_EMAIL="your@email.com"
   ```

3. **Setup database**
   ```bash
   npm run db:push
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open browser**
   Navigate to http://localhost:3000

## Vercel Deployment (Production)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Deploy to Vercel**
   - Visit vercel.com
   - Import your GitHub repository
   - Vercel auto-provisions everything!

3. **Add Environment Variables in Vercel Dashboard**
   - SUBMISSION_NAME
   - SUBMISSION_EMAIL
   - SUBMISSION_MESSAGE
   - CRON_SECRET (optional)

That's it! Your system is live and ready to use! 🚀

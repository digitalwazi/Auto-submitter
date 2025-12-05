# Auto Submitter

Automated Form and Comment Submission System with Campaign Management

## Features

- 🤖 **Automated Submission**: Automatically fills and submits contact forms and comment sections
- 🔍 **Smart Discovery**: Crawls websites using robots.txt and sitemaps
- 📊 **Campaign Management**: Create, pause, resume, and monitor campaigns
- ⏰ **Dual Processing**: Manual triggers or automatic cron jobs
- 📧 **Contact Extraction**: Automatically extracts emails and phone numbers
- 📥 **Excel Export**: Download comprehensive reports with all data
- 🚀 **Playwright Automation**: Advanced browser automation for reliable submissions
- 💾 **PostgreSQL Database**: Campaign data and results storage
- 🎯 **Real-time Progress**: Live dashboard with campaign statistics

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Vercel Postgres + Prisma ORM
- **Automation**: Playwright
- **Storage**: Vercel Blob
- **Styling**: Tailwind CSS + Custom CSS
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Vercel account (for deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd auto-submitter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

4. **Setup database**
   ```bash
   npm run db:push
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

6. **Open browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Deployment to Vercel

### Automatic Setup

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will automatically:
     - Detect Next.js
     - Install dependencies
     - Create Postgres database
     - Create Blob storage
     - Setup cron jobs
     - Deploy your application

3. **Environment Variables**
   The following are auto-provisioned by Vercel:
   - `DATABASE_URL`
   - `POSTGRES_PRISMA_URL`
   - `POSTGRES_URL_NON_POOLING`
   - `BLOB_READ_WRITE_TOKEN`

   You only need to add:
   - `SUBMISSION_NAME` - Your name for form submissions
   - `SUBMISSION_EMAIL` - Your email for form submissions
   - `SUBMISSION_MESSAGE` - Default message template
   - `CRON_SECRET` - (Optional) Secret for cron job authentication

4. **Database Migration**
   The `vercel-build` script automatically runs `prisma db push` during deployment

## Usage

### Creating a Campaign

1. Click "New Campaign" on the dashboard
2. Fill in campaign details:
   - Name
   - Processing mode (Manual or Cron)
   - Max pages per domain
   - Submission types (forms/comments)
   - Your contact information
   - Message template
3. Upload a .txt file with domains (one per line)
4. Click "Create Campaign"

### Managing Campaigns

- **Start**: Begin processing domains
- **Pause**: Temporarily stop processing
- **Resume**: Continue paused campaign
- **Stop**: Permanently stop campaign
- **Delete**: Remove campaign and all data

### Manual Processing

Click "Manual Process" on the dashboard to trigger immediate processing of pending tasks.

### Cron Jobs

If campaign is set to "Cron" mode, it will automatically process every 5 minutes via Vercel Cron.

### Exporting Data

Click "Export to Excel" on campaign details page to download a comprehensive report with:
- Campaign summary
- Domain list
- Discovered pages
- Extracted contacts
- Submission logs

## Project Structure

```
auto-submitter/
├── app/
│   ├── api/
│   │   ├── campaigns/        # Campaign CRUD
│   │   ├── upload/           # Domain file upload
│   │   ├── export/           # Excel export
│   │   ├── cron/            # Cron job endpoint
│   │   └── process/         # Manual processing
│   ├── campaigns/
│   │   ├── create/          # Campaign creation
│   │   └── [id]/           # Campaign details
│   ├── page.jsx            # Dashboard
│   ├── layout.jsx          # Root layout
│   └── globals.css         # Global styles
├── components/
│   └── CampaignCard.jsx    # Campaign card component
├── lib/
│   ├── automation/         # Playwright automation
│   ├── crawler/           # Web crawling logic
│   ├── queue/            # Background processing
│   └── utils/           # Utilities
├── prisma/
│   └── schema.prisma     # Database schema
├── vercel.json          # Vercel configuration
└── package.json
```

## Configuration

### Max Pages Per Domain
Control how many pages to crawl per domain (default: 50, max: 500)

### Submission Types
Choose to submit:
- Contact forms only
- Comments only
- Both

### Processing Mode
- **Manual**: Trigger processing on-demand
- **Cron**: Automatic processing every 5 minutes

## Troubleshooting

### Playwright Issues on Vercel

Playwright has size limitations on Vercel serverless functions. For heavy automation:
1. Consider using external worker service (Railway, Render)
2. Or use lighter alternative like puppeteer-core

### Cron Job Not Running

- Ensure campaign status is "RUNNING"
- Check Vercel cron logs in dashboard
- Verify `CRON_SECRET` matches in environment

### Database Connection Issues

- Ensure environment variables are set correctly
- Run `npm run db:generate` after schema changes
- Use `npm run db:studio` to inspect database

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.

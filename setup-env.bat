@echo off
echo ========================================
echo   Auto Submitter - Environment Setup
echo ========================================
echo.
echo You need to create a .env.local file with your database URL.
echo.
echo OPTION 1: Free Online Database (Easiest)
echo -----------------------------------------
echo 1. Go to https://neon.tech (free, no credit card)
echo 2. Sign up and create a project
echo 3. Copy the connection string (looks like: postgresql://user:pass@host/db)
echo 4. Paste it below
echo.
echo OPTION 2: Vercel Postgres
echo -------------------------
echo 1. Go to https://vercel.com/dashboard
echo 2. Create Storage -^> Postgres Database
echo 3. Copy DATABASE_URL
echo 4. Paste it below
echo.
echo ========================================
echo.
set /p DB_URL="Enter your DATABASE_URL (or press Enter to skip): "

if "%DB_URL%"=="" (
    echo.
    echo Creating .env.local with placeholder...
    echo DATABASE_URL="postgresql://placeholder" > .env.local
    echo SUBMISSION_NAME="Test Company" >> .env.local
    echo SUBMISSION_EMAIL="test@example.com" >> .env.local
    echo SUBMISSION_MESSAGE="Hi, this is a test message from our automation system." >> .env.local
    echo MAX_PAGES_DEFAULT=10 >> .env.local
    echo.
    echo ⚠ Placeholder created! Replace it with real database URL.
    echo.
) else (
    echo.
    echo Creating .env.local with your database...
    echo DATABASE_URL="%DB_URL%" > .env.local
    echo SUBMISSION_NAME="Test Company" >> .env.local
    echo SUBMISSION_EMAIL="test@example.com" >> .env.local
    echo SUBMISSION_MESSAGE="Hi, this is a test message from our automation system." >> .env.local
    echo MAX_PAGES_DEFAULT=10 >> .env.local
    echo.
    echo ✓ .env.local created successfully!
    echo.
    echo Now running database setup...
    echo.
    call npm run db:push
)

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Restart the dev server (Ctrl+C then npm run dev)
echo 2. Refresh your browser at http://localhost:3000
echo.
pause

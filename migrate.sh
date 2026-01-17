#!/bin/bash
set -e

echo "🚀 Starting migration to Supabase..."

# 1. Update .env
# Remove existing DATABASE_URL
sed -i '/DATABASE_URL/d' .env
# Add new one
echo 'DATABASE_URL="postgresql://postgres:Wazi123%40123123@db.wecqtsodwjjkhqqpvlow.supabase.co:5432/postgres"' >> .env
echo "✅ Updated .env"

# 2. Update schema.prisma
# Change provider to postgresql
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
# Change url to env(DATABASE_URL) if it was hardcoded (just in case)
sed -i 's/url      = "file:.\/dev.db"/url      = env("DATABASE_URL")/' prisma/schema.prisma
echo "✅ Updated prisma/schema.prisma"

# 3. Clean environment
echo "🧹 Cleaning previous build..."
rm -rf node_modules/.prisma
rm -rf .next
rm -rf node_modules/@prisma/client

# 4. Generate & Push
echo "🔄 Generating Prisma Client..."
npx prisma generate

echo "☁️ Pushing DB Schema to Supabase..."
npx prisma db push

# 5. Build & Restart
echo "🏗️ Building Next.js..."
npm run build

echo "♻️ Restarting Server..."
pkill -f 'next' || true
nohup npm run start > app.log 2>&1 &

echo "✨ Migration Complete! Server is restarting."

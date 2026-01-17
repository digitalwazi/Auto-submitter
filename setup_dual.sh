#!/bin/bash
set -e

echo "🛠️ Setting up Dual Database (SQLite + Supabase)..."

# 1. Add SUPABASE_URL to .env
if ! grep -q "SUPABASE_URL" .env; then
  echo 'SUPABASE_URL="postgresql://postgres:Wazi123%40123123@db.wecqtsodwjjkhqqpvlow.supabase.co:5432/postgres"' >> .env
  echo "✅ Added SUPABASE_URL"
else 
  # Ensure it matches
  sed -i '/SUPABASE_URL/d' .env
  echo 'SUPABASE_URL="postgresql://postgres:Wazi123%40123123@db.wecqtsodwjjkhqqpvlow.supabase.co:5432/postgres"' >> .env
  echo "✅ Updated SUPABASE_URL"
fi

# 2. Create schema.postgres.prisma
cp prisma/schema.prisma prisma/schema.postgres.prisma

# modify datasource
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.postgres.prisma
sed -i 's/url      = "file:.\/dev.db"/url      = env("SUPABASE_URL")/' prisma/schema.postgres.prisma

# modify generator to output to custom path
# We use perl for multi-line find/replace simply or just append/modify
# Actually, default generator block is:
# generator client {
#   provider = "prisma-client-js"
# }
# We want to add output = ...
sed -i 's/provider = "prisma-client-js"/provider = "prisma-client-js"\n  output   = "..\/node_modules\/@prisma\/client-pg"/' prisma/schema.postgres.prisma

echo "✅ Created separate postgres schema"

# 3. Generate Clients
echo "🔄 Generating Main Client (SQLite)..."
npx prisma generate --schema prisma/schema.prisma

echo "🔄 Generating Supabase Client (Postgres)..."
npx prisma generate --schema prisma/schema.postgres.prisma

echo "✅ Dual configuration ready."

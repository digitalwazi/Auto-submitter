#!/bin/bash
set -e

echo "🔙 Reverting to SQLite (Restoring Data)..."

# 1. Update .env
# Remove DATABASE_URL (Postgres)
sed -i '/DATABASE_URL/d' .env
# Add SQLite URL if missing
if ! grep -q "file:./dev.db" .env; then
  echo 'DATABASE_URL="file:./dev.db"' >> .env
fi
echo "✅ Restored .env"

# 2. Update schema.prisma
sed -i 's/provider = "postgresql"/provider = "sqlite"/' prisma/schema.prisma
sed -i 's/url      = env("DATABASE_URL")/url      = "file:.\/dev.db"/' prisma/schema.prisma
echo "✅ Restored prisma/schema.prisma"

# 3. Clean and Regenerate
rm -rf node_modules/.prisma
rm -rf node_modules/@prisma/client
npx prisma generate

# 4. Restart
pkill -f 'next' || true
nohup npm run start > app.log 2>&1 &

echo "✅ System Reverted. Your campaigns should be back."

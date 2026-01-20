import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

// Default SQLite Client
export const prisma = globalForPrisma.prisma ?? new PrismaClient()

// Enable WAL mode for better concurrency with SQLite
if (process.env.NODE_ENV !== 'test') {
    prisma.$queryRaw`PRAGMA journal_mode = WAL;`.catch(console.error)
}

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}

// Default export is SQLite for backward compatibility
export default prisma

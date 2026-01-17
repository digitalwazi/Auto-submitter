import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

// Default SQLite Client
export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}

// Default export is SQLite for backward compatibility
export default prisma

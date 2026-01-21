import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

// Default SQLite Client
export const prisma = globalForPrisma.prisma ?? new PrismaClient()

// Enable WAL mode for better concurrency with SQLite
if (process.env.NODE_ENV !== 'test') {
    prisma.$queryRaw`PRAGMA journal_mode = WAL;`.catch(() => { })
}

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}

// === Supabase/PostgreSQL Client ===
let prismaSupabaseInstance = null

export function getPrismaSupabase() {
    if (!process.env.SUPABASE_URL) {
        console.warn('SUPABASE_URL not set. Supabase client unavailable.')
        return null
    }

    if (!prismaSupabaseInstance) {
        try {
            // Dynamic import to avoid errors when client-pg is not generated
            const { PrismaClient: PrismaClientPg } = require('@prisma/client-pg')
            prismaSupabaseInstance = new PrismaClientPg()
            console.log('✅ Supabase Prisma client initialized')
        } catch (e) {
            console.error('❌ Failed to initialize Supabase client:', e.message)
            return null
        }
    }
    return prismaSupabaseInstance
}

// Helper to get the correct client based on storageType
export function getDbClient(storageType = 'sqlite') {
    if (storageType === 'supabase') {
        const supabase = getPrismaSupabase()
        if (supabase) return supabase
        console.warn('Supabase unavailable, falling back to SQLite')
    }
    return prisma
}

// Default export is SQLite for backward compatibility
export default prisma

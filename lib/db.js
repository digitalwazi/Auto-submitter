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
let supabaseInitPromise = null

export async function getPrismaSupabaseAsync() {
    if (!process.env.SUPABASE_URL) {
        return null
    }

    if (prismaSupabaseInstance) {
        return prismaSupabaseInstance
    }

    if (supabaseInitPromise) {
        return supabaseInitPromise
    }

    supabaseInitPromise = (async () => {
        try {
            // Use dynamic ESM import (not require) to work in both ESM and CJS contexts
            const clientPg = await import('@prisma/client-pg')
            prismaSupabaseInstance = new clientPg.PrismaClient()
            console.log('✅ Supabase Prisma client initialized')
            return prismaSupabaseInstance
        } catch (e) {
            console.error('❌ Failed to initialize Supabase client:', e.message)
            supabaseInitPromise = null
            return null
        }
    })()

    return supabaseInitPromise
}

// Synchronous getter - returns cached instance or null
export function getPrismaSupabase() {
    if (!process.env.SUPABASE_URL) {
        return null
    }
    // Return cached instance if available
    if (prismaSupabaseInstance) {
        return prismaSupabaseInstance
    }
    // Trigger async initialization but return null for now
    getPrismaSupabaseAsync().catch(() => { })
    return null
}

// Helper to get the correct client based on storageType
export function getDbClient(storageType = 'sqlite') {
    if (storageType === 'supabase') {
        const supabase = getPrismaSupabase()
        if (supabase) return supabase
        // For now, fall back to SQLite if Supabase not ready
        console.warn('Supabase unavailable (init pending), falling back to SQLite')
    }
    return prisma
}

// Async version that waits for Supabase to initialize
export async function getDbClientAsync(storageType = 'sqlite') {
    if (storageType === 'supabase') {
        const supabase = await getPrismaSupabaseAsync()
        if (supabase) return supabase
        console.warn('Supabase unavailable, falling back to SQLite')
    }
    return prisma
}

// Default export is SQLite for backward compatibility
export default prisma

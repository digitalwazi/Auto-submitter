import { PrismaClient } from '@prisma/client'
// Import the custom generated Supabase client
// Note: We use dynamic require or standard import. Standard import works if generation succeeded.
import { PrismaClient as PrismaClientPg } from '@prisma/client-pg'

const globalForPrisma = globalThis

// Default SQLite Client
export const prisma = globalForPrisma.prisma ?? new PrismaClient()

// Supabase Client
// We check if it exists in global to prevent exhaustion
export const prismaSupabase = globalForPrisma.prismaSupabase ?? new PrismaClientPg()

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
    globalForPrisma.prismaSupabase = prismaSupabase
}

// Default export is SQLite for backward compatibility
export default prisma

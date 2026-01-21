import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const ENV_FILE_PATH = path.join(process.cwd(), '.env')

// GET - Read current Supabase URL (masked for security)
export async function GET() {
    try {
        const envContent = await fs.readFile(ENV_FILE_PATH, 'utf-8')
        const lines = envContent.split('\n')

        let supabaseUrl = ''
        for (const line of lines) {
            if (line.startsWith('SUPABASE_URL=')) {
                supabaseUrl = line.replace('SUPABASE_URL=', '').replace(/"/g, '').trim()
                break
            }
        }

        // Mask the password in the URL for security
        let maskedUrl = ''
        if (supabaseUrl) {
            try {
                const url = new URL(supabaseUrl)
                if (url.password) {
                    url.password = '********'
                }
                maskedUrl = url.toString()
            } catch {
                maskedUrl = supabaseUrl.replace(/:([^@]+)@/, ':********@')
            }
        }

        return NextResponse.json({
            success: true,
            configured: !!supabaseUrl,
            url: maskedUrl
        })
    } catch (error) {
        return NextResponse.json({
            success: false,
            configured: false,
            error: error.message
        })
    }
}

// POST - Update Supabase URL
export async function POST(request) {
    try {
        const { supabaseUrl } = await request.json()

        if (!supabaseUrl) {
            return NextResponse.json({
                success: false,
                error: 'Supabase URL is required'
            }, { status: 400 })
        }

        // Validate URL format
        try {
            new URL(supabaseUrl)
        } catch {
            return NextResponse.json({
                success: false,
                error: 'Invalid URL format'
            }, { status: 400 })
        }

        // Read existing .env file
        let envContent = ''
        try {
            envContent = await fs.readFile(ENV_FILE_PATH, 'utf-8')
        } catch {
            envContent = ''
        }

        // Update or add SUPABASE_URL
        const lines = envContent.split('\n')
        let found = false
        const newLines = lines.map(line => {
            if (line.startsWith('SUPABASE_URL=')) {
                found = true
                return `SUPABASE_URL="${supabaseUrl}"`
            }
            return line
        })

        if (!found) {
            newLines.push(`SUPABASE_URL="${supabaseUrl}"`)
        }

        await fs.writeFile(ENV_FILE_PATH, newLines.join('\n'))

        return NextResponse.json({
            success: true,
            message: 'Supabase URL updated. Restart PM2 to apply changes.'
        })
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}

// PUT - Test Supabase connection
export async function PUT() {
    try {
        const { getPrismaSupabaseAsync } = await import('@/lib/db')
        const supabase = await getPrismaSupabaseAsync()

        if (!supabase) {
            return NextResponse.json({
                success: false,
                connected: false,
                error: 'Supabase client not available. Check SUPABASE_URL in .env'
            })
        }

        // Try a simple query to test connection
        const result = await supabase.$queryRaw`SELECT 1 as test`

        return NextResponse.json({
            success: true,
            connected: true,
            message: 'Supabase connection successful!'
        })
    } catch (error) {
        return NextResponse.json({
            success: false,
            connected: false,
            error: `Connection failed: ${error.message}`
        })
    }
}

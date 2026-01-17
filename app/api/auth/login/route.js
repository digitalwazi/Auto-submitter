import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request) {
    try {
        const body = await request.json()
        const { password } = body

        // The requested password
        const CORRECT_PASSWORD = '900912'

        if (password === CORRECT_PASSWORD) {
            // Set a cookie (httpOnly for security)
            // Since it's a simple script, we set it for 7 days
            const extraOptions = {
                secure: false, // process.env.NODE_ENV === 'production', // Disabled for now to support HTTP IP access
                sameSite: 'strict',
                path: '/',
                maxAge: 60 * 60 * 24 * 7, // 7 days
            }

            const cookieStore = await cookies()
            cookieStore.set('auth', 'true', extraOptions)

            return NextResponse.json({ success: true })
        } else {
            return NextResponse.json({ success: false, message: 'Invalid password' }, { status: 401 })
        }
    } catch (error) {
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
    }
}

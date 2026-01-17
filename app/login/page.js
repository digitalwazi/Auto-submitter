'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password }),
            })

            const data = await res.json()

            if (res.ok && data.success) {
                // Force refresh to update middleware state
                router.refresh()
                router.push('/')
            } else {
                setError('Incorrect password')
            }
        } catch (err) {
            setError('An error occurred. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
            <div className="max-w-md w-full p-8 bg-gray-800 rounded-lg shadow-lg border border-gray-700">
                <h1 className="text-3xl font-bold text-center mb-2">Access Restricted</h1>
                <p className="text-gray-400 text-center mb-8">Please enter the password to view the dashboard.</p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none text-white placeholder-gray-400 transition"
                            placeholder="Enter password..."
                            required
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-900/50 border border-red-700 text-red-200 rounded text-sm text-center">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded font-medium text-white transition duration-200 ${loading ? 'opacity-70 cursor-not-allowed' : ''
                            }`}
                    >
                        {loading ? 'Verifying...' : 'Unlock System'}
                    </button>
                </form>
            </div>
        </div>
    )
}

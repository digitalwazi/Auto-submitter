'use client'

import { useState } from 'react'

export default function TestPage() {
    const [url, setUrl] = useState('')
    const [maxPages, setMaxPages] = useState(5)
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState(null)

    const handleTest = async () => {
        setLoading(true)
        setResults(null)

        try {
            const response = await fetch('/api/test/crawl', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, maxPages }),
            })

            const data = await response.json()
            setResults(data)
        } catch (error) {
            setResults({ error: error.message })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold gradient-text mb-4">
                    🧪 Test Mode - No Database Required
                </h1>
                <p className="text-gray-400 mb-8">
                    Test the crawler, form detection, and contact extraction WITHOUT saving anything to database
                </p>

                {/* Test Form */}
                <div className="card mb-8">
                    <h2 className="text-xl font-bold mb-4">Test Website Crawler</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Website URL to Test
                            </label>
                            <input
                                type="url"
                                className="input"
                                placeholder="https://example.com"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Max Pages to Crawl
                            </label>
                            <input
                                type="number"
                                className="input"
                                min="1"
                                max="10"
                                value={maxPages}
                                onChange={(e) => setMaxPages(parseInt(e.target.value))}
                            />
                        </div>

                        <button
                            onClick={handleTest}
                            disabled={!url || loading}
                            className="btn-primary w-full"
                        >
                            {loading ? '🔄 Testing...' : '🚀 Test Now (No Database)'}
                        </button>
                    </div>
                </div>

                {/* Results */}
                {loading && (
                    <div className="card text-center py-12">
                        <div className="animate-spin h-12 w-12 border-4 border-gray-700 border-t-indigo-500 rounded-full mx-auto mb-4"></div>
                        <p className="text-gray-400">Crawling website and detecting forms...</p>
                    </div>
                )}

                {results && !loading && (
                    <div className="space-y-6">
                        {results.error && (
                            <div className="card bg-red-900/20 border-red-500">
                                <h3 className="text-lg font-bold text-red-400 mb-2">Error</h3>
                                <p className="text-red-300">{results.error}</p>
                            </div>
                        )}

                        {results.domainAnalysis && (
                            <div className="card">
                                <h3 className="text-lg font-bold mb-4">📋 Domain Analysis</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-400">Has robots.txt</p>
                                        <p className="font-bold">{results.domainAnalysis.robotsTxt ? '✓ Yes' : '✗ No'}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400">Sitemaps Found</p>
                                        <p className="font-bold">{results.domainAnalysis.sitemaps?.length || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400">URLs from Sitemaps</p>
                                        <p className="font-bold">{results.domainAnalysis.urls?.length || 0}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {results.pages && results.pages.length > 0 && (
                            <div className="card">
                                <h3 className="text-lg font-bold mb-4">
                                    📄 Discovered Pages ({results.pages.length})
                                </h3>
                                <div className="space-y-3">
                                    {results.pages.map((page, idx) => (
                                        <div key={idx} className="p-3 bg-gray-900/50 rounded-lg">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{page.title || 'Untitled'}</p>
                                                    <a href={page.url} target="_blank" rel="noopener" className="text-xs text-indigo-400 hover:underline">
                                                        {page.url}
                                                    </a>
                                                </div>
                                                <div className="flex gap-2">
                                                    {page.hasForm && <span className="text-xs px-2 py-1 bg-green-900/30 text-green-400 rounded">✓ Form</span>}
                                                    {page.hasComments && <span className="text-xs px-2 py-1 bg-purple-900/30 text-purple-400 rounded">✓ Comments</span>}
                                                </div>
                                            </div>

                                            {page.forms && page.forms.length > 0 && (
                                                <div className="mt-2 p-2 bg-gray-800/50 rounded text-xs">
                                                    <p className="text-gray-400 mb-1">Form Fields ({page.forms[0].fields.length}):</p>
                                                    <div className="flex gap-2 flex-wrap">
                                                        {page.forms[0].fields.slice(0, 5).map((field, i) => (
                                                            <span key={i} className="px-2 py-1 bg-gray-700 rounded">
                                                                {field.name || field.id}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {page.contacts && (page.contacts.email || page.contacts.phone) && (
                                                <div className="mt-2 p-2 bg-blue-900/20 rounded text-xs">
                                                    <p className="text-blue-400 font-medium">Contacts Found:</p>
                                                    {page.contacts.email && <p className="text-gray-300">📧 {page.contacts.email}</p>}
                                                    {page.contacts.phone && <p className="text-gray-300">📞 {page.contacts.phone}</p>}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {results.totalContacts > 0 && (
                            <div className="card bg-green-900/20 border-green-500">
                                <h3 className="text-lg font-bold text-green-400 mb-2">✓ Test Successful!</h3>
                                <p className="text-gray-300">Found {results.pagesWithForms} pages with forms, {results.pagesWithComments} with comments, and {results.totalContacts} contacts</p>
                                <p className="text-sm text-gray-400 mt-2">Everything is working! You can now deploy to production.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Instructions */}
                <div className="card bg-indigo-900/20 border-indigo-500 mt-8">
                    <h3 className="text-lg font-bold text-indigo-400 mb-2">ℹ️ How This Works</h3>
                    <ul className="text-sm text-gray-300 space-y-2">
                        <li>✓ Tests robots.txt parsing</li>
                        <li>✓ Tests sitemap discovery</li>
                        <li>✓ Tests page crawling (BFS algorithm)</li>
                        <li>✓ Tests form detection</li>
                        <li>✓ Tests comment section detection</li>
                        <li>✓ Tests email/phone extraction</li>
                        <li>✗ Does NOT save to database</li>
                        <li>✗ Does NOT submit forms (just detects them)</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}

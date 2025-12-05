'use client'

import { useState, useRef } from 'react'

export default function EnhancedTestPage() {
    const [file, setFile] = useState(null)
    const [running, setRunning] = useState(false)
    const [logs, setLogs] = useState([])
    const [results, setResults] = useState([])
    const [progress, setProgress] = useState({ current: 0, total: 0 })
    const [config, setConfig] = useState({
        mode: 'extract', // 'extract' or 'submit'
        maxPages: 10,
        extractForms: true,
        extractComments: true,
        extractEmails: true,
        extractPhones: true,
        detectTechnology: true,
        submitForms: false,
        submitComments: false,
        senderName: 'Test User',
        senderEmail: 'test@example.com',
        message: 'Hi, this is a test message.',
    })

    const addLog = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString()
        setLogs(prev => [...prev, { timestamp, message, type }])
    }

    const handleStart = async () => {
        if (!file) {
            alert('Please select a domains file')
            return
        }

        setRunning(true)
        setLogs([])
        setResults([])
        setProgress({ current: 0, total: 0 })

        try {
            addLog('🚀 Starting domain processing...', 'success')

            const formData = new FormData()
            formData.append('file', file)
            formData.append('config', JSON.stringify(config))

            const response = await fetch('/api/test/extract', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) throw new Error('Server error')

            const reader = response.body.getReader()
            const decoder = new TextDecoder()

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const text = decoder.decode(value)
                const lines = text.split('\n').filter(Boolean)

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6))

                        if (data.log) {
                            addLog(data.log.message, data.log.type)
                        }

                        if (data.progress) {
                            setProgress(data.progress)
                        }

                        if (data.result) {
                            setResults(prev => [...prev, data.result])
                        }
                    }
                }
            }

            addLog('✅ Processing completed!', 'success')
        } catch (error) {
            addLog(`❌ Error: ${error.message}`, 'error')
        } finally {
            setRunning(false)
        }
    }

    const handleExport = () => {
        if (results.length === 0) {
            alert('No results to export')
            return
        }

        // Create CSV
        const headers = ['Domain', 'Status', 'Technology', 'Forms Pages', 'Comments Pages', 'Emails', 'Phones', 'Total Pages']
        const rows = results.map(r => [
            r.domain,
            r.status,
            r.technology || 'Unknown',
            r.formPages?.length || 0,
            r.commentPages?.length || 0,
            r.emails?.length || 0,
            r.phones?.length || 0,
            r.totalPages || 0,
        ])

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n')

        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `extraction-${Date.now()}.csv`
        a.click()
        URL.revokeObjectURL(url)

        addLog('📥 CSV exported successfully!', 'success')
    }

    const handleExportDetailed = () => {
        if (results.length === 0) {
            alert('No results to export')
            return
        }

        // Create detailed CSV with all page URLs
        const rows = []

        results.forEach(r => {
            // Form pages
            r.formPages?.forEach(page => {
                rows.push([r.domain, 'Form', page, r.technology || 'Unknown'])
            })

            // Comment pages
            r.commentPages?.forEach(page => {
                rows.push([r.domain, 'Comment', page, r.technology || 'Unknown'])
            })

            // Contacts
            if (r.emails?.length || r.phones?.length) {
                rows.push([
                    r.domain,
                    'Contact',
                    `Emails: ${r.emails?.join('; ') || 'None'} | Phones: ${r.phones?.join('; ') || 'None'}`,
                    r.technology || 'Unknown'
                ])
            }
        })

        const csv = [
            ['Domain', 'Type', 'URL/Contact', 'Technology'].join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n')

        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `detailed-extraction-${Date.now()}.csv`
        a.click()
        URL.revokeObjectURL(url)

        addLog('📥 Detailed CSV exported successfully!', 'success')
    }

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-4xl font-bold gradient-text mb-4">
                    🔍 Mass Domain Extractor
                </h1>
                <p className="text-gray-400 mb-8">
                    Extract forms, comments, contacts & technology from thousands of domains
                </p>

                {/* Mode Selection */}
                <div className="card mb-6">
                    <h2 className="text-xl font-bold mb-4">Mode</h2>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setConfig({ ...config, mode: 'extract', submitForms: false, submitComments: false })}
                            className={`px-6 py-3 rounded-lg font-semibold ${config.mode === 'extract'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-400'
                                }`}
                        >
                            📊 Extract Only (Fast)
                        </button>
                        <button
                            onClick={() => setConfig({ ...config, mode: 'submit' })}
                            className={`px-6 py-3 rounded-lg font-semibold ${config.mode === 'submit'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-800 text-gray-400'
                                }`}
                        >
                            🚀 Extract + Submit
                        </button>
                    </div>
                </div>

                {/* File Upload & Settings */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    <div className="card">
                        <h2 className="text-xl font-bold mb-4">📁 Upload Domains</h2>
                        <input
                            type="file"
                            accept=".txt"
                            onChange={(e) => setFile(e.target.files[0])}
                            className="input mb-2"
                        />
                        <p className="text-sm text-gray-400">
                            Upload .txt file with domains (supports 25,000+ domains)
                        </p>
                    </div>

                    <div className="card">
                        <h2 className="text-xl font-bold mb-4">⚙️ Settings</h2>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={config.maxPages}
                                    onChange={(e) => setConfig({ ...config, maxPages: parseInt(e.target.value) })}
                                    className="input w-20"
                                />
                                <span className="text-sm">Max pages per domain</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Extraction Options */}
                <div className="card mb-6">
                    <h2 className="text-xl font-bold mb-4">🔍 Extract Options</h2>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={config.extractForms}
                                onChange={(e) => setConfig({ ...config, extractForms: e.target.checked })}
                            />
                            <span className="text-sm">📝 Forms</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={config.extractComments}
                                onChange={(e) => setConfig({ ...config, extractComments: e.target.checked })}
                            />
                            <span className="text-sm">💬 Comments</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={config.extractEmails}
                                onChange={(e) => setConfig({ ...config, extractEmails: e.target.checked })}
                            />
                            <span className="text-sm">📧 Emails</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={config.extractPhones}
                                onChange={(e) => setConfig({ ...config, extractPhones: e.target.checked })}
                            />
                            <span className="text-sm">📞 Phones</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={config.detectTechnology}
                                onChange={(e) => setConfig({ ...config, detectTechnology: e.target.checked })}
                            />
                            <span className="text-sm">🔧 Technology</span>
                        </label>
                    </div>
                </div>

                {/* Submission Options (if mode is submit) */}
                {config.mode === 'submit' && (
                    <div className="card mb-6">
                        <h2 className="text-xl font-bold mb-4">🚀 Submission Options</h2>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.submitForms}
                                    onChange={(e) => setConfig({ ...config, submitForms: e.target.checked })}
                                />
                                <span className="text-sm">Submit Forms</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.submitComments}
                                    onChange={(e) => setConfig({ ...config, submitComments: e.target.checked })}
                                />
                                <span className="text-sm">Submit Comments</span>
                            </label>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <input
                                type="text"
                                placeholder="Your Name"
                                value={config.senderName}
                                onChange={(e) => setConfig({ ...config, senderName: e.target.value })}
                                className="input"
                            />
                            <input
                                type="email"
                                placeholder="Your Email"
                                value={config.senderEmail}
                                onChange={(e) => setConfig({ ...config, senderEmail: e.target.value })}
                                className="input"
                            />
                            <input
                                type="text"
                                placeholder="Message"
                                value={config.message}
                                onChange={(e) => setConfig({ ...config, message: e.target.value })}
                                className="input"
                            />
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4 mb-6">
                    <button
                        onClick={handleStart}
                        disabled={!file || running}
                        className="btn-primary flex-1"
                    >
                        {running ? '⏳ Processing...' : '🚀 Start Processing'}
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={results.length === 0}
                        className="btn-secondary"
                    >
                        📥 Export Summary CSV
                    </button>
                    <button
                        onClick={handleExportDetailed}
                        disabled={results.length === 0}
                        className="btn-secondary"
                    >
                        📑 Export Detailed CSV
                    </button>
                </div>

                {/* Progress */}
                {progress.total > 0 && (
                    <div className="card mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold">Progress</span>
                            <span className="text-sm text-gray-400">
                                {progress.current} / {progress.total} domains
                            </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-4">
                            <div
                                className="bg-gradient-to-r from-blue-600 to-purple-600 h-4 rounded-full transition-all"
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Live Logs */}
                <div className="card mb-6">
                    <h2 className="text-xl font-bold mb-4">📋 Live Logs</h2>
                    <div className="bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
                        {logs.length === 0 ? (
                            <p className="text-gray-500">Waiting to start...</p>
                        ) : (
                            logs.map((log, idx) => (
                                <div key={idx} className={`mb-1 ${log.type === 'error' ? 'text-red-400' :
                                        log.type === 'success' ? 'text-green-400' :
                                            log.type === 'warning' ? 'text-yellow-400' :
                                                'text-gray-300'
                                    }`}>
                                    <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Results Table */}
                {results.length > 0 && (
                    <div className="card">
                        <h2 className="text-xl font-bold mb-4">📊 Results ({results.length} domains)</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-800">
                                        <th className="text-left p-2">Domain</th>
                                        <th className="text-left p-2">Technology</th>
                                        <th className="text-center p-2">Forms</th>
                                        <th className="text-center p-2">Comments</th>
                                        <th className="text-center p-2">Emails</th>
                                        <th className="text-center p-2">Phones</th>
                                        <th className="text-center p-2">Pages</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.slice(0, 50).map((result, idx) => (
                                        <tr key={idx} className="border-b border-gray-900 hover:bg-gray-900">
                                            <td className="p-2 text-sm">{result.domain}</td>
                                            <td className="p-2 text-sm">
                                                <span className="px-2 py-1 bg-blue-900 rounded text-xs">
                                                    {result.technology || 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="p-2 text-center">{result.formPages?.length || 0}</td>
                                            <td className="p-2 text-center">{result.commentPages?.length || 0}</td>
                                            <td className="p-2 text-center">{result.emails?.length || 0}</td>
                                            <td className="p-2 text-center">{result.phones?.length || 0}</td>
                                            <td className="p-2 text-center">{result.totalPages || 0}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {results.length > 50 && (
                                <p className="text-center text-gray-500 mt-4">
                                    Showing first 50 results. Export CSV to see all {results.length} domains.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

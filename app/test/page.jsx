'use client'

import { useState } from 'react'

export default function LiveTestPage() {
    const [file, setFile] = useState(null)
    const [running, setRunning] = useState(false)
    const [logs, setLogs] = useState([])
    const [results, setResults] = useState(null)
    const [config, setConfig] = useState({
        maxPages: 5,
        submitForms: true,
        submitComments: true,
        senderName: 'Test User',
        senderEmail: 'test@example.com',
        message: 'Hi, this is a test message from our automated system.',
    })

    const addLog = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString()
        setLogs(prev => [...prev, { timestamp, message, type }])
    }

    const handleSubmit = async () => {
        if (!file) {
            alert('Please select a domains file')
            return
        }

        setRunning(true)
        setLogs([])
        setResults(null)

        try {
            addLog('🚀 Starting automated submission test...', 'success')
            addLog(`📁 Reading file: ${file.name}`)

            const formData = new FormData()
            formData.append('file', file)
            formData.append('config', JSON.stringify(config))

            const response = await fetch('/api/test/submit', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                throw new Error('Server error')
            }

            // Stream the response
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

                        if (data.result) {
                            setResults(data.result)
                        }
                    }
                }
            }

            addLog('✅ Test completed!', 'success')
        } catch (error) {
            addLog(`❌ Error: ${error.message}`, 'error')
        } finally {
            setRunning(false)
        }
    }

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-4xl font-bold gradient-text mb-4">
                    🧪 Live Submission Test
                </h1>
                <p className="text-gray-400 mb-8">
                    Upload domains, configure settings, and watch form/comment submissions happen in real-time
                </p>

                {/* Configuration */}
                <div className="grid grid-cols-2 gap-6 mb-8">
                    <div className="card">
                        <h2 className="text-xl font-bold mb-4">Upload Domains</h2>
                        <input
                            type="file"
                            accept=".txt"
                            onChange={(e) => setFile(e.target.files[0])}
                            className="input"
                        />
                        <p className="text-sm text-gray-400 mt-2">
                            Upload a .txt file with one domain per line
                        </p>
                    </div>

                    <div className="card">
                        <h2 className="text-xl font-bold mb-4">Settings</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="text-sm text-gray-400">Max Pages per Domain</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={config.maxPages}
                                    onChange={(e) => setConfig({ ...config, maxPages: parseInt(e.target.value) })}
                                    className="input w-full"
                                />
                            </div>
                            <div className="flex gap-4">
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
                        </div>
                    </div>
                </div>

                {/* Sender Info */}
                <div className="card mb-8">
                    <h2 className="text-xl font-bold mb-4">Your Information</h2>
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
                        <button
                            onClick={handleSubmit}
                            disabled={!file || running}
                            className="btn-primary"
                        >
                            {running ? '⏳ Running...' : '🚀 Start Test'}
                        </button>
                    </div>
                    <textarea
                        placeholder="Your message..."
                        value={config.message}
                        onChange={(e) => setConfig({ ...config, message: e.target.value })}
                        className="input mt-4 h-24"
                    />
                </div>

                {/* Live Logs */}
                <div className="card mb-8">
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

                {/* Results Summary */}
                {results && (
                    <div className="card">
                        <h2 className="text-xl font-bold mb-4">📊 Results Summary</h2>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-gray-900 rounded-lg">
                                <p className="text-2xl font-bold text-blue-400">{results.domainsProcessed}</p>
                                <p className="text-sm text-gray-400">Domains</p>
                            </div>
                            <div className="text-center p-4 bg-gray-900 rounded-lg">
                                <p className="text-2xl font-bold text-green-400">{results.pagesFound}</p>
                                <p className="text-sm text-gray-400">Pages Found</p>
                            </div>
                            <div className="text-center p-4 bg-gray-900 rounded-lg">
                                <p className="text-2xl font-bold text-purple-400">{results.formsSubmitted}</p>
                                <p className="text-sm text-gray-400">Forms Submitted</p>
                            </div>
                            <div className="text-center p-4 bg-gray-900 rounded-lg">
                                <p className="text-2xl font-bold text-indigo-400">{results.commentsPosted}</p>
                                <p className="text-sm text-gray-400">Comments Posted</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

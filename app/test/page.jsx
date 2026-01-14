'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { APP_VERSION } from '@/lib/version'

export default function EnhancedTestPage() {
    const [file, setFile] = useState(null)
    const [running, setRunning] = useState(false)
    const [logs, setLogs] = useState([])
    const [results, setResults] = useState([])
    const [progress, setProgress] = useState({ current: 0, total: 0 })
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [inputMode, setInputMode] = useState('file') // 'file' or 'paste'
    const [pastedDomains, setPastedDomains] = useState('')
    const [screenshotPaths, setScreenshotPaths] = useState([])
    const [config, setConfig] = useState({
        mode: 'extract',
        maxPages: 20,
        parallelDomains: 3,

        // Extraction options
        extractForms: true,
        extractComments: true,
        extractEmails: true,
        extractPhones: true,
        detectTechnology: true,

        // Speed optimizations
        priorityPages: true,
        stopOnTarget: false,
        targetFormsCount: 0,
        targetCommentsCount: 0,

        // Rate limiting
        rateLimit: { min: 500, max: 1000 },

        // Submission options
        submitForms: false,
        submitComments: false,
        senderName: 'Bundle WP',
        senderEmail: 'support@bundlewp.com',
        message: 'The Best Wordpress Plugin with 30+ Wordpress Modules and 30+ Woocommerce Modules With 30 Days Money Back Gurantee. Cost Only 9$ - Limited Period Offer.\n\nPurchase Link - https://doffl.com/go/Aqjr6V\n\nFree 50+ HTML Templates and 150+ Blocks Completely',

        // === NEW FEATURES ===
        // Screenshots
        enableScreenshots: false,

        // Message Templates
        messageTemplate: 'custom',  // 'custom', 'professional', 'quick', 'business', 'feedback', 'newsletter'
        useSpinTax: false,

        // Human Behavior
        behaviorMode: 'normal',  // 'fast', 'normal', 'careful', 'aggressive'

        // Duplicate Detection
        skipDuplicates: true,
        duplicateWindowDays: 30,

        // Form Priority
        enableFormPriority: true,
        minFormScore: 30,

        // Fingerprint
        randomizeFingerprint: true,

        // Background Mode
        runInBackground: false,
    })

    const addLog = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString()
        setLogs(prev => [...prev, { timestamp, message, type }])
    }

    const router = useRouter() // Add this

    const handleStart = async () => {
        // Handle File or Paste
        let fileToUpload = file

        if (inputMode === 'paste') {
            if (!pastedDomains.trim()) {
                alert('Please paste some domains')
                return
            }
            // Convert text to file
            const blob = new Blob([pastedDomains], { type: 'text/plain' })
            fileToUpload = new File([blob], "pasted_domains.txt", { type: "text/plain" })
        } else {
            if (!fileToUpload) {
                alert('Please select a domains file')
                return
            }
        }

        setRunning(true)
        setLogs([])
        setResults([])
        setProgress({ current: 0, total: 0 })
        setScreenshotPaths([])

        try {
            addLog('🚀 Starting domain processing...', 'success')

            const formData = new FormData()
            formData.append('file', fileToUpload)
            formData.append('config', JSON.stringify(config))

            const response = await fetch('/api/test/parallel', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) throw new Error('Server error')

            // Handle Background Mode
            if (config.runInBackground) {
                const data = await response.json()
                if (data.success) {
                    addLog(`✅ ${data.message}`, 'success')
                    if (data.estimatedTime) {
                        addLog(`⏱️ Estimated completion time: ${data.estimatedTime}`, 'info')
                    }
                    addLog('🔄 Redirecting to campaign dashboard...', 'info')

                    // Small delay to let user see the success message
                    setTimeout(() => {
                        router.push(`/campaigns/${data.campaignId}`)
                    }, 2000) // Increased to 2s so user can see the ETA
                } else {
                    addLog(`❌ Error: ${data.error}`, 'error')
                }
                return // Exit early
            }

            // Handle Stream
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
                            // Track screenshot paths
                            if (data.result.screenshots) {
                                const paths = []
                                if (data.result.screenshots.before?.path) paths.push(data.result.screenshots.before.path)
                                if (data.result.screenshots.after?.path) paths.push(data.result.screenshots.after.path)
                                if (paths.length > 0) {
                                    setScreenshotPaths(prev => [...prev, ...paths])
                                    addLog(`📸 Screenshots saved: ${paths.join(', ')}`, 'success')
                                }
                            }
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

        const headers = ['Domain', 'Status', 'Technology', 'Forms Count', 'Comments Count', 'Emails', 'Phones', 'Pages']
        const rows = results.map(r => [
            r.domain,
            r.status,
            r.technology || 'Unknown',
            r.formPages?.length || 0,
            r.commentPages?.length || 0,
            (r.emails || []).join('; '),  // Actual emails separated by semicolon
            (r.phones || []).join('; '),  // Actual phones separated by semicolon
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
    }

    const speedProfiles = {
        fast: {
            maxPages: 10,
            rateLimit: { min: 300, max: 500 },
            parallelDomains: 5,
            priorityPages: true,
            stopOnTarget: true,
            targetFormsCount: 1,
            targetCommentsCount: 1,
        },
        balanced: {
            maxPages: 20,
            rateLimit: { min: 500, max: 1000 },
            parallelDomains: 3,
            priorityPages: true,
            stopOnTarget: false,
        },
        stealth: {
            maxPages: 20,
            rateLimit: { min: 2000, max: 4000 },
            parallelDomains: 2,
            priorityPages: true,
            stopOnTarget: false,
        },
    }

    const applyProfile = (profile) => {
        setConfig({ ...config, ...speedProfiles[profile] })
        addLog(`Applied ${profile} profile`, 'success')
    }

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-4xl font-bold gradient-text mb-2 flex items-center gap-3">
                    🚀 Advanced Domain Processor
                    <span className="text-sm bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full border border-purple-500/30">v{APP_VERSION}</span>
                </h1>
                <p className="text-gray-400 mb-8">
                    Parallel processing • Smart crawling • Anti-detection
                </p>

                {/* Speed Profiles */}
                <div className="card mb-6">
                    <h2 className="text-xl font-bold mb-4">⚡ Speed Profiles</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <button
                            onClick={() => applyProfile('fast')}
                            className="px-4 py-3 bg-green-900 hover:bg-green-800 rounded-lg text-left"
                        >
                            <div className="font-bold">🏃 Fast Mode</div>
                            <div className="text-sm text-gray-400">10 pages • 5 parallel • Stop on target</div>
                        </button>
                        <button
                            onClick={() => applyProfile('balanced')}
                            className="px-4 py-3 bg-blue-900 hover:bg-blue-800 rounded-lg text-left"
                        >
                            <div className="font-bold">⚖️ Balanced</div>
                            <div className="text-sm text-gray-400">20 pages • 3 parallel • Full crawl</div>
                        </button>
                        <button
                            onClick={() => applyProfile('stealth')}
                            className="px-4 py-3 bg-purple-900 hover:bg-purple-800 rounded-lg text-left"
                        >
                            <div className="font-bold">🕵️ Stealth Mode</div>
                            <div className="text-sm text-gray-400">20 pages • 2 parallel • Slow crawl</div>
                        </button>
                    </div>
                </div>

                {/* Mode Selection */}
                <div className="card mb-6">
                    <h2 className="text-xl font-bold mb-4">🎯 Mode</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setConfig({ ...config, mode: 'extract', submitForms: false, submitComments: false })}
                            className={`px-6 py-4 rounded-lg font-semibold text-left ${config.mode === 'extract'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                        >
                            <div className="text-lg mb-1">📊 Extract Only</div>
                            <div className="text-sm opacity-80">Find forms, comments, contacts (Fast)</div>
                        </button>
                        <button
                            onClick={() => setConfig({ ...config, mode: 'submit', submitForms: true, submitComments: true })}
                            className={`px-6 py-4 rounded-lg font-semibold text-left ${config.mode === 'submit'
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                        >
                            <div className="text-lg mb-1">🚀 Extract + Submit</div>
                            <div className="text-sm opacity-80">Find and automatically submit with Playwright</div>
                        </button>
                    </div>
                </div>

                {/* Domain Source */}
                <div className="card mb-6 border-2 border-indigo-500/30">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="text-indigo-400">📂</span> Domain Source
                    </h2>

                    {/* Input Mode Toggle */}
                    <div className="flex gap-4 mb-4">
                        <button
                            onClick={() => setInputMode('file')}
                            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${inputMode === 'file'
                                ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                                : 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                        >
                            <span>📁</span> File Upload
                        </button>
                        <button
                            onClick={() => setInputMode('paste')}
                            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${inputMode === 'paste'
                                ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                                : 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                        >
                            <span>📝</span> Paste List
                        </button>
                    </div>

                    {inputMode === 'file' ? (
                        <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-gray-500 transition-colors">
                            <input
                                type="file"
                                id="file-upload"
                                className="hidden"
                                accept=".txt,.csv"
                                onChange={(e) => setFile(e.target.files[0])}
                            />
                            <label htmlFor="file-upload" className="cursor-pointer block">
                                <div className="text-4xl mb-4">📄</div>
                                <p className="text-lg font-medium mb-2">
                                    {file ? file.name : "Click to select file (.txt)"}
                                </p>
                                <p className="text-sm text-gray-400">
                                    {file ? `${(file.size / 1024).toFixed(2)} KB` : "Supports 100k+ domains"}
                                </p>
                            </label>
                        </div>
                    ) : (
                        <div>
                            <textarea
                                value={pastedDomains}
                                onChange={(e) => setPastedDomains(e.target.value)}
                                placeholder={`example.com\ngoogle.com\n... paste 100k+ domains here`}
                                className="w-full h-64 bg-gray-900 border border-gray-700 rounded-lg p-4 font-mono text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                            <div className="mt-2 flex justify-between text-xs text-gray-500">
                                <span>Supported: 100,000+ lines</span>
                                <span>{pastedDomains.split('\n').filter(l => l.trim()).length.toLocaleString()} lines</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Settings */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    <div className="card">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">🎯 Extraction</h2>
                            <button
                                onClick={() => {
                                    const allEnabled = config.extractForms && config.extractComments && config.extractEmails && config.extractPhones && config.detectTechnology
                                    setConfig({
                                        ...config,
                                        extractForms: !allEnabled,
                                        extractComments: !allEnabled,
                                        extractEmails: !allEnabled,
                                        extractPhones: !allEnabled,
                                        detectTechnology: !allEnabled
                                    })
                                }}
                                className="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded"
                            >
                                {config.extractForms && config.extractComments && config.extractEmails && config.extractPhones && config.detectTechnology
                                    ? 'Disable All'
                                    : 'Enable All'}
                            </button>
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.extractForms}
                                    onChange={(e) => setConfig({ ...config, extractForms: e.target.checked })}
                                />
                                <span className="text-sm">📝 Extract Forms</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.extractComments}
                                    onChange={(e) => setConfig({ ...config, extractComments: e.target.checked })}
                                />
                                <span className="text-sm">💬 Extract Comments</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.extractEmails}
                                    onChange={(e) => setConfig({ ...config, extractEmails: e.target.checked })}
                                />
                                <span className="text-sm">📧 Extract Emails</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.extractPhones}
                                    onChange={(e) => setConfig({ ...config, extractPhones: e.target.checked })}
                                />
                                <span className="text-sm">📞 Extract Phones</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.detectTechnology}
                                    onChange={(e) => setConfig({ ...config, detectTechnology: e.target.checked })}
                                />
                                <span className="text-sm">🔧 Detect Technology</span>
                            </label>
                        </div>
                    </div>

                    <div className="card">
                        <h2 className="text-xl font-bold mb-4">⚙️ Performance</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="text-sm text-gray-400">Max Pages per Domain</label>
                                <input
                                    type="number"
                                    min="5"
                                    max="100"
                                    value={config.maxPages}
                                    onChange={(e) => setConfig({ ...config, maxPages: parseInt(e.target.value) })}
                                    className="input w-full"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-400">Parallel Domains (1-5)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="5"
                                    value={config.parallelDomains}
                                    onChange={(e) => setConfig({ ...config, parallelDomains: parseInt(e.target.value) })}
                                    className="input w-full"
                                />
                                <p className="text-xs text-gray-500 mt-1">Higher = faster but more CPU</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Advanced Settings */}
                <div className="card mb-6">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="w-full text-left font-bold flex justify-between items-center"
                    >
                        <span>🔧 Advanced Settings</span>
                        <span>{showAdvanced ? '▼' : '▶'}</span>
                    </button>

                    {showAdvanced && (
                        <div className="mt-4 grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h3 className="font-semibold text-sm text-gray-400">Speed Optimization</h3>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.priorityPages}
                                        onChange={(e) => setConfig({ ...config, priorityPages: e.target.checked })}
                                    />
                                    <span className="text-sm">🎯 Priority Pages First</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.stopOnTarget}
                                        onChange={(e) => setConfig({ ...config, stopOnTarget: e.target.checked })}
                                    />
                                    <span className="text-sm">🛑 Stop on Target</span>
                                </label>
                                {config.stopOnTarget && (
                                    <div className="ml-6 space-y-2">
                                        <div>
                                            <label className="text-xs text-gray-400">Target Forms</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={config.targetFormsCount || 0}
                                                onChange={(e) => setConfig({ ...config, targetFormsCount: parseInt(e.target.value) || 0 })}
                                                className="input w-full text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400">Target Comments</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={config.targetCommentsCount || 0}
                                                onChange={(e) => setConfig({ ...config, targetCommentsCount: parseInt(e.target.value) || 0 })}
                                                className="input w-full text-sm"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <h3 className="font-semibold text-sm text-gray-400">Rate Limiting (ms)</h3>
                                <div>
                                    <label className="text-xs text-gray-400">Min Delay</label>
                                    <input
                                        type="number"
                                        min="100"
                                        max="5000"
                                        step="100"
                                        value={config.rateLimit.min}
                                        onChange={(e) => setConfig({ ...config, rateLimit: { ...config.rateLimit, min: parseInt(e.target.value) } })}
                                        className="input w-full text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Max Delay</label>
                                    <input
                                        type="number"
                                        min="100"
                                        max="5000"
                                        step="100"
                                        value={config.rateLimit.max}
                                        onChange={(e) => setConfig({ ...config, rateLimit: { ...config.rateLimit, max: parseInt(e.target.value) } })}
                                        className="input w-full text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* === NEW FEATURES PANEL === */}
                <div className="card mb-6 border-2 border-purple-500/30">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="text-purple-400">✨</span> Smart Features
                        <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded">NEW</span>
                    </h2>

                    <div className="grid grid-cols-3 gap-6">
                        {/* Column 1: Screenshots & Fingerprint */}
                        <div className="space-y-3">
                            <h3 className="font-semibold text-sm text-gray-400 mb-2">🔒 Anti-Detection</h3>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.randomizeFingerprint}
                                    onChange={(e) => setConfig({ ...config, randomizeFingerprint: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm">🎭 Randomize Browser Fingerprint</span>
                            </label>
                            <p className="text-xs text-gray-500 ml-6">Random viewport, timezone, WebGL</p>

                            <div className="mt-4">
                                <label className="text-xs text-gray-400">🤖 Behavior Mode</label>
                                <select
                                    value={config.behaviorMode}
                                    onChange={(e) => setConfig({ ...config, behaviorMode: e.target.value })}
                                    className="input w-full text-sm mt-1"
                                >
                                    <option value="aggressive">⚡ Aggressive (Fast)</option>
                                    <option value="fast">🏃 Fast (Less delays)</option>
                                    <option value="normal">⚖️ Normal (Balanced)</option>
                                    <option value="careful">🐢 Careful (Maximum stealth)</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Human-like mouse movement & typing</p>
                            </div>
                        </div>

                        {/* Column 2: Screenshots & Duplicates */}
                        <div className="space-y-3">
                            <h3 className="font-semibold text-sm text-gray-400 mb-2">📸 Capture & Detection</h3>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.enableScreenshots}
                                    onChange={(e) => setConfig({ ...config, enableScreenshots: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm">📷 Capture Screenshots</span>
                            </label>
                            <p className="text-xs text-gray-500 ml-6">Before/after form submission</p>
                            {config.enableScreenshots && (
                                <div className="ml-6 text-xs bg-gray-800 p-2 rounded">
                                    📁 Saved to: <code className="text-green-400">./screenshots/</code>
                                </div>
                            )}

                            <div className="border-t border-gray-700 pt-3 mt-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={config.skipDuplicates}
                                        onChange={(e) => setConfig({ ...config, skipDuplicates: e.target.checked })}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm">🔄 Skip Duplicates</span>
                                </label>
                                <p className="text-xs text-gray-500 ml-6">Skip previously submitted domains</p>
                            </div>

                            {config.skipDuplicates && (
                                <div className="ml-6">
                                    <label className="text-xs text-gray-400">Window (days)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="365"
                                        value={config.duplicateWindowDays}
                                        onChange={(e) => setConfig({ ...config, duplicateWindowDays: parseInt(e.target.value) || 30 })}
                                        className="input w-full text-sm"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Column 3: Form Priority & Templates */}
                        <div className="space-y-3">
                            <h3 className="font-semibold text-sm text-gray-400 mb-2">🎯 Smart Submission</h3>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.enableFormPriority}
                                    onChange={(e) => setConfig({ ...config, enableFormPriority: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm">⭐ Smart Form Priority</span>
                            </label>
                            <p className="text-xs text-gray-500 ml-6">Skip low-quality forms</p>

                            {config.enableFormPriority && (
                                <div className="ml-6">
                                    <label className="text-xs text-gray-400">Min Score (0-100)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={config.minFormScore}
                                        onChange={(e) => setConfig({ ...config, minFormScore: parseInt(e.target.value) || 30 })}
                                        className="input w-full text-sm"
                                    />
                                </div>
                            )}

                            <div className="border-t border-gray-700 pt-3 mt-3">
                                <label className="text-xs text-gray-400">📝 Message Template</label>
                                <select
                                    value={config.messageTemplate}
                                    onChange={(e) => setConfig({ ...config, messageTemplate: e.target.value })}
                                    className="input w-full text-sm mt-1"
                                >
                                    <option value="custom">✏️ Custom (use message below)</option>
                                    <option value="professional">💼 Professional Inquiry</option>
                                    <option value="quick">⚡ Quick Contact</option>
                                    <option value="business">🤝 Business Proposal</option>
                                    <option value="feedback">📋 Feedback Request</option>
                                    <option value="newsletter">📰 Newsletter Subscribe</option>
                                </select>

                                <label className="flex items-center gap-2 cursor-pointer mt-2">
                                    <input
                                        type="checkbox"
                                        checked={config.useSpinTax}
                                        onChange={(e) => setConfig({ ...config, useSpinTax: e.target.checked })}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm">🎲 Enable SpinTax</span>
                                </label>
                                <p className="text-xs text-gray-500 ml-6">{`Use {Hi|Hello} for variations`}</p>
                            </div>
                        </div>
                    </div>

                    {/* Screenshot Path Display */}
                    {screenshotPaths.length > 0 && (
                        <div className="mt-4 p-3 bg-green-900/20 rounded-lg border border-green-500/30">
                            <h4 className="text-sm font-bold text-green-400 mb-2">📸 Captured Screenshots ({screenshotPaths.length})</h4>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {screenshotPaths.map((path, i) => (
                                    <div key={i} className="text-xs text-gray-300 font-mono bg-black/30 px-2 py-1 rounded">
                                        {path}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                {config.mode === 'submit' && (
                    <div className="card mb-6">
                        <h2 className="text-xl font-bold mb-4">🚀 Auto-Submit Settings</h2>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.submitForms}
                                    onChange={(e) => setConfig({ ...config, submitForms: e.target.checked })}
                                />
                                <span>Submit Forms</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.submitComments}
                                    onChange={(e) => setConfig({ ...config, submitComments: e.target.checked })}
                                />
                                <span>Submit Comments</span>
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
                <div className="flex gap-4 mb-6 items-center">
                    <button
                        onClick={handleStart}
                        disabled={(inputMode === 'file' && !file) || (inputMode === 'paste' && !pastedDomains) || running}
                        className="btn-primary flex-1 py-4 text-lg"
                    >
                        {running ? '⏳ Processing...' : '🚀 Start Processing'}
                    </button>

                    <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                        <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                            <input
                                type="checkbox"
                                checked={config.runInBackground}
                                onChange={(e) => setConfig({ ...config, runInBackground: e.target.checked })}
                                className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                            />
                            <div>
                                <div className="font-bold text-sm">Run in Background (VPS)</div>
                                <div className="text-xs text-gray-400">Continues if closed</div>
                            </div>
                        </label>
                    </div>

                    <button
                        onClick={handleExport}
                        disabled={results.length === 0}
                        className="btn-secondary py-4"
                    >
                        📥 Export CSV
                    </button>
                </div>

                {/* Progress */}
                {progress.total > 0 && (
                    <div className="card mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold">Progress</span>
                            <span className="text-sm text-gray-400">
                                {progress.current} / {progress.total} domains ({Math.round((progress.current / progress.total) * 100)}%)
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
                                        <th className="text-left p-2">Tech</th>
                                        <th className="text-center p-2">Forms</th>
                                        <th className="text-center p-2">Comments</th>
                                        <th className="text-center p-2">Emails</th>
                                        <th className="text-center p-2">Phones</th>
                                        <th className="text-center p-2">Pages</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((result, idx) => (
                                        <tr key={idx} className="border-b border-gray-900 hover:bg-gray-900">
                                            <td className="p-2 text-sm">{result.domain}</td>
                                            <td className="p-2 text-sm">
                                                <span className="px-2 py-1 bg-blue-900 rounded text-xs">
                                                    {result.technology || 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="p-2 text-center">{result.formPages?.length || 0}</td>
                                            <td className="p-2 text-center">{result.commentPages?.length || 0}</td>
                                            <td className="p-2 text-center" title={(result.emails || []).join('\n')}>
                                                <span className="cursor-help underline decoration-dotted">
                                                    {result.emails?.length || 0}
                                                </span>
                                                {result.emails?.length > 0 && (
                                                    <div className="text-xs text-green-400 mt-1">{result.emails[0]}</div>
                                                )}
                                            </td>
                                            <td className="p-2 text-center" title={(result.phones || []).join('\n')}>
                                                <span className="cursor-help underline decoration-dotted">
                                                    {result.phones?.length || 0}
                                                </span>
                                                {result.phones?.length > 0 && (
                                                    <div className="text-xs text-green-400 mt-1">{result.phones[0]}</div>
                                                )}
                                            </td>
                                            <td className="p-2 text-center">{result.totalPages || 0}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

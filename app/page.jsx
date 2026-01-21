'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import CampaignCard from '@/components/CampaignCard'
import CreateCampaignModal from '@/components/CreateCampaignModal'

function WorkerStatus() {
    const [status, setStatus] = useState(null)
    const [loading, setLoading] = useState(false)

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/system/workers')
            const data = await res.json()
            setStatus(data)
        } catch (e) {
            console.error(e)
        }
    }

    const controlWorker = async (action, count = null) => {
        if (!confirm(`Are you sure you want to ${action} workers?`)) return
        setLoading(true)
        try {
            await fetch('/api/system/workers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, count })
            })
            setTimeout(fetchStatus, 2000) // Wait for PM2 to react
        } catch (e) {
            alert(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStatus()
        const interval = setInterval(fetchStatus, 5000)
        return () => clearInterval(interval)
    }, [])

    if (!status) return <span className="text-gray-500">Loading...</span>

    return (
        <div>
            <div className="flex items-center gap-3 mb-2">
                <span className={`text-3xl font-bold ${status.count > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {status.count}
                </span>
                <span className="text-xs px-2 py-1 bg-gray-800 rounded uppercase">
                    {status.status || 'STOPPED'}
                </span>
            </div>

            <div className="flex gap-2 text-xs">
                {status.count === 0 ? (
                    <button
                        onClick={() => controlWorker('start')}
                        disabled={loading}
                        className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded"
                    >
                        Start (4)
                    </button>
                ) : (
                    <>
                        <button
                            onClick={() => controlWorker('stop')}
                            disabled={loading}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                        >
                            Stop
                        </button>
                        <button
                            onClick={() => controlWorker('scale', 8)}
                            disabled={loading}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
                        >
                            Scale to 8
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

// Auto-Restart Control Component
function AutoRestartControl() {
    const [settings, setSettings] = useState({ enabled: false, intervalMinutes: 30 })
    const [loading, setLoading] = useState(false)
    const [interval, setInterval] = useState(30)

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/system/restart')
            const data = await res.json()
            setSettings(data)
            setInterval(data.intervalMinutes || 30)
        } catch (e) {
            console.error(e)
        }
    }

    useEffect(() => {
        fetchSettings()
    }, [])

    const toggleAutoRestart = async () => {
        setLoading(true)
        try {
            const action = settings.enabled ? 'disable' : 'enable'
            const res = await fetch('/api/system/restart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, intervalMinutes: interval })
            })
            const data = await res.json()
            setSettings(data)
        } catch (e) {
            alert(e.message)
        } finally {
            setLoading(false)
        }
    }

    const restartNow = async () => {
        if (!confirm('Restart all workers NOW?')) return
        setLoading(true)
        try {
            await fetch('/api/system/restart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'restart-now' })
            })
            alert('Workers restarted!')
        } catch (e) {
            alert(e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="card border-l-4 border-amber-500">
            <p className="text-gray-400 text-sm mb-2">⏰ Auto-Restart</p>
            <div className="flex items-center gap-3 mb-3">
                <button
                    onClick={toggleAutoRestart}
                    disabled={loading}
                    className={`px-3 py-1 rounded text-sm font-medium ${settings.enabled
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                >
                    {settings.enabled ? '✅ ON' : '❌ OFF'}
                </button>
                <select
                    value={interval}
                    onChange={(e) => setInterval(parseInt(e.target.value))}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
                    disabled={settings.enabled}
                >
                    <option value={10}>Every 10 min</option>
                    <option value={20}>Every 20 min</option>
                    <option value={30}>Every 30 min</option>
                    <option value={60}>Every 60 min</option>
                </select>
            </div>
            <button
                onClick={restartNow}
                disabled={loading}
                className="w-full px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs"
            >
                🔄 Restart Now
            </button>
        </div>
    )
}

// Supabase Settings Component
function SupabaseSettings() {
    const [status, setStatus] = useState({ configured: false, url: '' })
    const [newUrl, setNewUrl] = useState('')
    const [loading, setLoading] = useState(false)
    const [showInput, setShowInput] = useState(false)
    const [connectionStatus, setConnectionStatus] = useState(null) // null, 'testing', 'success', 'failed'
    const [connectionError, setConnectionError] = useState('')

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/system/supabase')
            const data = await res.json()
            setStatus(data)
        } catch (e) {
            console.error(e)
        }
    }

    useEffect(() => {
        fetchStatus()
    }, [])

    const testConnection = async () => {
        setConnectionStatus('testing')
        setConnectionError('')
        try {
            const res = await fetch('/api/system/supabase', { method: 'PUT' })
            const data = await res.json()
            if (data.connected) {
                setConnectionStatus('success')
            } else {
                setConnectionStatus('failed')
                setConnectionError(data.error || 'Connection failed')
            }
        } catch (e) {
            setConnectionStatus('failed')
            setConnectionError(e.message)
        }
    }

    const saveUrl = async () => {
        if (!newUrl.trim()) return
        setLoading(true)
        try {
            const res = await fetch('/api/system/supabase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ supabaseUrl: newUrl })
            })
            const data = await res.json()
            if (data.success) {
                alert('✅ Supabase URL saved! Restart PM2 to apply.')
                setShowInput(false)
                setConnectionStatus(null)
                fetchStatus()
            } else {
                alert('❌ Error: ' + data.error)
            }
        } catch (e) {
            alert('❌ Error: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="card border-l-4 border-purple-500">
            <p className="text-gray-400 text-sm mb-2">🗄️ Supabase Database</p>
            {status.configured ? (
                <div className="text-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-green-400">✅ Configured</span>
                        {connectionStatus === 'testing' && <span className="text-yellow-400 animate-pulse">Testing...</span>}
                        {connectionStatus === 'success' && <span className="text-green-400">🟢 Connected</span>}
                        {connectionStatus === 'failed' && <span className="text-red-400">🔴 Failed</span>}
                    </div>
                    <p className="text-gray-500 mt-1 break-all text-xs">{status.url}</p>
                    {connectionStatus === 'failed' && connectionError && (
                        <p className="text-red-400 text-xs mt-1">{connectionError}</p>
                    )}
                </div>
            ) : (
                <span className="text-yellow-400 text-xs">⚠️ Not configured</span>
            )}

            {showInput ? (
                <div className="mt-2">
                    <input
                        type="text"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        placeholder="postgresql://user:pass@host:5432/db"
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs mb-2"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={saveUrl}
                            disabled={loading}
                            className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                        >
                            💾 Save
                        </button>
                        <button
                            onClick={() => setShowInput(false)}
                            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div className="mt-2 flex gap-2">
                    <button
                        onClick={() => setShowInput(true)}
                        className="flex-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs"
                    >
                        {status.configured ? '✏️ Change' : '➕ Add'}
                    </button>
                    {status.configured && (
                        <button
                            onClick={testConnection}
                            disabled={connectionStatus === 'testing'}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
                        >
                            🔌 Test
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}


// Real-time Terminal View Component
function TerminalView() {
    const [logs, setLogs] = useState('')
    const [loading, setLoading] = useState(false)
    const [expanded, setExpanded] = useState(false)

    const fetchLogs = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/system/logs?lines=100')
            const data = await res.json()
            setLogs(data.logs || 'No logs available')
        } catch (e) {
            setLogs(`Error: ${e.message}`)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchLogs()
        const interval = setInterval(fetchLogs, 5000) // Refresh every 5 seconds
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="card mt-6">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🖥️</span>
                    <h3 className="font-bold">Real-time Terminal</h3>
                    {loading && <span className="text-xs text-gray-500 animate-pulse">refreshing...</span>}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchLogs}
                        className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                    >
                        🔄 Refresh
                    </button>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                    >
                        {expanded ? '📥 Collapse' : '📤 Expand'}
                    </button>
                </div>
            </div>
            <div
                className={`bg-black rounded-lg p-4 font-mono text-xs text-green-400 overflow-auto whitespace-pre-wrap ${expanded ? 'h-96' : 'h-48'
                    }`}
            >
                {logs}
            </div>
        </div>
    )
}

export default function HomePage() {
    const [campaigns, setCampaigns] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

    const fetchCampaigns = async () => {
        try {
            const response = await fetch('/api/campaigns')
            const data = await response.json()
            setCampaigns(data.campaigns || [])
        } catch (error) {
            console.error('Failed to fetch campaigns:', error)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        fetchCampaigns()

        // Auto-refresh every 10 seconds
        const interval = setInterval(() => {
            setRefreshing(true)
            fetchCampaigns()
        }, 10000)

        return () => clearInterval(interval)
    }, [])

    const handleReset = async () => {
        if (!confirm('⚠️ DANGER: This will DELETE ALL DATA (Campaigns, Domains, Logs). Are you sure?')) return
        if (!confirm('☠️ FINAL WARNING: This cannot be undone. Confirm RESET?')) return

        setLoading(true)
        try {
            const response = await fetch('/api/admin/reset', { method: 'POST' })
            const result = await response.json()
            if (result.success) {
                alert('✅ System Reset Successful. Dashboard will refresh.')
                fetchCampaigns()
            } else {
                alert('❌ Reset Failed: ' + result.error)
            }
        } catch (error) {
            alert('❌ API Error: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="mb-12">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-5xl font-bold mb-2 gradient-text">
                                Auto Submitter
                            </h1>
                            <p className="text-xl text-gray-400">
                                Automated Form & Comment Submission System
                            </p>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={handleReset}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
                            >
                                🗑️ Reset System
                            </button>

                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="btn-primary flex items-center gap-2"
                            >
                                🚀 New Campaign
                            </button>
                        </div>
                    </div>
                </header>

                {/* Stats Overview */}
                <div className="grid grid-cols-6 gap-4 mb-8">
                    {/* Worker Status Card */}
                    <div className="card border-l-4 border-indigo-500 relative overflow-hidden">
                        <div className="relative z-10">
                            <p className="text-gray-400 text-sm mb-1">Queue Workers</p>
                            <WorkerStatus />
                        </div>
                        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-indigo-900/20 to-transparent pointer-events-none" />
                    </div>

                    {/* Auto-Restart Card */}
                    <AutoRestartControl />

                    {/* Supabase Settings Card */}
                    <SupabaseSettings />

                    <div className="card">
                        <p className="text-gray-400 text-sm mb-1">Total Campaigns</p>
                        <p className="text-3xl font-bold">{campaigns.length}</p>
                    </div>

                    <div className="card">
                        <p className="text-gray-400 text-sm mb-1">Running</p>
                        <p className="text-3xl font-bold text-green-400">
                            {campaigns.filter(c => c.status === 'RUNNING').length}
                        </p>
                    </div>

                    <div className="card">
                        <p className="text-gray-400 text-sm mb-1">Total Progress</p>
                        <p className="text-3xl font-bold text-blue-400">
                            {campaigns.reduce((sum, c) => sum + (c.processedDomains || 0), 0)}
                        </p>
                    </div>
                </div>

                {/* Real-time Terminal */}
                <TerminalView />

                {/* Campaigns List */}
                <div className="mt-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold">Campaigns</h2>
                        {refreshing && (
                            <span className="text-sm text-gray-400 animate-pulse">
                                Refreshing...
                            </span>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin h-12 w-12 border-4 border-gray-700 border-t-indigo-500 rounded-full"></div>
                        </div>
                    ) : campaigns.length === 0 ? (
                        <div className="card text-center py-20">
                            <p className="text-gray-400 text-lg mb-4">No campaigns yet</p>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="btn-primary inline-block"
                            >
                                Create Your First Campaign
                            </button>
                        </div>
                    ) : (
                        <div className="grid gap-6">
                            {campaigns.map(campaign => (
                                <CampaignCard
                                    key={campaign.id}
                                    campaign={campaign}
                                    onUpdate={fetchCampaigns}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Creation Modal */}
            <CreateCampaignModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onCampaignCreated={() => {
                    fetchCampaigns()
                }}
            />
        </div>
    )
}

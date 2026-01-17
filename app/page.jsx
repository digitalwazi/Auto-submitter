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
                <div className="grid grid-cols-4 gap-6 mb-8">
                    {/* Worker Status Card */}
                    <div className="card border-l-4 border-indigo-500 relative overflow-hidden">
                        <div className="relative z-10">
                            <p className="text-gray-400 text-sm mb-1">Queue Workers</p>
                            <WorkerStatus />
                        </div>
                        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-indigo-900/20 to-transparent pointer-events-none" />
                    </div>

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

                {/* Campaigns List */}
                <div>
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

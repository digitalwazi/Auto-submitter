'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import CampaignCard from '@/components/CampaignCard'

export default function HomePage() {
    const [campaigns, setCampaigns] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

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

    const handleManualProcess = async () => {
        if (!confirm('Trigger manual processing?')) return

        try {
            const response = await fetch('/api/process/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maxTasks: 20, maxTimeSeconds: 240 }),
            })

            const result = await response.json()

            if (result.success) {
                alert(`Processed ${result.tasksProcessed} tasks in ${result.timeElapsed}s`)
                fetchCampaigns()
            } else {
                alert(`Processing failed: ${result.error}`)
            }
        } catch (error) {
            alert(`Error: ${error.message}`)
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
                                onClick={handleManualProcess}
                                className="btn-secondary"
                            >
                                🚀 Manual Process
                            </button>

                            <Link href="/campaigns/create" className="btn-primary">
                                ✨ New Campaign
                            </Link>
                        </div>
                    </div>
                </header>

                {/* Stats Overview */}
                <div className="grid grid-cols-4 gap-6 mb-8">
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
                        <p className="text-gray-400 text-sm mb-1">Forms Submitted</p>
                        <p className="text-3xl font-bold text-blue-400">
                            {campaigns.reduce((sum, c) => sum + c.formsSubmitted, 0)}
                        </p>
                    </div>

                    <div className="card">
                        <p className="text-gray-400 text-sm mb-1">Comments Posted</p>
                        <p className="text-3xl font-bold text-purple-400">
                            {campaigns.reduce((sum, c) => sum + c.commentsSubmitted, 0)}
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
                            <Link href="/campaigns/create" className="btn-primary inline-block">
                                Create Your First Campaign
                            </Link>
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
        </div>
    )
}

'use client'

import Link from 'next/link'

export default function CampaignCard({ campaign, onUpdate }) {
    const statusClasses = {
        CREATED: 'status-created',
        RUNNING: 'status-running',
        PAUSED: 'status-paused',
        COMPLETED: 'status-completed',
        FAILED: 'status-failed',
        STOPPED: 'status-failed',
    }

    const handleStatusChange = async (newStatus) => {
        try {
            const response = await fetch(`/api/campaigns/${campaign.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            })

            if (response.ok) {
                onUpdate()
            }
        } catch (error) {
            console.error('Failed to update status:', error)
        }
    }

    const handleDelete = async () => {
        if (!confirm('Delete this campaign? This action cannot be undone.')) return

        try {
            const response = await fetch(`/api/campaigns/${campaign.id}`, {
                method: 'DELETE',
            })

            if (response.ok) {
                onUpdate()
            }
        } catch (error) {
            console.error('Failed to delete campaign:', error)
        }
    }

    const progress = campaign.totalDomains > 0
        ? (campaign.processedDomains / campaign.totalDomains) * 100
        : 0

    return (
        <div className="card">
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <Link href={`/campaigns/${campaign.id}`}>
                            <h3 className="text-xl font-bold hover:text-indigo-400 transition-colors">
                                {campaign.name}
                            </h3>
                        </Link>
                        <span className={`status-badge ${statusClasses[campaign.status]}`}>
                            {campaign.status}
                        </span>
                        <span className="text-sm text-gray-500">
                            {campaign.processingMode === 'CRON' ? '⏰ Cron' : '👆 Manual'}
                        </span>
                    </div>

                    <p className="text-gray-400 text-sm">
                        Created {new Date(campaign.createdAt).toLocaleDateString()}
                    </p>
                </div>

                <div className="flex gap-2">
                    {campaign.status === 'CREATED' && (
                        <button
                            onClick={() => handleStatusChange('RUNNING')}
                            className="btn-primary text-sm py-2 px-4"
                        >
                            ▶️ Start
                        </button>
                    )}

                    {campaign.status === 'RUNNING' && (
                        <>
                            <button
                                onClick={() => handleStatusChange('PAUSED')}
                                className="btn-secondary text-sm py-2 px-4"
                            >
                                ⏸️ Pause
                            </button>
                            <button
                                onClick={() => handleStatusChange('STOPPED')}
                                className="btn-secondary text-sm py-2 px-4"
                            >
                                ⏹️ Stop
                            </button>
                        </>
                    )}

                    {campaign.status === 'PAUSED' && (
                        <button
                            onClick={() => handleStatusChange('RUNNING')}
                            className="btn-primary text-sm py-2 px-4"
                        >
                            ▶️ Resume
                        </button>
                    )}

                    <Link href={`/campaigns/${campaign.id}`} className="btn-secondary text-sm py-2 px-4">
                        📊 Details
                    </Link>

                    <button
                        onClick={handleDelete}
                        className="btn-secondary text-sm py-2 px-4 hover:bg-red-900/20 hover:border-red-500"
                    >
                        🗑️
                    </button>
                </div>
            </div>

            {/* Progress */}
            <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Progress</span>
                    <span className="text-gray-300">
                        {campaign.processedDomains} / {campaign.totalDomains} domains
                    </span>
                </div>
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-5 gap-4 text-center">
                <div>
                    <p className="text-2xl font-bold text-indigo-400">{campaign.totalDomains}</p>
                    <p className="text-xs text-gray-500">Domains</p>
                </div>
                <div>
                    <p className="text-2xl font-bold text-blue-400">{campaign.totalPages}</p>
                    <p className="text-xs text-gray-500">Pages</p>
                </div>
                <div>
                    <p className="text-2xl font-bold text-green-400">{campaign.formsSubmitted}</p>
                    <p className="text-xs text-gray-500">Forms</p>
                </div>
                <div>
                    <p className="text-2xl font-bold text-purple-400">{campaign.commentsSubmitted}</p>
                    <p className="text-xs text-gray-500">Comments</p>
                </div>
                <div>
                    <p className="text-2xl font-bold text-yellow-400">{campaign._count?.contacts || 0}</p>
                    <p className="text-xs text-gray-500">Contacts</p>
                </div>
            </div>
        </div>
    )
}

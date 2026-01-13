'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function CampaignDetailsPage() {
    const params = useParams()
    const [campaign, setCampaign] = useState(null)
    const [queueCounts, setQueueCounts] = useState(null)
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('overview')

    const [errorMsg, setErrorMsg] = useState(null)

    const fetchCampaign = async () => {
        try {
            const response = await fetch(`/api/campaigns/${params.id}`)
            if (!response.ok) {
                const errText = await response.text()
                throw new Error(`Status: ${response.status} - ${errText}`)
            }
            const data = await response.json()
            setCampaign(data.campaign)
            setQueueCounts(data.queueCounts)
            setLogs(data.logs || [])
            setErrorMsg(null)
        } catch (error) {
            console.error('Failed to fetch campaign:', error)
            setErrorMsg(error.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchCampaign()

        // Auto-refresh every 5 seconds for live updates
        const interval = setInterval(fetchCampaign, 5000)
        return () => clearInterval(interval)
    }, [params.id])

    const handleExport = async () => {
        try {
            const response = await fetch(`/api/export/${params.id}`)
            const blob = await response.blob()

            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `campaign-${params.id}.xlsx`
            a.click()
            window.URL.revokeObjectURL(url)
        } catch (error) {
            alert(`Export failed: ${error.message}`)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-12 w-12 border-4 border-gray-700 border-t-indigo-500 rounded-full"></div>
            </div>
        )
    }

    if (!campaign) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="card text-center max-w-lg">
                    <p className="text-xl mb-4 font-bold text-red-500">Campaign Not Found</p>
                    {errorMsg && (
                        <div className="mb-6 p-4 bg-red-900/40 rounded text-left overflow-auto max-h-40">
                            <p className="font-mono text-sm text-red-200 break-all">{errorMsg}</p>
                            <p className="text-xs text-gray-400 mt-2">ID: {params.id}</p>
                        </div>
                    )}
                    <Link href="/" className="btn-primary">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        )
    }

    // Calculate real progress based on tasks
    let progress = 0
    let totalTasks = 0
    let completedTasks = 0

    if (queueCounts) {
        totalTasks = (queueCounts.PENDING || 0) + (queueCounts.PROCESSING || 0) + (queueCounts.COMPLETED || 0) + (queueCounts.FAILED || 0)
        completedTasks = (queueCounts.COMPLETED || 0) + (queueCounts.FAILED || 0)
        if (totalTasks > 0) {
            progress = (completedTasks / totalTasks) * 100
        }
    } else if (campaign.totalDomains > 0) {
        // Fallback to domain count
        progress = (campaign.processedDomains / campaign.totalDomains) * 100
    }

    const [detailsLoaded, setDetailsLoaded] = useState(false)

    // Parse config to decide which tabs to show
    const config = campaign?.config ? JSON.parse(campaign.config) : {}

    const tabs = ['overview', 'logs']

    if (campaign) {
        // Show data tabs if extraction or detection was enabled
        const hasExtraction = config.detectTechnology || config.extractEmails || config.extractPhones || config.extractForms || config.extractComments

        if (hasExtraction || campaign.totalDomains > 0) tabs.push('domains', 'pages')
        if (config.extractEmails || config.extractPhones) tabs.push('contacts')
        if (campaign.submitForms || campaign.submitComments) tabs.push('submissions')
    }

    // Lazy load heavy data
    const loadDetailedData = async () => {
        if (detailsLoaded) return
        try {
            const res = await fetch(`/api/campaigns/${params.id}/data`)
            const data = await res.json()
            setCampaign(prev => ({
                ...prev,
                domains: data.domains,
                contacts: data.contacts,
                pages: data.pages,
                submissions: data.submissions
            }))
            setDetailsLoaded(true)
        } catch (e) {
            console.error("Failed to load details", e)
        }
    }

    useEffect(() => {
        if (['domains', 'pages', 'contacts', 'submissions'].includes(activeTab)) {
            loadDetailedData()
        }
    }, [activeTab])

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/" className="text-indigo-400 hover:text-indigo-300 mb-4 inline-block">
                        ← Back to Dashboard
                    </Link>
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-4xl font-bold mb-2">{campaign.name}</h1>
                            <p className="text-gray-400">
                                Created {new Date(campaign.createdAt).toLocaleString()}
                            </p>
                        </div>
                        <button onClick={handleExport} className="btn-primary">
                            📥 Export to Excel
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-5 gap-4 mb-8">
                    <div className="card">
                        <p className="text-sm text-gray-400 mb-1">Status</p>
                        <p className="text-xl font-bold text-indigo-400">{campaign.status}</p>
                    </div>
                    <div className="card">
                        <p className="text-sm text-gray-400 mb-1">Task Queue</p>
                        <p className="text-xl font-bold">
                            {queueCounts ? (
                                <span className={queueCounts.PENDING > 0 ? 'text-yellow-400' : 'text-gray-200'}>
                                    {queueCounts.PENDING} pending
                                </span>
                            ) : '...'}
                        </p>
                    </div>
                    <div className="card">
                        <p className="text-sm text-gray-400 mb-1">Domains</p>
                        <p className="text-xl font-bold text-blue-400">{campaign.processedDomains} / {campaign.totalDomains}</p>
                    </div>
                    <div className="card">
                        <p className="text-sm text-gray-400 mb-1">Forms</p>
                        <p className="text-xl font-bold text-green-400">{campaign.formsSubmitted}</p>
                    </div>
                    <div className="card">
                        <p className="text-sm text-gray-400 mb-1">Comments</p>
                        <p className="text-xl font-bold text-purple-400">{campaign.commentsSubmitted}</p>
                    </div>
                </div>

                {/* Progress */}
                <div className="card mb-8">
                    <div className="flex justify-between mb-2">
                        <h3 className="font-semibold">Overall Progress ({completedTasks}/{totalTasks} tasks)</h3>
                        <span className="text-sm text-gray-400">{progress.toFixed(1)}%</span>
                    </div>
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="mb-6 flex gap-4 border-b border-gray-800 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-3 px-2 capitalize transition-colors whitespace-nowrap ${activeTab === tab
                                ? 'text-indigo-400 border-b-2 border-indigo-400'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div>
                    {activeTab === 'overview' && (
                        <div className="space-y-4">
                            <div className="card">
                                <h3 className="text-lg font-bold mb-4">Campaign Settings</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-400">Processing Mode</p>
                                        <p className="font-medium">{campaign.processingMode}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400">Max Pages Per Domain</p>
                                        <p className="font-medium">{campaign.maxPagesPerDomain}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400">Submit Forms</p>
                                        <p className="font-medium">{campaign.submitForms ? 'Yes' : 'No'}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400">Submit Comments</p>
                                        <p className="font-medium">{campaign.submitComments ? 'Yes' : 'No'}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-gray-400">Sender</p>
                                        <p className="font-medium">{campaign.senderName} ({campaign.senderEmail})</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-gray-400">Message Template</p>
                                        <p className="font-medium text-gray-300 mt-1">{campaign.messageTemplate}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'domains' && (
                        <div className="card">
                            <h3 className="text-lg font-bold mb-4">Domains ({campaign.domains?.length || 0})</h3>
                            <div className="space-y-3">
                                {campaign.domains?.map(domain => (
                                    <div key={domain.id} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                                        <div>
                                            <p className="font-medium">{domain.url}</p>
                                            <p className="text-xs text-gray-500">
                                                {domain.pagesDiscovered} pages • {domain.sitemapsFound} sitemaps
                                            </p>
                                        </div>
                                        <span className={`text-sm px-3 py-1 rounded-full ${domain.status === 'COMPLETED' ? 'bg-green-900/30 text-green-400' :
                                            domain.status === 'PROCESSING' ? 'bg-blue-900/30 text-blue-400' :
                                                domain.status === 'FAILED' ? 'bg-red-900/30 text-red-400' :
                                                    'bg-gray-700 text-gray-400'
                                            }`}>
                                            {domain.status}
                                        </span>
                                    </div>
                                )) || <p className="text-gray-500 text-center py-8">No domains yet</p>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'pages' && (
                        <div className="card">
                            <h3 className="text-lg font-bold mb-4">Discovered Pages ({campaign.pages?.length || 0})</h3>
                            <div className="space-y-3">
                                {campaign.pages?.map(page => (
                                    <div key={page.id} className="p-3 bg-gray-900/50 rounded-lg">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <p className="font-medium text-sm">{page.title || 'Untitled'}</p>
                                                <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline">
                                                    {page.url}
                                                </a>
                                            </div>
                                            <div className="flex gap-2">
                                                {page.hasForm && <span className="text-xs px-2 py-1 bg-green-900/30 text-green-400 rounded">Form</span>}
                                                {page.hasComments && <span className="text-xs px-2 py-1 bg-purple-900/30 text-purple-400 rounded">Comments</span>}
                                            </div>
                                        </div>
                                    </div>
                                )) || <p className="text-gray-500 text-center py-8">No pages discovered yet</p>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'contacts' && (
                        <div className="card">
                            <h3 className="text-lg font-bold mb-4">Extracted Contacts ({campaign.contacts?.length || 0})</h3>
                            <div className="space-y-3">
                                {campaign.contacts?.map(contact => {
                                    const domain = campaign.domains?.find(d => d.id === contact.domainId)
                                    return (
                                        <div key={contact.id} className="p-3 bg-gray-900/50 rounded-lg">
                                            <p className="font-medium text-sm mb-2">{domain?.url}</p>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                {contact.email && <p className="text-gray-400">📧 {contact.email}</p>}
                                                {contact.phone && <p className="text-gray-400">📞 {contact.phone}</p>}
                                            </div>
                                        </div>
                                    )
                                }) || <p className="text-gray-500 text-center py-8">No contacts extracted yet</p>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'submissions' && (
                        <div className="card">
                            <h3 className="text-lg font-bold mb-4">Submissions ({campaign.submissions?.length || 0})</h3>
                            <div className="space-y-3">
                                {campaign.submissions?.map(submission => {
                                    const page = campaign.pages?.find(p => p.id === submission.pageId)
                                    return (
                                        <div key={submission.id} className="p-3 bg-gray-900/50 rounded-lg">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <p className="text-xs text-gray-500">{submission.type}</p>
                                                    <a href={page?.url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 hover:underline">
                                                        {page?.url || 'Unknown page'}
                                                    </a>
                                                </div>
                                                <span className={`text-xs px-2 py-1 rounded ${submission.status === 'SUCCESS' ? 'bg-green-900/30 text-green-400' :
                                                    submission.status === 'CAPTCHA_DETECTED' ? 'bg-yellow-900/30 text-yellow-400' :
                                                        'bg-red-900/30 text-red-400'
                                                    }`}>
                                                    {submission.status}
                                                </span>
                                            </div>
                                            {submission.responseMessage && (
                                                <p className="text-xs text-gray-400">{submission.responseMessage}</p>
                                            )}
                                        </div>
                                    )
                                }) || <p className="text-gray-500 text-center py-8">No submissions yet</p>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'logs' && (
                        <div className="card">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold">Activity Logs</h3>
                                <button onClick={fetchCampaign} className="text-sm text-indigo-400 hover:text-indigo-300">
                                    Refresh Logs
                                </button>
                            </div>
                            <div className="space-y-2">
                                {logs.map(log => (
                                    <div key={log.id} className="p-3 bg-gray-900/50 rounded-lg text-sm font-mono border-l-4 border-gray-700 hover:bg-gray-800 transition-colors"
                                        style={{
                                            borderLeftColor: log.status === 'COMPLETED' ? '#4ade80' :
                                                log.status === 'FAILED' ? '#f87171' :
                                                    log.status === 'PROCESSING' ? '#60a5fa' :
                                                        log.status === 'PENDING' ? '#facc15' : '#374151'
                                        }}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-gray-300">{log.taskType}</span>
                                            <span className="text-xs text-gray-500">{new Date(log.createdAt).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className={`px-1.5 py-0.5 rounded ${log.status === 'COMPLETED' ? 'bg-green-900/30 text-green-400' :
                                                log.status === 'FAILED' ? 'bg-red-900/30 text-red-400' :
                                                    log.status === 'PROCESSING' ? 'bg-blue-900/30 text-blue-400' :
                                                        'bg-gray-700 text-gray-400'
                                                }`}>
                                                {log.status}
                                            </span>
                                            {log.attempts > 0 && <span className="text-gray-600">Attempt: {log.attempts}</span>}
                                        </div>
                                        {log.errorMessage && (
                                            <div className="mt-2 text-red-400 bg-red-900/10 p-2 rounded break-all">
                                                {log.errorMessage}
                                            </div>
                                        )}
                                        {log.result && (
                                            <div className="mt-2 text-gray-400 break-all opacity-75">
                                                {log.result.substring(0, 150)}{log.result.length > 150 ? '...' : ''}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {logs.length === 0 && (
                                    <p className="text-gray-500 text-center py-8">No activity logs found</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CreateCampaignPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [campaignId, setCampaignId] = useState(null)
    const [uploadProgress, setUploadProgress] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        processingMode: 'MANUAL',
        maxPagesPerDomain: 50,
        submitForms: true,
        submitComments: true,
        messageTemplate: '',
        senderName: process.env.NEXT_PUBLIC_DEFAULT_NAME || '',
        senderEmail: process.env.NEXT_PUBLIC_DEFAULT_EMAIL || '',
    })

    const [file, setFile] = useState(null)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Create campaign
            const campaignResponse = await fetch('/api/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })

            const campaignData = await campaignResponse.json()

            if (!campaignResponse.ok) {
                throw new Error(campaignData.error || 'Failed to create campaign')
            }

            setCampaignId(campaignData.campaign.id)

            // Upload file if provided
            if (file) {
                setUploadProgress(true)

                const uploadFormData = new FormData()
                uploadFormData.append('file', file)
                uploadFormData.append('campaignId', campaignData.campaign.id)

                const uploadResponse = await fetch('/api/upload', {
                    method: 'POST',
                    body: uploadFormData,
                })

                const uploadData = await uploadResponse.json()

                if (!uploadResponse.ok) {
                    throw new Error(uploadData.error || 'Failed to upload file')
                }

                alert(`Campaign created! ${uploadData.domainsCreated} domains added.`)
                router.push(`/campaigns/${campaignData.campaign.id}`)
            } else {
                alert('Campaign created! Add domains to start processing.')
                router.push(`/campaigns/${campaignData.campaign.id}`)
            }

        } catch (error) {
            alert(`Error: ${error.message}`)
        } finally {
            setLoading(false)
            setUploadProgress(false)
        }
    }

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-3xl mx-auto">
                <div className="mb-8">
                    <Link href="/" className="text-indigo-400 hover:text-indigo-300 mb-4 inline-block">
                        ← Back to Dashboard
                    </Link>
                    <h1 className="text-4xl font-bold gradient-text mb-2">
                        Create New Campaign
                    </h1>
                    <p className="text-gray-400">
                        Configure your automation campaign settings
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="card space-y-6">
                    {/* Campaign Name */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Campaign Name *
                        </label>
                        <input
                            type="text"
                            required
                            className="input"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="My Outreach Campaign"
                        />
                    </div>

                    {/* Database Storage */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Database Storage *
                        </label>
                        <select
                            className="input"
                            value={formData.storageType || 'SQLITE'}
                            onChange={(e) => setFormData({ ...formData, storageType: e.target.value })}
                        >
                            <option value="SQLITE">SQLite (Local Server) - Fast, Free, Limited Scale</option>
                            <option value="SUPABASE">Supabase (Cloud) - Scalable, Requires Config</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            {formData.storageType === 'SUPABASE'
                                ? '⚠️ Requires SUPABASE_URL in .env. Data is saved to cloud automatically.'
                                : 'Data saved locally on this VPS. Best for smaller campaigns (<50k domains).'}
                        </p>
                    </div>

                    {/* Processing Mode */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Processing Mode *
                        </label>
                        <select
                            className="input"
                            value={formData.processingMode}
                            onChange={(e) => setFormData({ ...formData, processingMode: e.target.value })}
                        >
                            <option value="MANUAL">Manual (Trigger manually)</option>
                            <option value="CRON">Cron Job (Automatic every 5 minutes)</option>
                        </select>
                    </div>

                    {/* Max Pages */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Max Pages Per Domain *
                        </label>
                        <input
                            type="number"
                            required
                            min="1"
                            max="500"
                            className="input"
                            value={formData.maxPagesPerDomain}
                            onChange={(e) => setFormData({ ...formData, maxPagesPerDomain: parseInt(e.target.value) })}
                        />
                        <p className="text-xs text-gray-500 mt-1">Limit how many pages to crawl per domain</p>
                    </div>

                    {/* Submission Types */}
                    <div>
                        <label className="block text-sm font-medium mb-3">
                            Submission Types *
                        </label>
                        <div className="space-y-2">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5"
                                    checked={formData.submitForms}
                                    onChange={(e) => setFormData({ ...formData, submitForms: e.target.checked })}
                                />
                                <span>Submit Contact Forms</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5"
                                    checked={formData.submitComments}
                                    onChange={(e) => setFormData({ ...formData, submitComments: e.target.checked })}
                                />
                                <span>Post Comments</span>
                            </label>
                        </div>
                    </div>

                    {/* Sender Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Your Name *
                            </label>
                            <input
                                type="text"
                                required
                                className="input"
                                value={formData.senderName}
                                onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                                placeholder="John Doe"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Your Email *
                            </label>
                            <input
                                type="email"
                                required
                                className="input"
                                value={formData.senderEmail}
                                onChange={(e) => setFormData({ ...formData, senderEmail: e.target.value })}
                                placeholder="john@example.com"
                            />
                        </div>
                    </div>

                    {/* Message Template */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Message Template *
                        </label>
                        <textarea
                            required
                            className="textarea"
                            value={formData.messageTemplate}
                            onChange={(e) => setFormData({ ...formData, messageTemplate: e.target.value })}
                            placeholder="Hi, I'm interested in learning more about your services..."
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            This message will be used for all form and comment submissions
                        </p>
                    </div>

                    {/* Domain File Upload */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Domain List File (Optional)
                        </label>
                        <input
                            type="file"
                            accept=".txt"
                            className="input"
                            onChange={(e) => setFile(e.target.files[0])}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Upload a .txt file with one domain per line (e.g., example.com)
                        </p>
                    </div>

                    {/* Submit Button */}
                    <div className="flex gap-4 pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary flex-1"
                        >
                            {loading ? (
                                uploadProgress ? 'Uploading Domains...' : 'Creating Campaign...'
                            ) : (
                                '✨ Create Campaign'
                            )}
                        </button>

                        <Link href="/" className="btn-secondary">
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    )
}

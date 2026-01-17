'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CreateCampaignModal({ isOpen, onClose, onCampaignCreated }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        processingMode: 'MANUAL',
        maxPagesPerDomain: 50,
        submitForms: true,
        submitComments: true,
        messageTemplate: '',
        senderName: process.env.NEXT_PUBLIC_DEFAULT_NAME || '',
        senderEmail: process.env.NEXT_PUBLIC_DEFAULT_EMAIL || '',
        storageType: 'SQLITE' // Default to SQLite
    })

    const [file, setFile] = useState(null)

    if (!isOpen) return null

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

            let successMessage = 'Campaign created!'

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
                successMessage += ` ${uploadData.domainsCreated} domains added.`
            }

            alert(successMessage)

            // Reset form
            setFormData({
                name: '',
                processingMode: 'MANUAL',
                maxPagesPerDomain: 50,
                submitForms: true,
                submitComments: true,
                messageTemplate: '',
                senderName: process.env.NEXT_PUBLIC_DEFAULT_NAME || '',
                senderEmail: process.env.NEXT_PUBLIC_DEFAULT_EMAIL || '',
                storageType: 'SQLITE'
            })
            setFile(null)

            // Callback to refresh dashboard and close modal
            onCampaignCreated()
            onClose()

        } catch (error) {
            alert(`Error: ${error.message}`)
        } finally {
            setLoading(false)
            setUploadProgress(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <h2 className="text-2xl font-bold gradient-text">New Campaign</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Database Storage - DUAL SUPPORT */}
                    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                        <label className="block text-sm font-medium mb-2 text-indigo-400">
                            Database Storage
                        </label>
                        <select
                            className="input bg-gray-900"
                            value={formData.storageType}
                            onChange={(e) => setFormData({ ...formData, storageType: e.target.value })}
                        >
                            <option value="SQLITE">SQLite (Local Server) - Fast, Free</option>
                            <option value="SUPABASE">Supabase (Cloud) - Scalable, Remote</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            {formData.storageType === 'SUPABASE'
                                ? '⚠️ Saves data to Supabase Cloud. Requires valid SUPABASE_URL.'
                                : 'Saves data locally. Best for standard usage.'}
                        </p>
                    </div>

                    {/* Campaign Name */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Campaign Name *</label>
                        <input
                            type="text"
                            required
                            className="input"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="My Outreach Campaign"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Processing Mode */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Mode</label>
                            <select
                                className="input"
                                value={formData.processingMode}
                                onChange={(e) => setFormData({ ...formData, processingMode: e.target.value })}
                            >
                                <option value="MANUAL">Manual Trigger</option>
                                <option value="CRON">Cron Job (Auto)</option>
                            </select>
                        </div>

                        {/* Max Pages */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Max Pages/Domain</label>
                            <input
                                type="number"
                                required
                                min="1"
                                max="500"
                                className="input"
                                value={formData.maxPagesPerDomain}
                                onChange={(e) => setFormData({ ...formData, maxPagesPerDomain: parseInt(e.target.value) })}
                            />
                        </div>
                    </div>

                    {/* Submission Types */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Actions</label>
                        <div className="flex gap-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded bg-gray-800 border-gray-600"
                                    checked={formData.submitForms}
                                    onChange={(e) => setFormData({ ...formData, submitForms: e.target.checked })}
                                />
                                <span>Submit Forms</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded bg-gray-800 border-gray-600"
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
                            <label className="block text-sm font-medium mb-2">Your Name *</label>
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
                            <label className="block text-sm font-medium mb-2">Your Email *</label>
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
                        <label className="block text-sm font-medium mb-2">Message Template *</label>
                        <textarea
                            required
                            className="textarea h-24"
                            value={formData.messageTemplate}
                            onChange={(e) => setFormData({ ...formData, messageTemplate: e.target.value })}
                            placeholder="Message content..."
                        />
                    </div>

                    {/* Domain File Upload */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Domain List (.txt)</label>
                        <input
                            type="file"
                            accept=".txt"
                            className="input p-2"
                            onChange={(e) => setFile(e.target.files[0])}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4 pt-4 border-t border-gray-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary flex-1"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary flex-1"
                        >
                            {loading ? (uploadProgress ? 'Uploading...' : 'Creating...') : '✨ Create Campaign'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

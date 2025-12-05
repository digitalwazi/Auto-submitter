// Validation utilities

export function isValidUrl(string) {
    try {
        const url = new URL(string)
        return url.protocol === 'http:' || url.protocol === 'https:'
    } catch (_) {
        return false
    }
}

export function normalizeUrl(url, baseUrl = null) {
    try {
        if (baseUrl) {
            return new URL(url, baseUrl).href
        }
        return new URL(url).href
    } catch (_) {
        return null
    }
}

export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

export function isValidPhone(phone) {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '')
    // Check if it has 10-15 digits (international format)
    return digits.length >= 10 && digits.length <= 15
}

export function getDomain(url) {
    try {
        const urlObj = new URL(url)
        return urlObj.hostname
    } catch (_) {
        return null
    }
}

export function isSameDomain(url1, url2) {
    return getDomain(url1) === getDomain(url2)
}

export function sanitizeFilename(filename) {
    return filename.replace(/[^a-z0-9_\-\.]/gi, '_')
}

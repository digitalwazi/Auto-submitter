/**
 * Smart Form Prioritization
 * 
 * Features:
 * - Score forms by type (contact > newsletter)
 * - Skip forms with too many required fields
 * - Prioritize forms without CAPTCHA
 * - Learn from success/failure rates
 * - Prioritize by plugin type (known plugins rank higher)
 */

// ============================================================
// SCORING CONFIGURATION
// ============================================================

/**
 * Form type scores (higher = better)
 */
const FORM_TYPE_SCORES = {
    'contact': 100,
    'inquiry': 95,
    'feedback': 90,
    'quote': 85,
    'request': 85,
    'generic-contact': 80,
    'booking': 75,
    'appointment': 75,

    'subscribe': 60,
    'newsletter': 55,
    'signup': 50,
    'registration': 45,
    'optin': 40,
    'lead-form': 40,
    'lead-gen': 40,

    'unknown': 30,
}

/**
 * Plugin type scores (higher = more reliable)
 */
const PLUGIN_SCORES = {
    // Most reliable (well-known, standard behavior)
    'contact-form-7': 100,
    'gravity-forms': 100,
    'wpforms': 95,
    'ninja-forms': 90,
    'formidable-forms': 85,
    'fluent-forms': 85,

    // Page builders (usually work well)
    'elementor': 80,
    'divi': 75,
    'beaver-builder': 75,
    'avada': 70,

    // Email marketing (may require double opt-in)
    'mailchimp': 60,
    'mailchimp-wp': 65,
    'hubspot': 60,
    'convertkit': 55,
    'activecampaign': 55,

    // Generic/unknown
    'generic': 40,
    'unknown': 30,
    'standard': 35,

    // Iframe forms (harder to submit)
    'google-forms': 20,
    'typeform': 20,
    'jotform': 25,
}

// ============================================================
// SCORING FUNCTIONS
// ============================================================

/**
 * Calculate overall form score
 */
export function calculateFormScore(form, options = {}) {
    let score = 50 // Base score
    const factors = []

    // 1. Form type score
    const typeScore = FORM_TYPE_SCORES[form.pluginType] || FORM_TYPE_SCORES['unknown']
    score += typeScore * 0.3 // 30% weight
    factors.push({ factor: 'formType', value: form.pluginType, contribution: typeScore * 0.3 })

    // 2. Plugin reliability score
    const pluginScore = PLUGIN_SCORES[form.pluginType] || PLUGIN_SCORES['unknown']
    score += pluginScore * 0.2 // 20% weight
    factors.push({ factor: 'pluginType', value: form.pluginType, contribution: pluginScore * 0.2 })

    // 3. Field count penalty
    const fieldCount = form.fields?.length || 0
    let fieldPenalty = 0
    if (fieldCount > 10) fieldPenalty = -30
    else if (fieldCount > 7) fieldPenalty = -20
    else if (fieldCount > 5) fieldPenalty = -10
    else if (fieldCount >= 3) fieldPenalty = 0
    else if (fieldCount < 2) fieldPenalty = -25 // Too few fields is suspicious

    score += fieldPenalty
    factors.push({ factor: 'fieldCount', value: fieldCount, contribution: fieldPenalty })

    // 4. Required fields penalty
    const requiredCount = form.fields?.filter(f => f.required).length || 0
    let requiredPenalty = 0
    if (requiredCount > 7) requiredPenalty = -25
    else if (requiredCount > 5) requiredPenalty = -15
    else if (requiredCount > 3) requiredPenalty = -5

    score += requiredPenalty
    factors.push({ factor: 'requiredFields', value: requiredCount, contribution: requiredPenalty })

    // 5. CAPTCHA penalty
    const hasCaptcha = detectCaptchaInForm(form)
    if (hasCaptcha) {
        score -= 40
        factors.push({ factor: 'captcha', value: true, contribution: -40 })
    }

    // 6. Iframe penalty
    if (form.isIframe) {
        score -= 30
        factors.push({ factor: 'iframe', value: true, contribution: -30 })
    }

    // 7. Bonus for having message/textarea field
    const hasMessageField = form.fields?.some(f =>
        f.tagName === 'textarea' ||
        f.name?.toLowerCase().includes('message') ||
        f.name?.toLowerCase().includes('comment')
    )
    if (hasMessageField) {
        score += 15
        factors.push({ factor: 'hasMessageField', value: true, contribution: 15 })
    }

    // 8. Bonus for having email field
    const hasEmailField = form.fields?.some(f =>
        f.type === 'email' ||
        f.name?.toLowerCase().includes('email')
    )
    if (hasEmailField) {
        score += 10
        factors.push({ factor: 'hasEmailField', value: true, contribution: 10 })
    }

    // Normalize score to 0-100
    score = Math.max(0, Math.min(100, score))

    return {
        score: Math.round(score),
        factors,
        recommendation: getRecommendation(score),
    }
}

/**
 * Detect CAPTCHA indicators in form
 */
function detectCaptchaInForm(form) {
    const captchaIndicators = [
        'captcha', 'recaptcha', 'hcaptcha', 'g-recaptcha',
        'cf-turnstile', 'arkose', 'funcaptcha',
    ]

    const formJson = JSON.stringify(form).toLowerCase()
    return captchaIndicators.some(indicator => formJson.includes(indicator))
}

/**
 * Get recommendation based on score
 */
function getRecommendation(score) {
    if (score >= 80) return { action: 'submit', priority: 'high', message: 'High success probability' }
    if (score >= 60) return { action: 'submit', priority: 'medium', message: 'Good success probability' }
    if (score >= 40) return { action: 'try', priority: 'low', message: 'May have issues, try anyway' }
    if (score >= 20) return { action: 'skip', priority: 'skip', message: 'Low success probability' }
    return { action: 'skip', priority: 'avoid', message: 'Very unlikely to succeed' }
}

// ============================================================
// SORTING AND FILTERING
// ============================================================

/**
 * Sort forms by priority score
 */
export function sortFormsByPriority(forms) {
    return forms
        .map(form => ({
            ...form,
            _priority: calculateFormScore(form),
        }))
        .sort((a, b) => b._priority.score - a._priority.score)
}

/**
 * Filter forms by minimum score
 */
export function filterFormsByScore(forms, minScore = 40) {
    return forms.filter(form => {
        const { score } = calculateFormScore(form)
        return score >= minScore
    })
}

/**
 * Get top N forms for submission
 */
export function getTopForms(forms, count = 3, minScore = 30) {
    const sorted = sortFormsByPriority(forms)
    const filtered = sorted.filter(f => f._priority.score >= minScore)
    return filtered.slice(0, count)
}

// ============================================================
// LEARNING FROM RESULTS
// ============================================================

// In-memory success rate tracking
const successRates = new Map()

/**
 * Record submission result for learning
 */
export function recordResult(pluginType, formType, success) {
    const key = `${pluginType}|${formType}`

    const current = successRates.get(key) || { success: 0, total: 0 }
    current.total++
    if (success) current.success++

    successRates.set(key, current)
}

/**
 * Get learned success rate for a form type
 */
export function getLearnedSuccessRate(pluginType, formType) {
    const key = `${pluginType}|${formType}`
    const data = successRates.get(key)

    if (!data || data.total < 5) {
        return null // Not enough data
    }

    return {
        rate: data.success / data.total,
        total: data.total,
        success: data.success,
    }
}

/**
 * Apply learned rates to scoring
 */
export function calculateFormScoreWithLearning(form) {
    const baseScore = calculateFormScore(form)

    // Get learned data
    const learned = getLearnedSuccessRate(form.pluginType, form.formType)

    if (learned && learned.total >= 10) {
        // Adjust score based on learned success rate
        const adjustment = (learned.rate - 0.5) * 40 // ±20 points for 0-100% success
        baseScore.score = Math.max(0, Math.min(100, baseScore.score + adjustment))
        baseScore.factors.push({
            factor: 'learnedRate',
            value: `${Math.round(learned.rate * 100)}% (${learned.total} samples)`,
            contribution: adjustment,
        })
    }

    return baseScore
}

// ============================================================
// FORM ANALYSIS
// ============================================================

/**
 * Analyze a page's forms and provide recommendations
 */
export function analyzePageForms(forms) {
    if (!forms || forms.length === 0) {
        return {
            totalForms: 0,
            recommendation: 'No forms found on this page',
            forms: [],
        }
    }

    const analyzed = forms.map(form => ({
        ...form,
        analysis: calculateFormScore(form),
    }))

    // Sort by score
    analyzed.sort((a, b) => b.analysis.score - a.analysis.score)

    // Get stats
    const highPriority = analyzed.filter(f => f.analysis.score >= 70)
    const mediumPriority = analyzed.filter(f => f.analysis.score >= 40 && f.analysis.score < 70)
    const lowPriority = analyzed.filter(f => f.analysis.score < 40)

    return {
        totalForms: forms.length,
        highPriority: highPriority.length,
        mediumPriority: mediumPriority.length,
        lowPriority: lowPriority.length,
        bestForm: analyzed[0] || null,
        forms: analyzed,
        recommendation: getPageRecommendation(analyzed),
    }
}

/**
 * Get recommendation for entire page
 */
function getPageRecommendation(analyzedForms) {
    if (analyzedForms.length === 0) {
        return 'No forms found'
    }

    const best = analyzedForms[0]

    if (best.analysis.score >= 80) {
        return `Found excellent form (${best.pluginType}) - high success probability`
    } else if (best.analysis.score >= 60) {
        return `Found good form (${best.pluginType}) - medium success probability`
    } else if (best.analysis.score >= 40) {
        return `Forms available but may have issues - try with caution`
    } else {
        return `Forms found but all have low success probability`
    }
}

// ============================================================
// EXPORT UTILITIES
// ============================================================

export {
    FORM_TYPE_SCORES,
    PLUGIN_SCORES,
}

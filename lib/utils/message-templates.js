/**
 * Dynamic Message Templates with SpinTax
 * 
 * Features:
 * - SpinTax: {Hi|Hello|Hey} → random selection
 * - Variables: {name}, {domain}, {date}, {company}
 * - Nested SpinTax: {I {love|like} your {site|website}}
 * - Template validation
 * - Preview functionality
 */

// ============================================================
// SPINTAX PROCESSOR
// ============================================================

/**
 * Process SpinTax syntax and return randomized text
 * Example: "{Hi|Hello|Hey} {friend|there}!" → "Hello there!"
 */
export function processSpinTax(text) {
    if (!text) return ''

    // Process nested SpinTax from inside out
    let result = text
    let maxIterations = 10 // Prevent infinite loops

    while (maxIterations > 0 && result.includes('{') && result.includes('|')) {
        result = result.replace(/\{([^{}]+)\}/g, (match, content) => {
            // Check if this is a SpinTax block (contains |)
            if (content.includes('|')) {
                const options = content.split('|')
                return options[Math.floor(Math.random() * options.length)]
            }
            // Not a SpinTax block, keep as is (might be a variable)
            return match
        })
        maxIterations--
    }

    return result
}

// ============================================================
// VARIABLE SUBSTITUTION
// ============================================================

/**
 * Available variables for message templates
 */
export const TEMPLATE_VARIABLES = {
    // Sender info
    name: 'Sender name',
    email: 'Sender email',
    phone: 'Sender phone',
    company: 'Sender company name',
    website: 'Sender website',

    // Target info
    domain: 'Target domain name',
    domainName: 'Target domain without extension',
    siteName: 'Target site title',

    // Date/Time
    date: 'Current date (MM/DD/YYYY)',
    dateShort: 'Current date (MM/DD)',
    time: 'Current time (HH:MM)',
    year: 'Current year',
    month: 'Current month name',
    day: 'Current day name',

    // Dynamic
    random: 'Random 4-digit number',
    randomId: 'Random alphanumeric ID',
}

/**
 * Substitute variables in template with actual values
 */
export function substituteVariables(template, data = {}) {
    if (!template) return ''

    const now = new Date()
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December']
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    // Build variable map
    const variables = {
        // Sender info
        name: data.name || data.senderName || 'User',
        email: data.email || data.senderEmail || 'user@example.com',
        phone: data.phone || '',
        company: data.company || data.name || 'Company',
        website: data.website || '',

        // Target info
        domain: data.domain || 'example.com',
        domainName: (data.domain || 'example.com').replace(/\.[^.]+$/, ''),
        siteName: data.siteName || data.domain || 'Your Site',

        // Date/Time
        date: now.toLocaleDateString('en-US'),
        dateShort: `${now.getMonth() + 1}/${now.getDate()}`,
        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        year: now.getFullYear().toString(),
        month: months[now.getMonth()],
        day: days[now.getDay()],

        // Dynamic
        random: Math.floor(1000 + Math.random() * 9000).toString(),
        randomId: Math.random().toString(36).substring(2, 8).toUpperCase(),
    }

    // Replace all variables
    let result = template
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{${key}\\}`, 'gi')
        result = result.replace(regex, value)
    }

    return result
}

// ============================================================
// TEMPLATE PROCESSING (Combined)
// ============================================================

/**
 * Process a complete message template
 * 1. First substitute variables
 * 2. Then process SpinTax
 */
export function processTemplate(template, data = {}) {
    if (!template) return ''

    // Step 1: Substitute variables
    let result = substituteVariables(template, data)

    // Step 2: Process SpinTax
    result = processSpinTax(result)

    return result.trim()
}

/**
 * Generate multiple unique messages from a template
 */
export function generateMessages(template, data = {}, count = 5) {
    const messages = new Set()
    const maxAttempts = count * 3
    let attempts = 0

    while (messages.size < count && attempts < maxAttempts) {
        const message = processTemplate(template, data)
        messages.add(message)
        attempts++
    }

    return Array.from(messages)
}

// ============================================================
// TEMPLATE VALIDATION
// ============================================================

/**
 * Validate a message template
 */
export function validateTemplate(template) {
    const errors = []
    const warnings = []

    if (!template || template.trim().length === 0) {
        errors.push('Template is empty')
        return { valid: false, errors, warnings }
    }

    // Check for balanced braces
    const openBraces = (template.match(/\{/g) || []).length
    const closeBraces = (template.match(/\}/g) || []).length

    if (openBraces !== closeBraces) {
        errors.push('Unbalanced braces - check { and } pairs')
    }

    // Check for empty SpinTax options
    if (template.includes('||')) {
        warnings.push('Empty SpinTax option detected (double pipes)')
    }

    // Check for unknown variables
    const variableMatches = template.match(/\{([a-zA-Z]+)\}/g) || []
    for (const match of variableMatches) {
        const varName = match.slice(1, -1).toLowerCase()
        if (!TEMPLATE_VARIABLES[varName] && !match.includes('|')) {
            warnings.push(`Unknown variable: ${match}`)
        }
    }

    // Check minimum length (after processing)
    const processed = processTemplate(template, { name: 'Test', domain: 'test.com' })
    if (processed.length < 10) {
        warnings.push('Template produces very short messages')
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        preview: processed,
    }
}

// ============================================================
// PRESET TEMPLATES
// ============================================================

export const PRESET_TEMPLATES = [
    {
        name: 'Professional Inquiry',
        template: `{Hi|Hello|Greetings},

{I came across|I found|I discovered} your {website|site} and {I'm impressed|I was impressed|I really like} {with what I see|by your work|by your services}.

{I would love to|I'd like to|I'm interested to} {learn more|know more|get more information} about your {services|offerings|solutions}.

{Best regards|Kind regards|Sincerely},
{name}`,
    },
    {
        name: 'Quick Contact',
        template: `{Hi|Hello} there!

{Just reaching out|Wanted to reach out|Quick message} about your {services|business}. {I'm interested|Very interested|Would love} to {connect|chat|discuss}.

{Thanks|Thank you}!
{name}`,
    },
    {
        name: 'Business Proposal',
        template: `{Dear|Hello} {Team|Sir/Madam},

{I represent|I'm from|I work with} {company} and we {specialize in|offer|provide} {solutions|services} that {could benefit|may interest|might help} your {business|organization|company}.

{Could we schedule|Would you be open to|May I request} a {brief call|quick meeting|discussion} to {explore|discuss} {potential collaboration|opportunities|partnership}?

{Best regards|Warm regards},
{name}
{email}`,
    },
    {
        name: 'Feedback Request',
        template: `{Hi|Hello|Hey},

{I've been|I was} {exploring|browsing|checking out} {domain} and {I love|I really like|I'm impressed by} {your approach|what you've built|your work}.

{Would you mind|Could you|Would it be possible to} {share some insights|give me some feedback|help me understand} {about|regarding} {your process|how you got started|your journey}?

{Thanks so much|Thank you|Appreciate it}!
{name}`,
    },
    {
        name: 'Newsletter/Subscribe',
        template: `{Hi|Hey|Hello}! {I'd love to|I want to|Please} {subscribe|sign me up|add me} to your {newsletter|mailing list|updates}.

{Looking forward to|Excited for|Can't wait for} your {emails|content|updates}!

{name}
{email}`,
    },
]

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get preview of template with sample data
 */
export function getTemplatePreview(template, customData = {}) {
    const sampleData = {
        name: customData.name || 'John Smith',
        email: customData.email || 'john@company.com',
        company: customData.company || 'ABC Company',
        domain: customData.domain || 'example.com',
        siteName: customData.siteName || 'Example Site',
        ...customData,
    }

    return processTemplate(template, sampleData)
}

/**
 * Count SpinTax variations in a template
 */
export function countVariations(template) {
    if (!template) return 1

    const spinTaxBlocks = template.match(/\{[^{}]*\|[^{}]*\}/g) || []
    let variations = 1

    for (const block of spinTaxBlocks) {
        const options = block.slice(1, -1).split('|').length
        variations *= options
    }

    return variations
}

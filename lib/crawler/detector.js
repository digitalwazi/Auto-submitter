import * as cheerio from 'cheerio'

export function detectForms(html, pageUrl) {
    const $ = cheerio.load(html)
    const forms = []

    $('form').each((index, element) => {
        const form = $(element)
        const action = form.attr('action') || pageUrl
        const method = (form.attr('method') || 'GET').toUpperCase()

        // Analyze form fields
        const fields = []
        form.find('input, textarea, select').each((i, field) => {
            const $field = $(field)
            const type = $field.attr('type') || 'text'
            const name = $field.attr('name')
            const id = $field.attr('id')
            const placeholder = $field.attr('placeholder')
            const label = findLabelFor($, $field, id)

            if (name || id) {
                fields.push({
                    type,
                    name,
                    id,
                    placeholder,
                    label,
                    tagName: field.tagName,
                    required: $field.attr('required') !== undefined,
                })
            }
        })

        // Determine if this looks like a contact/comment form
        const isContactForm = isLikelyContactForm(fields, form.text())

        if (isContactForm && fields.length > 0) {
            forms.push({
                action,
                method,
                fields,
                formIndex: index,
                selector: generateFormSelector(form, index),
            })
        }
    })

    return forms
}

export function detectCommentSections(html, pageUrl) {
    const $ = cheerio.load(html)
    const commentSections = []

    // WordPress comments
    if ($('#commentform, #respond, .comment-form').length > 0) {
        const form = $('#commentform, #respond form, .comment-form').first()
        commentSections.push({
            type: 'wordpress',
            selector: generateFormSelector(form, 0),
            fields: extractFormFields($, form),
        })
    }

    // Disqus
    if ($('#disqus_thread').length > 0 || $('[data-disqus-identifier]').length > 0) {
        commentSections.push({
            type: 'disqus',
            selector: '#disqus_thread',
            fields: [], // Disqus is iframe-based, harder to automate
        })
    }

    // Generic comment forms
    $('form').each((index, element) => {
        const form = $(element)
        const formText = form.text().toLowerCase()

        if (formText.includes('comment') || formText.includes('reply')) {
            const fields = extractFormFields($, form)
            if (fields.some(f => f.name && f.name.toLowerCase().includes('comment'))) {
                commentSections.push({
                    type: 'generic',
                    selector: generateFormSelector(form, index),
                    fields,
                })
            }
        }
    })

    return commentSections
}

function findLabelFor($, field, fieldId) {
    const parent = field.parent()

    // Check for label with 'for' attribute
    if (fieldId) {
        const label = $(`label[for="${fieldId}"]`)
        if (label.length > 0) {
            return label.text().trim()
        }
    }

    // Check for parent label
    const parentLabel = field.closest('label')
    if (parentLabel.length > 0) {
        return parentLabel.text().trim()
    }

    // Check previous sibling
    const prevLabel = field.prev('label')
    if (prevLabel.length > 0) {
        return prevLabel.text().trim()
    }

    return null
}

function isLikelyContactForm(fields, formText) {
    const text = formText.toLowerCase()

    // Check for contact keywords
    const hasContactKeyword = text.includes('contact') ||
        text.includes('message') ||
        text.includes('inquiry') ||
        text.includes('get in touch') ||
        text.includes('email us')

    // Check for typical contact form fields
    const hasEmailField = fields.some(f =>
        f.type === 'email' ||
        (f.name && f.name.toLowerCase().includes('email')) ||
        (f.label && f.label.toLowerCase().includes('email'))
    )

    const hasMessageField = fields.some(f =>
        f.tagName === 'textarea' ||
        (f.name && (f.name.toLowerCase().includes('message') || f.name.toLowerCase().includes('comment'))) ||
        (f.label && (f.label.toLowerCase().includes('message') || f.label.toLowerCase().includes('comment')))
    )

    // Exclude search forms and login forms
    const isSearchForm = text.includes('search') && fields.length <= 2
    const isLoginForm = (text.includes('login') || text.includes('sign in')) &&
        !text.includes('contact')

    return hasContactKeyword && hasEmailField && hasMessageField && !isSearchForm && !isLoginForm
}

function extractFormFields($, form) {
    const fields = []

    form.find('input, textarea, select').each((i, field) => {
        const $field = $(field)
        const type = $field.attr('type') || 'text'
        const name = $field.attr('name')
        const id = $field.attr('id')

        if (name || id) {
            fields.push({
                type,
                name,
                id,
                placeholder: $field.attr('placeholder'),
                label: findLabelFor($, $field, id),
                tagName: field.tagName,
                required: $field.attr('required') !== undefined,
            })
        }
    })

    return fields
}

function generateFormSelector(form, index) {
    const id = form.attr('id')
    if (id) return `#${id}`

    const className = form.attr('class')
    if (className) {
        const firstClass = className.split(' ')[0]
        return `.${firstClass}`
    }

    return `form:nth-of-type(${index + 1})`
}

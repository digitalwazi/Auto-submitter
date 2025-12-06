import * as cheerio from 'cheerio'

export function detectForms(html, pageUrl) {
    const $ = cheerio.load(html)
    const forms = []

    // Detect WordPress form plugins (shortcodes, embedded forms)
    const formPluginChecks = [
        // Ninja Forms
        { selector: '.nf-form-container', type: 'ninja-forms' },
        { selector: '[data-nf-id]', type: 'ninja-forms' },
        // Contact Form 7
        { selector: '.wpcf7-form', type: 'contact-form-7' },
        { selector: '.wpcf7', type: 'contact-form-7' },
        // Gravity Forms
        { selector: '.gform_wrapper', type: 'gravity-forms' },
        { selector: '.gform_body', type: 'gravity-forms' },
        // WPForms
        { selector: '.wpforms-container', type: 'wpforms' },
        { selector: '.wpforms-form', type: 'wpforms' },
        // Elementor Forms
        { selector: '.elementor-form', type: 'elementor' },
        // Formidable Forms
        { selector: '.frm_forms', type: 'formidable' },
        // Fluent Forms
        { selector: '.fluentform', type: 'fluent-forms' },
    ]

    // Check for WordPress form plugins
    for (const { selector, type } of formPluginChecks) {
        $(selector).each((index, element) => {
            const container = $(element)

            // Extract fields from container
            const fields = []
            container.find('input, textarea, select').each((i, field) => {
                const $field = $(field)
                const fieldType = $field.attr('type') || 'text'
                const name = $field.attr('name')
                const id = $field.attr('id')

                // Skip hidden, submit, button fields
                if (fieldType === 'submit' || fieldType === 'button' || fieldType === 'hidden') {
                    return
                }

                if (name || id) {
                    fields.push({
                        type: fieldType,
                        name,
                        id,
                        placeholder: $field.attr('placeholder'),
                        label: findLabelFor($, $field, id),
                        tagName: field.tagName,
                        required: $field.attr('required') !== undefined,
                    })
                }
            })

            if (fields.length > 0) {
                const containerForm = container.find('form').first()
                forms.push({
                    action: containerForm.attr('action') || pageUrl,
                    method: (containerForm.attr('method') || 'POST').toUpperCase(),
                    fields,
                    formIndex: forms.length,
                    selector: selector,
                    pluginType: type,
                })
            }
        })
    }

    // Standard form detection
    $('form').each((index, element) => {
        const form = $(element)
        const action = form.attr('action') || pageUrl
        const method = (form.attr('method') || 'GET').toUpperCase()

        // Skip if already detected as plugin form
        const formSelector = generateFormSelector(form, index)
        if (forms.some(f => f.selector === formSelector)) {
            return
        }

        // Analyze form fields
        const fields = []
        form.find('input, textarea, select').each((i, field) => {
            const $field = $(field)
            const type = $field.attr('type') || 'text'
            const name = $field.attr('name')
            const id = $field.attr('id')

            // Skip hidden, submit, button fields
            if (type === 'submit' || type === 'button' || type === 'hidden') {
                return
            }

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

        // Determine if this looks like a contact/comment form
        const isContactForm = isLikelyContactForm(fields, form.text())

        if (isContactForm && fields.length > 0) {
            forms.push({
                action,
                method,
                fields,
                formIndex: forms.length,
                selector: formSelector,
            })
        }
    })

    return forms
}

export function detectCommentSections(html, pageUrl) {
    const $ = cheerio.load(html)
    const commentSections = []
    const seen = new Set()

    // WordPress comments
    if ($('#commentform, #respond, .comment-form').length > 0) {
        const form = $('#commentform, #respond form, .comment-form').first()
        const selector = generateFormSelector(form, 0)

        if (!seen.has(selector)) {
            commentSections.push({
                type: 'wordpress',
                selector,
                fields: extractFormFields($, form),
            })
            seen.add(selector)
        }
    }

    // Disqus
    if ($('#disqus_thread').length > 0 || $('[data-disqus-identifier]').length > 0) {
        const selector = '#disqus_thread'
        if (!seen.has(selector)) {
            commentSections.push({
                type: 'disqus',
                selector,
                fields: [], // Disqus is iframe-based, harder to automate
            })
            seen.add(selector)
        }
    }

    // Generic comment forms
    $('form').each((index, element) => {
        const form = $(element)
        const formText = form.text().toLowerCase()
        const selector = generateFormSelector(form, index)

        if (seen.has(selector)) return

        if (formText.includes('comment') || formText.includes('reply')) {
            const fields = extractFormFields($, form)
            if (fields.some(f => f.name && f.name.toLowerCase().includes('comment'))) {
                commentSections.push({
                    type: 'generic',
                    selector,
                    fields,
                })
                seen.add(selector)
            }
        }
    })

    return commentSections
}

function findLabelFor($, field, fieldId) {
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
        text.includes('email us') ||
        text.includes('send') ||
        text.includes('submit')

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

        // Skip hidden, submit, button fields
        if (type === 'submit' || type === 'button' || type === 'hidden') {
            return
        }

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

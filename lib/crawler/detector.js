import * as cheerio from 'cheerio'

/**
 * Comprehensive Form Detector
 * Detects ALL types of forms across different technologies:
 * - WordPress plugins (50+ types)
 * - Page builders (Elementor, Divi, Beaver, etc.)
 * - Iframe embedded forms (HubSpot, Mailchimp, Google Forms, etc.)
 * - Shortcode-based forms
 * - AJAX forms
 * - Standard HTML forms
 * - Multi-step forms
 * - Modal/popup forms
 */

// ============================================================
// FORM PLUGIN SELECTORS - Comprehensive list for all technologies
// ============================================================
const FORM_PLUGIN_SELECTORS = [
    // === WordPress Form Plugins ===
    { selector: '.wpcf7-form', type: 'contact-form-7' },
    { selector: '.wpcf7', type: 'contact-form-7' },
    { selector: 'form.wpcf7-form', type: 'contact-form-7' },
    { selector: '.gform_wrapper', type: 'gravity-forms' },
    { selector: '.gform_body', type: 'gravity-forms' },
    { selector: 'form[data-formid]', type: 'gravity-forms' },
    { selector: '.wpforms-container', type: 'wpforms' },
    { selector: '.wpforms-form', type: 'wpforms' },
    { selector: 'form.wpforms-validate', type: 'wpforms' },
    { selector: '.nf-form-container', type: 'ninja-forms' },
    { selector: '[data-nf-id]', type: 'ninja-forms' },
    { selector: '.nf-form-wrap', type: 'ninja-forms' },
    { selector: '.frm_forms', type: 'formidable-forms' },
    { selector: '.frm_form_fields', type: 'formidable-forms' },
    { selector: '.fluentform', type: 'fluent-forms' },
    { selector: '.ff-form-container', type: 'fluent-forms' },
    { selector: '.caldera-grid', type: 'caldera-forms' },
    { selector: '.caldera-form', type: 'caldera-forms' },
    { selector: '.happyforms-form', type: 'happyforms' },
    { selector: '.everest-forms', type: 'everest-forms' },
    { selector: '.evf-container', type: 'everest-forms' },
    { selector: '.forminator-ui', type: 'forminator' },
    { selector: '.forminator-custom-form', type: 'forminator' },
    { selector: '.quform', type: 'quform' },
    { selector: '.quform-form', type: 'quform' },
    { selector: '.weForms', type: 'weforms' },
    { selector: '.weforms_form', type: 'weforms' },
    { selector: '.jetpack-contact-form', type: 'jetpack' },
    { selector: '.grunion-contact-form', type: 'jetpack' },
    { selector: '.pirate-forms-contact', type: 'pirate-forms' },
    { selector: '.coblocks-form', type: 'coblocks' },
    { selector: '.kadence-form', type: 'kadence-blocks' },
    { selector: '.kb-form', type: 'kadence-blocks' },
    { selector: '.tnp-widget', type: 'newsletter-plugin' },
    { selector: '.tnp-subscription', type: 'newsletter-plugin' },
    { selector: '.mc4wp-form', type: 'mailchimp-wp' },
    { selector: 'form.mc4wp-form', type: 'mailchimp-wp' },

    // === Page Builders ===
    { selector: '.elementor-form', type: 'elementor' },
    { selector: 'form.elementor-form', type: 'elementor' },
    { selector: '.elementor-widget-form', type: 'elementor' },
    { selector: '.et_pb_contact_form', type: 'divi' },
    { selector: '.et_pb_contact_form_container', type: 'divi' },
    { selector: '.et_contact_form', type: 'divi' },
    { selector: '.fl-module-contact-form', type: 'beaver-builder' },
    { selector: '.fl-contact-form', type: 'beaver-builder' },
    { selector: '.uabb-contact-form', type: 'beaver-builder' },
    { selector: '.fusion-form', type: 'avada' },
    { selector: '.fusion-form-builder', type: 'avada' },
    { selector: '.themify-contact-form', type: 'themify' },
    { selector: '.brizy-form', type: 'brizy' },
    { selector: '.oxygen-form', type: 'oxygen' },
    { selector: '.bricks-form', type: 'bricks' },
    { selector: '.breakdance-form', type: 'breakdance' },
    { selector: '.ws-form', type: 'ws-form' },
    { selector: '.spectra-form', type: 'spectra' },
    { selector: '.generateblocks-form', type: 'generateblocks' },

    // === Landing Page Builders ===
    { selector: '.unbounce-form', type: 'unbounce' },
    { selector: '.leadpages-form', type: 'leadpages' },
    { selector: '.instapage-form', type: 'instapage' },
    { selector: '.clickfunnels-form', type: 'clickfunnels' },
    { selector: '.thrive-form', type: 'thrive-leads' },
    { selector: '.tve-leads-form', type: 'thrive-leads' },
    { selector: '.optinmonster-form', type: 'optinmonster' },
    { selector: '.om-holder', type: 'optinmonster' },

    // === Email Marketing / CRM ===
    { selector: '.mailchimp-form', type: 'mailchimp' },
    { selector: '#mc_embed_signup', type: 'mailchimp' },
    { selector: '.mc-embedded-subscribe-form', type: 'mailchimp' },
    { selector: '.klaviyo-form', type: 'klaviyo' },
    { selector: '.klv-form', type: 'klaviyo' },
    { selector: '.hubspot-form', type: 'hubspot' },
    { selector: '.hs-form', type: 'hubspot' },
    { selector: '.hbspt-form', type: 'hubspot' },
    { selector: 'form[data-form-id]', type: 'hubspot' },
    { selector: '.convertkit-form', type: 'convertkit' },
    { selector: '[data-sv-form]', type: 'convertkit' },
    { selector: '.aweber-form', type: 'aweber' },
    { selector: '.sendinblue-form', type: 'brevo' },
    { selector: '.sib-form', type: 'brevo' },
    { selector: '.getresponse-form', type: 'getresponse' },
    { selector: '.drip-form', type: 'drip' },
    { selector: '.activecampaign-form', type: 'activecampaign' },
    { selector: '._form', type: 'activecampaign' },
    { selector: '.constantcontact-form', type: 'constant-contact' },
    { selector: '.ctct-form-wrapper', type: 'constant-contact' },
    { selector: '.moosend-form', type: 'moosend' },
    { selector: '.sendfox-form', type: 'sendfox' },
    { selector: '.mailerlite-form', type: 'mailerlite' },
    { selector: '.ml-form-embedContainer', type: 'mailerlite' },

    // === Popup/Modal Forms ===
    { selector: '.popup-form', type: 'popup-form' },
    { selector: '.modal-form', type: 'modal-form' },
    { selector: '.lightbox-form', type: 'lightbox-form' },
    { selector: '.sumo-form', type: 'sumo' },
    { selector: '.bloom-form', type: 'bloom' },
    { selector: '.hustle-modal-form', type: 'hustle' },
    { selector: '.convertpro-form', type: 'convert-pro' },
    { selector: '.icegram-form', type: 'icegram' },

    // === E-commerce & Lead Gen ===
    { selector: '.woocommerce-form', type: 'woocommerce' },
    { selector: '.woocommerce-checkout', type: 'woocommerce' },
    { selector: '.shopify-form', type: 'shopify' },
    { selector: '.bigcommerce-form', type: 'bigcommerce' },
    { selector: '.leadgeneration-form', type: 'lead-gen' },
    { selector: '.lead-form', type: 'lead-form' },
    { selector: '.optin-form', type: 'optin' },
    { selector: '.signup-form', type: 'signup' },
    { selector: '.subscribe-form', type: 'subscribe' },
    { selector: '.newsletter-form', type: 'newsletter' },
    { selector: '.registration-form', type: 'registration' },

    // === Other CMS ===
    { selector: '.joomla-form', type: 'joomla' },
    { selector: '.drupal-form', type: 'drupal' },
    { selector: '.webflow-form', type: 'webflow' },
    { selector: '.wix-form', type: 'wix' },
    { selector: '.squarespace-form', type: 'squarespace' },
    { selector: '.weebly-form', type: 'weebly' },

    // === AJAX/Dynamic Forms ===
    { selector: '[data-ajax-form]', type: 'ajax-form' },
    { selector: '[data-submit="ajax"]', type: 'ajax-form' },
    { selector: 'form[data-ajax]', type: 'ajax-form' },
    { selector: '.ajax-form', type: 'ajax-form' },
    { selector: '.async-form', type: 'async-form' },

    // === Multi-step Forms ===
    { selector: '.multi-step-form', type: 'multi-step' },
    { selector: '.wizard-form', type: 'wizard' },
    { selector: '.step-form', type: 'step-form' },
    { selector: '[data-multi-step]', type: 'multi-step' },

    // === React/Vue/Angular Forms ===
    { selector: '[data-reactroot] form', type: 'react' },
    { selector: '.react-form', type: 'react' },
    { selector: '[ng-form]', type: 'angular' },
    { selector: '[data-v-] form', type: 'vue' },

    // === Generic Contact Forms ===
    { selector: '#contact-form', type: 'generic-contact' },
    { selector: '.contact-form', type: 'generic-contact' },
    { selector: '#contactForm', type: 'generic-contact' },
    { selector: '.contactForm', type: 'generic-contact' },
    { selector: '#inquiry-form', type: 'inquiry' },
    { selector: '.inquiry-form', type: 'inquiry' },
    { selector: '#feedback-form', type: 'feedback' },
    { selector: '.feedback-form', type: 'feedback' },
    { selector: '#quote-form', type: 'quote' },
    { selector: '.quote-form', type: 'quote' },
    { selector: '#request-form', type: 'request' },
    { selector: '.request-form', type: 'request' },
]

// ============================================================
// IFRAME FORM DETECTORS
// ============================================================
const IFRAME_FORM_PATTERNS = [
    { pattern: /google\.com\/forms/, type: 'google-forms' },
    { pattern: /docs\.google\.com\/forms/, type: 'google-forms' },
    { pattern: /typeform\.com/, type: 'typeform' },
    { pattern: /jotform\.com/, type: 'jotform' },
    { pattern: /wufoo\.com/, type: 'wufoo' },
    { pattern: /formstack\.com/, type: 'formstack' },
    { pattern: /cognito\.com/, type: 'cognito' },
    { pattern: /123formbuilder\.com/, type: '123formbuilder' },
    { pattern: /zoho\.com\/forms/, type: 'zoho-forms' },
    { pattern: /airtable\.com\/embed/, type: 'airtable' },
    { pattern: /tally\.so/, type: 'tally' },
    { pattern: /paperform\.co/, type: 'paperform' },
    { pattern: /surveymonkey\.com/, type: 'surveymonkey' },
    { pattern: /hubspot\.com/, type: 'hubspot-embed' },
    { pattern: /mailchimp\.com/, type: 'mailchimp-embed' },
    { pattern: /constantcontact\.com/, type: 'constant-contact-embed' },
    { pattern: /convertkit\.com/, type: 'convertkit-embed' },
    { pattern: /getresponse\.com/, type: 'getresponse-embed' },
    { pattern: /activecampaign\.com/, type: 'activecampaign-embed' },
    { pattern: /calendly\.com/, type: 'calendly' },
    { pattern: /acuityscheduling\.com/, type: 'acuity' },
]

// ============================================================
// MAIN DETECTION FUNCTION
// ============================================================
export function detectForms(html, pageUrl) {
    const $ = cheerio.load(html)
    const forms = []
    const seenSelectors = new Set()

    // 1. Detect WordPress/Plugin Forms
    for (const { selector, type } of FORM_PLUGIN_SELECTORS) {
        $(selector).each((index, element) => {
            const container = $(element)
            const formSelector = generateUniqueSelector($, element, index)

            if (seenSelectors.has(formSelector)) return
            seenSelectors.add(formSelector)

            const fields = extractAllFields($, container)
            if (fields.length > 0) {
                const containerForm = container.is('form') ? container : container.find('form').first()
                forms.push({
                    action: containerForm.attr('action') || pageUrl,
                    method: (containerForm.attr('method') || 'POST').toUpperCase(),
                    fields,
                    formIndex: forms.length,
                    selector: formSelector,
                    pluginType: type,
                    detectedBy: 'plugin-selector',
                })
            }
        })
    }

    // 2. Detect Iframe Embedded Forms
    $('iframe').each((index, iframe) => {
        const $iframe = $(iframe)
        const src = $iframe.attr('src') || ''
        const dataSrc = $iframe.attr('data-src') || ''
        const url = src || dataSrc

        for (const { pattern, type } of IFRAME_FORM_PATTERNS) {
            if (pattern.test(url)) {
                const formSelector = `iframe[src*="${url.split('/')[2]}"]`
                if (!seenSelectors.has(formSelector)) {
                    seenSelectors.add(formSelector)
                    forms.push({
                        action: url,
                        method: 'IFRAME',
                        fields: [],
                        formIndex: forms.length,
                        selector: formSelector,
                        pluginType: type,
                        isIframe: true,
                        iframeSrc: url,
                        detectedBy: 'iframe-pattern',
                    })
                }
                break
            }
        }
    })

    // 3. Detect ALL Standard HTML Forms
    $('form').each((index, element) => {
        const form = $(element)
        const formSelector = generateUniqueSelector($, element, index)

        if (seenSelectors.has(formSelector)) return
        seenSelectors.add(formSelector)

        const action = form.attr('action') || pageUrl
        const method = (form.attr('method') || 'POST').toUpperCase()
        const fields = extractAllFields($, form)

        // Skip search forms, login forms, and comment forms
        if (isSearchForm(form, fields) || isLoginForm(form, fields) || isCommentForm(form)) {
            return
        }

        // Include ANY form with 2+ fields (more inclusive)
        if (fields.length >= 2) {
            forms.push({
                action,
                method,
                fields,
                formIndex: forms.length,
                selector: formSelector,
                pluginType: detectFormType(form, fields),
                detectedBy: 'standard-form',
            })
        }
    })

    // 4. Detect Forms in Shadow DOM containers (common in web components)
    $('[data-form], [data-contact], [data-newsletter]').each((index, element) => {
        const container = $(element)
        const formSelector = generateUniqueSelector($, element, index)

        if (seenSelectors.has(formSelector)) return

        const fields = extractAllFields($, container)
        if (fields.length >= 2) {
            seenSelectors.add(formSelector)
            forms.push({
                action: pageUrl,
                method: 'POST',
                fields,
                formIndex: forms.length,
                selector: formSelector,
                pluginType: 'data-attribute-form',
                detectedBy: 'data-attribute',
            })
        }
    })

    // 5. Detect forms by common class patterns
    const commonFormPatterns = [
        '.contact', '.form-container', '.form-wrapper',
        '.form-section', '.form-block', '.form-area',
        '#contact', '#form', '#newsletter', '#subscribe',
        '.newsletter-widget', '.email-signup', '.optin-box',
        '.lead-capture', '.cta-form', '.footer-form',
    ]

    for (const pattern of commonFormPatterns) {
        $(pattern).each((index, element) => {
            const container = $(element)
            const formSelector = generateUniqueSelector($, element, index)

            if (seenSelectors.has(formSelector)) return

            const fields = extractAllFields($, container)
            if (fields.length >= 2 && !isSearchForm(container, fields)) {
                seenSelectors.add(formSelector)
                forms.push({
                    action: container.find('form').attr('action') || pageUrl,
                    method: (container.find('form').attr('method') || 'POST').toUpperCase(),
                    fields,
                    formIndex: forms.length,
                    selector: formSelector,
                    pluginType: 'pattern-detected',
                    detectedBy: 'class-pattern',
                })
            }
        })
    }

    return forms
}

// ============================================================
// COMMENT SECTION DETECTOR
// ============================================================
export function detectCommentSections(html, pageUrl) {
    const $ = cheerio.load(html)
    const commentSections = []
    const seen = new Set()

    // WordPress comments (all variations)
    const wpCommentSelectors = [
        '#commentform', '#respond', '.comment-form',
        '#comment-form', '.comments-area form',
        '.comment-respond', '#reply-form',
        '.wp-block-comments form',
    ]

    for (const selector of wpCommentSelectors) {
        $(selector).each((index, element) => {
            const form = $(element).is('form') ? $(element) : $(element).find('form').first()
            const formSelector = generateUniqueSelector($, element, index)

            if (seen.has(formSelector) || !form.length) return
            seen.add(formSelector)

            commentSections.push({
                type: 'wordpress',
                selector: formSelector,
                fields: extractAllFields($, form),
            })
        })
    }

    // Disqus
    if ($('#disqus_thread').length > 0 || $('[data-disqus-identifier]').length > 0) {
        commentSections.push({
            type: 'disqus',
            selector: '#disqus_thread',
            fields: [],
            isEmbed: true,
        })
    }

    // Generic comment forms
    $('form').each((index, element) => {
        const form = $(element)
        const text = form.text().toLowerCase()
        const formSelector = generateUniqueSelector($, element, index)

        if (seen.has(formSelector)) return

        const isComment = text.includes('comment') ||
            text.includes('reply') ||
            text.includes('leave a message') ||
            form.find('[name*="comment"]').length > 0 ||
            form.find('textarea').length > 0 && text.includes('post')

        if (isComment) {
            seen.add(formSelector)
            commentSections.push({
                type: 'generic',
                selector: formSelector,
                fields: extractAllFields($, form),
            })
        }
    })

    return commentSections
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function extractAllFields($, container) {
    const fields = []
    const seen = new Set()

    container.find('input, textarea, select').each((i, field) => {
        const $field = $(field)
        const type = $field.attr('type') || 'text'
        const name = $field.attr('name')
        const id = $field.attr('id')

        // Skip these field types
        if (['submit', 'button', 'hidden', 'reset', 'image'].includes(type)) {
            return
        }

        const key = name || id
        if (key && !seen.has(key)) {
            seen.add(key)
            fields.push({
                type,
                name,
                id,
                placeholder: $field.attr('placeholder'),
                label: findLabelFor($, $field, id),
                tagName: field.tagName?.toLowerCase(),
                required: $field.attr('required') !== undefined,
                pattern: $field.attr('pattern'),
                className: $field.attr('class'),
            })
        }
    })

    return fields
}

function findLabelFor($, field, fieldId) {
    if (fieldId) {
        const label = $(`label[for="${fieldId}"]`)
        if (label.length > 0) return label.text().trim()
    }

    const parentLabel = field.closest('label')
    if (parentLabel.length > 0) return parentLabel.text().trim()

    const prevLabel = field.prev('label')
    if (prevLabel.length > 0) return prevLabel.text().trim()

    // Check for aria-label
    const ariaLabel = field.attr('aria-label')
    if (ariaLabel) return ariaLabel

    return null
}

function generateUniqueSelector($, element, index) {
    const $el = $(element)

    const id = $el.attr('id')
    if (id) return `#${id}`

    const name = $el.attr('name')
    if (name && $el.is('form')) return `form[name="${name}"]`

    const dataId = $el.attr('data-id') || $el.attr('data-form-id')
    if (dataId) return `[data-id="${dataId}"]`

    const className = $el.attr('class')
    if (className) {
        const classes = className.split(' ').filter(c => c && !c.startsWith('js-'))
        if (classes.length > 0) return `.${classes[0]}`
    }

    return `form:nth-of-type(${index + 1})`
}

function isSearchForm(form, fields) {
    const text = form.text?.().toLowerCase() || ''
    const action = form.attr?.('action') || ''

    return (
        text.includes('search') && fields.length <= 2 ||
        action.includes('search') ||
        form.find('[type="search"]').length > 0 ||
        form.find('[name="s"]').length > 0 ||
        form.find('[name="q"]').length > 0
    )
}

function isLoginForm(form, fields) {
    const text = form.text?.().toLowerCase() || ''
    const action = form.attr?.('action') || ''

    // Check URL patterns for login pages
    if (action.includes('wp-login.php') || action.includes('wp-admin') || action.includes('login')) {
        return true
    }

    return (
        (text.includes('login') || text.includes('sign in') || text.includes('log in')) &&
        !text.includes('contact') &&
        fields.some(f => f.type === 'password')
    )
}

function isCommentForm(form) {
    const action = form.attr?.('action') || ''
    const id = form.attr?.('id') || ''
    const classes = form.attr?.('class') || ''

    return (
        action.includes('wp-comments-post.php') ||
        id.includes('commentform') ||
        classes.includes('comment-form') ||
        id === 'comment-form'
    )
}

function detectFormType(form, fields) {
    const text = form.text?.().toLowerCase() || ''
    const classes = form.attr?.('class') || ''

    if (text.includes('contact') || classes.includes('contact')) return 'contact'
    if (text.includes('newsletter') || classes.includes('newsletter')) return 'newsletter'
    if (text.includes('subscribe') || classes.includes('subscribe')) return 'subscribe'
    if (text.includes('quote') || classes.includes('quote')) return 'quote'
    if (text.includes('inquiry') || classes.includes('inquiry')) return 'inquiry'
    if (text.includes('feedback') || classes.includes('feedback')) return 'feedback'
    if (text.includes('registration') || classes.includes('registration')) return 'registration'
    if (text.includes('booking') || classes.includes('booking')) return 'booking'
    if (text.includes('appointment') || classes.includes('appointment')) return 'appointment'

    return 'unknown'
}

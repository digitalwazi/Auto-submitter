import * as cheerio from 'cheerio'
import { isValidEmail, isValidPhone } from '../utils/validators.js'

export function extractContacts(html) {
    const $ = cheerio.load(html)
    const text = $('body').text()

    // Extract emails
    const emails = extractEmails(text)

    // Extract phone numbers
    const phones = extractPhones(text)

    return {
        email: emails[0] || null, // Return first valid email
        phone: phones[0] || null, // Return first valid phone
    }
}

function extractEmails(text) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
    const matches = text.match(emailRegex) || []

    // Filter and validate
    const validEmails = matches
        .filter(email => {
            // Exclude common placeholder emails
            const lowerEmail = email.toLowerCase()
            if (lowerEmail.includes('example.com')) return false
            if (lowerEmail.includes('test@')) return false
            if (lowerEmail.includes('noreply')) return false
            if (lowerEmail.includes('no-reply')) return false

            return isValidEmail(email)
        })
        .filter((email, index, self) => self.indexOf(email) === index) // Unique

    return validEmails
}

function extractPhones(text) {
    // Match various phone formats
    const phoneRegexes = [
        // International format: +1-234-567-8900
        /\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
        // US format: (123) 456-7890
        /\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/g,
        // Simple format: 123-456-7890
        /\d{3}[-.\s]\d{3}[-.\s]\d{4}/g,
    ]

    const allMatches = new Set()

    phoneRegexes.forEach(regex => {
        const matches = text.match(regex) || []
        matches.forEach(match => allMatches.add(match))
    })

    // Validate and clean
    const validPhones = Array.from(allMatches)
        .filter(phone => isValidPhone(phone))
        .filter((phone, index, self) => self.indexOf(phone) === index) // Unique

    return validPhones
}

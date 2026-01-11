import './globals.css'

export const metadata = {
    title: 'Auto Submitter - Campaign Management',
    description: 'Automated form and comment submission system',
}

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    )
}

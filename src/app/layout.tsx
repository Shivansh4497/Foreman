import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Foreman',
  description: 'Your AI workforce, hired in minutes.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}

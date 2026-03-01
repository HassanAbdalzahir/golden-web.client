import './globals.css'
import type { Metadata } from 'next'
import localFont from 'next/font/local'

const alexandria = localFont({
  src: '../lib/fonts/Alexandria/Alexandria/Alexandria-VariableFont_wght.ttf',
  variable: '--font-alexandria',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Golden - Gold Ledger System',
  description: 'Self-hosted gold ledger financial system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className={alexandria.className}>
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
      </body>
    </html>
  )
}
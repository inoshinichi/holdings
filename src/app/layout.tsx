import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'VTホールディングスグループ共済会システム',
  description: '共済会管理システム',
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <meta name="robots" content="noindex, nofollow, noarchive" />
      </head>
      <body className="font-sans bg-gray-50 text-gray-900 antialiased">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}

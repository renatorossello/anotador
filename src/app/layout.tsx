import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Anotador',
  description: 'Anotador de puntajes de Truco y Burako.',
}

export const viewport: Viewport = {
  themeColor: '#0a231a',
  // Se usa a toques rápidos: el zoom por doble toque estorba más que ayuda.
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}

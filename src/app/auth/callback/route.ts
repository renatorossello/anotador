import { NextResponse, type NextRequest } from 'next/server'
import { supabaseServidor } from '@/lib/supabase/servidor'

/** Vuelta del link del email: se canjea el código por sesión y adentro. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const volver = url.searchParams.get('volver') ?? '/'

  if (code) {
    const supabase = await supabaseServidor()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(volver, url.origin))
  }

  return NextResponse.redirect(new URL('/entrar?error=link', url.origin))
}

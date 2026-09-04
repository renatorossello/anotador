import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/** Rutas que se abren sin cuenta: la sala y el login. */
const PUBLICAS = ['/sala', '/entrar', '/auth']

export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request })

  // Sin configuración de Supabase no hay sesión que refrescar. Se deja pasar en
  // vez de reventar acá: el error se ve en la pantalla que lo necesita y no en
  // un 500 de toda la app.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return respuesta
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (nuevas) => {
          nuevas.forEach(({ name, value }) => request.cookies.set(name, value))
          respuesta = NextResponse.next({ request })
          nuevas.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data } = await supabase.auth.getUser()
  const ruta = request.nextUrl.pathname
  const esPublica = PUBLICAS.some((p) => ruta === p || ruta.startsWith(p + '/'))

  if (!data.user && !esPublica) {
    const url = request.nextUrl.clone()
    url.pathname = '/entrar'
    url.searchParams.set('volver', ruta)
    return NextResponse.redirect(url)
  }

  return respuesta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)'],
}

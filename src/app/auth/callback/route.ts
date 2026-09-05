import { NextResponse, type NextRequest } from 'next/server'
import { supabaseServidor } from '@/lib/supabase/servidor'

/**
 * Vuelta del acceso: se canjea el código por sesión y adentro.
 *
 * ⚠️ El destino NO se arma con el origen de `request.url`.
 *
 * En Railway la app corre dentro de un contenedor que escucha en el puerto que
 * le asignan, así que la petición le llega con host `localhost:8080` — el
 * dominio público lo sabe el proxy de adelante, no el proceso. Armando la
 * redirección con ese origen, el visitante terminaba en
 * `https://localhost:8080/...`, que en su teléfono no existe. Costó encontrarlo
 * porque el síntoma parecía de Supabase: "me manda a localhost".
 */
function origenPublico(request: NextRequest) {
  const reenviado = request.headers.get('x-forwarded-host')
  const host = reenviado ?? request.headers.get('host')
  if (!host) return new URL(request.url).origin

  // En local no hay proxy y el host es localhost sin TLS.
  const protocolo =
    request.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')

  return `${protocolo}://${host}`
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const origen = origenPublico(request)

  const code = url.searchParams.get('code')
  const volver = url.searchParams.get('volver') ?? '/'

  // Supabase también puede volver con un error propio (link vencido, permiso
  // denegado en Google). Antes se perdía y todo terminaba en el mismo
  // "error=link", que no dice nada.
  const errorProveedor = url.searchParams.get('error_description') ?? url.searchParams.get('error')
  if (errorProveedor) {
    return NextResponse.redirect(new URL(`/entrar?error=${encodeURIComponent(errorProveedor)}`, origen))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/entrar?error=Faltó el código de acceso.', origen))
  }

  const supabase = await supabaseServidor()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL(`/entrar?error=${encodeURIComponent(error.message)}`, origen))
  }

  // `volver` viene de la URL, así que sólo se acepta una ruta de este sitio: si
  // no, cualquiera puede armar un link de acceso que termine en otro lado.
  const destino = volver.startsWith('/') && !volver.startsWith('//') ? volver : '/'
  return NextResponse.redirect(new URL(destino, origen))
}

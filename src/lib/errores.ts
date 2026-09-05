/**
 * Supabase devuelve sus errores en inglés. Mostrarlos crudos deja frases como
 * "For security purposes, you can only request this after 36 seconds" en medio
 * de una pantalla en castellano, y encima no dicen qué hacer.
 *
 * Se traduce lo que le puede pasar a alguien de verdad; lo que no está en la
 * lista se muestra tal cual, que es mejor que esconderlo.
 */

const ESPERA = /you can only request this after (\d+) seconds?/i

export function traducirErrorAuth(mensaje: string): string {
  const espera = mensaje.match(ESPERA)
  if (espera) {
    const segundos = Number(espera[1])
    return `Ya te mandamos uno recién. Probá de nuevo en ${segundos} ${segundos === 1 ? 'segundo' : 'segundos'}.`
  }

  if (/email rate limit exceeded/i.test(mensaje)) {
    return 'Se llegó al límite de mails por hora. Esperá un rato y volvé a intentar.'
  }
  if (/invalid email|unable to validate email/i.test(mensaje)) {
    return 'Ese email no parece válido.'
  }
  if (/signups not allowed|not authorized/i.test(mensaje)) {
    return 'Esa dirección no tiene acceso.'
  }
  if (/failed to fetch|network/i.test(mensaje)) {
    return 'No hay conexión. Probá de nuevo cuando vuelva.'
  }

  return mensaje
}

/**
 * Saca un mensaje legible de cualquier cosa que se haya tirado.
 *
 * ⚠️ Los errores de PostgREST **no son `Error`**: son objetos planos con
 * `message`, `code` y `hint`. Un `e instanceof Error ? e.message : 'falló algo'`
 * los tapa a todos con el texto genérico, y ahí se pierde justamente el dato que
 * dice qué pasó. Costó un rato con un PGRST201 que sólo se veía como
 * "No pudimos cargar la partida".
 */
export function mensajeDeError(e: unknown, porDefecto = 'Algo salió mal.'): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e

  if (e && typeof e === 'object') {
    const posible = e as { message?: unknown; hint?: unknown; code?: unknown }
    if (typeof posible.message === 'string' && posible.message) {
      const codigo = typeof posible.code === 'string' ? ` (${posible.code})` : ''
      return posible.message + codigo
    }
  }

  return porDefecto
}

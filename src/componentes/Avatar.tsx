/**
 * La foto de un jugador, o sus iniciales sobre un color propio.
 *
 * Nunca queda un hueco: sin foto, la inicial con su color ya hace que la lista
 * se lea de un vistazo. Nadie está obligado a cargar nada para que la app se vea
 * completa.
 */

/** Un tono estable a partir del nombre: el mismo jugador siempre sale igual. */
function tonoDe(texto: string): number {
  let hash = 0
  for (let i = 0; i < texto.length; i++) {
    hash = (hash * 31 + texto.charCodeAt(i)) % 360
  }
  return hash
}

export function inicialesDe(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return '?'
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase()
  return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase()
}

export function Avatar({
  nombre,
  url,
  tamaño = 40,
  className = '',
}: {
  nombre: string
  url?: string | null
  tamaño?: number
  className?: string
}) {
  const tono = tonoDe(nombre)
  const lado = `${tamaño}px`

  if (url) {
    return (
      // Sin next/image a propósito: son fotos de un bucket externo, de tamaño
      // conocido y ya achicadas antes de subirlas. Optimizarlas otra vez en el
      // servidor no ahorra nada y agrega una dependencia de configuración.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={nombre}
        width={tamaño}
        height={tamaño}
        loading="lazy"
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: lado, height: lado }}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${className}`}
      style={{
        width: lado,
        height: lado,
        fontSize: `${Math.round(tamaño * 0.38)}px`,
        background: `hsl(${tono} 42% 30%)`,
        color: `hsl(${tono} 70% 82%)`,
      }}
    >
      {inicialesDe(nombre)}
    </span>
  )
}

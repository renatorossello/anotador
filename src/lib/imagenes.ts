'use client'

/**
 * Achica una foto en el propio teléfono antes de subirla.
 *
 * ⚠️ Esto no es una optimización opcional. Una foto de un teléfono actual pesa
 * entre 3 y 5 MB, y el avatar se muestra a 40 píxeles: subirla entera tarda una
 * eternidad con datos móviles, y después esa imagen viaja en cada carga de la
 * lista de jugadores. Achicada queda en unos 30 KB.
 */

const LADO = 256
const CALIDAD = 0.82

export async function achicarParaAvatar(archivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo)

  try {
    // Recorte cuadrado desde el centro: es lo que espera alguien que sube una
    // foto para un círculo, y evita tener que construir un recortador.
    const lado = Math.min(bitmap.width, bitmap.height)
    const x = (bitmap.width - lado) / 2
    const y = (bitmap.height - lado) / 2

    const lienzo = document.createElement('canvas')
    lienzo.width = LADO
    lienzo.height = LADO

    const ctx = lienzo.getContext('2d')
    if (!ctx) throw new Error('No pudimos procesar la imagen en este navegador.')

    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, x, y, lado, lado, 0, 0, LADO, LADO)

    const blob = await new Promise<Blob | null>((resolve) =>
      lienzo.toBlob(resolve, 'image/webp', CALIDAD),
    )
    if (!blob) throw new Error('No pudimos procesar la imagen.')
    return blob
  } finally {
    bitmap.close()
  }
}

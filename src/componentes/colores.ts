/** Los colores que puede tomar un bando. Alcanzan para el 1v1v1 de Burako. */
export const COLORES_BANDO = ['verde', 'bordo', 'ocre'] as const

export type ColorBando = (typeof COLORES_BANDO)[number]

const HEX: Record<string, string> = {
  verde: 'var(--color-bando-verde)',
  bordo: 'var(--color-bando-bordo)',
  ocre: 'var(--color-bando-ocre)',
  pizarra: 'var(--color-tiza-suave)',
}

export function colorDe(color: string) {
  return HEX[color] ?? HEX.pizarra
}

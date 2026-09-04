import type { ClaveJuego, Motor } from '@/core/tipos'
import { burako } from './burako'
import { truco } from './truco'

/**
 * El registro de juegos. Sumar uno nuevo es agregarlo acá: nada fuera de su
 * módulo y de su pantalla de anotación debería tener que enterarse.
 */
export const MOTORES = { burako, truco } as const

export const JUEGOS = Object.values(MOTORES) as unknown as Motor[]

export function motorDe(clave: ClaveJuego): Motor {
  const motor = MOTORES[clave]
  if (!motor) throw new Error(`No existe el juego "${clave}".`)
  return motor as unknown as Motor
}

export { burako, truco }

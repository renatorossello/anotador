import type { Asiento, Bando, Deltas } from './tipos'

/**
 * Suma los asientos vivos. Los anulados no cuentan y no se borran.
 *
 * El anotador ve SIEMPRE este número, calculado en su dispositivo: el `totales`
 * que guarda la base es para la sala y para la lista de partidas. Así lo que
 * anota se ve al instante y sin red.
 */
export function sumar(asientos: Asiento[], bandos: Bando[]): Deltas {
  const totales: Deltas = {}
  for (const bando of bandos) totales[bando.id] = 0

  for (const asiento of asientos) {
    if (asiento.anuladoEn) continue
    for (const [bandoId, puntos] of Object.entries(asiento.deltas)) {
      totales[bandoId] = (totales[bandoId] ?? 0) + Number(puntos ?? 0)
    }
  }
  return totales
}

/** Los asientos que todavía cuentan, en orden. */
export function vivos(asientos: Asiento[]) {
  return asientos.filter((a) => !a.anuladoEn)
}

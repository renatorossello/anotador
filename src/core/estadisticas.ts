import type { Bando, ClaveJuego, Jugador, Partida } from './tipos'

/**
 * Las estadísticas, calculadas a partir de las partidas terminadas.
 *
 * Es código puro a propósito: no sabe de Supabase ni de React. Un promedio mal
 * calculado no se ve mirando la pantalla —parece perfectamente normal—, así que
 * esto tiene que poder probarse con partidas armadas a mano.
 *
 * ⚠️ La unidad es la PERSONA, no el perfil. Cada uno arma su grupo y termina
 * habiendo dos perfiles "Renato" en grupos distintos; si contaran por separado,
 * el historial quedaría partido en dos y ningún número sería cierto.
 */

/** La cuenta si el perfil está vinculado; el perfil suelto si no lo está. */
export function identidadDe(jugador: Jugador): string {
  return jugador.usuarioId ?? jugador.id
}

export interface Filtro {
  juego?: ClaveJuego
  modalidad?: string
}

export interface FilaRanking {
  identidad: string
  nombre: string
  jugadas: number
  ganadas: number
  /** Entre 0 y 1. Mirarla sin `jugadas` al lado no significa nada. */
  efectividad: number
  /** Positiva si viene ganando, negativa si viene perdiendo. */
  racha: number
  /** Puntos propios menos los del mejor rival, promediados. */
  diferenciaPromedio: number
}

export interface FilaMano {
  identidad: string
  nombre: string
  ganadas: number
  perdidas: number
  jugadas: number
}

export interface FilaDupla {
  identidades: [string, string]
  nombre: string
  jugadas: number
  ganadas: number
  efectividad: number
}

/** Sólo cuentan las partidas cerradas y con ganador. */
export function terminadas(partidas: Partida[], filtro: Filtro = {}): Partida[] {
  return partidas
    .filter((p) => p.estado === 'terminada' && p.ganadorBandoId)
    .filter((p) => (filtro.juego ? p.juego === filtro.juego : true))
    .filter((p) => (filtro.modalidad ? p.modalidad === filtro.modalidad : true))
    .sort((a, b) => (a.terminadaEn ?? '').localeCompare(b.terminadaEn ?? ''))
}

function bandoDe(partida: Partida, identidad: string): Bando | undefined {
  return partida.bandos.find((b) => b.jugadores.some((j) => identidadDe(j) === identidad))
}

/**
 * La diferencia contra el mejor rival, no contra la suma de todos: en 1v1v1,
 * restar los puntos de los dos rivales daría un número que no significa nada.
 */
function diferencia(partida: Partida, bando: Bando): number {
  const propio = partida.totales[bando.id] ?? 0
  const rivales = partida.bandos.filter((b) => b.id !== bando.id).map((b) => partida.totales[b.id] ?? 0)
  if (rivales.length === 0) return 0
  return propio - Math.max(...rivales)
}

interface Acumulado {
  identidad: string
  nombres: Map<string, number>
  jugadas: number
  ganadas: number
  diferencias: number[]
  /** En orden cronológico: sirve para la racha, que se lee desde el final. */
  resultados: boolean[]
}

function acumular(partidas: Partida[]): Map<string, Acumulado> {
  const porIdentidad = new Map<string, Acumulado>()

  for (const partida of partidas) {
    for (const bando of partida.bandos) {
      const gano = partida.ganadorBandoId === bando.id
      const dif = diferencia(partida, bando)

      for (const jugador of bando.jugadores) {
        const identidad = identidadDe(jugador)
        let acc = porIdentidad.get(identidad)
        if (!acc) {
          acc = { identidad, nombres: new Map(), jugadas: 0, ganadas: 0, diferencias: [], resultados: [] }
          porIdentidad.set(identidad, acc)
        }

        // La misma persona puede llamarse distinto en cada grupo ("Rena" y
        // "Renato"): gana el nombre con el que más se la anotó.
        acc.nombres.set(jugador.nombre, (acc.nombres.get(jugador.nombre) ?? 0) + 1)
        acc.jugadas++
        if (gano) acc.ganadas++
        acc.diferencias.push(dif)
        acc.resultados.push(gano)
      }
    }
  }

  return porIdentidad
}

function nombreMasUsado(nombres: Map<string, number>): string {
  let mejor = ''
  let veces = -1
  for (const [nombre, n] of nombres) {
    if (n > veces) {
      mejor = nombre
      veces = n
    }
  }
  return mejor
}

/** Resultados consecutivos hacia atrás. Se corta con el primer cambio. */
function rachaDe(resultados: boolean[]): number {
  if (resultados.length === 0) return 0
  const ultimo = resultados[resultados.length - 1]
  let n = 0
  for (let i = resultados.length - 1; i >= 0 && resultados[i] === ultimo; i--) n++
  return ultimo ? n : -n
}

function promedio(valores: number[]): number {
  if (valores.length === 0) return 0
  return valores.reduce((a, b) => a + b, 0) / valores.length
}

export function ranking(partidas: Partida[], filtro: Filtro = {}): FilaRanking[] {
  const jugadas = terminadas(partidas, filtro)

  return [...acumular(jugadas).values()]
    .map((acc) => ({
      identidad: acc.identidad,
      nombre: nombreMasUsado(acc.nombres),
      jugadas: acc.jugadas,
      ganadas: acc.ganadas,
      efectividad: acc.jugadas === 0 ? 0 : acc.ganadas / acc.jugadas,
      racha: rachaDe(acc.resultados),
      diferenciaPromedio: promedio(acc.diferencias),
    }))
    .sort(
      (a, b) =>
        b.ganadas - a.ganadas ||
        b.efectividad - a.efectividad ||
        a.nombre.localeCompare(b.nombre, 'es'),
    )
}

/**
 * Contra cada rival: sólo las partidas donde estuvieron en bandos distintos.
 * En 1v1v1 cuenta contra los dos.
 */
export function manoAMano(partidas: Partida[], identidad: string, filtro: Filtro = {}): FilaMano[] {
  const porRival = new Map<string, FilaMano & { nombres: Map<string, number> }>()

  for (const partida of terminadas(partidas, filtro)) {
    const mio = bandoDe(partida, identidad)
    if (!mio) continue
    const gane = partida.ganadorBandoId === mio.id

    for (const bando of partida.bandos) {
      if (bando.id === mio.id) continue
      for (const jugador of bando.jugadores) {
        const rival = identidadDe(jugador)
        let fila = porRival.get(rival)
        if (!fila) {
          fila = { identidad: rival, nombre: '', ganadas: 0, perdidas: 0, jugadas: 0, nombres: new Map() }
          porRival.set(rival, fila)
        }
        fila.nombres.set(jugador.nombre, (fila.nombres.get(jugador.nombre) ?? 0) + 1)
        fila.jugadas++
        if (gane) fila.ganadas++
        else if (partida.ganadorBandoId === bando.id) fila.perdidas++
      }
    }
  }

  return [...porRival.values()]
    .map(({ nombres, ...fila }) => ({ ...fila, nombre: nombreMasUsado(nombres) }))
    .sort((a, b) => b.jugadas - a.jugadas || a.nombre.localeCompare(b.nombre, 'es'))
}

/** Duplas: dos o más identidades en el mismo bando. */
export function duplas(partidas: Partida[], filtro: Filtro = {}): FilaDupla[] {
  const porDupla = new Map<string, { ids: [string, string]; nombres: Map<string, number>; jugadas: number; ganadas: number }>()

  for (const partida of terminadas(partidas, filtro)) {
    for (const bando of partida.bandos) {
      if (bando.jugadores.length < 2) continue
      const gano = partida.ganadorBandoId === bando.id

      // Todos los pares del bando: en 3v3 hay tres duplas conviviendo.
      for (let i = 0; i < bando.jugadores.length; i++) {
        for (let k = i + 1; k < bando.jugadores.length; k++) {
          const a = bando.jugadores[i]
          const b = bando.jugadores[k]
          const ids = [identidadDe(a), identidadDe(b)].sort() as [string, string]
          const clave = ids.join('|')

          let fila = porDupla.get(clave)
          if (!fila) {
            fila = { ids, nombres: new Map(), jugadas: 0, ganadas: 0 }
            porDupla.set(clave, fila)
          }
          const etiqueta = [a.nombre, b.nombre].sort((x, y) => x.localeCompare(y, 'es')).join(' y ')
          fila.nombres.set(etiqueta, (fila.nombres.get(etiqueta) ?? 0) + 1)
          fila.jugadas++
          if (gano) fila.ganadas++
        }
      }
    }
  }

  return [...porDupla.values()]
    .map((fila) => ({
      identidades: fila.ids,
      nombre: nombreMasUsado(fila.nombres),
      jugadas: fila.jugadas,
      ganadas: fila.ganadas,
      efectividad: fila.jugadas === 0 ? 0 : fila.ganadas / fila.jugadas,
    }))
    .sort((a, b) => b.ganadas - a.ganadas || b.jugadas - a.jugadas)
}

/** Los juegos que aparecen en el historial, para armar las pestañas. */
export function juegosJugados(partidas: Partida[]): ClaveJuego[] {
  const claves = new Set<ClaveJuego>()
  for (const p of terminadas(partidas)) claves.add(p.juego)
  return [...claves]
}

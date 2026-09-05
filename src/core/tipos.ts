/**
 * El vocabulario del dominio. Nada de acá sabe de Supabase ni de React.
 *
 * La pieza central es el BANDO: no se modela "jugador o equipo", se modela un
 * bando con miembros. En 1v1 son dos bandos de uno; en 1v1v1, tres bandos de
 * uno; en 2v2, dos bandos de dos. Individual y equipo comparten todo el código.
 */

export type ClaveJuego = 'burako' | 'truco'

/** Id de un bando dentro de una partida. */
export type BandoId = string

/** Cuántos puntos suma cada bando por un asiento. Puede ser negativo. */
export type Deltas = Record<BandoId, number>

export type EstadoPartida = 'en_curso' | 'terminada' | 'abandonada'

export interface Jugador {
  id: string
  nombre: string
  avatarUrl: string | null
  /**
   * Con el mail cargado, el perfil se ata solo a esa cuenta: cuando esa persona
   * entra, ve en su historial las partidas donde jugó, aunque las haya anotado
   * otro. El vínculo da sólo lectura.
   */
  email?: string | null
  vinculado?: boolean
  /**
   * La cuenta a la que quedó atado el perfil, si la hay.
   *
   * Es lo que permite que los perfiles de la misma persona en grupos distintos
   * cuenten como uno solo en las estadísticas: la identidad es la cuenta cuando
   * existe, y el perfil suelto cuando no.
   */
  usuarioId?: string | null
}

export interface Bando {
  id: BandoId
  posicion: number
  etiqueta: string
  color: string
  jugadores: Jugador[]
}

/**
 * Un asiento de puntaje.
 *
 * El `id` lo genera el CLIENTE, no la base: es lo que hace que subirlo sea
 * idempotente y que reintentar desde la cola offline sea inofensivo.
 *
 * `payload` tiene la forma que le da el motor del juego; `deltas` es el
 * resultado ya calculado, para que nadie fuera del motor tenga que interpretar
 * el payload (y para que un asiento viejo se siga leyendo si el motor cambia).
 */
export interface Asiento {
  id: string
  partidaId: string
  creadoEn: string
  payload: unknown
  deltas: Deltas
  anuladoEn: string | null
}

export interface Partida {
  id: string
  grupoId: string
  juego: ClaveJuego
  config: Record<string, unknown>
  modalidad: string
  estado: EstadoPartida
  bandos: Bando[]
  totales: Deltas
  codigoSala: string
  ganadorBandoId: BandoId | null
  iniciadaEn: string
  terminadaEn: string | null
}

// ---------------------------------------------------------------------------
// Motores
// ---------------------------------------------------------------------------

export interface Modalidad {
  clave: string
  etiqueta: string
  /** Cuántos bandos se enfrentan. */
  bandos: number
  /** Cuántos jugadores hay en cada bando. */
  porBando: number
}

export type CampoConfig =
  | {
      clave: string
      etiqueta: string
      tipo: 'opciones'
      opciones: { valor: number | string; etiqueta: string }[]
      ayuda?: string
    }
  | {
      clave: string
      etiqueta: string
      tipo: 'numero'
      min: number
      max: number
      paso: number
      ayuda?: string
    }

/** Un punto de la escala que la UI dibuja: el corte de las buenas, el objetivo. */
export interface Hito {
  en: number
  etiqueta: string
}

export interface Resultado {
  terminada: boolean
  ganador?: BandoId
  /** Todos los bandos ordenados: primero el que va ganando. */
  puestos: BandoId[]
  /**
   * Bandos que alcanzaron el objetivo empatados en el total más alto.
   * La partida NO termina: se juega otra ronda.
   */
  desempate?: BandoId[]
}

/** Lo que el motor necesita saber de la partida para calcular. */
export interface Contexto {
  bandos: Bando[]
}

export interface Motor<Config = Record<string, unknown>, Payload = unknown> {
  clave: ClaveJuego
  nombre: string
  modalidades: Modalidad[]
  configPorDefecto: Config
  opcionesConfig: CampoConfig[]

  /** Devuelve un mensaje de error, o null si el asiento es válido. */
  validar(payload: Payload, cfg: Config, ctx: Contexto): string | null

  /** De lo cargado a los puntos que suma cada bando. */
  deltas(payload: Payload, cfg: Config, ctx: Contexto): Deltas

  /** ¿Terminó? ¿Quién ganó? ¿Hay que jugar otra ronda? */
  resultado(totales: Deltas, cfg: Config, ctx: Contexto): Resultado

  /** Marcas que la UI dibuja sobre la escala de puntaje. */
  hitos(cfg: Config): Hito[]
}

/** Ordena bandos de mayor a menor total. Desempate estable por posición. */
export function ordenarPorTotal(totales: Deltas, bandos: Bando[]): BandoId[] {
  return [...bandos]
    .sort((a, b) => (totales[b.id] ?? 0) - (totales[a.id] ?? 0) || a.posicion - b.posicion)
    .map((b) => b.id)
}

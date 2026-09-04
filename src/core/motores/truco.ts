import {
  ordenarPorTotal,
  type Motor,
  type Resultado,
} from '@/core/tipos'

export interface ConfigTruco {
  objetivo: number
}

/** Cada toque es un asiento propio: deshacer es quitar el último. */
export interface AsientoTruco {
  bando: string
  puntos: number
}

export const OBJETIVOS_TRUCO = [15, 30]

/**
 * El corte de las malas es la mitad, redondeando para abajo.
 * A 30 → malas 1-15, buenas 16-30. A 15 → malas 1-7, buenas 8-15.
 */
export function corteDeMalas(objetivo: number): number {
  return Math.floor(objetivo / 2)
}

export const truco: Motor<ConfigTruco, AsientoTruco> = {
  clave: 'truco',
  nombre: 'Truco',

  // Siempre dos bandos: lo que cambia es de a cuántos se juega.
  modalidades: [
    { clave: '1v1', etiqueta: '1 vs 1', bandos: 2, porBando: 1 },
    { clave: '2v2', etiqueta: '2 vs 2', bandos: 2, porBando: 2 },
    { clave: '3v3', etiqueta: '3 vs 3', bandos: 2, porBando: 3 },
  ],

  configPorDefecto: { objetivo: 30 },

  opcionesConfig: [
    {
      clave: 'objetivo',
      etiqueta: 'Se juega a',
      tipo: 'opciones',
      opciones: OBJETIVOS_TRUCO.map((v) => ({ valor: v, etiqueta: `${v} puntos` })),
      ayuda: 'Las malas son la primera mitad.',
    },
  ],

  validar(payload, _cfg, ctx) {
    if (!ctx.bandos.some((b) => b.id === payload.bando)) return 'Ese bando no juega esta partida.'
    if (!Number.isInteger(payload.puntos) || payload.puntos < 1) {
      return 'Se anota de a un punto como mínimo.'
    }
    return null
  },

  deltas(payload, _cfg, ctx) {
    const salida: Record<string, number> = {}
    for (const bando of ctx.bandos) salida[bando.id] = 0
    salida[payload.bando] = payload.puntos
    return salida
  },

  /** Gana el primero que alcanza el objetivo. No hay empate posible. */
  resultado(totales, cfg, ctx): Resultado {
    const puestos = ordenarPorTotal(totales, ctx.bandos)
    const lider = puestos[0]

    if ((totales[lider] ?? 0) >= cfg.objetivo) {
      return { terminada: true, ganador: lider, puestos }
    }
    return { terminada: false, puestos }
  },

  hitos(cfg) {
    return [
      { en: corteDeMalas(cfg.objetivo), etiqueta: 'Buenas' },
      { en: cfg.objetivo, etiqueta: 'Objetivo' },
    ]
  },
}

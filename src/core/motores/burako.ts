import {
  ordenarPorTotal,
  type Deltas,
  type Motor,
  type Resultado,
} from '@/core/tipos'

export interface ConfigBurako {
  objetivo: number
}

/** Se carga un total por bando al cerrar la ronda. Admite negativos. */
export interface AsientoBurako {
  puntos: Record<string, number>
}

export const OBJETIVOS = [2000, 3000, 5000]

export const burako: Motor<ConfigBurako, AsientoBurako> = {
  clave: 'burako',
  nombre: 'Burako',

  modalidades: [
    { clave: '1v1', etiqueta: '1 vs 1', bandos: 2, porBando: 1 },
    { clave: '1v1v1', etiqueta: '1 vs 1 vs 1', bandos: 3, porBando: 1 },
    { clave: '2v2', etiqueta: '2 vs 2', bandos: 2, porBando: 2 },
  ],

  configPorDefecto: { objetivo: 3000 },

  opcionesConfig: [
    {
      clave: 'objetivo',
      etiqueta: 'Se juega a',
      tipo: 'opciones',
      opciones: OBJETIVOS.map((v) => ({ valor: v, etiqueta: v.toLocaleString('es-AR') })),
      ayuda: 'Gana el primero que lo alcanza al cerrar una ronda.',
    },
  ],

  validar(payload, _cfg, ctx) {
    for (const bando of ctx.bandos) {
      const valor = payload.puntos[bando.id]
      if (valor === undefined || valor === null) return `Falta el puntaje de ${bando.etiqueta}.`
      if (!Number.isFinite(valor)) return `El puntaje de ${bando.etiqueta} no es un número.`
      if (!Number.isInteger(valor)) return 'Los puntajes van sin decimales.'
    }
    return null
  },

  deltas(payload, _cfg, ctx) {
    const salida: Deltas = {}
    for (const bando of ctx.bandos) salida[bando.id] = payload.puntos[bando.id] ?? 0
    return salida
  },

  /**
   * Termina al cerrar la ronda en que alguien alcanza el objetivo.
   *
   * Si varios lo pasan en la misma ronda, gana el de más puntos. Si empatan
   * exacto en el total más alto, la partida NO termina: se juega otra ronda.
   * En 1v1v1 termina igual cuando el primero pasa; 2.º y 3.º salen por puntaje.
   */
  resultado(totales, cfg, ctx): Resultado {
    const puestos = ordenarPorTotal(totales, ctx.bandos)
    const llegaron = puestos.filter((id) => (totales[id] ?? 0) >= cfg.objetivo)

    if (llegaron.length === 0) return { terminada: false, puestos }

    const mejor = totales[llegaron[0]] ?? 0
    const empatados = llegaron.filter((id) => (totales[id] ?? 0) === mejor)

    if (empatados.length > 1) {
      return { terminada: false, puestos, desempate: empatados }
    }

    return { terminada: true, ganador: llegaron[0], puestos }
  },

  hitos(cfg) {
    return [{ en: cfg.objetivo, etiqueta: 'Objetivo' }]
  },
}

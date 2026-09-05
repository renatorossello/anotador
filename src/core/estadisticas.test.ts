import { describe, expect, it } from 'vitest'
import {
  comoLeFue,
  duplas,
  identidadDe,
  juegosJugados,
  manoAMano,
  parejasDe,
  partidasDe,
  ranking,
  resumenDe,
  terminadas,
} from './estadisticas'
import type { ClaveJuego, Jugador, Partida } from './tipos'

/*
  Las partidas se arman a mano porque lo que hay que probar son los casos que en
  la vida real aparecen de a uno cada tanto: el 1v1v1, la misma persona con dos
  perfiles, la partida que quedó sin cerrar.
*/

function jugador(id: string, nombre: string, usuarioId?: string): Jugador {
  return { id, nombre, avatarUrl: null, usuarioId: usuarioId ?? null }
}

let contador = 0

function partida(opciones: {
  bandos: Jugador[][]
  totales: number[]
  ganador?: number
  juego?: ClaveJuego
  modalidad?: string
  estado?: Partida['estado']
  dia?: number
}): Partida {
  const id = `p${++contador}`
  const bandos = opciones.bandos.map((jugadores, i) => ({
    id: `${id}-b${i}`,
    posicion: i,
    etiqueta: jugadores.map((j) => j.nombre).join(' y '),
    color: 'verde',
    jugadores,
  }))

  const totales: Record<string, number> = {}
  bandos.forEach((b, i) => (totales[b.id] = opciones.totales[i] ?? 0))

  const estado = opciones.estado ?? 'terminada'
  const ganadorIndice = opciones.ganador ?? 0

  return {
    id,
    grupoId: 'g1',
    juego: opciones.juego ?? 'burako',
    modalidad: opciones.modalidad ?? '1 vs 1',
    config: { objetivo: 3000 },
    estado,
    bandos,
    totales,
    codigoSala: 'ABC123',
    ganadorBandoId: estado === 'terminada' ? bandos[ganadorIndice].id : null,
    iniciadaEn: `2026-01-0${opciones.dia ?? 1}T10:00:00.000Z`,
    terminadaEn: estado === 'terminada' ? `2026-01-0${opciones.dia ?? 1}T11:00:00.000Z` : null,
  }
}

const rena = jugador('j-rena', 'Rena', 'u-renato')
const renato = jugador('j-renato', 'Renato', 'u-renato')
const magui = jugador('j-magui', 'Magui', 'u-magui')
const maguiOtroGrupo = jugador('j-magui-2', 'Magui', 'u-magui')
const invitado = jugador('j-invitado', 'Invitado')

describe('identidad', () => {
  it('usa la cuenta cuando el perfil está vinculado', () => {
    expect(identidadDe(rena)).toBe('u-renato')
    expect(identidadDe(renato)).toBe('u-renato')
  })

  it('usa el perfil cuando no hay cuenta', () => {
    expect(identidadDe(invitado)).toBe('j-invitado')
  })

  it('junta los dos perfiles de la misma persona en una sola fila', () => {
    const filas = ranking([
      partida({ bandos: [[rena], [magui]], totales: [3000, 1200], ganador: 0, dia: 1 }),
      partida({ bandos: [[renato], [magui]], totales: [3010, 900], ganador: 0, dia: 2 }),
    ])

    expect(filas).toHaveLength(2)
    const suyo = filas.find((f) => f.identidad === 'u-renato')
    expect(suyo?.jugadas).toBe(2)
    expect(suyo?.ganadas).toBe(2)
  })

  it('no junta perfiles sin cuenta aunque se llamen igual', () => {
    const otro = jugador('j-otro', 'Invitado')
    const filas = ranking([partida({ bandos: [[invitado], [otro]], totales: [3000, 100] })])
    expect(filas).toHaveLength(2)
  })
})

describe('qué partidas cuentan', () => {
  it('deja afuera las que no están terminadas', () => {
    const abiertas = [
      partida({ bandos: [[rena], [magui]], totales: [500, 400], estado: 'en_curso' }),
      partida({ bandos: [[rena], [magui]], totales: [500, 400], estado: 'abandonada' }),
    ]
    expect(terminadas(abiertas)).toHaveLength(0)
    expect(ranking(abiertas)).toHaveLength(0)
  })

  it('filtra por juego', () => {
    const historial = [
      partida({ bandos: [[rena], [magui]], totales: [3000, 1000], juego: 'burako' }),
      partida({ bandos: [[rena], [magui]], totales: [30, 12], juego: 'truco' }),
    ]
    expect(terminadas(historial, { juego: 'truco' })).toHaveLength(1)
    expect(juegosJugados(historial).sort()).toEqual(['burako', 'truco'])
  })
})

describe('ranking', () => {
  it('cuenta jugadas, ganadas y efectividad', () => {
    const filas = ranking([
      partida({ bandos: [[rena], [magui]], totales: [3000, 1000], ganador: 0, dia: 1 }),
      partida({ bandos: [[rena], [magui]], totales: [900, 3000], ganador: 1, dia: 2 }),
      partida({ bandos: [[rena], [magui]], totales: [3000, 2000], ganador: 0, dia: 3 }),
    ])

    const suyo = filas.find((f) => f.identidad === 'u-renato')!
    expect(suyo.jugadas).toBe(3)
    expect(suyo.ganadas).toBe(2)
    expect(suyo.efectividad).toBeCloseTo(2 / 3)
  })

  it('la racha cuenta hacia atrás y cambia de signo al perder', () => {
    const dosSeguidas = ranking([
      partida({ bandos: [[rena], [magui]], totales: [3000, 100], ganador: 1, dia: 1 }),
      partida({ bandos: [[rena], [magui]], totales: [3000, 100], ganador: 0, dia: 2 }),
      partida({ bandos: [[rena], [magui]], totales: [3000, 100], ganador: 0, dia: 3 }),
    ])
    expect(dosSeguidas.find((f) => f.identidad === 'u-renato')!.racha).toBe(2)

    const perdiendo = ranking([
      partida({ bandos: [[rena], [magui]], totales: [3000, 100], ganador: 0, dia: 1 }),
      partida({ bandos: [[rena], [magui]], totales: [100, 3000], ganador: 1, dia: 2 }),
    ])
    expect(perdiendo.find((f) => f.identidad === 'u-renato')!.racha).toBe(-1)
  })

  it('la diferencia se mide contra el mejor rival, no contra la suma', () => {
    // 1v1v1: 3000 contra 2000 y 500. La diferencia es 1000, no 500.
    const filas = ranking([
      partida({
        bandos: [[rena], [magui], [invitado]],
        totales: [3000, 2000, 500],
        ganador: 0,
        modalidad: '1 vs 1 vs 1',
      }),
    ])
    expect(filas.find((f) => f.identidad === 'u-renato')!.diferenciaPromedio).toBe(1000)
    expect(filas.find((f) => f.identidad === 'j-invitado')!.diferenciaPromedio).toBe(-2500)
  })

  it('ordena por ganadas', () => {
    const filas = ranking([
      partida({ bandos: [[rena], [magui]], totales: [3000, 100], ganador: 0, dia: 1 }),
      partida({ bandos: [[rena], [magui]], totales: [3000, 100], ganador: 0, dia: 2 }),
      partida({ bandos: [[rena], [magui]], totales: [100, 3000], ganador: 1, dia: 3 }),
    ])
    expect(filas[0].identidad).toBe('u-renato')
  })
})

describe('mano a mano', () => {
  it('cuenta ganadas y perdidas contra cada rival', () => {
    const filas = manoAMano(
      [
        partida({ bandos: [[rena], [magui]], totales: [3000, 100], ganador: 0, dia: 1 }),
        partida({ bandos: [[rena], [magui]], totales: [100, 3000], ganador: 1, dia: 2 }),
        partida({ bandos: [[renato], [magui]], totales: [3000, 100], ganador: 0, dia: 3 }),
      ],
      'u-renato',
    )

    expect(filas).toHaveLength(1)
    expect(filas[0]).toMatchObject({ identidad: 'u-magui', jugadas: 3, ganadas: 2, perdidas: 1 })
  })

  it('en 1v1v1 cuenta contra los dos rivales', () => {
    const filas = manoAMano(
      [
        partida({
          bandos: [[rena], [magui], [invitado]],
          totales: [3000, 1000, 500],
          ganador: 0,
          modalidad: '1 vs 1 vs 1',
        }),
      ],
      'u-renato',
    )
    expect(filas).toHaveLength(2)
    expect(filas.every((f) => f.ganadas === 1)).toBe(true)
  })

  it('no cuenta a quien jugó del mismo lado', () => {
    const filas = manoAMano(
      [
        partida({
          bandos: [
            [rena, magui],
            [invitado, jugador('j-cuarto', 'Cuarto')],
          ],
          totales: [3000, 100],
          ganador: 0,
          modalidad: '2 vs 2',
        }),
      ],
      'u-renato',
    )
    expect(filas.map((f) => f.identidad).sort()).toEqual(['j-cuarto', 'j-invitado'])
  })
})

describe('duplas', () => {
  it('cuenta las partidas de cada pareja', () => {
    const rivales = [invitado, jugador('j-cuarto', 'Cuarto')]
    const filas = duplas([
      partida({ bandos: [[rena, magui], rivales], totales: [3000, 100], ganador: 0, modalidad: '2 vs 2', dia: 1 }),
      partida({ bandos: [[renato, maguiOtroGrupo], rivales], totales: [3000, 100], ganador: 0, modalidad: '2 vs 2', dia: 2 }),
      partida({ bandos: [[rena, magui], rivales], totales: [100, 3000], ganador: 1, modalidad: '2 vs 2', dia: 3 }),
    ])

    // Las dos duplas de la misma gente son una sola: la identidad manda sobre el perfil.
    const nuestra = filas.find((f) => f.identidades.includes('u-renato') && f.identidades.includes('u-magui'))!
    expect(nuestra.jugadas).toBe(3)
    expect(nuestra.ganadas).toBe(2)
    expect(nuestra.efectividad).toBeCloseTo(2 / 3)
  })

  it('en 3v3 salen las tres parejas del bando', () => {
    const a = jugador('a', 'A')
    const b = jugador('b', 'B')
    const c = jugador('c', 'C')
    const filas = duplas([
      partida({
        bandos: [
          [a, b, c],
          [invitado, jugador('x', 'X'), jugador('y', 'Y')],
        ],
        totales: [30, 12],
        ganador: 0,
        juego: 'truco',
        modalidad: '3 vs 3',
      }),
    ])
    const nuestras = filas.filter((f) => f.identidades.every((id) => ['a', 'b', 'c'].includes(id)))
    expect(nuestras).toHaveLength(3)
  })

  it('ignora los bandos de un solo jugador', () => {
    expect(duplas([partida({ bandos: [[rena], [magui]], totales: [3000, 100] })])).toHaveLength(0)
  })
})

describe('ficha de un jugador', () => {
  const historial = [
    partida({ bandos: [[rena], [magui]], totales: [3000, 1000], ganador: 0, dia: 1 }),
    partida({ bandos: [[renato], [magui]], totales: [500, 3000], ganador: 1, dia: 2 }),
    partida({ bandos: [[magui], [invitado]], totales: [3000, 10], ganador: 0, dia: 3 }),
  ]

  it('trae sólo las partidas donde jugó, de la más nueva a la más vieja', () => {
    const suyas = partidasDe(historial, 'u-renato')
    expect(suyas).toHaveLength(2)
    expect(suyas[0].terminadaEn! > suyas[1].terminadaEn!).toBe(true)
  })

  it('resume su rendimiento', () => {
    expect(resumenDe(historial, 'u-renato')).toMatchObject({ jugadas: 2, ganadas: 1 })
    expect(resumenDe(historial, 'nadie')).toBeNull()
  })

  it('dice cómo le fue en cada partida, contra el mejor rival', () => {
    const [ultima] = partidasDe(historial, 'u-renato')
    expect(comoLeFue(ultima, 'u-renato')).toEqual({ gano: false, propio: 500, rival: 3000 })
    expect(comoLeFue(ultima, 'nadie')).toBeNull()
  })

  it('lista sólo las parejas donde estuvo', () => {
    const rivales = [invitado, jugador('j-cuarto', 'Cuarto')]
    const conParejas = [
      partida({ bandos: [[rena, magui], rivales], totales: [3000, 100], ganador: 0, modalidad: '2 vs 2', dia: 1 }),
      partida({ bandos: [rivales, [magui, invitado]], totales: [3000, 100], ganador: 0, modalidad: '2 vs 2', dia: 2 }),
    ]
    const suyas = parejasDe(conParejas, 'u-renato')
    expect(suyas).toHaveLength(1)
    expect(suyas[0].identidades).toContain('u-magui')
  })
})

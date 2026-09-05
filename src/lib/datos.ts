'use client'

import { supabaseNavegador } from '@/lib/supabase/cliente'
import type { Asiento, Bando, ClaveJuego, Jugador, Partida } from '@/core/tipos'

/** Acceso a Supabase desde el navegador. El mapeo snake_case → camelCase vive acá y en ningún otro lado. */

interface FilaJugador {
  id: string
  nombre: string
  avatar_url: string | null
}

interface FilaBando {
  id: string
  posicion: number
  etiqueta: string
  color: string
  bando_jugadores: { jugadores: FilaJugador | null }[] | null
}

interface FilaPartida {
  id: string
  grupo_id: string
  juego: ClaveJuego
  modalidad: string
  config: Record<string, unknown>
  estado: Partida['estado']
  totales: Record<string, number>
  codigo_sala: string
  ganador_bando: string | null
  iniciada_en: string
  terminada_en: string | null
  bandos: FilaBando[] | null
}

/*
  ⚠️ `bandos` va con el nombre de su clave foránea, no a secas.

  Hay DOS relaciones entre partidas y bandos: los bandos apuntan a su partida, y
  la partida apunta a su bando ganador. Con `bandos` a secas PostgREST no sabe
  cuál anidar y responde PGRST201 sin traer nada — la partida se crea bien y
  después no se puede abrir.
*/
const SELECT_PARTIDA = `
  id, grupo_id, juego, modalidad, config, estado, totales, codigo_sala,
  ganador_bando, iniciada_en, terminada_en,
  bandos!bandos_partida_id_fkey ( id, posicion, etiqueta, color,
    bando_jugadores ( jugadores ( id, nombre, avatar_url ) ) )
`

function aJugador(fila: FilaJugador): Jugador {
  return { id: fila.id, nombre: fila.nombre, avatarUrl: fila.avatar_url }
}

function aBando(fila: FilaBando): Bando {
  return {
    id: fila.id,
    posicion: fila.posicion,
    etiqueta: fila.etiqueta,
    color: fila.color,
    jugadores: (fila.bando_jugadores ?? [])
      .map((bj) => bj.jugadores)
      .filter((j): j is FilaJugador => Boolean(j))
      .map(aJugador),
  }
}

function aPartida(fila: FilaPartida): Partida {
  return {
    id: fila.id,
    grupoId: fila.grupo_id,
    juego: fila.juego,
    modalidad: fila.modalidad,
    config: fila.config ?? {},
    estado: fila.estado,
    totales: fila.totales ?? {},
    codigoSala: fila.codigo_sala,
    ganadorBandoId: fila.ganador_bando,
    iniciadaEn: fila.iniciada_en,
    terminadaEn: fila.terminada_en,
    bandos: (fila.bandos ?? []).map(aBando).sort((a, b) => a.posicion - b.posicion),
  }
}

// ---------------------------------------------------------------------------
// Jugadores
// ---------------------------------------------------------------------------

export async function listarJugadores(): Promise<Jugador[]> {
  const supabase = supabaseNavegador()
  const { data, error } = await supabase
    .from('jugadores')
    .select('id, nombre, avatar_url')
    .eq('archivado', false)
    .order('nombre')
  if (error) throw error
  return (data as FilaJugador[]).map(aJugador)
}

export async function crearJugador(nombre: string): Promise<Jugador> {
  const supabase = supabaseNavegador()
  const { data: grupoId, error: errorGrupo } = await supabase.rpc('mi_grupo')
  if (errorGrupo) throw errorGrupo

  const { data, error } = await supabase
    .from('jugadores')
    .insert({ nombre: nombre.trim(), grupo_id: grupoId })
    .select('id, nombre, avatar_url')
    .single()
  if (error) throw error
  return aJugador(data as FilaJugador)
}

// ---------------------------------------------------------------------------
// Partidas
// ---------------------------------------------------------------------------

export async function listarPartidas(estado?: Partida['estado']): Promise<Partida[]> {
  const supabase = supabaseNavegador()
  let consulta = supabase.from('partidas').select(SELECT_PARTIDA).order('iniciada_en', { ascending: false })
  if (estado) consulta = consulta.eq('estado', estado)

  const { data, error } = await consulta
  if (error) throw error
  return (data as unknown as FilaPartida[]).map(aPartida)
}

export async function cargarPartida(id: string): Promise<{ partida: Partida; asientos: Asiento[] }> {
  const supabase = supabaseNavegador()

  const [{ data: filaPartida, error: errorPartida }, { data: filasAsientos, error: errorAsientos }] =
    await Promise.all([
      supabase.from('partidas').select(SELECT_PARTIDA).eq('id', id).single(),
      supabase
        .from('asientos')
        .select('id, partida_id, payload, deltas, creado_en, anulado_en')
        .eq('partida_id', id)
        .order('creado_en')
        .order('id'),
    ])

  if (errorPartida) throw errorPartida
  if (errorAsientos) throw errorAsientos

  const asientos: Asiento[] = (filasAsientos ?? []).map((f) => ({
    id: f.id as string,
    partidaId: f.partida_id as string,
    payload: f.payload,
    deltas: (f.deltas ?? {}) as Record<string, number>,
    creadoEn: f.creado_en as string,
    anuladoEn: (f.anulado_en ?? null) as string | null,
  }))

  return { partida: aPartida(filaPartida as unknown as FilaPartida), asientos }
}

export interface BandoNuevo {
  etiqueta: string
  color: string
  jugadores: string[]
}

export async function crearPartida(datos: {
  juego: ClaveJuego
  modalidad: string
  config: Record<string, unknown>
  bandos: BandoNuevo[]
}): Promise<string> {
  const supabase = supabaseNavegador()
  const { data, error } = await supabase.rpc('crear_partida', {
    p_juego: datos.juego,
    p_modalidad: datos.modalidad,
    p_config: datos.config,
    p_bandos: datos.bandos,
  })
  if (error) throw error
  return data as string
}

export async function abandonarPartida(id: string) {
  const supabase = supabaseNavegador()
  const { error } = await supabase.from('partidas').update({ estado: 'abandonada' }).eq('id', id)
  if (error) throw error
}

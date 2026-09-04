'use client'

import { supabaseNavegador } from '@/lib/supabase/cliente'
import { marcarFallo, pendientes, quitarDeLaCola, type Operacion } from './db'

/**
 * Vacía la cola contra Supabase.
 *
 * Todo esto es simple por una sola razón: hay UN escritor por partida. Nadie
 * más toca esas filas, así que no hay ediciones concurrentes que reconciliar
 * y alcanza con reintentar en orden. Reenviar es inofensivo: cada operación
 * cae siempre sobre la misma fila.
 */

export interface EstadoSync {
  pendientes: number
  sincronizando: boolean
  sinRed: boolean
  error: string | null
}

const MAX_INTENTOS = 5

let estado: EstadoSync = { pendientes: 0, sincronizando: false, sinRed: false, error: null }
const oyentes = new Set<(e: EstadoSync) => void>()

export function estadoSync() {
  return estado
}

export function suscribirSync(fn: (e: EstadoSync) => void) {
  oyentes.add(fn)
  fn(estado)
  return () => oyentes.delete(fn)
}

function emitir(parcial: Partial<EstadoSync>) {
  estado = { ...estado, ...parcial }
  oyentes.forEach((fn) => fn(estado))
}

function esFallaDeRed(error: unknown) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const mensaje = error instanceof Error ? error.message : String(error)
  return /fetch|network|failed to fetch|load failed/i.test(mensaje)
}

async function aplicar(op: Operacion, usuarioId: string) {
  const supabase = supabaseNavegador()

  if (op.tipo === 'crear_asiento') {
    const { asiento } = op
    const { error } = await supabase.from('asientos').upsert(
      {
        id: asiento.id,
        partida_id: asiento.partidaId,
        payload: asiento.payload,
        deltas: asiento.deltas,
        creado_en: asiento.creadoEn,
        anulado_en: asiento.anuladoEn,
        creado_por: usuarioId,
      },
      { onConflict: 'id' },
    )
    if (error) throw error
    return
  }

  if (op.tipo === 'anular_asiento') {
    const { error } = await supabase
      .from('asientos')
      .update({ anulado_en: op.anuladoEn })
      .eq('id', op.asientoId)
    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('partidas')
    .update({
      estado: 'terminada',
      ganador_bando: op.ganadorBandoId,
      terminada_en: op.terminadaEn,
    })
    .eq('id', op.partidaId)
  if (error) throw error
}

let corriendo: Promise<void> | null = null

export function drenar() {
  if (!corriendo) {
    corriendo = drenarUnaVez().finally(() => {
      corriendo = null
    })
  }
  return corriendo
}

async function drenarUnaVez() {
  const cola = await pendientes()
  emitir({ pendientes: cola.length })
  if (cola.length === 0) {
    emitir({ error: null, sinRed: false })
    return
  }

  emitir({ sincronizando: true })

  try {
    const supabase = supabaseNavegador()
    const { data } = await supabase.auth.getUser()
    if (!data.user) {
      emitir({ sincronizando: false, error: 'Se cerró la sesión: volvé a entrar para subir lo anotado.' })
      return
    }

    for (const op of cola) {
      // Una operación que ya falló demasiadas veces frena la cola en vez de
      // seguir de largo: el orden importa y nunca se descarta lo anotado.
      if (op.intentos >= MAX_INTENTOS) {
        emitir({
          sincronizando: false,
          error: op.ultimoError ?? 'Hay algo anotado que no se pudo subir.',
        })
        return
      }

      try {
        await aplicar(op, data.user.id)
        await quitarDeLaCola(op.id)
        emitir({ pendientes: (await pendientes()).length })
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error)
        await marcarFallo(op, mensaje)

        if (esFallaDeRed(error)) {
          emitir({ sincronizando: false, sinRed: true, error: null })
          return
        }
        emitir({ sincronizando: false, error: mensaje })
        return
      }
    }

    emitir({ sincronizando: false, sinRed: false, error: null })
  } catch (error) {
    emitir({
      sincronizando: false,
      sinRed: esFallaDeRed(error),
      error: esFallaDeRed(error) ? null : String(error),
    })
  }
}

/** Arranca el drenaje automático: al volver la red y cada tanto. */
export function activarSincronizacion() {
  if (typeof window === 'undefined') return () => {}

  const alVolver = () => {
    emitir({ sinRed: false })
    void drenar()
  }
  const alIrse = () => emitir({ sinRed: true })

  window.addEventListener('online', alVolver)
  window.addEventListener('offline', alIrse)
  const reloj = window.setInterval(() => void drenar(), 20_000)

  emitir({ sinRed: !navigator.onLine })
  void drenar()

  return () => {
    window.removeEventListener('online', alVolver)
    window.removeEventListener('offline', alIrse)
    window.clearInterval(reloj)
  }
}

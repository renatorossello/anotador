'use client'

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Asiento, Partida } from '@/core/tipos'

/**
 * El almacén local del anotador.
 *
 * Guarda la partida entera para poder abrirla sin red, y una cola de
 * operaciones pendientes de subir. Todo lo que se anota entra primero acá y
 * recién después sale a Supabase: si no hay señal, la partida sigue.
 */

export interface OperacionBase {
  /** Id propio de la operación, para no aplicarla dos veces. */
  id: string
  partidaId: string
  creadaEn: string
  intentos: number
  ultimoError?: string
}

export type Operacion = OperacionBase &
  (
    | { tipo: 'crear_asiento'; asiento: Asiento }
    | { tipo: 'anular_asiento'; asientoId: string; anuladoEn: string }
    | { tipo: 'cerrar_partida'; ganadorBandoId: string | null; terminadaEn: string }
  )

interface EsquemaLocal extends DBSchema {
  partidas: {
    key: string
    value: Partida & { guardadaEn: string }
  }
  asientos: {
    key: string
    value: Asiento
    indexes: { 'por-partida': string }
  }
  outbox: {
    key: string
    value: Operacion
    indexes: { 'por-fecha': string; 'por-partida': string }
  }
}

let promesaDb: Promise<IDBPDatabase<EsquemaLocal>> | null = null

export function db() {
  if (!promesaDb) {
    promesaDb = openDB<EsquemaLocal>('anotador', 1, {
      upgrade(base) {
        base.createObjectStore('partidas', { keyPath: 'id' })

        const asientos = base.createObjectStore('asientos', { keyPath: 'id' })
        asientos.createIndex('por-partida', 'partidaId')

        const outbox = base.createObjectStore('outbox', { keyPath: 'id' })
        outbox.createIndex('por-fecha', 'creadaEn')
        outbox.createIndex('por-partida', 'partidaId')
      },
    })
  }
  return promesaDb
}

// ---------------------------------------------------------------------------
// Partidas y asientos en caché
// ---------------------------------------------------------------------------

export async function guardarPartida(partida: Partida, asientos: Asiento[]) {
  const base = await db()
  const tx = base.transaction(['partidas', 'asientos'], 'readwrite')
  await tx.objectStore('partidas').put({ ...partida, guardadaEn: new Date().toISOString() })

  const store = tx.objectStore('asientos')
  for (const asiento of asientos) await store.put(asiento)
  await tx.done
}

export async function leerPartida(id: string) {
  const base = await db()
  const partida = await base.get('partidas', id)
  if (!partida) return null
  const asientos = await base.getAllFromIndex('asientos', 'por-partida', id)
  return { partida, asientos: ordenar(asientos) }
}

export async function guardarAsiento(asiento: Asiento) {
  const base = await db()
  await base.put('asientos', asiento)
}

export async function asientosDe(partidaId: string) {
  const base = await db()
  return ordenar(await base.getAllFromIndex('asientos', 'por-partida', partidaId))
}

/**
 * Orden estable: por reloj del cliente y, si dos caen en el mismo milisegundo,
 * por id. Para la suma da igual —es conmutativa— pero el rayado del truco se
 * dibuja en orden y no puede bailar entre recargas.
 */
export function ordenar(asientos: Asiento[]) {
  return [...asientos].sort(
    (a, b) => a.creadoEn.localeCompare(b.creadoEn) || a.id.localeCompare(b.id),
  )
}

// ---------------------------------------------------------------------------
// Cola de salida
// ---------------------------------------------------------------------------

/**
 * `Omit` sobre una unión colapsa las variantes a lo que tienen en común, así que
 * hay que distribuirlo a mano o `encolar` termina aceptando sólo los campos
 * compartidos y ninguna operación concreta entra.
 */
type SinMetadatos<T> = T extends unknown ? Omit<T, 'creadaEn' | 'intentos'> : never

export type OperacionNueva = SinMetadatos<Operacion>

export async function encolar(op: OperacionNueva) {
  const base = await db()
  await base.put('outbox', { ...op, creadaEn: new Date().toISOString(), intentos: 0 } as Operacion)
}

export async function pendientes() {
  const base = await db()
  return base.getAllFromIndex('outbox', 'por-fecha')
}

export async function pendientesDe(partidaId: string) {
  const base = await db()
  return base.getAllFromIndex('outbox', 'por-partida', partidaId)
}

export async function quitarDeLaCola(id: string) {
  const base = await db()
  await base.delete('outbox', id)
}

export async function marcarFallo(op: Operacion, error: string) {
  const base = await db()
  await base.put('outbox', { ...op, intentos: op.intentos + 1, ultimoError: error })
}

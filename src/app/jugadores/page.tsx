'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Jugador } from '@/core/tipos'
import {
  actualizarJugador,
  archivarJugador,
  crearJugador,
  fusionarJugadores,
  listarJugadores,
} from '@/lib/datos'
import { mensajeDeError } from '@/lib/errores'

const campo =
  'w-full rounded-[10px] border border-white/15 bg-black/20 px-4 py-3 outline-none placeholder:text-white/25 focus:border-[color:var(--color-bando-verde)]'

export default function Jugadores() {
  const [jugadores, setJugadores] = useState<Jugador[]>([])
  const [nombre, setNombre] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void recargar()
  }, [])

  async function recargar() {
    try {
      setJugadores(await listarJugadores())
    } catch (e) {
      setError(mensajeDeError(e, 'No pudimos traer los jugadores.'))
    }
  }

  const repetido = useMemo(
    () => jugadores.some((j) => j.nombre.trim().toLowerCase() === nombre.trim().toLowerCase()),
    [jugadores, nombre],
  )

  async function agregar(evento: React.FormEvent) {
    evento.preventDefault()
    if (!nombre.trim()) return
    setGuardando(true)
    setError(null)
    try {
      await crearJugador(nombre)
      setNombre('')
      await recargar()
    } catch (e) {
      setError(mensajeDeError(e, 'No pudimos guardarlo.'))
    } finally {
      setGuardando(false)
    }
  }

  async function conCarga(accion: () => Promise<unknown>, mensaje: string) {
    setGuardando(true)
    setError(null)
    try {
      await accion()
      setEditando(null)
      await recargar()
    } catch (e) {
      setError(mensajeDeError(e, mensaje))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Jugadores</h1>
        <Link href="/" className="text-sm text-[color:var(--color-tiza-suave)]">
          Volver
        </Link>
      </header>

      <p className="mt-2 text-sm text-[color:var(--color-tiza-tenue)]">
        Son perfiles del grupo, no cuentas. Si le cargás el mail a alguien, esa persona ve en su
        historial las partidas donde jugó.
      </p>

      <form onSubmit={agregar} className="mt-6 flex gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre"
          className={campo}
        />
        <button
          type="submit"
          disabled={guardando || repetido}
          className="boton-pano shrink-0 px-5 font-semibold disabled:opacity-40"
        >
          Agregar
        </button>
      </form>

      {/* Crear un segundo perfil para la misma persona parte su historial en dos,
          y es exactamente lo que pasa cuando alguien quiere ponerle el mail a
          alguien que ya está en la lista. */}
      {repetido && (
        <p className="mt-2 text-sm text-[color:var(--color-alerta)]">
          Ya hay un jugador con ese nombre. Tocalo en la lista para editarlo, en vez de crear otro.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-[color:var(--color-error)]">{error}</p>}

      <ul className="mt-6 flex flex-col gap-2">
        {jugadores.map((jugador) =>
          editando === jugador.id ? (
            <li key={jugador.id} className="tarjeta p-4">
              <Edicion
                jugador={jugador}
                otros={jugadores.filter((j) => j.id !== jugador.id)}
                guardando={guardando}
                onGuardar={(cambios) =>
                  conCarga(() => actualizarJugador(jugador.id, cambios), 'No pudimos guardar el cambio.')
                }
                onFusionar={(destinoId) =>
                  conCarga(() => fusionarJugadores(jugador.id, destinoId), 'No pudimos fusionarlos.')
                }
                onArchivar={() =>
                  conCarga(() => archivarJugador(jugador.id), 'No pudimos archivarlo.')
                }
                onCancelar={() => setEditando(null)}
              />
            </li>
          ) : (
            <li key={jugador.id}>
              <button
                type="button"
                onClick={() => setEditando(jugador.id)}
                className="tarjeta flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{jugador.nombre}</span>
                  <span className="block truncate text-xs text-[color:var(--color-tiza-tenue)]">
                    {jugador.email ?? 'sin mail'}
                  </span>
                </span>
                {jugador.vinculado && (
                  <span className="shrink-0 rounded-full bg-[color:var(--color-bando-verde)]/15 px-2 py-0.5 text-xs text-[color:var(--color-bando-verde)]">
                    vinculado
                  </span>
                )}
                {/* Sin esto no se ve que la fila se pueda tocar, y la gente
                    termina creando un jugador nuevo en vez de editar el que hay. */}
                <span className="shrink-0 text-xs text-[color:var(--color-tiza-tenue)]">Editar</span>
              </button>
            </li>
          ),
        )}
      </ul>
    </main>
  )
}

function Edicion({
  jugador,
  otros,
  guardando,
  onGuardar,
  onFusionar,
  onArchivar,
  onCancelar,
}: {
  jugador: Jugador
  otros: Jugador[]
  guardando: boolean
  onGuardar: (cambios: { nombre: string; email: string | null }) => void
  onFusionar: (destinoId: string) => void
  onArchivar: () => void
  onCancelar: () => void
}) {
  const [nombre, setNombre] = useState(jugador.nombre)
  const [email, setEmail] = useState(jugador.email ?? '')
  const [fusionarCon, setFusionarCon] = useState('')

  const destino = otros.find((j) => j.id === fusionarCon)

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          onGuardar({ nombre, email: email.trim() || null })
        }}
      >
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Mail (opcional)"
          className={campo}
        />

        <p className="text-xs text-[color:var(--color-tiza-tenue)]">
          {jugador.vinculado
            ? 'Ya está vinculado: esa cuenta ve estas partidas en su historial, sin poder anotarlas.'
            : 'Con el mail cargado, se vincula solo la próxima vez que esa persona entre.'}
        </p>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={guardando}
            className="boton-pano flex-1 py-3 font-semibold disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="px-4 py-3 text-sm text-[color:var(--color-tiza-suave)]"
          >
            Cancelar
          </button>
        </div>
      </form>

      {otros.length > 0 && (
        <div className="border-t border-white/10 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[color:var(--color-tiza-tenue)]">
            Es la misma persona que
          </p>
          <div className="flex gap-2">
            <select
              value={fusionarCon}
              onChange={(e) => setFusionarCon(e.target.value)}
              className={campo}
            >
              <option value="">Elegí un jugador…</option>
              {otros.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nombre}
                  {j.email ? ` (${j.email})` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!destino || guardando}
              onClick={() => destino && onFusionar(destino.id)}
              className="boton-pano shrink-0 px-5 font-semibold disabled:opacity-40"
            >
              Fusionar
            </button>
          </div>
          {destino && (
            <p className="mt-2 text-xs text-[color:var(--color-alerta)]">
              Las partidas de {jugador.nombre} pasan a {destino.nombre}, y {jugador.nombre} se
              archiva.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onArchivar}
        disabled={guardando}
        className="self-start text-sm text-[color:var(--color-tiza-tenue)] underline underline-offset-4"
      >
        Archivar — lo saca de las listas, sin tocar sus partidas
      </button>
    </div>
  )
}

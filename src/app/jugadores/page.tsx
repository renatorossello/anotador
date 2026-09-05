'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Jugador } from '@/core/tipos'
import { actualizarJugador, crearJugador, listarJugadores } from '@/lib/datos'
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
    listarJugadores()
      .then(setJugadores)
      .catch((e) => setError(mensajeDeError(e, 'No pudimos traer los jugadores.')))
  }, [])

  function ordenar(lista: Jugador[]) {
    return [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }

  async function agregar(evento: React.FormEvent) {
    evento.preventDefault()
    if (!nombre.trim()) return
    setGuardando(true)
    setError(null)
    try {
      const nuevo = await crearJugador(nombre)
      setJugadores((previos) => ordenar([...previos, nuevo]))
      setNombre('')
    } catch (e) {
      setError(mensajeDeError(e, 'No pudimos guardarlo.'))
    } finally {
      setGuardando(false)
    }
  }

  async function guardar(id: string, cambios: { nombre?: string; email?: string | null }) {
    setGuardando(true)
    setError(null)
    try {
      const actualizado = await actualizarJugador(id, cambios)
      setJugadores((previos) => ordenar(previos.map((j) => (j.id === id ? actualizado : j))))
      setEditando(null)
    } catch (e) {
      setError(mensajeDeError(e, 'No pudimos guardar el cambio.'))
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
        Son perfiles del grupo, no cuentas: nadie tiene que registrarse para que lo anotes. Si le
        cargás el mail, esa persona ve en su historial las partidas donde jugó.
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
          disabled={guardando}
          className="boton-pano shrink-0 px-5 font-semibold disabled:opacity-50"
        >
          Agregar
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-[color:var(--color-error)]">{error}</p>}

      <ul className="mt-6 flex flex-col gap-2">
        {jugadores.map((jugador) =>
          editando === jugador.id ? (
            <li key={jugador.id} className="tarjeta p-4">
              <Edicion
                jugador={jugador}
                guardando={guardando}
                onGuardar={(cambios) => guardar(jugador.id, cambios)}
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
                <span className="flex-1">
                  <span className="block">{jugador.nombre}</span>
                  <span className="block text-xs text-[color:var(--color-tiza-tenue)]">
                    {jugador.email ?? 'sin mail'}
                  </span>
                </span>
                {jugador.vinculado && (
                  <span
                    className="rounded-full bg-[color:var(--color-bando-verde)]/15 px-2 py-0.5 text-xs text-[color:var(--color-bando-verde)]"
                    title="Ya entró con ese mail: ve estas partidas en su historial"
                  >
                    vinculado
                  </span>
                )}
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
  guardando,
  onGuardar,
  onCancelar,
}: {
  jugador: Jugador
  guardando: boolean
  onGuardar: (cambios: { nombre: string; email: string | null }) => void
  onCancelar: () => void
}) {
  const [nombre, setNombre] = useState(jugador.nombre)
  const [email, setEmail] = useState(jugador.email ?? '')

  return (
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
  )
}

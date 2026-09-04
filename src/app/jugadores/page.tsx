'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Jugador } from '@/core/tipos'
import { crearJugador, listarJugadores } from '@/lib/datos'

export default function Jugadores() {
  const [jugadores, setJugadores] = useState<Jugador[]>([])
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listarJugadores().then(setJugadores).catch((e) => setError(String(e)))
  }, [])

  async function agregar(evento: React.FormEvent) {
    evento.preventDefault()
    if (!nombre.trim()) return
    setGuardando(true)
    setError(null)
    try {
      const nuevo = await crearJugador(nombre)
      setJugadores((previos) => [...previos, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setNombre('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos guardarlo.')
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
        Son perfiles del grupo, no cuentas: nadie tiene que registrarse para que lo anoten.
      </p>

      <form onSubmit={agregar} className="mt-6 flex gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre"
          className="flex-1 rounded-[10px] border border-white/15 bg-black/20 px-4 py-3 outline-none focus:border-[color:var(--color-bando-verde)]"
        />
        <button type="submit" disabled={guardando} className="boton-pano px-5 font-semibold disabled:opacity-50">
          Agregar
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-[color:var(--color-error)]">{error}</p>}

      <ul className="mt-6 flex flex-col gap-2">
        {jugadores.map((jugador) => (
          <li key={jugador.id} className="tarjeta px-4 py-3">
            {jugador.nombre}
          </li>
        ))}
      </ul>
    </main>
  )
}

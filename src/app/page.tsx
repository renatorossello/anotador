'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarraSync } from '@/componentes/BarraSync'
import { Marca } from '@/componentes/Marca'
import { colorDe } from '@/componentes/colores'
import { motorDe } from '@/core/motores'
import type { Bando, Partida } from '@/core/tipos'
import { listarPartidas, miGrupoActual } from '@/lib/datos'
import { mensajeDeError } from '@/lib/errores'

export default function Home() {
  const [partidas, setPartidas] = useState<Partida[] | null>(null)
  const [miGrupo, setMiGrupo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // La lista trae también las partidas que jugó pero anotó otro: eso lo
    // resuelve la RLS. Con el grupo propio se sabe cuáles puede tocar.
    void miGrupoActual().then(setMiGrupo)
    listarPartidas()
      .then(setPartidas)
      .catch((e) => setError(mensajeDeError(e, 'No pudimos traer las partidas.')))
  }, [])

  const enCurso = partidas?.filter((p) => p.estado === 'en_curso') ?? []
  const cerradas = partidas?.filter((p) => p.estado !== 'en_curso') ?? []

  return (
    <>
      <BarraSync />

      <main className="mx-auto max-w-2xl px-5 pb-28 pt-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Marca className="h-5 w-auto text-[color:var(--color-bando-verde)]" />
            <h1 className="text-xl font-bold tracking-tight">Anotador</h1>
          </div>
          <Link
            href="/jugadores"
            className="text-sm text-[color:var(--color-tiza-suave)] underline-offset-4 hover:underline"
          >
            Jugadores
          </Link>
        </header>

        {error && <p className="mt-6 text-sm text-[color:var(--color-error)]">{error}</p>}

        {partidas === null && !error && (
          <p className="mt-10 text-sm text-[color:var(--color-tiza-tenue)]">Cargando…</p>
        )}

        {partidas !== null && partidas.length === 0 && (
          <div className="tarjeta mt-10 p-6 text-center">
            <p className="text-lg font-semibold">Todavía no anotaste nada</p>
            <p className="mt-2 text-sm text-[color:var(--color-tiza-suave)]">
              Empezá una partida y quedará el historial de quién ganó qué.
            </p>
          </div>
        )}

        {enCurso.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[color:var(--color-tiza-tenue)]">
              En curso
            </h2>
            <div className="flex flex-col gap-3">
              {enCurso.map((partida) => (
                <TarjetaPartida key={partida.id} partida={partida} mia={partida.grupoId === miGrupo} />
              ))}
            </div>
          </section>
        )}

        {cerradas.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[color:var(--color-tiza-tenue)]">
              Historial
            </h2>
            <div className="flex flex-col gap-3">
              {cerradas.map((partida) => (
                <TarjetaPartida key={partida.id} partida={partida} mia={partida.grupoId === miGrupo} />
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[color:var(--color-pano-900)]/95 px-5 py-4 backdrop-blur">
        <Link
          href="/nueva"
          className="boton-pano mx-auto block max-w-2xl py-4 text-center text-lg font-semibold"
        >
          Nueva partida
        </Link>
      </div>
    </>
  )
}

function TarjetaPartida({ partida, mia }: { partida: Partida; mia: boolean }) {
  const motor = motorDe(partida.juego)
  const terminada = partida.estado !== 'en_curso'

  return (
    <Link href={`/partida/${partida.id}`} className="tarjeta block p-4 active:scale-[0.99]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">
          {motor.nombre}
          <span className="ml-2 text-sm font-normal text-[color:var(--color-tiza-tenue)]">
            {partida.modalidad}
          </span>
        </p>
        <p className="flex shrink-0 items-center gap-2 text-xs text-[color:var(--color-tiza-tenue)]">
          {/* Las que anota otro van en la misma lista, ordenadas por fecha: lo
              único que cambia es que no se pueden tocar, y se avisa sin gritarlo. */}
          {!mia && <span className="rounded-full bg-white/10 px-2 py-0.5">mirás</span>}
          {terminada ? fecha(partida.terminadaEn ?? partida.iniciadaEn) : fecha(partida.iniciadaEn)}
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {partida.bandos.map((bando) => (
          <FilaBando
            key={bando.id}
            bando={bando}
            puntos={partida.totales[bando.id] ?? 0}
            ganador={partida.ganadorBandoId === bando.id}
          />
        ))}
      </div>
    </Link>
  )
}

function FilaBando({ bando, puntos, ganador }: { bando: Bando; puntos: number; ganador: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: colorDe(bando.color) }}
        aria-hidden="true"
      />
      <span className="flex-1 truncate text-sm text-[color:var(--color-tiza-suave)]">
        {nombresDe(bando)}
        {ganador && <span className="ml-2 text-[color:var(--color-bando-verde)]">ganó</span>}
      </span>
      <span className="cifra text-lg font-semibold">{puntos.toLocaleString('es-AR')}</span>
    </div>
  )
}

export function nombresDe(bando: Bando) {
  if (bando.jugadores.length === 0) return bando.etiqueta
  return bando.jugadores.map((j) => j.nombre).join(' y ')
}

function fecha(iso: string) {
  const d = new Date(iso)
  const hoy = new Date()
  const mismoDia = d.toDateString() === hoy.toDateString()
  return mismoDia
    ? d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

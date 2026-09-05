'use client'

import { use } from 'react'
import Link from 'next/link'
import { BarraSync } from '@/componentes/BarraSync'
import { colorDe } from '@/componentes/colores'
import { AnotarBurako } from '@/componentes/anotar/Burako'
import { AnotarTruco } from '@/componentes/anotar/Truco'
import { usePartida } from '@/hooks/usePartida'
import type { Bando } from '@/core/tipos'

export default function PaginaPartida({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const partida = usePartida(id)

  if (partida.cargando) {
    return <p className="p-6 text-sm text-[color:var(--color-tiza-tenue)]">Abriendo la partida…</p>
  }

  if (partida.error || !partida.partida || !partida.motor) {
    return (
      <main className="p-6">
        <p className="text-sm text-[color:var(--color-error)]">{partida.error ?? 'No encontramos la partida.'}</p>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          Volver
        </Link>
      </main>
    )
  }

  const { partida: datos, totales, resultado, motor } = partida
  const terminada = datos.estado !== 'en_curso'
  const ganador = resultado?.ganador ? datos.bandos.find((b) => b.id === resultado.ganador) : null

  return (
    <>
      <BarraSync />

      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-5 pb-6 pt-4">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-sm text-[color:var(--color-tiza-suave)]">
            ← Partidas
          </Link>
          <p className="text-xs uppercase tracking-widest text-[color:var(--color-tiza-tenue)]">
            {motor.nombre} · {datos.modalidad} · a {String(datos.config.objetivo)}
          </p>
        </header>

        <section className="mt-5 grid gap-3" style={{ gridTemplateColumns: `repeat(${datos.bandos.length}, 1fr)` }}>
          {datos.bandos.map((bando) => (
            <Marcador
              key={bando.id}
              bando={bando}
              puntos={totales[bando.id] ?? 0}
              lider={resultado?.puestos[0] === bando.id && datos.bandos.length > 1}
            />
          ))}
        </section>

        {resultado?.desempate && (
          <p className="mt-4 rounded-[10px] bg-[color:var(--color-alerta)]/12 px-4 py-3 text-center text-sm text-[color:var(--color-alerta)]">
            Empatados arriba del objetivo. Va otra ronda.
          </p>
        )}

        {resultado?.terminada && !terminada && partida.puedoAnotar && (
          <div className="mt-4 rounded-[10px] border border-[color:var(--color-bando-verde)]/40 bg-[color:var(--color-bando-verde)]/10 p-4 text-center">
            <p className="text-lg font-semibold">Ganó {ganador ? nombresDe(ganador) : 'la partida'}</p>
            <button
              type="button"
              onClick={() => partida.cerrar(resultado.ganador ?? null)}
              className="boton-pano mt-3 w-full py-3 font-semibold"
            >
              Cerrar la partida
            </button>
          </div>
        )}

        {terminada ? (
          <p className="mt-8 text-center text-sm text-[color:var(--color-tiza-tenue)]">
            {ganador ? `Ganó ${nombresDe(ganador)}.` : 'Partida terminada.'}
          </p>
        ) : partida.puedoAnotar ? (
          <div className="mt-6 flex-1">
            {motor.clave === 'burako' ? (
              <AnotarBurako partida={partida} />
            ) : (
              <AnotarTruco partida={partida} />
            )}
          </div>
        ) : (
          /* Jugás esta partida pero la anota otro: se ve, no se toca. */
          <p className="mt-8 text-center text-sm text-[color:var(--color-tiza-tenue)]">
            Esta partida la anota otra persona. Acá la seguís.
          </p>
        )}

        {!terminada && partida.puedeDeshacer && (
          <button
            type="button"
            onClick={() => partida.deshacer()}
            className="mt-6 self-center px-4 py-2 text-sm text-[color:var(--color-tiza-suave)] underline underline-offset-4"
          >
            Deshacer lo último
          </button>
        )}
      </main>
    </>
  )
}

function Marcador({ bando, puntos, lider }: { bando: Bando; puntos: number; lider: boolean }) {
  const color = colorDe(bando.color)
  return (
    <div
      className="tarjeta px-3 py-4 text-center"
      style={lider ? { borderColor: color, background: `color-mix(in srgb, ${color} 10%, transparent)` } : undefined}
    >
      <p className="truncate text-xs font-semibold uppercase tracking-wider" style={{ color }}>
        {nombresDe(bando)}
      </p>
      <p className="cifra mt-1 text-4xl font-bold">{puntos.toLocaleString('es-AR')}</p>
    </div>
  )
}

function nombresDe(bando: Bando) {
  if (bando.jugadores.length === 0) return bando.etiqueta
  return bando.jugadores.map((j) => j.nombre).join(' y ')
}

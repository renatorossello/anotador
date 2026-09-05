'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Avatar } from '@/componentes/Avatar'
import { JUEGOS, motorDe } from '@/core/motores'
import {
  comoLeFue,
  juegosJugados,
  manoAMano,
  parejasDe,
  partidasDe,
  resumenDe,
} from '@/core/estadisticas'
import type { ClaveJuego, Partida } from '@/core/tipos'
import { listarPartidas } from '@/lib/datos'
import { mensajeDeError } from '@/lib/errores'

export default function FichaJugador({ params }: { params: Promise<{ id: string }> }) {
  const { id: identidad } = use(params)

  const [partidas, setPartidas] = useState<Partida[] | null>(null)
  const [juego, setJuego] = useState<ClaveJuego | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listarPartidas()
      .then(setPartidas)
      .catch((e) => setError(mensajeDeError(e, 'No pudimos traer las partidas.')))
  }, [])

  const jugados = useMemo(() => (partidas ? juegosJugados(partidas) : []), [partidas])
  const activo = juego ?? jugados[0] ?? null
  const filtro = useMemo(() => (activo ? { juego: activo } : {}), [activo])

  const resumen = useMemo(
    () => (partidas ? resumenDe(partidas, identidad, filtro) : null),
    [partidas, identidad, filtro],
  )
  const rivales = useMemo(
    () => (partidas ? manoAMano(partidas, identidad, filtro) : []),
    [partidas, identidad, filtro],
  )
  const parejas = useMemo(
    () => (partidas ? parejasDe(partidas, identidad, filtro) : []),
    [partidas, identidad, filtro],
  )
  const historial = useMemo(
    () => (partidas ? partidasDe(partidas, identidad, filtro) : []),
    [partidas, identidad, filtro],
  )

  return (
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {resumen && <Avatar nombre={resumen.nombre} url={resumen.avatarUrl} tamaño={44} />}
          <h1 className="truncate text-xl font-bold tracking-tight">
            {resumen?.nombre ?? 'Jugador'}
          </h1>
        </div>
        <Link href="/stats" className="shrink-0 text-sm text-[color:var(--color-tiza-suave)]">
          Volver
        </Link>
      </header>

      {error && <p className="mt-6 text-sm text-[color:var(--color-error)]">{error}</p>}
      {partidas === null && !error && (
        <p className="mt-10 text-sm text-[color:var(--color-tiza-tenue)]">Calculando…</p>
      )}

      {partidas !== null && !resumen && (
        <p className="mt-10 text-sm text-[color:var(--color-tiza-tenue)]">
          Todavía no tiene partidas terminadas.
        </p>
      )}

      {resumen && activo && (
        <>
          {jugados.length > 1 && (
            <div className="mt-6 flex gap-2">
              {JUEGOS.filter((j) => jugados.includes(j.clave)).map((j) => (
                <button
                  key={j.clave}
                  type="button"
                  onClick={() => setJuego(j.clave)}
                  className={`rounded-full px-5 py-2 font-semibold transition ${
                    j.clave === activo
                      ? 'bg-[color:var(--color-bando-verde)] text-[color:var(--color-pano-900)]'
                      : 'border border-white/15 text-[color:var(--color-tiza-suave)]'
                  }`}
                >
                  {j.nombre}
                </button>
              ))}
            </div>
          )}

          <section className="mt-5 grid grid-cols-3 gap-3">
            <Dato titulo="Jugadas" valor={String(resumen.jugadas)} />
            <Dato titulo="Ganadas" valor={String(resumen.ganadas)} destacado />
            <Dato
              titulo="Efectividad"
              valor={`${Math.round(resumen.efectividad * 100)}%`}
              nota={`sobre ${resumen.jugadas}`}
            />
          </section>

          <section className="mt-3 grid grid-cols-2 gap-3">
            <Dato
              titulo="Racha"
              valor={
                resumen.racha === 0
                  ? '—'
                  : `${resumen.racha > 0 ? '+' : '−'}${Math.abs(resumen.racha)}`
              }
              nota={resumen.racha > 0 ? 'ganadas seguidas' : resumen.racha < 0 ? 'perdidas seguidas' : ''}
            />
            <Dato
              titulo="Diferencia"
              valor={`${resumen.diferenciaPromedio > 0 ? '+' : ''}${Math.round(resumen.diferenciaPromedio)}`}
              nota={`promedio en ${motorDe(activo).nombre}`}
            />
          </section>

          {rivales.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[color:var(--color-tiza-tenue)]">
                Mano a mano
              </h2>
              <div className="flex flex-col gap-2">
                {rivales.map((rival) => (
                  <Link
                    key={rival.identidad}
                    href={`/jugador/${rival.identidad}`}
                    className="tarjeta flex items-center gap-3 px-4 py-3"
                  >
                    <Avatar nombre={rival.nombre} url={null} tamaño={32} />
                    <span className="flex-1 truncate">{rival.nombre}</span>
                    <span className="cifra text-sm">
                      <span style={{ color: 'var(--color-bando-verde)' }}>{rival.ganadas}</span>
                      <span className="mx-1 text-[color:var(--color-tiza-tenue)]">–</span>
                      <span style={{ color: 'var(--color-bando-bordo)' }}>{rival.perdidas}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {parejas.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[color:var(--color-tiza-tenue)]">
                Jugando en pareja
              </h2>
              <div className="flex flex-col gap-2">
                {parejas.map((pareja) => (
                  <div
                    key={pareja.identidades.join('|')}
                    className="tarjeta flex items-center gap-3 px-4 py-3"
                  >
                    <span className="flex-1 truncate">{pareja.nombre}</span>
                    <span className="cifra text-sm text-[color:var(--color-tiza-suave)]">
                      {pareja.ganadas} de {pareja.jugadas}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[color:var(--color-tiza-tenue)]">
              Últimas partidas
            </h2>
            <div className="flex flex-col gap-2">
              {historial.slice(0, 20).map((partida) => {
                const resultado = comoLeFue(partida, identidad)
                if (!resultado) return null
                return (
                  <Link
                    key={partida.id}
                    href={`/partida/${partida.id}`}
                    className="tarjeta flex items-center gap-3 px-4 py-3"
                  >
                    <span
                      className="w-14 shrink-0 text-xs font-semibold uppercase tracking-wider"
                      style={{
                        color: resultado.gano ? 'var(--color-bando-verde)' : 'var(--color-bando-bordo)',
                      }}
                    >
                      {resultado.gano ? 'Ganó' : 'Perdió'}
                    </span>
                    <span className="cifra flex-1 text-sm">
                      {resultado.propio.toLocaleString('es-AR')}
                      <span className="mx-1.5 text-[color:var(--color-tiza-tenue)]">–</span>
                      {resultado.rival.toLocaleString('es-AR')}
                    </span>
                    <span className="shrink-0 text-xs text-[color:var(--color-tiza-tenue)]">
                      {partida.modalidad} · {fecha(partida.terminadaEn)}
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        </>
      )}
    </main>
  )
}

function Dato({
  titulo,
  valor,
  nota,
  destacado,
}: {
  titulo: string
  valor: string
  nota?: string
  destacado?: boolean
}) {
  return (
    <div className="tarjeta px-3 py-4 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--color-tiza-tenue)]">
        {titulo}
      </p>
      <p
        className="cifra mt-1 text-3xl font-bold"
        style={destacado ? { color: 'var(--color-bando-verde)' } : undefined}
      >
        {valor}
      </p>
      {nota && <p className="mt-0.5 text-[10px] text-[color:var(--color-tiza-tenue)]">{nota}</p>}
    </div>
  )
}

function fecha(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

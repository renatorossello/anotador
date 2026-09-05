'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { JUEGOS, motorDe } from '@/core/motores'
import { duplas, juegosJugados, ranking, terminadas } from '@/core/estadisticas'
import type { ClaveJuego, Partida } from '@/core/tipos'
import { listarPartidas } from '@/lib/datos'
import { mensajeDeError } from '@/lib/errores'

/** El mínimo de partidas para entrar a los rankings de duplas. */
const MINIMO_DUPLA = 2

export default function Stats() {
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
  const filas = useMemo(() => (partidas ? ranking(partidas, filtro) : []), [partidas, filtro])
  const parejas = useMemo(
    () => (partidas ? duplas(partidas, filtro).filter((d) => d.jugadas >= MINIMO_DUPLA) : []),
    [partidas, filtro],
  )
  const cuantas = useMemo(() => (partidas ? terminadas(partidas, filtro).length : 0), [partidas, filtro])

  return (
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Estadísticas</h1>
        <Link href="/" className="text-sm text-[color:var(--color-tiza-suave)]">
          Volver
        </Link>
      </header>

      {error && <p className="mt-6 text-sm text-[color:var(--color-error)]">{error}</p>}
      {partidas === null && !error && (
        <p className="mt-10 text-sm text-[color:var(--color-tiza-tenue)]">Calculando…</p>
      )}

      {partidas !== null && jugados.length === 0 && (
        <div className="tarjeta mt-10 p-6 text-center">
          <p className="text-lg font-semibold">Todavía no hay partidas terminadas</p>
          <p className="mt-2 text-sm text-[color:var(--color-tiza-suave)]">
            Las partidas se cierran solas cuando alguien llega al objetivo. Ahí empiezan a contar.
          </p>
        </div>
      )}

      {activo && (
        <>
          {/* Truco y Burako nunca en la misma tabla: 30 y 3000 no son comparables. */}
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

          <p className="mt-4 text-xs text-[color:var(--color-tiza-tenue)]">
            {cuantas} {cuantas === 1 ? 'partida terminada' : 'partidas terminadas'} de{' '}
            {motorDe(activo).nombre}
          </p>

          <section className="mt-4">
            <div className="tarjeta overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-[color:var(--color-tiza-tenue)]">
                    <th className="px-4 py-3 text-left font-semibold">Jugador</th>
                    <th className="px-2 py-3 text-right font-semibold">PJ</th>
                    <th className="px-2 py-3 text-right font-semibold">PG</th>
                    <th className="px-2 py-3 text-right font-semibold">%</th>
                    <th className="px-4 py-3 text-right font-semibold">Racha</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila) => (
                    <tr key={fila.identidad} className="border-t border-white/8">
                      <td className="px-4 py-3">{fila.nombre}</td>
                      <td className="cifra px-2 py-3 text-right">{fila.jugadas}</td>
                      <td className="cifra px-2 py-3 text-right font-semibold">{fila.ganadas}</td>
                      {/* El porcentaje va siempre con las jugadas al lado: sobre dos
                          partidas, un 100 % es ruido presentado como dato. */}
                      <td className="cifra px-2 py-3 text-right text-[color:var(--color-tiza-suave)]">
                        {Math.round(fila.efectividad * 100)}
                      </td>
                      <td className="cifra px-4 py-3 text-right">
                        <Racha valor={fila.racha} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {parejas.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[color:var(--color-tiza-tenue)]">
                Parejas
              </h2>
              <div className="flex flex-col gap-2">
                {parejas.map((dupla) => (
                  <div
                    key={dupla.identidades.join('|')}
                    className="tarjeta flex items-center gap-3 px-4 py-3"
                  >
                    <span className="flex-1 truncate">{dupla.nombre}</span>
                    <span className="cifra text-sm text-[color:var(--color-tiza-suave)]">
                      {dupla.ganadas} de {dupla.jugadas}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}

function Racha({ valor }: { valor: number }) {
  if (valor === 0) return <span className="text-[color:var(--color-tiza-tenue)]">—</span>

  const gana = valor > 0
  return (
    <span
      style={{ color: gana ? 'var(--color-bando-verde)' : 'var(--color-bando-bordo)' }}
      title={gana ? 'partidas ganadas seguidas' : 'partidas perdidas seguidas'}
    >
      {gana ? '+' : '−'}
      {Math.abs(valor)}
    </span>
  )
}

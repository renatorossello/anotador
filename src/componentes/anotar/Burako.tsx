'use client'

import { useState } from 'react'
import { colorDe } from '@/componentes/colores'
import { vivos } from '@/core/puntajes'
import type { usePartida } from '@/hooks/usePartida'

type Partida = ReturnType<typeof usePartida>

/**
 * Se cierra la ronda con un número por bando.
 *
 * ⚠️ El signo va en un botón aparte, y no se escribe.
 *
 * En Burako se resta seguido, pero **el teclado numérico de un teléfono no tiene
 * el signo menos**: con `inputMode="numeric"` salen los diez dígitos y borrar, y
 * nada más. Cambiar a teclado alfabético para poder tipear un guion sería peor
 * —se anota con una mano, en una mesa—, así que los dígitos van por el teclado
 * numérico y el signo por un toque.
 */
export function AnotarBurako({ partida }: { partida: Partida }) {
  const bandos = partida.partida?.bandos ?? []
  const [valores, setValores] = useState<Record<string, string>>({})
  const [negativos, setNegativos] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function cerrarRonda() {
    setGuardando(true)
    setError(null)

    const puntos: Record<string, number> = {}
    for (const bando of bandos) {
      const crudo = (valores[bando.id] ?? '').replace(/\D/g, '')
      const valor = crudo === '' ? 0 : Number(crudo)
      if (!Number.isFinite(valor)) {
        setError(`Revisá el puntaje de ${bando.etiqueta}.`)
        setGuardando(false)
        return
      }
      puntos[bando.id] = negativos[bando.id] ? -valor : valor
    }

    const problema = await partida.anotar({ puntos })
    setGuardando(false)
    if (problema) {
      setError(problema)
    } else {
      setValores({})
      setNegativos({})
    }
  }

  const rondas = vivos(partida.asientos)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--color-tiza-tenue)]">
        Ronda {rondas.length + 1}
      </p>

      <div className="flex flex-col gap-3">
        {bandos.map((bando) => (
          <label key={bando.id} className="tarjeta flex items-center gap-2 px-3 py-3">
            <span
              className="min-w-0 flex-1 truncate text-sm font-semibold"
              style={{ color: colorDe(bando.color) }}
            >
              {bando.jugadores.map((j) => j.nombre).join(' y ') || bando.etiqueta}
            </span>

            <button
              type="button"
              onClick={() => setNegativos((n) => ({ ...n, [bando.id]: !n[bando.id] }))}
              aria-pressed={Boolean(negativos[bando.id])}
              aria-label={`Cambiar el signo de ${bando.etiqueta}`}
              className={`h-11 w-11 shrink-0 rounded-full border text-xl font-bold transition ${
                negativos[bando.id]
                  ? 'border-transparent bg-[color:var(--color-bando-bordo)] text-[color:var(--color-pano-900)]'
                  : 'border-white/20 text-[color:var(--color-tiza-suave)]'
              }`}
            >
              {negativos[bando.id] ? '−' : '+'}
            </button>

            <span
              className="cifra flex min-w-0 items-baseline text-3xl font-bold"
              style={negativos[bando.id] ? { color: 'var(--color-bando-bordo)' } : undefined}
            >
              {negativos[bando.id] && <span aria-hidden="true">−</span>}
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                value={valores[bando.id] ?? ''}
                onChange={(e) =>
                  // Los dígitos y nada más: el signo es del botón, así que un
                  // guion tipeado no puede convivir con él y dar dos signos.
                  setValores((v) => ({ ...v, [bando.id]: e.target.value.replace(/\D/g, '') }))
                }
                className="cifra w-20 bg-transparent text-right text-3xl font-bold outline-none placeholder:text-white/20"
              />
            </span>
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-[color:var(--color-error)]">{error}</p>}

      <button
        type="button"
        onClick={cerrarRonda}
        disabled={guardando}
        className="boton-pano py-4 text-lg font-semibold disabled:opacity-50"
      >
        {guardando ? 'Anotando…' : 'Cerrar ronda'}
      </button>

      {rondas.length > 0 && (
        <section className="mt-2">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[color:var(--color-tiza-tenue)]">
            Rondas
          </h2>
          <ol className="flex flex-col gap-1">
            {rondas.map((asiento, i) => (
              <li key={asiento.id} className="flex items-center gap-3 px-1 py-1.5 text-sm">
                <span className="w-6 text-[color:var(--color-tiza-tenue)]">{i + 1}</span>
                <span className="flex flex-1 justify-end gap-4">
                  {bandos.map((bando) => (
                    <span key={bando.id} className="cifra w-16 text-right" style={{ color: colorDe(bando.color) }}>
                      {(asiento.deltas[bando.id] ?? 0).toLocaleString('es-AR')}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}

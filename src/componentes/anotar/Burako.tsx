'use client'

import { useState } from 'react'
import { colorDe } from '@/componentes/colores'
import { vivos } from '@/core/puntajes'
import type { usePartida } from '@/hooks/usePartida'

type Partida = ReturnType<typeof usePartida>

/**
 * Se cierra la ronda con un número por bando. Admite negativos —en Burako se
 * resta— y por eso el campo no puede ser un `type="number"` a secas: en el
 * teclado de un teléfono el signo menos no aparece.
 */
export function AnotarBurako({ partida }: { partida: Partida }) {
  const bandos = partida.partida?.bandos ?? []
  const [valores, setValores] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function cerrarRonda() {
    setGuardando(true)
    setError(null)

    const puntos: Record<string, number> = {}
    for (const bando of bandos) {
      const crudo = (valores[bando.id] ?? '').trim()
      const valor = crudo === '' ? 0 : Number(crudo.replace(',', '.'))
      if (!Number.isFinite(valor)) {
        setError(`Revisá el puntaje de ${bando.etiqueta}.`)
        setGuardando(false)
        return
      }
      puntos[bando.id] = Math.trunc(valor)
    }

    const problema = await partida.anotar({ puntos })
    setGuardando(false)
    if (problema) setError(problema)
    else setValores({})
  }

  const rondas = vivos(partida.asientos)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--color-tiza-tenue)]">
        Ronda {rondas.length + 1}
      </p>

      <div className="flex flex-col gap-3">
        {bandos.map((bando) => (
          <label key={bando.id} className="tarjeta flex items-center gap-3 px-4 py-3">
            <span
              className="w-28 shrink-0 truncate text-sm font-semibold"
              style={{ color: colorDe(bando.color) }}
            >
              {bando.jugadores.map((j) => j.nombre).join(' y ') || bando.etiqueta}
            </span>
            <input
              inputMode="numeric"
              pattern="-?[0-9]*"
              placeholder="0"
              value={valores[bando.id] ?? ''}
              onChange={(e) => setValores((v) => ({ ...v, [bando.id]: e.target.value }))}
              className="cifra w-full bg-transparent text-right text-3xl font-bold outline-none placeholder:text-white/20"
            />
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

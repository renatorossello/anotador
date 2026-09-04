'use client'

import { useState } from 'react'
import { colorDe } from '@/componentes/colores'
import { corteDeMalas } from '@/core/motores/truco'
import type { usePartida } from '@/hooks/usePartida'

type Partida = ReturnType<typeof usePartida>

/**
 * El rayado, como en el papel: un toque por punto.
 *
 * Cada toque es un asiento propio, así deshacer saca exactamente el último
 * punto anotado. Se anota muy seguido: todo lo que no sea un toque sobra.
 */
export function AnotarTruco({ partida }: { partida: Partida }) {
  const bandos = partida.partida?.bandos ?? []
  const objetivo = Number(partida.partida?.config.objetivo ?? 30)
  const corte = corteDeMalas(objetivo)
  const [error, setError] = useState<string | null>(null)

  async function sumar(bandoId: string, puntos: number) {
    const problema = await partida.anotar({ bando: bandoId, puntos })
    setError(problema)
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-[color:var(--color-error)]">{error}</p>}

      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${bandos.length}, 1fr)` }}>
        {bandos.map((bando) => {
          const total = partida.totales[bando.id] ?? 0
          const color = colorDe(bando.color)

          return (
            <div key={bando.id} className="flex flex-col gap-3">
              <div className="tarjeta flex flex-col gap-3 p-3">
                <Rayado puntos={Math.min(total, corte)} maximo={corte} color={color} rotulo="Malas" />
                <div className="h-px bg-white/15" />
                <Rayado
                  puntos={Math.max(0, total - corte)}
                  maximo={objetivo - corte}
                  color={color}
                  rotulo="Buenas"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((puntos) => (
                  <button
                    key={puntos}
                    type="button"
                    onClick={() => sumar(bando.id, puntos)}
                    className="boton-pano py-4 text-xl font-bold"
                    style={{ color }}
                    aria-label={`Sumar ${puntos} a ${bando.etiqueta}`}
                  >
                    +{puntos}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-[color:var(--color-tiza-tenue)]">
        Las malas son los primeros {corte} puntos. Se juega a {objetivo}.
      </p>
    </div>
  )
}

/**
 * Los palitos, agrupados de a cinco: cuatro verticales y la diagonal que cierra.
 * Se dibujan los grupos que caben en la mitad; los vacíos quedan tenues para que
 * se vea cuánto falta.
 */
function Rayado({
  puntos,
  maximo,
  color,
  rotulo,
}: {
  puntos: number
  maximo: number
  color: string
  rotulo: string
}) {
  const grupos = Math.ceil(maximo / 5)

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--color-tiza-tenue)]">
        {rotulo} <span className="cifra ml-1 text-[color:var(--color-tiza-suave)]">{puntos}</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: grupos }, (_, i) => (
          <Grupo key={i} llenos={Math.max(0, Math.min(5, puntos - i * 5))} color={color} />
        ))}
      </div>
    </div>
  )
}

function Grupo({ llenos, color }: { llenos: number; color: string }) {
  const palitos = [0, 1, 2, 3]

  return (
    <svg viewBox="0 0 30 26" className="h-6 w-7" aria-hidden="true">
      {palitos.map((i) => (
        <line
          key={i}
          x1={4 + i * 7}
          y1={3}
          x2={4 + i * 7}
          y2={23}
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
          opacity={llenos > i ? 1 : 0.13}
        />
      ))}
      <line
        x1={1}
        y1={22}
        x2={28}
        y2={4}
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        opacity={llenos >= 5 ? 1 : 0.13}
      />
    </svg>
  )
}

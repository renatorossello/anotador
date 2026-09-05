'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { COLORES_BANDO, colorDe } from '@/componentes/colores'
import { JUEGOS, motorDe } from '@/core/motores'
import type { ClaveJuego, Jugador, Modalidad } from '@/core/tipos'
import { crearJugador, crearPartida, listarJugadores } from '@/lib/datos'

/**
 * Armar la partida: juego, modalidad, a cuánto se juega y quién juega con quién.
 * Nada de esto sabe de Truco ni de Burako — sale todo del motor.
 */
export default function Nueva() {
  const router = useRouter()

  const [juego, setJuego] = useState<ClaveJuego>('burako')
  const [modalidadClave, setModalidadClave] = useState<string>('2v2')
  const [config, setConfig] = useState<Record<string, unknown>>(motorDe('burako').configPorDefecto)
  const [equipos, setEquipos] = useState<string[][]>([[], []])

  const [jugadores, setJugadores] = useState<Jugador[]>([])
  const [eligiendo, setEligiendo] = useState<number | null>(null)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const motor = useMemo(() => motorDe(juego), [juego])
  const modalidad = useMemo(
    () => motor.modalidades.find((m) => m.clave === modalidadClave) ?? motor.modalidades[0],
    [motor, modalidadClave],
  )

  useEffect(() => {
    listarJugadores().then(setJugadores).catch(() => setJugadores([]))
  }, [])

  function cambiarJuego(clave: ClaveJuego) {
    const nuevo = motorDe(clave)
    const primera = nuevo.modalidades[0]
    setJuego(clave)
    setConfig(nuevo.configPorDefecto)
    setModalidadClave(primera.clave)
    setEquipos(vaciar(primera))
  }

  function cambiarModalidad(nueva: Modalidad) {
    setModalidadClave(nueva.clave)
    // Se conserva lo que ya estaba elegido y entra en la modalidad nueva.
    setEquipos((previos) =>
      Array.from({ length: nueva.bandos }, (_, i) => (previos[i] ?? []).slice(0, nueva.porBando)),
    )
  }

  function ponerJugador(bando: number, jugadorId: string) {
    setEquipos((previos) =>
      previos.map((equipo, i) => {
        const sinEste = equipo.filter((id) => id !== jugadorId)
        if (i !== bando) return sinEste
        return [...sinEste, jugadorId].slice(-modalidad.porBando)
      }),
    )
    setEligiendo(null)
  }

  function sacarJugador(bando: number, jugadorId: string) {
    setEquipos((previos) => previos.map((e, i) => (i === bando ? e.filter((id) => id !== jugadorId) : e)))
  }

  const completo = equipos.every((e) => e.length === modalidad.porBando)

  async function empezar() {
    if (!completo) return
    setCreando(true)
    setError(null)
    try {
      const id = await crearPartida({
        juego,
        modalidad: modalidad.etiqueta,
        config,
        bandos: equipos.map((ids, i) => ({
          etiqueta: etiquetaDe(ids, jugadores, i),
          color: COLORES_BANDO[i % COLORES_BANDO.length],
          jugadores: ids,
        })),
      })
      router.push(`/partida/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos crear la partida.')
      setCreando(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-5 pb-28 pt-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Nueva partida</h1>
        <Link href="/" className="text-sm text-[color:var(--color-tiza-suave)]">
          Cancelar
        </Link>
      </header>

      <Grupo titulo="Juego">
        <div className="flex gap-2">
          {JUEGOS.map((j) => (
            <Opcion key={j.clave} activa={j.clave === juego} onClick={() => cambiarJuego(j.clave)}>
              {j.nombre}
            </Opcion>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Cómo se juega">
        <div className="flex flex-wrap gap-2">
          {motor.modalidades.map((m) => (
            <Opcion key={m.clave} activa={m.clave === modalidad.clave} onClick={() => cambiarModalidad(m)}>
              {m.etiqueta}
            </Opcion>
          ))}
        </div>
      </Grupo>

      {motor.opcionesConfig.map((campo) =>
        campo.tipo === 'opciones' ? (
          <Grupo key={campo.clave} titulo={campo.etiqueta} ayuda={campo.ayuda}>
            <div className="flex flex-wrap gap-2">
              {campo.opciones.map((opcion) => (
                <Opcion
                  key={String(opcion.valor)}
                  activa={config[campo.clave] === opcion.valor}
                  onClick={() => setConfig((c) => ({ ...c, [campo.clave]: opcion.valor }))}
                >
                  {opcion.etiqueta}
                </Opcion>
              ))}
            </div>
          </Grupo>
        ) : null,
      )}

      <Grupo titulo="Quién juega">
        <div className="flex flex-col gap-3">
          {equipos.map((ids, i) => (
            <div key={i} className="tarjeta p-4">
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: colorDe(COLORES_BANDO[i % COLORES_BANDO.length]) }}
                />
                <span className="text-xs font-semibold uppercase tracking-widest text-[color:var(--color-tiza-tenue)]">
                  Bando {i + 1}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {ids.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => sacarJugador(i, id)}
                    className="rounded-full border border-white/20 px-4 py-2 text-sm"
                  >
                    {nombreDe(id, jugadores)} <span className="ml-1 opacity-60">×</span>
                  </button>
                ))}

                {ids.length < modalidad.porBando && (
                  <button
                    type="button"
                    onClick={() => setEligiendo(i)}
                    className="rounded-full border border-dashed border-white/25 px-4 py-2 text-sm text-[color:var(--color-tiza-suave)]"
                  >
                    + Agregar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Grupo>

      {error && <p className="mt-4 text-sm text-[color:var(--color-error)]">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[color:var(--color-pano-900)]/95 px-5 py-4 backdrop-blur">
        <button
          type="button"
          onClick={empezar}
          disabled={!completo || creando}
          className="boton-pano mx-auto block w-full max-w-2xl py-4 text-lg font-semibold disabled:opacity-40"
        >
          {creando ? 'Creando…' : completo ? 'Empezar' : 'Falta elegir jugadores'}
        </button>
      </div>

      {eligiendo !== null && (
        <SelectorJugador
          jugadores={jugadores}
          usados={equipos.flat()}
          onElegir={(id) => ponerJugador(eligiendo, id)}
          onCrear={async (nombre) => {
            const nuevo = await crearJugador(nombre)
            setJugadores((previos) => [...previos, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)))
            ponerJugador(eligiendo, nuevo.id)
          }}
          onCerrar={() => setEligiendo(null)}
        />
      )}
    </main>
  )
}

function SelectorJugador({
  jugadores,
  usados,
  onElegir,
  onCrear,
  onCerrar,
}: {
  jugadores: Jugador[]
  usados: string[]
  onElegir: (id: string) => void
  onCrear: (nombre: string) => Promise<void>
  onCerrar: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [creando, setCreando] = useState(false)
  const libres = jugadores.filter((j) => !usados.includes(j.id))

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/60" onClick={onCerrar}>
      <div
        className="max-h-[80dvh] w-full overflow-y-auto rounded-t-2xl bg-[color:var(--color-pano-800)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[color:var(--color-tiza-tenue)]">
          Quién entra
        </p>

        <div className="flex flex-col gap-2">
          {libres.map((jugador) => (
            <button
              key={jugador.id}
              type="button"
              onClick={() => onElegir(jugador.id)}
              className="boton-pano flex items-center gap-3 px-4 py-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg">{jugador.nombre}</span>
                {/* Dos jugadores pueden llamarse igual: sin el mail a la vista, la
                    lista muestra dos filas idénticas y no hay forma de elegir. */}
                <span className="block truncate text-xs text-[color:var(--color-tiza-tenue)]">
                  {jugador.email ?? 'sin mail'}
                </span>
              </span>
              {jugador.vinculado && (
                <span className="shrink-0 rounded-full bg-[color:var(--color-bando-verde)]/15 px-2 py-0.5 text-xs text-[color:var(--color-bando-verde)]">
                  vinculado
                </span>
              )}
            </button>
          ))}
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!nombre.trim()) return
            setCreando(true)
            await onCrear(nombre.trim())
            setCreando(false)
          }}
        >
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Alguien nuevo"
            className="flex-1 rounded-[10px] border border-white/15 bg-black/20 px-4 py-3 outline-none focus:border-[color:var(--color-bando-verde)]"
          />
          <button type="submit" disabled={creando} className="boton-pano px-5 font-semibold disabled:opacity-50">
            Sumar
          </button>
        </form>
      </div>
    </div>
  )
}

function Grupo({
  titulo,
  ayuda,
  children,
}: {
  titulo: string
  ayuda?: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-7">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[color:var(--color-tiza-tenue)]">
        {titulo}
      </h2>
      {children}
      {ayuda && <p className="mt-2 text-xs text-[color:var(--color-tiza-tenue)]">{ayuda}</p>}
    </section>
  )
}

function Opcion({
  activa,
  onClick,
  children,
}: {
  activa: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-5 py-2.5 font-semibold transition ${
        activa
          ? 'bg-[color:var(--color-bando-verde)] text-[color:var(--color-pano-900)]'
          : 'border border-white/15 text-[color:var(--color-tiza-suave)]'
      }`}
    >
      {children}
    </button>
  )
}

function vaciar(modalidad: Modalidad): string[][] {
  return Array.from({ length: modalidad.bandos }, () => [])
}

function nombreDe(id: string, jugadores: Jugador[]) {
  return jugadores.find((j) => j.id === id)?.nombre ?? '¿?'
}

function etiquetaDe(ids: string[], jugadores: Jugador[], indice: number) {
  const nombres = ids.map((id) => nombreDe(id, jugadores))
  return nombres.length ? nombres.join(' y ') : `Bando ${indice + 1}`
}

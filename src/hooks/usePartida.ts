'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motorDe } from '@/core/motores'
import { sumar, vivos } from '@/core/puntajes'
import type { Asiento, Partida, Resultado } from '@/core/tipos'
import { cargarPartida, miGrupoActual } from '@/lib/datos'
import { mensajeDeError } from '@/lib/errores'
import { encolar, guardarAsiento, guardarPartida, leerPartida, ordenar } from '@/lib/local/db'
import { drenar } from '@/lib/local/sync'

/**
 * La partida abierta, con todo lo que hace falta para anotarla.
 *
 * Escribe SIEMPRE primero en el dispositivo y encola la subida: si no hay red,
 * la partida sigue igual. Y como cada asiento nace con su uuid definitivo,
 * reintentar la subida más tarde no puede duplicar nada.
 */
export function usePartida(id: string) {
  const [partida, setPartida] = useState<Partida | null>(null)
  const [asientos, setAsientos] = useState<Asiento[]>([])
  const [miGrupo, setMiGrupo] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Evita que la sincronización de estado se dispare otra vez mientras corre.
  const sincronizandoEstado = useRef(false)

  useEffect(() => {
    let vigente = true

    async function cargar() {
      // Primero lo que haya en el dispositivo: abre al instante y funciona
      // sin señal. Después, si hay red, se pone al día.
      const local = await leerPartida(id)
      if (vigente && local) {
        setPartida(local.partida)
        setAsientos(local.asientos)
        setCargando(false)
      }

      try {
        const { partida: remota, asientos: remotos } = await cargarPartida(id)
        await guardarPartida(remota, remotos)
        if (!vigente) return
        setPartida(remota)
        // Lo anotado sin subir todavía no está en la respuesta del servidor:
        // se conserva lo local y se completa con lo remoto.
        setAsientos((previos) => fusionar(previos, remotos))
        setError(null)
      } catch (e) {
        if (vigente && !local) setError(mensajeDeError(e, 'No pudimos cargar la partida.'))
      } finally {
        if (vigente) setCargando(false)
      }
    }

    void cargar()
    return () => {
      vigente = false
    }
  }, [id])

  useEffect(() => {
    void miGrupoActual().then(setMiGrupo)
  }, [])

  const motor = useMemo(() => (partida ? motorDe(partida.juego) : null), [partida])
  const totales = useMemo(() => (partida ? sumar(asientos, partida.bandos) : {}), [asientos, partida])

  const resultado: Resultado | null = useMemo(() => {
    if (!motor || !partida) return null
    return motor.resultado(totales, partida.config, { bandos: partida.bandos })
  }, [motor, partida, totales])

  /** Anota. Devuelve el mensaje de error del motor, o null si entró. */
  const anotar = useCallback(
    async (payload: unknown): Promise<string | null> => {
      if (!motor || !partida) return 'La partida todavía no cargó.'

      const ctx = { bandos: partida.bandos }
      const invalido = motor.validar(payload, partida.config, ctx)
      if (invalido) return invalido

      const asiento: Asiento = {
        id: crypto.randomUUID(),
        partidaId: partida.id,
        payload,
        deltas: motor.deltas(payload, partida.config, ctx),
        creadoEn: new Date().toISOString(),
        anuladoEn: null,
      }

      await guardarAsiento(asiento)
      await encolar({ id: crypto.randomUUID(), tipo: 'crear_asiento', partidaId: partida.id, asiento })
      setAsientos((previos) => ordenar([...previos, asiento]))
      void drenar()
      return null
    },
    [motor, partida],
  )

  /** Deshace el último asiento. Lo anula, no lo borra. */
  const deshacer = useCallback(async () => {
    if (!partida) return
    const ultimo = vivos(asientos).at(-1)
    if (!ultimo) return

    const anuladoEn = new Date().toISOString()
    const anulado = { ...ultimo, anuladoEn }

    await guardarAsiento(anulado)
    await encolar({
      id: crypto.randomUUID(),
      tipo: 'anular_asiento',
      partidaId: partida.id,
      asientoId: ultimo.id,
      anuladoEn,
    })
    setAsientos((previos) => previos.map((a) => (a.id === ultimo.id ? anulado : a)))
    void drenar()
  }, [asientos, partida])

  const cerrar = useCallback(
    async (ganadorBandoId: string | null) => {
      if (!partida) return
      const terminadaEn = new Date().toISOString()

      await encolar({
        id: crypto.randomUUID(),
        tipo: 'cerrar_partida',
        partidaId: partida.id,
        ganadorBandoId,
        terminadaEn,
      })
      const cerrada: Partida = { ...partida, estado: 'terminada', ganadorBandoId, terminadaEn }
      await guardarPartida(cerrada, asientos)
      setPartida(cerrada)
      void drenar()
    },
    [asientos, partida],
  )

  const reabrir = useCallback(async () => {
    if (!partida) return

    await encolar({ id: crypto.randomUUID(), tipo: 'reabrir_partida', partidaId: partida.id })
    const abierta: Partida = {
      ...partida,
      estado: 'en_curso',
      ganadorBandoId: null,
      terminadaEn: null,
    }
    await guardarPartida(abierta, asientos)
    setPartida(abierta)
    void drenar()
  }, [asientos, partida])

  // Anota el dueño del grupo. El vinculado ve la partida en su historial y nada
  // más: es lo que mantiene en pie el supuesto de un escritor por partida.
  const puedoAnotar = Boolean(partida && miGrupo && partida.grupoId === miGrupo)

  /**
   * El estado de la partida sigue al resultado del motor, en los dos sentidos.
   *
   * Cerrar era un botón y en la mesa nadie lo tocaba: se gana, se festeja y se
   * cierra la app, así que las partidas quedaban vivas para siempre y sin
   * ganador. Y como el cierre ahora es automático, deshacer tiene que poder
   * reabrir: si el asiento equivocado fue justo el que llevó a alguien al
   * objetivo, corregirlo devuelve la partida a en curso.
   *
   * Está escrito como una sincronización y no como dos acciones sueltas porque
   * así es idempotente: da igual cuántas veces corra, y repara sola una partida
   * vieja que quedó abierta.
   *
   * ⚠️ El empate exacto de Burako no cierra nada, y sale gratis: en ese caso el
   * motor devuelve `terminada: false` con `desempate`, y la partida sigue.
   */
  useEffect(() => {
    if (!partida || !resultado || !puedoAnotar) return
    if (sincronizandoEstado.current) return

    const deberiaCerrar = resultado.terminada && partida.estado === 'en_curso'
    const deberiaReabrir = !resultado.terminada && partida.estado === 'terminada'
    if (!deberiaCerrar && !deberiaReabrir) return

    sincronizandoEstado.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- es asíncrono: encola y guarda antes de tocar el estado
    const accion = deberiaCerrar ? cerrar(resultado.ganador ?? null) : reabrir()
    void accion.finally(() => {
      sincronizandoEstado.current = false
    })
  }, [partida, resultado, puedoAnotar, cerrar, reabrir])

  // Deshacer sigue disponible con la partida terminada: es la única forma de
  // corregir el asiento que la cerró.
  const puedeDeshacer = puedoAnotar && vivos(asientos).length > 0

  return {
    partida, asientos, totales, resultado, motor, cargando, error,
    anotar, deshacer, puedeDeshacer, puedoAnotar,
  }
}

/** Lo local manda sobre lo remoto: puede haber asientos que todavía no subieron. */
function fusionar(locales: Asiento[], remotos: Asiento[]): Asiento[] {
  const porId = new Map(remotos.map((a) => [a.id, a]))
  for (const local of locales) porId.set(local.id, local)
  return ordenar([...porId.values()])
}

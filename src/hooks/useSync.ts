'use client'

import { useEffect, useState } from 'react'
import { activarSincronizacion, estadoSync, suscribirSync, type EstadoSync } from '@/lib/local/sync'

/** Estado de la cola de salida, para el cartelito de "sin conexión". */
export function useSync(): EstadoSync {
  const [estado, setEstado] = useState<EstadoSync>(estadoSync)

  useEffect(() => {
    const desuscribir = suscribirSync(setEstado)
    const parar = activarSincronizacion()
    return () => {
      desuscribir()
      parar()
    }
  }, [])

  return estado
}

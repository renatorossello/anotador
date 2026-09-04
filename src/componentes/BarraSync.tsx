'use client'

import { useSync } from '@/hooks/useSync'

/**
 * Sólo aparece cuando hay algo que decir. Que la app funcione sin red es lo
 * normal, no una excepción digna de un cartel permanente.
 */
export function BarraSync() {
  const { sinRed, pendientes, error } = useSync()

  if (error) {
    return (
      <p className="bg-[color:var(--color-error)]/15 px-4 py-2 text-center text-sm text-[color:var(--color-error)]">
        {error}
      </p>
    )
  }

  if (sinRed) {
    return (
      <p className="bg-[color:var(--color-alerta)]/12 px-4 py-2 text-center text-sm text-[color:var(--color-alerta)]">
        Sin conexión. Se sigue anotando igual{pendientes > 0 ? ` (${pendientes} sin subir)` : ''}.
      </p>
    )
  }

  if (pendientes > 0) {
    return (
      <p className="px-4 py-2 text-center text-sm text-[color:var(--color-tiza-tenue)]">
        Subiendo {pendientes} {pendientes === 1 ? 'anotación' : 'anotaciones'}…
      </p>
    )
  }

  return null
}

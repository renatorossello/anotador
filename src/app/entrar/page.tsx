'use client'

import { useState } from 'react'
import { Marca } from '@/componentes/Marca'
import { traducirErrorAuth } from '@/lib/errores'
import { supabaseNavegador } from '@/lib/supabase/cliente'

/**
 * ⚠️ El `volver` se lee de `window.location` al enviar, y no con
 * `useSearchParams`.
 *
 * Ese hook obliga a envolver el formulario en un `<Suspense>` y saca a la página
 * del prerenderizado: el HTML llega sin el formulario y queda un pantallazo
 * vacío hasta que hidrata. Es la primera pantalla de la app, así que se nota. El
 * dato hace falta recién en el submit, cuando la página ya está viva.
 */
export default function Entrar() {
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)

    const volver = new URLSearchParams(window.location.search).get('volver') ?? '/'

    const supabase = supabaseNavegador()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?volver=${encodeURIComponent(volver)}`,
      },
    })

    setEnviando(false)
    if (error) setError(traducirErrorAuth(error.message))
    else setEnviado(true)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-5 py-10">
      <div className="flex flex-col items-center gap-3 text-[color:var(--color-bando-verde)]">
        <Marca className="h-7 w-auto" />
        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-tiza)]">Anotador</h1>
      </div>

      {enviado ? (
        <div className="tarjeta p-6 text-center">
          <p className="text-lg font-semibold">Te mandamos un link</p>
          <p className="mt-2 text-sm text-[color:var(--color-tiza-suave)]">
            Abrilo desde este mismo teléfono y quedás adentro.
          </p>
        </div>
      ) : (
        <form onSubmit={entrar} className="tarjeta flex flex-col gap-4 p-6">
          <label className="flex flex-col gap-2">
            <span className="text-sm text-[color:var(--color-tiza-suave)]">Tu email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-[10px] border border-white/15 bg-black/20 px-4 py-3 text-lg outline-none focus:border-[color:var(--color-bando-verde)]"
            />
          </label>

          {error && <p className="text-sm text-[color:var(--color-error)]">{error}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="boton-pano px-4 py-3 text-lg font-semibold disabled:opacity-50"
          >
            {enviando ? 'Enviando…' : 'Entrar'}
          </button>

          <p className="text-xs text-[color:var(--color-tiza-tenue)]">
            Sólo necesita cuenta quien anota. Los demás miran con el link de la sala.
          </p>
        </form>
      )}
    </main>
  )
}

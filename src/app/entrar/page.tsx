'use client'

import { useEffect, useState } from 'react'
import { LogoGoogle } from '@/componentes/BotonGoogle'
import { Marca } from '@/componentes/Marca'
import { traducirErrorAuth } from '@/lib/errores'
import { supabaseNavegador } from '@/lib/supabase/cliente'

/**
 * ⚠️ El `volver` se lee de `window.location` y no con `useSearchParams`.
 *
 * Ese hook obliga a envolver todo en un `<Suspense>` y saca a la página del
 * prerenderizado: el HTML llega vacío y queda un pantallazo hasta que hidrata.
 * Es la primera pantalla de la app, así que se nota. El dato hace falta recién
 * al apretar el botón, cuando la página ya está viva.
 */
function aDondeVolver() {
  const volver = new URLSearchParams(window.location.search).get('volver') ?? '/'
  return `${window.location.origin}/auth/callback?volver=${encodeURIComponent(volver)}`
}

export default function Entrar() {
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [yendoAGoogle, setYendoAGoogle] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // El callback rebota acá con el motivo cuando el acceso no se completa. Se lee
  // después de montar y no con `useSearchParams` para no perder el
  // prerenderizado, ni con un estado inicial perezoso porque el servidor no ve
  // la URL del navegador y el HTML quedaría distinto al hidratar.
  useEffect(() => {
    const motivo = new URLSearchParams(window.location.search).get('error')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- una sola vez al montar
    if (motivo) setError(traducirErrorAuth(motivo))
  }, [])

  async function entrarConGoogle() {
    setYendoAGoogle(true)
    setError(null)

    const supabase = supabaseNavegador()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: aDondeVolver() },
    })

    // Si sale bien, el navegador ya se fue a Google y esto no se ejecuta.
    if (error) {
      setError(traducirErrorAuth(error.message))
      setYendoAGoogle(false)
    }
  }

  async function entrarPorMail(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)

    const supabase = supabaseNavegador()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: aDondeVolver() },
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
        <div className="tarjeta flex flex-col gap-5 p-6">
          <button
            type="button"
            onClick={entrarConGoogle}
            disabled={yendoAGoogle}
            className="flex items-center justify-center gap-3 rounded-[14px] bg-white px-4 py-3.5 text-lg font-semibold text-[#1f1f1f] transition active:scale-[0.98] disabled:opacity-60"
          >
            <LogoGoogle />
            {yendoAGoogle ? 'Abriendo Google…' : 'Entrar con Google'}
          </button>

          {error && <p className="text-sm text-[color:var(--color-error)]">{error}</p>}

          <div className="flex items-center gap-3 text-xs text-[color:var(--color-tiza-tenue)]">
            <span className="h-px flex-1 bg-white/12" />
            o con un link por mail
            <span className="h-px flex-1 bg-white/12" />
          </div>

          <form onSubmit={entrarPorMail} className="flex flex-col gap-3">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-[10px] border border-white/15 bg-black/20 px-4 py-3 outline-none placeholder:text-white/25 focus:border-[color:var(--color-bando-verde)]"
            />
            <button
              type="submit"
              disabled={enviando}
              className="boton-pano px-4 py-3 font-semibold disabled:opacity-50"
            >
              {enviando ? 'Enviando…' : 'Mandame el link'}
            </button>
          </form>

          <p className="text-xs text-[color:var(--color-tiza-tenue)]">
            Sólo necesita cuenta quien anota. Los demás miran con el link de la sala.
          </p>
        </div>
      )}
    </main>
  )
}

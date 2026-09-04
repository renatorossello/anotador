import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function supabaseServidor() {
  const store = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (nuevas) => {
          try {
            nuevas.forEach(({ name, value, options }) => store.set(name, value, options))
          } catch {
            // Un Server Component no puede escribir cookies. El middleware ya
            // refrescó la sesión, así que acá no hay nada que hacer.
          }
        },
      },
    },
  )
}

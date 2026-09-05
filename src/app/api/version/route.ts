/**
 * Qué versión está publicada.
 *
 * Existe porque averiguarlo desde afuera es adivinar: hubo un rato largo
 * buscando marcas de texto en los bundles para saber si un deploy había salido,
 * con una conclusión equivocada en el medio. Railway expone el commit en el
 * entorno; esto sólo lo devuelve.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const sha = process.env.RAILWAY_GIT_COMMIT_SHA ?? null

  return Response.json(
    {
      commit: sha ? sha.slice(0, 7) : 'desconocido',
      rama: process.env.RAILWAY_GIT_BRANCH ?? null,
      arrancado: new Date().toISOString(),
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}

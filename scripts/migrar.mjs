/**
 * Aplica las migraciones pendientes contra la base de Supabase.
 *
 *   node scripts/migrar.mjs          aplica lo que falte
 *   node scripts/migrar.mjs --estado sólo dice qué hay aplicado y qué no
 *
 * Necesita DATABASE_URL en .env.local (que está gitignoreado: la contraseña de
 * la base no entra al repo). Sale del panel de Supabase, en
 * Project Settings → Database → Connection string → Session pooler.
 *
 * Cada archivo va en su propia transacción y queda anotado en `_migraciones`,
 * así correr el script dos veces no vuelve a aplicar nada.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const carpeta = join(raiz, 'supabase', 'migrations')
const soloEstado = process.argv.includes('--estado')

function cargarEnv() {
  try {
    const texto = readFileSync(join(raiz, '.env.local'), 'utf8')
    for (const linea of texto.split('\n')) {
      const limpia = linea.trim()
      if (!limpia || limpia.startsWith('#')) continue
      const corte = limpia.indexOf('=')
      if (corte === -1) continue
      const clave = limpia.slice(0, corte).trim()
      if (!process.env[clave]) process.env[clave] = limpia.slice(corte + 1).trim()
    }
  } catch {
    // Sin .env.local se usa lo que haya en el entorno.
  }
}

cargarEnv()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Falta DATABASE_URL en .env.local.')
  console.error('Supabase → Project Settings → Database → Connection string → Session pooler.')
  process.exit(1)
}

const cliente = new pg.Client({
  connectionString: url,
  // El pooler de Supabase corta TLS con su propio certificado.
  ssl: { rejectUnauthorized: false },
})

await cliente.connect()

await cliente.query(`
  create table if not exists public._migraciones (
    archivo     text primary key,
    aplicada_en timestamptz not null default now()
  )
`)

const { rows } = await cliente.query('select archivo from public._migraciones')
const aplicadas = new Set(rows.map((r) => r.archivo))
const archivos = readdirSync(carpeta).filter((n) => n.endsWith('.sql')).sort()

if (soloEstado) {
  for (const archivo of archivos) {
    console.log(`${aplicadas.has(archivo) ? '✓' : '·'} ${archivo}`)
  }
  await cliente.end()
  process.exit(0)
}

let aplicadasAhora = 0

for (const archivo of archivos) {
  if (aplicadas.has(archivo)) {
    console.log(`· ${archivo} (ya estaba)`)
    continue
  }

  const sql = readFileSync(join(carpeta, archivo), 'utf8')
  process.stdout.write(`→ ${archivo} … `)

  try {
    await cliente.query('begin')
    await cliente.query(sql)
    await cliente.query('insert into public._migraciones (archivo) values ($1)', [archivo])
    await cliente.query('commit')
    console.log('ok')
    aplicadasAhora++
  } catch (error) {
    await cliente.query('rollback')
    console.log('falló')
    console.error(`\n${error.message}\n`)
    if (error.position) {
      const hasta = sql.slice(0, Number(error.position))
      console.error(`Línea ${hasta.split('\n').length} de ${archivo}.`)
    }
    await cliente.end()
    process.exit(1)
  }
}

console.log(
  aplicadasAhora === 0
    ? 'No había nada pendiente.'
    : `Listo: ${aplicadasAhora} ${aplicadasAhora === 1 ? 'migración aplicada' : 'migraciones aplicadas'}.`,
)

await cliente.end()

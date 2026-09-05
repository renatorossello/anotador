# Anotador

Anotador de puntajes de juegos de mesa. Arranca con **Burako** y **Truco**, pero
está armado para N juegos: cada uno es un motor y sumar uno nuevo no toca la
base de datos.

Se publica en **anotador.rossello.com.ar** (Railway) contra **Supabase**.

```
pnpm dev       # http://localhost:3000
pnpm build     # incluye el chequeo de tipos
pnpm lint
```

## El modelo, en una pantalla

```
Grupo            el del anotador
  Jugadores      PERFILES, no cuentas
  Partida        juego + config + modalidad + estado
    Bando        1..N. En 1v1 son 2 de uno; en 1v1v1, 3 de uno; en 2v2, 2 de dos
      Miembros
    Asiento      un evento de puntaje: payload jsonb + deltas ya calculados
```

⚠️ **El bando es la abstracción central.** No se modela «jugador o equipo»: se
modela un bando con miembros. Individual y equipo comparten todo el código y el
1v1v1 sale gratis. Si aparece la tentación de un camino especial para el juego
individual, es señal de que algo se está modelando mal.

## Reglas que no se rompen

**Sólo el anotador tiene cuenta.** Los demás jugadores son perfiles del grupo,
sin login. `jugadores.claimed_by` es la puerta a que alguien reclame el suyo más
adelante; hoy no hay flujo para eso.

**El reglamento vive en el motor de TypeScript, nunca en SQL.** La base suma
puntos y no sabe qué es una canasta ni un envido. Si una regla estuviera en los
dos lados, tarde o temprano dirían cosas distintas.

**El id del asiento lo genera el cliente**, con `crypto.randomUUID()`. Es lo que
hace que subirlo sea idempotente: reintentar desde la cola offline no puede
duplicar nada.

⚠️ **Deshacer anula, no borra.** Un asiento deshecho lleva `anulado_en`. Si el
deshacer borrara la fila, la cola offline pasaría a tener que sincronizar
ausencias, que es un problema mucho más difícil que sincronizar presencias.

⚠️ **Un solo escritor por partida.** Es el supuesto que hace barato todo el
offline: como nadie más toca esas filas, no hay ediciones concurrentes que
reconciliar. Habilitar un segundo anotador rompe ese supuesto y obliga a
rediseñar la sincronización — no es «una policy más».

**Los totales se muestran calculados en el cliente** (`core/puntajes.ts`),
sumando los asientos vivos. El `totales` que guarda la base lo mantiene un
trigger y es para la sala y la lista de partidas: el anotador nunca espera al
servidor para ver lo que acaba de anotar.

## Agregar un juego

1. Un archivo en `src/core/motores/` que implemente `Motor`.
2. Registrarlo en `src/core/motores/index.ts`.
3. Su pantalla de anotación en `src/componentes/anotar/`.
4. Sumar la clave al `check` de `partidas.juego` en una migración nueva.

⚠️ **Truco y Burako comparten el modelo y no comparten una sola pantalla.**
Burako es un formulario al cerrar la ronda; Truco es el rayado, un toque por
punto. Forzarlas a una pantalla con variantes sería peor que tener las dos.

Si agregar un juego obliga a tocar algo fuera de su motor y de su pantalla, la
abstracción está mal puesta: conviene arreglarla ahí y no acumular excepciones.

## Reglas de cada juego

| | Truco | Burako |
| --- | --- | --- |
| Modalidades | 1v1, 2v2, 3v3 (siempre 2 bandos) | 1v1, 1v1v1, 2v2 |
| Objetivo | 30 o 15 | 2000 / 3000 / 5000 |
| Flor | no se juega | — |
| Asiento | un bando y 1, 2 o 3 puntos | el total de la ronda por bando |
| Fin | el primero que llega | al cerrar la ronda en que alguien llega |

**Burako, dos casos que ya están resueltos y conviene no «simplificar»**: si
varios pasan el objetivo en la misma ronda gana el de más puntos; si empatan
exacto arriba, la partida **no termina** y se juega otra ronda. En 1v1v1 termina
cuando el primero pasa, y 2.º y 3.º salen por puntaje.

⚠️ **Truco a 15: el corte de malas quedó asumido en 7** (la mitad, para abajo).
Es una convención de mesa, no una regla escrita. Está en `corteDeMalas()`.

## Supabase

Las migraciones están en `supabase/migrations/` y se aplican en orden desde el
SQL Editor del panel.

⚠️ **La sala va por una función `SECURITY DEFINER`, no por una policy para
`anon`.** Dejar entrar al espectador anónimo con una policy obligaría a abrir
las tablas, y desde ahí se puede enumerar todo el contenido. Lo único expuesto
es `public.sala(codigo)`.

⚠️ **El vivo de la sala va por Realtime Broadcast, no por Postgres Changes.**
Postgres Changes pasa por RLS: para que un anónimo escuche habría que abrir la
tabla, que es lo mismo que se evitó arriba.

⚠️ `asientos.creado_en` es **el reloj del dispositivo que anota** — offline no
hay otro. Sirve para ordenar el rayado; para auditar está `recibido_en`, que lo
pone el servidor.

## Estadísticas

El cálculo vive en `core/estadisticas.ts`, **puro**: sin Supabase ni React. Se
prueba con `pnpm test` (vitest) contra partidas armadas a mano — es código donde
un error no se ve mirando la pantalla, porque un promedio mal calculado parece
perfectamente normal.

⚠️ **La unidad es la PERSONA, no el perfil**: `claimed_by ?? jugador.id`. Cada
uno arma su grupo, así que hay perfiles de la misma persona en grupos distintos;
contándolos por separado, el historial queda partido y ningún número es cierto.
Como efecto lateral, para los perfiles vinculados fusionar deja de ser necesario.

Tres reglas que ya costaron pensarse y no conviene «simplificar»:

- **La diferencia se mide contra el mejor rival**, no contra la suma: en 1v1v1,
  restar los puntos de los dos rivales da un número sin sentido.
- **El porcentaje va siempre con las jugadas al lado**, y los rankings de parejas
  piden un mínimo. Un 100 % sobre dos partidas es ruido con forma de dato.
- **Truco y Burako nunca en la misma tabla**: 30 y 3000 no son comparables, ni
  entre juegos ni entre objetivos distintos del mismo juego.

⚠️ Todo esto depende de que las partidas se **cierren**, y por eso el cierre es
automático (ver `usePartida`): el estado sigue al resultado del motor en los dos
sentidos, así que deshacer reabre.

## Fotos de perfil

Bucket `avatares` **público**, con nombres de archivo aleatorios: privado
obligaría a URLs firmadas que vencen y rompen la caché en las listas, que es
donde estas imágenes se muestran de a muchas. Lo que protege la foto es que su
URL no se puede adivinar. Escribir está cerrado: la ruta es
`<jugador_id>/<aleatorio>.webp` y la policy comprueba que ese jugador sea de un
grupo del que sube.

⚠️ **La foto se achica en el cliente antes de subirla** (`lib/imagenes.ts`). No
es opcional: una foto de teléfono pesa 3-5 MB y el avatar se ve a 40 px. Sin eso,
subir tarda muchísimo con datos móviles y la imagen entera viaja en cada carga de
la lista.

Sin foto se muestran las iniciales sobre un color derivado del nombre, así la
lista se lee igual sin obligar a nadie a cargar nada.

## Pendientes

- La sala en vivo (`/sala/[code]`): el SQL ya está, falta la pantalla.
- PWA instalable.
- Un grupo compartido entre varias personas: hoy cada uno tiene el suyo y los
  perfiles de la misma gente se duplican. ⚠️ Habilitar dos anotadores rompe el
  supuesto de un escritor por partida.

## Publicación

Railway, conectado a este repo: cada push a `main` deploya solo.

**`/api/version` dice qué commit está corriendo.** Existe porque averiguarlo
desde afuera es adivinar — se perdió un buen rato buscando marcas de texto en
los bundles, con una conclusión equivocada en el medio. Ante cualquier duda de
"¿esto ya subió?", se consulta ahí y se termina la discusión.

⚠️ **Las variables `NEXT_PUBLIC_*` se incrustan durante el build.** Si el primer
deploy corre sin ellas, la app queda publicada sin saber a qué Supabase hablar y
el síntoma no es un error de configuración: simplemente no carga nada. No
alcanza con reiniciar, hay que volver a deployar.

⚠️ **`DATABASE_URL` no va en Railway.** Es la contraseña de la base y sólo la usa
`pnpm migrar` desde la máquina. La app en producción anda con la clave pública.

### Cuando los pushes no disparan deploy

Pasó, y costó varias vueltas. El síntoma es que GitHub tiene el commit, el sitio
responde, y `/api/version` devuelve uno viejo. En *Settings → Source* aparecía
**"GitHub Repo not found"**, con el repo igual conectado arriba.

Lo que **no** era, aunque lo parecía:

- Permisos del repo: la GitHub App tenía *All repositories* y el repo es público.
- El repo o la rama: existían y estaban bien.
- Caché o propagación: probado con query strings nuevos, el origin servía viejo.

Era la conexión entre la cuenta de Railway y la de GitHub. Se destraba
reconectando desde **Railway** (no desde GitHub) hasta que *Branch connected to
production* muestre `main` y **Auto deploys when pushed to GitHub** quede activo.
*Wait for CI* tiene que estar **apagado**: con él prendido y sin ningún check en
el repo, Railway espera para siempre un CI que nunca llega, y no marca error.

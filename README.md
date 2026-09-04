# Anotador

Anotador de puntajes de juegos de mesa: **Burako** y **Truco**, con historial por
jugador y partidas que se retoman otro día.

- Anota uno solo; los demás miran en vivo con un link, sin cuenta.
- Funciona **sin señal**: lo anotado se guarda en el dispositivo y sube cuando
  vuelve la red.
- Individual, en equipo o todos contra todos: 1v1, 2v2, 3v3 y 1v1v1.

Next.js · Supabase · Railway → **anotador.rossello.com.ar**

## Levantarlo

```bash
pnpm install
cp .env.example .env.local   # y completar con las claves del proyecto
pnpm dev
```

Las claves salen de Supabase → *Project Settings* → *API*: la URL del proyecto y
la clave pública (`anon`). La clave de servicio **no se usa** en ningún lado.

## La base

Las migraciones están en `supabase/migrations/` y se aplican **en orden** desde
el SQL Editor del panel de Supabase:

1. `0001_esquema.sql` — tablas, RLS, el trigger de totales y la función de sala.
2. `0002_crear_partida.sql` — alta de grupo y de partida.

Para que el login por email funcione hay que tener configurado el envío de mails
en Supabase → *Authentication*. El SMTP de prueba que viene por defecto tiene un
límite bajo de envíos por hora: para uso real conviene poner uno propio.

## Cómo está armado

Cada juego es un **motor** (`src/core/motores/`) que define sus modalidades, cómo
se calcula un puntaje y cuándo termina la partida. La base de datos no conoce
ninguna regla: guarda asientos de puntaje y los suma.

Las convenciones y las decisiones que no se deshacen están en
[AGENTS.md](AGENTS.md).

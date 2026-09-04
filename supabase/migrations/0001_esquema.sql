-- ===========================================================================
-- Anotador — esquema inicial
--
-- Dos criterios que explican casi todas las decisiones de acá abajo:
--
--  1. El id de un asiento lo genera el CLIENTE. Es lo que hace que subirlo sea
--     idempotente y que la cola offline pueda reintentar sin pensar.
--  2. El reglamento de cada juego vive en el motor de TypeScript, no acá. La
--     base suma puntos y no sabe qué es una canasta ni un envido: si la regla
--     estuviera en los dos lados, tarde o temprano dirían cosas distintas.
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Grupos y jugadores
-- ---------------------------------------------------------------------------

create table public.grupos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  creado_en   timestamptz not null default now()
);

-- Un jugador es un PERFIL del grupo, no una cuenta. Nadie se registra para que
-- lo anoten. claimed_by es la puerta a que alguien reclame el suyo.
create table public.jugadores (
  id          uuid primary key default gen_random_uuid(),
  grupo_id    uuid not null references public.grupos (id) on delete cascade,
  nombre      text not null,
  avatar_url  text,
  claimed_by  uuid references auth.users (id) on delete set null,
  archivado   boolean not null default false,
  creado_en   timestamptz not null default now()
);

create index jugadores_grupo_idx on public.jugadores (grupo_id) where not archivado;

-- ---------------------------------------------------------------------------
-- Partidas
-- ---------------------------------------------------------------------------

-- Código de sala: 6 caracteres, sin los que se confunden al dictarlos por
-- teléfono (0/O, 1/I/L).
create or replace function public.nuevo_codigo_sala()
returns text language sql volatile as $fn$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',
           floor(random() * 31 + 1)::int, 1), '')
  from generate_series(1, 6)
$fn$;

create table public.partidas (
  id              uuid primary key default gen_random_uuid(),
  grupo_id        uuid not null references public.grupos (id) on delete cascade,
  juego           text not null check (juego in ('burako', 'truco')),
  modalidad       text not null,
  config          jsonb not null default '{}'::jsonb,
  estado          text not null default 'en_curso'
                  check (estado in ('en_curso', 'terminada', 'abandonada')),
  -- Denormalizado a propósito: la sala se suscribe a una fila y la lista de
  -- partidas no tiene que sumar nada. Lo mantiene un trigger.
  totales         jsonb not null default '{}'::jsonb,
  codigo_sala     text not null unique default public.nuevo_codigo_sala(),
  ganador_bando   uuid,
  creada_por      uuid not null references auth.users (id),
  iniciada_en     timestamptz not null default now(),
  terminada_en    timestamptz
);

create index partidas_grupo_idx on public.partidas (grupo_id, estado, iniciada_en desc);

create table public.bandos (
  id          uuid primary key default gen_random_uuid(),
  partida_id  uuid not null references public.partidas (id) on delete cascade,
  posicion    int not null,
  etiqueta    text not null,
  color       text not null default 'pizarra',
  unique (partida_id, posicion)
);

create index bandos_partida_idx on public.bandos (partida_id);

create table public.bando_jugadores (
  bando_id    uuid not null references public.bandos (id) on delete cascade,
  jugador_id  uuid not null references public.jugadores (id) on delete restrict,
  primary key (bando_id, jugador_id)
);

alter table public.partidas
  add constraint partidas_ganador_fk
  foreign key (ganador_bando) references public.bandos (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Asientos de puntaje
-- ---------------------------------------------------------------------------

create table public.asientos (
  -- Sin default: el id VIENE del cliente. Ver el criterio 1 de arriba.
  id            uuid primary key,
  partida_id    uuid not null references public.partidas (id) on delete cascade,
  payload       jsonb not null,
  deltas        jsonb not null,
  -- Deshacer anula, no borra: sincronizar ausencias es mucho más difícil que
  -- sincronizar presencias.
  anulado_en    timestamptz,
  -- El reloj del dispositivo que anota. Offline no hay otro, y alcanza para
  -- ordenar el rayado...
  creado_en     timestamptz not null,
  -- ...pero no para auditar. Para eso está éste, que lo pone el servidor.
  recibido_en   timestamptz not null default now(),
  creado_por    uuid not null references auth.users (id)
);

create index asientos_partida_idx on public.asientos (partida_id, creado_en, id);

-- ---------------------------------------------------------------------------
-- Totales: los recalcula un trigger, sumando los asientos vivos
-- ---------------------------------------------------------------------------

create or replace function public.recalcular_totales(p_partida uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  base    jsonb;
  sumados jsonb;
begin
  -- Arranca en cero para todos los bandos, así un bando sin asientos aparece
  -- igual y la UI no tiene que inventar el 0.
  select coalesce(jsonb_object_agg(b.id::text, 0), '{}'::jsonb)
    into base
    from public.bandos b
   where b.partida_id = p_partida;

  select coalesce(jsonb_object_agg(t.bando, t.total), '{}'::jsonb)
    into sumados
    from (
      select d.key as bando, sum(d.value::numeric) as total
        from public.asientos a
        cross join lateral jsonb_each_text(a.deltas) as d(key, value)
       where a.partida_id = p_partida
         and a.anulado_en is null
       group by d.key
    ) t;

  update public.partidas
     set totales = base || sumados
   where id = p_partida;
end;
$fn$;

create or replace function public.trg_recalcular_totales()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  perform public.recalcular_totales(coalesce(new.partida_id, old.partida_id));
  return coalesce(new, old);
end;
$fn$;

create trigger asientos_totales
  after insert or update or delete on public.asientos
  for each row execute function public.trg_recalcular_totales();

-- Un bando nuevo entra en los totales en cero sin esperar al primer asiento.
create trigger bandos_totales
  after insert or delete on public.bandos
  for each row execute function public.trg_recalcular_totales();

-- ---------------------------------------------------------------------------
-- RLS: el anotador sólo ve y toca lo de su grupo
-- ---------------------------------------------------------------------------

create or replace function public.es_mi_grupo(g uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.grupos where id = g and owner_id = auth.uid())
$fn$;

create or replace function public.es_mi_partida(p uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.partidas pa
     where pa.id = p and public.es_mi_grupo(pa.grupo_id)
  )
$fn$;

alter table public.grupos           enable row level security;
alter table public.jugadores        enable row level security;
alter table public.partidas         enable row level security;
alter table public.bandos           enable row level security;
alter table public.bando_jugadores  enable row level security;
alter table public.asientos         enable row level security;

create policy grupos_propios on public.grupos
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy jugadores_propios on public.jugadores
  for all to authenticated
  using (public.es_mi_grupo(grupo_id)) with check (public.es_mi_grupo(grupo_id));

create policy partidas_propias on public.partidas
  for all to authenticated
  using (public.es_mi_grupo(grupo_id)) with check (public.es_mi_grupo(grupo_id));

create policy bandos_propios on public.bandos
  for all to authenticated
  using (public.es_mi_partida(partida_id)) with check (public.es_mi_partida(partida_id));

create policy bando_jugadores_propios on public.bando_jugadores
  for all to authenticated
  using (exists (
    select 1 from public.bandos b
     where b.id = bando_id and public.es_mi_partida(b.partida_id)
  ))
  with check (exists (
    select 1 from public.bandos b
     where b.id = bando_id and public.es_mi_partida(b.partida_id)
  ));

create policy asientos_propios on public.asientos
  for all to authenticated
  using (public.es_mi_partida(partida_id)) with check (public.es_mi_partida(partida_id));

-- ---------------------------------------------------------------------------
-- La sala: leer una partida con el código, sin cuenta
--
-- Va por una función SECURITY DEFINER y NO por una policy para anon: dejar
-- entrar al anónimo con una policy obligaría a abrir las tablas, y desde ahí
-- se puede enumerar todo. Así lo único que se expone es esta consulta.
-- ---------------------------------------------------------------------------

create or replace function public.sala(codigo text)
returns jsonb language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object(
    'id',          p.id,
    'juego',       p.juego,
    'modalidad',   p.modalidad,
    'config',      p.config,
    'estado',      p.estado,
    'totales',     p.totales,
    'codigoSala',  p.codigo_sala,
    'ganador',     p.ganador_bando,
    'iniciadaEn',  p.iniciada_en,
    'terminadaEn', p.terminada_en,
    'bandos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', b.id, 'posicion', b.posicion,
               'etiqueta', b.etiqueta, 'color', b.color,
               'jugadores', (
                 select coalesce(jsonb_agg(jsonb_build_object(
                          'id', j.id, 'nombre', j.nombre, 'avatarUrl', j.avatar_url)), '[]'::jsonb)
                   from public.bando_jugadores bj
                   join public.jugadores j on j.id = bj.jugador_id
                  where bj.bando_id = b.id
               )) order by b.posicion), '[]'::jsonb)
        from public.bandos b where b.partida_id = p.id
    ),
    'asientos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', a.id, 'payload', a.payload, 'deltas', a.deltas,
               'creadoEn', a.creado_en, 'anuladoEn', a.anulado_en)
             order by a.creado_en, a.id), '[]'::jsonb)
        from public.asientos a
       where a.partida_id = p.id and a.anulado_en is null
    )
  )
  from public.partidas p
  where upper(p.codigo_sala) = upper(codigo)
$fn$;

revoke all on function public.sala(text) from public;
grant execute on function public.sala(text) to anon, authenticated;

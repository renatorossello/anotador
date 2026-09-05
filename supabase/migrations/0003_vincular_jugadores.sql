-- ===========================================================================
-- Vincular jugadores con usuarios
--
-- Un jugador es un perfil del grupo de quien anota. Con esto, ese perfil puede
-- quedar asociado a una cuenta: el anotador le carga el mail y, cuando esa
-- persona entra, ve las partidas donde jugó aunque las haya anotado otro.
--
-- ⚠️ El vínculo da SOLO LECTURA, y eso es lo que lo hace barato: el supuesto de
-- "un escritor por partida" queda intacto, así que no hay nada que reconciliar
-- ni sincronización que rediseñar. Las policies de escritura no se tocan.
-- ===========================================================================

alter table public.jugadores add column email text;

create index jugadores_email_idx on public.jugadores (lower(email)) where email is not null;
create index jugadores_claimed_idx on public.jugadores (claimed_by) where claimed_by is not null;

-- ---------------------------------------------------------------------------
-- Vinculación automática por mail
--
-- Hacen falta los dos sentidos, porque el orden puede ser cualquiera: cargar el
-- mail de alguien que ya tiene cuenta, o que alguien se cree la cuenta después
-- de que su perfil ya existía. Con un solo trigger, la mitad de los casos queda
-- sin vincular y el síntoma es "no veo nada", que no dice nada.
-- ---------------------------------------------------------------------------

-- Al cargarle el mail a un jugador: si ya hay una cuenta con ese mail, se ata.
create or replace function public.trg_jugador_vincular()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.email is null then
    new.claimed_by := null;
    return new;
  end if;

  new.email := lower(trim(new.email));

  select u.id into new.claimed_by
    from auth.users u
   where lower(u.email) = new.email
   limit 1;

  return new;
end;
$fn$;

create trigger jugadores_vincular
  before insert or update of email on public.jugadores
  for each row execute function public.trg_jugador_vincular();

-- Al crearse (o confirmarse) una cuenta: se atan los perfiles que la esperaban.
create or replace function public.trg_usuario_vincular()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.email is not null then
    update public.jugadores
       set claimed_by = new.id
     where lower(email) = lower(new.email)
       and claimed_by is distinct from new.id;
  end if;
  return new;
end;
$fn$;

create trigger usuarios_vincular
  after insert or update of email on auth.users
  for each row execute function public.trg_usuario_vincular();

-- ---------------------------------------------------------------------------
-- ¿Jugué esta partida?
--
-- SECURITY DEFINER a propósito: la función consulta tablas que tienen RLS y que
-- a su vez van a usar esta función en sus policies. Sin esto, la evaluación se
-- muerde la cola.
-- ---------------------------------------------------------------------------

create or replace function public.jugue_en(p uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1
      from public.bandos b
      join public.bando_jugadores bj on bj.bando_id = b.id
      join public.jugadores j on j.id = bj.jugador_id
     where b.partida_id = p
       and j.claimed_by = auth.uid()
  )
$fn$;

-- ---------------------------------------------------------------------------
-- Policies de lectura
--
-- Se AGREGAN a las que ya están, no las reemplazan: PostgreSQL combina las
-- policies permisivas con OR. Como son `for select`, la escritura sigue
-- gobernada por las policies `for all` de la migración 0001 — o sea, sólo el
-- dueño del grupo escribe.
-- ---------------------------------------------------------------------------

create policy partidas_donde_jugue on public.partidas
  for select to authenticated
  using (public.jugue_en(id));

create policy bandos_donde_jugue on public.bandos
  for select to authenticated
  using (public.jugue_en(partida_id));

create policy asientos_donde_jugue on public.asientos
  for select to authenticated
  using (public.jugue_en(partida_id));

create policy bando_jugadores_donde_jugue on public.bando_jugadores
  for select to authenticated
  using (exists (
    select 1 from public.bandos b
     where b.id = bando_id and public.jugue_en(b.partida_id)
  ));

-- Los nombres de los rivales de esas partidas, y nada más del grupo ajeno: ni
-- los demás jugadores, ni las partidas donde no estuvo.
create policy jugadores_donde_jugue on public.jugadores
  for select to authenticated
  using (exists (
    select 1
      from public.bando_jugadores bj
      join public.bandos b on b.id = bj.bando_id
     where bj.jugador_id = jugadores.id
       and public.jugue_en(b.partida_id)
  ));

-- ---------------------------------------------------------------------------
-- El grupo propio, sin crearlo
--
-- `mi_grupo()` crea el grupo si no existe, así que no sirve para preguntar. La
-- pantalla principal necesita saber cuáles partidas puede anotar el que mira, y
-- preguntarlo no puede tener el efecto de crear nada.
-- ---------------------------------------------------------------------------

create or replace function public.mi_grupo_actual()
returns uuid language sql stable security invoker set search_path = public as $fn$
  select id from public.grupos where owner_id = auth.uid() order by creado_en limit 1
$fn$;

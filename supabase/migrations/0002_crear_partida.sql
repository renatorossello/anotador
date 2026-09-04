-- ===========================================================================
-- Alta de grupo y de partida
--
-- Crear una partida toca tres tablas (partida, bandos, miembros). Por PostgREST
-- serían tres llamadas sueltas, y si la segunda falla queda una partida sin
-- bandos: inanotable y sin forma obvia de arreglarla desde la UI. Va como una
-- función para que sea todo o nada.
--
-- Van con SECURITY INVOKER: las policies de RLS se aplican igual que si el
-- anotador hubiera escrito las filas a mano. Nada acá saltea permisos.
-- ===========================================================================

-- Devuelve el grupo del usuario, creándolo la primera vez.
create or replace function public.mi_grupo(p_nombre text default 'Mi grupo')
returns uuid language plpgsql security invoker set search_path = public as $fn$
declare
  g uuid;
begin
  select id into g from public.grupos where owner_id = auth.uid() order by creado_en limit 1;

  if g is null then
    insert into public.grupos (nombre, owner_id) values (p_nombre, auth.uid())
    returning id into g;
  end if;

  return g;
end;
$fn$;

/*
  p_bandos llega así, en orden de posición:

    [ { "etiqueta": "Nosotros", "color": "verde", "jugadores": ["uuid", ...] }, ... ]
*/
create or replace function public.crear_partida(
  p_juego     text,
  p_modalidad text,
  p_config    jsonb,
  p_bandos    jsonb
)
returns uuid language plpgsql security invoker set search_path = public as $fn$
declare
  g          uuid;
  partida    uuid;
  bando      jsonb;
  bando_id   uuid;
  jugador    jsonb;
  i          int := 0;
begin
  if jsonb_array_length(p_bandos) < 2 then
    raise exception 'Una partida necesita al menos dos bandos.';
  end if;

  g := public.mi_grupo();

  insert into public.partidas (grupo_id, juego, modalidad, config, creada_por)
  values (g, p_juego, p_modalidad, coalesce(p_config, '{}'::jsonb), auth.uid())
  returning id into partida;

  for bando in select * from jsonb_array_elements(p_bandos) loop
    insert into public.bandos (partida_id, posicion, etiqueta, color)
    values (partida, i, bando->>'etiqueta', coalesce(bando->>'color', 'pizarra'))
    returning id into bando_id;

    for jugador in select * from jsonb_array_elements(coalesce(bando->'jugadores', '[]'::jsonb)) loop
      insert into public.bando_jugadores (bando_id, jugador_id)
      values (bando_id, (jugador #>> '{}')::uuid);
    end loop;

    i := i + 1;
  end loop;

  return partida;
end;
$fn$;

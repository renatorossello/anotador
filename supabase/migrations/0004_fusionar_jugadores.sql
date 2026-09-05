-- ===========================================================================
-- Fusionar jugadores duplicados
--
-- Pasa fácil: alguien crea "Rena" sin mail, después crea "Renato" con mail en
-- vez de editar el primero, y quedan dos perfiles para la misma persona. Lo
-- grave no es el duplicado en la lista: es que las partidas viejas siguen
-- atadas al perfil sin vincular, así que ese historial no le aparece a nadie.
--
-- Archivar no alcanza. Hay que mover las participaciones al perfil que queda.
-- ===========================================================================

create or replace function public.fusionar_jugadores(p_origen uuid, p_destino uuid)
returns void language plpgsql security invoker set search_path = public as $fn$
declare
  grupo_origen  uuid;
  grupo_destino uuid;
begin
  if p_origen = p_destino then
    raise exception 'Son el mismo jugador.';
  end if;

  -- El security invoker hace que RLS ya tape los jugadores ajenos, pero un
  -- mensaje claro vale más que una fila que no aparece.
  select grupo_id into grupo_origen from public.jugadores where id = p_origen;
  select grupo_id into grupo_destino from public.jugadores where id = p_destino;

  if grupo_origen is null or grupo_destino is null then
    raise exception 'No encontramos alguno de los dos jugadores.';
  end if;
  if grupo_origen <> grupo_destino then
    raise exception 'Los dos jugadores tienen que ser del mismo grupo.';
  end if;

  -- ⚠️ ON CONFLICT porque los dos pueden estar en el mismo bando: si alguien
  -- armó una partida eligiendo los dos perfiles de la misma persona, mover a
  -- ciegas rompería la clave primaria de bando_jugadores.
  insert into public.bando_jugadores (bando_id, jugador_id)
  select bj.bando_id, p_destino
    from public.bando_jugadores bj
   where bj.jugador_id = p_origen
  on conflict do nothing;

  delete from public.bando_jugadores where jugador_id = p_origen;

  -- Se archiva en vez de borrar: el perfil viejo ya no estorba en las listas y
  -- la fusión queda deshecha reponiendo el archivado si hiciera falta.
  update public.jugadores set archivado = true where id = p_origen;
end;
$fn$;

revoke all on function public.fusionar_jugadores(uuid, uuid) from public;
grant execute on function public.fusionar_jugadores(uuid, uuid) to authenticated;

-- ===========================================================================
-- Fotos de perfil
--
-- El bucket es PÚBLICO, con nombres de archivo aleatorios. Privado obligaría a
-- pedir una URL firmada cada vez —que además vence— y eso rompe la caché del
-- navegador justo en las listas, que es donde estas imágenes se muestran de a
-- muchas. Lo que protege la foto es que su URL no se puede adivinar.
--
-- Escribir sí está cerrado: sólo el dueño del grupo del jugador.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatares', 'avatares', true,
  2 * 1024 * 1024,  -- 2 MB: el cliente sube webp de ~30 KB, esto es la red de seguridad
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- El path es "<jugador_id>/<aleatorio>.webp": la primera carpeta identifica al
-- jugador, y es lo que permite comprobar el permiso sin una tabla aparte.
create or replace function public.puedo_editar_jugador(ruta text)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1
      from public.jugadores j
      join public.grupos g on g.id = j.grupo_id
     where g.owner_id = auth.uid()
       and j.id::text = split_part(ruta, '/', 1)
  )
$fn$;

drop policy if exists "avatares visibles" on storage.objects;
create policy "avatares visibles" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatares');

drop policy if exists "avatares los sube el dueño del grupo" on storage.objects;
create policy "avatares los sube el dueño del grupo" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatares' and public.puedo_editar_jugador(name));

drop policy if exists "avatares los reemplaza el dueño del grupo" on storage.objects;
create policy "avatares los reemplaza el dueño del grupo" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatares' and public.puedo_editar_jugador(name))
  with check (bucket_id = 'avatares' and public.puedo_editar_jugador(name));

drop policy if exists "avatares los borra el dueño del grupo" on storage.objects;
create policy "avatares los borra el dueño del grupo" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatares' and public.puedo_editar_jugador(name));

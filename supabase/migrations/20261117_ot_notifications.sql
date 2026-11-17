-- Project cbguxckfkaxytgzxvpxe (Maestro / Logística) ONLY.
-- Additive migration: does not modify any OT, permission or business calculation.
begin;
create table if not exists public.gto_ot_lecturas (
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  leida_at timestamptz not null default now(),
  primary key (user_id, proyecto_id)
);
alter table public.gto_ot_lecturas enable row level security;
revoke all on public.gto_ot_lecturas from anon;
grant select, insert, update on public.gto_ot_lecturas to authenticated;
create policy gto_ot_lecturas_select on public.gto_ot_lecturas for select to authenticated using (user_id = auth.uid());
create policy gto_ot_lecturas_insert on public.gto_ot_lecturas for insert to authenticated with check (
  user_id = auth.uid() and public.acceso_maestro() in ('total','laboratorio')
  and exists (select 1 from public.proyectos_maestro p where p.id = proyecto_id and coalesce(p.clase,'SERVICIO') = 'SERVICIO')
);
create policy gto_ot_lecturas_update on public.gto_ot_lecturas for update to authenticated using (user_id = auth.uid()) with check (
  user_id = auth.uid() and public.acceso_maestro() in ('total','laboratorio')
  and exists (select 1 from public.proyectos_maestro p where p.id = proyecto_id and coalesce(p.clase,'SERVICIO') = 'SERVICIO')
);

create or replace function public.gto_ot_actividad()
returns table (id uuid, titulo text, created_at timestamptz, leida boolean)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Autenticación requerida' using errcode = '42501'; end if;
  if coalesce(public.acceso_maestro(),'ninguno') not in ('total','laboratorio') then return; end if;
  return query
    select p.id, ('Nueva OT: ' || coalesce(p.numero_orden_trabajo,'Sin número'))::text,
      p.created_at::timestamptz, (l.user_id is not null)
    from public.proyectos_maestro p
    left join public.gto_ot_lecturas l on l.proyecto_id = p.id and l.user_id = auth.uid()
    where coalesce(p.clase,'SERVICIO') = 'SERVICIO'
      and p.created_at >= now() - interval '30 days'
    order by p.created_at desc, p.id desc limit 50;
end;
$$;
create or replace function public.gto_ot_marcar_leida(p_ot uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(public.acceso_maestro(),'ninguno') not in ('total','laboratorio') then
    raise exception 'Acceso no autorizado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.proyectos_maestro p where p.id = p_ot and coalesce(p.clase,'SERVICIO') = 'SERVICIO') then
    raise exception 'OT no disponible' using errcode = '42501';
  end if;
  insert into public.gto_ot_lecturas(user_id, proyecto_id) values (auth.uid(), p_ot)
    on conflict (user_id, proyecto_id) do update set leida_at = now();
end;
$$;
revoke all on function public.gto_ot_actividad() from public, anon;
revoke all on function public.gto_ot_marcar_leida(uuid) from public, anon;
grant execute on function public.gto_ot_actividad() to authenticated;
grant execute on function public.gto_ot_marcar_leida(uuid) to authenticated;
commit;

-- Codes d'invitation : comparaison insensible à la casse
create or replace function public.join_debate_by_code(p_code text)
returns public.debate_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.debate_rooms;
  v_count int;
begin
  select * into v_room from public.debate_rooms
    where lower(trim(invite_code)) = lower(trim(p_code))
      and status in ('active', 'paused');

  if not found then
    raise exception 'Aucun live actif avec ce code.';
  end if;

  select count(*) into v_count from public.debate_participants
    where room_id = v_room.id and (left_at is null);

  if v_count >= coalesce(v_room.max_participants, 12) then
    raise exception 'Ce live est complet.';
  end if;

  insert into public.debate_participants (room_id, user_id, joined_at, left_at)
  values (v_room.id, auth.uid(), now(), null)
  on conflict (room_id, user_id) do update set left_at = null, joined_at = now();

  return v_room;
end;
$$;

grant execute on function public.join_debate_by_code(text) to authenticated, anon;

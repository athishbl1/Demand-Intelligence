with i as (select convert_from(decode($1, 'base64'), 'UTF8')::jsonb as j),
ins as (
  insert into public.team_07_strategy_feedback (set_id, strategy_idx, vote, tags, text, ignore)
  select (i.j->>'set_id')::bigint, nullif(x->>'strategy_idx', '')::int, nullif(x->>'vote', '')::smallint,
    coalesce(array(select jsonb_array_elements_text(coalesce(x->'tags', '[]'::jsonb))), '{}'),
    left(nullif(x->>'text', ''), 500), coalesce((x->>'ignore')::boolean, false)
  from i, jsonb_array_elements(coalesce(i.j->'feedback', '[]'::jsonb)) x
  where exists (select 1 from public.team_07_strategy_sets s where s.id = (i.j->>'set_id')::bigint)
  returning set_id
)
select jsonb_build_object('ok', (select count(*) from ins) > 0, 'saved', (select count(*) from ins),
  'set_id', (select (j->>'set_id')::bigint from i)) as result

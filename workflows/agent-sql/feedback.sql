with i as (select convert_from(decode($1, 'base64'), 'UTF8')::jsonb as j),
ins as (
  insert into public.team_07_feedback (explanation_id, reason_idx, vote, tags, text, ignore)
  select (i.j->>'explanation_id')::bigint, nullif(x->>'reason_idx', '')::int, nullif(x->>'vote', '')::smallint,
    coalesce(array(select jsonb_array_elements_text(coalesce(x->'tags', '[]'::jsonb))), '{}'),
    left(nullif(x->>'text', ''), 500), coalesce((x->>'ignore')::boolean, false)
  from i, jsonb_array_elements(coalesce(i.j->'feedback', '[]'::jsonb)) x
  where exists (select 1 from public.team_07_explanations e where e.id = (i.j->>'explanation_id')::bigint)
  returning explanation_id, vote, text
)
select jsonb_build_object('ok', (select count(*) from ins) > 0, 'saved', (select count(*) from ins),
  'explanation_id', (select (j->>'explanation_id')::bigint from i)) as result

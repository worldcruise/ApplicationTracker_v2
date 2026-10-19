begin;
-- Command checks remain mandatory; composite keys also protect future writers.
alter table public.cover_letter_versions add constraint letter_bid_candidate_consistency foreign key(organization_id,bid_id,candidate_id) references public.bids(organization_id,id,candidate_id);
alter table public.bid_document_links add constraint document_link_bid_candidate_consistency foreign key(organization_id,bid_id,candidate_id) references public.bids(organization_id,id,candidate_id);
create or replace function private.check_template_layout(v jsonb) returns void language plpgsql immutable set search_path='' as $$
declare r record;
begin
 if jsonb_typeof(v) is distinct from 'object' or (select count(*) from jsonb_object_keys(v))<>15 or not v ?& array['page','margin','fontSize','lineHeight','paragraphSpacing','sectionSpacing','bulletIndent','nameSize','headingSize','align','accent','showLinks','experienceOrder','sections','labels'] then raise exception 'INVALID_TEMPLATE' using errcode='22023'; end if;
 if exists(select 1 from jsonb_each(v) where value='null'::jsonb) then raise exception 'INVALID_TEMPLATE' using errcode='22023'; end if;
 if v->>'page' not in ('Letter','A4') or v->>'align' not in ('left','center') or v->>'experienceOrder' not in ('source','date_desc') or v->>'accent' !~ '^#[0-9a-fA-F]{6}$' or jsonb_typeof(v->'showLinks')<>'boolean' or jsonb_typeof(v->'sections')<>'array' or jsonb_typeof(v->'labels')<>'object' then raise exception 'INVALID_TEMPLATE' using errcode='22023'; end if;
 for r in select * from (values('margin',36,72),('fontSize',9,13),('lineHeight',12,22),('paragraphSpacing',3,16),('sectionSpacing',4,18),('bulletIndent',6,24),('nameSize',18,28),('headingSize',11,16)) a(key,min,max) loop
  if jsonb_typeof(v->r.key)<>'number' or (v->>r.key)::numeric not between r.min and r.max then raise exception 'INVALID_TEMPLATE' using errcode='22023'; end if;
 end loop;
 if (v->>'lineHeight')::numeric<(v->>'fontSize')::numeric+2 or jsonb_array_length(v->'sections')>4 or (select count(distinct value) from jsonb_array_elements_text(v->'sections'))<>jsonb_array_length(v->'sections') or exists(select 1 from jsonb_array_elements_text(v->'sections') x where x not in ('summary','skills','experience','education')) then raise exception 'INVALID_TEMPLATE' using errcode='22023'; end if;
 if not v->'labels' ?& array['summary','skills','experience','education'] or (select count(*) from jsonb_object_keys(v->'labels'))<>4 or exists(select 1 from jsonb_each(v->'labels') x where jsonb_typeof(x.value)<>'string' or length(btrim(x.value #>> '{}')) not between 1 and 60 or (x.value #>> '{}') ~ '[[:cntrl:]]') then raise exception 'INVALID_TEMPLATE' using errcode='22023'; end if;
end $$;
commit;

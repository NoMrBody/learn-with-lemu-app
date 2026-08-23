-- Split the merged 'solids' topic back into two: the box and the pyramid.
--
-- Each gets its own explainer and its own problem set. The puzzle stage is
-- shared — both topics carry a 'game' row so both rails show three nodes, but
-- the pyramid's node links to the box's game route and progress records
-- against the box. Nothing here expresses that: the delegation lives in
-- DELEGATED_STAGES in lib/stages.ts.
--
-- 02_topics_seed.sql already describes this end state, so on a fresh database
-- every statement below matches nothing. These bring the live database, which
-- stopped at 04 with one merged topic, in line.
--
-- ON A DATABASE THAT HAS NOT BEEN SPLIT YET, RUN THIS BEFORE RE-RUNNING 02.
-- The rename below is what carries existing progress onto the box. Let 02 run
-- first and it would insert a rival stereometry/box with a new uuid, this
-- rename would collide with it on unique (subject, slug), and the progress it
-- was meant to carry would be stranded on the old row.

-- Wrapped in a transaction: the rename in step 1 and the insert in step 2 have
-- to land together. Half-applied, the topic list would show a box with no
-- pyramid beside it, and re-running would be reasoning about a state that
-- never existed on purpose.
begin;

-- ------------------------------------------------------------
-- 1. solids -> box
-- ------------------------------------------------------------
-- A rename, not a delete and re-insert: user_progress keys on topic_id, so
-- every learner's explainer / problem / game progress on the merged topic
-- carries over to the box untouched. The shared puzzle means their game
-- progress is now what the pyramid reads too.
update public.topics
set slug  = 'box',
    title = 'The Box'
where subject = 'stereometry'
  and slug = 'solids';

-- 04 relabelled this 'The topic' while one explainer covered both solids.
-- The box has its own explainer again.
update public.topic_stages
set title = 'The box'
where stage_type = 'explainer'
  and topic_id in (
    select id from public.topics
    where subject = 'stereometry' and slug = 'box'
  );

-- ------------------------------------------------------------
-- 2. make room, then add the pyramid
-- ------------------------------------------------------------
-- Sphere first, so the pyramid is not briefly sharing an order_index with it.
-- There is no unique constraint on (subject, order_index), so this is only
-- about keeping the intermediate state readable.
update public.topics
set order_index = 3
where subject = 'stereometry'
  and slug = 'sphere';

-- 04 deleted the pyramid placeholder against the live database, so this is an
-- insert rather than a rename. It is a genuinely new row with a new uuid: no
-- progress can be carried into it, which is correct — its explainer and its
-- problems are both new content that nobody has seen.
insert into public.topics (subject, slug, title, order_index, status) values
  ('stereometry', 'pyramid', 'The Pyramid', 2, 'available')
on conflict (subject, slug) do update set
  title       = excluded.title,
  order_index = excluded.order_index,
  status      = excluded.status;

-- ------------------------------------------------------------
-- 3. the pyramid's stages
-- ------------------------------------------------------------
-- Three nodes, matching the box. 'The puzzle' is the box's puzzle; the row
-- exists so the rail can render and link to it.
insert into public.topic_stages (topic_id, stage_type, order_index, title)
select t.id, s.stage_type, s.order_index, s.title
from public.topics t
join (values
  ('explainer', 1, 'The pyramid'),
  ('problem',   2, 'The problem'),
  ('game',      3, 'The puzzle')
) as s(stage_type, order_index, title) on true
where t.subject = 'stereometry'
  and t.slug = 'pyramid'
on conflict (topic_id, stage_type) do update set
  order_index = excluded.order_index,
  title       = excluded.title;

commit;

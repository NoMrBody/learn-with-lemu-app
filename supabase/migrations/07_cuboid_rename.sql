-- Rename the box topic to 'The Cuboid'.
--
-- Display only. The slug stays 'box', so nothing this rename touches can move
-- a user_progress row: those key off topic_id, and the topic keeps its uuid.
--
-- The slug is deliberately NOT renamed alongside the title, for three reasons:
--   * the pyramid borrows this topic's game stage by slug — DELEGATED_STAGES
--     in lib/stages.ts maps 'stereometry/pyramid' -> { game: 'box' };
--   * TOPIC_SOLID in lib/explainer/beats.tsx keys the explainer's solid off
--     the slug, as does TOPIC_PROBLEMS in lib/problems/data.ts;
--   * /stereometry/box is a live URL.
-- All three would have to move together, and the reader gains nothing from it.
-- The internal Solid key ('box' | 'pyr') is a separate vocabulary again, and is
-- untouched here.
--
-- 02_topics_seed.sql already describes this end state, so on a fresh database
-- both statements below match nothing. These bring a live database in line.

begin;

update public.topics
   set title = 'The Cuboid'
 where subject = 'stereometry'
   and slug    = 'box';

-- The per-topic rail label, lowercase to match its siblings ('The pyramid',
-- 'The axioms').
update public.topic_stages
   set title = 'The cuboid'
 where stage_type = 'explainer'
   and topic_id in (
     select id from public.topics
      where subject = 'stereometry' and slug = 'box'
   );

commit;

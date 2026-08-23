-- The cuboid topic grew to cover the pyramid as well: roughly half its slides
-- let the learner toggle between the two solids on the same slide. That made
-- it one topic, so this renamed it rather than adding a second one.
--
-- SUPERSEDED BY 05_split_pyramid.sql, which splits the two apart again. This
-- file is kept because it has already run against the live database and the
-- rename it performs is what 05 picks up from. Two statements that are now
-- actively wrong have been neutralised below rather than deleted, so that the
-- history still reads.
--
-- The seed migration describes the end state, but it has run against the live
-- database, so these statements bring an existing database in line. On a fresh
-- database the seed produces the end state directly and every statement here
-- matches nothing — all of them are written to be no-ops in that case, so the
-- two paths converge.

-- ------------------------------------------------------------
-- 1. cuboid -> solids
-- ------------------------------------------------------------
-- Progress rows key on topic_id (a uuid), not the slug, so renaming keeps
-- every learner's existing progress attached to this topic. 05 renames this
-- again, solids -> box, carrying the same rows forward a second time.
update public.topics
set slug  = 'solids',
    title = 'Box & Pyramid'
where subject = 'stereometry'
  and slug = 'cuboid';

-- The rail labels the first stage per topic; 'The box' no longer described it
-- while the topic covered both solids. 05 sets it back to 'The box' once the
-- pyramid has an explainer of its own.
update public.topic_stages
set title = 'The topic'
where stage_type = 'explainer'
  and topic_id in (
    select id from public.topics
    where subject = 'stereometry' and slug = 'solids'
  );

-- ------------------------------------------------------------
-- 2. the pyramid placeholder  [NEUTRALISED]
-- ------------------------------------------------------------
-- This used to delete stereometry/pyramid, on the grounds that the pyramid was
-- no longer a topic of its own. It is one again as of 05, and 02 now seeds it
-- directly — so on a fresh database this delete would drop a topic that was
-- just created two migrations ago, and 05 would have to put it back with a
-- different uuid. Left here, commented, because it DID run against the live
-- database: that is why 05 has to re-insert the row rather than rename one.
--
-- delete from public.topics
-- where subject = 'stereometry'
--   and slug = 'pyramid';

-- ------------------------------------------------------------
-- 3. ordering  [NEUTRALISED]
-- ------------------------------------------------------------
-- This closed the gap left by the delete above, moving sphere to 2. With the
-- pyramid restored, sphere belongs at 3 — which is what 02 seeds and what 05
-- sets on the live database. Running it here would only be undone one file
-- later.
--
-- update public.topics
-- set order_index = 2
-- where subject = 'stereometry'
--   and slug = 'sphere';

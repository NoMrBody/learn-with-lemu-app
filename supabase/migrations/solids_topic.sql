-- The cuboid topic grew to cover the pyramid as well: roughly half its slides
-- now let the learner toggle between the two solids on the same slide. It
-- stays one topic, so this renames it rather than adding a second one.
--
-- The seed migration already describes the end state, but it has run against
-- the live database, so these statements bring an existing database in line.
-- On a fresh database the seed produces this directly and every statement here
-- matches nothing — all of them are written to be no-ops in that case, so the
-- two paths converge.

-- ------------------------------------------------------------
-- 1. cuboid -> solids
-- ------------------------------------------------------------
-- Progress rows key on topic_id (a uuid), not the slug, so renaming keeps
-- every learner's existing progress attached to this topic.
update public.topics
set slug  = 'solids',
    title = 'Box & Pyramid'
where subject = 'stereometry'
  and slug = 'cuboid';

-- The rail labels the first stage per topic; 'The box' no longer describes it.
update public.topic_stages
set title = 'The topic'
where stage_type = 'explainer'
  and topic_id in (
    select id from public.topics
    where subject = 'stereometry' and slug = 'solids'
  );

-- ------------------------------------------------------------
-- 2. drop the pyramid placeholder
-- ------------------------------------------------------------
-- The pyramid is no longer a topic of its own — it is half of 'solids'.
-- Deliberately destructive: user_progress cascades from topics, so any
-- progress recorded against this placeholder goes with it. It was seeded
-- 'in_development' and never playable, so there should be none.
-- stereometry/sphere is left alone, to keep something for the
-- "in development" UI to render against.
delete from public.topics
where subject = 'stereometry'
  and slug = 'pyramid';

-- Close the gap left in the ordering so sphere still sorts after solids.
update public.topics
set order_index = 2
where subject = 'stereometry'
  and slug = 'sphere';

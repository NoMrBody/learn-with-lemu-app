-- Seed content. Idempotent: re-running updates titles/order in place rather
-- than erroring or duplicating, so it is safe to replay against a live DB.
-- User progress is never touched here.
--
-- This file describes the END STATE. Where the live database was built up in
-- steps, the numbered fix-up migrations after it bring an existing database in
-- line; on a fresh database this produces the same thing directly and those
-- fix-ups match nothing.
--
-- ORDER MATTERS ON A DATABASE THAT PREDATES THE BOX/PYRAMID SPLIT.
-- Such a database still calls the topic 'solids'. Running this file against it
-- would insert a SECOND topic at stereometry/box with a fresh uuid — carrying
-- no progress — and 05 would then fail renaming solids -> box against the
-- unique (subject, slug). Apply 05_split_pyramid.sql FIRST on any database
-- that has not been split yet; after that this file is idempotent again and
-- updates the two topics in place.

-- Top-level areas first: a subject's parent must already exist.
insert into public.subjects (slug, title, blurb, order_index, status) values
  ('algebra', 'Algebra',
   'Letters standing in for numbers, and the rules for moving them around.',
   1, 'in_development'),
  ('geometry', 'Geometry',
   'Shape, size and position — on the flat page and in space.',
   2, 'available')
on conflict (slug) do update set
  title       = excluded.title,
  blurb       = excluded.blurb,
  order_index = excluded.order_index,
  status      = excluded.status;

-- Then the two subjects nested under Geometry.
insert into public.subjects (slug, title, blurb, order_index, status, parent_slug) values
  ('stereometry', 'Stereometry',
   'Solids in space — boxes, pyramids, and the right triangles hiding inside them.',
   1, 'available', 'geometry'),
  ('planimetry', 'Planimetry',
   'Everything that happens on a flat page.',
   2, 'in_development', 'geometry')
on conflict (slug) do update set
  title       = excluded.title,
  blurb       = excluded.blurb,
  order_index = excluded.order_index,
  status      = excluded.status,
  parent_slug = excluded.parent_slug;

insert into public.topics (subject, slug, title, order_index, status) values
  -- Axioms comes first: the box explainer already talks about planes and
  -- perpendicularity as settled, and this is where they get settled.
  ('stereometry', 'axioms',   'Axioms',      1, 'available'),
  -- The box and the pyramid are separate topics: each has its own explainer
  -- and its own problem set. They share the puzzle stage — see the note on
  -- topic_stages below.
  ('stereometry', 'box',      'The Box',     2, 'available'),
  ('stereometry', 'pyramid',  'The Pyramid', 3, 'available'),
  -- Placeholders so the "in development" state on the index has something
  -- to render against.
  ('stereometry', 'sphere',   'The Sphere',  4, 'in_development'),
  ('planimetry',  'triangle', 'The Triangle', 1, 'in_development'),
  -- Algebra has nothing built yet; these render as "Coming Soon".
  ('algebra', 'functions',             'Functions',             1, 'in_development'),
  ('algebra', 'linear-equations',      'Linear Equations',      2, 'in_development'),
  ('algebra', 'quadratic-expressions', 'Quadratic Expressions', 3, 'in_development')
on conflict (subject, slug) do update set
  title       = excluded.title,
  order_index = excluded.order_index,
  status      = excluded.status;

-- Stages exist only for topics that have content. An in_development topic is
-- not navigable, so it has no stages to navigate to.
--
-- The box and the pyramid carry all three stages, so both rails show three
-- nodes. The puzzle is shared: pyramid's game node links to the box's game
-- route and progress records against the box. That delegation lives in the
-- TypeScript (DELEGATED_STAGES in lib/stages.ts), not here — there is exactly
-- one of them, and a column would mean regenerating the generated DB types.
--
-- Axioms carries one stage. It is a guided walkthrough with no exercises and
-- no puzzle, and empty problem / game rows would put two dead nodes on its
-- rail promising content nobody has written.
insert into public.topic_stages (topic_id, stage_type, order_index, title)
select t.id, s.stage_type, s.order_index, s.title
from public.topics t
join (values
  ('axioms',  'explainer', 1, 'The axioms'),
  ('box',     'explainer', 1, 'The box'),
  ('box',     'problem',   2, 'The problem'),
  ('box',     'game',      3, 'The puzzle'),
  ('pyramid', 'explainer', 1, 'The pyramid'),
  ('pyramid', 'problem',   2, 'The problem'),
  ('pyramid', 'game',      3, 'The puzzle')
) as s(topic_slug, stage_type, order_index, title)
  on s.topic_slug = t.slug
where t.subject = 'stereometry'
on conflict (topic_id, stage_type) do update set
  order_index = excluded.order_index,
  title       = excluded.title;

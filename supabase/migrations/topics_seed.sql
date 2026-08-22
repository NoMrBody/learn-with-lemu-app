-- Seed content. Idempotent: re-running updates titles/order in place rather
-- than erroring or duplicating, so it is safe to replay against a live DB.
-- User progress is never touched here.

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
  -- The one topic with real content today. Covers the box and the pyramid
  -- together: half its slides let the learner switch between the two.
  ('stereometry', 'solids',   'Box & Pyramid', 1, 'available'),
  -- Placeholders so the "in development" state on the index has something
  -- to render against.
  ('stereometry', 'sphere',   'The Sphere',    2, 'in_development'),
  ('planimetry',  'triangle', 'The Triangle',  1, 'in_development'),
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
insert into public.topic_stages (topic_id, stage_type, order_index, title)
select t.id, s.stage_type, s.order_index, s.title
from public.topics t
cross join (values
  ('explainer', 1, 'The topic'),
  ('problem',   2, 'The problem'),
  ('game',      3, 'The puzzle')
) as s(stage_type, order_index, title)
where t.subject = 'stereometry' and t.slug = 'solids'
on conflict (topic_id, stage_type) do update set
  order_index = excluded.order_index,
  title       = excluded.title;

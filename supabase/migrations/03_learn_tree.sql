-- Geometry becomes a grouping over Stereometry and Planimetry, and Algebra
-- joins as a second top-level area with nothing built yet.
--
-- Subjects gain a self-referencing parent so /learn can show areas with their
-- sub-subjects underneath. Topics still hang off a leaf subject, so the
-- subject -> topic relationship that every existing page assumes is unchanged.

-- ------------------------------------------------------------
-- 1. the parent link
-- ------------------------------------------------------------
alter table public.subjects
  add column if not exists parent_slug text
    references public.subjects(slug) on delete cascade;

comment on column public.subjects.parent_slug is
  'Null for a top-level area. Set to nest this subject under another.';

-- /learn reads children by parent, in order.
create index if not exists subjects_parent_order_idx
  on public.subjects (parent_slug, order_index);

-- ------------------------------------------------------------
-- 2. Geometry, the group
-- ------------------------------------------------------------
-- Deliberately has no topics of its own: its content lives in its children.
insert into public.subjects (slug, title, blurb, order_index, status, parent_slug) values
  ('geometry', 'Geometry',
   'Shape, size and position — on the flat page and in space.',
   2, 'available', null)
on conflict (slug) do update set
  title       = excluded.title,
  blurb       = excluded.blurb,
  order_index = excluded.order_index,
  status      = excluded.status,
  parent_slug = excluded.parent_slug;

-- The two subjects that already exist become its children. order_index is now
-- read within a parent, so these renumber from 1.
update public.subjects set parent_slug = 'geometry', order_index = 1
where slug = 'stereometry';

update public.subjects set parent_slug = 'geometry', order_index = 2
where slug = 'planimetry';

-- ------------------------------------------------------------
-- 3. Algebra
-- ------------------------------------------------------------
insert into public.subjects (slug, title, blurb, order_index, status, parent_slug) values
  ('algebra', 'Algebra',
   'Letters standing in for numbers, and the rules for moving them around.',
   1, 'in_development', null)
on conflict (slug) do update set
  title       = excluded.title,
  blurb       = excluded.blurb,
  order_index = excluded.order_index,
  status      = excluded.status,
  parent_slug = excluded.parent_slug;

insert into public.topics (subject, slug, title, order_index, status) values
  ('algebra', 'functions',              'Functions',              1, 'in_development'),
  ('algebra', 'linear-equations',       'Linear Equations',       2, 'in_development'),
  ('algebra', 'quadratic-expressions',  'Quadratic Expressions',  3, 'in_development')
on conflict (subject, slug) do update set
  title       = excluded.title,
  order_index = excluded.order_index,
  status      = excluded.status;

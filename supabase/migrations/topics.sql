-- Topics system: subjects -> topics -> topic_stages, plus per-user progress.
--
-- Status/stage values are `text` + CHECK rather than Postgres enum types:
-- adding a value to a CHECK is a plain ALTER, whereas ALTER TYPE ... ADD VALUE
-- cannot run inside a transaction with other DDL, which makes migrations awkward.

-- ============================================================
-- subjects
-- ============================================================
create table public.subjects (
  slug        text primary key,
  title       text not null,
  blurb       text,
  order_index int  not null,
  status      text not null default 'in_development'
                check (status in ('available', 'in_development')),
  -- Null for a top-level area; set to nest this subject under another, so
  -- /learn can show e.g. Geometry with Stereometry and Planimetry beneath it.
  parent_slug text references public.subjects(slug) on delete cascade,
  created_at  timestamptz not null default now()
);

create index subjects_parent_order_idx on public.subjects (parent_slug, order_index);

comment on table public.subjects is
  'A branch of maths (stereometry, planimetry). Content lives in its topics.';

-- ============================================================
-- topics
-- ============================================================
create table public.topics (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null references public.subjects(slug) on delete cascade,
  slug        text not null,
  title       text not null,
  order_index int  not null,
  status      text not null default 'in_development'
                check (status in ('available', 'in_development')),
  created_at  timestamptz not null default now(),
  unique (subject, slug)
);

-- The topic index for a subject reads every row for that subject, in order.
create index topics_subject_order_idx on public.topics (subject, order_index);

comment on column public.topics.status is
  '''available'' = playable. ''in_development'' = listed on the index but not navigable.';

-- ============================================================
-- topic_stages
-- ============================================================
create table public.topic_stages (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references public.topics(id) on delete cascade,
  stage_type  text not null check (stage_type in ('explainer', 'problem', 'game')),
  order_index int  not null,
  -- Per-topic display name for the progress rail: 'The box', not 'Explainer'.
  title       text not null,
  unique (topic_id, stage_type),
  unique (topic_id, order_index)
);

-- ============================================================
-- user_progress
-- ============================================================
create table public.user_progress (
  user_id      uuid not null references auth.users(id) on delete cascade,
  topic_id     uuid not null references public.topics(id) on delete cascade,
  stage_type   text not null check (stage_type in ('explainer', 'problem', 'game')),
  status       text not null default 'not_started'
                 check (status in ('not_started', 'in_progress', 'completed')),
  -- Per-item state within a stage, shape depending on stage_type:
  --   explainer -> {"beat": 4}
  --   problem   -> {"solved": ["p1451", "p1457"]}
  --   game      -> {"unlocked": 3, "best": {"facediag": 1}}
  -- Validated in the TypeScript data layer, not here, so content can add
  -- fields without a migration.
  details      jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, topic_id, stage_type)
);

-- ============================================================
-- progress is monotonic
-- ============================================================
-- Every stage route upserts 'in_progress' on mount, including on a revisit
-- after finishing. Enforcing "never go backwards" here rather than in the
-- data layer keeps it correct when two tabs upsert at once, and lets
-- upsertProgress() stay a single statement.
create or replace function public.user_progress_touch()
returns trigger
language plpgsql
as $$
declare
  rank constant jsonb := '{"not_started": 0, "in_progress": 1, "completed": 2}'::jsonb;
begin
  new.updated_at := now();

  if tg_op = 'UPDATE' then
    -- Keep the furthest-along status of the two.
    if (rank ->> new.status)::int < (rank ->> old.status)::int then
      new.status := old.status;
    end if;
    -- First completion wins; re-completing does not move the timestamp.
    new.completed_at := coalesce(old.completed_at, new.completed_at);
  end if;

  if new.status = 'completed' and new.completed_at is null then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

create trigger user_progress_touch
  before insert or update on public.user_progress
  for each row execute function public.user_progress_touch();

-- ============================================================
-- row level security
-- ============================================================

-- Content tables: readable by anyone, writable by no one holding the anon or
-- authenticated key. RLS is enabled with only a SELECT policy, so INSERT /
-- UPDATE / DELETE are denied by default; seeding goes through service_role,
-- which bypasses RLS.
alter table public.subjects     enable row level security;
alter table public.topics       enable row level security;
alter table public.topic_stages enable row level security;

create policy "subjects are public read"
  on public.subjects for select to anon, authenticated using (true);

create policy "topics are public read"
  on public.topics for select to anon, authenticated using (true);

create policy "topic_stages are public read"
  on public.topic_stages for select to anon, authenticated using (true);

-- Progress: a user touches only their own rows. No DELETE policy — nothing in
-- the app deletes progress, and the auth.users cascade handles account removal.
alter table public.user_progress enable row level security;

create policy "read own progress"
  on public.user_progress for select to authenticated
  using (auth.uid() = user_id);

create policy "insert own progress"
  on public.user_progress for insert to authenticated
  with check (auth.uid() = user_id);

create policy "update own progress"
  on public.user_progress for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

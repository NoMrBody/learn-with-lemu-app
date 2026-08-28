-- Add the axioms topic, and put it first in stereometry.
--
-- Ported from legacy/axioms.html. It is the foundation the other topics
-- already assume: the box explainer opens by talking about planes and
-- perpendicularity as though those were settled, and this is where they get
-- settled. So it goes ahead of the box, not after it.
--
-- ONE STAGE, NOT THREE. The legacy page is a guided walkthrough with no
-- exercises and no puzzle, so the topic carries an 'explainer' row and
-- nothing else, and its rail shows a single node. Adding empty 'problem' and
-- 'game' rows would put two dead nodes on the rail and promise content that
-- was never written. When those are written, add the rows then.
--
-- 02_topics_seed.sql already describes this end state, so on a fresh database
-- every statement below matches an existing row and changes nothing. These
-- bring the live database, which stopped at 05 with box / pyramid / sphere at
-- 1 / 2 / 3, in line.

-- Wrapped in a transaction: the shuffle in step 1 and the insert in step 2
-- have to land together, or the topic list briefly shows two topics claiming
-- order_index 1 and re-running would be reasoning about a state that never
-- existed on purpose.
begin;

-- ------------------------------------------------------------
-- 1. make room at the front
-- ------------------------------------------------------------
-- Descending, so no two rows share an order_index part-way through. There is
-- no unique constraint on (subject, order_index) to violate — this is only
-- about keeping the intermediate state readable, the same reasoning as the
-- sphere shuffle in 05.
update public.topics set order_index = 4
where subject = 'stereometry' and slug = 'sphere';

update public.topics set order_index = 3
where subject = 'stereometry' and slug = 'pyramid';

update public.topics set order_index = 2
where subject = 'stereometry' and slug = 'box';

-- ------------------------------------------------------------
-- 2. the topic
-- ------------------------------------------------------------
-- A genuinely new row with a new uuid. No progress can be carried into it,
-- which is correct: nobody has seen this content before.
insert into public.topics (subject, slug, title, order_index, status) values
  ('stereometry', 'axioms', 'Axioms', 1, 'available')
on conflict (subject, slug) do update set
  title       = excluded.title,
  order_index = excluded.order_index,
  status      = excluded.status;

-- ------------------------------------------------------------
-- 3. its one stage
-- ------------------------------------------------------------
insert into public.topic_stages (topic_id, stage_type, order_index, title)
select t.id, 'explainer', 1, 'The axioms'
from public.topics t
where t.subject = 'stereometry'
  and t.slug = 'axioms'
on conflict (topic_id, stage_type) do update set
  order_index = excluded.order_index,
  title       = excluded.title;

commit;

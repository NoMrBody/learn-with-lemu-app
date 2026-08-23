import type { StageType } from "./topics";

/**
 * Stages one topic borrows from another.
 *
 * The pyramid's puzzle IS the box's puzzle — the same four levels, one
 * progress row. Both topics still carry a `game` row in topic_stages so both
 * rails show three nodes, but the pyramid's node links into the box's route
 * and progress records against the box's topic_id.
 *
 * Keyed `subject/topicSlug`. This lives in TypeScript rather than a
 * topic_stages column because there is exactly one entry: a column would mean
 * regenerating lib/supabase/types.ts in every environment to express it. If
 * these ever multiply, promote it.
 *
 * Deliberately free of imports beyond a type, so the pure helpers below can be
 * used from a client component without pulling the server-only Supabase client
 * in behind them.
 */
export const DELEGATED_STAGES: Readonly<
  Record<string, Readonly<Partial<Record<StageType, string>>>>
> = {
  "stereometry/pyramid": { game: "box" },
};

/** The topic slug that actually owns `stage` — the topic itself, unless delegated. */
export function stageOwner(
  subject: string,
  topicSlug: string,
  stage: StageType,
): string {
  return DELEGATED_STAGES[`${subject}/${topicSlug}`]?.[stage] ?? topicSlug;
}

/** True when this topic borrows `stage` from another one. */
export function isDelegated(
  subject: string,
  topicSlug: string,
  stage: StageType,
): boolean {
  return stageOwner(subject, topicSlug, stage) !== topicSlug;
}

/** Every stage this topic borrows, as [stage, ownerSlug] pairs. */
export function delegationsFor(
  subject: string,
  topicSlug: string,
): [StageType, string][] {
  const entry = DELEGATED_STAGES[`${subject}/${topicSlug}`];
  return entry ? (Object.entries(entry) as [StageType, string][]) : [];
}

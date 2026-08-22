import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

/* ============================================================
   domain vocabulary

   The DB stores these as text + CHECK, so every value crossing the
   boundary gets narrowed here. A row whose stage_type or status the
   app doesn't recognise is treated as missing rather than trusted.
   ============================================================ */

export const STAGE_TYPES = ["explainer", "problem", "game"] as const;
export type StageType = (typeof STAGE_TYPES)[number];

export const PROGRESS_STATUSES = ["not_started", "in_progress", "completed"] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

export const CONTENT_STATUSES = ["available", "in_development"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

const isStageType = (v: string): v is StageType =>
  (STAGE_TYPES as readonly string[]).includes(v);

const isProgressStatus = (v: string): v is ProgressStatus =>
  (PROGRESS_STATUSES as readonly string[]).includes(v);

// Anything the app doesn't recognise is treated as not-yet-built, which is
// the safe direction: it stays visible but unplayable.
const asContentStatus = (v: string): ContentStatus =>
  v === "available" ? "available" : "in_development";

/* ============================================================
   row shapes
   ============================================================ */

export type Subject = {
  slug: string;
  title: string;
  blurb: string | null;
  orderIndex: number;
  status: ContentStatus;
  /** Null for a top-level area; otherwise the area this sits under. */
  parentSlug: string | null;
};

export type Topic = {
  id: string;
  subject: string;
  slug: string;
  title: string;
  orderIndex: number;
  status: ContentStatus;
};

export type TopicStage = {
  id: string;
  topicId: string;
  stageType: StageType;
  orderIndex: number;
  /** Per-topic label for the rail: "The box", not "Explainer". */
  title: string;
};

/* ============================================================
   per-stage details

   user_progress.details is jsonb so content can grow without a
   migration; the shape contract lives here instead. Parsers are
   total — they coerce rather than throw, because a malformed blob
   must never take down a lesson page.
   ============================================================ */

export type ExplainerDetails = { beat: number };
export type ProblemDetails = { solved: string[] };
export type GameDetails = { unlocked: number; best: Record<string, number> };

export type StageDetails = {
  explainer: ExplainerDetails;
  problem: ProblemDetails;
  game: GameDetails;
};

const DEFAULT_DETAILS: { [S in StageType]: StageDetails[S] } = {
  explainer: { beat: 0 },
  problem: { solved: [] },
  game: { unlocked: 1, best: {} },
};

function asRecord(raw: Json | undefined): Record<string, Json | undefined> {
  return raw != null && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

const asInt = (v: Json | undefined, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : fallback;

function parseDetails<S extends StageType>(stage: S, raw: Json): StageDetails[S] {
  const o = asRecord(raw);

  switch (stage) {
    case "explainer":
      return { beat: Math.max(0, asInt(o.beat, 0)) } as StageDetails[S];

    case "problem": {
      const solved = Array.isArray(o.solved)
        ? o.solved.filter((x): x is string => typeof x === "string")
        : [];
      // De-duplicated: the client appends on each solve and two tabs can
      // both append the same id.
      return { solved: [...new Set(solved)] } as StageDetails[S];
    }

    case "game": {
      const best: Record<string, number> = {};
      for (const [k, v] of Object.entries(asRecord(o.best))) {
        if (typeof v === "number" && Number.isFinite(v)) best[k] = Math.trunc(v);
      }
      return { unlocked: Math.max(1, asInt(o.unlocked, 1)), best } as StageDetails[S];
    }

    default:
      return DEFAULT_DETAILS[stage];
  }
}

/* ============================================================
   progress
   ============================================================ */

export type StageProgress<S extends StageType = StageType> = {
  stageType: S;
  status: ProgressStatus;
  details: StageDetails[S];
  completedAt: string | null;
};

/** Every stage always has an entry; stages with no DB row read as not_started. */
export type ProgressByStage = { [S in StageType]: StageProgress<S> };

export type TopicProgress = {
  /** null when signed out — nothing is being recorded. */
  userId: string | null;
  byStage: ProgressByStage;
};

function emptyProgress(): ProgressByStage {
  return {
    explainer: {
      stageType: "explainer",
      status: "not_started",
      details: DEFAULT_DETAILS.explainer,
      completedAt: null,
    },
    problem: {
      stageType: "problem",
      status: "not_started",
      details: DEFAULT_DETAILS.problem,
      completedAt: null,
    },
    game: {
      stageType: "game",
      status: "not_started",
      details: DEFAULT_DETAILS.game,
      completedAt: null,
    },
  };
}

/**
 * Narrows the stage key to a type parameter so `details` is checked against
 * that one stage's shape. Assigning into the mapped type inline can't be
 * verified, because the key would still be the full union there.
 */
function writeStage<S extends StageType>(
  byStage: ProgressByStage,
  stage: S,
  status: ProgressStatus,
  details: Json,
  completedAt: string | null,
): void {
  const entry: StageProgress<S> = {
    stageType: stage,
    status,
    details: parseDetails(stage, details),
    completedAt,
  };
  // The entry above is fully checked against StageProgress<S>. Only the write
  // is cast: TypeScript resolves a generic-keyed write target to the
  // intersection of all three value types, which is never.
  (byStage as Record<StageType, StageProgress>)[stage] = entry;
}

/* ============================================================
   reads

   Wrapped in React's cache() so a layout and its page asking the
   same question during one render hit the network once.
   ============================================================ */

export const getSubject = cache(async (slug: string): Promise<Subject | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("slug, title, blurb, order_index, status, parent_slug")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`getSubject(${slug}): ${error.message}`);
  if (!data) return null;

  return {
    slug: data.slug,
    title: data.title,
    blurb: data.blurb,
    orderIndex: data.order_index,
    status: asContentStatus(data.status),
    parentSlug: data.parent_slug,
  };
});

export const listSubjects = cache(async (): Promise<Subject[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("slug, title, blurb, order_index, status, parent_slug")
    .order("order_index");

  if (error) throw new Error(`listSubjects: ${error.message}`);

  return (data ?? []).map((r) => ({
    slug: r.slug,
    title: r.title,
    blurb: r.blurb,
    orderIndex: r.order_index,
    status: asContentStatus(r.status),
    parentSlug: r.parent_slug,
  }));
});

/** Every topic in a subject, in_development ones included — the index greys those out. */
export const listTopics = cache(async (subject: string): Promise<Topic[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .select("id, subject, slug, title, order_index, status")
    .eq("subject", subject)
    .order("order_index");

  if (error) throw new Error(`listTopics(${subject}): ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id,
    subject: r.subject,
    slug: r.slug,
    title: r.title,
    orderIndex: r.order_index,
    status: asContentStatus(r.status),
  }));
});

/** Every topic across every subject — one query for the /learn tree. */
export const listAllTopics = cache(async (): Promise<Topic[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .select("id, subject, slug, title, order_index, status")
    .order("order_index");

  if (error) throw new Error(`listAllTopics: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id,
    subject: r.subject,
    slug: r.slug,
    title: r.title,
    orderIndex: r.order_index,
    status: asContentStatus(r.status),
  }));
});

export const getTopic = cache(
  async (subject: string, slug: string): Promise<Topic | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("topics")
      .select("id, subject, slug, title, order_index, status")
      .eq("subject", subject)
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new Error(`getTopic(${subject}/${slug}): ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      subject: data.subject,
      slug: data.slug,
      title: data.title,
      orderIndex: data.order_index,
      status: asContentStatus(data.status),
    };
  },
);

export const getTopicStages = cache(async (topicId: string): Promise<TopicStage[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topic_stages")
    .select("id, topic_id, stage_type, order_index, title")
    .eq("topic_id", topicId)
    .order("order_index");

  if (error) throw new Error(`getTopicStages(${topicId}): ${error.message}`);

  return (data ?? [])
    .filter((r) => isStageType(r.stage_type))
    .map((r) => ({
      id: r.id,
      topicId: r.topic_id,
      stageType: r.stage_type as StageType,
      orderIndex: r.order_index,
      title: r.title,
    }));
});

/**
 * Progress for one topic, keyed by stage. RLS already limits the rows to the
 * caller, so this never leaks another user's progress even if the filter were
 * dropped.
 */
export const getUserProgress = cache(async (topicId: string): Promise<TopicProgress> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const byStage = emptyProgress();
  if (!user) return { userId: null, byStage };

  const { data, error } = await supabase
    .from("user_progress")
    .select("stage_type, status, details, completed_at")
    .eq("topic_id", topicId);

  if (error) throw new Error(`getUserProgress(${topicId}): ${error.message}`);

  for (const row of data ?? []) {
    if (!isStageType(row.stage_type) || !isProgressStatus(row.status)) continue;
    writeStage(byStage, row.stage_type, row.status, row.details, row.completed_at);
  }

  return { userId: user.id, byStage };
});

/* ============================================================
   the /learn tree
   ============================================================ */

/** A subject that actually holds topics. */
export type SubjectWithTopics = Subject & { topics: Topic[] };

/**
 * A top-level area. Either it holds topics directly (Algebra) or it groups
 * other subjects that do (Geometry over Stereometry and Planimetry).
 */
export type LearnArea = Subject & {
  topics: Topic[];
  children: SubjectWithTopics[];
};

/**
 * Everything /learn needs, in three queries rather than one per subject.
 * Nesting is one level deep by design — a grandchild subject would render
 * nowhere, so the tree deliberately stops here.
 */
export const getLearnTree = cache(async (): Promise<LearnArea[]> => {
  const [subjects, topics] = await Promise.all([listSubjects(), listAllTopics()]);

  const topicsFor = (slug: string) =>
    topics.filter((t) => t.subject === slug).sort((a, b) => a.orderIndex - b.orderIndex);

  const byOrder = (a: Subject, b: Subject) => a.orderIndex - b.orderIndex;

  return subjects
    .filter((s) => s.parentSlug === null)
    .sort(byOrder)
    .map((area) => ({
      ...area,
      topics: topicsFor(area.slug),
      children: subjects
        .filter((s) => s.parentSlug === area.slug)
        .sort(byOrder)
        .map((child) => ({ ...child, topics: topicsFor(child.slug) })),
    }));
});

/** Subjects nested directly under `slug`. Empty for a leaf subject. */
export const listChildSubjects = cache(async (slug: string): Promise<Subject[]> => {
  const subjects = await listSubjects();
  return subjects
    .filter((s) => s.parentSlug === slug)
    .sort((a, b) => a.orderIndex - b.orderIndex);
});

/* ============================================================
   write
   ============================================================ */

export type UpsertProgressInput<S extends StageType = StageType> = {
  topicId: string;
  stageType: S;
  /**
   * 'not_started' is deliberately not writable — it is the absence of a row,
   * and the trigger would refuse the downgrade anyway.
   */
  status: Exclude<ProgressStatus, "not_started">;
  /**
   * Replaces the stored blob wholesale rather than merging, so pass the whole
   * object for the stage. Omit it entirely (don't pass `{}`) to leave the
   * stored details untouched — the column is then left out of the UPDATE.
   */
  details?: StageDetails[S];
};

export type UpsertProgressResult =
  | { ok: true; status: ProgressStatus; completedAt: string | null }
  | { ok: false; reason: "unauthenticated" | "error"; message: string };

/**
 * Records progress for one stage. Returns a result rather than throwing: this
 * runs from a mount effect on every stage route, and a hiccup writing progress
 * must not blank out a lesson the user is reading.
 *
 * Status never moves backwards and completed_at never shifts — both are
 * enforced by the user_progress_touch trigger, so a revisit can safely upsert
 * 'in_progress' over a finished stage, and two tabs racing is harmless.
 */
export async function upsertProgress<S extends StageType>(
  input: UpsertProgressInput<S>,
): Promise<UpsertProgressResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      reason: "unauthenticated",
      message: "Not signed in — progress is not recorded.",
    };
  }

  const { data, error } = await supabase
    .from("user_progress")
    .upsert(
      {
        user_id: user.id,
        topic_id: input.topicId,
        stage_type: input.stageType,
        status: input.status,
        // Spread so an absent `details` stays out of the payload, which keeps
        // it out of the generated ON CONFLICT DO UPDATE SET list.
        ...(input.details !== undefined ? { details: input.details as Json } : {}),
      },
      { onConflict: "user_id,topic_id,stage_type" },
    )
    .select("status, completed_at")
    .single();

  if (error) return { ok: false, reason: "error", message: error.message };

  return {
    ok: true,
    status: isProgressStatus(data.status) ? data.status : input.status,
    completedAt: data.completed_at,
  };
}

/**
 * The stage after `current` in this topic's running order, or null at the end
 * of the chain. Drives the "next section" hand-off once a stage is finished;
 * it reads the real stage order rather than assuming explainer → problem →
 * game, so reordering the rows reorders the flow.
 */
export function nextStageOf(
  stages: readonly TopicStage[],
  current: StageType,
): TopicStage | null {
  const ordered = [...stages].sort((a, b) => a.orderIndex - b.orderIndex);
  const i = ordered.findIndex((s) => s.stageType === current);
  return i >= 0 && i + 1 < ordered.length ? ordered[i + 1] : null;
}

/* ============================================================
   composed view for a stage route
   ============================================================ */

export type StageView = {
  subject: Subject;
  topic: Topic;
  stages: TopicStage[];
  stage: TopicStage;
  progress: TopicProgress;
};

/**
 * Everything the three stage routes need. Returns null when the subject,
 * topic, or stage doesn't exist, or when the topic isn't `available` yet —
 * callers turn that into notFound().
 */
export async function getStageView(
  subjectSlug: string,
  topicSlug: string,
  stageType: StageType,
): Promise<StageView | null> {
  const [subject, topic] = await Promise.all([
    getSubject(subjectSlug),
    getTopic(subjectSlug, topicSlug),
  ]);

  if (!subject || !topic || topic.status !== "available") return null;

  const [stages, progress] = await Promise.all([
    getTopicStages(topic.id),
    getUserProgress(topic.id),
  ]);

  const stage = stages.find((s) => s.stageType === stageType);
  if (!stage) return null;

  return { subject, topic, stages, stage, progress };
}

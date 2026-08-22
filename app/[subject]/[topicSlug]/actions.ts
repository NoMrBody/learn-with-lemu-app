"use server";

import {
  upsertProgress,
  type StageDetails,
  type StageType,
  type UpsertProgressResult,
} from "@/lib/topics";

/**
 * Records stage progress from a Client Component.
 *
 * Thin on purpose — the rules (never go backwards, completed_at set once)
 * live in the user_progress_touch trigger, and the signed-out case comes back
 * as a result rather than an exception so a mount-time call can't blank the
 * page a learner is reading.
 */
export async function markStageProgress(input: {
  topicId: string;
  stageType: StageType;
  status: "in_progress" | "completed";
  details?: StageDetails[StageType];
}): Promise<UpsertProgressResult> {
  return upsertProgress(input);
}

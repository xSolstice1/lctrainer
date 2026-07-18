import type { StudyPlan } from "@lctrainer/shared";
import { STORAGE_KEY_STUDY_PLANS } from "./constants.js";
import { fetchStudyPlanMetadata } from "../content/extractors/studyPlan.js";

export type StudyPlans = Record<string, StudyPlan>;

export async function getStudyPlans(): Promise<StudyPlans> {
  const stored = await chrome.storage.local.get(STORAGE_KEY_STUDY_PLANS);
  return stored[STORAGE_KEY_STUDY_PLANS] ?? {};
}

async function updatePlans(mutate: (plans: StudyPlans) => void): Promise<void> {
  const plans = await getStudyPlans();
  mutate(plans);
  await chrome.storage.local.set({ [STORAGE_KEY_STUDY_PLANS]: plans });
}

/** Fetches a plan by slug and adds it, preserving addedAtMs if it's already present. Returns null if the fetch failed (e.g. unknown slug). */
export async function addStudyPlan(planSlug: string): Promise<StudyPlan | null> {
  const fetched = await fetchStudyPlanMetadata(planSlug);
  if (!fetched) return null;

  const nowMs = Date.now();
  let saved: StudyPlan | null = null;
  await updatePlans((plans) => {
    const existing = plans[fetched.slug];
    saved = { ...fetched, addedAtMs: existing?.addedAtMs ?? nowMs, fetchedAtMs: nowMs };
    plans[fetched.slug] = saved;
  });
  return saved;
}

export async function saveCustomStudyPlan(plan: StudyPlan): Promise<void> {
  await updatePlans((plans) => {
    plans[plan.slug] = plan;
  });
}

export async function removeStudyPlan(slug: string): Promise<void> {
  await updatePlans((plans) => {
    delete plans[slug];
  });
}

/** Re-fetches an already-added plan's groups, keeping its original addedAtMs. Returns null (leaving the stored plan untouched) if the re-fetch fails. */
export async function refreshStudyPlan(slug: string): Promise<StudyPlan | null> {
  return addStudyPlan(slug);
}

export interface StudyPlanContext {
  plan: StudyPlan;
  index: number;
  total: number;
  prevSlug: string | null;
  nextSlug: string | null;
}

/** Locates the current problem within the most-recently-added plan that contains it, for prev/next navigation. */
export function findPlanContext(plans: StudyPlans, currentSlug: string | undefined): StudyPlanContext | null {
  if (!currentSlug) return null;

  const candidates = Object.values(plans)
    .filter((plan) => plan.groups.some((g) => g.questions.some((q) => q.slug === currentSlug)))
    .sort((a, b) => b.addedAtMs - a.addedAtMs);

  const plan = candidates[0];
  if (!plan) return null;

  const flatSlugs = plan.groups.flatMap((g) => g.questions.map((q) => q.slug));
  const index = flatSlugs.indexOf(currentSlug);

  return {
    plan,
    index,
    total: flatSlugs.length,
    prevSlug: index > 0 ? flatSlugs[index - 1] : null,
    nextSlug: index < flatSlugs.length - 1 ? flatSlugs[index + 1] : null,
  };
}

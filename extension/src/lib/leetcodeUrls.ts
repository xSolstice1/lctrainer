export function canonicalProblemUrl(slug: string): string {
  return `https://leetcode.com/problems/${slug}/`;
}

export function canonicalStudyPlanUrl(slug: string): string {
  return `https://leetcode.com/studyplan/${slug}/`;
}

/** Accepts a bare study-plan slug or any leetcode.com/studyplan/<slug>/... URL pasted by the user. */
export function parseStudyPlanSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/studyplan\/([^/?#]+)/);
  if (match) return match[1];
  if (/^[a-z0-9-]+$/i.test(trimmed)) return trimmed;
  return null;
}

import type { Difficulty, StudyPlanGroup } from "@lctrainer/shared";

interface RawQuestion {
  title: string;
  titleSlug: string;
  difficulty: string;
}

interface RawSubGroup {
  name: string;
  questions: RawQuestion[];
}

function normalizeDifficulty(raw: string): Difficulty {
  const capitalized = raw.charAt(0) + raw.slice(1).toLowerCase();
  return (capitalized === "Easy" || capitalized === "Medium" || capitalized === "Hard" ? capitalized : "Medium") as Difficulty;
}

function toGroups(subGroups: RawSubGroup[]): StudyPlanGroup[] {
  return subGroups.map((g) => ({
    name: g.name,
    questions: g.questions.map((q) => ({
      slug: q.titleSlug,
      title: q.title,
      difficulty: normalizeDifficulty(q.difficulty),
    })),
  }));
}

/** Fetches a study plan's name and question groups via LeetCode's own GraphQL API — same contract its studyplan pages use. Degrades gracefully to null rather than throwing. */
export async function fetchStudyPlanMetadata(
  planSlug: string
): Promise<{ slug: string; name: string; groups: StudyPlanGroup[] } | null> {
  const query = `
    query studyPlanV2Detail($planSlug: String!) {
      studyPlanV2Detail(planSlug: $planSlug) {
        slug
        name
        planSubGroups {
          name
          questions { title titleSlug difficulty }
        }
      }
    }
  `;

  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { planSlug } }),
    });
    if (!res.ok) return null;

    const json = await res.json();
    const plan = json?.data?.studyPlanV2Detail;
    if (!plan) return null;

    return {
      slug: plan.slug,
      name: plan.name,
      groups: toGroups(plan.planSubGroups ?? []),
    };
  } catch {
    return null;
  }
}

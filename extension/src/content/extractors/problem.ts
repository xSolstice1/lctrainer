import type { Difficulty, ProblemMetadata } from "@lctrainer/shared";
import { canonicalProblemUrl as canonicalUrl } from "../../lib/leetcodeUrls.js";

function getSlugFromPath(): string | null {
  const match = location.pathname.match(/\/problems\/([^/]+)/);
  return match?.[1] ?? null;
}

async function fetchViaGraphQL(slug: string): Promise<ProblemMetadata | null> {
  const query = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        title
        difficulty
        content
        topicTags { name }
      }
    }
  `;

  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ query, variables: { titleSlug: slug } }),
    });
    if (!res.ok) return null;

    const json = await res.json();
    const q = json?.data?.question;
    if (!q) return null;

    return {
      slug,
      title: q.title,
      difficulty: q.difficulty as Difficulty,
      tags: (q.topicTags ?? []).map((t: { name: string }) => t.name),
      statementHtml: q.content ?? "",
      url: canonicalUrl(slug),
    };
  } catch {
    return null;
  }
}

function fetchViaNextData(slug: string): ProblemMetadata | null {
  try {
    const scriptEl = document.getElementById("__NEXT_DATA__");
    if (!scriptEl?.textContent) return null;

    const data = JSON.parse(scriptEl.textContent);
    // Exact path is unverified — LeetCode's Next.js data shape can change.
    // This is a best-effort fallback; failures degrade gracefully.
    const question = data?.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data?.question;
    if (!question) return null;

    return {
      slug,
      title: question.title ?? slug,
      difficulty: (question.difficulty ?? "Medium") as Difficulty,
      tags: (question.topicTags ?? []).map((t: { name: string }) => t.name),
      statementHtml: question.content ?? "",
      url: canonicalUrl(slug),
    };
  } catch {
    return null;
  }
}

/** Extracts problem metadata, preferring LeetCode's own GraphQL API (same contract its own frontend uses) with a __NEXT_DATA__ fallback. Degrades gracefully to a minimal stub rather than throwing. */
export async function extractProblemMetadata(): Promise<ProblemMetadata | null> {
  const slug = getSlugFromPath();
  if (!slug) return null;

  const viaGraphQL = await fetchViaGraphQL(slug);
  if (viaGraphQL) return viaGraphQL;

  const viaNextData = fetchViaNextData(slug);
  if (viaNextData) return viaNextData;

  return {
    slug,
    title: slug,
    difficulty: "Medium",
    tags: [],
    statementHtml: "",
    url: canonicalUrl(slug),
  };
}

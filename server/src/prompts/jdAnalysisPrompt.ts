export function buildJDAnalysisPrompt(jdText: string): { system: string; user: string } {
  const system = `You are an expert technical recruiter and LeetCode coach.
Given a job description, you will:
1. Identify the company, role title, and seniority level.
2. Extract 3–6 key technical topics that interviews at this company/role commonly test.
3. Suggest 8–15 real LeetCode problems (by exact slug and title) that are highly relevant to this role.

You MUST respond with valid JSON only — no markdown fences, no explanation outside the JSON.

The JSON schema:
{
  "company": string,
  "role": string,
  "seniorityLevel": string,
  "topics": [
    { "name": string, "rationale": string, "importance": "high" | "medium" | "low" }
  ],
  "suggestedQuestions": [
    { "title": string, "slug": string, "difficulty": "Easy" | "Medium" | "Hard", "topic": string, "rationale": string }
  ]
}

Rules for slugs: use the exact LeetCode problem slug as it appears in the URL
(e.g. "two-sum", "lru-cache", "merge-k-sorted-lists"). Only suggest problems that
actually exist on LeetCode. Prefer well-known problems that are commonly asked at
the identified company.`;

  const user = `Job description:\n\n${jdText}`;

  return { system, user };
}

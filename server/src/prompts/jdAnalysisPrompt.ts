export function buildJDAnalysisPrompt(jdText: string, lcQuestionCount = 15, interviewQuestionCount = 12): { system: string; user: string } {
  const system = `You are an expert technical recruiter and LeetCode coach.
Given a job description, you will:
1. Identify the company, role title, and seniority level.
2. Extract 3–6 key technical topics that interviews at this company/role commonly test.
3. Suggest exactly ${lcQuestionCount} real LeetCode problems (by exact slug and title) that are highly relevant to this role.
4. Generate exactly ${interviewQuestionCount} interview questions the interviewer is likely to ask, covering all relevant categories.

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
  ],
  "interviewQuestions": [
    { "question": string, "category": "behavioral" | "system-design" | "technical" | "domain", "rationale": string, "sampleAnswer": string }
  ]
}

Rules for slugs: use the exact LeetCode problem slug as it appears in the URL
(e.g. "two-sum", "lru-cache", "merge-k-sorted-lists"). Only suggest problems that
actually exist on LeetCode. Prefer well-known problems that are commonly asked at
the identified company.

Rules for interviewQuestions:
- "behavioral": culture fit, past experience, conflict resolution (e.g. "Tell me about a time you...")
- "system-design": architecture, scalability, trade-offs relevant to the role
- "technical": language/framework/tool-specific depth questions from the JD
- "domain": industry/product knowledge specific to what the company does
- Weight categories by seniority — senior/staff roles get more system-design; junior roles get more technical/behavioral
- Each rationale explains why this question is likely given the specific JD
- sampleAnswer: a concise but complete model answer (3-6 sentences) tailored to this role and company. For behavioral questions use the STAR structure (Situation, Task, Action, Result). For technical/system-design, give a concrete correct answer with key points an interviewer would look for.`;

  const user = `Job description:\n\n${jdText}`;

  return { system, user };
}

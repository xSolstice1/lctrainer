export function buildJDAnalysisPrompt(jdText: string, lcQuestionCount = 15, interviewQuestionCount = 12): { system: string; user: string } {
  const system = `You are an expert technical recruiter and LeetCode coach.
Given a job description, you will:
1. Identify the company, role title, and seniority level.
2. Choose 3–5 broad topic group names for the LC problems (e.g. "Arrays & Hashing", "Trees & Graphs", "Dynamic Programming"). Every LC problem must belong to one of these groups.
3. Suggest exactly ${lcQuestionCount} real LeetCode problems spread across those groups.
4. Generate exactly ${interviewQuestionCount} interview questions the interviewer is likely to ask.

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

Rules for suggestedQuestions:
- "topic" MUST be one of the 3–5 broad group names you chose in step 2 — not a unique per-question label
- Use the exact LeetCode slug as it appears in the URL (e.g. "two-sum", "lru-cache")
- Only suggest problems that actually exist on LeetCode
- Prefer well-known problems commonly asked at the identified company

Rules for interviewQuestions:
- "behavioral": culture fit, past experience, conflict resolution (e.g. "Tell me about a time you...")
- "system-design": architecture, scalability, trade-offs relevant to the role
- "technical": language/framework/tool-specific depth questions from the JD
- "domain": industry/product knowledge specific to what the company does
- Weight categories by seniority — senior/staff get more system-design; junior get more technical/behavioral
- "rationale": 1 sentence explaining why this question is likely given the specific JD
- "sampleAnswer": 4–6 sentences. Behavioral → STAR format (Situation, Task, Action, Result). Technical/system-design → concrete correct answer covering key points an interviewer looks for. Must not be empty.`;

  const user = `Job description:\n\n${jdText}`;

  return { system, user };
}

import type { InterviewerProfile } from "@lctrainer/shared";

export function buildInterviewerParsePrompt(linkedInText: string): { system: string; user: string } {
  const system = `You are an expert at reading LinkedIn profiles and inferring how someone would conduct technical interviews.

Given raw LinkedIn profile text, extract structured information about the person and infer their likely interviewing style.

You MUST respond with valid JSON only — no markdown fences, no explanation outside the JSON.

The JSON schema:
{
  "name": string,
  "title": string,
  "company": string,
  "yearsOfExperience": number,
  "technicalAreas": string[],
  "inferredStyle": string
}

Rules:
- "name": their full name from the profile
- "title": their current or most recent job title
- "company": their current or most recent employer
- "yearsOfExperience": total years of relevant professional experience (integer)
- "technicalAreas": 3-5 specific technical domains they've worked in most (e.g. "distributed systems", "frontend performance", "ML pipelines", "security")
- "inferredStyle": 2-3 sentences describing how they likely interview based on their background. Consider: seniority level, types of companies (startup vs FAANG vs enterprise), technical breadth vs depth, any leadership roles. Be specific — reference their actual background.`;

  const user = `LinkedIn profile:\n\n${linkedInText}`;

  return { system, user };
}

export function parseInterviewerJson(raw: string, linkedInText: string): InterviewerProfile {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenceMatch ? fenceMatch[1] : raw;
  const sanitized = jsonText.trim().replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, " ");
  const parsed = JSON.parse(sanitized);
  return {
    name: parsed.name ?? "Unknown",
    title: parsed.title ?? "Engineer",
    company: parsed.company ?? "Unknown",
    yearsOfExperience: parsed.yearsOfExperience ?? 0,
    technicalAreas: Array.isArray(parsed.technicalAreas) ? parsed.technicalAreas : [],
    inferredStyle: parsed.inferredStyle ?? "",
    rawLinkedInText: linkedInText,
  };
}

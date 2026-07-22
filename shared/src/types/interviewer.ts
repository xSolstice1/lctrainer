export interface InterviewerProfile {
  name: string;
  title: string;
  company: string;
  yearsOfExperience: number;
  /** Key technical domains inferred from their background (e.g. "distributed systems", "ML infrastructure") */
  technicalAreas: string[];
  /** Inferred interviewing personality/style based on their career trajectory */
  inferredStyle: string;
  /** The raw LinkedIn text that was parsed — sent to the system prompt for full fidelity */
  rawLinkedInText: string;
}

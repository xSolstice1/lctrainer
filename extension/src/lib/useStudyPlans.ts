import { useEffect, useState } from "react";
import { getStudyPlans, type StudyPlans } from "./studyPlans.js";

export function useStudyPlans(refreshKey: number): StudyPlans {
  const [plans, setPlans] = useState<StudyPlans>({});

  useEffect(() => {
    getStudyPlans().then(setPlans);
  }, [refreshKey]);

  return plans;
}

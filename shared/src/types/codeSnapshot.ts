export interface CodeSnapshot {
  language: string;
  code: string;
  timestampMs: number;
  /** True when the extractor fell back to a lossy DOM reconstruction and may be missing off-screen lines. */
  possiblyIncomplete?: boolean;
}

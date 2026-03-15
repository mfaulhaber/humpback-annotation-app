export const LABEL_CATEGORIES = [
  "whup",
  "grunt",
  "ascending moan",
  "descending moan",
  "moan",
  "upsweep",
  "trumpet",
  "growl",
  "creak",
  "buzz",
  "shriek",
  "chirp",
] as const;

export type LabelCategory = (typeof LABEL_CATEGORIES)[number];

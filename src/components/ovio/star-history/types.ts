export type StarHistoryPoint = {
  /** ISO 8601 date, "2025-07-14". */
  date: string;
  stars: number;
};

/** A callout pinned to the curve at a date, like "hit the HN front page!". */
export type StarHistoryAnnotation = {
  date: string;
  label: string;
};

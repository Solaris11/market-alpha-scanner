export type ConvictionTimelineGroup = {
  dateLabel: string;
  decision: string;
  detailLabel: string;
  entryStatusLabel: string;
  key: string;
  repeatLabel: string | null;
  scoreArrow: string;
  scoreLabel: string;
  scoreTone: "up" | "down" | "flat";
};

export type ConvictionTimelineModel = {
  dominantDecisionLabel: string;
  dominantEntryLabel: string;
  groups: ConvictionTimelineGroup[];
  observationCount: number;
  sparklinePath: string | null;
  trendLabel: string;
};

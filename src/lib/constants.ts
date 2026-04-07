export const TERMINATION_TYPES = ["Voluntary", "Involuntary", "Unknown"] as const;

export type TerminationType = (typeof TERMINATION_TYPES)[number];

export const TERMINATION_TYPE_COLORS: Record<TerminationType, string> = {
  Voluntary: "#11967f",
  Involuntary: "#db5c3f",
  Unknown: "#6f8098",
};

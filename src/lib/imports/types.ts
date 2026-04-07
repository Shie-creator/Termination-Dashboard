export const offboardingCanonicalFields = [
  "employee_name",
  "employee_external_id",
  "manager_name",
  "termination_type",
  "termination_date",
  "termination_reason",
] as const;

export type OffboardingCanonicalField = (typeof offboardingCanonicalFields)[number];
export type ImportKind = "offboarding" | "turnover_report";
export type FieldMapping<T extends string> = Partial<Record<T, string>>;

export type ParsedFlatFile = {
  headers: string[];
  rows: Record<string, string>[];
  issues: string[];
};

export type NormalizedOffboardingRow = {
  employeeName: string;
  employeeExternalId: string | null;
  managerName: string;
  terminationType: "Voluntary" | "Involuntary" | "Unknown";
  terminationDate: string | null;
  terminationReason: string | null;
  sourceRow: Record<string, string>;
};

export type TurnoverEmployeeRow = {
  employeeExternalId: string | null;
  username: string | null;
  firstName: string;
  lastName: string;
  terminationDate: string | null;
  terminationReason: string | null;
  serviceLengthYears: number | null;
};

export type TurnoverSummaryRow = {
  reportYear: number;
  periodStart: string;
  periodEnd: string;
  terminatedCount: number;
  averageActiveHeadcount: number;
  turnoverRate: number;
  generatedAt: string | null;
  detailRows: TurnoverEmployeeRow[];
};

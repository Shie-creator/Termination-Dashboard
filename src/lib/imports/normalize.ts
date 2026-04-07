import type {
  FieldMapping,
  NormalizedOffboardingRow,
  OffboardingCanonicalField,
} from "@/lib/imports/types";
import { normalizeWhitespace, parseDateToIso } from "@/lib/utils";

function getValue<T extends string>(
  row: Record<string, string>,
  mapping: FieldMapping<T>,
  field: T,
) {
  const source = mapping[field];
  return source ? row[source]?.trim() ?? "" : "";
}

function normalizeTerminationType(value: string): "Voluntary" | "Involuntary" | "Unknown" {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (normalized.includes("involuntary")) {
    return "Involuntary";
  }
  if (normalized.includes("voluntary")) {
    return "Voluntary";
  }
  return "Unknown";
}

export function normalizeOffboardingRows(
  rows: Record<string, string>[],
  mapping: FieldMapping<OffboardingCanonicalField>,
) {
  return rows
    .map<NormalizedOffboardingRow | null>((row) => {
      const employeeName = getValue(row, mapping, "employee_name");
      const managerName = getValue(row, mapping, "manager_name");

      if (!employeeName || !managerName) {
        return null;
      }

      return {
        employeeName,
        employeeExternalId: getValue(row, mapping, "employee_external_id") || null,
        managerName,
        terminationType: normalizeTerminationType(getValue(row, mapping, "termination_type")),
        terminationDate: parseDateToIso(getValue(row, mapping, "termination_date")),
        terminationReason: getValue(row, mapping, "termination_reason") || null,
        sourceRow: row,
      };
    })
    .filter((row): row is NormalizedOffboardingRow => Boolean(row));
}

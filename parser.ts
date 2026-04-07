import Papa from "papaparse";
import * as XLSX from "xlsx";

import {
  offboardingCanonicalFields,
  type FieldMapping,
  type OffboardingCanonicalField,
  type ParsedFlatFile,
  type TurnoverEmployeeRow,
  type TurnoverSummaryRow,
} from "@/lib/imports/types";
import { parseDateToIso, parseNumeric } from "@/lib/utils";

function cleanHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function rowsToObjects(rawRows: unknown[][]): ParsedFlatFile {
  const [headerRow = [], ...valueRows] = rawRows;
  const headers = headerRow.map((value) => String(value ?? "").trim());
  const rows = valueRows
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? "").trim()])),
    )
    .filter((row) => Object.values(row).some(Boolean));

  return {
    headers,
    rows,
    issues: headers.length ? [] : ["The uploaded file is missing a header row."],
  };
}

export function parseTabularFile(buffer: ArrayBuffer, fileName: string): ParsedFlatFile {
  if (fileName.toLowerCase().endsWith(".csv")) {
    const text = new TextDecoder().decode(buffer);
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
    });

    return {
      headers: parsed.meta.fields ?? [],
      rows: ((parsed.data ?? []) as Record<string, unknown>[]).map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, String(value ?? "").trim()]),
        ),
      ),
      issues: [],
    };
  }

  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  return rowsToObjects(rows);
}

const offboardingSynonyms: Record<OffboardingCanonicalField, string[]> = {
  employee_name: ["name of employee", "employee name", "name"],
  employee_external_id: ["co code", "employee id", "employee code"],
  manager_name: ["name of manager", "manager", "reports to"],
  termination_type: [
    "is the employment termination voluntary or involuntary",
    "termination type",
    "voluntary or involuntary",
  ],
  termination_date: [
    "when is the last date of employment work",
    "termination date",
    "last date of employment",
    "last day of work",
  ],
  termination_reason: ["reason of termination", "termination reason", "reason"],
};

export function suggestMapping<T extends string>(
  headers: string[],
  synonyms: Record<T, string[]>,
): Record<string, string> {
  const normalizedHeaders = new Map(headers.map((header) => [cleanHeader(header), header]));
  const mapping: Record<string, string> = {};

  (Object.entries(synonyms) as Array<[T, string[]]>).forEach(([field, values]) => {
    const matched = values.find((value) => normalizedHeaders.has(cleanHeader(value)));
    if (matched) {
      mapping[field] = normalizedHeaders.get(cleanHeader(matched))!;
    }
  });

  return mapping;
}

export function getDefaultOffboardingMapping(headers: string[]) {
  return suggestMapping(headers, offboardingSynonyms);
}

export function validateOffboardingMapping(mapping: FieldMapping<OffboardingCanonicalField>) {
  const issues: string[] = [];
  const requiredFields: OffboardingCanonicalField[] = [
    "employee_name",
    "manager_name",
    "termination_type",
    "termination_date",
    "termination_reason",
  ];

  requiredFields.forEach((field) => {
    if (!mapping[field]) {
      issues.push(`Map a column for ${field.replaceAll("_", " ")}.`);
    }
  });

  return issues;
}

export function listCanonicalLabels() {
  return offboardingCanonicalFields.map((field) => ({
    value: field,
    label: field.replaceAll("_", " "),
  }));
}

function parseDateRange(value: string) {
  const match = value.match(/Date Range:\s*(\d{2}\/\d{2}\/\d{4})-(\d{2}\/\d{2}\/\d{4})/i);
  if (!match) {
    throw new Error("Unable to find the turnover report date range.");
  }

  const [, start, end] = match;
  const startIso = parseDateToIso(start);
  const endIso = parseDateToIso(end);

  if (!startIso || !endIso) {
    throw new Error("Unable to parse the turnover report date range.");
  }

  return { startIso, endIso };
}

function parseReportYear(value: string) {
  const match = value.match(/(\d{4})/);
  if (!match) {
    throw new Error("Unable to determine the turnover report year.");
  }

  return Number(match[1]);
}

export function parseTurnoverReport(buffer: ArrayBuffer): TurnoverSummaryRow {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  const stringRows = rows.map((row) => row.map((value) => String(value ?? "").trim()));
  const filteredByRow = stringRows.find((row) => row.some((value) => value.includes("Date Range:")));
  const generatedRow = stringRows.find((row) => row[0]?.startsWith("Date & Time:"));
  const headerIndex = stringRows.findIndex((row) => row[0] === "Employee Id");
  const totalIndex = stringRows.findIndex((row) => row[0] === "Total");

  if (!filteredByRow || headerIndex === -1 || totalIndex === -1) {
    throw new Error("This turnover report does not match the expected structure.");
  }

  const rangeCell = filteredByRow.find((value) => value.includes("Date Range:")) ?? "";
  const { startIso, endIso } = parseDateRange(rangeCell);
  const reportYear = parseReportYear(rangeCell);

  const detailRows: TurnoverEmployeeRow[] = stringRows
    .slice(headerIndex + 1, totalIndex)
    .filter((row) => row.some(Boolean))
    .map((row) => ({
      employeeExternalId: row[0] || null,
      username: row[2] || null,
      firstName: row[3] || "",
      lastName: row[4] || "",
      terminationDate: parseDateToIso(row[5]),
      terminationReason: row[7] || null,
      serviceLengthYears: parseNumeric(row[8]),
    }));

  const terminatedRow = stringRows.find((row) => row[1] === "Terminated");
  const headcountRow = stringRows.find((row) => row[1] === "Average Active Headcount Per Day");
  const rateRow = stringRows.find((row) => row[1]?.startsWith("Turnover Rate"));

  const terminatedCount = parseNumeric(terminatedRow?.[2]);
  const averageActiveHeadcount = parseNumeric(headcountRow?.[2]);
  const turnoverRate = parseNumeric(rateRow?.[3]);

  if (terminatedCount === null || averageActiveHeadcount === null || turnoverRate === null) {
    throw new Error("Unable to read the turnover report summary metrics.");
  }

  return {
    reportYear,
    periodStart: startIso,
    periodEnd: endIso,
    terminatedCount,
    averageActiveHeadcount,
    turnoverRate,
    generatedAt: generatedRow?.[3] ?? null,
    detailRows,
  };
}

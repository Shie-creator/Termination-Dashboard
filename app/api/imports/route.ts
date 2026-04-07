import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getImportUploadPassword } from "@/lib/env";
import { normalizeOffboardingRows } from "@/lib/imports/normalize";
import {
  parseTabularFile,
  parseTurnoverReport,
  validateOffboardingMapping,
} from "@/lib/imports/parser";
import type { FieldMapping, OffboardingCanonicalField } from "@/lib/imports/types";
import { getNameMatchKey, splitEmployeeName } from "@/lib/name-matching";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeKey, normalizeWhitespace, slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

function buildStoragePath(kind: string, fileName: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${kind}/${stamp}-${slugify(fileName) || "upload"}`;
}

async function uploadOriginalFile(file: File, kind: string) {
  const supabase = createSupabaseAdminClient();
  const path = buildStoragePath(kind, file.name);
  const { error } = await supabase.storage
    .from("termination-imports")
    .upload(path, file, { upsert: true, contentType: file.type || undefined });

  if (error) {
    throw new Error(`Failed to upload ${file.name} to Supabase Storage: ${error.message}`);
  }

  return path;
}

function toIsoTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function importOffboarding(
  file: File,
  mapping: FieldMapping<OffboardingCanonicalField>,
) {
  const supabase = createSupabaseAdminClient();
  const parsed = parseTabularFile(await file.arrayBuffer(), file.name);
  const issues = validateOffboardingMapping(mapping);

  if (issues.length) {
    throw new Error(issues.join(" "));
  }

  const normalizedRows = normalizeOffboardingRows(parsed.rows, mapping);
  const storagePath = await uploadOriginalFile(file, "offboarding");

  const { error: clearEventsError } = await supabase.from("termination_events").delete().neq("id", "");
  if (clearEventsError) {
    throw new Error(clearEventsError.message);
  }

  await supabase.from("employees").delete().neq("id", "");
  await supabase.from("managers").delete().neq("id", "");

  const managerPayload = Array.from(
    new Map(
      normalizedRows.map((row) => [
        getNameMatchKey(row.managerName),
        {
          manager_name: normalizeWhitespace(row.managerName),
          normalized_name: getNameMatchKey(row.managerName),
        },
      ]),
    ).values(),
  );

  if (managerPayload.length) {
    const { error } = await supabase.from("managers").upsert(managerPayload, {
      onConflict: "normalized_name",
    });
    if (error) throw new Error(error.message);
  }

  const { data: managers, error: managersError } = await supabase.from("managers").select("*");
  if (managersError) throw new Error(managersError.message);

  const managerMap = new Map(managers.map((item) => [item.normalized_name, item]));

  const employeePayload = Array.from(
    normalizedRows.reduce((map, row) => {
      const key =
        normalizeKey(row.employeeExternalId) ||
        getNameMatchKey(row.employeeName);
      if (!key) return map;

      if (!map.has(key)) {
        map.set(key, {
          employee_name: normalizeWhitespace(row.employeeName),
          normalized_name: getNameMatchKey(row.employeeName),
          employee_external_id: row.employeeExternalId,
          employee_email: null,
          manager_id: managerMap.get(getNameMatchKey(row.managerName))?.id ?? null,
          department: null,
          job_title: null,
          work_location: null,
        });
      }

      return map;
    }, new Map<string, {
      employee_name: string;
      normalized_name: string;
      employee_external_id: string | null;
      employee_email: null;
      manager_id: string | null;
      department: null;
      job_title: null;
      work_location: null;
    }>()),
  );

  if (employeePayload.length) {
    const { error } = await supabase.from("employees").upsert(employeePayload, {
      onConflict: "normalized_name",
    });
    if (error) throw new Error(error.message);
  }

  const { data: employees, error: employeesError } = await supabase.from("employees").select("*");
  if (employeesError) throw new Error(employeesError.message);

  const employeeMap = new Map<string, (typeof employees)[number]>();
  employees.forEach((employee) => {
    if (employee.employee_external_id) {
      employeeMap.set(normalizeKey(employee.employee_external_id), employee);
    }
    employeeMap.set(employee.normalized_name, employee);
  });

  const { data: importRow, error: importError } = await supabase
    .from("imports")
    .insert({
      import_kind: "offboarding",
      source_name: file.name,
      row_count: normalizedRows.length,
      status: parsed.issues.length ? "warning" : "success",
      notes: parsed.issues.join(" ") || null,
      storage_path: storagePath,
      metadata: { columns: parsed.headers },
    })
    .select()
    .single();

  if (importError) throw new Error(importError.message);

  const eventPayload = normalizedRows.map((row) => {
    const employee =
      (row.employeeExternalId && employeeMap.get(normalizeKey(row.employeeExternalId))) ||
      employeeMap.get(getNameMatchKey(row.employeeName));
    const manager = managerMap.get(getNameMatchKey(row.managerName));

    return {
      import_id: importRow.id,
      employee_id: employee?.id ?? null,
      manager_id: manager?.id ?? null,
      employee_name: row.employeeName,
      manager_name: row.managerName,
      termination_type: row.terminationType,
      termination_reason: row.terminationReason,
      termination_date: row.terminationDate,
      source_row: row.sourceRow,
    };
  });

  if (eventPayload.length) {
    const { error } = await supabase.from("termination_events").insert(eventPayload);
    if (error) throw new Error(error.message);
  }

  return {
    rowCount: normalizedRows.length,
    issues: parsed.issues,
  };
}

async function importTurnoverReport(file: File) {
  const supabase = createSupabaseAdminClient();
  const summary = parseTurnoverReport(await file.arrayBuffer());
  const storagePath = await uploadOriginalFile(file, "turnover-report");

  const { data: importRow, error: importError } = await supabase
    .from("imports")
    .insert({
      import_kind: "turnover_report",
      source_name: file.name,
      row_count: summary.detailRows.length,
      status: "success",
      notes: `Turnover summary for ${summary.reportYear}`,
      storage_path: storagePath,
      metadata: {
        reportYear: summary.reportYear,
        periodStart: summary.periodStart,
        periodEnd: summary.periodEnd,
      },
    })
    .select()
    .single();

  if (importError) throw new Error(importError.message);

  await supabase.from("turnover_report_rows").delete().eq("report_year", summary.reportYear);
  await supabase.from("turnover_summaries").delete().eq("report_year", summary.reportYear);

  const { error: summaryError } = await supabase.from("turnover_summaries").insert({
    report_year: summary.reportYear,
    period_start: summary.periodStart,
    period_end: summary.periodEnd,
    terminated_count: summary.terminatedCount,
    average_active_headcount: summary.averageActiveHeadcount,
    turnover_rate: summary.turnoverRate,
    generated_at: toIsoTimestamp(summary.generatedAt),
    notes: null,
    source_name: file.name,
    import_id: importRow.id,
  });

  if (summaryError) throw new Error(summaryError.message);

  if (summary.detailRows.length) {
    const { error: detailError } = await supabase.from("turnover_report_rows").insert(
      summary.detailRows.map((row) => ({
        report_year: summary.reportYear,
        import_id: importRow.id,
        employee_external_id: row.employeeExternalId,
        username: row.username,
        first_name: row.firstName,
        last_name: row.lastName,
        termination_date: row.terminationDate,
        termination_reason: row.terminationReason,
        service_length_years: row.serviceLengthYears,
      })),
    );

    if (detailError) throw new Error(detailError.message);
  }

  return summary;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const password = String(formData.get("password") ?? "");
    const expectedPassword = getImportUploadPassword();

    if (expectedPassword && password !== expectedPassword) {
      return NextResponse.json({ message: "Upload password is incorrect." }, { status: 401 });
    }

    const offboardingFile = formData.get("offboardingFile");
    const turnover2025File = formData.get("turnover2025File");
    const turnover2026File = formData.get("turnover2026File");
    const offboardingMappingRaw = String(formData.get("offboardingMapping") ?? "{}");
    const offboardingMapping = JSON.parse(offboardingMappingRaw) as FieldMapping<OffboardingCanonicalField>;

    if (!(offboardingFile instanceof File) && !(turnover2025File instanceof File) && !(turnover2026File instanceof File)) {
      return NextResponse.json({ message: "Upload at least one file to import." }, { status: 400 });
    }

    const results: string[] = [];

    if (offboardingFile instanceof File) {
      const offboardingResult = await importOffboarding(offboardingFile, offboardingMapping);
      results.push(`Imported ${offboardingResult.rowCount} offboarding rows.`);
    }

    if (turnover2025File instanceof File) {
      const summary = await importTurnoverReport(turnover2025File);
      results.push(`Imported ${summary.reportYear} turnover summary.`);
    }

    if (turnover2026File instanceof File) {
      const summary = await importTurnoverReport(turnover2026File);
      results.push(`Imported ${summary.reportYear} turnover summary.`);
    }

    revalidatePath("/dashboard");
    revalidatePath("/imports");

    return NextResponse.json({ message: results.join(" ") });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Import failed." },
      { status: 500 },
    );
  }
}

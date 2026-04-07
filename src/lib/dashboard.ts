import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type DashboardTerminationRecord = {
  id: string;
  employeeId: string | null;
  employeeName: string;
  employeeExternalId: string | null;
  managerId: string | null;
  managerName: string;
  terminationType: "Voluntary" | "Involuntary" | "Unknown";
  terminationReason: string | null;
  terminationDate: string | null;
  year: number | null;
};

export type TurnoverSummary = {
  reportYear: number;
  periodStart: string;
  periodEnd: string;
  terminatedCount: number;
  averageActiveHeadcount: number;
  turnoverRate: number;
  sourceName: string;
};

export type DashboardDataset = {
  terminations: DashboardTerminationRecord[];
  turnoverSummaries: TurnoverSummary[];
  importHistory: {
    id: string;
    sourceName: string;
    importKind: string;
    status: string;
    rowCount: number;
    importedAt: string;
    notes: string | null;
  }[];
};

type TerminationJoinRow = Database["public"]["Tables"]["termination_events"]["Row"] & {
  employee: Database["public"]["Tables"]["employees"]["Row"] | null;
  manager: Database["public"]["Tables"]["managers"]["Row"] | null;
};

export async function getDashboardDataset(): Promise<DashboardDataset> {
  const supabase = await createSupabaseServerClient();
  const [{ data: terminations, error: terminationError }, { data: summaries, error: summaryError }, { data: imports, error: importsError }] =
    await Promise.all([
      supabase
        .from("termination_events")
        .select(
          `
            id,
            employee_id,
            manager_id,
            employee_name,
            manager_name,
            termination_type,
            termination_reason,
            termination_date,
            employee:employees(*),
            manager:managers(*)
          `,
        )
        .order("termination_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("turnover_summaries")
        .select("*")
        .order("report_year", { ascending: true }),
      supabase
        .from("imports")
        .select("id, source_name, import_kind, status, row_count, imported_at, notes")
        .order("imported_at", { ascending: false })
        .limit(12),
    ]);

  if (terminationError) throw new Error(terminationError.message);
  if (summaryError) throw new Error(summaryError.message);
  if (importsError) throw new Error(importsError.message);

  return {
    terminations: ((terminations ?? []) as TerminationJoinRow[]).map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      employeeExternalId: row.employee?.employee_external_id ?? null,
      managerId: row.manager_id,
      managerName: row.manager_name,
      terminationType: row.termination_type,
      terminationReason: row.termination_reason,
      terminationDate: row.termination_date,
      year: row.termination_date ? new Date(`${row.termination_date}T00:00:00`).getFullYear() : null,
    })),
    turnoverSummaries: (summaries ?? []).map((row) => ({
      reportYear: row.report_year,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      terminatedCount: row.terminated_count,
      averageActiveHeadcount: Number(row.average_active_headcount),
      turnoverRate: Number(row.turnover_rate),
      sourceName: row.source_name,
    })),
    importHistory: (imports ?? []).map((row) => ({
      id: row.id,
      sourceName: row.source_name,
      importKind: row.import_kind,
      status: row.status,
      rowCount: row.row_count,
      importedAt: row.imported_at,
      notes: row.notes,
    })),
  };
}

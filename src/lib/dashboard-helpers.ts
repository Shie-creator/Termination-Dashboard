import type { DashboardTerminationRecord } from "@/lib/dashboard";
import { getNameMatchKey } from "@/lib/name-matching";
import { formatMonthLabel } from "@/lib/utils";

export function getTerminationMonthSeries(records: DashboardTerminationRecord[]) {
  const map = new Map<string, { month: string; total: number; voluntary: number; involuntary: number }>();

  records.forEach((record) => {
    if (!record.terminationDate) return;
    const month = record.terminationDate.slice(0, 7);
    const current = map.get(month) ?? { month, total: 0, voluntary: 0, involuntary: 0 };
    current.total += 1;
    if (record.terminationType === "Voluntary") current.voluntary += 1;
    if (record.terminationType === "Involuntary") current.involuntary += 1;
    map.set(month, current);
  });

  return Array.from(map.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => ({
      ...row,
      label: formatMonthLabel(row.month),
    }));
}

export function getReasonSeries(records: DashboardTerminationRecord[]) {
  const counts = new Map<string, number>();
  records.forEach((record) => {
    const reason = record.terminationReason?.trim() || "Unspecified";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export function getManagerSeries(records: DashboardTerminationRecord[]) {
  const counts = new Map<string, { managerId: string; managerName: string; total: number }>();

  records.forEach((record) => {
    const key = record.managerId ?? getNameMatchKey(record.managerName) ?? record.managerName;
    const current = counts.get(key) ?? {
      managerId: record.managerId ?? key,
      managerName: record.managerName,
      total: 0,
    };
    current.total += 1;
    counts.set(key, current);
  });

  return Array.from(counts.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

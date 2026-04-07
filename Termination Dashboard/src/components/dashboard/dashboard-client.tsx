"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, Download, Search } from "lucide-react";

import { TerminationTypeBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { DashboardDataset, DashboardTerminationRecord } from "@/lib/dashboard";
import { getManagerSeries, getReasonSeries, getTerminationMonthSeries } from "@/lib/dashboard";
import { downloadTextFile, formatDateLabel } from "@/lib/utils";

type Filters = {
  year: string;
  manager: string;
  terminationType: string;
  reason: string;
  search: string;
  sortBy: "terminationDate" | "employeeName" | "managerName";
  sortDirection: "asc" | "desc";
};

export function DashboardClient({
  dataset,
  managerScopedId,
}: {
  dataset: DashboardDataset;
  managerScopedId?: string;
}) {
  const [filters, setFilters] = useState<Filters>({
    year: "",
    manager: managerScopedId ?? "",
    terminationType: "",
    reason: "",
    search: "",
    sortBy: "terminationDate",
    sortDirection: "desc",
  });

  const records = dataset.terminations;

  const filtered = useMemo(() => {
    const query = filters.search.toLowerCase().trim();
    const result = records.filter((record) => {
      if (filters.year && String(record.year ?? "") !== filters.year) return false;
      if (filters.manager && (record.managerId ?? record.managerName) !== filters.manager) return false;
      if (filters.terminationType && record.terminationType !== filters.terminationType) return false;
      if (filters.reason && (record.terminationReason ?? "Unspecified") !== filters.reason) return false;
      if (
        query &&
        ![record.employeeName, record.managerName, record.terminationReason ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }
      return true;
    });

    return [...result].sort((a, b) => {
      const dir = filters.sortDirection === "asc" ? 1 : -1;
      const left = a[filters.sortBy] ?? "";
      const right = b[filters.sortBy] ?? "";
      return String(left).localeCompare(String(right)) * dir;
    });
  }, [records, filters]);

  const managerName = managerScopedId
    ? records.find((record) => (record.managerId ?? record.managerName) === managerScopedId)?.managerName ?? null
    : null;

  const years = Array.from(new Set(records.map((record) => record.year).filter(Boolean))).sort();
  const managers = Array.from(
    new Map(records.map((record) => [record.managerId ?? record.managerName, record.managerName])).entries(),
  ).map(([value, label]) => ({ value, label }));
  const reasons = Array.from(
    new Set(records.map((record) => record.terminationReason ?? "Unspecified")),
  ).sort((a, b) => a.localeCompare(b));

  const turnoverComparison = dataset.turnoverSummaries.map((row) => ({
    year: String(row.reportYear),
    turnoverRate: row.turnoverRate,
    terminatedCount: row.terminatedCount,
    averageHeadcount: row.averageActiveHeadcount,
  }));

  const kpis = {
    total: filtered.length,
    voluntary: filtered.filter((item) => item.terminationType === "Voluntary").length,
    involuntary: filtered.filter((item) => item.terminationType === "Involuntary").length,
    managers: new Set(filtered.map((item) => item.managerName)).size,
    topReason:
      getReasonSeries(filtered)[0]?.reason ?? "No reason data yet",
  };

  const monthlySeries = getTerminationMonthSeries(filtered);
  const reasonSeries = getReasonSeries(filtered);
  const managerSeries = getManagerSeries(filtered);

  if (!records.length && !dataset.turnoverSummaries.length) {
    return (
      <EmptyState
        title="No data loaded yet"
        description="Import the offboarding workbook and turnover reports from the Imports page to populate the public dashboard."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <Card className="rounded-[32px] bg-white">
          <div className="space-y-5">
            <div className="inline-flex rounded-full bg-[var(--surface-muted)] px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-ink)]">
              Public leadership view
            </div>
            <div className="space-y-3">
              <h2 className="max-w-3xl font-serif text-5xl leading-none text-[var(--brand-ink)]">
                {managerName ? `${managerName} Offboarding Overview` : "Termination & Turnover Dashboard"}
              </h2>
              <p className="max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
                Compare 2025 and 2026 turnover while drilling into offboarding details by employee, manager, type, reason, and month.
              </p>
            </div>
          </div>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <MiniMetric label="Terminations" value={String(kpis.total)} />
          <MiniMetric label="Managers affected" value={String(kpis.managers)} />
          <MiniMetric label="Voluntary" value={String(kpis.voluntary)} />
          <MiniMetric label="Involuntary" value={String(kpis.involuntary)} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <MetricCard label="Total Terminations" value={String(kpis.total)} helper="Filtered employee count." />
        <MetricCard label="Voluntary" value={String(kpis.voluntary)} helper="Voluntary exits in current view." />
        <MetricCard label="Involuntary" value={String(kpis.involuntary)} helper="Involuntary exits in current view." />
        <MetricCard label="Top Reason" value={kpis.topReason} helper="Most common reason in current view." />
        <MetricCard
          label="2026 Turnover Rate"
          value={`${turnoverComparison.find((row) => row.year === "2026")?.turnoverRate ?? 0}%`}
          helper="Year-to-date through the imported report period."
        />
      </section>

      <Card className="rounded-[30px]">
        <div className="grid gap-4 lg:grid-cols-5">
          <FilterSelect
            label="Year"
            value={filters.year}
            options={years.map((year) => ({ value: String(year), label: String(year) }))}
            onChange={(value) => setFilters((current) => ({ ...current, year: value }))}
          />
          <FilterSelect
            label="Manager"
            value={filters.manager}
            options={managers}
            onChange={(value) => setFilters((current) => ({ ...current, manager: value }))}
          />
          <FilterSelect
            label="Termination Type"
            value={filters.terminationType}
            options={["Voluntary", "Involuntary", "Unknown"].map((value) => ({ value, label: value }))}
            onChange={(value) => setFilters((current) => ({ ...current, terminationType: value }))}
          />
          <FilterSelect
            label="Reason"
            value={filters.reason}
            options={reasons.map((value) => ({ value, label: value }))}
            onChange={(value) => setFilters((current) => ({ ...current, reason: value }))}
          />
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--brand-ink)]">Search employee</span>
            <div className="flex items-center gap-2 rounded-2xl border bg-white px-4 py-3">
              <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
              <input
                className="w-full bg-transparent outline-none"
                placeholder="Name, manager, or reason"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              />
            </div>
          </label>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="2025 vs 2026 Turnover Rate">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={turnoverComparison}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="turnoverRate" fill="var(--brand-blue)" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="2025 vs 2026 Terminated Count">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={turnoverComparison}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="terminatedCount" fill="var(--brand-cyan)" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Terminations Over Time">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlySeries}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="var(--brand-blue)" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="voluntary" stroke="var(--success)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="involuntary" stroke="var(--danger)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Termination Reasons">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={reasonSeries} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="reason" tickLine={false} axisLine={false} width={120} />
              <Tooltip />
              <Bar dataKey="count" fill="var(--brand-cyan)" radius={[0, 10, 10, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1.3fr]">
        <ChartCard title="Termination Count by Manager">
          <div className="space-y-3">
            {managerSeries.length ? (
              managerSeries.map((item) => (
                <div key={item.managerId} className="flex items-center justify-between gap-4 rounded-2xl border bg-white p-4">
                  <div>
                    <p className="font-medium text-[var(--brand-ink)]">{item.managerName}</p>
                    <p className="text-sm text-[var(--muted-foreground)]">{item.total} terminations</p>
                  </div>
                  <Link
                    href={`/manager/${item.managerId}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-blue)]"
                  >
                    Open
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">No manager rows in the current filter view.</p>
            )}
          </div>
        </ChartCard>

        <Card className="rounded-[30px]">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Employee drilldown</p>
              <h3 className="mt-2 font-serif text-3xl text-[var(--brand-ink)]">Offboarding Table</h3>
            </div>
            <div className="flex items-center gap-3">
              <select
                className="rounded-full border bg-white px-3 py-2 text-sm"
                value={`${filters.sortBy}:${filters.sortDirection}`}
                onChange={(event) => {
                  const [sortBy, sortDirection] = event.target.value.split(":") as [Filters["sortBy"], Filters["sortDirection"]];
                  setFilters((current) => ({ ...current, sortBy, sortDirection }));
                }}
              >
                <option value="terminationDate:desc">Newest first</option>
                <option value="terminationDate:asc">Oldest first</option>
                <option value="employeeName:asc">Employee A-Z</option>
                <option value="managerName:asc">Manager A-Z</option>
              </select>
              <Button
                variant="ghost"
                onClick={() => downloadTextFile("termination-dashboard-export.csv", toCsv(filtered))}
                disabled={!filtered.length}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--surface-muted)] text-left">
                <tr>
                  {["Employee", "Manager", "Type", "Reason", "Termination Date", "Year"].map((header) => (
                    <th key={header} className="px-4 py-3 font-medium text-[var(--brand-ink)]">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length ? (
                  filtered.map((record) => (
                    <tr key={record.id} className="border-t align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--brand-ink)]">{record.employeeName}</p>
                        {record.employeeExternalId ? (
                          <p className="text-xs text-[var(--muted-foreground)]">ID {record.employeeExternalId}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted-foreground)]">{record.managerName}</td>
                      <td className="px-4 py-3"><TerminationTypeBadge type={record.terminationType} /></td>
                      <td className="px-4 py-3 text-[var(--muted-foreground)]">{record.terminationReason ?? "Unspecified"}</td>
                      <td className="px-4 py-3 text-[var(--muted-foreground)]">{formatDateLabel(record.terminationDate)}</td>
                      <td className="px-4 py-3 text-[var(--muted-foreground)]">{record.year ?? "Unknown"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-[var(--muted-foreground)]">
                      No employees match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}

function toCsv(records: DashboardTerminationRecord[]) {
  const headers = ["Employee", "Manager", "Termination Type", "Reason", "Termination Date", "Year"];
  const lines = records.map((record) =>
    [
      record.employeeName,
      record.managerName,
      record.terminationType,
      record.terminationReason ?? "",
      record.terminationDate ?? "",
      record.year ?? "",
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );

  return [headers.join(","), ...lines].join("\n");
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[var(--brand-ink)]">{label}</span>
      <select
        className="w-full rounded-2xl border bg-white px-4 py-3"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-[30px]">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-[var(--muted-foreground)]">{title}</p>
      {children}
    </Card>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card>
      <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-3 font-serif text-3xl font-semibold text-[var(--brand-ink)]">{value}</p>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">{helper}</p>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-[28px] bg-white">
      <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-3 font-serif text-3xl font-semibold text-[var(--brand-ink)]">{value}</p>
    </Card>
  );
}

"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, FileUp, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getDefaultOffboardingMapping,
  listCanonicalLabels,
  parseTabularFile,
  parseTurnoverReport,
  validateOffboardingMapping,
} from "@/lib/imports/parser";
import type { FieldMapping, OffboardingCanonicalField } from "@/lib/imports/types";

type PreviewState = {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  issues: string[];
};

type TurnoverPreview = {
  fileName: string;
  reportYear: number;
  terminatedCount: number;
  averageActiveHeadcount: number;
  turnoverRate: number;
  periodStart: string;
  periodEnd: string;
};

export function ImportWorkbench({
  history,
}: {
  history: {
    id: string;
    sourceName: string;
    importKind: string;
    status: string;
    rowCount: number;
    importedAt: string;
    notes: string | null;
  }[];
}) {
  const [offboardingFile, setOffboardingFile] = useState<File | null>(null);
  const [turnover2025File, setTurnover2025File] = useState<File | null>(null);
  const [turnover2026File, setTurnover2026File] = useState<File | null>(null);
  const [offboardingPreview, setOffboardingPreview] = useState<PreviewState | null>(null);
  const [turnover2025Preview, setTurnover2025Preview] = useState<TurnoverPreview | null>(null);
  const [turnover2026Preview, setTurnover2026Preview] = useState<TurnoverPreview | null>(null);
  const [mapping, setMapping] = useState<FieldMapping<OffboardingCanonicalField>>({});
  const [password, setPassword] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const mappingIssues = useMemo(() => {
    if (!offboardingPreview) return [];
    return [...offboardingPreview.issues, ...validateOffboardingMapping(mapping)];
  }, [offboardingPreview, mapping]);

  async function handleOffboardingFile(file: File) {
    const parsed = parseTabularFile(await file.arrayBuffer(), file.name);
    setOffboardingFile(file);
    setOffboardingPreview({
      fileName: file.name,
      headers: parsed.headers,
      rows: parsed.rows,
      issues: parsed.issues,
    });
    setMapping(getDefaultOffboardingMapping(parsed.headers));
  }

  async function handleTurnoverFile(file: File, year: 2025 | 2026) {
    const parsed = parseTurnoverReport(await file.arrayBuffer());
    const preview = {
      fileName: file.name,
      reportYear: parsed.reportYear,
      terminatedCount: parsed.terminatedCount,
      averageActiveHeadcount: parsed.averageActiveHeadcount,
      turnoverRate: parsed.turnoverRate,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
    };

    if (year === 2025) {
      setTurnover2025File(file);
      setTurnover2025Preview(preview);
      return;
    }

    setTurnover2026File(file);
    setTurnover2026Preview(preview);
  }

  async function handleSubmit() {
    if (!offboardingFile && !turnover2025File && !turnover2026File) {
      setSubmitState("error");
      setMessage("Choose at least one file before importing.");
      return;
    }

    if (offboardingFile && mappingIssues.length) {
      setSubmitState("error");
      setMessage("Resolve the offboarding column mapping issues first.");
      return;
    }

    setSubmitState("submitting");
    setMessage("");

    const formData = new FormData();
    if (offboardingFile) formData.append("offboardingFile", offboardingFile);
    if (turnover2025File) formData.append("turnover2025File", turnover2025File);
    if (turnover2026File) formData.append("turnover2026File", turnover2026File);
    formData.append("offboardingMapping", JSON.stringify(mapping));
    formData.append("password", password);

    const response = await fetch("/api/imports", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      setSubmitState("error");
      setMessage(payload.message ?? "Import failed.");
      return;
    }

    setSubmitState("success");
    setMessage(payload.message ?? "Import completed.");
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <Card className="space-y-5">
          <div>
            <h2 className="font-serif text-3xl font-semibold text-[var(--brand-ink)]">Import source files</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Upload the offboarding workbook and the 2025/2026 turnover reports. The dashboard stays empty until real files are imported.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <UploadCard
              title="Offboarding workbook"
              accept=".xlsx,.xls,.csv"
              fileName={offboardingPreview?.fileName}
              onChange={handleOffboardingFile}
            />
            <UploadCard
              title="Turnover 2025"
              accept=".xlsx,.xls"
              fileName={turnover2025Preview?.fileName}
              onChange={(file) => handleTurnoverFile(file, 2025)}
            />
            <UploadCard
              title="Turnover 2026"
              accept=".xlsx,.xls"
              fileName={turnover2026Preview?.fileName}
              onChange={(file) => handleTurnoverFile(file, 2026)}
            />
          </div>

          {offboardingPreview ? (
            <MappingSection
              headers={offboardingPreview.headers}
              issues={mappingIssues}
              mapping={mapping}
              onChange={(field, value) => setMapping((current) => ({ ...current, [field]: value }))}
              previewRows={offboardingPreview.rows.slice(0, 5)}
            />
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <TurnoverSummaryCard preview={turnover2025Preview} />
            <TurnoverSummaryCard preview={turnover2026Preview} />
          </div>

          <div className="rounded-[24px] border border-dashed p-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--brand-ink)]">Upload password</span>
              <input
                className="w-full rounded-2xl border bg-white px-4 py-3 outline-none"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Optional, if enabled"
              />
            </label>
          </div>

          <div className="flex flex-col gap-4 rounded-[24px] border border-dashed p-5">
            <div className="flex items-start gap-3">
              {submitState === "error" ? (
                <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--danger)]" />
              ) : submitState === "success" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-[var(--success)]" />
              ) : (
                <FileUp className="mt-0.5 h-5 w-5 text-[var(--brand-ink)]" />
              )}
              <div>
                <p className="font-semibold text-[var(--brand-ink)]">Confirm import</p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Source files are uploaded to Supabase Storage, normalized into Postgres, and reflected immediately on the public dashboard.
                </p>
              </div>
            </div>
            {message ? <p className="text-sm leading-6 text-[var(--muted-foreground)]">{message}</p> : null}
            <div>
              <Button onClick={handleSubmit} disabled={submitState === "submitting"}>
                {submitState === "submitting" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  "Import files"
                )}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="font-serif text-3xl font-semibold text-[var(--brand-ink)]">Import history</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">Saved from the shared Supabase database.</p>
          </div>
          <div className="space-y-3">
            {history.length ? (
              history.map((item) => (
                <div key={item.id} className="rounded-[22px] border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--brand-ink)]">{item.sourceName}</p>
                      <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">{item.importKind.replace("_", " ")}</p>
                    </div>
                    <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-semibold uppercase text-[var(--brand-ink)]">
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                    {new Date(item.importedAt).toLocaleString()} • {item.rowCount} rows
                  </p>
                  {item.notes ? <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{item.notes}</p> : null}
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed p-6 text-sm text-[var(--muted-foreground)]">
                No imports recorded yet.
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}

function UploadCard({
  title,
  accept,
  fileName,
  onChange,
}: {
  title: string;
  accept: string;
  fileName?: string;
  onChange: (file: File) => void;
}) {
  return (
    <label className="block rounded-[26px] border border-dashed bg-white p-5">
      <span className="mb-3 block font-semibold text-[var(--brand-ink)]">{title}</span>
      <span className="mb-4 block text-sm text-[var(--muted-foreground)]">{fileName ?? "Choose a file"}</span>
      <input
        className="block w-full text-sm"
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onChange(file);
        }}
      />
    </label>
  );
}

function MappingSection({
  headers,
  issues,
  mapping,
  onChange,
  previewRows,
}: {
  headers: string[];
  issues: string[];
  mapping: FieldMapping<OffboardingCanonicalField>;
  onChange: (field: OffboardingCanonicalField, value: string) => void;
  previewRows: Record<string, string>[];
}) {
  return (
    <div className="space-y-4 rounded-[24px] border p-5">
      <div>
        <h3 className="font-semibold text-[var(--brand-ink)]">Offboarding column mapping</h3>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Confirm how the app should interpret the uploaded offboarding workbook.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {listCanonicalLabels().map((field) => (
          <label key={field.value} className="block">
            <span className="mb-2 block text-sm font-medium capitalize text-[var(--brand-ink)]">{field.label}</span>
            <select
              className="w-full rounded-2xl border bg-white px-4 py-3"
              value={mapping[field.value] ?? ""}
              onChange={(event) => onChange(field.value, event.target.value)}
            >
              <option value="">Unmapped</option>
              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {issues.length ? (
        <div className="rounded-2xl border border-[var(--danger)]/20 bg-[var(--danger)]/5 p-4 text-sm text-[var(--danger)]">
          {issues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--surface-muted)] text-left">
            <tr>
              {headers.slice(0, 6).map((header) => (
                <th key={header} className="px-3 py-2 font-medium text-[var(--brand-ink)]">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, index) => (
              <tr key={index} className="border-t">
                {headers.slice(0, 6).map((header) => (
                  <td key={header} className="px-3 py-2 text-[var(--muted-foreground)]">{row[header]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TurnoverSummaryCard({ preview }: { preview: TurnoverPreview | null }) {
  if (!preview) {
    return (
      <div className="rounded-[24px] border border-dashed p-5 text-sm text-[var(--muted-foreground)]">
        Upload a turnover report to preview its summary.
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border bg-white p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">{preview.reportYear} turnover</p>
      <p className="mt-2 font-semibold text-[var(--brand-ink)]">{preview.fileName}</p>
      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-[var(--muted-foreground)]">Terminated</p>
          <p className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">{preview.terminatedCount}</p>
        </div>
        <div>
          <p className="text-[var(--muted-foreground)]">Avg headcount</p>
          <p className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">{preview.averageActiveHeadcount}</p>
        </div>
        <div>
          <p className="text-[var(--muted-foreground)]">Turnover</p>
          <p className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">{preview.turnoverRate}%</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-[var(--muted-foreground)]">
        {preview.periodStart} to {preview.periodEnd}
      </p>
    </div>
  );
}

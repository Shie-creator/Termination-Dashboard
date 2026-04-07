import { AppShell } from "@/components/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: latestImport } = await supabase
    .from("imports")
    .select("imported_at")
    .order("imported_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <AppShell latestImportAt={latestImport?.imported_at ?? null}>
      {children}
    </AppShell>
  );
}

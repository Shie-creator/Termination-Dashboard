import { notFound } from "next/navigation";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { getDashboardDataset } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function ManagerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dataset = await getDashboardDataset();
  const managerRows = dataset.terminations.filter((item) => (item.managerId ?? item.managerName) === id);

  if (!managerRows.length) {
    notFound();
  }

  return <DashboardClient dataset={dataset} managerScopedId={id} />;
}

"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Recharts is only needed on the dashboard, so it is split into its own chunk
 * and loaded in the browser (charts need the real container width anyway).
 */
const loading = () => <Skeleton className="h-[260px] w-full" />;

export const SalesChart = dynamic(() => import("./charts-impl").then((mod) => mod.SalesChart), {
  ssr: false,
  loading,
});

export const StatusChart = dynamic(() => import("./charts-impl").then((mod) => mod.StatusChart), {
  ssr: false,
  loading,
});

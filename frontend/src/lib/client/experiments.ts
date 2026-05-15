"use client";

import { trackAnalyticsEvent } from "@/lib/client/analytics";

const EXPERIMENT_ASSIGNMENTS_KEY = "tv_experiment_assignments";

export type ExperimentAssignment = {
  assignedAt: string;
  experiment: string;
  variant: string;
};

export function getExperimentVariant<TVariant extends string>(
  experiment: string,
  variants: readonly TVariant[],
  options: { enabled?: boolean; source?: string } = {},
): TVariant {
  const fallback = variants[0];
  if (!fallback || typeof window === "undefined" || options.enabled === false) return fallback;

  const safeExperiment = compactExperimentKey(experiment);
  const assignments = readAssignments();
  const existing = assignments[safeExperiment];
  if (existing && variants.includes(existing.variant as TVariant)) {
    trackAnalyticsEvent("experiment_exposed", { experiment: safeExperiment, variant: existing.variant }, { source: options.source ?? "experiment" });
    return existing.variant as TVariant;
  }

  const variant = variants[bucketExperiment(safeExperiment, variants.length)] ?? fallback;
  const assignment: ExperimentAssignment = {
    assignedAt: new Date().toISOString(),
    experiment: safeExperiment,
    variant,
  };
  writeAssignments({ ...assignments, [safeExperiment]: assignment });
  trackAnalyticsEvent("experiment_assigned", { experiment: safeExperiment, variant }, { source: options.source ?? "experiment" });
  trackAnalyticsEvent("experiment_exposed", { experiment: safeExperiment, variant }, { source: options.source ?? "experiment" });
  return variant;
}

function readAssignments(): Record<string, ExperimentAssignment> {
  try {
    const raw = window.localStorage.getItem(EXPERIMENT_ASSIGNMENTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ExperimentAssignment>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAssignments(assignments: Record<string, ExperimentAssignment>): void {
  try {
    window.localStorage.setItem(EXPERIMENT_ASSIGNMENTS_KEY, JSON.stringify(assignments));
  } catch {
    // Experiments degrade to the default variant if local storage is unavailable.
  }
}

function bucketExperiment(experiment: string, size: number): number {
  let hash = 0;
  const key = `${experiment}:${browserBucketSeed()}`;
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash << 5) - hash + key.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % Math.max(1, size);
}

function browserBucketSeed(): string {
  try {
    const key = "tv_experiment_seed";
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return "anonymous";
  }
}

function compactExperimentKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_").slice(0, 48) || "experiment";
}

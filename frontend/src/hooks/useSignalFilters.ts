"use client";

import { useMemo, useState } from "react";
import type { RankingRow } from "@/lib/types";

export function useSignalFilters(rows: RankingRow[]) {
  const [query, setQuery] = useState("");
  const [decision, setDecision] = useState("ALL");
  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return rows.filter((row) => {
      const matchesQuery = !q || row.symbol.includes(q) || String(row.company_name ?? "").toUpperCase().includes(q);
      const matchesDecision = decision === "ALL" || String(row.final_decision ?? "").toUpperCase() === decision;
      return matchesQuery && matchesDecision;
    });
  }, [decision, query, rows]);
  return { query, setQuery, decision, setDecision, filtered };
}

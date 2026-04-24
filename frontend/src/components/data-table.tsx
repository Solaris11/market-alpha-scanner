import type { CsvRow } from "@/lib/types";

type Props = {
  rows: CsvRow[];
  emptyMessage?: string;
  limit?: number;
};

export function DataTable({ rows, emptyMessage = "No rows available.", limit = 25 }: Props) {
  const visibleRows = rows.slice(0, limit);
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 12);

  if (!rows.length || !columns.length) {
    return <div className="rounded border border-dashed border-slate-700/70 px-3 py-6 text-center text-xs text-slate-500">{emptyMessage}</div>;
  }

  return (
    <div className="terminal-panel overflow-x-auto rounded-md">
      <table className="w-full min-w-[900px] table-auto border-collapse text-xs">
        <thead className="border-b border-slate-700/70 bg-slate-950/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            {columns.map((column) => (
              <th className="whitespace-nowrap px-2 py-1.5 text-left" key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/90">
          {visibleRows.map((row, rowIndex) => (
            <tr className="hover:bg-sky-400/5" key={rowIndex}>
              {columns.map((column) => (
                <td className="max-w-[220px] truncate px-2 py-1.5 text-slate-300" key={column} title={String(row[column] ?? "N/A")}>
                  {String(row[column] ?? "N/A")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > visibleRows.length ? <div className="border-t border-slate-800 px-2 py-1.5 text-xs text-slate-500">Showing {visibleRows.length} of {rows.length} rows.</div> : null}
    </div>
  );
}

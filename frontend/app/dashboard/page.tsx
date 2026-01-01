"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Summary = {
  month: string;
  total: number;
  budget: number | null;
  overBudget: boolean;
  byCategory: { categoryId: string; category: string; total: number }[];
};

type MonthPoint = { month: string; total: number };

function currentMonth() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function fmtBD(x: number) {
  return `${x.toFixed(2)} BD`;
}

function prevMonths(n: number) {
  // returns array oldest -> newest, each YYYY-MM
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setMonth(d.getMonth() - i);
    const yyyy = x.getFullYear();
    const mm = String(x.getMonth() + 1).padStart(2, "0");
    out.push(`${yyyy}-${mm}`);
  }
  return out;
}

export default function DashboardPage() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // NEW: last 6 months trend chart
  const [trend, setTrend] = useState<MonthPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const data = await apiFetch<Summary>(
        `/dashboard/summary?month=${encodeURIComponent(month)}`
      );

      setSummary({
        ...data,
        byCategory: Array.isArray(data.byCategory) ? data.byCategory : [],
      });

      setBudgetInput(data.budget != null ? String(data.budget) : "");
    } catch (e: any) {
      setErr(e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function loadTrend() {
    setTrendLoading(true);
    try {
      const months = prevMonths(6);
      const results = await Promise.all(
        months.map(async (m) => {
          const s = await apiFetch<Summary>(
            `/dashboard/summary?month=${encodeURIComponent(m)}`
          );
          return { month: m, total: Number(s.total || 0) } as MonthPoint;
        })
      );
      setTrend(results);
    } catch {
      // keep silent; trend is optional
      setTrend([]);
    } finally {
      setTrendLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadTrend();
  }, []); // load trend once on mount

  async function saveBudget() {
    setErr("");
    try {
      await apiFetch(`/budget`, {
        method: "POST",
        body: JSON.stringify({ month, maxBudget: Number(budgetInput) }),
      });
      await load();
      await loadTrend();
    } catch (e: any) {
      setErr(e?.message || "Failed to save budget");
    }
  }

  const over = summary?.overBudget ?? false;

  const remaining = useMemo(() => {
    if (!summary || summary.budget == null) return null;
    return summary.budget - summary.total;
  }, [summary]);

  const progress = useMemo(() => {
    if (!summary || summary.budget == null || summary.budget <= 0) return null;
    const pct = (summary.total / summary.budget) * 100;
    return Math.max(0, Math.min(100, pct));
  }, [summary]);

  const maxCategory = useMemo(() => {
    const arr = summary?.byCategory ?? [];
    return arr.reduce((m, x) => Math.max(m, x.total), 0) || 1;
  }, [summary]);

  // simple SVG line chart coordinates
  const chart = useMemo(() => {
    if (!trend.length) return null;
    const max = Math.max(...trend.map((t) => t.total), 1);
    const w = 520;
    const h = 180;
    const padX = 20;
    const padY = 18;

    const pts = trend.map((t, idx) => {
      const x = padX + (idx * (w - padX * 2)) / Math.max(trend.length - 1, 1);
      const y =
        padY + (h - padY * 2) - (t.total / max) * (h - padY * 2);
      return { x, y, ...t };
    });

    const d = pts
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");

    return { pts, d, w, h, max };
  }, [trend]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Top bar */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Track spending, set a monthly budget, and analyze your categories.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 transition"
              onClick={() => router.push("/expenses/new")}
            >
              + Add Expense
            </button>

            <button
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 transition"
              onClick={async () => {
                await apiFetch("/auth/logout");
                router.push("/login");
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="w-full sm:w-64">
            <label className="text-sm font-medium text-gray-700">Month</label>

            {/* ✅ better month picker (no ugly YYYY-MM hint text) */}
            <input
              type="month"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>

          {loading && (
            <div className="text-sm text-gray-500 sm:pb-2">Loading…</div>
          )}
        </div>

        {/* Error */}
        {err && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 whitespace-pre-wrap">
            {err}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-500">Total spent</div>
              <span className="text-xs rounded-full bg-gray-100 px-2 py-1 text-gray-600">
                {summary?.month ?? month}
              </span>
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
              {summary ? fmtBD(summary.total) : "—"}
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gray-900 transition-all"
                style={{ width: `${progress ?? 0}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {progress == null
                ? "Set a budget to see progress."
                : `${progress.toFixed(0)}% of budget used`}
            </div>

            {/* ✅ NEW: button to view month expenses */}
            <button
              onClick={() => router.push(`/expenses?month=${encodeURIComponent(month)}`)}
              className="mt-4 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
            >
              View this month details
            </button>
          </div>

          {/* Budget */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-gray-500">Budget</div>

            <div className="mt-3 flex gap-2">
              <input
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder="e.g. 500"
                inputMode="decimal"
              />
              <button
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 transition"
                onClick={saveBudget}
              >
                Save
              </button>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              {summary?.budget == null
                ? "No budget set yet."
                : `Current: ${fmtBD(summary.budget)}`}
            </div>

            {remaining != null && (
              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Remaining</div>
                <div className="text-lg font-semibold text-gray-900">
                  {fmtBD(remaining)}
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-gray-500">Status</div>

            <div
              className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
                over
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              {summary ? (over ? "Over budget" : "Within budget") : "—"}
            </div>

            <div className="mt-4 text-xs text-gray-500">
              {summary?.budget == null
                ? "Tip: Set a budget to track overspending."
                : over
                ? "Consider reducing expenses or increasing budget."
                : "Good job! You’re tracking well."}
            </div>
          </div>
        </div>

        {/* ✅ NEW: Monthly trend chart */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Spending trend (last 6 months)
              </h2>
              <p className="text-sm text-gray-500">
                See which month you spent more.
              </p>
            </div>
            {trendLoading && <div className="text-sm text-gray-500">Loading…</div>}
          </div>

          {!chart && (
            <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
              Not enough data yet.
            </div>
          )}

          {chart && (
            <div className="mt-4 overflow-x-auto">
              <svg width={chart.w} height={chart.h} className="block">
                {/* grid */}
                <line x1="20" y1="18" x2="20" y2={chart.h - 18} stroke="rgba(0,0,0,0.06)" />
                <line x1="20" y1={chart.h - 18} x2={chart.w - 20} y2={chart.h - 18} stroke="rgba(0,0,0,0.06)" />

                {/* line */}
                <path d={chart.d} fill="none" stroke="rgb(17,24,39)" strokeWidth="2.5" />

                {/* points */}
                {chart.pts.map((p, idx) => (
                  <g key={`${p.month}-${idx}`}>
                    <circle cx={p.x} cy={p.y} r="4" fill="rgb(17,24,39)" />
                    {/* clickable month */}
                    <rect
                      x={p.x - 16}
                      y={chart.h - 18}
                      width={32}
                      height={18}
                      fill="transparent"
                      onClick={() => setMonth(p.month)}
                      style={{ cursor: "pointer" }}
                    />
                  </g>
                ))}
              </svg>

              <div className="mt-2 grid grid-cols-2 sm:grid-cols-6 gap-2">
                {trend.map((t, idx) => (
                  <button
                    key={`${t.month}-${idx}`}
                    onClick={() => setMonth(t.month)}
                    className={`rounded-xl border px-3 py-2 text-sm text-left hover:bg-gray-50 transition ${
                      t.month === month ? "border-gray-900" : "border-gray-200"
                    }`}
                  >
                    <div className="text-xs text-gray-500">{t.month}</div>
                    <div className="font-mono font-semibold text-gray-900">
                      {fmtBD(t.total)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Charts + Category List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Category Bars */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Category chart</h2>
            <p className="text-sm text-gray-500">
              Visual summary of spending distribution.
            </p>

            <div className="mt-5 space-y-3">
              {(summary?.byCategory ?? []).length === 0 && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                  No data yet for this month.
                </div>
              )}

              {(summary?.byCategory ?? []).slice(0, 8).map((c, idx) => {
                const w = Math.max(6, Math.round((c.total / maxCategory) * 100));
                return (
                  <button
                    // ✅ FIX KEYS (always unique)
                    key={`${c.categoryId || c.category}-${idx}`}
                    className="w-full text-left rounded-xl border border-gray-100 p-3 hover:bg-gray-50 transition"
                    onClick={() =>
                      router.push(
                        `/expenses?month=${encodeURIComponent(month)}&categoryId=${encodeURIComponent(
                          c.categoryId
                        )}`
                      )
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900">{c.category}</div>
                      <div className="font-mono text-sm font-semibold text-gray-900">
                        {fmtBD(c.total)}
                      </div>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gray-900"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-gray-500">Tap to view details</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Spending by category list */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Spending by category
            </h2>
            <p className="text-sm text-gray-500">
              Click any category to open its expenses.
            </p>

            <div className="mt-4 space-y-2">
              {(summary?.byCategory ?? []).length === 0 && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                  No expenses yet for this month.
                </div>
              )}

              {(summary?.byCategory ?? []).map((c, idx) => (
                <button
                  // ✅ FIX KEYS (always unique)
                  key={`${c.categoryId || c.category}-${idx}`}
                  onClick={() =>
                    router.push(
                      `/expenses?month=${encodeURIComponent(month)}&categoryId=${encodeURIComponent(
                        c.categoryId
                      )}`
                    )
                  }
                  className="w-full flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-700">
                      {c.category?.slice(0, 1)?.toUpperCase() ?? "C"}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-gray-900">{c.category}</div>
                      <div className="text-xs text-gray-500">Total</div>
                    </div>
                  </div>

                  <div className="font-mono text-sm font-semibold text-gray-900">
                    {fmtBD(c.total)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pb-10" />
      </div>
    </div>
  );
}

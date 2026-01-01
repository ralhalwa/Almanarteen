"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Row = {
  id: string;
  date: string;
  categoryId: string;
  category: string;
  item: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
  note: string;
  createdBy: string;
};

function fmtBD(x: number) {
  return `${x.toFixed(2)} BD`;
}

export default function ExpensesPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const month = sp.get("month") || "";
  const categoryId = sp.get("categoryId") || "";

  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const title = useMemo(() => {
    if (!month) return "Expenses";
    return categoryId ? "Category Expenses" : "Monthly Expenses";
  }, [month, categoryId]);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("month", month);
      if (categoryId) qs.set("categoryId", categoryId);

      const data = await apiFetch<Row[]>(`/expenses?${qs.toString()}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!month) return;
    load();
  }, [month, categoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const headerCategory = rows[0]?.category;

  const sum = useMemo(() => rows.reduce((s, r) => s + (r.total || 0), 0), [rows]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {title}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {month && (
                <>
                  Month: <span className="font-medium text-gray-700">{month}</span>
                </>
              )}
              {categoryId && headerCategory && (
                <>
                  {" "}• Category:{" "}
                  <span className="font-medium text-gray-700">{headerCategory}</span>
                </>
              )}
            </p>
          </div>

          <button
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 transition"
            onClick={() => router.push("/dashboard")}
          >
            Back
          </button>
        </div>

        {loading && (
          <div className="text-sm text-gray-500">Loading…</div>
        )}

        {err && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 whitespace-pre-wrap">
            {err}
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500">Total</div>
            <div className="font-mono text-sm font-semibold text-gray-900">
              {fmtBD(sum)}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Category</th>
                  <th className="py-3 pr-4">Item</th>
                  <th className="py-3 pr-4">Qty</th>
                  <th className="py-3 pr-4">Unit price</th>
                  <th className="py-3 pr-4">Total</th>
                  <th className="py-3 pr-4">Note</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-gray-500">
                      No expenses found.
                    </td>
                  </tr>
                )}

                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-4 text-gray-700">{r.date}</td>
                    <td className="py-3 pr-4 text-gray-700">{r.category}</td>
                    <td className="py-3 pr-4 text-gray-900 font-medium">{r.item}</td>
                    <td className="py-3 pr-4 text-gray-700">
                      {r.quantity} {r.unit}
                    </td>
                    <td className="py-3 pr-4 font-mono text-gray-900">
                      {fmtBD(r.unitPrice)}
                    </td>
                    <td className="py-3 pr-4 font-mono font-semibold text-gray-900">
                      {fmtBD(r.total)}
                    </td>
                    <td className="py-3 pr-4 text-gray-700">{r.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pb-10" />
      </div>
    </div>
  );
}

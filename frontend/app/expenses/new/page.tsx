"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Cat = { id: string; name: string };
type Item = { id: string; name: string; unit: string };

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtBD(x: number) {
  return `${x.toFixed(2)} BD`;
}

export default function NewExpensePage() {
  const router = useRouter();

  const [cats, setCats] = useState<Cat[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [itemId, setItemId] = useState("");

  const [date, setDate] = useState(todayISO());
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");

  const [error, setError] = useState("");
  const [loadingCats, setLoadingCats] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedUnit = useMemo(
    () => items.find((i) => i.id === itemId)?.unit || "",
    [items, itemId]
  );

  const total = useMemo(() => {
    const q = Number(qty);
    const p = Number(price);
    if (!q || !p) return 0;
    return Math.round(q * p * 100) / 100;
  }, [qty, price]);

  const canSave =
    date &&
    categoryId &&
    itemId &&
    Number(qty) > 0 &&
    Number(price) > 0 &&
    !saving;

  useEffect(() => {
    (async () => {
      setError("");
      setLoadingCats(true);
      try {
        const data = await apiFetch<Cat[]>("/categories");
        setCats(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (e?.status === 401 || e?.status === 403) router.push("/login");
        else setError(e?.message || "Failed to load categories");
      } finally {
        setLoadingCats(false);
      }
    })();
  }, [router]);

  async function loadItems(catId: string) {
    setItems([]);
    setItemId("");
    if (!catId) return;

    setError("");
    setLoadingItems(true);
    try {
      const data = await apiFetch<Item[]>(
        `/items?categoryId=${encodeURIComponent(catId)}`
      );
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (e?.status === 401 || e?.status === 403) router.push("/login");
      else setError(e?.message || "Failed to load items");
    } finally {
      setLoadingItems(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;

    setError("");
    setSaving(true);
    try {
      await apiFetch("/expenses", {
        method: "POST",
        body: JSON.stringify({
          date,
          itemId,
          quantity: Number(qty),
          unitPrice: Number(price),
          note,
        }),
      });

      router.push("/dashboard");
    } catch (e: any) {
      if (e?.status === 401 || e?.status === 403) router.push("/login");
      else setError(e?.message || "Failed to save expense");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Add Expense
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Add a purchase record and it will appear in your monthly dashboard.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 transition"
              onClick={() => router.push("/dashboard")}
            >
              Back
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 whitespace-pre-wrap">
            {error}
          </div>
        )}

        {/* Form Card */}
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-5"
        >
          {/* Top row: date + total */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Total</label>
              <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                <div className="text-xs text-gray-500">Calculated</div>
                <div className="font-mono text-lg font-semibold text-gray-900">
                  {fmtBD(total)}
                </div>
              </div>
            </div>
          </div>

          {/* Category + Item */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Category
              </label>
              <div className="mt-2 relative">
                <select
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 disabled:bg-gray-50"
                  value={categoryId}
                  disabled={loadingCats}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCategoryId(v);
                    loadItems(v);
                  }}
                >
                  <option value="">
                    {loadingCats ? "Loading categories..." : "Select category…"}
                  </option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {loadingCats ? "Fetching categories…" : " "}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Item</label>
              <select
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 disabled:bg-gray-50"
                value={itemId}
                disabled={!categoryId || loadingItems}
                onChange={(e) => setItemId(e.target.value)}
              >
                <option value="">
                  {!categoryId
                    ? "Select category first…"
                    : loadingItems
                    ? "Loading items..."
                    : "Select item…"}
                </option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>

              <div className="mt-2 text-xs text-gray-500">
                {selectedUnit ? `Unit: ${selectedUnit}` : " "}
              </div>
            </div>
          </div>

          {/* Qty + Price */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Quantity
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 2"
              />
              {selectedUnit && (
                <div className="mt-2 text-xs text-gray-500">
                  Tip: quantity is in <span className="font-medium">{selectedUnit}</span>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Unit price (BD)
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 1.250"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Note (optional)
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Bought for kitchen"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-2">
            <button
              type="button"
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 transition"
              onClick={() => router.push("/dashboard")}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!canSave}
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 active:bg-gray-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save Expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

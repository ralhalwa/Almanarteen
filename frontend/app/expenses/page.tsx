import { Suspense } from "react";
import ExpensesClient from "./ExpensesClient";

export default function ExpensesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading…</div>}>
      <ExpensesClient />
    </Suspense>
  );
}

const API = process.env.NEXT_PUBLIC_API_URL;

if (!API) {
  throw new Error("NEXT_PUBLIC_API_URL is not defined");
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    credentials: "include", // ✅ REQUIRED for cookies
    headers: {
      ...(options.headers || {}),
      "Content-Type": "application/json",
    },
  });

  const contentType = res.headers.get("content-type");
  const isJSON = contentType?.includes("application/json");

  // ❌ error handling
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;

    if (isJSON) {
      try {
        const j = await res.json();
        message = j?.error || message;
      } catch {}
    } else {
      try {
        const t = await res.text();
        if (t) message = t;
      } catch {}
    }

    const err: any = new Error(message);
    err.status = res.status; // 👈 useful for redirects
    throw err;
  }

  // ✅ success
  if (isJSON) {
    return (await res.json()) as T;
  }

  // backend may return empty body (204 / logout)
  return {} as T;
}

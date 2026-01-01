const API = process.env.NEXT_PUBLIC_API_URL!;

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include",
  });

  const text = await res.text(); // read once

  if (!res.ok) {
    // try JSON error
    try {
      const j = JSON.parse(text);
      throw new Error(j?.error || "Request failed");
    } catch {
      throw new Error(text || `Request failed: ${res.status}`);
    }
  }

  // success: parse JSON if possible
  try {
    return JSON.parse(text) as T;
  } catch {
    // if backend returns empty body sometimes
    return {} as T;
  }
}

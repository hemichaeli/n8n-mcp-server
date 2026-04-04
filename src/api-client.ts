// n8n API client utilities

const N8N_BASE_URL = process.env.N8N_BASE_URL || "http://localhost:5678";
const N8N_API_KEY = process.env.N8N_API_KEY || "";

interface ApiRequestOptions {
  method: string;
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

interface ApiResponse {
  ok: boolean;
  status: number;
  data: unknown;
}

export async function n8nRequest(options: ApiRequestOptions): Promise<ApiResponse> {
  const { method, path, body, query } = options;

  if (!N8N_API_KEY) {
    throw new Error("N8N_API_KEY environment variable is not set. Generate an API key in n8n Settings > API.");
  }

  // Build URL with query params
  const url = new URL(`/api/v1${path}`, N8N_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    "X-N8N-API-KEY": N8N_API_KEY,
    "Accept": "application/json",
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: unknown;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = typeof data === "object" && data !== null && "message" in data
      ? (data as { message: string }).message
      : `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(errorMsg);
  }

  return { ok: true, status: response.status, data };
}

export function formatResponse(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

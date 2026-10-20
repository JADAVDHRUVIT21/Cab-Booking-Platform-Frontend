
const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  "https://cab-booking-platform-7uul.onrender.com"
).replace(/\/$/, "");

export async function apiRequest(
  endpoint,
  { method = "GET", body, token, headers = {} } = {}
) {
  const requestHeaders = {
    ...headers,
  };

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const normalizedEndpoint = endpoint.replace(/^\//, "");

  const response = await fetch(
    `${API_BASE_URL}/${normalizedEndpoint}`,
    {
      method,
      headers: requestHeaders,
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
    }
  );

  const contentType = response.headers.get("content-type") || "";

  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null
        ? data.detail || data.message || "Request failed"
        : data || "Request failed";

    throw new Error(
      typeof message === "string"
        ? message
        : JSON.stringify(message)
    );
  }

  return data;
}

export default apiRequest;

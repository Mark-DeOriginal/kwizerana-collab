const NETWORK_ERROR_HINTS = [
  "fetch failed",
  "failed to fetch",
  "networkerror",
  "network error",
  "load failed",
  "unexpected end of json input",
  "unexpected token",
  "unexpected end of input",
  "body stream is locked",
  "no internet",
  "offline",
  "internet connection"
];

export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (NETWORK_ERROR_HINTS.some((hint) => message.includes(hint))) {
      return "You appear to be offline. Check your internet connection and try again.";
    }
    return error.message;
  }
  return fallback;
}

export async function readJson<T = unknown>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

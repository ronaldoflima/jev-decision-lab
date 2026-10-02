export const ENDPOINT = "https://openrouter.ai/api/alpha/decisions";
export const DEFAULT_MODEL = "typesafe/jev-1.13";

export class DecisionApiError extends Error {
  constructor(message, { status = null, code = "api_error" } = {}) {
    super(message);
    this.name = "DecisionApiError";
    this.status = status;
    this.code = code;
  }
}

export async function evaluate(
  request,
  {
    apiKey = process.env.OPENROUTER_API_KEY,
    model = process.env.JEV_MODEL || DEFAULT_MODEL,
    timeout = 30000,
    fetchImpl = globalThis.fetch,
  } = {},
) {
  if (!apiKey?.trim())
    throw new DecisionApiError(
      "Set OPENROUTER_API_KEY before running live decisions.",
      { code: "missing_api_key" },
    );
  if (!Number.isInteger(timeout) || timeout < 1)
    throw new DecisionApiError("Timeout must be a positive integer.", {
      code: "invalid_timeout",
    });
  // Tags and confidence thresholds are local metadata, not model inputs.
  const payload = {
    model: request.model || model,
    state: request.state,
    questions: request.questions,
  };
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeout),
      redirect: "error",
    });
    if (!response.ok) {
      const messages = {
        401: "OpenRouter rejected the API key.",
        403: "OpenRouter denied access.",
        402: "OpenRouter reported insufficient credits.",
        429: "OpenRouter rate limit reached. No automatic retry was made.",
      };
      await response.body?.cancel();
      throw new DecisionApiError(
        messages[response.status] ||
          "OpenRouter returned HTTP " + response.status + ".",
        { status: response.status },
      );
    }
    let result;
    try {
      result = await response.json();
    } catch {
      throw new DecisionApiError(
        "OpenRouter returned an invalid JSON response.",
        { code: "invalid_response" },
      );
    }
    if (!result?.answers && !result?.decisions)
      throw new DecisionApiError("OpenRouter returned no decisions.", {
        code: "invalid_response",
      });
    return result;
  } catch (error) {
    if (error instanceof DecisionApiError) throw error;
    if (error?.name === "TimeoutError" || error?.name === "AbortError")
      throw new DecisionApiError(
        "The request timed out. Its billing status is unknown; no automatic retry was made.",
        { code: "timeout" },
      );
    // Do not echo provider bodies, headers or arbitrary transport messages.
    throw new DecisionApiError(
      "Network request failed. Its billing status may be unknown.",
      { code: "network_error" },
    );
  }
}

import { MODELS } from "./prompts/channel-styles.js";
const ROOT = "https://api.openai.com/v1/";
export function validateKey(key) {
  if (!/^[\x21-\x7e]{1,512}$/.test(key || ""))
    throw Error("Enter a valid OpenAI API key for this visit.");
}
export async function openaiRequest(
  path,
  body,
  apiKey,
  signal,
  timeoutMs = 120000,
) {
  validateKey(apiKey);
  if (!["chat/completions", "images/edits", "responses"].includes(path))
    throw Error("Unsupported OpenAI endpoint.");
  const controller = new AbortController(),
    abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const multipart = body instanceof FormData;
    const response = await fetch(ROOT + path, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(multipart ? {} : { "Content-Type": "application/json" }),
      },
      body: multipart ? body : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      let details;
      try { details = (await response.json())?.error; } catch {}
      // Provider messages can echo confidential input. Report only known diagnostics.
      const codes = ["invalid_api_key", "invalid_request_error", "model_not_found", "unsupported_parameter", "unsupported_value", "insufficient_quota", "rate_limit_exceeded", "content_policy_violation"];
      const params = ["model", "tools", "tools[0]", "tool_choice", "max_tool_calls", "text.format", "response_format", "size", "quality", "image", "image[]", "prompt"];
      const code = codes.includes(details?.code) ? details.code : codes.includes(details?.type) ? details.type : "";
      const param = params.includes(details?.param) ? details.param : "";
      throw Error(response.status === 429
        ? "OpenAI rate or billing limit reached. Check API billing before retrying; no automatic retry was made."
        : `OpenAI rejected ${path} (HTTP ${response.status})${code ? `; code: ${code}` : ""}${param ? `; parameter: ${param}` : ""}. Check your key, model access, organization verification and API billing. No automatic retry was made.`);
    }
    try {
      return await response.json();
    } catch {
      throw Error(
        "OpenAI returned invalid content. No template text was substituted.",
      );
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted)
      throw Error(
        "OpenAI timed out. Your brief is kept. Check the provider before retrying; no automatic retry was made.",
      );
    if (error instanceof TypeError)
      throw Error(
        "Could not reach OpenAI from this browser. Check your connection and provider availability. No proxy or automatic retry was used.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
export async function structuredRequest(
  stage,
  prompt,
  payload,
  schema,
  apiKey,
  signal,
  images = [],
  onResponse,
) {
  const data = await openaiRequest(
    "chat/completions",
    {
      model: MODELS.text,
      store: false,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: images.length
          ? [{ type: "text", text: JSON.stringify(payload) }, ...images]
          : JSON.stringify(payload) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: stage, strict: true, schema },
      },
      max_completion_tokens: 12000,
    },
    apiKey,
    signal,
  );
  const choice = data?.choices?.[0];
  const raw = typeof choice?.message?.content === "string" ? choice.message.content : "";
  // Save paid text before parsing, including truncated or unexpected responses.
  await onResponse?.({ stage, model: MODELS.text, finishReason: choice?.finish_reason || "unknown",
    text: raw.replaceAll(apiKey, "[redacted]").slice(0, 100000) });
  if (!raw.trim()) throw Error("OpenAI returned no text for this stage. Other results are kept. No automatic retry was made.");
  return parseAIText(raw);
}
export function parseAIText(raw) {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(text); }
  catch { return { rawText: raw }; }
}

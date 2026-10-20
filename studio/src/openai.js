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
  if (!["chat/completions", "images/edits"].includes(path))
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
    if (!response.ok)
      throw Error(
        response.status === 429
          ? "OpenAI rate or billing limit reached. Check API billing before retrying; no automatic retry was made."
          : `OpenAI rejected the request (HTTP ${response.status}). Check your key, model access, organization verification and API billing.`,
      );
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
) {
  const data = await openaiRequest(
    "chat/completions",
    {
      model: MODELS.text,
      store: false,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify(payload) },
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
  if (
    choice?.finish_reason !== "stop" ||
    typeof choice.message?.content !== "string"
  )
    throw Error(
      "OpenAI returned incomplete content. No template text was substituted.",
    );
  try {
    return JSON.parse(choice.message.content);
  } catch {
    throw Error(
      "OpenAI returned invalid content. No template text was substituted.",
    );
  }
}

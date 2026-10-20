import { zipSync, strToU8 } from "fflate";
import { privateFetch, jsonResponse } from "./private-api.js";
const versions = new Map(),
  blobsByRecord = new Map();
let downloads = 0;
const waiting = [];
async function limitedDownload(action) {
  if (downloads < 4) downloads++;
  else await new Promise((resolve) => waiting.push(resolve));
  try {
    return await action();
  } finally {
    if (waiting.length) waiting.shift()();
    else downloads--;
  }
}
const route = (store, id) =>
  `/api/workspace/${encodeURIComponent(store)}${id ? "/" + encodeURIComponent(id) : ""}`;
const recordKey = (store, id) => `${store}/${id}`;
function knownBlobs(key) {
  if (!blobsByRecord.has(key)) blobsByRecord.set(key, new WeakMap());
  return blobsByRecord.get(key);
}
export async function allServer(store) {
  const values = await jsonResponse(await privateFetch(route(store)));
  return values.map(({ version, record }) => {
    const key = recordKey(store, record.id || record.projectId);
    if (!versions.has(key)) versions.set(key, version);
    return record;
  });
}
export async function getServer(store, id) {
  const response = await privateFetch(route(store, id));
  if (response.status === 404) return undefined;
  const { version, record } = await jsonResponse(response),
    key = recordKey(store, id),
    known = knownBlobs(key);
  versions.set(key, version);
  const loading = new Map();
  async function restore(value) {
    if (value && typeof value === "object" && value.__studioBlob) {
      const blobId = value.__studioBlob;
      if (!loading.has(blobId))
        loading.set(
          blobId,
          limitedDownload(async () => {
            const response = await privateFetch(
              `${route(store, id)}/blobs/${encodeURIComponent(blobId)}`,
            );
            if (!response.ok) await jsonResponse(response);
            const blob = await response.blob();
            known.set(blob, blobId);
            return blob;
          }),
        );
      return loading.get(blobId);
    }
    if (Array.isArray(value)) return Promise.all(value.map(restore));
    if (value && typeof value === "object") {
      const entries = await Promise.all(
        Object.entries(value).map(async ([name, child]) => [
          name,
          await restore(child),
        ]),
      );
      return Object.fromEntries(entries);
    }
    return value;
  }
  return restore(record);
}
export async function putServer(store, value) {
  const id = store === "drafts" ? value.projectId : value.id,
    key = recordKey(store, id),
    known = knownBlobs(key);
  const pending = new Map(),
    files = {};
  async function encode(value) {
    if (value instanceof Blob) {
      let blobId = known.get(value) || pending.get(value);
      if (!blobId) {
        blobId = crypto.randomUUID();
        pending.set(value, blobId);
        files[`blobs/${blobId}`] = new Uint8Array(await value.arrayBuffer());
      }
      return { __studioBlob: blobId, type: value.type, size: value.size };
    }
    if (Array.isArray(value)) {
      const result = [];
      for (const child of value) result.push(await encode(child));
      return result;
    }
    if (value && typeof value === "object") {
      const result = {};
      for (const [name, child] of Object.entries(value))
        result[name] = await encode(child);
      return result;
    }
    return value;
  }
  const metadata = await encode(value);
  const body = new Blob(
    [
      zipSync(
        { "record.json": strToU8(JSON.stringify(metadata)), ...files },
        { level: 0 },
      ),
    ],
    { type: "application/zip" },
  );
  const saved = await jsonResponse(
    await privateFetch(route(store, id), {
      method: "POST",
      headers: {
        "Content-Type": "application/zip",
        "If-Match": `"${versions.get(key) || 0}"`,
      },
      body,
    }),
  );
  versions.set(key, saved.version);
  for (const [blob, blobId] of pending) known.set(blob, blobId);
}
export async function deleteServerProject(id) {
  const response = await privateFetch(route("projects", id), {
    method: "DELETE",
    headers: {
      "If-Match": `"${versions.get(recordKey("projects", id)) || 0}"`,
    },
  });
  if (!response.ok) await jsonResponse(response);
  versions.delete(recordKey("projects", id));
  blobsByRecord.clear();
}

import {
  allServer,
  getServer,
  putServer,
  deleteServerProject,
} from "./server-storage.js";
const serverStorage = window.STUDIO_RUNTIME?.workspaceStorage === "server";
const pages = window.STUDIO_RUNTIME?.pages;
if (pages && !window.STUDIO_RUNTIME.accountId)
  throw Error(
    "An approved Google session is required before opening local projects.",
  );
const databaseName = pages
  ? `creative-automation-studio:${window.STUDIO_RUNTIME.firebase.projectId}:${window.STUDIO_RUNTIME.accountId}`
  : "creative-automation-studio";
const dbPromise = serverStorage
  ? null
  : new Promise((resolve, reject) => {
      const r = indexedDB.open(databaseName, 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        db.createObjectStore("projects", { keyPath: "id" });
        db.createObjectStore("drafts", { keyPath: "projectId" });
        db.createObjectStore("runs", { keyPath: "id" }).createIndex(
          "projectId",
          "projectId",
        );
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () =>
        reject(
          Error(
            "Browser storage is unavailable. Allow IndexedDB to save your projects.",
          ),
        );
    });
export async function transaction(store, mode, operation) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    let value;
    const r = operation(tx.objectStore(store));
    if (r)
      r.onsuccess = () => {
        value = r.result;
      };
    tx.oncomplete = () => resolve(value);
    tx.onerror = tx.onabort = () =>
      reject(
        Error(
          tx.error?.name === "QuotaExceededError"
            ? "Browser storage is full. Export and remove old projects to free space."
            : "Could not save browser data. Check storage permissions and free space.",
        ),
      );
  });
}
export const put = (store, value) =>
  serverStorage
    ? putServer(store, value)
    : transaction(store, "readwrite", (s) => s.put(value));
export const get = (store, id) =>
  serverStorage
    ? getServer(store, id)
    : transaction(store, "readonly", (s) => s.get(id));
export const all = (store) =>
  serverStorage
    ? allServer(store)
    : transaction(store, "readonly", (s) => s.getAll());
export async function runsFor(id) {
  return (await all("runs"))
    .filter((r) => r.projectId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function deleteProject(id) {
  if (serverStorage) return deleteServerProject(id);
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["projects", "drafts", "runs"], "readwrite");
    tx.objectStore("projects").delete(id);
    tx.objectStore("drafts").delete(id);
    const r = tx
      .objectStore("runs")
      .index("projectId")
      .openKeyCursor(IDBKeyRange.only(id));
    r.onsuccess = () => {
      const c = r.result;
      if (c) {
        tx.objectStore("runs").delete(c.primaryKey);
        c.continue();
      }
    };
    tx.oncomplete = resolve;
    tx.onerror = tx.onabort = () =>
      reject(Error("Could not delete the project. Please try again."));
  });
}

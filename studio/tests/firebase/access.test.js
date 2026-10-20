import { before, after, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
let env;
const projectId = "demo-creative-studio";
const tokens = (email, verified = true, provider = "google.com") => ({
  email,
  email_verified: verified,
  firebase: { sign_in_provider: provider },
});
const google = (uid, email) =>
  env.authenticatedContext(uid, tokens(email)).firestore();
const owner = () => google("owner-uid", "owner@team.example");
const row = (email) => ({
  email,
  active: true,
  uid: null,
  updatedAt: serverTimestamp(),
});
before(async () => {
  const [host, port] = (
    process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8088"
  ).split(":");
  if (host !== "127.0.0.1" || Number(port) !== 8088)
    throw Error(
      "Use the isolated local Firestore emulator, never a production project.",
    );
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host,
      port: Number(port),
      rules: await readFile(
        new URL("../../firebase/firestore.rules", import.meta.url),
        "utf8",
      ),
    },
  });
});
after(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "studioSettings", "access"), {
      ownerEmail: "owner@team.example",
    });
  });
});
test("anonymous and uninvited users cannot discover the roster, owner or grant themselves access", async () => {
  for (const db of [
    env.unauthenticatedContext().firestore(),
    google("outsider", "outsider@gmail.com"),
  ]) {
    await assertFails(getDoc(doc(db, "studioSettings", "access")));
    await assertFails(getDocs(collection(db, "studioAccess")));
    await assertFails(getDoc(doc(db, "studioAccess", "someone@gmail.com")));
    await assertFails(
      setDoc(
        doc(db, "studioAccess", "outsider@gmail.com"),
        row("outsider@gmail.com"),
      ),
    );
    await assertFails(
      setDoc(doc(db, "studioSettings", "access"), {
        ownerEmail: "outsider@gmail.com",
      }),
    );
  }
});
test("owner binds a stable identity and may manage exact Google addresses across domains", async () => {
  const db = owner();
  await assertSucceeds(
    updateDoc(doc(db, "studioSettings", "access"), { ownerUid: "owner-uid" }),
  );
  for (const email of ["member@gmail.com", "member@another.example"])
    await assertSucceeds(setDoc(doc(db, "studioAccess", email), row(email)));
  await assertSucceeds(getDocs(collection(db, "studioAccess")));
  await assertFails(
    getDoc(
      doc(
        google("recycled-owner", "owner@team.example"),
        "studioSettings",
        "access",
      ),
    ),
  );
  await assertFails(
    updateDoc(doc(db, "studioSettings", "access"), {
      ownerEmail: "another@gmail.com",
    }),
  );
  await assertFails(
    setDoc(
      doc(db, "studioAccess", "owner@team.example"),
      row("owner@team.example"),
    ),
  );
});
test("verified Google member binds only its own invitation and cannot manage anyone", async () => {
  const email = "member@gmail.com",
    db = google("member-uid", email);
  await setDoc(doc(owner(), "studioAccess", email), row(email));
  await assertSucceeds(
    updateDoc(doc(db, "studioAccess", email), { uid: "member-uid" }),
  );
  await assertSucceeds(getDoc(doc(db, "studioAccess", email)));
  await assertFails(getDocs(collection(db, "studioAccess")));
  await assertFails(
    updateDoc(doc(db, "studioAccess", email), { active: false }),
  );
  await assertFails(
    setDoc(doc(db, "studioAccess", "other@gmail.com"), row("other@gmail.com")),
  );
  await assertFails(
    updateDoc(doc(google("different-uid", email), "studioAccess", email), {
      uid: "different-uid",
    }),
  );
});
test("unverified and non-Google identities cannot accept an invitation", async () => {
  const email = "member@gmail.com";
  await setDoc(doc(owner(), "studioAccess", email), row(email));
  for (const claims of [
    tokens(email, false),
    tokens(email, true, "password"),
  ]) {
    const db = env.authenticatedContext("member-uid", claims).firestore();
    await assertFails(getDoc(doc(db, "studioAccess", email)));
    await assertFails(
      updateDoc(doc(db, "studioAccess", email), { uid: "member-uid" }),
    );
  }
});
test("revocation blocks binding, while only the owner can deliberately reset a grant", async () => {
  const email = "member@gmail.com",
    db = google("member-uid", email);
  await setDoc(doc(owner(), "studioAccess", email), row(email));
  await updateDoc(doc(owner(), "studioAccess", email), {
    active: false,
    updatedAt: serverTimestamp(),
  });
  await assertFails(
    updateDoc(doc(db, "studioAccess", email), { uid: "member-uid" }),
  );
  await assertFails(
    updateDoc(doc(db, "studioAccess", email), {
      active: true,
      uid: "member-uid",
    }),
  );
  await assertSucceeds(setDoc(doc(owner(), "studioAccess", email), row(email)));
  await assertSucceeds(
    updateDoc(doc(db, "studioAccess", email), { uid: "member-uid" }),
  );
});
test("directory rules reject project contents, key fields and all unrelated collections", async () => {
  const db = owner(),
    email = "member@gmail.com";
  await assertFails(
    setDoc(doc(db, "studioAccess", email), {
      ...row(email),
      apiKey: "must-not-be-stored",
    }),
  );
  await assertFails(
    setDoc(doc(db, "projects", "example"), { title: "Private event" }),
  );
});

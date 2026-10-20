import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  inMemoryPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDocFromServer,
  getDocsFromServer,
  collection,
  runTransaction,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

let auth, database, account;
const settings = () => doc(database, "studioSettings", "access");
const member = (email) => doc(database, "studioAccess", email);
export const pagesAccount = () => account;
export async function initializePagesAuth(config, onAccess, onMessage) {
  const app = initializeApp(config);
  auth = getAuth(app);
  database = getFirestore(app);
  await setPersistence(auth, inMemoryPersistence);
  let stopWatching,
    generation = 0;
  onAuthStateChanged(auth, async (user) => {
    const turn = ++generation;
    stopWatching?.();
    account = null;
    onAccess(null, Boolean(user));
    if (!user) return;
    onMessage("Checking your approved Google account…");
    try {
      if (
        !user.emailVerified ||
        !user.email ||
        (await user.getIdTokenResult()).signInProvider !== "google.com"
      )
        throw Error("Use a verified Google account.");
      const email = user.email.toLowerCase();
      let owner = false;
      try {
        const snapshot = await getDocFromServer(settings());
        owner = snapshot.exists() && snapshot.data().ownerEmail === email;
      } catch (error) {
        if (error.code !== "permission-denied") throw error;
      }
      const reference = owner ? settings() : member(email);
      await runTransaction(database, async (tx) => {
        const snapshot = await tx.get(reference);
        if (!snapshot.exists())
          throw Error(
            "This Google account is not approved. Ask the owner for access.",
          );
        const value = snapshot.data();
        if (owner) {
          if (value.ownerUid && value.ownerUid !== user.uid)
            throw Error("This owner account needs administrator review.");
          if (!value.ownerUid) tx.update(reference, { ownerUid: user.uid });
        } else {
          if (!value.active || (value.uid && value.uid !== user.uid))
            throw Error(
              "This Google account is not approved. Ask the owner for access.",
            );
          if (!value.uid) tx.update(reference, { uid: user.uid });
        }
      });
      if (turn !== generation) return;
      let confirmed = false;
      stopWatching = onSnapshot(
        reference,
        { includeMetadataChanges: true },
        (snapshot) => {
          if (turn !== generation) return;
          const value = snapshot.data();
          const valid =
            snapshot.exists() &&
            (owner
              ? value.ownerEmail === email && value.ownerUid === user.uid
              : value.active && value.uid === user.uid);
          if (snapshot.metadata.fromCache) {
            if (!confirmed) return;
            account = null;
            onAccess(null, true);
            onMessage(
              "Connection to the access directory was lost. Reload and sign in again.",
            );
            return;
          }
          if (!valid) {
            account = null;
            onAccess(null, true);
            onMessage(
              "Access is unavailable or has been revoked. Contact the owner.",
            );
            return;
          }
          confirmed = true;
          account = { uid: user.uid, email, owner };
          onAccess(account, true);
        },
        () => {
          account = null;
          onAccess(null, true);
          onMessage(
            "Access could not be verified. Contact the owner or reload Studio.",
          );
        },
      );
    } catch {
      if (turn !== generation) return;
      onMessage(
        "This account is not approved, or the access directory is unavailable. Contact the owner. You can sign out to choose another Google account.",
      );
    }
  });
}
export async function signInPages() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(auth, provider);
}
export async function signOutPages() {
  await signOut(auth);
}
export async function listPagesAccess() {
  if (!account?.owner) throw Error("Only the owner can manage access.");
  const rows = (
    await getDocsFromServer(collection(database, "studioAccess"))
  ).docs.map((snapshot) => ({
    ...snapshot.data(),
    email: snapshot.id,
    owner: false,
  }));
  return [{ email: account.email, active: true, owner: true }, ...rows];
}
export async function changePagesAccess(input, active) {
  if (!account?.owner) throw Error("Only the owner can manage access.");
  const email = input.trim().toLowerCase();
  if (!/^[^/@\s]+@[^/@\s]+\.[^/@\s]+$/.test(email) || email.length > 254)
    throw Error("Enter an exact Google account email.");
  if (email === account.email)
    throw Error("The owner cannot revoke or reassign their own access.");
  if (active)
    await setDoc(member(email), {
      email,
      active: true,
      uid: null,
      updatedAt: serverTimestamp(),
    });
  else
    await updateDoc(member(email), {
      active: false,
      updatedAt: serverTimestamp(),
    });
}

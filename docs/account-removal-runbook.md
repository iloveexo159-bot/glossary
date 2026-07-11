# Owner runbook: removing a user account via the Firebase Console

*PRD §8.6 — admin removal of an abusive or stale account. Everything here is
done in the [Firebase Console](https://console.firebase.google.com) for project
**glossary-9363f**; no code, no in-app admin panel. Expect ~5 minutes per
account.*

Users delete themselves via the in-app **Delete account** button (`#/login`);
this runbook is only for the cases where the owner must remove someone who
won't or can't.

## Step 1 — Find the user's UID

1. Console → **Authentication → Users**.
2. Search by the user's email address.
3. Copy the **User UID** (e.g. `a1B2c3D4…`) — you need it for Step 3.

## Step 2 — Delete the Auth user (cuts off sign-in)

1. On the same Users row: ⋮ menu → **Delete account** → confirm.
2. This immediately prevents new sign-ins. **Caveat:** an already-issued ID
   token stays valid for up to ~1 hour, so an open session on the user's
   device may keep read/write access to their (about-to-be-deleted) data for
   that window. Deleting the data in Step 3 right away makes this moot.

## Step 3 — Delete the user's Firestore subtree

1. Console → **Firestore Database → Data**.
2. Navigate to the `users` collection and locate the document whose ID is the
   UID from Step 1. (It may render in *italics* — that means no document
   fields exist at that path, only subcollections. It still holds data.)
3. **Deleting the `{uid}` document alone is NOT enough** — the Console does
   not cascade into subcollections. Delete each subcollection explicitly:
   open `cards`, `reviewHistory`, `exports`, and `meta` in turn, and use the
   ⋮ menu → **Delete collection** on each (type the collection name to
   confirm).
4. Finally delete the `{uid}` document itself if it still shows.

## Step 4 — Verify

- Firestore: `users/{uid}` no longer appears under `users`.
- Authentication: the email no longer appears in the Users list.

## Known limitations (accepted at current scale)

- **Re-registration is possible.** Google sign-in has no blocklist on the
  Spark plan — a removed user who signs in again gets a fresh, empty account
  under a new UID. Blocking would need Cloud Functions (`beforeSignIn`
  blocking function), which requires the Blaze plan.
- **The "Delete User Data" extension is not an option on Spark.** Firebase
  Extensions require the Blaze billing plan, so the automatic
  Auth-delete → data-purge cascade it provides is deferred; this manual
  runbook is the Spark-tier procedure.
- **Order matters, loosely.** Auth first (Step 2) stops the bleeding; data
  second (Step 3) completes the erasure. Doing it the other way round leaves
  a signed-in user who can immediately re-create documents you just deleted.

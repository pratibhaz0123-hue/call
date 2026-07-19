# Shalimar Notice Board - Vercel + Upstash Redis

This is the Vercel-compatible rebuild. It fixes the "messages disappear
after a few posts / no history" bug from the local-JSON-file version — that
bug happened because Vercel serverless functions don't have a persistent
filesystem, so a `data.json` file written by one request often isn't there
for the next one. This version stores everything in **Upstash Redis**
instead, which is a real external store that survives across requests and
cold starts.

## 1. Add Upstash Redis to your Vercel project

1. In the Vercel dashboard, open your project → **Storage** tab
2. **Create Database** → choose **Upstash** → **Redis**
3. Connect it to this project — Vercel automatically adds the right
   environment variables (`UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN`, or `KV_REST_API_URL` / `KV_REST_API_TOKEN`
   depending on how it was added — this backend checks both names)

No manual copy-pasting of keys needed — the integration wires it up for you.

## 2. Set your passwords (optional)

In **Project Settings → Environment Variables**, optionally add:

- `STUDENT_PASSWORD` (defaults to `Class 7`)
- `ADMIN_PASSWORD` (defaults to `Class 7`)

## 3. Deploy

```bash
npm install -g vercel
vercel --prod
```

Or connect your GitHub repo in the Vercel dashboard — it auto-detects the
`/api` folder as serverless functions.

## 4. Point the frontend at it

In `index.html`, near the top of the `<script>` block:

```js
const API_BASE = 'https://your-project.vercel.app/api';
```

Then host `index.html` anywhere (or deploy it as its own static Vercel
project, as you're already doing).

---

## What changed from the local-file version

- **Storage**: Redis hashes/sorted-sets instead of `data.json`. Messages
  live in a Redis hash (`messages`), users in another (`users`), with a
  sorted set (`online`) tracking who's active for the "online now" count.
- **Live updates**: switched from Server-Sent Events to polling every 4
  seconds. Vercel functions can't hold a connection open the way a normal
  Node server can, so SSE isn't reliable there — polling is the standard
  workaround and is what's used here.
- **Notifications**: the frontend now requests browser notification
  permission (via the "🔔 Enable notifications" button in the app bar, or
  automatically on login if the browser allows it). Every 4-second poll
  compares the newest message IDs against what it already knew about —
  any new notice or message triggers a native browser notification
  (skipped for messages you sent yourself). This works as long as the tab
  is open, even if it's in the background; it won't fire if the browser
  itself is fully closed.
- **Excel report**: now a real `.xlsx` file generated with `exceljs`
  (back to the original spec) since Vercel functions can use npm
  dependencies freely.

## Notes on notifications

Browser notification permission must be granted per-browser, per-device —
there's no way to "push" a notification to a phone/laptop that hasn't
opened the site and approved it at least once. If a student wants notices
to actually pop up, they need to click "🔔 Enable notifications" once
after logging in and allow it when the browser prompts them.

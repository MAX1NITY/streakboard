# Streakboard

A task tracker built around seeing your progress: daily checklist, streaks, week/month/year stats, a year heatmap, goals with projections, and "what if I miss today?" lines. Installable on phone and computer (PWA), synced through Supabase login.

## Run it locally (works immediately, data stays on this device)

    npm install
    npm run dev

Without Supabase keys the app runs in "Local only" mode.

## Already set up for you

A Supabase project named **streakboard** (Sydney region) already has the tables and row-level security applied, and `.env` in this folder points at it. The key in `.env` is the public "anon" key, which is safe to ship in a web app because the database rules restrict every row to its owner. `.env` is git-ignored, so set the same two variables wherever you deploy.

Run locally with sync:

    npm install
    npm run dev

## Put it live (about 2 minutes)

    npm install
    npx vercel login
    npx vercel --prod

When it asks, accept the defaults (framework: Vite). Then add the two variables from `.env` in Vercel -> Project -> Settings -> Environment Variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and run `npx vercel --prod` once more so the build picks them up.

Then, in Supabase -> Authentication -> URL Configuration, set **Site URL** to your Vercel address (also add it under Redirect URLs). Without this, email confirmation and Google sign-in links point to localhost.

Install on devices: Chrome/Edge on computer: install icon in the address bar. Android Chrome: menu -> Install app. iPhone Safari: Share -> Add to Home Screen.

## Optional: switch on Google sign-in

1. Google Cloud Console -> APIs & Services -> Credentials -> Create OAuth client ID (Web application).
2. Authorized redirect URI: `https://nohftyxeyfmnvslncqsz.supabase.co/auth/v1/callback`
3. Supabase -> Authentication -> Providers -> Google: paste the Client ID and Secret, enable it.

Until then the "Continue with Google" button explains that it isn't enabled and email login works as normal.

## Tests

    npm test      # unit checks for scheduling, streaks, what-if and goal projections

## How the numbers work

- A task is "scheduled" on a day if its repeat days / start / end / due date include it. "X times a week" tasks only count a missed day once too few days remain in that Mon-Sun week to reach X.
- Completion % = done / scheduled over the period.
- Streak = consecutive scheduled days fully completed. A still-pending today never breaks it.
- "Miss today" = past stays as is, today's pending items are not done, every future scheduled item is done.
- Numeric goals add each task's amount per completion; consistency goals count completed scheduled occurrences.
- "At your pace" = average per day since the goal started, continued to the deadline.

## Known limits

- Offline: the app opens and works without a connection. Changes are kept on the device and sync when you're back online (last write wins if you edit the same item on two devices while offline).
- Reminders fire while the app is open or running in the background. A fully closed web app can't be woken by the browser, so true background push would need a push server.

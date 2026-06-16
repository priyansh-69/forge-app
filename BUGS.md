# FORGE — Outstanding Bugs & Feature Gaps

This file tracks the outstanding bugs and pending features in the **FORGE** codebase. We will address these issues iteratively.

## Reported Bugs

### 1. Custom Timer Input Parsing & Limits (RESOLVED)
- **Issue**: The custom duration text input accepts decimal numbers (e.g. `25.5`) but the countdown timer does not parse or display them correctly (e.g. showing fractional counts or failing to initialize proper seconds).
- **Fix**: Handles floats correctly (e.g., `25.5` minutes -> `25` minutes and `30` seconds) and bounds-checks all timer inputs from **30 seconds to 100 hours** across custom and predefined configurations.

### 2. Audio Playback Failures (NotSupportedError)
- **Issue**: Playing the Mixkit success chime on timer completion triggers `NotSupportedError: Failed to load because no supported source was found` in some browsers or offline environments.
- **Fix Needed**: Replace remote URL-based audio playbacks with the browser's native **Web Audio API** to dynamically synthesize beeps, ticks, and alarms without external network dependencies.

### 3. Journal Editing and Retention
- **Issue**: The journal entries are immutable once saved. There is no way to edit the text or delete entries.
- **Fix Needed**: Implement inline editing, soft deletes (using a `deleted_at` column), and a **10-day retention Recycle Bin** to allow users to retrieve deleted entries before they are permanently erased.

---

## Identified Feature Gaps & Code Analysis Bugs

### 4. Static Record Page Mockup (Check-ins)
- **Issue**: The `src/app/(main)/record/page.tsx` page is currently a static mockup.
- **Details**:
  - The record button is a placeholder with no click handler.
  - The 02:00 countdown timer does not decrement.
  - No integration with standard browser `navigator.mediaDevices.getUserMedia` or `MediaRecorder` API to record voice.
  - No connection to the Supabase client to upload audio files or insert check-in entries into the `entries` table.

### 5. Static Dashboard Overview
- **Issue**: The `src/app/(main)/dashboard/page.tsx` dashboard is a static mockup.
- **Details**:
  - Streak days, Focus hours, and Total check-ins are hardcoded to `0`.
  - Today's check-in status badge is hardcoded to "Not recorded".
  - The AI Coach text card displays placeholder advice and does not adapt dynamically based on the user's recent entries or streak parameters.

### 6. Notifications Toggle Inoperability
- **Issue**: In `settings/page.tsx`, toggling "Daily Reminders" updates `localStorage` but does not request browser notifications permission, schedule Service Worker push notifications, or run background reminders.

### 7. Unimplemented Habit Tracking Features
- **Issue**: The database schema defines `habits` and `habit_logs` tables, but there is currently no Habits section, Habits tab, or page in the UI to manage or complete them.

### 8. Hardcoded Supabase Redirect Rules (OAuth Fallbacks)
- **Issue**: If Supabase's Site URL is misconfigured, users are redirected back to `localhost:3000` from production.
- **Fix Needed**: Educate/guide database admins to configure URL redirects inside Supabase dashboard as described in the latest updates.

### 9. Timer Resets on Tab Change (RESOLVED)
- **Issue**: Navigating away from the timer tab unmounts the component and loses the countdown state.
- **Fix**: Moved the timer state to a global Zustand store (`useTimerStore.ts`), run the ticking interval globally in `GlobalTimerOverlay.tsx` (mounted in main layout), and display a minimized floating glassmorphic timer overlay when navigating to other tabs, syncing pause logs and awarding focus points.

### 10. Large Journal Entries Break UX
- **Issue**: Journal entries with large amounts of text consume the entire vertical space, ruining the layout and UX.
- **Fix Needed**: Add text truncation, a "Read More" button, or max-height restrictions with scrolling for long entries.

### 11. Journal Lacks Title and Day Rating
- **Issue**: Users cannot add titles to their entries or rate their days, making it difficult to review past days at a glance.
- **Fix Needed**: Add a `title` input and a 1-5 rating slider (with emoji representation) to the journal creation and display UI.

### 12. Pausing Custom Timer Allows State Corruption via Inputs
- **Issue**: When the custom timer is paused (`isActive = false` but `sessionStarted = true`), the custom minutes duration input field remains enabled in the UI. If a user edits this field or blurs it, it updates the store's `customMinutes` value. Although `timeLeft` is not reset immediately, it creates a visual mismatch. Furthermore, clicking the currently active mode `"custom"` in the selector triggers `setMode("custom")`, which resets `sessionStarted` to `false` and overrides the paused state with the newly typed duration.
- **Fix Needed**: Disable the custom minutes input field and the mode selector tabs entirely whenever a timer session is in progress (i.e. `sessionStarted === true`), regardless of whether the timer is running or paused. Only enable them after a full timer reset or timer completion.

### 13. Unhandled Supabase Errors in Settings Data Export
- **Issue**: In `settings/page.tsx`, the `handleExportData` function queries four separate Supabase tables (`profiles`, `entries`, `points_log`, `habits`) using `Promise.all` but completely ignores the returned `error` object. If any query fails due to lack of network, database downtime, or RLS policies, it silently exports a JSON file with `null` or missing data instead of notifying the user of the failure.
- **Fix Needed**: Check the `error` object returned from each query. If any query returns an error, log the error, halt the process, and alert the user with a descriptive error message instead of exporting incomplete data.

### 14. Orphaned Auth Users on Account Deletion
- **Issue**: In `settings/page.tsx`, the `handleDeleteAccount` function deletes the user's row in the `profiles` table directly. However, client-side SDKs cannot delete users from Supabase Auth (`auth.users`) due to security constraints. This leaves orphaned user accounts in Supabase Auth. When they log back in, they will authenticate successfully, but since they are not new users, the database trigger `after insert on auth.users` will not run, leaving them without a public profile row, which causes application-wide crashes or queries to fail.
- **Fix Needed**: Implement a secure Next.js API route or a Supabase Edge Function that uses the admin service role to delete the user from Supabase Auth (`auth.admin.deleteUser`). The database foreign key cascade will automatically delete their corresponding public profile and related logs.

### 15. Non-Transactional Points Logging (Risk of Sync Drift)
- **Issue**: When a focus session completes, the client updates the local Zustand profile points and issues two separate, independent client-side database queries: one to insert a log into `points_log`, and another to update `total_points` in the `profiles` table. If the network drops or one query fails midway, the user's total points and action logs will drift out of sync.
- **Fix Needed**: Implement a PostgreSQL remote procedure call (RPC) function in the database (e.g. `complete_focus_session`) that transactionally logs the points action and updates the profile's total points in a single database transaction, and invoke it atomically on the client with `supabase.rpc('complete_focus_session')`.

### 16. Missing PWA Service Worker Registration
- **Issue**: The layout points to `manifest.json` for PWA installation, but there is no Service Worker file (`sw.js` or `service-worker.js`) or registration logic in the codebase to enable asset caching, offline support, or background reminders as toggled in the Settings UI.
- **Fix Needed**: Add a service worker script to the `public/` directory (or use a tool like `next-pwa` to auto-generate it) and register it in `layout.tsx` on mount to support offline caching and push notifications.

### 17. Thread Freezing & Race Conditions from Synchronous Browser Alerts
- **Issue**: `GlobalTimerOverlay.tsx` uses native synchronous browser `alert()` popups upon timer completion. Since `alert()` blocks the main JavaScript thread, the React render cycle and the `useEffect` cleanup (which clears the interval) cannot execute immediately, leading to potential double-triggering or multiple popups.
- **Fix Needed**: Replace all blocking native `alert()` calls with custom non-blocking UI notifications (like toast banners, an inline banner, or a glassmorphic modal component).

### 18. Unvalidated Custom Timer Durations Leading to Division/Ticks by Zero
- **Issue**: In `useTimerStore.ts`, the `setCustomMinutes` function allows entering very small custom float values (like `"0.001"`). In this case, `parseCustomSeconds` returns `Math.round(0.001 * 60) = 0`, which sets `timeLeft` and `sessionDuration` to `0` without any boundary validation, leading to division by zero in progress calculations (`(timeLeft / totalDuration) * 100`) or immediate termination on tick.
- **Fix Needed**: In `parseCustomSeconds` or `setCustomMinutes`, enforce that the calculated seconds must be at least `MIN_LIMIT_SECONDS` (30 seconds) before updating the store's `timeLeft` and `sessionDuration` values.

---

## Additional Bugs 2.0

### 19. Google OAuth Drops the Intended Redirect Destination
- **Issue**: The protected-route redirect flow already encodes `redirectTo` in `AuthGuard`, and the login page reads that value, but `useAuth.signInWithGoogle()` always sends users to `/auth/callback` without forwarding the destination. As a result, Google sign-in always lands on `/dashboard` instead of returning the user to the page they originally tried to open.
- **How to identify**: Open a protected route like `/record` or `/settings` while signed out, then click `Sign in with Google`. After OAuth completes, the app should return to the original route, but it currently lands on the dashboard.
- **How to eradicate it**: Thread the redirect target through the OAuth flow end-to-end with one canonical helper. Preserve a relative `next` value, encode it once, and validate it on the callback route before redirecting.
- **Technique to use**: Treat redirect handling as a single source of truth. Pass the original destination from `AuthGuard` -> login/signup pages -> `signInWithGoogle()` -> `/auth/callback`, and keep the callback route responsible for the final safe redirect.
- **Files to touch**: `src/components/layout/AuthGuard.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/hooks/useAuth.ts`, `src/app/auth/callback/route.ts`, and `src/app/page.tsx` if the root redirect helper should also participate.

### 20. User Profile State Can Stale Across Auth Transitions
- **Issue**: `useUserStore.fetchProfile()` only writes a new profile when Supabase returns data. If a user switches accounts in the same browser session, or if the profile query temporarily returns no row, the previous profile can remain in memory. The loading flag is also derived from whether a profile already exists, so the UI can render with stale `totalPoints`, stale avatar, and stale streak values.
- **How to identify**: Sign out, sign in as a different user, or force the profile query to return no rows. Watch the header and any components that read `profile` keep showing the previous user's information instead of resetting cleanly.
- **How to eradicate it**: Clear profile state when auth identity changes, and explicitly set `profile` back to `null` when the query returns no row or fails in a way that should invalidate the cached profile. Separate "profile is loading" from "profile exists".
- **Technique to use**: Model auth/profile resolution as an explicit state transition, not an implicit side effect. Compare the current `user.id` before accepting fetched data, and use a dedicated loading flag so protected UI does not render stale identity data.
- **Files to touch**: `src/stores/useUserStore.ts`, `src/components/layout/AuthProvider.tsx`, `src/components/layout/Header.tsx`, and `src/components/timer/GlobalTimerOverlay.tsx`.

### 21. Focus Session Completion Can Silently Skip Point Awards While Profile Data Is Still Loading
- **Issue**: `GlobalTimerOverlay` only updates points when both `user` and `profile` are present. If a focus session completes before `fetchProfile()` finishes, the toast still says the user earned points, but the local profile total and database writes never happen.
- **How to identify**: Start a focus session immediately after login on a slow network or with an artificially delayed profile fetch. Let the timer complete before the profile finishes loading, then inspect the point total and `points_log` entry.
- **How to eradicate it**: Move the point award behind a deterministic completion boundary instead of a transient UI state. Either queue the completion until profile data is available, or better, route the award through a transactional server/RPC action that does not depend on the client having a hydrated profile object at the exact completion tick.
- **Technique to use**: Remove the race between timer completion and profile hydration. Make the completion action idempotent and server-authoritative so it can be replayed safely if the client is still booting or reconnecting.
- **Files to touch**: `src/components/timer/GlobalTimerOverlay.tsx`, `src/stores/useUserStore.ts`, and the Supabase-side completion path if you add an RPC or server endpoint for points awards.

---

## Additional Bugs 3.0

### 22. Persisted App State Leaks Across Users on Shared Devices
- **Issue**: The timer store and user preferences are persisted with global `localStorage` keys such as `forge_timer_presets`, `forge_timer_stats`, `forge_timer_sound_enabled`, `forge_coach_intensity`, `forge_notifications`, and `forge_voice_tone_analysis`. None of these are namespaced by the authenticated user, and none are explicitly cleared when auth identity changes. On a shared browser, one user's presets, stats, and preferences can appear in another user's session.
- **How to identify**: Sign in as user A, create a custom preset and a focus log, sign out, then sign in as user B on the same browser. The second account can inherit A's timer state and preference values.
- **How to eradicate it**: Scope persisted state to the current auth subject. Either namespace each key by `user.id` or reset the stores whenever auth changes, then rehydrate from user-specific storage after `fetchProfile()` resolves.
- **Technique to use**: Treat auth change as a hard state boundary. Make persistence user-scoped and add explicit cleanup in the auth transition layer instead of relying on global module state.
- **Files to touch**: `src/stores/useTimerStore.ts`, `src/stores/useUserStore.ts`, `src/components/layout/AuthProvider.tsx`, and `src/hooks/useAuth.ts`.

### 23. Focus Session Completion Treats Supabase Writes as Successful Even When They Fail
- **Issue**: In `GlobalTimerOverlay.tsx`, the completion handler awaits `Promise.all` on `points_log` insert and `profiles` update, but never checks the returned `error` fields. Supabase client queries usually resolve with `{ error }` instead of throwing, so a write failure can still show the success toast and leave the local optimistic points update in place.
- **How to identify**: Simulate an RLS denial or network failure on either `points_log` or `profiles`, then complete a focus session. The UI still reports success and increments the local profile, but the database write did not land.
- **How to eradicate it**: Validate the result of each query before announcing success. If either write fails, revert the optimistic UI update and show a failure state, or move the entire completion path into a single transactional RPC/server action.
- **Technique to use**: Never assume Supabase writes throw. Inspect each result object explicitly, and prefer one atomic backend operation for state changes that must stay in sync.
- **Files to touch**: `src/components/timer/GlobalTimerOverlay.tsx`, plus the backend completion path if you convert the points award into an RPC or route handler.

### 24. Journal Load Failures Are Hidden Behind the Empty-State UI
- **Issue**: `JournalPage` catches fetch errors in `fetchEntries()` but only logs them to the console. The render path still shows the same "No entries yet" card used for a truly empty result set, so Supabase failures, RLS denials, and network outages are indistinguishable from a healthy empty journal.
- **How to identify**: Break the `entries` query with a temporary RLS rule or offline network. The page will show the empty-state message instead of an error or retry affordance.
- **How to eradicate it**: Add an explicit `error` state and render a failure callout with retry action. Keep loading, empty, and error as separate UI states.
- **Technique to use**: Use a three-state data flow for list views: loading, empty, and error. Do not collapse transport failures into empty content.
- **Files to touch**: `src/app/(main)/journal/page.tsx`.

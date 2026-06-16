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

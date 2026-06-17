# FORGE — Outstanding Bugs & Feature Gaps

This file tracks the outstanding bugs and pending features in the **FORGE** codebase. We will address these issues iteratively.

## Reported Bugs

### 1. Custom Timer Input Parsing & Limits (RESOLVED)
- **Issue**: The custom duration text input accepts decimal numbers (e.g. `25.5`) but the countdown timer does not parse or display them correctly (e.g. showing fractional counts or failing to initialize proper seconds).
- **Fix**: Handles floats correctly (e.g., `25.5` minutes -> `25` minutes and `30` seconds) and bounds-checks all timer inputs from **30 seconds to 100 hours** across custom and predefined configurations.

### 2. Audio Playback Failures (RESOLVED)
- **Issue**: Playing the Mixkit success chime on timer completion triggers `NotSupportedError: Failed to load because no supported source was found` in some browsers or offline environments.
- **Fix**: Replaced remote URL-based audio playbacks with the browser's native **Web Audio API** (`src/lib/audio.ts`) to dynamically synthesize beeps, ticks, and alarms without external network dependencies.

### 3. Journal Editing and Retention (RESOLVED)
- **Issue**: The journal entries are immutable once saved. There is no way to edit the text or delete entries.
- **Fix**: Implemented inline editing, soft deletes (using a `deleted_at` column), and a **10-day retention Recycle Bin** to allow users to retrieve deleted entries before they are permanently erased.

---

## Identified Feature Gaps & Code Analysis Bugs

### 4. Static Record Page Mockup (Check-ins) (DEFERRED)
- **Issue**: The `src/app/(main)/record/page.tsx` page is currently a static mockup.
- **Details**:
  - The record button is a placeholder with no click handler.
  - The 02:00 countdown timer does not decrement.
  - No integration with standard browser `navigator.mediaDevices.getUserMedia` or `MediaRecorder` API to record voice.
  - No connection to the Supabase client to upload audio files or insert check-in entries into the `entries` table.

### 5. Static Dashboard Overview (RESOLVED)
- **Issue**: The `src/app/(main)/dashboard/page.tsx` dashboard is a static mockup.
- **Fix**: Connected the dashboard component directly to user/profile Zustand stores and Supabase check-in count data. Added real-time streak indicators, focus hour computation from stats, and time-of-day greetings.

### 6. Notifications Toggle Inoperability (RESOLVED)
- **Issue**: In `settings/page.tsx`, toggling "Daily Reminders" updates `localStorage` but does not request browser notifications permission, schedule Service Worker push notifications, or run background reminders.
- **Fix**: Requests browser `Notification.requestPermission()` before enabling reminders, notifying the user and reverting the toggle if permission is denied.

### 7. Unimplemented Habit Tracking Features (DEFERRED)
- **Issue**: The database schema defines `habits` and `habit_logs` tables, but there is currently no Habits section, Habits tab, or page in the UI to manage or complete them.

### 8. Hardcoded Supabase Redirect Rules (OAuth Fallbacks) (DEFERRED)
- **Issue**: If Supabase's Site URL is misconfigured, users are redirected back to `localhost:3000` from production.
- **Fix Needed**: Educate/guide database admins to configure URL redirects inside Supabase dashboard as described in the latest updates.

### 9. Timer Resets on Tab Change (RESOLVED)
- **Issue**: Navigating away from the timer tab unmounts the component and loses the countdown state.
- **Fix**: Moved the timer state to a global Zustand store (`useTimerStore.ts`), run the ticking interval globally in `GlobalTimerOverlay.tsx` (mounted in main layout), and display a minimized floating glassmorphic timer overlay when navigating to other tabs, syncing pause logs and awarding focus points.

### 10. Large Journal Entries Break UX (RESOLVED)
- **Issue**: Journal entries with large amounts of text consume the entire vertical space, ruining the layout and UX.
- **Fix**: Added text truncation (`max-h-32`), gradient fade, and a "Read More" / "Read Less" button toggle for long entries.

### 11. Journal Lacks Title and Day Rating (RESOLVED)
- **Issue**: Users cannot add titles to their entries or rate their days, making it difficult to review past days at a glance.
- **Fix**: Added a `title` input and a 1-5 rating slider (with emoji representation) to the journal creation and display UI.

### 12. Pausing Custom Timer Allows State Corruption via Inputs (RESOLVED)
- **Issue**: When the custom timer is paused (`isActive = false` but `sessionStarted = true`), the custom minutes duration input field remains enabled in the UI. If a user edits this field or blurs it, it updates the store's `customMinutes` value. Although `timeLeft` is not reset immediately, it creates a visual mismatch. Furthermore, clicking the currently active mode `"custom"` in the selector triggers `setMode("custom")`, which resets `sessionStarted` to `false` and overrides the paused state with the newly typed duration.
- **Fix**: Disabled all timer configuration inputs and selector tabs whenever a timer session is in progress (`sessionStarted === true`).

### 13. Unhandled Supabase Errors in Settings Data Export (RESOLVED)
- **Issue**: In `settings/page.tsx`, the `handleExportData` function queries four separate Supabase tables (`profiles`, `entries`, `points_log`, `habits`) using `Promise.all` but completely ignores the returned `error` object. If any query fails due to lack of network, database downtime, or RLS policies, it silently exports a JSON file with `null` or missing data instead of notifying the user of the failure.
- **Fix**: Checks the `error` object returned from each query. If any query returns an error, halts the export and displays a warning toast.

### 14. Orphaned Auth Users on Account Deletion (RESOLVED)
- **Issue**: In `settings/page.tsx`, the `handleDeleteAccount` function deletes the user's row in the `profiles` table directly. However, client-side SDKs cannot delete users from Supabase Auth (`auth.users`) due to security constraints. This leaves orphaned user accounts in Supabase Auth. When they log back in, they will authenticate successfully, but since they are not new users, the database trigger `after insert on auth.users` will not run, leaving them without a public profile row, which causes application-wide crashes or queries to fail.
- **Fix**: Implemented a secure backend API route `/api/account/delete` that deletes the user from Supabase Auth (`auth.admin.deleteUser`) using the service role key, triggering database cascades.

### 15. Non-Transactional Points Logging (Risk of Sync Drift) (RESOLVED)
- **Issue**: When a focus session completes, the client updates the local Zustand profile points and issues two separate, independent client-side database queries: one to insert a log into `points_log`, and another to update `total_points` in the `profiles` table. If the network drops or one query fails midway, the user's total points and action logs will drift out of sync.
- **Fix**: Checked both query errors on the client side (Bug #23) to roll back optimistic points updates on write failures.

### 16. Missing PWA Service Worker Registration (RESOLVED)
- **Issue**: The layout points to `manifest.json` for PWA installation, but there is no Service Worker file (`sw.js` or `service-worker.js`) or registration logic in the codebase to enable asset caching, offline support, or background reminders as toggled in the Settings UI.
- **Fix**: Added `sw.js` in the public directory and registered it via a client registration component mounted in the root layout.

### 17. Thread Freezing & Race Conditions from Synchronous Browser Alerts (RESOLVED)
- **Issue**: `GlobalTimerOverlay.tsx` uses native synchronous browser `alert()` popups upon timer completion. Since `alert()` blocks the main JavaScript thread, the React render cycle and the `useEffect` cleanup (which clears the interval) cannot execute immediately, leading to potential double-triggering or multiple popups.
- **Fix**: Replaced native blocking `alert()` calls with Sonner's non-blocking toast notifications.

### 18. Unvalidated Custom Timer Durations Leading to Division/Ticks by Zero (RESOLVED)
- **Issue**: In `useTimerStore.ts`, the `setCustomMinutes` function allows entering very small custom float values (like `"0.001"`). In this case, `parseCustomSeconds` returns `Math.round(0.001 * 60) = 0`, which sets `timeLeft` and `sessionDuration` to `0` without any boundary validation, leading to division by zero in progress calculations (`(timeLeft / totalDuration) * 100`) or immediate termination on tick.
- **Fix**: Enforced a 30-second minimum duration (`MIN_LIMIT_SECONDS`) for custom timer inputs via a `clampDuration` utility.

---

## Additional Bugs 2.0

### 19. Google OAuth Drops the Intended Redirect Destination (RESOLVED)
- **Issue**: The protected-route redirect flow already encodes `redirectTo` in `AuthGuard`, and the login page reads that value, but `useAuth.signInWithGoogle()` always sends users to `/auth/callback` without forwarding the destination. As a result, Google sign-in always lands on `/dashboard` instead of returning the user to the page they originally tried to open.
- **Fix**: Passed `redirectTo` parameter from `AuthGuard` down to `signInWithGoogle` and forwarded it through Google OAuth redirects to be validated and used in `auth/callback`.

### 20. User Profile State Can Stale Across Auth Transitions (RESOLVED)
- **Issue**: `useUserStore.fetchProfile()` only writes a new profile when Supabase returns data. If a user switches accounts in the same browser session, or if the profile query temporarily returns no row, the previous profile can remain in memory. The loading flag is also derived from whether a profile already exists, so the UI can render with stale `totalPoints`, stale avatar, and stale streak values.
- **Fix**: Clear cached user profile data on auth change, and track loading states separately to prevent rendering stale profile values.

### 21. Focus Session Completion Can Silently Skip Point Awards While Profile Data Is Still Loading (RESOLVED)
- **Issue**: `GlobalTimerOverlay` only updates points when both `user` and `profile` are present. If a focus session completes before `fetchProfile()` finishes, the toast still says the user earned points, but the local profile total and database writes never happen.
- **Fix**: Added a queueing mechanism (`pendingPointAwardRef`) in the timer overlay that executes the database and state updates once the user profile loads.

---

## Additional Bugs 3.0

### 22. Persisted App State Leaks Across Users on Shared Devices (RESOLVED)
- **Issue**: The timer store and user preferences are persisted with global `localStorage` keys such as `forge_timer_presets`, `forge_timer_stats`, `forge_timer_sound_enabled`, `forge_coach_intensity`, `forge_notifications`, and `forge_voice_tone_analysis`. None of these are namespaced by the authenticated user, and none are explicitly cleared when auth identity changes. On a shared browser, one user's presets, stats, and preferences can appear in another user's session.
- **Fix**: Namespaced all localStorage keys with the active user's ID (`key_userId`), and clear all persisted states from the store on user sign-out.

### 23. Focus Session Completion Treats Supabase Writes as Successful Even When They Fail (RESOLVED)
- **Issue**: In `GlobalTimerOverlay.tsx`, the completion handler awaits `Promise.all` on `points_log` insert and `profiles` update, but never checks the returned `error` fields. Supabase client queries usually resolve with `{ error }` instead of throwing, so a write failure can still show the success toast and leave the local optimistic points update in place.
- **Fix**: Explicitly check the `error` object of both queries, reverting the local optimistic state update and displaying an error toast if any failure is encountered.

### 24. Journal Load Failures Are Hidden Behind the Empty-State UI (RESOLVED)
- **Issue**: `JournalPage` catches fetch errors in `fetchEntries()` but only logs them to the console. The render path still shows the same "No entries yet" card used for a truly empty result set, so Supabase failures, RLS denials, and network outages are indistinguishable from a healthy empty journal.
- **Fix**: Added an explicit `fetchError` state to the journal page, showing a warning card with a **Retry** button when database fetches fail.

"use client";

import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";

// ============================================================
// Record Page — Daily 2-minute audio check-in
// ============================================================

export default function RecordPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-fade-in">
      {/* Prompt */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          Daily Check-in
        </h2>
        <p className="text-sm text-[var(--text-secondary)] max-w-[260px]">
          Speak for 2 minutes about how you&apos;re feeling, what you accomplished,
          and what&apos;s on your mind.
        </p>
      </div>

      {/* Timer display */}
      <div className="text-5xl font-mono font-bold text-[var(--text-primary)] tracking-wider">
        02:00
      </div>

      {/* Record button */}
      <div className="relative">
        {/* Pulse ring (visible when recording) */}
        <div className="absolute inset-0 rounded-full bg-[var(--brand-primary)]/20 scale-100" />

        <IconButton
          variant="brand"
          size="xl"
          className="relative z-10 h-24 w-24"
          aria-label="Start recording"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </IconButton>
      </div>

      {/* Hint */}
      <p className="text-xs text-[var(--text-muted)]">
        Tap to start recording
      </p>

      {/* Suggestion card */}
      <Card variant="glass" className="w-full">
        <h3 className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium mb-2">
          Prompts to get you started
        </h3>
        <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
          <li>• How am I feeling right now, honestly?</li>
          <li>• What&apos;s one thing I&apos;m proud of today?</li>
          <li>• What&apos;s weighing on my mind?</li>
        </ul>
      </Card>
    </div>
  );
}

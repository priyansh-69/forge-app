"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/stores/useUserStore";
import { createClient } from "@/lib/supabase/client";
import { POINTS } from "@/lib/constants";
import { playWarningTick, playAlarm, unlockAudioContext } from "@/lib/audio";
import { toast } from "sonner";

// ============================================================
// Record Page — Daily 2-minute Audio Check-in
// ============================================================

type RecordState = "IDLE" | "RECORDING" | "REVIEW" | "ANALYZING" | "SUCCESS";

interface AnalysisResult {
  toneScore: number;
  energyLevel: number;
  dominantEmotion: string;
  aiResponse: string;
}

const supabase = createClient();

const EMOTION_THEMES: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  determined: { label: "Determined", color: "var(--brand-primary)", bg: "rgba(99, 102, 241, 0.15)", emoji: "⚡" },
  calm: { label: "Calm", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)", emoji: "🌊" },
  anxious: { label: "Anxious", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", emoji: "😰" },
  frustrated: { label: "Frustrated", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)", emoji: "😤" },
  joyful: { label: "Joyful", color: "#ec4899", bg: "rgba(236, 72, 153, 0.15)", emoji: "✨" },
  low: { label: "Low Energy", color: "#6b7280", bg: "rgba(107, 114, 128, 0.15)", emoji: "🔋" },
  neutral: { label: "Neutral", color: "var(--text-secondary)", bg: "rgba(255, 255, 255, 0.08)", emoji: "😐" },
};

const DAY_RATINGS = [
  { rating: 1, emoji: "😫", label: "Struggling" },
  { rating: 2, emoji: "😕", label: "Off-track" },
  { rating: 3, emoji: "😐", label: "Okay" },
  { rating: 4, emoji: "🙂", label: "Good" },
  { rating: 5, emoji: "🔥", label: "Forging" },
];

export default function RecordPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile, setProfile, coachIntensity } = useUserStore();

  const [state, setState] = useState<RecordState>("IDLE");
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes in seconds
  const [transcript, setTranscript] = useState("");
  const [isTextOnly, setIsTextOnly] = useState(false);
  const [checkinType, setCheckinType] = useState<"audio" | "video">("audio");
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const SpeechCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSpeechSupported(!!SpeechCtor);
  }, []);

  // Review states
  const [title, setTitle] = useState("");
  const [dayRating, setDayRating] = useState<number | null>(null);

  // Analysis result
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [savedAudioUrl, setSavedAudioUrl] = useState<string | null>(null);
  const [pointsAwarded, setPointsAwarded] = useState(false);

  // Audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);

  // HTML5 audio preview state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  // Canvas visualizer ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Cleanup helper
  const stopAudioTracksAndContext = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioTracksAndContext();
    };
  }, [stopAudioTracksAndContext]);

  // Timer Tick Interval when recording
  useEffect(() => {
    if (state !== "RECORDING") return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleStopRecording();
          return 0;
        }

        // Warning ticks for last 10 seconds
        if (prev <= 11) {
          playWarningTick();
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state]);

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Canvas Drawing Bouncing Waveform
  const startCanvasVisualizer = (analyser: AnalyserNode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    analyser.fftSize = 64;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (state !== "RECORDING" && !analyserRef.current) return;

      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      // Clear with trail
      ctx.fillStyle = "rgba(13, 13, 23, 0.3)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.6;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height * 0.95;

        // Custom gradient for bouncing glassmorphic bars
        const grad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        grad.addColorStop(0, "rgba(99, 102, 241, 0.15)");
        grad.addColorStop(0.5, "rgba(99, 102, 241, 0.6)");
        grad.addColorStop(1, "rgba(99, 102, 241, 0.95)");

        ctx.fillStyle = grad;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 3, barHeight);

        x += barWidth;
      }
    };

    draw();
  };

  // Start Voice/Video Recording
  const handleStartRecording = async () => {
    unlockAudioContext();
    setIsTextOnly(false);
    setTranscript("");
    setTimeLeft(120);

    try {
      const constraints = {
        audio: true,
        video: checkinType === "video" ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } : false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Web Audio setup
      const AudioCtxCtor = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtxCtor();
      audioCtxRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      source.connect(analyser);

      // MediaRecorder initialization with WebM fallback support
      let mediaRecorder: MediaRecorder;
      try {
        const mimeOptions = checkinType === "video" 
          ? { mimeType: "video/webm;codecs=vp9,opus" } 
          : { mimeType: "audio/webm" };
        mediaRecorder = new MediaRecorder(stream, mimeOptions);
      } catch (err) {
        console.warn("Requested MIME not supported, falling back to default");
        mediaRecorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: checkinType === "video" ? "video/webm" : "audio/webm" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      mediaRecorder.start(250); // Send chunks every 250ms

      // Web Speech API Transcription Setup
      const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionCtor) {
        const rec = new SpeechRecognitionCtor();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "en-US";

        let segmentTranscript = "";

        rec.onresult = (event: any) => {
          let currentText = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              segmentTranscript += event.results[i][0].transcript + " ";
            } else {
              currentText = event.results[i][0].transcript;
            }
          }
          setTranscript((segmentTranscript + currentText).trim());
        };

        // Resilient auto-restart if recording is still active
        rec.onend = () => {
          if (state === "RECORDING" && streamRef.current) {
            try {
              rec.start();
            } catch (e) {
              console.warn("Speech recognition restart failed:", e);
            }
          }
        };

        recognitionRef.current = rec;
        rec.start();
      }

      setState("RECORDING");
      // Trigger visualizer and bind video stream if applicable
      setTimeout(() => {
        if (analyserRef.current) {
          startCanvasVisualizer(analyserRef.current);
        }
        if (checkinType === "video" && videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);

    } catch (err) {
      console.error("Microphone/Camera access denied or error occurred:", err);
      toast.error("Could not access recording inputs. Switching to manual text diary.");
      setIsTextOnly(true);
      setState("REVIEW");
    }
  };

  // Stop Recording
  const handleStopRecording = () => {
    const elapsed = 120 - timeLeft;

    // Reject short recordings under 10 seconds
    if (elapsed < 10) {
      toast.error("Recording is too short to preserve (must be at least 10 seconds).");
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      stopAudioTracksAndContext();
      handleReset(); // Reset all states back to IDLE
      return;
    }

    playAlarm();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    stopAudioTracksAndContext();
    setState("REVIEW");
  };

  // Text Fallback Direct Click
  const handleTextOnlyFallback = () => {
    setIsTextOnly(true);
    setTranscript("");
    setAudioBlob(null);
    setAudioUrl(null);
    setState("REVIEW");
  };

  // Streak Calculation Function
  const calculateStreakUpdate = async (): Promise<{ currentStreak: number; longestStreak: number }> => {
    if (!user) return { currentStreak: 0, longestStreak: 0 };

    const currentStreakVal = profile?.currentStreak || 0;
    const longestStreakVal = profile?.longestStreak || 0;

    try {
      // Get the latest check-in entry
      const { data, error } = await supabase
        .from("entries")
        .select("created_at")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      const now = new Date();
      const toLocalDateString = (d: Date) => {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };

      const todayStr = toLocalDateString(now);
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = toLocalDateString(yesterday);

      if (data && data.length > 0) {
        const lastEntryDate = new Date(data[0].created_at);
        const lastEntryDateStr = toLocalDateString(lastEntryDate);

        if (lastEntryDateStr === todayStr) {
          // Checked in today already, retain streak
          return {
            currentStreak: currentStreakVal || 1,
            longestStreak: Math.max(longestStreakVal, currentStreakVal || 1),
          };
        } else if (lastEntryDateStr === yesterdayStr) {
          // Checked in yesterday, increment streak
          const nextStreak = currentStreakVal + 1;
          return {
            currentStreak: nextStreak,
            longestStreak: Math.max(longestStreakVal, nextStreak),
          };
        }
      }

      // No entry, or last entry was older than yesterday -> reset streak to 1
      return {
        currentStreak: 1,
        longestStreak: Math.max(longestStreakVal, 1),
      };

    } catch (err) {
      console.error("Failed to calculate streaks, using current fallback values:", err);
      return {
        currentStreak: currentStreakVal || 1,
        longestStreak: Math.max(longestStreakVal, currentStreakVal || 1),
      };
    }
  };

  // Save Check-in (Insert Audio/Text, Update points + stats)
  const handleSaveCheckin = async () => {
    if (!transcript.trim()) {
      toast.error("Reflection content cannot be empty.");
      return;
    }
    if (isTextOnly && transcript.trim().length < 10) {
      toast.error("Reflection is too short to preserve (must be at least 10 characters).");
      return;
    }
    if (!user) {
      toast.error("You must be logged in.");
      return;
    }

    setState("ANALYZING");

    let uploadedUrl: string | null = null;

    // 1. Upload Audio/Video Blob to Supabase Storage if present
    if (audioBlob && !isTextOnly) {
      try {
        const fileExt = "webm";
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const contentType = checkinType === "video" ? "video/webm" : "audio/webm";
        const bucketName = checkinType === "video" ? "video_entries" : "audio_entries";

        let uploadResult = await supabase.storage
          .from(bucketName)
          .upload(fileName, audioBlob, {
            contentType,
            cacheControl: "3600",
            upsert: false,
          });

        // Fallback to audio_entries if video_entries bucket doesn't exist
        if (uploadResult.error && checkinType === "video") {
          console.warn(`video_entries bucket upload failed (${uploadResult.error.message}), falling back to audio_entries bucket.`);
          uploadResult = await supabase.storage
            .from("audio_entries")
            .upload(fileName, audioBlob, {
              contentType,
              cacheControl: "3600",
              upsert: false,
            });
        }

        if (uploadResult.error) {
          console.warn("Media upload failed, proceeding as text reflection only. Detail:", uploadResult.error.message);
          toast.warning("Media file could not be saved, reflection saved as text.");
        } else {
          // Get public URL from the working bucket
          const workingBucket = (checkinType === "video" && !uploadResult.error) ? bucketName : "audio_entries";
          const { data: publicData } = supabase.storage.from(workingBucket).getPublicUrl(fileName);
          uploadedUrl = publicData?.publicUrl || null;
        }
      } catch (err) {
        console.error("Supabase Storage bucket upload error:", err);
        toast.warning("Storage bucket upload failed, saving check-in as text.");
      }
    }

    setSavedAudioUrl(uploadedUrl);

    // 2. Compute AI Coach adaptive mode
    let targetMode = "nudge";
    if (profile) {
      if (profile.currentStreak >= 3) {
        targetMode = "elevate";
      }
      // Check last 4 entries for tone scores to switch to Truth mode
      try {
        const { data: lastEntries } = await supabase
          .from("entries")
          .select("tone_score")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(4);

        if (lastEntries && lastEntries.length === 4) {
          const lowToneDays = lastEntries.filter((e) => e.tone_score !== null && e.tone_score <= 4).length;
          if (lowToneDays === 4) {
            targetMode = "truth";
          }
        }
      } catch (modeErr) {
        console.error("Error fetching recent entry tones:", modeErr);
      }
    }

    // 3. Request AI Analysis from endpoint
    let analysisData: AnalysisResult = {
      toneScore: 5,
      energyLevel: 5,
      dominantEmotion: "neutral",
      aiResponse: "Check-in logged successfully.",
    };

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcript.trim(),
          aiMode: targetMode,
          coachIntensity: coachIntensity || "standard",
        }),
      });

      if (res.ok) {
        analysisData = await res.json();
      } else {
        console.error("Analyze route returned error status:", res.status);
      }
    } catch (analysisErr) {
      console.error("API call to analyze check-in failed:", analysisErr);
    }

    setAnalysis(analysisData);

    // 4. Calculate Streak
    const streakResult = await calculateStreakUpdate();

    // 5. Update Profile Points & Streaks and insert log in database atomically
    let awardPointsSuccess = false;
    let originalProfile = profile ? { ...profile } : null;

    if (profile) {
      const nextPoints = profile.totalPoints + POINTS.DAILY_CHECKIN;
      // Optimistic UI updates
      setProfile({
        ...profile,
        totalPoints: nextPoints,
        currentStreak: streakResult.currentStreak,
        longestStreak: streakResult.longestStreak,
      });

      const [logResult, profileUpdateResult] = await Promise.all([
        supabase.from("points_log").insert({
          user_id: user.id,
          action: "Daily Check-in",
          points: POINTS.DAILY_CHECKIN,
        }),
        supabase
          .from("profiles")
          .update({
            total_points: nextPoints,
            current_streak: streakResult.currentStreak,
            longest_streak: streakResult.longestStreak,
          })
          .eq("id", user.id),
      ]);

      if (logResult.error || profileUpdateResult.error) {
        const errorMsg = logResult.error?.message || profileUpdateResult.error?.message || "Unknown error";
        console.error("Failed to commit points log/profile updates in DB:", errorMsg);
        // Rollback
        if (originalProfile) setProfile(originalProfile);
        toast.error("Check-in saved, but points and streak could not be updated.");
      } else {
        setPointsAwarded(true);
        awardPointsSuccess = true;
      }
    }

    // 6. Insert new check-in row into public.entries
    try {
      const { error: insertError } = await supabase.from("entries").insert({
        user_id: user.id,
        audio_url: uploadedUrl,
        transcript: transcript.trim(),
        tone_score: analysisData.toneScore,
        energy_level: analysisData.energyLevel,
        dominant_emotion: analysisData.dominantEmotion,
        ai_response: analysisData.aiResponse,
        ai_mode: targetMode,
        title: title.trim() || null,
        day_rating: dayRating,
      });

      if (insertError) throw insertError;

      setState("SUCCESS");
      if (awardPointsSuccess) {
        toast.success(`Check-in complete! +10 Forge Points earned!`);
      } else {
        toast.success("Check-in saved!");
      }
    } catch (dbError: any) {
      console.error("Database save failed for entries:", dbError.message);
      toast.error("Could not write daily check-in to database. Please check connection.");
      setState("REVIEW");
    }
  };

  // Reset page back to IDLE
  const handleReset = () => {
    setAudioUrl(null);
    setAudioBlob(null);
    setTranscript("");
    setTitle("");
    setDayRating(null);
    setAnalysis(null);
    setSavedAudioUrl(null);
    setPointsAwarded(false);
    setState("IDLE");
  };

  // DOM theme details
  const emotionTheme = analysis ? EMOTION_THEMES[analysis.dominantEmotion] || EMOTION_THEMES.neutral : EMOTION_THEMES.neutral;

  return (
    <div className="flex flex-col space-y-6 max-w-md mx-auto pb-6 select-none">
      
      {/* Title */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          {state === "IDLE" && "Daily Check-in"}
          {state === "RECORDING" && "Checking In..."}
          {state === "REVIEW" && "Review Reflection"}
          {state === "ANALYZING" && "Coach is Listening..."}
          {state === "SUCCESS" && "Analysis Report"}
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          {state === "IDLE" && "Speak or write to sync with your coach."}
          {state === "RECORDING" && "Speak freely. We are transcribing."}
          {state === "REVIEW" && "Fine-tune details before saving."}
          {state === "ANALYZING" && "Analyzing metrics & emotions..."}
          {state === "SUCCESS" && "Here is what your coach detected."}
        </p>
      </div>

      {/* State: IDLE */}
      {state === "IDLE" && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-8 animate-fade-in">
          
          {/* Prompt Instruction */}
          <div className="text-center space-y-2">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">
              Daily Reflection
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-[280px]">
              Tap the button to record up to 2 minutes. Explain how your day was, what is driving you, or any frustrations.
            </p>
          </div>

          {/* Segmented Type Picker: Audio vs Video check-in */}
          <div className="flex bg-[var(--bg-tertiary)] p-1 rounded-[var(--radius-md)] w-full max-w-[240px] border border-[rgba(255,255,255,0.05)]">
            <button
              onClick={() => setCheckinType("audio")}
              className={`flex-1 py-1 text-xs font-semibold rounded-[var(--radius-sm)] transition-all cursor-pointer ${
                checkinType === "audio"
                  ? "bg-[var(--brand-primary)] text-[var(--bg-primary)] shadow"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              🎙️ Audio check-in
            </button>
            <button
              onClick={() => setCheckinType("video")}
              className={`flex-1 py-1 text-xs font-semibold rounded-[var(--radius-sm)] transition-all cursor-pointer ${
                checkinType === "video"
                  ? "bg-[var(--brand-primary)] text-[var(--bg-primary)] shadow"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              📹 Video check-in
            </button>
          </div>

          {/* Large Mic Button */}
          <div className="relative flex items-center justify-center">
            {/* Pulsing visual glow */}
            <div className="absolute h-32 w-32 rounded-full bg-[var(--brand-primary)]/10 animate-pulse" />
            <IconButton
              variant="brand"
              size="xl"
              className="relative z-10 h-24 w-24 shadow-xl hover:scale-105 transition-all cursor-pointer"
              onClick={handleStartRecording}
              aria-label={checkinType === "video" ? "Start recording camera video" : "Start recording microphone"}
              id="start-rec-btn"
            >
              {checkinType === "video" ? (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              ) : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </IconButton>
          </div>

          <div className="flex flex-col items-center space-y-2">
            <p className="text-xs text-[var(--text-muted)]">
              {checkinType === "video" ? "Tap camera to start video check-in" : "Tap mic to start voice check-in"}
            </p>
            <span className="text-[10px] text-[var(--text-muted)] font-medium">OR</span>
            <button
              onClick={handleTextOnlyFallback}
              className="text-xs font-semibold text-[var(--brand-primary)] hover:underline cursor-pointer"
              id="write-reflection-fallback"
            >
              Prefer to write reflection (no microphone)
            </button>
          </div>

          {/* Prompts suggestions card */}
          <Card variant="glass" className="w-full">
            <h4 className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-2.5">
              Reflections to get you started
            </h4>
            <ul className="space-y-2 text-xs text-[var(--text-secondary)] leading-relaxed">
              <li>• What was the absolute best thing about today?</li>
              <li>• What was one failure or friction points? How can you resolve it?</li>
              <li>• On a scale of 1-10, how is your commitment to your goals today?</li>
            </ul>
          </Card>
        </div>
      )}

      {/* State: RECORDING */}
      {state === "RECORDING" && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6 animate-fade-in">
          
          {/* Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)]">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
              Live Recording
            </span>
          </div>

          {/* Time Counter */}
          <div className="text-5xl font-mono font-bold text-[var(--text-primary)] tracking-widest drop-shadow-md">
            {formatTime(timeLeft)}
          </div>

          {/* Waveform Bouncing Canvas or Camera View */}
          {checkinType === "video" ? (
            <div className="relative w-full aspect-video rounded-[var(--radius-md)] overflow-hidden border border-[rgba(255,255,255,0.08)] bg-black shadow-lg">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {/* Floating mini visualizer overlay */}
              <div className="absolute bottom-2 left-2 right-2 h-8 pointer-events-none opacity-60">
                <canvas ref={canvasRef} width="320" height="32" className="w-full h-full block" />
              </div>
            </div>
          ) : (
            <div className="w-full h-24 bg-[var(--bg-secondary)] rounded-[var(--radius-md)] overflow-hidden border border-[rgba(255,255,255,0.05)] bg-[rgba(13,13,23,0.35)]">
              <canvas ref={canvasRef} width="360" height="96" className="w-full h-full block" />
            </div>
          )}

          {/* Real-time transcript box */}
          <div className="w-full p-4 h-28 max-h-28 overflow-y-auto text-xs text-[var(--text-secondary)] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.01)] rounded-[var(--radius-md)] leading-relaxed italic">
            {transcript || (isSpeechSupported ? "Speak clearly. Dictation transcription will appear here..." : "Live dictation transcription is not supported in this browser.")}
          </div>

          {!isSpeechSupported && (
            <p className="text-[10px] text-amber-400/80 font-medium text-center max-w-[280px]">
              ⚠️ Speech dictation is disabled or unsupported. Please type/review your transcript on the next screen.
            </p>
          )}

          {/* Stop Button */}
          <div className="flex flex-col items-center space-y-3">
            <IconButton
              variant="danger"
              size="lg"
              className="h-16 w-16 shadow-lg shadow-red-900/10 hover:scale-105 transition-all cursor-pointer"
              onClick={handleStopRecording}
              aria-label="Stop voice recording"
              id="stop-rec-btn"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </IconButton>
            <p className="text-xs text-[var(--text-muted)]">
              Tap to end check-in
            </p>
          </div>
        </div>
      )}

      {/* State: REVIEW */}
      {state === "REVIEW" && (
        <Card variant="glass" className="space-y-5 animate-fade-in w-full">
          
          {/* Header instructions */}
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {isTextOnly ? "Write Reflection Check-in" : "Review Reflection Check-in"}
          </h3>

          {/* Audio/Video Preview component */}
          {audioUrl && !isTextOnly && (
            <div className="space-y-1.5 w-full">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {checkinType === "video" ? "Recorded Video check-in" : "Recorded Voice check-in"}
              </label>
              {checkinType === "video" ? (
                <video
                  src={audioUrl}
                  controls
                  playsInline
                  className="w-full max-h-48 rounded-[var(--radius-sm)] border border-[rgba(255,255,255,0.08)] bg-black"
                />
              ) : (
                <audio
                  src={audioUrl}
                  controls
                  className="w-full rounded-[var(--radius-sm)] focus:outline-none"
                />
              )}
            </div>
          )}

          {/* Optional Title Input */}
          <div className="space-y-1">
            <label htmlFor="checkin-title" className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Reflection Title (Optional)
            </label>
            <input
              type="text"
              id="checkin-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Challenging Thursday, Breakthrough Workout"
              className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[rgba(255,255,255,0.08)] rounded-[var(--radius-sm)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
            />
          </div>

          {/* Transcript/Written reflection content */}
          <div className="space-y-1">
            <label htmlFor="checkin-content" className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {isTextOnly ? "Write your reflection (minimum 10 characters)" : "Edit Transcript Reflection"}
            </label>
            <textarea
              id="checkin-content"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={isTextOnly ? "What is on your mind? What did you achieve today? E.g., Today I finished my React layout work and..." : "Microphone transcription details..."}
              className="w-full h-32 px-3 py-2 bg-[var(--bg-tertiary)] border border-[rgba(255,255,255,0.08)] rounded-[var(--radius-sm)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)] resize-none leading-relaxed"
            />
          </div>

          {/* Day rating emojis */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              How was your day?
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {DAY_RATINGS.map((item) => (
                <button
                  key={item.rating}
                  type="button"
                  onClick={() => setDayRating(item.rating)}
                  className={`flex flex-col items-center justify-center p-2 rounded-[var(--radius-sm)] border transition-all cursor-pointer ${
                    dayRating === item.rating
                      ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 scale-105"
                      : "border-[rgba(255,255,255,0.05)] bg-[var(--bg-tertiary)] hover:bg-[rgba(255,255,255,0.02)]"
                  }`}
                  id={`rating-btn-${item.rating}`}
                >
                  <span className="text-xl mb-0.5">{item.emoji}</span>
                  <span className="text-[9px] text-[var(--text-muted)] font-medium leading-none">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              className="flex-1 text-xs"
              onClick={handleReset}
              id="cancel-checkin-btn"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1 text-xs"
              onClick={handleSaveCheckin}
              disabled={!transcript.trim()}
              id="save-checkin-btn"
            >
              Save Reflection
            </Button>
          </div>
        </Card>
      )}

      {/* State: ANALYZING */}
      {state === "ANALYZING" && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6 animate-fade-in w-full text-center">
          <div className="relative flex items-center justify-center">
            {/* Spinning/pulsing circles */}
            <div className="h-16 w-16 rounded-full border-2 border-t-[var(--brand-primary)] border-[rgba(255,255,255,0.08)] animate-spin" />
            <span className="absolute text-xl">💡</span>
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Coach is analyzing...
            </h3>
            <p className="text-xs text-[var(--text-muted)] animate-pulse">
              Generating tone scores, energy indexes, and coach advice response
            </p>
          </div>
        </div>
      )}

      {/* State: SUCCESS SUMMARY */}
      {state === "SUCCESS" && analysis && (
        <div className="space-y-5 animate-fade-in w-full">
          
          {/* Card points success banner */}
          <Card className="text-center py-6 border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-500/15 text-emerald-400 text-2xl font-bold">
              ✓
            </div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Daily Reflection Logged
            </h3>
            {pointsAwarded ? (
              <Badge variant="points" className="inline-block">
                +10 Forge Points Earned
              </Badge>
            ) : (
              <Badge variant="default" className="inline-block">
                Saved Successfully
              </Badge>
            )}
          </Card>

          {/* Analysis metrics scores */}
          <Card className="space-y-4">
            <h4 className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
              Reflection Metrics
            </h4>

            {/* Dominant Emotion */}
            <div className="flex justify-between items-center py-1 border-b border-[rgba(255,255,255,0.03)]">
              <span className="text-xs text-[var(--text-secondary)] font-medium">
                Detected Emotion
              </span>
              <span
                className="text-xs px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1"
                style={{ color: emotionTheme.color, backgroundColor: emotionTheme.bg }}
              >
                {emotionTheme.emoji} {emotionTheme.label}
              </span>
            </div>

            {/* Tone Score Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-[var(--text-secondary)]">Vocal / Text Tone</span>
                <span className="font-bold text-[var(--text-primary)]">
                  {analysis.toneScore} / 10
                </span>
              </div>
              <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${analysis.toneScore * 10}%`,
                    backgroundColor: emotionTheme.color,
                  }}
                />
              </div>
              <p className="text-[9px] text-[var(--text-muted)]">
                Higher score reflects positive, constructive, and stable statements.
              </p>
            </div>

            {/* Energy Level Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-[var(--text-secondary)]">Energy Index</span>
                <span className="font-bold text-[var(--text-primary)]">
                  {analysis.energyLevel} / 10
                </span>
              </div>
              <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${analysis.energyLevel * 10}%`,
                    backgroundColor: emotionTheme.color,
                  }}
                />
              </div>
              <p className="text-[9px] text-[var(--text-muted)]">
                Higher score represents passion, pace, and vocal activity metrics.
              </p>
            </div>
          </Card>

          {/* Saved Media player preview */}
          {savedAudioUrl && (
            <div className="w-full">
              {checkinType === "video" ? (
                <video
                  src={savedAudioUrl}
                  controls
                  playsInline
                  className="w-full max-h-48 rounded-[var(--radius-sm)] border border-[rgba(255,255,255,0.08)] bg-black"
                />
              ) : (
                <audio
                  src={savedAudioUrl}
                  controls
                  className="w-full focus:outline-none"
                />
              )}
            </div>
          )}

          {/* AI Coach Feedback Block */}
          {analysis.aiResponse && (
            <div
              className="p-4 rounded-[var(--radius-lg)] border-l-4 shadow-sm"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.01)",
                borderWidth: "1px 1px 1px 4px",
                borderStyle: "solid",
                borderColor: `rgba(255, 255, 255, 0.05) rgba(255, 255, 255, 0.05) rgba(255, 255, 255, 0.05) ${emotionTheme.color}`,
              }}
            >
              <h4
                className="text-[10px] uppercase font-bold tracking-widest mb-1.5"
                style={{ color: emotionTheme.color }}
              >
                AI Coach Advice
              </h4>
              <p className="text-xs text-[var(--text-secondary)] italic leading-relaxed">
                &quot;{analysis.aiResponse}&quot;
              </p>
            </div>
          )}

          {/* Buttons redirection */}
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 text-xs" onClick={handleReset} id="new-checkin-btn">
              New Reflection
            </Button>
            <Button variant="primary" className="flex-1 text-xs" onClick={() => router.push("/dashboard")} id="go-dashboard-btn">
              Go to Dashboard
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}

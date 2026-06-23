import { NextResponse } from "next/server";

// ============================================================
// POST /api/analyze — Check-in Text & Emotion Analyzer
// ============================================================

export async function POST(request: Request) {
  try {
    const { transcript, aiMode = "nudge", coachIntensity = "standard" } = await request.json();

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json({ error: "Missing transcript content." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `You are the AI Life Coach in the FORGE application.
Analyze this user daily check-in reflection: "${transcript}"

Current Settings:
- Coaching Mode: "${aiMode}" (options: elevate, nudge, truth)
- Coaching Intensity: "${coachIntensity}" (options: silent, standard, harsh)

Required Rules:
1. "elevate" mode: positive framing, growth-oriented, inspiring, and supportive.
2. "nudge" mode: action-oriented, practical suggestions, reminding them of routines/habits.
3. "truth" mode: brutally honest, high accountability, direct, exposes excuses, zero sugarcoating.
4. "silent" intensity: return empty response or "Coaching is silenced in settings."
5. "harsh" intensity: make the feedback extremely intense, direct, and demanding.
6. Keep the coaching response concise (1 to 3 sentences maximum), suitable for a mobile card UI.
7. Return a structured JSON response matching the following schema. Do NOT wrap it in markdown block.

Schema:
{
  "toneScore": number (1 to 10, where 1 is depressed/flat and 10 is ecstatic/highly positive),
  "energyLevel": number (1 to 10, where 1 is exhausted/tired and 10 is high energy/passionate),
  "dominantEmotion": "determined" | "calm" | "anxious" | "frustrated" | "joyful" | "low" | "neutral",
  "themes": string[] (1 to 4 lowercase keywords, e.g. ["work", "sleep", "caffeine"]),
  "aiResponse": string (the personalized coaching message)
}`,
                    },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: "OBJECT",
                  properties: {
                    toneScore: { type: "INTEGER" },
                    energyLevel: { type: "INTEGER" },
                    dominantEmotion: {
                      type: "STRING",
                      enum: ["determined", "calm", "anxious", "frustrated", "joyful", "low", "neutral"],
                    },
                    themes: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                      description: "1 to 4 core themes/topics mentioned (e.g. work, caffeine, health, sleep, family, friends, money, meditation, hobbies)"
                    },
                    aiResponse: { type: "STRING" },
                  },
                  required: ["toneScore", "energyLevel", "dominantEmotion", "themes", "aiResponse"],
                },
              },
            }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            return NextResponse.json(parsed);
          }
        }
        console.warn("Gemini API call returned non-200 or empty candidate content. Falling back to local analysis.");
      } catch (geminiError) {
        console.error("Gemini API call failed, falling back to local analysis:", geminiError);
      }
    }

    // LOCAL FALLBACK PARSER
    const localResult = analyzeLocally(transcript, aiMode, coachIntensity);
    return NextResponse.json(localResult);

  } catch (error) {
    console.error("Error in /api/analyze route:", error);
    return NextResponse.json(
      { error: "Internal server error during analysis." },
      { status: 500 }
    );
  }
}

// Local analysis helper when Gemini API is unavailable
function analyzeLocally(text: string, mode: string, intensity: string) {
  const normalized = text.toLowerCase();

  // Emotion word counts
  const emotions = {
    joyful: ["happy", "excited", "good", "great", "awesome", "proud", "joy", "love", "amazing", "wonderful", "celebrate", "win", "glad", "smiled", "smiling"],
    frustrated: ["frustrated", "annoyed", "mad", "angry", "hate", "irritated", "stupid", "broken", "fail", "bad", "worst", "sucks", "annoy", "bother"],
    anxious: ["anxious", "worry", "nervous", "scared", "fear", "panic", "stressed", "overwhelm", "pressure", "scary", "doubt"],
    low: ["sad", "depressed", "tired", "low", "blue", "down", "lonely", "sorry", "hurt", "exhausted", "sleepy", "empty", "grief", "heavy"],
    determined: ["determined", "focus", "work", "grind", "finish", "complete", "goals", "win", "strive", "push", "forge", "discipline", "done"],
    calm: ["calm", "relax", "peace", "chill", "meditate", "quiet", "still", "ease", "rest", "breath", "relieved", "thankful", "grateful"],
  };

  const counts: Record<string, number> = {
    joyful: 0,
    frustrated: 0,
    anxious: 0,
    low: 0,
    determined: 0,
    calm: 0,
  };

  for (const [emotion, words] of Object.entries(emotions)) {
    for (const word of words) {
      const regex = new RegExp(`\\b${word}\\b`, "g");
      const matches = normalized.match(regex);
      if (matches) {
        counts[emotion] += matches.length;
      }
    }
  }

  // Find dominant emotion
  let dominantEmotion = "neutral";
  let maxCount = 0;
  for (const [emotion, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantEmotion = emotion;
    }
  }

  // Set default scores based on emotion
  let toneScore = 5;
  let energyLevel = 5;

  switch (dominantEmotion) {
    case "joyful":
      toneScore = 9;
      energyLevel = 8;
      break;
    case "determined":
      toneScore = 8;
      energyLevel = 8;
      break;
    case "calm":
      toneScore = 7;
      energyLevel = 4;
      break;
    case "frustrated":
      toneScore = 3;
      energyLevel = 7;
      break;
    case "anxious":
      toneScore = 4;
      energyLevel = 6;
      break;
    case "low":
      toneScore = 2;
      energyLevel = 2;
      break;
    default:
      dominantEmotion = "neutral";
      toneScore = 5;
      energyLevel = 5;
  }

  // Adjust scores slightly based on text length (representing engagement)
  if (normalized.length > 200) {
    energyLevel = Math.min(10, energyLevel + 1);
  } else if (normalized.length < 50) {
    energyLevel = Math.max(1, energyLevel - 1);
  }

  // Extract themes
  const themeKeywords: Record<string, string[]> = {
    work: ["job", "work", "career", "study", "exam", "task", "project", "office"],
    caffeine: ["coffee", "caffeine", "tea", "espresso", "energy drink"],
    health: ["gym", "workout", "fitness", "run", "diet", "exercise", "walk", "yoga"],
    sleep: ["sleep", "bed", "night", "tired", "fatigue", "rest", "insomnia"],
    family: ["family", "parent", "dad", "mom", "brother", "sister", "wife", "husband", "kid"],
    friends: ["friend", "friends", "social", "party", "hangout", "chat"],
    money: ["money", "buy", "pay", "cost", "rent", "finance", "budget"],
    meditation: ["meditate", "meditation", "mindfulness", "breath", "calm"],
    hobbies: ["game", "movie", "book", "music", "hobby", "creative", "write", "paint"],
  };

  const extractedThemes: string[] = [];
  for (const [theme, words] of Object.entries(themeKeywords)) {
    for (const word of words) {
      if (normalized.includes(word)) {
        extractedThemes.push(theme);
        break; // match once per theme
      }
    }
  }
  const themes = extractedThemes.slice(0, 4);

  // Generate coaching response
  let aiResponse = "";
  if (intensity === "silent") {
    aiResponse = "Coaching is silenced in settings.";
  } else {
    const responses: Record<string, Record<string, string>> = {
      elevate: {
        joyful: "Your joy is infectious! Keep focusing on the actions that brought you this happiness and let it pull you forward.",
        determined: "Incredible focus today. You are directing your attention exactly where it needs to be. Keep pushing your limits.",
        calm: "Peace is a superpower. Carry this grounded presence into your next challenge; balance yields mastery.",
        frustrated: "Frustration is just raw motivation seeking direction. Take a deep breath, isolate the blocker, and grow through it.",
        anxious: "Your worries show how much you care, but don't let them cloud your strengths. You are fully capable of handling this.",
        low: "It's completely normal to feel depleted. Treat today as a recovery chapter—recharge your battery and rise tomorrow.",
        neutral: "Consistency is quiet magic. Even on average days, simply showing up builds the habits of your future self.",
      },
      nudge: {
        joyful: "Great energy today! While you're riding high, why not knock out one more small habit or plan tomorrow's routine?",
        determined: "Outstanding drive. Make sure to log your completed tasks and schedule a focused breaks to prevent burnout.",
        calm: "Excellent steady pace. It's a perfect time to do some stretching, drink some water, or plan a healthy meal.",
        frustrated: "Step away from the screen for 5 minutes. Walk, hydrate, and return with a fresh perspective.",
        anxious: "Break down whatever is stressing you into one microscopic task. Complete just that one task to regain control.",
        low: "Keep it simple today. Focus on a single foundational habit—like drinking water or sleeping on time. Easy does it.",
        neutral: "What's one small habit you can check off right now? A tiny win will lock in today's momentum.",
      },
      truth: {
        joyful: "Nice win today, but don't let celebration lead to complacency. Tomorrow is a brand new day of execution.",
        determined: "Execution is what counts, not words. Let's see you back it up with raw output. Keep grinding.",
        calm: "Calm can easily slide into comfort, and comfort is where progress dies. Are you actually working hard or just coasting?",
        frustrated: "Complaining about the friction won't solve it. Stop focusing on the problem and start adjusting your workflow.",
        anxious: "Anxiety is the byproduct of procrastination. Stop overthinking the big picture and start completing your tasks.",
        low: "Tiredness is a feeling, not a barrier. Your goals don't care how you feel. Get up and take action regardless.",
        neutral: "Neutral is the comfort zone of the average. You are either stepping forward or sliding back. Pick one.",
      },
    };

    const modeResponses = responses[mode] || responses.nudge;
    let baseResponse = modeResponses[dominantEmotion] || modeResponses.neutral;

    // Apply harsh modifications if intensity is harsh
    if (intensity === "harsh" && mode === "truth") {
      const harshTruth: Record<string, string> = {
        joyful: "You did something right today. Don't gloat, don't slack off. Back to work immediately.",
        determined: "You say you're determined, but let's see it in the logs. Action speaks, excuses walk. Show me results.",
        calm: "You look comfortable. Comfortable people don't win. Turn off the autopilot and push yourself.",
        frustrated: "Friction is part of the job. Stop crying about it, stop looking for pity, and adapt your system now.",
        anxious: "Your stress is a direct result of avoiding what needs doing. Stop looking for hacks and do the hard work.",
        low: "Everyone gets tired. The winners execute anyway. Your feelings are irrelevant to your commitments.",
        neutral: "You're drift-walking through your day. Average efforts yield average lives. Wake up and commit.",
      };
      baseResponse = harshTruth[dominantEmotion] || harshTruth.neutral;
    } else if (intensity === "harsh" && mode === "elevate") {
      baseResponse = `${baseResponse} No excuses: keep this standard high.`;
    } else if (intensity === "harsh" && mode === "nudge") {
      baseResponse = `${baseResponse} Stop delaying and do it now.`;
    }

    aiResponse = baseResponse;
  }

  return {
    toneScore,
    energyLevel,
    dominantEmotion,
    themes,
    aiResponse,
  };
}

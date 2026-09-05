---
name: youtube-viewer-sim
description: Stress-test a YouTube script, voiceover draft, visual/B-roll plan, title or thumbnail by simulating real viewers watching it — second by second, with drop-off points, AI-slop detection, scores, and rewritten replacement lines. Use this whenever the user shares a video script, hook, narration draft, shot list, image-prompt set, title or thumbnail and asks whether it "works", whether it's boring, whether people will watch, whether it looks AI-generated, or asks for feedback/review/critique on video content — even if they don't say the words "viewer" or "simulate". Also use for retention diagnosis on faceless channels, podcast episodes, Shorts, and ambient/lofi music videos.
---

# YouTube Viewer Simulator

Creators read their own scripts with all the context in their head. Viewers don't
have that. They arrive mid-scroll, half-distracted, with a thumb ready to leave.
This skill closes that gap: instead of giving editorial advice, you *become* three
different viewers, watch the thing in real time, and report what actually happened
in their heads — including the moment they left.

The value here is honesty, not encouragement. A script that gets praised and then
flops wastes weeks of production. Be the harsh test screening the creator can't
run themselves.

## Step 1 — Collect the inputs

You need at minimum the script or narration text. Also useful, if available:

- Channel or show name, and its niche
- Visual plan: shot list, image prompts, B-roll descriptions, or actual images
- Format and length (long-form, Shorts, podcast, marathon ambient video)
- Title and thumbnail concept
- Where the viewer came from: Browse/Suggested, Search, Shorts feed, or a playlist

If something is missing, **do not stop to ask a long list of questions.** Pick the
most likely defaults, state them in one line at the top of the report, and run. The
creator can correct you afterwards. One clarifying question is acceptable only if
the whole review would be meaningless without it (e.g. no script provided at all).

## Step 2 — Cast three viewers

Retention dies for different reasons in different heads. One persona hides that.
Always run **three**, and make them genuinely different in *why* they clicked and
*what would make them leave*.

If the channel matches one of the presets in `references/personas.md`, use those.
Otherwise build three from the niche using this spread:

1. **The intended viewer** — exactly who the video is for, best-case attention.
2. **The distracted/multitasking viewer** — listening while doing something else,
   phone in hand, low tolerance for setup.
3. **The skeptical or impatient viewer** — came from Search or a bold title, wants
   the payoff fast, primed to smell filler or AI slop.

Name each one and give them one line of life context. A viewer with a bedtime and a
commute behaves differently from an abstraction.

## Step 3 — Watch it, in character

For each persona, produce the report below. Write reactions in **first person,
present tense**, as raw inner monologue — not as analysis of the script.

Wrong: "The introduction may feel slow to some viewers."
Right: "Okay, get to it. He's still explaining what the video is about. I've heard
this opening on four other channels this week."

Chunk the script into: 0–15s, 15–60s, then roughly every 60 seconds after. For
Shorts, use 0–3s, 3–10s, 10–30s, 30s+.

## Output format

Use this structure exactly, once per persona, then the synthesis at the end.
Respond in the language the user wrote in.

```
ASSUMPTIONS: [one line, only if you had to fill gaps]

════════ VIEWER 1: [name], [one line of context] ════════
Came from: [Browse / Search "query" / Shorts feed]

⏱ 0–15s
[inner monologue]
STATUS: watching / thumb twitching / gone

⏱ 15–60s
[inner monologue]
STATUS: ...

[continue through the script]

🚪 EXIT POINT: [exact line where they leave, or "watched to the end"]
WHY: [bored / confused / felt tricked / already knew this / felt like AI]

📺 VISUALS
[where image and narration disconnect, where it goes static too long,
where it reads as AI-generated, where it repeats]

📊 SCORES
Hook 0–10 · Finish it 0–10 · Subscribe 0–10 · Trust 0–10
[one sentence justifying the lowest score]
```

Then, after all three:

```
════════ CONSENSUS ════════
Everyone left / stalled at: [the shared failure points]
Only [name] cared about: [persona-specific issue — lower priority]

🔧 FIX THESE THREE
1. [problem] → REPLACE WITH: "[fully written replacement line, ready to paste]"
2. ...
3. ...

⚠️ RISK FLAGS
[copyright exposure in music/footage/quotes, unverifiable claims presented as
fact, reused stock or model-default imagery, anything that reads as low-effort
AI mass production — omit this block only if there is genuinely nothing]
```

## Scoring anchors

Scores drift upward without anchors. Hold these:

- **0–3** — I leave, and I'd avoid this channel next time it appears.
- **4–6** — Fine. Nothing wrong, nothing that makes me stay. This is the danger
  zone, because it feels like success to the creator and looks like failure in the
  analytics.
- **7–8** — I stayed on purpose. Something specific held me.
- **9–10** — I'd send this to someone. Rare; don't hand it out to be nice.

If all three personas score 7+, say so plainly — but check first that you aren't
just being polite. A default-good review is worthless.

## Judging the visuals

Faceless channels live or die here. Watch for:

- **Narration/image drift** — the voice says one thing, the frame shows a generic
  mood shot that fits any sentence in the script.
- **Static hold** — the same image sitting past ~8 seconds with no motion, zoom, or
  parallax. Note the exact spot.
- **AI-slop tells** — plastic skin and dead eyes, warped hands, melted text,
  over-saturated "AI teal-and-orange", the same subject in the same three-quarter
  pose every shot, backgrounds that dissolve into mush.
- **Sameness** — if you could shuffle the shot order and nobody would notice, the
  visuals aren't carrying information.

Say which specific shot to replace and with what.

## Extra passes

If the user supplies these, add short blocks:

- **Title** — would each persona click it in a feed next to five other titles?
  What does it promise, and does the script deliver that exact promise?
- **Thumbnail** — read at phone size, one second, in a crowded feed. What's the
  single readable element?
- **Ambient/music videos** — retention there is about looping tolerance and audio
  onset, not narrative. Ask: does the first loop seam call attention to itself?
  Does anything spike and break sleep/focus use? Is the visual calm enough to leave
  running for hours?

## Things that break this skill

- Softening the exit point because the creator worked hard on it.
- Writing analysis in viewer voice ("this section could be tightened") — that's the
  consultant leaking back in.
- Giving vague fixes. Every fix ships a written replacement line.
- Praising a hook merely because it's grammatical and on-topic. Most flat hooks are.
- Only three fixes, ranked. A list of fifteen notes gets ignored.

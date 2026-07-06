import React, { useState, useEffect } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SortableTable } from "./SortableTable";
import {
  Play,
  Pause,
  FastForward,
  CheckCircle2,
  Sparkles,
  Download,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  Edit2,
  Save,
  Sun,
  Moon,
  Mic,
  Sliders,
  Info,
  Volume2,
  Settings,
  Check,
  FileText,
  Clock,
  Copy,
  AlertCircle,
  Wand2,
  Printer,
  FileJson,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

function extractPhases(text: string) {
  const p1 = text.match(/(?:^|\n)(?:#+\s*|\*\*\s*)?(?:Phase\s*1|ส่วนที่\s*1|Step\s*1)[\s\S]*?(?=(?:^|\n)(?:#+\s*|\*\*\s*)?(?:Phase\s*2|ส่วนที่\s*2|Step\s*2)|$)/i);
  const p2 = text.match(/(?:^|\n)(?:#+\s*|\*\*\s*)?(?:Phase\s*2|ส่วนที่\s*2|Step\s*2)[\s\S]*?(?=(?:^|\n)(?:#+\s*|\*\*\s*)?(?:Phase\s*3|ส่วนที่\s*3|Step\s*3)|$)/i);
  const p3 = text.match(/(?:^|\n)(?:#+\s*|\*\*\s*)?(?:Phase\s*3|ส่วนที่\s*3|Step\s*3)[\s\S]*$/i);

  return {
    phase1: p1 ? p1[0] : null,
    phase2: p2 ? p2[0] : null,
    phase3: p3 ? p3[0] : null,
  };
}

const MarkdownComponents = {
  table: ({ node, ...props }: any) => <SortableTable {...props} />,
  code: ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || "");
    if (!match) {
      return (
        <code
          className="bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded text-[0.85em] font-medium border border-blue-800/50"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};

const parseTimestampToSeconds = (ts: string) => {
  const cleanTs = ts.replace(/[^0-9:]/g, "");
  const parts = cleanTs.split(":");
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  if (parts.length === 3) {
    return (
      parseInt(parts[0], 10) * 3600 +
      parseInt(parts[1], 10) * 60 +
      parseInt(parts[2], 10)
    );
  }
  return 0;
};

function VisualPreviewCard({
  visual,
  timeString,
  isActive,
  isPassed,
  theme,
  onOpenLightbox,
}: any) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleGenerateImage = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    // Simulate generation delay
    setTimeout(() => {
      setIsGenerating(false);
      // Set a placeholder image pattern based on string length to roughly make it consistent
      const styleId = (visual.prompt?.length || 0) % 10;
      setGeneratedImg(
        `https://picsum.photos/seed/${timeString.replace(":", "")}${styleId}/400/225`,
      );
    }, 2000);
  };

  return (
    <div
      className={cn(
        "lg:w-[35%] xl:w-[400px] shrink-0 rounded-xl overflow-hidden border flex flex-col transition-all",
        theme === "light"
          ? isActive
            ? "border-blue-400 bg-white ring-1 ring-blue-400/50 shadow-md"
            : "border-slate-200 bg-slate-50/50 shadow-sm hover:border-slate-300"
          : isActive
            ? "border-slate-600 bg-slate-900"
            : "border-slate-800 bg-slate-900/30",
        isPassed && !isActive ? "opacity-75" : "opacity-100",
      )}
    >
      <div
        className={cn(
          "px-3 py-2 border-b flex justify-between items-center cursor-pointer transition-colors",
          theme === "light"
            ? "bg-slate-100/80 border-slate-200 hover:bg-slate-200/50"
            : "bg-slate-800/80 border-slate-700/80 hover:bg-slate-700/80",
        )}
        onClick={toggleExpand}
      >
        <span
          className={cn(
            "text-xs font-bold flex items-center gap-1.5",
            theme === "light" ? "text-slate-700" : "text-slate-300",
          )}
        >
          <span
            className={cn(
              "text-[10px] px-1.5 rounded font-mono",
              theme === "light"
                ? "bg-slate-200 text-slate-700"
                : "bg-slate-700 text-slate-300",
            )}
          >
            B-ROLL
          </span>
          {timeString}
        </span>
        <button
          className={cn(
            "p-0.5 rounded transition-colors",
            theme === "light"
              ? "text-slate-400 hover:text-slate-600"
              : "text-slate-400 hover:text-slate-200",
          )}
        >
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-3">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              Visual Suggestion
            </div>
            <div
              className={cn(
                "text-xs leading-relaxed font-medium line-clamp-3",
                isActive
                  ? theme === "light"
                    ? "text-emerald-700"
                    : "text-emerald-300"
                  : theme === "light"
                    ? "text-slate-600"
                    : "text-slate-400",
              )}
            >
              {visual.suggestion}
            </div>
          </div>

          {visual.prompt && visual.prompt !== "" && (
            <div
              className={cn(
                "border p-2 rounded-lg flex flex-col pt-2 pb-0",
                theme === "light"
                  ? "bg-blue-50/50 border-blue-100"
                  : "bg-blue-950/20 border-blue-900/30",
              )}
            >
              <div className="px-1 text-[10px] font-bold text-sky-500 uppercase tracking-widest mb-1 flex items-center justify-between gap-1 w-full relative">
                <div
                  className={cn(
                    "flex items-center gap-1 z-10 pr-2",
                    theme === "light"
                      ? "text-blue-600 bg-blue-50/80"
                      : "bg-blue-950/80",
                  )}
                >
                  <Sparkles className="w-3 h-3" /> Image Prompt
                </div>
              </div>

              <div
                className={cn(
                  "px-1 text-[10px] font-mono leading-relaxed italic line-clamp-3 mb-2",
                  theme === "light" ? "text-slate-700" : "text-slate-300",
                )}
              >
                "{visual.prompt.replace(/^"/, "").replace(/"$/, "")}"
              </div>

              {generatedImg ? (
                <div
                  className={cn(
                    "mt-1 -mx-2 -mb-0 overflow-hidden relative group rounded-b-lg border-t",
                    theme === "light"
                      ? "border-blue-100"
                      : "border-blue-900/30",
                  )}
                >
                  <img
                    src={generatedImg}
                    alt="Generated Preview"
                    className="w-full aspect-video object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div
                    className={cn(
                      "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2",
                      theme === "light" ? "bg-white/65" : "bg-blue-950/70",
                    )}
                  >
                    <button
                      onClick={handleGenerateImage}
                      className={cn(
                        "text-xs font-bold px-2 py-1.5 rounded shadow transition-all",
                        theme === "light"
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "text-white bg-blue-600 hover:bg-blue-500",
                      )}
                    >
                      Regenerate
                    </button>
                    {onOpenLightbox && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenLightbox({
                            img: generatedImg,
                            prompt: visual.prompt,
                            time: timeString,
                            suggestion: visual.suggestion,
                          });
                        }}
                        className={cn(
                          "text-xs font-bold px-2 py-1.5 rounded shadow transition-all",
                          theme === "light"
                            ? "bg-slate-800 text-white hover:bg-slate-900"
                            : "bg-slate-700 text-white hover:bg-slate-600",
                        )}
                      >
                        เต็มจอ
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "mt-1 -mx-2 -mb-0 p-2 border-t rounded-b-lg flex justify-start",
                    theme === "light"
                      ? "bg-blue-100/30 border-blue-100"
                      : "bg-blue-950/40 border-blue-900/30",
                  )}
                >
                  <button
                    onClick={handleGenerateImage}
                    disabled={isGenerating}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold rounded transition-all shadow-sm border",
                      isGenerating
                        ? theme === "light"
                          ? "bg-slate-100 text-slate-400 border-transparent cursor-not-allowed"
                          : "bg-slate-800 text-slate-400 border-transparent cursor-not-allowed"
                        : theme === "light"
                          ? "bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 border-blue-200"
                          : "bg-blue-900/50 hover:bg-blue-800 text-sky-300 hover:text-sky-200 border-blue-800/50",
                    )}
                  >
                    {isGenerating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="w-3.5 h-3.5" />
                    )}
                    {isGenerating ? "Generating..." : "Generate Preview"}
                  </button>
                </div>
              )}
            </div>
          )}

          {visual.benefit && (
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                Reasoning
              </div>
              <div
                className={cn(
                  "text-[11px] leading-snug",
                  theme === "light" ? "text-slate-600" : "text-slate-400",
                )}
              >
                {visual.benefit}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScriptHighlighter({
  content,
  fullResult,
  theme,
  onUpdateContent,
  onUpdateFullResult,
  onAIAssistFix,
}: {
  content: string;
  fullResult?: string;
  theme: "light" | "dark";
  onUpdateContent?: (newContent: string) => void;
  onUpdateFullResult?: (newResult: string) => void;
  onAIAssistFix?: (
    issueType: "no_visual" | "no_prompt" | "duration_long" | "prompt_warning",
    ranges: string[],
    content: string,
  ) => void;
}) {
  // Extract table rows from Markdown to map visual suggestions
  const lines = (fullResult || content).split("\n");
  const extractedTables: string[][][] = [];
  let currentTable: string[][] = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.includes("|")) {
      let cleanedLine = trimmed;
      if (cleanedLine.startsWith("|")) cleanedLine = cleanedLine.slice(1);
      if (cleanedLine.endsWith("|")) cleanedLine = cleanedLine.slice(0, -1);

      const cells = cleanedLine.split("|").map((c) => c.trim());
      const isSeparator = cells.every((cell) => /^:?-+:?$/.test(cell));
      if (!isSeparator && cells.length > 0) {
        currentTable.push(cells);
      }
    } else {
      if (currentTable.length > 0) {
        extractedTables.push(currentTable);
        currentTable = [];
      }
    }
  }
  if (currentTable.length > 0) {
    extractedTables.push(currentTable);
  }

  // Map timestamps to visual info
  const visualMap = new Map<
    number,
    { suggestion: string; benefit: string; prompt?: string }
  >();

  for (const table of extractedTables) {
    if (table.length > 1) {
      let timeIdx = 0;
      let promptIdx = -1;
      let suggestionIdx = -1;
      let benefitIdx = -1;

      const headers = table[0].map((h) => h.toLowerCase());
      promptIdx = headers.findIndex(
        (h) => h.includes("prompt") || h.includes("google flow"),
      );
      suggestionIdx = headers.findIndex(
        (h) =>
          h.includes("suggestion") ||
          h.includes("ภาพประกอบ") ||
          h.includes("visual"),
      );
      benefitIdx = headers.findIndex(
        (h) =>
          h.includes("reasoning") ||
          h.includes("เหตุผล") ||
          h.includes("benefit"),
      );
      timeIdx = headers.findIndex(
        (h) =>
          h.includes("time") ||
          h.includes("เวลา") ||
          h.includes("คิว") ||
          h.includes("timestamp"),
      );

      if (timeIdx === -1) {
        if (table.length > 1) {
          timeIdx = table[1].findIndex((cell) =>
            cell.match(/(\d{1,2}:\d{2}(?::\d{2})?)/),
          );
        }
        if (timeIdx === -1) timeIdx = 0;
      }

      for (let i = 1; i < table.length; i++) {
        const row = table[i];
        if (row.length === 0) continue;
        const tsCell = row[timeIdx] || row[0];
        if (!tsCell) continue;

        const tsMatch = tsCell.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
        if (tsMatch) {
          const secondsKey = parseTimestampToSeconds(tsMatch[1]);
          const existing = visualMap.get(secondsKey) || {
            suggestion: "",
            benefit: "",
            prompt: undefined,
          };
          visualMap.set(secondsKey, {
            suggestion:
              suggestionIdx >= 0 && row[suggestionIdx]
                ? row[suggestionIdx]
                : existing.suggestion || row[1] || "",
            benefit:
              benefitIdx >= 0 && row[benefitIdx]
                ? row[benefitIdx]
                : existing.benefit || row[2] || "",
            prompt:
              promptIdx >= 0 && row[promptIdx] && row[promptIdx].trim() !== ""
                ? row[promptIdx]
                : existing.prompt,
          });
        }
      }
    }
  }

  // Split script by sections looking for timestamps like [0:00] or **[0:00]** or ### [0:00]
  const sectionSplitToken = "\n__SPLIT_HERE__\n";
  const normalizedContent = content.replace(
    /^([*#\s]*\[\d{1,2}:\d{2}(?::\d{2})?\][*#\s]*)/gm,
    `${sectionSplitToken}$1`,
  );
  const rawSections = normalizedContent
    .split(sectionSplitToken)
    .filter((s) => s.trim().length > 0);

  const sections = rawSections.map((sec, idx) => {
    const tsMatch = sec.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/);
    const timeString = tsMatch ? tsMatch[1] : null;
    const seconds = tsMatch ? parseTimestampToSeconds(tsMatch[1]) : 0;
    return {
      id: idx,
      text: sec,
      timeString,
      seconds,
      visual: tsMatch ? visualMap.get(seconds) : undefined,
    };
  });

  const chartData = sections.map((sec, idx) => {
    const wordCount = sec.text.trim().split(/\s+/).length;
    const estSeconds = wordCount / 2.5;

    const lines = sec.text
      .trim()
      .split("\n")
      .filter((l) => l.trim().length > 0);
    const firstLineText =
      lines.find((l) => !/^\[\d{1,2}:\d{2}(?::\d{2})?\]/.test(l)) ||
      lines[0] ||
      "";
    const firstLineStr = firstLineText.replace(/[*#>`_-]/g, "").trim();
    const label =
      firstLineStr.length > 30
        ? firstLineStr.substring(0, 30) + "..."
        : firstLineStr;

    return {
      name: `S${idx + 1}`,
      label: label || `ส่วนที่ ${idx + 1}`,
      words: wordCount,
      duration: estSeconds,
      timeString: sec.timeString || "",
    };
  });

  const totalDurationSum =
    chartData.reduce((acc, curr) => acc + curr.duration, 0) || 1;
  let accumulatedSecondsForTimeline = 0;
  const timelineBlocks = chartData.map((block, idx) => {
    const duration = block.duration;
    const startSec = accumulatedSecondsForTimeline;
    accumulatedSecondsForTimeline += duration;
    const endSec = accumulatedSecondsForTimeline;
    return {
      ...block,
      idx,
      startSec,
      endSec,
      percentWidth: (duration / totalDurationSum) * 100,
      percentStart: (startSec / totalDurationSum) * 100,
    };
  });

  const [activeId, setActiveId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showOnlyPrompts, setShowOnlyPrompts] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [lightboxData, setLightboxData] = useState<{
    img: string;
    prompt: string;
    time: string;
    suggestion: string;
  } | null>(null);

  // Expanded Feature States
  const [voiceStyle, setVoiceStyle] = useState<
    "educational" | "energetic" | "calm" | "mysterious"
  >("educational");
  const [pacingSpeed, setPacingSpeed] = useState<number>(360); // characters per minute for Thai language
  const [exportSeparator, setExportSeparator] = useState<string>("---");
  const [includeMetadata, setIncludeMetadata] = useState<boolean>(true);
  const [scriptTitle, setScriptTitle] = useState<string>(
    "Podcast Episode Production Scipt",
  );

  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [copiedStatus, setCopiedStatus] = useState(false);
  const [isAuditorExpanded, setIsAuditorExpanded] = useState(true);
  const [auditorFilter, setAuditorFilter] = useState<
    "all" | "error" | "warning" | "info"
  >("all");
  const [hoveredTimelineIdx, setHoveredTimelineIdx] = useState<number | null>(
    null,
  );

  // --- TTS States ---
  const [googleTtsVoice, setGoogleTtsVoice] =
    useState<string>("en-US-Journey-F");
  const [isGeneratingTts, setIsGeneratingTts] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsDuration, setTtsDuration] = useState<number | null>(null);
  const [showChart, setShowChart] = useState(false);

  useEffect(() => {
    // Delay rendering chart slightly to prevent ResponsiveContainer from measuring width(-1) when display is not fully resolved
    const timer = setTimeout(() => setShowChart(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const premiumVoices = [
    {
      id: "en-US-Journey-F",
      label: "Journey Premium - Female (Clear, Energetic)",
    },
    {
      id: "en-US-Journey-O",
      label: "Journey Premium - Female (Warm, Authoritative)",
    },
    {
      id: "en-US-Journey-D",
      label: "Journey Premium - Male (Deep, Professional)",
    },
    {
      id: "en-US-Studio-O",
      label: "Studio Grade - Female (Educational Narrative)",
    },
    { id: "en-US-Studio-M", label: "Studio Grade - Male (Storytelling)" },
  ];

  const handleGenerateAudio = async () => {
    if (!editedContent.trim()) return;
    setIsGeneratingTts(true);
    setTtsAudioUrl(null);
    setTtsDuration(null);
    try {
      // Clean script for reading: Remove timestamps, headers, bold, and other markdown noise
      let rawTextToSpeak = sections
        .map((s) => s.text)
        .join(" ")
        .replace(/\[\d{1,2}:\d{2}\]/g, "")
        .replace(/[*#>`_-]/g, " ")
        .replace(/\n+/g, " ");

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rawTextToSpeak,
          voiceName: googleTtsVoice,
          languageCode: "en-US",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();

      const binaryString = window.atob(data.audioBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: "audio/mp3" });
      const url = URL.createObjectURL(blob);
      setTtsAudioUrl(url);
      setTtsDuration(data.estimatedDurationSeconds);
    } catch (err: any) {
      alert(
        "เกิดข้อผิดพลาดในการสร้างเสียงพากย์: " +
          err.message +
          "\n\n(ลองตรวจสอบว่าได้ใส่ GOOGLE_TTS_API_KEY ลงในระบบหรือยัง)",
      );
    } finally {
      setIsGeneratingTts(false);
    }
  };

  useEffect(() => {
    setEditedContent(content);
  }, [content]);

  // Handle voice style preset selection
  const voicePresets = {
    educational: {
      name: "🎓 วิชาการ / อธิบายสาระสนุก",
      cpm: 360,
      description:
        "จัดจังหวะสมดุล ดึงดูดสติ นุ่มนวลน่าฟัง เหมาะกับหัวข้อความรู้ ชีวประวัติ และประวัติศาสตร์วิทยาศาสตร์",
      tips: "🎙️ เน้นเสียงกลมกล่อม มีระดับเสียงคงที่ จังหวะเว้นหลังย่อหน้าสำคัญให้คนคิดตามได้อย่างเหมาะสม",
    },
    energetic: {
      name: "🔥 ปลุกพลังกระตุ้นอารมณ์",
      cpm: 460,
      description:
        "รวดเร็ว ดุดัน ชวนให้อยากกดติดตามคลิป เหมาะสำหรับ Top 10 ล่าแร้งกิ้ง หรือวิดีโอปั้นช่องฉบับสร้างอาชีพ",
      tips: "🎙️ พากย์ด้วยน้ำเสียงสูงต่ำอย่างคล่องแคล่วกระฉับกระเฉง เพิ่มรอยยิ้มระหว่างพูดเพื่อส่งพลังบวก",
    },
    calm: {
      name: "🌙 ผ่อนคลายสบายหูพอดแคสต์",
      cpm: 260,
      description:
        "สโลว์ไลฟ์ น้ำเสียงอุ่นใจ ดั่งแนวคิดปรัชญา ประคับประคองจิตใจ พอดแคสต์จิตวิทยา และเรื่องราวก่อนนอน",
      tips: "🎙️ ใช้โทนเสียงลึก (Chest Voice) ผสมผสานจังหวะลมหายใจเสียงกระซิบเบาๆ และเว้นจังหวะยาวนานกว่าปกติ",
    },
    mysterious: {
      name: "🕵️ ไขปริศนา / ลึกลับระทึกขวัญ",
      cpm: 310,
      description:
        "ช้า เน้นความเงียบ ดึงความน่าสนใจในความน่าประหลาดใจ เหมาะกับเรื่องเล่าประวัติศาสตร์ลับลวงพรางและการสืบสวน",
      tips: "🎙️ ทิ้งน้ำหนักคำหนักแน่นสะกดผู้คน ดำดิ่งหลังคำถามสำคัญด้วยการทิ้งช่วงจังหวะหยุดเงียบ 1.5 วินาที",
    },
  };

  const handleApplyPreset = (
    key: "educational" | "energetic" | "calm" | "mysterious",
  ) => {
    setVoiceStyle(key);
    setPacingSpeed(voicePresets[key].cpm);
  };

  // Live telemetry metrics calculation
  const totalCharacters = editedContent.length;
  // Heuristic for Thai word length ~3.8 chars per word + English words
  const thaiCharsCount = editedContent.replace(/[a-zA-Z0-9\s]/g, "").length;
  const englishWordsCount = (editedContent.match(/[a-zA-Z]+/g) || []).length;
  const estimatedWords = Math.round(thaiCharsCount / 3.8) + englishWordsCount;

  const totalVisualSlides = sections.filter((s) => !!s.visual).length;
  const baselineMinutes = totalCharacters / pacingSpeed;
  const slidePauseBuffer = totalVisualSlides * 1.5; // Add delay per slide shift
  const playTimeSeconds = Math.round(baselineMinutes * 60 + slidePauseBuffer);

  // Analyze Script and Image Prompts Alignment
  interface AlignmentIssue {
    id: string;
    sectionIndex: number;
    timeString: string;
    type:
      | "duration_short"
      | "duration_long"
      | "no_visual"
      | "text_warning"
      | "style_warning"
      | "face_warning"
      | "no_prompt"
      | "transition_lacking"
      | "tone_repetitive"
      | "speech_markers_missing";
    severity: "error" | "warning" | "info";
    title: string;
    description: string;
    actionable: string;
    allocated?: number;
    estimated?: number;
  }

  const parsedIssues: AlignmentIssue[] = [];

  sections.forEach((sec, idx) => {
    const timeStr = sec.timeString || "0:00";
    const nextSeconds =
      idx < sections.length - 1 && sections[idx + 1].timeString
        ? sections[idx + 1].seconds
        : playTimeSeconds;

    const allocatedSlot = nextSeconds - sec.seconds;
    const charCount = sec.text.replace(/\[\d{1,2}:\d{2}\]/g, "").length; // clean timestamp for speed estimation
    // Estimated speech time in seconds based on cpm
    const estimatedSpeechSecs = Math.round((charCount / pacingSpeed) * 60);

    // 1. Duration / Pacing Check
    if (allocatedSlot > 0) {
      if (estimatedSpeechSecs > allocatedSlot + 15) {
        parsedIssues.push({
          id: `dur-over-${idx}`,
          sectionIndex: idx,
          timeString: timeStr,
          type: "duration_short",
          severity: "warning",
          title: "สคริปต์อาจยาวไปเทียบกับภาพ (Narration Overrun)",
          description: `ต้องการเวลาอ่านจริง ~${estimatedSpeechSecs} วินาที แต่คิวภาพถัดไปถูกตั้งให้ห่างเพียง ${allocatedSlot} วินาที`,
          actionable: `เกลาพาร์ทความรู้ช่วง [${timeStr}] ให้สั้นลงเล็กน้อย หรือเลื่อนเวลาของคิวภาพถัดไปในตารางให้เว้นห่างกว่านี้`,
        });
      } else if (
        estimatedSpeechSecs < allocatedSlot - 25 &&
        allocatedSlot > 25
      ) {
        parsedIssues.push({
          id: `dur-under-${idx}`,
          sectionIndex: idx,
          timeString: timeStr,
          type: "duration_long",
          severity: "info",
          title: "ภาพแช่นานเกินไป เสี่ยงโดนแบน (Visual Freeze)",
          description: `สคริปต์จบเร็วเพียง ~${estimatedSpeechSecs} วินาที แต่ภาพคิวนี้ถูกเว้นนานถึง ${allocatedSlot} วินาที (ภาพนิ่งเกินกว่า 15-20 วินาทีอาจตกเกณฑ์)`,
          actionable: `แนะนำให้เพิ่มประโยคเล่าเรื่อง หรือเพิ่มคิวภาพแทรก เช่น [0:${sec.seconds + 12}] B-Roll ใส่ Prompt เพิ่ม`,
        });
      }
    }

    // 2. Visual Prompt Check
    const visual = sec.visual;
    if (!visual) {
      parsedIssues.push({
        id: `no-vis-${idx}`,
        sectionIndex: idx,
        timeString: timeStr,
        type: "no_visual",
        severity: "error",
        title: "คิวเวลาตกหล่น ไม่มีข้อมูลวิชวล (Missing Visual Link)",
        description: `สำหรับคิวเวลา [${timeStr}] นี้ ใน Phase 2 ไม่มีส่วนตารางข้อมูลที่จับคู่กันตรงเป๊ะเลย`,
        actionable: `ตรวจสอบคีย์เวลาในตารางของ Phase 2 ว่าตรงกับโค้ดเวลา [${timeStr}] ในบทเขียนนี้อย่างแม่นยำหรือไม่`,
      });
    } else {
      const pStr = (visual.prompt || "").trim();
      if (!pStr) {
        parsedIssues.push({
          id: `no-prm-${idx}`,
          sectionIndex: idx,
          timeString: timeStr,
          type: "no_prompt",
          severity: "warning",
          title: "ขาด Image Prompt (Missing Prompt)",
          description: `ระบุไอเดียสไลด์คลาดเคลื่อนและเว้นว่างข้อความ Prompt ภาษาอังกฤษไว้`,
          actionable: `กรอกคำสั่งภาพภาษาอังกฤษ เช่น "a single candle glowing in dark room, low key, minimalist illustration" เพื่อนำไปใช้เจ็นภาพ`,
        });
      } else {
        const pLower = pStr.toLowerCase();

        // Check text/logos in prompt
        if (
          pLower.match(
            /(text|label|logo|letters|writing|word|font|speech bubble|copyright|watermark|banner)/,
          )
        ) {
          parsedIssues.push({
            id: `txt-warn-${idx}`,
            sectionIndex: idx,
            timeString: timeStr,
            type: "text_warning",
            severity: "error",
            title: "พบความเสี่ยงคำขยะปะปนภาพเจเนอเรต (Text/Logo Warning)",
            description: `ตรวจเจอนิพจน์สุ่มเสี่ยง: "${pStr}" มีการระบุข้อมูลสื่ออักษรหรือกล่องพูด`,
            actionable: `ลบล้างคำว่า text, logo, write ทิ้งไป เพื่อตัดปัญหา AI เจนเนอเรตข้อความปริศนาที่บิดเบี้ยวไร้ความหมาย`,
          });
        }

        // Check literal faces vs metaphors (Rule 1, 3)
        if (
          pLower.match(
            /(crying|scared face|extremely sad|facial expressions|cartoon|ugly face|shocked face|shouting)/,
          )
        ) {
          parsedIssues.push({
            id: `face-warn-${idx}`,
            sectionIndex: idx,
            timeString: timeStr,
            type: "face_warning",
            severity: "warning",
            title: "อารมณ์ในภาพสื่อตรงเกินไป (Explicit Human Close-up)",
            description: `ตัวพรอพต์สั่งใบหน้าคนแสดงอาการฉูดฉาดเกินบทละครของพอดแคสต์: "${pStr}"`,
            actionable: `กระชับภาพลักษณ์ความพอดแคสต์หรูหราด้วยการโยกไปใช้ สัญลักษณ์เปรียบเปรย (Metaphor) เช่น 'a lone leaf drifting down the quiet stream' แทนที่จะเป็นตัวหน้าคนร้องไห้`,
          });
        }

        // Check high-end cinematic strings
        const hasPremiumStyle = pLower.match(
          /(cinematic|lighting|vibe|depth of field|studio|concept art|8k|shot|photo|photorealistic|render|professional|ambiance)/,
        );
        if (!hasPremiumStyle) {
          parsedIssues.push({
            id: `sty-warn-${idx}`,
            sectionIndex: idx,
            timeString: timeStr,
            type: "style_warning",
            severity: "info",
            title:
              "ขาดคำวิเศษณ์จัดสไตล์ระดับสูง (Lack of Premium Cinematic Style)",
            description: `พรอพต์คิวนี้พูดถึงแค่วัตถุแบนเดี่ยวโดยไร้แสงเงาลึกซึ้ง: "${pStr}"`,
            actionable: `พ่วงเวิร์ดดิ้งระดับจิตรกรดั่งสตูดิโอ เช่น ", cinematic lighting, warm golden hour, professional photography" ด้านท้าย`,
          });
        }
      }
    }

    // 3. Visual Transition Lacking Check (User request 3)
    if (allocatedSlot > 20) {
      parsedIssues.push({
        id: `vis-trans-${idx}`,
        sectionIndex: idx,
        timeString: timeStr,
        type: "transition_lacking",
        severity: "warning",
        title: "ขาดการสลับมุมกล้องหรือการเปลี่ยนคิวภาพประกอบ (Transition Lacking)",
        description: `ช่วงเวลา [${timeStr}] มีความยาว ${allocatedSlot} วินาที ซึ่งแช่ภาพนิ่งไว้นานเกินไป ควรเพิ่มช่วงความหลากหลายภาพประกอบ`,
        actionable: `แนะนำให้แทรกการซูมแบบ Dynamic Ken Burns หรือปรับสคริปต์เพื่อแบ่งเวลาออกเป็น 2 ช่วง หรือใส่ Transition ตอนต้น`,
      });
    }

    // 4. Tone Repetitive Check (User request 3)
    const normalizedText = sec.text.replace(/\[.*?\]/g, "").trim();
    const repetitivePatterns = ["เพราะว่า", "และก็", "คือว่า", "ดังนั้น", "จากนั้น", "แล้วก็", "ในการ"];
    let detectedRepetition = "";
    for (const pat of repetitivePatterns) {
      const occurrences = (normalizedText.match(new RegExp(pat, "g")) || []).length;
      if (occurrences >= 2) {
        detectedRepetition = pat;
        break;
      }
    }
    if (detectedRepetition) {
      parsedIssues.push({
        id: `tone-rep-${idx}`,
        sectionIndex: idx,
        timeString: timeStr,
        type: "tone_repetitive",
        severity: "warning",
        title: "ตรวจพบจังหวะการพูดเริ่มซ้ำซาก (Repetitive Cadence/Tone)",
        description: `มีการใช้คำเชื่อมซ้ำบ่อยในช่วงนี้ (เช่น "${detectedRepetition}") ทำให้ลื่นไหลไม่เป็นธรรมชาติเท่าที่ควร`,
        actionable: `เกลาประโยคใหม่เพื่อหลีกเลี่ยงการใช้คำเชื่อมซ้ำกัน เช่น การแบ่งประโยคให้สั้นลง หรือเว้นจังหวะความกระชับ`,
      });
    }

    // 5. Speech Markers Missing Check (User request 3)
    const hasSpeechMarkers = /\[(pause|breath|emphasis|whisper|sigh|chuckle|slow|fast)\]/i.test(sec.text);
    if (!hasSpeechMarkers) {
      parsedIssues.push({
        id: `speech-markers-${idx}`,
        sectionIndex: idx,
        timeString: timeStr,
        type: "speech_markers_missing",
        severity: "info",
        title: "ขาดสัญลักษณ์แสดงท่วงทำนองธรรมชาติ (Missing Natural Speech Markers)",
        description: `บทพูดในฉาก [${timeStr}] เป็นเนื้อความแถบยาวติดต่อกันโดยไร้สัญลักษณ์ช่วยกำหนดจังหวะหายใจหรือการหยุดจังหวะ`,
        actionable: `คลิกปุ่ม "✨ เติม Speech Markers" ด้านบนเพื่อเติมคำสั่ง [pause], [breath] หรือ [emphasis] โดยอัตโนมัติ`,
      });
    }
  });

  // Score computation
  let calculatedScore = 100;
  parsedIssues.forEach((isu) => {
    if (isu.severity === "error") calculatedScore -= 10;
    else if (isu.severity === "warning") calculatedScore -= 5;
    else if (isu.severity === "info") calculatedScore -= 2;
  });
  if (calculatedScore < 40) calculatedScore = 40;

  const formatPlayTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getPacingLabel = (cpm: number) => {
    if (cpm < 250)
      return {
        label: "สปีดอบอุ่น/ลึกลับ (Relaxed Deep)",
        color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
      };
    if (cpm < 350)
      return {
        label: "การบรรยายเล่าเรื่อง (Narrative Speed)",
        color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
      };
    if (cpm < 430)
      return {
        label: "พูดคุยกระชับกำลังดี (Standard Dialog)",
        color: "text-sky-500 bg-sky-500/10 border-sky-500/20",
      };
    return {
      label: "สปีดแรงกระตุ้นยอดวิว (Viral Fast-Pacing)",
      color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
    };
  };

  useEffect(() => {
    let timer: any;
    if (isPlaying && activeId !== null) {
      // Calculate dynamic playback timeout for the active section
      const activeSectionSec = sections[activeId]
        ? Math.max(
            3,
            Math.round((sections[activeId].text.length / pacingSpeed) * 60),
          )
        : 4;
      timer = setTimeout(() => {
        const nextId = activeId + 1;
        if (nextId < sections.length) {
          setActiveId(nextId);
        } else {
          setIsPlaying(false);
          setActiveId(null);
        }
      }, activeSectionSec * 1000);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, activeId, sections.length, pacingSpeed]);

  const togglePlay = () => {
    if (!isPlaying && activeId === null && sections.length > 0) {
      setActiveId(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleScrub = (idx: number) => {
    setActiveId(idx);
    setTimeout(() => {
      const cardEl = document.getElementById(`section-card-${idx}`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 60);
  };

  const handleSave = () => {
    if (onUpdateContent) onUpdateContent(editedContent);
    setIsEditing(false);
  };

  const handleAutoInjectSpeechMarkers = () => {
    let text = editedContent;
    text = text.replace(/([?？❓])(?!\s*\[pause\])/g, "$1 [pause]");
    text = text.replace(/([!！❗️])(?!\s*\[emphasis\])/g, "$1 [emphasis]");
    text = text.replace(/(ครับ|ค่ะ)(?!\s*\[pause\])/g, "$1 [pause]");
    const paragraphs = text.split("\n");
    const updatedParagraphs = paragraphs.map(p => {
      if (p.startsWith("|") || p.startsWith("#") || p.trim() === "") return p;
      let parts = p.split(" ");
      let accum = 0;
      return parts.map((part, idx) => {
        accum += part.length;
        if (accum > 85 && idx < parts.length - 1 && !part.includes("[")) {
          accum = 0;
          return part + " [breath]";
        }
        return part;
      }).join(" ");
    });
    const finalResult = updatedParagraphs.join("\n");
    setEditedContent(finalResult);
    if (onUpdateContent) onUpdateContent(finalResult);
    alert("✨ เติม Natural Speech Markers (เช่น [pause], [breath], [emphasis]) ในบทพากย์เรียบร้อยแล้ว! ลองจำลองการอ่านพากย์ใหม่อีกครั้งเพื่อรับฟังจังหวะ");
  };

  const handleExportPrompts = () => {
    const prompts = Array.from(visualMap.entries())
      .filter(([_, v]) => v.prompt && v.prompt.trim() !== "")
      .map(
        ([time, v]) =>
          `Timestamp: ${time}\nPrompt: ${v.prompt?.replace(/^"/, "").replace(/"$/, "")}`,
      )
      .join("\n\n----------------------------------------\n\n");

    if (!prompts) {
      alert(
        "ไม่พบข้อมูลรูปภาพ AI สำหรับบทชุดนี้ กรุณาเปลี่ยนสไตล์สคริปต์ให้มีช่อง Visual prompts",
      );
      return;
    }

    const blob = new Blob([prompts], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "google_flow_prompts.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAutoFixIssues = () => {
    let fixCount = 0;
    let newFullResult = fullResult || content;
    let newContent = editedContent;

    // 1. Pacing & Missing Visual Auto-fix
    const pacingIssues = parsedIssues.filter(
      (i) => i.type.startsWith("duration") || i.type === "no_visual",
    );
    if (pacingIssues.length > 0) {
      let currentSeconds = 0;
      let newLines = newFullResult.split("\n");

      const tableLineIndices: number[] = [];
      for (let i = 0; i < newLines.length; i++) {
        const trimmed = newLines[i].trim();
        if (trimmed.startsWith("|") && trimmed.includes("|")) {
          const cells = trimmed
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((c) => c.trim());
          const isSeparator = cells.every((cell) => /^:?-+:?$/.test(cell));
          if (!isSeparator && cells.length > 0) {
            tableLineIndices.push(i);
          }
        }
      }

      let timeIdx = 0;
      if (tableLineIndices.length > 0) {
        const headerRow = newLines[tableLineIndices[0]];
        const cells = headerRow
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((h) => h.trim().toLowerCase());
        timeIdx = cells.findIndex(
          (h) =>
            h.includes("time") ||
            h.includes("เวลา") ||
            h.includes("คิว") ||
            h.includes("timestamp"),
        );
        if (timeIdx === -1) {
          if (tableLineIndices.length > 1) {
            const secondRow = newLines[tableLineIndices[1]]
              .replace(/^\||\|$/g, "")
              .split("|")
              .map((h) => h.trim());
            timeIdx = secondRow.findIndex((cell) =>
              cell.match(/(\d{1,2}:\d{2}(?::\d{2})?)/),
            );
          }
          if (timeIdx === -1) timeIdx = 0;
        }
      }

      sections.forEach((sec, idx) => {
        const formatMin = Math.floor(currentSeconds / 60);
        const formatSec = (currentSeconds % 60).toString().padStart(2, "0");
        const idealTimeStr = `${formatMin}:${formatSec}`;

        let revisedText = sec.text;

        // 1) Update Phase 3 Text
        if (sec.timeString) {
          const bracketRegex = new RegExp(`\\[${sec.timeString}\\]`, "g");
          revisedText = revisedText.replace(bracketRegex, `[${idealTimeStr}]`);
        } else {
          revisedText = `[${idealTimeStr}] ` + revisedText;
        }

        if (revisedText !== sec.text) {
          newContent = newContent.replace(sec.text, revisedText);
          fixCount++;
        }

        // 2) Update corresponding Phase 2 Table line
        if (idx + 1 < tableLineIndices.length) {
          const lineIdx = tableLineIndices[idx + 1];
          const tableLine = newLines[lineIdx];

          const cells = tableLine.replace(/^\||\|$/g, "").split("|");
          if (timeIdx >= 0 && timeIdx < cells.length) {
            const oldCellStr = cells[timeIdx];
            let newCellStr = oldCellStr;

            if (oldCellStr.match(/\[?\d{1,2}:\d{2}(?::\d{2})?\]?/)) {
              newCellStr = oldCellStr.replace(
                /\[?\d{1,2}:\d{2}(?::\d{2})?\]?/,
                `[${idealTimeStr}]`,
              );
            } else {
              newCellStr = ` [${idealTimeStr}] `;
            }

            if (newCellStr !== oldCellStr) {
              cells[timeIdx] = newCellStr;
              newLines[lineIdx] = `| ${cells.join(" | ")} |`;
              fixCount++;
            }
          }
        }

        const charCount = sec.text.replace(/\[\d{1,2}:\d{2}\]/g, "").length;
        const estimatedSpeechSecs = Math.round((charCount / pacingSpeed) * 60);
        currentSeconds += Math.max(8, estimatedSpeechSecs);
      });

      // 3) Reconstruct newFullResult and then apply Text replacements for Phase 3
      let finalFullResult = newLines.join("\n");

      // Now replace the Phase 3 script text in the full result
      // We need to re-run the time mapping to get the revised texts, or we could have stored them.
      let currentSecondsPhase3 = 0;
      sections.forEach((sec) => {
        const formatMin = Math.floor(currentSecondsPhase3 / 60);
        const formatSec = (currentSecondsPhase3 % 60)
          .toString()
          .padStart(2, "0");
        const idealTimeStr = `${formatMin}:${formatSec}`;

        let revisedText = sec.text;
        if (sec.timeString) {
          const bracketRegex = new RegExp(`\\[${sec.timeString}\\]`, "g");
          revisedText = revisedText.replace(bracketRegex, `[${idealTimeStr}]`);
        } else {
          revisedText = `[${idealTimeStr}] ` + revisedText;
        }

        if (revisedText !== sec.text) {
          finalFullResult = finalFullResult.replace(sec.text, revisedText);
        }

        const charCount = sec.text.replace(/\[\d{1,2}:\d{2}\]/g, "").length;
        const estimatedSpeechSecs = Math.round((charCount / pacingSpeed) * 60);
        currentSecondsPhase3 += Math.max(8, estimatedSpeechSecs);
      });
      newFullResult = finalFullResult;
    }

    // 2. Visual Prompt Auto-fix
    parsedIssues.forEach((isu) => {
      if (
        isu.type === "text_warning" ||
        isu.type === "face_warning" ||
        isu.type === "style_warning"
      ) {
        const sec = sections[isu.sectionIndex];
        const visual = sec.visual;
        if (visual && visual.prompt) {
          let originalPrompt = visual.prompt;
          let newPrompt = originalPrompt;

          if (isu.type === "text_warning") {
            newPrompt = newPrompt
              .replace(
                /\b(text|label|logo|letters|writing|word|font|speech bubble|copyright|watermark|banner)\b/gi,
                "",
              )
              .replace(/\s+/g, " ")
              .trim();
          }
          if (isu.type === "face_warning") {
            newPrompt = newPrompt
              .replace(
                /\b(crying|scared face|extremely sad|facial expressions|cartoon|ugly face|shocked face|shouting)\b/gi,
                "abstract silhouette",
              )
              .replace(/\s+/g, " ")
              .trim();
          }
          if (isu.type === "style_warning") {
            if (
              !newPrompt.toLowerCase().includes("cinematic") &&
              !newPrompt.toLowerCase().includes("photorealistic")
            ) {
              newPrompt =
                newPrompt + ", cinematic lighting, 8k, photorealistic";
            }
          }

          if (newPrompt !== originalPrompt && newPrompt !== "") {
            newFullResult = newFullResult.replace(originalPrompt, newPrompt);
            newContent = newContent.replace(originalPrompt, newPrompt);
            fixCount++;
          }
        }
      }
    });

    if (fixCount > 0) {
      setEditedContent(newContent);
      if (onUpdateFullResult) {
        onUpdateFullResult(newFullResult);
      } else if (onUpdateContent) {
        onUpdateContent(newContent);
      }

      const missingVisuals = parsedIssues.filter((i) => i.type === "no_visual");
      if (missingVisuals.length > 0) {
        const ranges = missingVisuals
          .map((i) =>
            sections[i.sectionIndex].timeString
              ? `[${sections[i.sectionIndex].timeString}]`
              : "[Unknown]",
          )
          .join(", ");
        alert(
          `✅ ดำเนินการ Auto-fix ปรับจังหวะเวลาสำเร็จ ${fixCount} จุด\n\n⚠️ อย่างไรก็ตาม จำเป็นต้องแก้ไขด้วยตนเองหรือสั่ง AI เพิ่มเติม:\nคิวเวลา ${ranges} ในสคริปต์ (Phase 3) ไม่มีตารางภาพประกอบ (Phase 2) จับคู่ด้วย`,
        );
      } else {
        alert(
          `✅ ดำเนินการ Auto-fix อัตโนมัติ แก้ไขไปทั้งหมด ${fixCount} จุดสำเร็จเรียบร้อย`,
        );
      }
    } else {
      const missingVisuals = parsedIssues.filter((i) => i.type === "no_visual");
      if (missingVisuals.length > 0) {
        const ranges = missingVisuals
          .map((i) =>
            sections[i.sectionIndex].timeString
              ? `[${sections[i.sectionIndex].timeString}]`
              : "[Unknown]",
          )
          .join(", ");
        alert(
          `❌ ไม่สามารถแก้ไขอัตโนมัติได้ทั้งหมด จำเป็นต้องแก้ไขด้วยตนเอง\nคิวเวลา ${ranges} ในสคริปต์ (Phase 3) ไม่มีตารางภาพประกอบ (Phase 2) จับคู่ด้วย โปรดกลับไปสั่งให้ AI เขียนตารางเพิ่ม`,
        );
      } else {
        alert(
          `💡 ระบบตรวจสอบแล้ว ไม่มีจุดที่สามารถปรับแต่งได้อัตโนมัติ หรือไม่มีข้อผิดพลาดหลงเหลือ`,
        );
      }
    }
  };

  // ADVANCED EXPORTER LOGIC (Text, Markdown, Clipboard)
  const handleExportFullScript = (type: "txt" | "md" | "copy") => {
    let outputText = "";

    if (includeMetadata) {
      outputText += `========================================================\n`;
      outputText += `🎙️ PRODUCTION SCRIPT: ${scriptTitle}\n`;
      outputText += `========================================================\n`;
      outputText += `• โทนอารมณ์เสียงพากย์: ${voicePresets[voiceStyle].name}\n`;
      outputText += `• อัตราความเร็วตามกำหนด: ${pacingSpeed} ตัวอักษรต่อนาที\n`;
      outputText += `• ความยาวสคริปต์รวม: ${totalCharacters.toLocaleString()} ตัวอักษร (~${estimatedWords.toLocaleString()} คำ)\n`;
      outputText += `• เวลาพากย์พูดโดยประมาณ: ${formatPlayTime(playTimeSeconds)} นาที\n`;
      outputText += `• สไลด์คิวเปลี่ยนภาพ (B-Roll): ${totalVisualSlides} ฉาก\n`;
      outputText += `• แนะนำการพากย์: ${voicePresets[voiceStyle].tips}\n`;
      outputText += `• ซิงค์เวลาอัปเดตสคริปต์: ${new Date().toLocaleString("th-TH")}\n`;
      outputText += `========================================================\n\n`;
    }

    // Map script sections with separators & B-rolls
    const processed = sections.map((sec, idx) => {
      let textSec = sec.text.trim();
      if (textSec.startsWith("---")) {
        textSec = textSec.replace(/^---+/, "").trim();
      }
      const header = sec.timeString
        ? `⏱️ [คิวเวลา: ${sec.timeString}]`
        : `⏱️ [ตอนที่ ${idx + 1}]`;

      let visualContent = "";
      if (sec.visual) {
        visualContent = `\n🎬 [จังหวะแสดงภาพ B-Roll]:\n  ➥ แนวคิดเสนอ: "${sec.visual.suggestion}"\n  ➥ เหตุผลภาพ: "${sec.visual.benefit}"`;
        if (sec.visual.prompt) {
          visualContent += `\n  ➥ คำสั่งวาดรูป AI Prompt: "${sec.visual.prompt}"`;
        }
      }
      return `${header}\n${textSec}${visualContent}`;
    });

    // Custom separator joining
    const actualSeparator = `\n\n${exportSeparator}\n\n`;
    outputText += processed.join(actualSeparator);

    if (type === "copy") {
      navigator.clipboard.writeText(outputText).then(() => {
        setCopiedStatus(true);
        setTimeout(() => setCopiedStatus(false), 2000);
      });
      return;
    }

    const blob = new Blob([outputText], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scriptTitle.replace(/\s+/g, "_")}_production.${type}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportStoryboardJSON = () => {
    const storyboardData = {
      project: {
        title: scriptTitle,
        voiceStyle: voicePresets[voiceStyle].name,
        pacingSpeed: pacingSpeed,
        totalCharacters: totalCharacters,
        estimatedWords: estimatedWords,
        playTimeSeconds: playTimeSeconds,
        totalVisualSlides: totalVisualSlides,
        exportedAt: new Date().toISOString(),
      },
      segments: sections.map((sec, idx) => ({
        index: idx + 1,
        timeString: sec.timeString || `Segment ${idx + 1}`,
        scriptText: sec.text.trim(),
        visuals: sec.visual
          ? {
              suggestion: sec.visual.suggestion,
              benefit: sec.visual.benefit,
              prompt: sec.visual.prompt,
            }
          : null,
      })),
    };

    const blob = new Blob([JSON.stringify(storyboardData, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scriptTitle.replace(/\s+/g, "_")}_storyboard.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintStoryboard = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the storyboard.");
      return;
    }

    // Create print HTML
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Storyboard - ${scriptTitle}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; color: #333; }
        h1 { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 5px; }
        .meta { color: #666; font-size: 0.9em; margin-bottom: 30px; display: flex; gap: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; table-layout: fixed; }
        th, td { border: 1px solid #ccc; padding: 15px; vertical-align: top; }
        th { background: #f5f5f5; text-align: left; }
        .time-col { width: 10%; font-weight: bold; }
        .visual-col { width: 45%; }
        .script-col { width: 45%; }
        .visual-prompt { font-style: italic; color: #555; background: #f9f9f9; padding: 8px; border-left: 3px solid #6366f1; margin-top: 10px; font-size: 0.9em; }
        .visual-suggestion { font-weight: bold; margin-bottom: 5px;}
        .visual-benefit { color: #666; font-size: 0.9em; }
        @media print {
          body { padding: 0; }
          .page-break { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <h1>${scriptTitle}</h1>
      <div class="meta">
        <span><b>Style:</b> ${voicePresets[voiceStyle].name}</span>
        <span><b>Estimated Time:</b> ${formatPlayTime(playTimeSeconds)}</span>
        <span><b>Total Scenes:</b> ${totalVisualSlides}</span>
      </div>
      
      <table>
        <thead>
          <tr>
            <th class="time-col">Time</th>
            <th class="visual-col">Visual & B-Roll</th>
            <th class="script-col">Voiceover Script</th>
          </tr>
        </thead>
        <tbody>
          ${sections
            .map(
              (sec, idx) => `
            <tr class="page-break">
              <td class="time-col">${sec.timeString || `Part ${idx + 1}`}</td>
              <td class="visual-col">
                ${
                  sec.visual
                    ? `
                  <div class="visual-suggestion">${sec.visual.suggestion}</div>
                  <div class="visual-benefit">${sec.visual.benefit}</div>
                  ${sec.visual.prompt ? `<div class="visual-prompt">${sec.visual.prompt}</div>` : ""}
                `
                    : `<em>(No Visual Assigned)</em>`
                }
              </td>
              <td class="script-col">${sec.text.replace(/\n/g, "<br/>")}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
      <script>
        setTimeout(() => {
          window.print();
        }, 500);
      </script>
    </body>
    </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 min-h-0">
      {/* 1. TOP CONTROL BAR */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700/50 bg-slate-900 shadow-sm shrink-0 gap-3 overflow-x-auto custom-scrollbar whitespace-nowrap">
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
              showConfigPanel
                ? "bg-slate-700 border-slate-600 text-slate-200"
                : "bg-slate-800/80 border-slate-700 hover:bg-slate-700/80 text-slate-300",
            )}
          >
            <Settings className="w-4 h-4 text-indigo-400" />
            ตั้งค่าการอัปโหลด
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleExportStoryboardJSON()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-500/50 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 rounded-lg text-[11px] font-bold transition-all shadow-sm"
          >
            <FileJson className="w-4 h-4" />
            ดาวน์โหลด JSON
          </button>

          <button
            onClick={() => handlePrintStoryboard()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-purple-500/50 bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 rounded-lg text-[11px] font-bold transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" />
            พิมพ์ Storyboard
          </button>

          <div className="w-px h-6 bg-slate-700 mx-1 hidden sm:block"></div>

          <button
            onClick={() => handleExportFullScript("txt")}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-500/50 bg-blue-600/10 hover:bg-blue-600/20 text-blue-300 rounded-lg text-[11px] font-bold transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            ดาวน์โหลด TXT
          </button>

          <button
            onClick={() => handleExportFullScript("copy")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-sm",
              copiedStatus
                ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/50"
                : "bg-slate-800 border-slate-600 hover:bg-slate-700 text-slate-200 border",
            )}
            disabled={copiedStatus}
          >
            {copiedStatus ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copiedStatus ? "คัดลอกลงในคลิปบอร์ดแล้ว" : "คัดลอกทั้งหมด"}
          </button>

          <div className="w-px h-6 bg-slate-700 mx-1 hidden sm:block"></div>

          <button
            onClick={togglePlay}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold text-[11px] transition-all transform active:scale-95 shadow-sm",
              isPlaying
                ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20",
            )}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 animate-pulse" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            {isPlaying ? "หยุดจำลอง" : "จำลองการอ่านพากย์"}
          </button>
        </div>
      </div>

      <div
        className="flex-1 overflow-auto custom-scrollbar p-1 pb-4 flex flex-col gap-2 min-h-0"
      >
        {/* 2. ADVANCED CONTROL DRAWERS (Slight Slide & Expand motion panels) */}
        <AnimatePresence>
          {showConfigPanel && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden border border-slate-700/50 rounded-xl mb-4 bg-slate-900/60 p-4 mx-1 flex flex-col gap-4 text-xs select-none"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left Column: 🗣️ Podcast Voice Style & Pacing Guide Panel */}
                <div className="space-y-3 border-r border-slate-800/60 pr-0 lg:pr-5">
                  <div className="flex items-center gap-2 font-bold text-slate-200 text-sm">
                    <Mic className="w-4 h-4 text-blue-400" />
                    <span>🗣️ แผงควบคุมสไตล์ & ระดับความเร็วของเสียงพากย์</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    เลือกประเภทพอดแคสต์เพื่อปรับระดับความเร็ว (Character Speed)
                    ในระบบจำลองแบบอัตโนมัติ
                  </p>

                  {/* Preset Picker Cards */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {Object.entries(voicePresets).map(([key, config]) => {
                      const active = voiceStyle === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleApplyPreset(key as any)}
                          className={cn(
                            "p-2 rounded-lg border text-left transition-all cursor-pointer",
                            active
                              ? "bg-blue-950/40 border-blue-500/80 text-blue-200 ring-1 ring-blue-500/40"
                              : "bg-slate-800/45 border-slate-700/40 hover:bg-slate-800/80 text-slate-300",
                          )}
                        >
                          <div className="font-bold flex items-center justify-between mb-0.5">
                            <span className="truncate">{config.name}</span>
                            {active && (
                              <span className="text-[10px] bg-blue-500 text-white px-1 rounded-sm">
                                ใช้งาน
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 line-clamp-1 leading-snug">
                            {config.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Speed Slider Configuration */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 font-medium">
                        ความเร็วพากย์เฉลี่ย (CPM - อักษรต่อนาที)
                      </span>
                      <span className="font-mono font-bold text-blue-400 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-900/40">
                        {pacingSpeed} Chars/Min
                      </span>
                    </div>
                    <input
                      type="range"
                      min={180}
                      max={550}
                      step={10}
                      value={pacingSpeed}
                      onChange={(e) => {
                        setPacingSpeed(parseInt(e.target.value));
                        setVoiceStyle("educational"); // Reset custom state to custom
                      }}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>🐢 ช้าพากย์ลึกซึ้ง (180)</span>
                      <span>🐰 เร่งไวสปอนเซอร์ (550)</span>
                    </div>
                  </div>

                  {/* Speed feedback badge */}
                  <div
                    className={cn(
                      "text-[11px] p-2 rounded-lg border",
                      getPacingLabel(pacingSpeed).color,
                    )}
                  >
                    <div className="font-bold mb-0.5">
                      สถานะระดับความเร็ว: {getPacingLabel(pacingSpeed).label}
                    </div>
                    <div className="text-slate-300 font-medium text-[10px] leading-relaxed">
                      เทียบเท่ากับความเร็วการพากย์เสียงประมาน{" "}
                      <b className="font-mono text-xs">
                        {Math.round(pacingSpeed / 3.8)}
                      </b>{" "}
                      คำเดี่ยวต่อนาที (WPM equivalent)
                    </div>
                  </div>
                </div>

                {/* Right Column: 📂 One-Click Export & Metadata Separator Tools */}
                <div className="space-y-3 flex flex-col justify-between">
                  {/* 🎧 High-Grade TTS Generator Section  */}
                  <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-lg">
                    <div className="flex items-center gap-2 font-bold text-indigo-300 text-sm mb-2">
                      <Volume2 className="w-4 h-4 text-indigo-400" />
                      <span>🎧 พากย์เสียง AI คุณภาพ Premium</span>
                    </div>
                    <div className="space-y-2">
                      <select
                        value={googleTtsVoice}
                        onChange={(e) => setGoogleTtsVoice(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200 text-[11px] focus:outline-none focus:border-indigo-500"
                      >
                        {premiumVoices.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label} ({v.id})
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={handleGenerateAudio}
                          disabled={isGeneratingTts}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-semibold transition-all text-xs text-white",
                            isGeneratingTts
                              ? "bg-indigo-700/50 cursor-not-allowed"
                              : "bg-indigo-600 hover:bg-indigo-500 shadow-sm",
                          )}
                        >
                          {isGeneratingTts ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Mic className="w-3.5 h-3.5" />
                          )}
                          {isGeneratingTts
                            ? "กำลังเชื่อมต่อ Google Cloud..."
                            : "สร้างเสียงพากย์ฉบับเต็ม"}
                        </button>

                        {ttsAudioUrl && (
                          <a
                            href={ttsAudioUrl}
                            download="podcast_voice.mp3"
                            className="p-1.5 bg-slate-800 border fill-indigo-200 border-slate-600 rounded flex-shrink-0 hover:bg-slate-700 transition"
                            title="ดาวน์โหลดไฟล์เสียง"
                          >
                            <Download className="w-4 h-4 text-emerald-400" />
                          </a>
                        )}
                      </div>
                      {ttsAudioUrl && (
                        <div className="flex flex-col gap-1 mt-2">
                          <audio
                            controls
                            src={ttsAudioUrl}
                            className="w-full h-8 rounded"
                            onLoadedMetadata={(e) =>
                              setTtsDuration(e.currentTarget.duration)
                            }
                          />
                          {ttsDuration !== null && (
                            <div className="text-[10px] text-indigo-300 ml-1 mt-0.5">
                              ⏱️ ความยาวเสียงพากย์:{" "}
                              {Math.floor(ttsDuration / 60)} นาที{" "}
                              {Math.floor(ttsDuration % 60)
                                .toString()
                                .padStart(2, "0")}{" "}
                              วินาที
                              <span className="block mt-0.5 opacity-90">
                                🖼️ โปรเจคนี้ควรใช้ภาพประกอบประมาณ{" "}
                                <strong className="text-white bg-indigo-500/30 px-1 py-0.5 rounded">
                                  {Math.ceil(ttsDuration / 15)} -{" "}
                                  {Math.ceil(ttsDuration / 8)} ภาพ
                                </strong>{" "}
                                (สำหรับเปลี่ยนภาพทุก 8-15 วินาที)
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-2 bg-indigo-900/40 p-2 rounded border border-indigo-700/50 flex items-start gap-2 text-[10px] text-indigo-200">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <strong>นโยบาย YouTube:</strong> เสียง Journey และ
                          Studio มีความสมจริงระดับสูง เพื่อป้องกันการละเมิด
                          Content Policy ให้กดติ๊กเลือกข้อมูล{" "}
                          <b>"เนื้อหาที่มีการเปลี่ยนแปลง (Altered content)"</b>{" "}
                          ตอนอัปโหลดวิดีโอเสมอ
                          และแนะนำให้สลับภาพสม่ำเสมอเพื่อไม่ให้เข้าข่าย{" "}
                          <i>
                            "วิดีโอที่เป็นสไลด์หรือมีแต่เสียงบรรยาย AI
                            โดยไม่มีฉากที่มีการเปลี่ยนแปลงอย่างมีนัยสำคัญ"
                          </i>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t border-slate-800 pt-2">
                    <div className="flex items-center gap-2 font-bold text-slate-200 text-sm">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <span>
                        📂 ระบบตั้งค่าขั้นสูงสำหรับการคัดลอก & ส่งออกสคริปต์
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      เพิ่มข้อมูลความคุ้มค่า (Metadata Summary)
                      และแต่งกรองพารามิเตอร์การแบ่งคิวอย่างอิสระ
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
                      {/* Metadata summary input name */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          ชื่อเรื่องตอน / ตอนการผลิต
                        </label>
                        <input
                          type="text"
                          value={scriptTitle}
                          onChange={(e) => setScriptTitle(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                          placeholder="ตั้งชื่อไฟล์สคริปต์"
                        />
                      </div>
                      {/* Separator Picker */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          การแบ่งคิวเสียง (Separator)
                        </label>
                        <select
                          value={exportSeparator}
                          onChange={(e) => setExportSeparator(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                        >
                          <option value="---">ใช้ขีดขั้นมาตรฐาน (---)</option>
                          <option value="========================================">
                            เส้นคั่นยาวแนวหนา (===)
                          </option>
                          <option value="[SECTION_BREAK]">
                            สไตล์โปรแกรมมิ่ง ดิจิทัล [SECTION_BREAK]
                          </option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative w-full z-10 pointer-events-auto">
          {/* Absolute Hover details popup card */}
          <AnimatePresence>
            {hoveredTimelineIdx !== null &&
              timelineBlocks[hoveredTimelineIdx] && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className={cn(
                    "absolute bottom-full left-1/2 -translate-x-1/2 mb-3 border rounded-xl p-3 shadow-xl z-50 w-72 max-w-sm pointer-events-none backdrop-blur-md",
                    theme === "light"
                      ? "bg-white/95 text-slate-800 border-indigo-200 shadow-indigo-100"
                      : "bg-slate-950/95 text-slate-200 border-indigo-500/40 shadow-slate-950",
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[9.5px] font-bold text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                      🎬 ฉากที่ {hoveredTimelineIdx + 1} (S
                      {hoveredTimelineIdx + 1})
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[9.5px] font-bold",
                        theme === "light" ? "text-slate-600" : "text-slate-400",
                      )}
                    >
                      ⏱️{" "}
                      {timelineBlocks[hoveredTimelineIdx].timeString || "0:00"}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "font-bold text-[11px] truncate mb-1.5",
                      theme === "light" ? "text-slate-900" : "text-slate-200",
                    )}
                  >
                    {timelineBlocks[hoveredTimelineIdx].label}
                  </div>
                  <div
                    className={cn(
                      "grid grid-cols-2 gap-2 text-[10px] pt-1.5 mb-1.5 border-t",
                      theme === "light"
                        ? "text-slate-600 border-slate-100"
                        : "text-slate-400 border-slate-800/85",
                    )}
                  >
                    <div>
                      <span className="block opacity-80">ความยาวหน้าฉาก:</span>
                      <strong
                        className={
                          theme === "light"
                            ? "text-slate-800"
                            : "text-slate-200"
                        }
                      >
                        {Math.round(
                          timelineBlocks[hoveredTimelineIdx].duration,
                        )}{" "}
                        วินาที
                      </strong>
                    </div>
                    <div>
                      <span className="block opacity-80">สัดส่วนในวิดีโอ:</span>
                      <strong
                        className={
                          theme === "light"
                            ? "text-slate-800"
                            : "text-slate-200"
                        }
                      >
                        {Math.round(
                          timelineBlocks[hoveredTimelineIdx].percentWidth,
                        )}
                        % ของช่อง
                      </strong>
                    </div>
                  </div>

                  {sections[hoveredTimelineIdx]?.visual && (
                    <div
                      className={cn(
                        "p-1.5 rounded text-[10px] space-y-1 border",
                        theme === "light"
                          ? "bg-slate-50 border-slate-200"
                          : "bg-slate-900 border-slate-800",
                      )}
                    >
                      <div className="text-violet-505 font-bold leading-none flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>AI Image Prompt:</span>
                      </div>
                      <p
                        className={cn(
                          "line-clamp-2 select-none italic text-[9.5px]",
                          theme === "light"
                            ? "text-slate-700"
                            : "text-slate-300",
                        )}
                      >
                        "
                        {sections[hoveredTimelineIdx].visual?.prompt ||
                          "ไม่มีคีย์เวิร์ด Prompt"}
                        "
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
          </AnimatePresence>

          {/* Simulated Multi-Segment Proportional Progress Bar Track */}
          <div
            className={cn(
              "h-12 w-full rounded-lg p-1 border flex items-stretch gap-1 relative overflow-hidden backdrop-blur-sm select-none pointer-events-auto",
              theme === "light"
                ? "bg-slate-200 border-slate-300/80"
                : "bg-slate-950/60 border-slate-800",
            )}
          >
            {timelineBlocks.map((block, bIdx) => {
              const isActive = activeId === bIdx;
              const isHovered = hoveredTimelineIdx === bIdx;
              const hasVisualPrompt = !!sections[bIdx]?.visual?.prompt;

              return (
                <button
                  key={bIdx}
                  type="button"
                  style={{ width: `${block.percentWidth}%` }}
                  className={cn(
                    "relative h-full rounded transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between items-center text-center p-1 group shrink-0 min-w-[20px] pointer-events-auto z-10",
                    isActive
                      ? theme === "light"
                        ? "bg-indigo-600 border-2 border-indigo-700 shadow-[0_0_10px_rgba(79,70,229,0.3)] text-white font-black scale-[1.01] z-25"
                        : "bg-gradient-to-b from-indigo-500/30 to-indigo-600/40 border-2 border-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.25)] ring-1 ring-indigo-400/30 text-white font-black scale-[1.01] z-25"
                      : isHovered
                        ? theme === "light"
                          ? "bg-slate-300 border border-indigo-500 text-indigo-800"
                          : "bg-slate-800 border border-indigo-400/50 text-indigo-300"
                        : theme === "light"
                          ? "bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900"
                          : "bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400",
                  )}
                  onClick={() => handleScrub(bIdx)}
                  onMouseEnter={() => setHoveredTimelineIdx(bIdx)}
                  onMouseLeave={() => setHoveredTimelineIdx(null)}
                >
                  {/* Tiny block sequence number label */}
                  <span className="text-[10px] leading-none font-mono tracking-tighter pointer-events-none">
                    S{bIdx + 1}
                  </span>

                  {/* Tiny prompt indicator light dot */}
                  {hasVisualPrompt && (
                    <span
                      className={cn(
                        "w-1 h-1 rounded-full pointer-events-none",
                        isActive
                          ? "bg-white animate-ping"
                          : "bg-violet-400 group-hover:bg-violet-500",
                      )}
                    ></span>
                  )}

                  {/* Active/Pause line slider head overlay inside block */}
                  {isActive && (
                    <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-sky-400 drop-shadow-md animate-pulse pointer-events-none"></div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Time Marker Ruler */}
          <div
            className={cn(
              "relative h-6 mt-1 flex justify-between px-1 font-mono text-[9px] pointer-events-none select-none",
              theme === "light" ? "text-slate-500" : "text-slate-400",
            )}
          >
            {timelineBlocks.length > 0 && (
              <>
                <div className="absolute left-0">
                  <span
                    className={cn(
                      "block h-1.5 w-[1px] mx-auto",
                      theme === "light" ? "bg-slate-400" : "bg-slate-800",
                    )}
                  ></span>
                  <span>0:00</span>
                </div>

                {/* Print intermediate markers for perfect resolve layout context */}
                {timelineBlocks
                  .slice(1, -1)
                  .filter((_, i, arr) => {
                    const step = Math.max(1, Math.floor(arr.length / 3));
                    return i % step === 0;
                  })
                  .map((item, mIdx) => (
                    <div
                      key={mIdx}
                      className="absolute"
                      style={{
                        left: `${item.percentStart}%`,
                        transform: "translateX(-50%)",
                      }}
                    >
                      <span
                        className={cn(
                          "block h-1.5 w-[1px] mx-auto",
                          theme === "light" ? "bg-slate-400" : "bg-slate-800",
                        )}
                      ></span>
                      <span>{item.timeString || "0:00"}</span>
                    </div>
                  ))}

                <div className="absolute right-0 text-right">
                  <span
                    className={cn(
                      "block h-1.5 w-[1px] ml-auto",
                      theme === "light" ? "bg-slate-400" : "bg-slate-800",
                    )}
                  ></span>
                  <span>{formatPlayTime(playTimeSeconds)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 🔍 AI Script-Visual Alignment Inspector (ระบบตรวจความสอดคล้องอัจฉริยะ) */}
        <div
          className={cn(
            "mx-1 rounded-xl border p-4 transition-all duration-300 shadow-sm relative overflow-hidden pointer-events-auto z-10",
            theme === "light"
              ? "bg-white border-slate-200"
              : "bg-slate-900/40 border-slate-800",
          )}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setIsAuditorExpanded(!isAuditorExpanded)}
          >
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "p-1.5 rounded-lg flex items-center justify-center shrink-0",
                  calculatedScore >= 90
                    ? "bg-emerald-500/10 text-emerald-500"
                    : calculatedScore >= 70
                      ? "bg-amber-500/10 text-amber-500"
                      : "bg-rose-500/10 text-rose-500",
                )}
              >
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3
                  className={cn(
                    "text-sm font-bold flex items-center gap-1.5",
                    theme === "light" ? "text-slate-800" : "text-slate-200",
                  )}
                >
                  <span>🔍 ตัวตรวจจับความสอดคล้องสคริปต์ & ภาพคิว</span>
                  <span
                    className={cn(
                      "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ml-1",
                      calculatedScore >= 90
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : calculatedScore >= 70
                          ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                          : "bg-rose-500/20 text-rose-600 dark:text-rose-400",
                    )}
                  >
                    Health: {calculatedScore}%
                  </span>
                </h3>
                <p
                  className={cn(
                    "text-[10.5px] font-sans mt-0.5 leading-relaxed",
                    theme === "light" ? "text-slate-650" : "text-slate-400",
                  )}
                >
                  วิเคราะห์จังหวะความเร็วพูดต่อนิพจน์สไลด์
                  และความสมเหตุสมผลตามเกณฑ์จรรยาบรรณผู้ผลิต YouTube
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {parsedIssues.length > 0 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAutoFixIssues();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-sm transition-all active:scale-95"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>แก้ไขพัง/เวลา (Auto-Fix)</span>
                  </button>
                  {parsedIssues.filter((i) => i.type === "no_visual").length >
                    0 &&
                    onAIAssistFix && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const missingRanges = parsedIssues
                            .filter((i) => i.type === "no_visual")
                            .map((i) =>
                              sections[i.sectionIndex].timeString
                                ? `[${sections[i.sectionIndex].timeString}]`
                                : "",
                            )
                            .filter(Boolean);
                          onAIAssistFix(
                            "no_visual",
                            missingRanges,
                            fullResult || content,
                          );
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shadow-sm transition-all active:scale-95"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="max-w-[120px] truncate whitespace-nowrap">
                          ชดเชยวิชวล (AI)
                        </span>
                      </button>
                    )}
                  {parsedIssues.filter((i) => i.type === "no_prompt").length >
                    0 &&
                    onAIAssistFix && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const missingRanges = parsedIssues
                            .filter((i) => i.type === "no_prompt")
                            .map((i) =>
                              sections[i.sectionIndex].timeString
                                ? `[${sections[i.sectionIndex].timeString}]`
                                : "",
                            )
                            .filter(Boolean);
                          onAIAssistFix(
                            "no_prompt",
                            missingRanges,
                            fullResult || content,
                          );
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-bold shadow-sm transition-all active:scale-95"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="max-w-[120px] truncate whitespace-nowrap">
                          เติม Prompt (AI)
                        </span>
                      </button>
                    )}
                  {parsedIssues.filter((i) => i.type === "duration_long")
                    .length > 0 &&
                    onAIAssistFix && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const missingRanges = parsedIssues
                            .filter((i) => i.type === "duration_long")
                            .map((i) =>
                              sections[i.sectionIndex].timeString
                                ? `[${sections[i.sectionIndex].timeString}]`
                                : "",
                            )
                            .filter(Boolean);
                          onAIAssistFix(
                            "duration_long",
                            missingRanges,
                            fullResult || content,
                          );
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold shadow-sm transition-all active:scale-95"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="max-w-[120px] truncate whitespace-nowrap">
                          แก้ค้าง / ซอยภาพ (AI)
                        </span>
                      </button>
                    )}
                  {parsedIssues.filter((i) =>
                    ["text_warning", "style_warning", "face_warning"].includes(
                      i.type,
                    ),
                  ).length > 0 &&
                    onAIAssistFix && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const problemRanges = parsedIssues
                            .filter((i) =>
                              [
                                "text_warning",
                                "style_warning",
                                "face_warning",
                              ].includes(i.type),
                            )
                            .map((i) =>
                              sections[i.sectionIndex].timeString
                                ? `[${sections[i.sectionIndex].timeString}]`
                                : "",
                            )
                            .filter(Boolean);
                          // Filter out duplicates
                          const uniqueRanges = Array.from(
                            new Set(problemRanges),
                          );
                          onAIAssistFix(
                            "prompt_warning",
                            uniqueRanges,
                            fullResult || content,
                          );
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-[11px] font-bold shadow-sm transition-all active:scale-95"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="max-w-[120px] truncate whitespace-nowrap">
                          แก้หมวดเสี่ยง (AI)
                        </span>
                      </button>
                    )}
                </>
              )}
              <button
                className={cn(
                  "transition-colors text-slate-500 hover:text-slate-800 dark:hover:text-slate-300",
                )}
              >
                {isAuditorExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Collapsible Content */}
          {isAuditorExpanded && (
            <div
              className={cn(
                "mt-4 pt-4 border-t space-y-4",
                theme === "light" ? "border-slate-100" : "border-slate-800/60",
              )}
            >
              {/* Top Summary Metrics Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                <div
                  className={cn(
                    "p-2.5 rounded-lg space-y-1 border",
                    theme === "light"
                      ? "bg-slate-50/50 border-slate-150"
                      : "bg-slate-950/40 border-slate-800/50",
                  )}
                >
                  <div
                    className={cn(
                      "font-medium flex items-center gap-1",
                      theme === "light" ? "text-slate-600" : "text-slate-400",
                    )}
                  >
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    <span>ดัชนีจังหวะเวลา (Pacing Health)</span>
                  </div>
                  <div
                    className={cn(
                      "text-xs font-bold",
                      theme === "light" ? "text-slate-800" : "text-slate-205",
                    )}
                  >
                    {parsedIssues.filter((i) => i.type.startsWith("duration"))
                      .length === 0
                      ? "🤩 สมบูรณ์แบบเว้นคิวสม่ำเสมอ"
                      : `⚠️ ตรวจพิวหลุดจังหวะ ${parsedIssues.filter((i) => i.type.startsWith("duration")).length} ส่วน`}
                  </div>
                </div>

                <div
                  className={cn(
                    "p-2.5 rounded-lg space-y-1 border",
                    theme === "light"
                      ? "bg-slate-50/50 border-slate-150"
                      : "bg-slate-950/40 border-slate-800/50",
                  )}
                >
                  <div
                    className={cn(
                      "font-medium flex items-center gap-1",
                      theme === "light" ? "text-slate-600" : "text-slate-400",
                    )}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                    <span>ภาพกวีและสไตล์หรูหรา (Styling Metaphors)</span>
                  </div>
                  <div
                    className={cn(
                      "text-xs font-bold",
                      theme === "light" ? "text-slate-800" : "text-slate-205",
                    )}
                  >
                    {parsedIssues.filter(
                      (i) =>
                        i.type === "style_warning" || i.type === "face_warning",
                    ).length === 0
                      ? "🎨 ความรื่นรมย์และอารมณ์พรอพต์หรูหราสูง"
                      : `💡 มีข้อแนะนำปรับแต่งงานศิลปะ ${parsedIssues.filter((i) => i.type === "style_warning" || i.type === "face_warning").length} จุด`}
                  </div>
                </div>

                <div
                  className={cn(
                    "p-2.5 rounded-lg space-y-1 border",
                    theme === "light"
                      ? "bg-slate-50/50 border-slate-150"
                      : "bg-slate-950/40 border-slate-800/50",
                  )}
                >
                  <div
                    className={cn(
                      "font-medium flex items-center gap-1",
                      theme === "light" ? "text-slate-600" : "text-slate-400",
                    )}
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      นโยบายความแท้จริง YouTube (Inauthentic compliance)
                    </span>
                  </div>
                  <div
                    className={cn(
                      "text-xs font-bold",
                      theme === "light" ? "text-slate-800" : "text-slate-205",
                    )}
                  >
                    {parsedIssues.filter((i) => i.severity === "error")
                      .length === 0
                      ? "🛡️ ผ่านเกณฑ์ปราศจากคำห้าม/โลโก้"
                      : `❌ มีจุดเสี่ยงแบนรุนแรง ${parsedIssues.filter((i) => i.severity === "error").length} ตำแหน่ง`}
                  </div>
                </div>
              </div>

              {/* Filtering bar if there are issues */}
              {parsedIssues.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={cn(
                      "text-[10px] font-bold mr-2 uppercase tracking-wider",
                      theme === "light" ? "text-slate-500" : "text-slate-405",
                    )}
                  >
                    ประเภทปัญหา:
                  </span>
                  {(["all", "error", "warning", "info"] as const).map(
                    (filterOpt) => {
                      const count =
                        filterOpt === "all"
                          ? parsedIssues.length
                          : parsedIssues.filter((i) => i.severity === filterOpt)
                              .length;
                      return (
                        <button
                          key={filterOpt}
                          onClick={() => setAuditorFilter(filterOpt)}
                          className={cn(
                            "px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer",
                            auditorFilter === filterOpt
                              ? filterOpt === "error"
                                ? theme === "light"
                                  ? "bg-rose-550 text-white border-rose-600"
                                  : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                                : filterOpt === "warning"
                                  ? theme === "light"
                                    ? "bg-amber-550 text-white border-amber-605"
                                    : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                  : filterOpt === "info"
                                    ? theme === "light"
                                      ? "bg-sky-550 text-white border-sky-605"
                                      : "bg-sky-500/20 text-sky-400 border-sky-500/30"
                                    : "bg-indigo-600 text-white border-indigo-705"
                              : theme === "light"
                                ? "bg-slate-100 hover:bg-slate-200 border-slate-250 text-slate-700 hover:text-slate-900"
                                : "bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200",
                          )}
                        >
                          {filterOpt === "all"
                            ? "ทั้งหมด"
                            : filterOpt === "error"
                              ? "เสี่ยงถูกปฏิเสธสร้างรายได้"
                              : filterOpt === "warning"
                                ? "ตักเตือน/ปรับจังหวะ"
                                : "ข้อแนะนำศิลปะ"}
                          <span className="ml-1 opacity-85">({count})</span>
                        </button>
                      );
                    },
                  )}
                </div>
              )}

              {/* Issues List with elegant rows */}
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2 pr-1 pointer-events-auto">
                {parsedIssues.length === 0 ? (
                  <div
                    className={cn(
                      "p-4 border rounded-lg flex flex-col items-center justify-center text-center py-6",
                      theme === "light"
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-emerald-950/10 border-emerald-500/20",
                    )}
                  >
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2 animate-bounce" />
                    <p
                      className={cn(
                        "font-bold text-xs",
                        theme === "light"
                          ? "text-emerald-800"
                          : "text-emerald-400",
                      )}
                    >
                      ยินดีด้วย! บทรสสัญญะและภาพสอดคล้องกันสูงสุด 100%
                    </p>
                    <p
                      className={cn(
                        "text-[10.5px] mt-1 max-w-md",
                        theme === "light" ? "text-slate-650" : "text-slate-400",
                      )}
                    >
                      จังหวะเวลาพอเหมาะสำหรับการเปลี่ยนรูปภาพ และ Prompt
                      ภาพประกอบไม่มีจุดผิดสังเกตกฎความปลอดภัย
                      แนะนำให้นำบทนี้ไปสร้างสรรค์งานต่อได้ทันที!
                    </p>
                  </div>
                ) : (
                  parsedIssues
                    .filter(
                      (i) =>
                        auditorFilter === "all" || i.severity === auditorFilter,
                    )
                    .map((isu) => (
                      <div
                        key={isu.id}
                        className={cn(
                          "p-3 rounded-lg border text-xs flex flex-col sm:flex-row items-start gap-3 transition-colors",
                          isu.severity === "error"
                            ? theme === "light"
                              ? "bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100/40"
                              : "bg-rose-950/10 border-rose-500/20 hover:bg-rose-950/20"
                            : isu.severity === "warning"
                              ? theme === "light"
                                ? "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100/40"
                                : "bg-amber-950/10 border-amber-500/20 hover:bg-amber-950/20"
                              : theme === "light"
                                ? "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100"
                                : "bg-slate-950/30 border-slate-800 hover:bg-slate-950/50",
                        )}
                      >
                        {/* Status tag */}
                        <div
                          className={cn(
                            "px-2 py-1 rounded text-[9.5px] font-extrabold shrink-0 uppercase tracking-widest font-mono text-center min-w-[65px]",
                            isu.severity === "error"
                              ? theme === "light"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-rose-500/10 text-rose-400"
                              : isu.severity === "warning"
                                ? theme === "light"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-amber-500/10 text-amber-400"
                                : theme === "light"
                                  ? "bg-sky-100 text-sky-850"
                                  : "bg-sky-500/10 text-sky-400",
                          )}
                        >
                          ⏱️ {isu.timeString}
                        </div>

                        {/* Issue description */}
                        <div className="space-y-1 flex-1">
                          <div
                            className={cn(
                              "font-bold flex items-center gap-2",
                              theme === "light"
                                ? "text-slate-800"
                                : "text-slate-205",
                            )}
                          >
                            <span>{isu.title}</span>
                          </div>
                          <p
                            className={cn(
                              "text-[11px] leading-relaxed font-sans",
                              theme === "light"
                                ? "text-slate-650"
                                : "text-slate-350",
                            )}
                          >
                            {isu.description}
                          </p>
                          <div
                            className={cn(
                              "mt-2 p-2 rounded text-[11px] leading-relaxed flex items-start gap-1.5",
                              isu.severity === "error"
                                ? theme === "light"
                                  ? "bg-rose-100/60 text-rose-900"
                                  : "bg-rose-500/5 text-rose-300"
                                : isu.severity === "warning"
                                  ? theme === "light"
                                    ? "bg-amber-100/60 text-amber-900"
                                    : "bg-amber-500/5 text-amber-300"
                                  : theme === "light"
                                    ? "bg-sky-100/60 text-sky-900"
                                    : "bg-sky-500/5 text-sky-300",
                            )}
                          >
                            <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 animate-pulse" />
                            <div>
                              <strong
                                className={
                                  theme === "light"
                                    ? "text-slate-900"
                                    : "text-white"
                                }
                              >
                                แนวทางแก้ไขด่วน:
                              </strong>{" "}
                              {isu.actionable}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>
        {/* 3. ⏱️ Playtime & Word Count Metrics Screen (เครื่องมือวัดเวลาและสถิติสคริปต์เชิงลึก) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mx-1 select-none shrink-0">
          {/* Estimated Playtime Smart Screen Card */}
          <div
            className={cn(
              "p-3 rounded-xl border flex flex-col justify-between relative overflow-hidden shadow-sm transition-all duration-300 transform hover:scale-[1.01]",
              isPlaying
                ? "bg-gradient-to-br from-indigo-950/40 to-blue-950/45 border-blue-500/55 text-blue-200 ring-1 ring-blue-500/20"
                : theme === "light"
                  ? "bg-white border-slate-205"
                  : "bg-slate-800/40 border-slate-700/50",
            )}
          >
            {isPlaying && (
              <div className="absolute right-2 top-2 flex items-center justify-center gap-0.5 pointer-events-none">
                {/* Dynamic Sound Wave Elements */}
                <span
                  className="w-[2px] h-3 bg-blue-400 rounded animate-[pulse_0.6s_infinite_alternate]"
                  style={{ animationDelay: "0.1s" }}
                ></span>
                <span
                  className="w-[2px] h-4 bg-sky-400 rounded animate-[pulse_0.5s_infinite_alternate]"
                  style={{ animationDelay: "0.25s" }}
                ></span>
                <span
                  className="w-[2px] h-2 bg-blue-300 rounded animate-[pulse_0.7s_infinite_alternate]"
                  style={{ animationDelay: "0.4s" }}
                ></span>
              </div>
            )}
            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>⏱️ เวลาพากย์โดยประมาน (Est. Playtime)</span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-blue-500 dark:text-sky-400 leading-none">
                {formatPlayTime(playTimeSeconds)}
              </div>
              <div className="text-[10px] text-slate-400 font-medium mt-1">
                {isPlaying
                  ? "🔴 กำลังทดสอบเวลาพจนานุกรม..."
                  : "พากย์ปกติบวกคิวสไลด์เสี้ยววิ"}
              </div>
            </div>
          </div>

          {/* Word estimation and density indicator */}
          <div
            className={cn(
              "p-3 rounded-xl border flex flex-col justify-between shadow-sm hover:scale-[1.01] transition-all duration-300",
              theme === "light"
                ? "bg-white border-slate-205"
                : "bg-slate-800/40 border-slate-700/50",
            )}
          >
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>จำนวนตัวอักษร / คำประเมิน</span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-200 truncate leading-none">
                {totalCharacters.toLocaleString()}{" "}
                <span className="text-[10px] font-normal text-slate-400">
                  ตัว (~{estimatedWords.toLocaleString()} คำ)
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium mt-1">
                คำนวนโดยเฉลี่ยสัดส่วนพยัญชนะไทยสะกด
              </div>
            </div>
          </div>

          {/* Visual cues distribution count metrics */}
          <div
            className={cn(
              "p-3 rounded-xl border flex flex-col justify-between shadow-sm hover:scale-[1.01] transition-all duration-300",
              theme === "light"
                ? "bg-white border-slate-205"
                : "bg-slate-800/40 border-slate-700/50",
            )}
          >
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <ImagePlus className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span>จำนวนฉากตัดเปลี่ยน B-Roll</span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-extrabold font-mono text-violet-400 leading-none">
                {totalVisualSlides}{" "}
                <span className="text-[10px] font-normal text-slate-400">
                  จุดเปลี่ยนภาพ
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium mt-1">
                สลับทุกๆ ~
                {totalVisualSlides > 0
                  ? Math.round(playTimeSeconds / totalVisualSlides)
                  : 0}{" "}
                วินาที (ยอดตัดสลับเหมาะพอดี)
              </div>
            </div>
          </div>

          {/* Dynamic Speech Pacing / Breathing Guidance panel */}
          <div
            className={cn(
              "p-3 rounded-xl border flex flex-col justify-between shadow-sm hover:scale-[1.01] transition-all duration-300",
              theme === "light"
                ? "bg-white border-slate-205"
                : "bg-slate-800/40 border-slate-700/50",
            )}
          >
            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>🎙️ คำแนะนำน้ำเสียง & สมาธิผู้พากย์</span>
            </div>
            <div className="space-y-0.5 leading-snug">
              <div className="text-[11px] font-bold text-slate-200 line-clamp-1">
                สไตล์: {voicePresets[voiceStyle].name}
              </div>
              <div className="text-[10.5px] text-slate-400 font-medium leading-relaxed italic line-clamp-2">
                {voicePresets[voiceStyle].tips}
              </div>
            </div>
          </div>
        </div>

        {/* 📊 Script Duration Analysis Chart */}
        <div
          className={cn(
            "mx-1 p-4 rounded-xl border mt-2 shrink-0 transition-all duration-300",
            theme === "light"
              ? "bg-white border-slate-205 shadow-sm"
              : "bg-slate-800/40 border-slate-700/50",
          )}
        >
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              📊 การกระจายระยะเวลาแต่ละช่วง (Script Duration Breakdown)
            </span>
          </div>

          <div className="h-44 w-full min-w-0 min-h-0">
            {showChart && (
              <ResponsiveContainer width="99%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={theme === "light" ? "#e2e8f0" : "#334155"}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke={theme === "light" ? "#94a3b8" : "#64748b"}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke={theme === "light" ? "#94a3b8" : "#64748b"}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${Math.round(val)}s`}
                  />
                  <Tooltip
                    cursor={{ fill: theme === "light" ? "#f8fafc" : "#1e293b" }}
                    contentStyle={{
                      backgroundColor: theme === "light" ? "#ffffff" : "#0f172a",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "12px",
                      boxShadow:
                        "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                    }}
                    itemStyle={{
                      color: theme === "light" ? "#0f172a" : "#f1f5f9",
                    }}
                    formatter={(value: number) => [
                      `${Math.round(value)} วินาที`,
                      "ประเมินเวลา",
                    ]}
                    labelFormatter={(label, payload) => {
                      if (payload && payload.length > 0) {
                        return payload[0].payload.label;
                      }
                      return label;
                    }}
                  />
                  <Bar dataKey="duration" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={theme === "light" ? "#818cf8" : "#6366f1"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {/* Script section header & toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-850 pb-3 mx-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-500/15 text-blue-400 rounded-lg shrink-0">
                <FileText className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-slate-200">📝 บทพูดสคริปต์วิดีโอ (Interactive Video Script)</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">แก้ไขบทพูดหรือแทรก Natural Speech Markers เพื่อคำนวณจังหวะและปรับความสมจริง</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>บันทึก</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditedContent(content);
                      setIsEditing(false);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all active:scale-95"
                  >
                    <span>ยกเลิก</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleAutoInjectSpeechMarkers}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/30 border border-indigo-500/40 hover:bg-indigo-600/40 text-indigo-300 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm"
                    title="วิเคราะห์และปรับปรุงจังหวะการเล่าเรื่องพร้อมคำแนะนำเสียง"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>✨ เติม Speech Markers</span>
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>แก้ไขสคริปต์</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {isEditing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className={cn(
                "w-full min-h-[500px] flex-1 p-4 border rounded-xl font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 resize-y transition-all",
                theme === "light"
                  ? "bg-white text-slate-800 border-slate-200 focus:ring-blue-500"
                  : "bg-slate-900 border-slate-700 text-slate-300 focus:ring-sky-500",
              )}
              placeholder="Edit your script here..."
            />
          ) : (
            sections.map((section, idx) => {
              const isActive = activeId === idx;
              const isPassed = activeId !== null && idx < activeId;
              const hasVisual = !!section.visual;
              const hasPrompt =
                hasVisual &&
                !!section.visual?.prompt &&
                section.visual.prompt.trim() !== "";

              if (showOnlyPrompts && !hasPrompt) return null;

              return (
                <div
                  key={idx}
                  id={`section-card-${idx}`}
                  onClick={() => setActiveId(idx)}
                  className={cn(
                    "p-4 rounded-xl border transition-all duration-300 cursor-pointer relative",
                    isActive
                      ? theme === "light"
                        ? "bg-blue-50/50 border-blue-400 shadow-sm ring-1 ring-blue-400/30"
                        : "bg-slate-800/80 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/50"
                      : theme === "light"
                        ? "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-sm text-slate-800"
                        : "bg-transparent border-slate-800 hover:border-slate-600 text-slate-300",
                    isPassed && !isActive ? "opacity-60" : "opacity-100",
                  )}
                >
                  {isActive && (
                    <div
                      className={cn(
                        "absolute top-3 right-4 flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-md z-10",
                        theme === "light"
                          ? "text-blue-600 bg-blue-100"
                          : "text-blue-400 bg-blue-900/30",
                      )}
                    >
                      <span
                        className={cn(
                          "animate-pulse w-1.5 h-1.5 rounded-full",
                          theme === "light" ? "bg-blue-500" : "bg-blue-400",
                        )}
                      ></span>
                      CURRENT
                    </div>
                  )}
                  {isPassed && !isActive && section.timeString && (
                    <div className="absolute top-3 right-4 text-slate-500 z-10">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}

                  <div className="flex flex-col lg:flex-row gap-6 lg:items-start xl:gap-10">
                    {/* Script Content */}
                    <div
                      className={cn(
                        "flex-1 prose lg:max-w-4xl lg:mr-auto prose-h2:text-lg prose-h3:text-base prose-p:leading-relaxed prose-a:text-blue-500",
                        theme === "dark" && "prose-invert",
                        isActive
                          ? theme === "light"
                            ? "text-slate-900"
                            : "text-slate-200"
                          : theme === "light"
                            ? "text-slate-600"
                            : "text-slate-400",
                      )}
                    >
                      <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={MarkdownComponents}
                      >
                        {section.text}
                      </Markdown>
                    </div>

                    {/* Visual Previewer (if available) */}
                    {hasVisual && (
                      <VisualPreviewCard
                        visual={section.visual}
                        timeString={section.timeString}
                        isActive={isActive}
                        isPassed={isPassed}
                        theme={theme}
                        onOpenLightbox={setLightboxData}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 🎞️ High-Fidelity Custom Lightbox modal for Full-Screen Image Previews (Solving "กดเต็มจอยังไม่เห็นเนื้อหา") */}
      <AnimatePresence>
        {lightboxData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
            onClick={() => setLightboxData(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setLightboxData(null)}
                className="absolute top-4 right-4 z-50 p-2 bg-slate-950/80 hover:bg-slate-850 text-slate-300 rounded-full transition-all border border-slate-800"
              >
                <ChevronUp className="w-5 h-5 rotate-90" />
              </button>

              {/* Left Side: Glorious Image */}
              <div className="flex-1 bg-slate-950 flex items-center justify-center aspect-video md:aspect-auto md:h-full relative overflow-hidden group min-h-[250px] md:min-h-[400px]">
                <img
                  src={lightboxData.img}
                  alt="High-Res Preview"
                  className="w-full h-full object-contain max-h-[70vh]"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-sm border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-sky-400">
                  ⏱️ คิวภาพเวลา {lightboxData.time}
                </div>
              </div>

              {/* Right Side: Detailed Storyboard content panel */}
              <div className="w-full md:w-[350px] border-t md:border-t-0 md:border-l border-slate-850 p-6 flex flex-col justify-between overflow-y-auto max-h-[40vh] md:max-h-full">
                <div className="space-y-5">
                  <div>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      B-ROLL SCENE DETAILS
                    </span>
                    <h3 className="text-base font-bold text-slate-100 mt-2.5">
                      ฉากคิวที่ช่วงเวลา {lightboxData.time}
                    </h3>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                      Visual Suggestion / คำอธิบายภาพ
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {lightboxData.suggestion}
                    </p>
                  </div>

                  {lightboxData.prompt && (
                    <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest block flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> AI Image Prompt
                      </span>
                      <p className="text-xs text-slate-400 font-mono italic leading-normal select-all">
                        "{lightboxData.prompt}"
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(lightboxData.prompt);
                          alert("📋 คัดลอกพรอพต์ภาษาอังกฤษเรียบร้อยแล้ว!");
                        }}
                        className="w-full flex items-center justify-center gap-1 py-1 px-2 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded transition-colors mt-2"
                      >
                        <Copy className="w-3 h-3" /> คัดลอกพรอพต์
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-850 mt-6 flex gap-2">
                  <button
                    onClick={() => setLightboxData(null)}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors"
                  >
                    ปิดหน้าต่าง
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ResultTabs({
  result,
  onUpdateResult,
  onAIAssistFix,
}: {
  result: string;
  onUpdateResult?: (res: string) => void;
  onAIAssistFix?: (
    issueType: "no_visual" | "no_prompt" | "duration_long" | "prompt_warning",
    ranges: string[],
    content: string,
  ) => void;
}) {
  const { phase1, phase2, phase3 } = extractPhases(result);
  const [activeTab, setActiveTab] = useState<"all" | "p1" | "p2" | "p3">(
    phase1 ? "p1" : "all",
  );
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleUpdatePhase3 = (newPhase3Content: string) => {
    if (!onUpdateResult) return;
    const phase3Match = result.match(/(?:^|\n)(?:#+\s*|\*\*\s*)?(?:Phase\s*3|ส่วนที่\s*3|Step\s*3)[^\n]*/i);
    if (phase3Match) {
      const header = phase3Match[0];
      const beforePhase3 = result.substring(0, phase3Match.index);
      onUpdateResult(`${beforePhase3}${header}\n\n${newPhase3Content}`);
    }
  };

  // If the regex failed to find phases, just show ALL
  if (!phase1 && !phase2 && !phase3) {
    return (
      <div
        className={cn(
          "prose max-w-none prose-h2:text-xl prose-h2:border-b prose-h2:pb-3 prose-h2:mt-8 prose-h2:mb-4 first:prose-h2:mt-0 prose-h3:text-base prose-p:leading-relaxed p-5 h-full overflow-auto custom-scrollbar",
          theme === "dark" &&
            "prose-invert prose-headings:text-sky-400 prose-h2:border-slate-700/50 prose-p:text-slate-300 prose-a:text-blue-400 hover:prose-a:text-blue-300 bg-transparent text-slate-200",
          theme === "light" &&
            "prose-headings:text-blue-700 prose-h2:border-slate-200 prose-p:text-slate-700 prose-a:text-blue-600 hover:prose-a:text-blue-700 bg-white",
        )}
      >
        <Markdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
          {result}
        </Markdown>
      </div>
    );
  }

  const tabs = [
    { id: "all", label: "Raw Output" },
    { id: "p1", label: "1. Analysis", content: phase1 },
    { id: "p2", label: "2. Selection", content: phase2 },
    { id: "p3", label: "3. Script Generator", content: phase3 },
  ];

  return (
    <div
      className={cn(
        "flex flex-col h-full transition-colors duration-300 rounded-xl",
        theme === "light"
          ? "bg-slate-50/50 text-slate-800"
          : "bg-transparent text-slate-200",
      )}
    >
      <div
        className={cn(
          "flex border-b px-5 pt-3 overflow-x-auto shrink-0 custom-scrollbar justify-between items-end rounded-t-xl",
          theme === "light"
            ? "bg-white border-slate-200 shadow-sm z-10"
            : "bg-slate-900/50 border-slate-700",
        )}
      >
        <div className="flex shrink-0">
          {tabs
            .filter((t) => t.id === "all" || t.content)
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors",
                  activeTab === tab.id
                    ? theme === "light"
                      ? "border-blue-600 text-blue-600"
                      : "border-sky-400 text-sky-400"
                    : theme === "light"
                      ? "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                      : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600",
                )}
              >
                {tab.label}
              </button>
            ))}
        </div>
        <div className="pb-2.5">
          <button
            onClick={toggleTheme}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
              theme === "light"
                ? "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700",
            )}
            title="Toggle Light/Dark Mode"
          >
            {theme === "light" ? (
              <>
                <Moon className="w-3.5 h-3.5" />{" "}
                <span className="hidden sm:inline">Dark</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5" />{" "}
                <span className="hidden sm:inline">Light</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "flex-1 relative custom-scrollbar min-h-0 min-w-0",
          activeTab === "p3"
            ? "overflow-hidden flex flex-col h-full"
            : "overflow-auto p-5",
        )}
      >
        {activeTab === "all" && (
          <div
            className={cn(
              "prose max-w-none prose-h2:text-xl prose-h2:border-b prose-h2:pb-3 prose-h2:mt-8 prose-h2:mb-4 first:prose-h2:mt-0 prose-h3:text-base prose-p:leading-relaxed",
              theme === "dark" &&
                "prose-invert prose-headings:text-sky-400 prose-h2:border-slate-700/50 prose-p:text-slate-300 prose-a:text-blue-400 hover:prose-a:text-blue-300",
              theme === "light" &&
                "prose-headings:text-blue-700 prose-h2:border-slate-200 prose-p:text-slate-700 prose-a:text-blue-600 hover:prose-a:text-blue-700",
            )}
          >
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={MarkdownComponents}
            >
              {result}
            </Markdown>
          </div>
        )}

        {activeTab === "p1" && phase1 && (
          <div
            className={cn(
              "prose max-w-none prose-h2:text-xl prose-h2:border-b prose-h2:pb-3 prose-h2:mb-4 first:prose-h2:mt-0 prose-p:leading-relaxed",
              theme === "dark" &&
                "prose-invert prose-headings:text-sky-400 prose-h2:border-slate-700/50 prose-p:text-slate-300",
              theme === "light" &&
                "prose-headings:text-blue-700 prose-h2:border-slate-200 prose-p:text-slate-700",
            )}
          >
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={MarkdownComponents}
            >
              {phase1.replace(/^##?\s*Phase 1.*/i, "")}
            </Markdown>
          </div>
        )}

        {activeTab === "p2" && phase2 && (
          <div
            className={cn(
              "prose max-w-none prose-h2:text-xl prose-h2:border-b prose-h2:pb-3 prose-h2:mb-4 first:prose-h2:mt-0 prose-p:leading-relaxed",
              theme === "dark" &&
                "prose-invert prose-headings:text-sky-400 prose-h2:border-slate-700/50 prose-p:text-slate-300",
              theme === "light" &&
                "prose-headings:text-blue-700 prose-h2:border-slate-200 prose-p:text-slate-700",
            )}
          >
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={MarkdownComponents}
            >
              {phase2.replace(/^##?\s*Phase 2.*/i, "")}
            </Markdown>
          </div>
        )}

        {activeTab === "p3" && phase3 && (
          <ScriptHighlighter
            content={phase3.replace(/(?:^|\n)(?:#+\s*|\*\*\s*)?(?:Phase\s*3|ส่วนที่\s*3|Step\s*3)[^\n]*/i, "").trim()}
            fullResult={result}
            onUpdateContent={handleUpdatePhase3}
            onUpdateFullResult={onUpdateResult}
            onAIAssistFix={onAIAssistFix}
            theme={theme}
          />
        )}
      </div>
    </div>
  );
}

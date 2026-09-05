import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Loader2,
  Sparkles,
  Youtube,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  Send,
  Download,
  Clock,
  Trash2,
  Copy,
  CheckCircle2,
  PanelLeftClose,
  PanelLeftOpen,
  Flame,
  FileSpreadsheet,
  Eye,
  Plus,
  ExternalLink,
  Link,
  Cloud,
} from "lucide-react";
import { cn } from "./lib/utils";
import { ResultTabs } from "./components/ResultTabs";

interface CompetitorItem {
  id: string;
  name: string;
  url: string;
  notes?: string;
  timestamp: number;
}

interface HistoryItem {
  id: string;
  timestamp: number;
  input: string;
  result: string;
}

interface KeywordSuggestion {
  keyword: string;
  volume: string;
  difficulty: "Low" | "Medium" | "High";
  trend?: "rising" | "falling" | "flat";
}

interface TrendingNiche {
  niche: string;
  reason: string;
  growth: "Hot" | "Rising";
}

// Content generation runs through our own server (`/api/gemini`) so the
// Gemini API key stays server-side and is never exposed in the client bundle.
// The shape mirrors the SDK's `generateContent` so call sites read the same
// (`response.text`), and the existing quota/permission error handling keeps
// working via the forwarded `status` field.
async function generateContent(params: {
  contents: unknown;
  config?: Record<string, unknown>;
}): Promise<{ text: string }> {
  let res: Response;
  try {
    res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch (networkErr) {
    throw new Error("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
  }

  const data = await res.json().catch(() => ({}) as any);

  if (!res.ok) {
    const err: any = new Error(
      data?.error || `Gemini request failed (${res.status})`,
    );
    err.status = data?.status ?? res.status;
    throw err;
  }

  return { text: typeof data?.text === "string" ? data.text : "" };
}

const SYSTEM_INSTRUCTION = `คุณคือ "YT Faceless Podcast SEO Master" AI ผู้เชี่ยวชาญสูงสุดในการวิเคราะห์ SEO Gap และสร้างเนื้อหา YouTube Faceless Podcast เพื่อช่วยเพิ่ม traffic และ ranking ให้เว็บไซต์หลักแบบเต็มวงจร

กฎภาษาที่สำคัญที่สุด (ต้องทำทุกครั้ง):
- คุณต้องตอบผู้ใช้ทุกอย่างเป็นภาษาไทย (การวิเคราะห์, ตาราง, คำอธิบาย, คำแนะนำ, การสนทนาทั้งหมด)
- แต่เนื้อหาที่สร้างสำหรับ YouTube (Title, Full Script, Description) ต้องเป็นภาษาอังกฤษทั้งหมด เขียนอย่างเป็นธรรมชาติ SEO ดี และเหมาะสำหรับ Faceless Podcast

Workflow (ทำตามขั้นตอนนี้ทุกครั้งอย่างเคร่งครัด):

Phase 1: ค้นหาหรือวิเคราะห์นิชจาก Ahrefs, Google Search Console, Google Analytics (หรือ URL + สรุปตัวเลข)
- วิเคราะห์และค้นหา “นิช” หรือหัวข้อที่มีโอกาสสูงสุดสำหรับทำ YouTube Faceless Podcast
- แสดงผลเป็นตารางสรุปด้วยภาษาไทย พร้อมเหตุผลชัดเจน (ใช้ตัวเลขสมมติที่สมจริงหากผู้ใช้ไม่ได้ให้มา เช่น Search Volume, Keyword Difficulty, Organic Traffic, Impressions, CTR, Bounce Rate)
- **ข้อกำหนดพิเศษ (ตารางสถิติและเปรียบเทียบ):** ในส่วนตารางเปรียบเทียบคีย์เวิร์ดของ Phase 1 ให้ระบุคอลัมน์มาตรฐานให้ครอบคลุม ได้แก่ "Keyword", "Search Volume", "Keyword Difficulty", "SEO Opportunity Score" (หรือ "SEO Gap Score") และ "Competitor Top Video" เพื่อสนับสนุนการเรนเดอร์ Heatmap และทำให้เห็นช่องว่างทางการตลาดได้ชัดเจน
- **ข้อสำคัญ:** ให้เพิ่มการวิเคราะห์คู่แข่งเบื้องต้น (Competitor Analysis) ลงใน Phase นี้ด้วย โดยระบุถึงวิดีโอหรือ Podcast ที่ทำผลงานได้ดีเยี่ยม (Top-ranking) ในแต่ละนิช พร้อมวิเคราะห์จุดแข็ง/จุดอ่อนเพื่อหาช่องว่าง (Gap) ที่ควรเจาะเข้าตลาด

Phase 2: Topic Selection, Value Proposition & Visual Storyboard
- เลือก 1-3 หัวข้อ/หน้าเว็บ/นิชที่มีศักยภาพสูงที่สุดในการทำเป็นวิดีโอ Faceless Podcast
- อธิบายเหตุผลและประโยชน์ SEO ที่คาดว่าจะได้รับ (เป็นภาษาไทย)
- **ข้อสำคัญ (ตามคำขอผู้ใช้):** วิเคราะห์เพิ่มว่า Keyword/หัวข้อนี้ช่วย **"แก้ปัญหา" (Problem Solving)** ให้ผู้ฟังได้อย่างไร และผู้ฟังจะได้รับ **"ประโยชน์" (Benefits)** อะไรบ้างจากการฟัง Podcast นี้ เพื่อให้เนื้อหามี Value สูงที่สุด สรุปเป็นข้อๆ ให้ชัดเจน (เป็นภาษาไทย)
- **ข้อกำหนดด้านภาพประกอบและ B-Roll สำหรับวิดีโอ (Visual & B-Roll Suggestions):** ให้เขียนตารางคำแนะนำภาพประกอบใน Phase 2 นี้ เพื่อเป็นการวาด Storyboard ว่าแต่ละจังหวะเวลา (Timestamp) ของวิดีโอ (อิงจากสคริปต์ใน Phase 3) ควรใช้ภาพประกอบอย่างไร โดยคำนวณเปลี่ยนภาพทุกๆ 10-15 วินาทีของระยะเวลาพากย์ เพื่อให้ถูกกระตุ้นสายตาและไม่เสี่ยงต่อข้อหา Inauthentic Content ของ YouTube ระบุรายละเอียดคอลัมน์ดังนี้ (ภาษาไทยสำหรับคนตัดต่อ):
  1. *Timestamp:* คิวเวลาอ้างอิงตรงกับสคริปต์พากย์ (เช่น [0:00], [0:15])
  2. *ควรใช้ภาพ/ฟุตเทจประกอบประเภทไหน (Visual Types):* เช่น สกรีนช็อตของเครดิต, การโชว์เครื่องมือจริง, โมชันกราฟิกสภาพแวดล้อมที่เกี่ยวข้อง
  3. *เพราะอะไรต้องใช้ภาพประกอบแบบนั้น (Reasoning/Why):* อธิบายเหตุผลความจำเป็นเชิงจิตวิทยา เช่น การดึงสติช่วงเริ่มเบื่อ
  4. *ผู้ชมจะได้อะไรจากการดูภาพประกอบนั้น (Viewer Benefit):* เช่น เพิ่มความสนใจไม่ให้กดปิด

Phase 3: Content Creation (ภาษาอังกฤษทั้งหมด)
- สร้าง YouTube Video Title ที่น่าสนใจและ SEO Friendly
- เขียน Full Script สำหรับ Faceless Podcast (ยาวประมาณ 8-15 นาที) แบบพูดธรรมชาติ 
  **ข้อกำหนดป้องกันข้อหา Inauthentic / Repetitive Content ของ YouTube (สำคัญมาก คุณต้องออกแบบเนื้อหาให้เหมือนมนุษย์เขียน 100%):**
  1. *ห้ามใช้คำฟุ่มเฟือยหรือ Pattern ยอดฮิตของ AI:* ไม่เปิดคลิปด้วยคำว่า "In today's fast-paced world...", "Have you ever wondered..." และหลีกเลี่ยงคำบอกลำดับแบบบอท เช่น "First and foremost", "Additionally", "Moreover", "In conclusion", "As we wrap up", "Another crucial aspect" หรือคำเชื่อมที่จงใจเกินไป
  2. *Human-like Conversational Hook & Pacing:* ดึงดูดสายตาและหูผู้ฟังตั้งแต่ [0:00] ทันทีด้วย Hook ที่เล่าดราม่าเด็ดๆ, เรื่องขัดแย้งกับตรรกะทั่วไป (Counter-intuitive statement), เหตุการณ์สมมติเฉพาะจุด หรือสถิติที่น่าตกใจ แทนการทักทายสวัสดีทู่ๆ หรือการอ้างหัวเรื่องซ้ำซาก
  3. *Vivid Storytelling & Case Studies:* เล่าผ่านเคสตัวอย่างจำลองหรือตัวละครสมมติ (เช่น "Imagine a creator names Alex who...", "Last trade season, a company did X...") เพื่อพิสูจน์แนวคิด แทนการบอกสูตรหรือลิสต์ขั้นตอนแบบทฤษฎีแห้งๆ พร้อมอธิบายเบื้องลึกที่คนนอกวงการไม่รู้
  4. *Natural Speech Markers & Nuance:* แทรกอารมณ์ขัน จังหวะถอนหายใจ การพูดตัดบทเบาๆ หรือคำอุทานของการวิเคราะห์สด เช่น "But here's the kicker...", "Wait, let's look at the numbers.", "Does that make sense? Probably not at first.", "Actually, that's a brilliant trap."
  5. *Intimate Viewer Interaction:* กระตุ้นให้คนเล่าความลับหรือคอมเมนต์แชร์ความคิดเห็นมุมมองส่วนตัวเพื่อสร้าง Feedback loop ของมนุษย์ที่แท้จริง ไม่ใช้แค่คำส่งเดชว่า "Like and subscribe" มั่วซั่ว
  **ข้อสำคัญเกี่ยวกับการคำนวณเวลาและการตัดต่อ (Pacing & Visual Markers):** เพื่อป้องกันภาพหน้าจอค้างนานเกินไป (Visual Freeze) จนขาดความน่าสนใจ ให้คุณซอยแบ่งสคริปต์พูดออกเป็นพารากราฟย่อยๆ และ **ต้องใส่ Timestamp กำกับไว้ที่หน้าพารากราฟหรือประโยคบรรยายใหม่ถี่ๆ (เช่น ทุกๆ 10-20 วินาที หรือ [0:00], [0:15], [0:35]...)** ไม่ใช่แค่ใส่บนหัวข้อหลักอย่างเดียว โดยคำนวณระยะเวลาให้สมจริงตามความยาวของเนื้อหา (อิงความเร็วพูด 150 คำ/นาที)
- **เวลาพิมพ์ชื่อ Tools (เช่น \`Ahrefs\`), Keywords สำคัญ หรือชื่อแพลตฟอร์ม ให้ครอบด้วย backticks เสมอ** เพื่อแสดงเป็น inline code
- เขียน YouTube Description ที่สมบูรณ์ โดย **Timestamps ใน Description ต้องดึงมาจากและตรงกับ Timestamp ที่ระบุไว้ in Script ทุกประการ**, พร้อมใส่ Backlinks ไปยังบทความต้นฉบับ, Hashtags และ CTA ให้ผู้ชมเข้าเว็บ

จัดรูปแบบผลลัพธ์ด้วย Markdown ให้สวยงามและอ่านง่าย ใช้ Heading (##) สำหรับแต่ละ Phase`;

const FORMAT_OPTIONS = [
  { value: "Standard Conversational", label: "💬 พูดคุยธรรมชาติ (Standard)" },
  { value: "Video Overview", label: "📊 สรุปภาพรวม (Video Overview)" },
  { value: "Deep Dive", label: "🔍 เจาะลึกวิเคราะห์ (Deep Dive)" },
  { value: "Storytelling", label: "📖 เล่าเรื่อง/ตัวละคร (Storytelling)" },
];

const VISUAL_STYLE_OPTIONS = [
  {
    value: "Standard Stock",
    label: "🎬 วิดีโอสต็อกสมจริง (Standard Stock Video)",
  },
  {
    value: "NotebookLM Analytical Indigo",
    label: "📓 สไตล์ NotebookLM มินิมอลเรียบหรู + เจนรูปใน Google Flow",
  },
];

export default function App() {
  const [input, setInput] = useState(() => {
    try {
      const saved = localStorage.getItem("podcast_input_draft");
      return saved || "";
    } catch (e) {
      return "";
    }
  });
  const [isDraftRestored, setIsDraftRestored] = useState(() => {
    try {
      const saved = localStorage.getItem("podcast_input_draft");
      return !!saved && saved.trim().length > 0;
    } catch (e) {
      return false;
    }
  });
  const [draftSavedStatus, setDraftSavedStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle");
  const [isGenerating, setIsGenerating] = useState(false);

  const [lastSynced, setLastSynced] = useState<string>(() => {
    try {
      return localStorage.getItem("podcast_last_synced") || "";
    } catch (e) {
      return "";
    }
  });

  const updateLastSynced = () => {
    try {
      const timeStr = new Date().toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      localStorage.setItem("podcast_last_synced", timeStr);
      setLastSynced(timeStr);
    } catch (e) {}
  };

  const [result, setResult] = useState(() => {
    try {
      return localStorage.getItem("podcast_result") || "";
    } catch (e) {
      return "";
    }
  });

  useEffect(() => {
    try {
      if (result) {
        localStorage.setItem("podcast_result", result);
        updateLastSynced();
      } else {
        localStorage.removeItem("podcast_result");
        updateLastSynced();
      }
    } catch (e) {}
  }, [result]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [trendingNiches, setTrendingNiches] = useState<TrendingNiche[]>([]);
  const [isFetchingTrends, setIsFetchingTrends] = useState(false);
  const [storytellingFormat, setStorytellingFormat] = useState<string>(
    "Standard Conversational",
  );
  const [visualStyle, setVisualStyle] = useState<string>(
    "NotebookLM Analytical Indigo",
  );
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem("podcast_history");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("podcast_history", JSON.stringify(history));
      updateLastSynced();
    } catch (error) {
      console.warn('History could not be saved: browser storage is unavailable or full.');
    }
  }, [history]);

  const [watchlist, setWatchlist] = useState<CompetitorItem[]>(() => {
    try {
      const saved = localStorage.getItem("podcast_watchlist");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    // Initial demo watchlist items representing high-quality examples
    return [
      {
        id: "demo-1",
        name: "Ali Abdaal",
        url: "https://www.youtube.com/@aliabdaal",
        notes:
          "ตลาด Productivity (วิเคราะห์เทคนิคตัดต่อ การทำ Visual และการวาง Content Gap)",
        timestamp: Date.now() - 86400000 * 5,
      },
      {
        id: "demo-2",
        name: "NotebookLM Guide by Google",
        url: "https://www.youtube.com/watch?v=rK-DscS98k0",
        notes:
          "ช่องทางการเล่าฟีเจอร์ AI Audio - เล่าแบบสรุปประเด็นกระชับ มู้ดเรียบหรู",
        timestamp: Date.now() - 86400000 * 2,
      },
    ];
  });

  const [compName, setCompName] = useState("");
  const [compUrl, setCompUrl] = useState("");
  const [compNotes, setCompNotes] = useState("");
  const [compError, setCompError] = useState("");
  const [showAddComp, setShowAddComp] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("podcast_watchlist", JSON.stringify(watchlist));
      updateLastSynced();
    } catch (e) {}
  }, [watchlist]);

  const handleAddCompetitor = (e: React.FormEvent) => {
    e.preventDefault();
    setCompError("");

    if (!compName.trim()) {
      setCompError("กรุณากรอกชื่อช่องหรือวิดีโอ");
      return;
    }
    if (!compUrl.trim()) {
      setCompError("กรุณากรอกลิงก์ URL");
      return;
    }

    try {
      new URL(compUrl);
    } catch (_) {
      setCompError("กรุณากรอก URL ที่ถูกต้อง (เช่น https://youtube.com/...)");
      return;
    }

    const newItem: CompetitorItem = {
      id: Date.now().toString(),
      name: compName.trim(),
      url: compUrl.trim(),
      notes: compNotes.trim() || undefined,
      timestamp: Date.now(),
    };

    setWatchlist((prev) => [newItem, ...prev]);
    setCompName("");
    setCompUrl("");
    setCompNotes("");
    setShowAddComp(false);
  };

  const handleRemoveCompetitor = (id: string) => {
    setWatchlist((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUseCompetitorForInput = (item: CompetitorItem) => {
    const separator = input.trim() ? "\n" : "";
    setInput(
      (prev) =>
        prev.trim() +
        `${separator}- วิเคราะห์คู่แข่งเรื่อง: \`${item.name}\` (${item.url})${item.notes ? ` [ประเด็นช่องว่างเนื้อหา: ${item.notes}]` : ""}`,
    );
    if (isDraftRestored) {
      setIsDraftRestored(false);
    }
  };

  // Auto-save input draft to localStorage periodically with a light debounce
  useEffect(() => {
    if (input) {
      setDraftSavedStatus("saving");
      const timer = setTimeout(() => {
        try {
          localStorage.setItem("podcast_input_draft", input);
          setDraftSavedStatus("saved");
          updateLastSynced();
        } catch (err) {
          console.error("Failed to save draft:", err);
        }
      }, 1000); // 1s debounce
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        try {
          localStorage.removeItem("podcast_input_draft");
          setDraftSavedStatus("idle");
          updateLastSynced();
        } catch (err) {}
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [input]);

  const handleGetTrendingNiches = async () => {
    setIsFetchingTrends(true);
    try {
      const prompt = `You are a YouTube trend analyst. Identify 3 highly profitable YouTube Faceless niches that are currently trending this week.
Strictly limit these niches to the following categories or closely related ones:
1. "สายแก้ปัญหาชีวิต / ฮาวทูเชิงลึก (Problem Solving & Actionable Advice)"
2. "สายจิตวิทยา + วิธีแก้ปัญหา (Psychology & Problem Solving)"
Return ONLY a valid raw JSON array of objects. Do not wrap in markdown fallback tags other than potentially JSON code fences.
Format:
[
  {"niche": "niche name", "reason": "short explanation of why it's trending", "growth": "Hot" | "Rising"}
]`;

      const response = await generateContent({
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.7,
        },
      });

      if (response.text) {
        let cleanText = response.text.trim();
        if (cleanText.startsWith("\`\`\`json")) {
          cleanText = cleanText.substring(7);
        }
        if (cleanText.endsWith("\`\`\`")) {
          cleanText = cleanText.substring(0, cleanText.length - 3);
        }
        const data = JSON.parse(cleanText.trim());
        if (Array.isArray(data)) {
          setTrendingNiches(data as TrendingNiche[]);
        }
      }
    } catch (err) {
      console.error("Error getting trending niches:", err);
      // Fallback
      setTrendingNiches([
        {
          niche: "จิตวิทยาการจัดการความเครียด (Stress Management Psychology)",
          reason:
            "ผู้คนต้องการวิธีจัดการความเครียดจากการทำงานที่สามารถทำตามได้จริงด่วน.",
          growth: "Hot",
        },
        {
          niche:
            "เทคนิคแก้ปัญหาการผัดวันประกันพรุ่ง (Overcoming Procrastination)",
          reason:
            "How-to เชิงลึกเกี่ยวกับการปรับพฤติกรรมเพิ่ม Productivity กำลังมาแรง.",
          growth: "Rising",
        },
        {
          niche: "จิตวิทยาความสัมพันธ์และการสื่อสาร (Relationship Psychology)",
          reason:
            "ปัญหาเรื่องการสื่อสารในที่ทำงานและครอบครัวทำให้คนค้นหาวิธีแก้แบบเป็นขั้นเป็นตอน.",
          growth: "Rising",
        },
      ]);
    } finally {
      setIsFetchingTrends(false);
    }
  };

  const handleAddTrendingNiche = (niche: string) => {
    const separator = input.trim() ? "\n" : "";
    setInput(
      (prev) => prev.trim() + `${separator}- สนใจทำเรื่อง: \`${niche}\``,
    );
  };

  const handleGetSuggestions = async () => {
    if (!input.trim()) {
      setError(
        "กรุณาระบุ URL, นิช หรือคีย์เวิร์ดเบื้องต้นก่อนเพื่อให้ระบบวิเคราะห์ค้นหาคีย์เวิร์ดที่เกี่ยวข้องได้",
      );
      return;
    }
    setIsSuggesting(true);
    try {
      const prompt = `Based on this user input: "${input}", generate a JSON list of exactly 5 highly relevant, high-volume long-tail keywords that this user can create a YouTube Faceless video/podcast about to drive traffic.
Return ONLY a valid raw JSON array of objects. Do not wrap in markdown fallback tags other than potentially JSON code fences.
Format:
[
  {"keyword": "keyword name", "volume": "estimated search volume (e.g., 8.5K/mo)", "difficulty": "Low" | "Medium" | "High", "trend": "rising" | "falling" | "flat"}
]`;

      const response = await generateContent({
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.5,
        },
      });

      if (response.text) {
        let cleanText = response.text.trim();
        if (cleanText.startsWith("```json")) {
          cleanText = cleanText.substring(7);
        }
        if (cleanText.endsWith("```")) {
          cleanText = cleanText.substring(0, cleanText.length - 3);
        }
        const data = JSON.parse(cleanText.trim());
        if (Array.isArray(data)) {
          setSuggestions(data as KeywordSuggestion[]);
        }
      }
    } catch (err) {
      console.error("Error getting suggestions:", err);
      const cleanedSeed = input.slice(0, 30).trim() || "topic";
      const fallback: KeywordSuggestion[] = [
        {
          keyword: `${cleanedSeed} for beginners`,
          volume: "3.2K/mo",
          difficulty: "Low",
          trend: "rising",
        },
        {
          keyword: `best ${cleanedSeed} tricks`,
          volume: "1.5K/mo",
          difficulty: "Medium",
          trend: "flat",
        },
        {
          keyword: `how to master ${cleanedSeed}`,
          volume: "950/mo",
          difficulty: "Low",
          trend: "rising",
        },
        {
          keyword: `top 10 secrets of ${cleanedSeed}`,
          volume: "2.4K/mo",
          difficulty: "High",
          trend: "falling",
        },
        {
          keyword: `step by step ${cleanedSeed} tutorial`,
          volume: "4.8K/mo",
          difficulty: "Low",
          trend: "rising",
        },
      ];
      setSuggestions(fallback);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleAddSuggestion = (keyword: string) => {
    if (input.includes(keyword)) return;
    const separator = input.trim() ? "\n" : "";
    setInput(
      (prev) => prev.trim() + `${separator}- Keyword เพิ่มเติม: \`${keyword}\``,
    );
  };

  const handleGenerate = async () => {
    if (!input.trim()) {
      setError(
        "กรุณาระบุ URL เว็บไซต์, Niche หรือข้อมูล SEO ก่อนเริ่มการวิเคราะห์",
      );
      return;
    }

    setIsGenerating(true);
    setError("");
    setResult("");

    try {
      let promptInstruction = SYSTEM_INSTRUCTION;
      if (
        storytellingFormat &&
        storytellingFormat !== "Standard Conversational"
      ) {
        promptInstruction += `\n\n**ข้อกำหนดพิเศษ: รูปแบบการเล่าเรื่อง (Storytelling Format)**\nให้ใช้สไตล์การเล่าเรื่องแบบ: ${storytellingFormat}\n`;
        if (storytellingFormat === "Video Overview") {
          promptInstruction += `- เริ่มต้นด้วยการเกริ่นปัญหาและรวบยอดภาพรวมเนื้อหาทั้งหมด (Overview) ตั้งแต่ช่วงแรก\n`;
          promptInstruction += `- เน้นการสรุปประเด็นหลัก (Key Takeaways) ย่อยข้อมูลที่ซับซ้อนให้เป็นหัวข้อย่อยที่เข้าใจง่าย ฟังรวดเดียวจบ\n`;
          promptInstruction += `- จบด้วยบทสรุป (Conclusion) ที่รวบยอดความคิดและให้แนวทางผู้ฟังนำไปใช้งานต่อได้ทันที\n`;
        } else if (storytellingFormat === "Deep Dive") {
          promptInstruction += `- เจาะลึกข้อมูลเชิงเทคนิคหรือกลยุทธ์เบื้องหลังแบบละเอียดยิบ (Expert Level)\n`;
          promptInstruction += `- ไม่เน้นพูดกว้างๆ แต่เน้น How-to เจาะจงที่อธิบายตรรกะและเหตุผลที่คนส่วนใหญ่ไม่รู้\n`;
        } else if (storytellingFormat === "Storytelling") {
          promptInstruction += `- เล่าเนื้อหาผ่านโครงสร้างนิทาน, เรื่องแต่งสมมติ (Case Study), หรือตัวละครตัวแทน\n`;
          promptInstruction += `- ดำเนินเรื่องด้วยอุปสรรค, จุดเปลี่ยน (Climax), และบทเรียนที่ได้รับจากการกระทำนั้นๆ แทนการสอนทื่อๆ\n`;
        }
      }

      if (visualStyle === "NotebookLM Analytical Indigo") {
        promptInstruction += `\n\n**ข้อกำหนดพิเศษสไตล์ภาพประกอบ (B-Roll Style): NotebookLM Analytical Indigo Style (สำหรับเอาไปเจนภาพใน Google Flow / Imagen)**
- ใน Phase 2 สำหรับหัวข้อตาราง "Visual Storyboard" ให้เพิ่มคอลัมน์ข้อมูลที่สำคัญคือ **"Google Flow Prompt" (เขียนเป็นภาษาอังกฤษเท่านั้น)**
- **สำคัญมากเกี่ยวกับการร่างสตอรี่บอร์ด (Storyboard):** ให้คุณประเมินระยะเวลาของคลิปจากความยาวสคริปต์ (ความเร็วพากย์เฉลี่ย 150 คำต่อนาที) และกำหนดจำนวนฉากภาพประกอบย่อยให้สอดคล้องกัน โดยเปลี่ยนภาพทุกๆ 10-15 วินาทีของระยะเวลาเสียงพากย์ เพื่อให้การเคลื่อนไหวของภาพในวิดีโอมีความลื่นไหลและตรงกับจังหวะของเนื้อหา ดึงดูด Retention สูงสุด
- ให้ออกแบบภาษาอังกฤษ Prompt นี้สำหรับป้อนใส่ AI Image Generator เพื่อให้ผู้ใช้สามารถ Copy ป้อน Google Flow ได้ทันที ตัวอย่างสไตล์ NotebookLM:
  - แดชบอร์ดเรียบง่ายสีทึบ, การเชื่อมโยงโหนดและแผนภาพที่เรืองแสง (glowing knowledge graphs, connecting micro-lines), กระดาษโน้ตโปร่งแสงที่ลอยอยู่พร้อมข้อมูลสรุป, มูดโทนดาร์กสเลต/น้ำเงินอินดิโก้ สลับแสงตัดเหลืองอำพันหรือไซแอน (dark deep slate background, warm amber and neon cyan neon accents, minimalist UI of NotebookLM)
  - ตัวอย่าง Prompt: "Minimalist workspace interface, NotebookLM aesthetic, glowing network nodes, translucent floating index cards displaying neat charts, hyper-detailed slate blue color palette, tech workspace, cinematic focus, 8k resolution, wide storyboard composition"
  - ออกแบบคอลัมน์ของตารางให้ครอบคลุม:
    | Timestamp | Visual Suggestion / แนะนำภาพประกอบ | Reasoning & Viewer Benefit / เหตุผลและประโยชน์ | Google Flow Prompt / Prompt เจนรูปภาษาอังกฤษสไตล์ NotebookLM |`;
      } else {
        promptInstruction += `\n\n**ข้อกำหนดพิเศษสไตล์ภาพประกอบ (B-Roll Style): Standard Cinematic Stock Vibe**
- ใน Phase 2 ตาราง "Visual Storyboard" ให้ระบุ Timestamp, คำอธิบายฟุตเทจ/วิดีโอสต็อกสมจริง, เหตุผลเชิงจิตวิทยาประกอบ และประโยชน์ Retention ของผู้ชมให้มีความน่าสนใจเข้ากับผู้ใช้ทั่วไป
- **สำคัญมากเกี่ยวกับการร่างสตอรี่บอร์ด (Storyboard):** ให้คุณประเมินระยะเวลาของคลิปจากความยาวสคริปต์ (ความเร็วพากย์เฉลี่ย 150 คำต่อนาที) และจัดสรรจำนวนฉากภาพประกอบ (B-Rolls/Images) ให้สอดคล้องกัน โดยเปลี่ยนภาพทุกๆ 10-15 วินาทีของระยะเวลาเสียงพากย์ เพื่อให้วิดีโอถูกกระตุ้นสายตาและไม่หยุดนิ่งเกินไปตลอดการบรรยาย`;
      }

      const response = await generateContent({
        contents: input,
        config: {
          systemInstruction: promptInstruction,
          temperature: 0.7,
        },
      });

      if (response.text) {
        setResult(response.text);
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          input: input,
          result: response.text,
        };
        setHistory((prev) => [newItem, ...prev]);
        if (window.innerWidth < 1024) {
          setIsSidebarOpen(false); // Auto-hide sidebar after generation only on mobile
        }
      } else {
        setError("ไม่สามารถสร้างเนื้อหาได้ กรุณาลองใหม่อีกครั้ง");
      }
    } catch (err: any) {
      console.error("Error generating content:", err);
      const errStr = JSON.stringify(err || {});
      if (
        err?.status === "RESOURCE_EXHAUSTED" ||
        err?.status === 429 ||
        err?.error?.code === 429 ||
        err?.message?.includes("429") ||
        err?.message?.includes("quota") ||
        errStr.includes("429") ||
        errStr.includes("RESOURCE_EXHAUSTED")
      ) {
        setError(
          "ข้อผิดพลาด: โควต้าใช้งาน AI ของคุณหมดแล้ว (Rate Limit Exceeded / Quota Exhausted) กรุณารอสักครู่แล้วลองอีกครั้ง หรือเปลี่ยน API Key หรืออัพเกรดแพ็กเกจของคุณ",
        );
      } else if (
        err?.status === "PERMISSION_DENIED" ||
        err?.message?.includes("403") ||
        err?.message?.includes("permission")
      ) {
        setError(
          "ข้อผิดพลาด: API Key ไม่ถูกต้อง หรือไม่มีสิทธิ์ใช้งาน (Permission Denied) กรุณาตรวจสอบ API Key ใน Settings อีกครั้ง",
        );
      } else {
        setError(err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const [isGeneratingAIFix, setIsGeneratingAIFix] = useState(false);

  const handleAIAssistFix = async (
    issueType: "no_visual" | "no_prompt" | "duration_long" | "prompt_warning",
    ranges: string[],
    content: string,
  ) => {
    if (ranges.length === 0) return;
    setIsGeneratingAIFix(true);

    try {
      let prompt = "";
      if (issueType === "no_visual") {
        prompt = `จากเนื้อหาสคริปต์ (Phase 3) และตารางภาพ (Phase 2) ของคุณ พบว่ามาร์คเวลาเหล่านี้ในสคริปต์ยังไม่มีตารางภาพจับคู่ (Missing Visuals in Phase 2): ${ranges.join(", ")}
      
กรุณาสร้างและเติมแถวของตารางข้อมูลภาพ สำหรับคิวเวลาเหล่านี้เพิ่มเติม โดยให้ใช้สไตล์ภาพประกอบ (B-Roll Style) ตรงตามมู้ดของสคริปต์ ขอแค่ตัวข้อมูลแถวที่จะเติมลงตาราง ในรูปแบบ markdown table

| Timestamp | Visual Suggestion / แนะนำภาพประกอบ | Reasoning & Viewer Benefit / เหตุผลและประโยชน์ | Google Flow Prompt / Prompt เจนรูปภาษาอังกฤษสไตล์ |
|---|---|---|---|`;
      } else if (issueType === "no_prompt") {
        prompt = `จากตารางภาพ (Phase 2) ของคุณ พบว่าในคิวเวลาเหล่านี้ยังขาดข้อมูลช่อง Image Prompt สำหรับนำไปเจนรูป: ${ranges.join(", ")}
      
กรุณาสร้างและเติมช่อง Image Prompt (เจาะจงเฉพาะภาษาอังกฤษ สื่ออารมณ์ และมีสไตล์ตามที่กำหนด) สำหรับคิวเวลาเหล่านี้ใหม่ให้ถูกต้องและครบถ้วน ขอให้สร้างแถวข้อมูลใหม่ทั้งหมดของมาร์คเวลานั้นๆ
| Timestamp | Visual Suggestion / แนะนำภาพประกอบ | Reasoning & Viewer Benefit / เหตุผลและประโยชน์ | Google Flow Prompt / Prompt เจนรูปภาษาอังกฤษสไตล์ |
|---|---|---|---|`;
      } else if (issueType === "duration_long") {
        prompt = `จากเนื้อหาสคริปต์ (Phase 3) จัดว่าเกิดปัญหา Visual Freeze หรือภาพค้างนานเกินไป ในช่วงเวลาต่อไปนี้: ${ranges.join(", ")}
      
เนื่องจากผู้ชมอาจจะเสียความสนใจ กรุณาแก้ไขโดย:
1. แทรกคิวเวลาใหม่ (Timestamp ในรูปแบบ [MM:SS]) เข้าไปในเนื้อหาสคริปต์ (Phase 3) ของช่วงที่ค้างนาน เพื่อซอยภาพ (ภาพนิ่งไม่ควรเว้นเกิน 15-20 วินาที)
2. สร้างแถวข้อมูลตารางภาพ (Phase 2) สำหรับคิวเวลาใหม่ที่คุณแทรกเข้าไป

**วิธีการตอบกลับ:**
ตอบกลับด้วย JSON FORMAT เท่านั้น โดยมีโครงสร้างดังนี้:
\`\`\`json
{
  "new_visual_rows": "แถวตาราง markdown ที่จะเติมใน Phase 2",
  "updated_phase_3": "เนื้อหาสคริปต์ Phase 3 ฉบับเต็มที่แทรกมาร์คเวลาใหม่แล้ว"
}
\`\`\`
คำเตือน: ห้ามมี text อื่นๆ นอกกรอบ JSON`;
      } else if (issueType === "prompt_warning") {
        prompt = `จากตารางภาพ (Phase 2) ของคุณ พบว่าในคิวเวลาเหล่านี้มี Image Prompt ที่เสี่ยงต่อการสร้างรายได้ (Monetization Risk) หรือละเมิดข้อควรระวัง: ${ranges.join(", ")}
      
ได้แก่ การใช้ภาพน่ากลัว การหลั่งน้ำตา หน้าตาน่าเกลียด การใช้ข้อความตัวหนังสือ หรือไม่ได้ระบุสไตล์ความสมจริง

กรุณาเขียน Image Prompt (Google Flow Prompt) ในคิวเหล่านี้ใหม่ โดย:
1. หลีกเลี่ยงหน้าตากรีดร้อง ร้องไห้ อัปลักษณ์ หรือความรุนแรง ให้เปลี่ยนเป็น abstract silhouette, calm vibe, หรือ metapholic (เชิงเปรียบเทียบ) แทน
2. หลีกเลี่ยง text, logo, write, letters ต่างๆ
3. เพิ่ม keyword สไตล์ที่ทำให้คุณภาพภาพดีขึ้น เช่น "cinematic lighting, 8k, photorealistic" 

ขอให้ตอบกลับด้วยการสร้างแถวข้อมูลของมาร์คเวลานั้นๆ ใหม่
| Timestamp | Visual Suggestion / แนะนำภาพประกอบ | Reasoning & Viewer Benefit / เหตุผลและประโยชน์ | Google Flow Prompt / Prompt เจนรูปภาษาอังกฤษสไตล์ |
|---|---|---|---|`;
      }

      const response = await generateContent({
        contents: [content, prompt],
        config: {
          temperature: 0.7,
        },
      });

      if (response.text) {
        let updatedResult = content;

        if (issueType === "duration_long") {
          try {
            // Extract JSON
            const jsonMatch = response.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              const { new_visual_rows, updated_phase_3 } = parsed;
              // Replace Phase 3
              updatedResult = content.replace(
                /((?:^|\n)(?:#+\s*|\*\*\s*)?(?:Phase\s*3|ส่วนที่\s*3|Step\s*3)[\s\S]*)$/i,
                "## Phase 3: Voiceover Script\n\n" + updated_phase_3,
              );

              // Append to Phase 2
              const phase2Match = updatedResult.match(
                /((?:^|\n)(?:#+\s*|\*\*\s*)?(?:Phase\s*2|ส่วนที่\s*2|Step\s*2)[^\n]*\n(?:.*?))((?:^|\n)(?:#+\s*|\*\*\s*)?(?:Phase\s*3|ส่วนที่\s*3|Step\s*3))/is,
              );
              if (phase2Match) {
                const tableContent = phase2Match[1];
                updatedResult = updatedResult.replace(
                  tableContent,
                  `${tableContent}\n\n**[AI Auto-Fix] ข้อมูลเพิ่มเติมเพื่อแก้ไขปัญหา (${issueType}):**\n\n${new_visual_rows}\n\n`,
                );
              }
            } else {
              throw new Error("No JSON found");
            }
          } catch (e) {
            console.error("Failed to parse duration_long response", e);
          }
        } else {
          // Append or replace the result safely, extracting the new rows
          const newRows = response.text
            .replace(/```(?:markdown)?\n?/i, "")
            .replace(/```/i, "");

          const phase2Match = content.match(
            /((?:^|\n)(?:#+\s*|\*\*\s*)?(?:Phase\s*2|ส่วนที่\s*2|Step\s*2)[^\n]*\n(?:.*?))((?:^|\n)(?:#+\s*|\*\*\s*)?(?:Phase\s*3|ส่วนที่\s*3|Step\s*3))/is,
          );
          if (phase2Match) {
            const tableContent = phase2Match[1];
            updatedResult = content.replace(
              tableContent,
              `${tableContent}\n\n**[AI Auto-Fix] ข้อมูลเพิ่มเติมเพื่อแก้ไขปัญหา (${issueType}):**\n\n${newRows}\n\n`,
            );
          } else {
            updatedResult =
              content +
              `\n\n**[AI Auto-Fix] ข้อมูลเพิ่มเติมเพื่อแก้ไขปัญหา (${issueType}):**\n\n${newRows}\n\n`;
          }
        }

        setResult(updatedResult);
        alert(
          `✅ ทราบแล้วเปลี่ยน! AI เขียนข้อมูลชดเชยวิชวลสำหรับ ${issueType} ให้เรียบร้อย`,
        );
      }
    } catch (err: any) {
      console.error("Error generating AI fix:", err);
      const errStr = JSON.stringify(err || {});
      if (
        err?.status === "RESOURCE_EXHAUSTED" ||
        err?.status === 429 ||
        err?.error?.code === 429 ||
        err?.message?.includes("429") ||
        err?.message?.includes("quota") ||
        errStr.includes("429") ||
        errStr.includes("RESOURCE_EXHAUSTED")
      ) {
        alert(
          "ข้อผิดพลาด: โควต้าใช้งาน AI ของคุณหมดแล้ว (Rate Limit Exceeded / Quota Exhausted) กรุณารอสักครู่แล้วลองอีกครั้ง หรือตรวจสอบ API Key ของคุณ",
        );
      } else if (
        err?.status === "PERMISSION_DENIED" ||
        err?.message?.includes("403") ||
        err?.message?.includes("permission")
      ) {
        alert(
          "ข้อผิดพลาด: API Key ไม่ถูกต้อง หรือไม่มีสิทธิ์ใช้งาน (Permission Denied) กรุณาตรวจสอบ API Key ใน Settings อีกครั้ง",
        );
      } else {
        alert(
          `เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI หรือ API Error :( \n\n${err.message || ""}`,
        );
      }
    } finally {
      setIsGeneratingAIFix(false);
    }
  };

  const handleDownloadAll = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "seo_analysis_full.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadScript = () => {
    if (!result) return;
    // Extract only Phase 3 (Content Creation) if possible
    const match = result.match(/(?:^|\n)(?:#+\s*|\*\*\s*)?(?:Phase\s*3|ส่วนที่\s*3|Step\s*3)[\s\S]*/i);
    const content = match ? match[0] : result;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "podcast_script.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadBrollCSV = () => {
    if (!result) return;

    // 1. Extract only Phase 3 (Content Creation) which has the Visual & B-Roll list or table
    const phase3Match = result.match(/(?:^|\n)(?:#+\s*|\*\*\s*)?(?:Phase\s*3|ส่วนที่\s*3|Step\s*3)[\s\S]*/i);
    const phase3Content = phase3Match ? phase3Match[0] : result;

    let csvRows: string[][] = [];
    const lines = phase3Content.split("\n");
    const tableRows: string[][] = [];

    // Let's sweep and find any markdown table lines (usually starts with |)
    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("|") && trimmed.includes("|")) {
        // Remove trailing and leading pipe if exists, and split
        let cleanedLine = trimmed;
        if (cleanedLine.startsWith("|")) cleanedLine = cleanedLine.slice(1);
        if (cleanedLine.endsWith("|")) cleanedLine = cleanedLine.slice(0, -1);

        const cells = cleanedLine.split("|").map((c) => c.trim());

        // Ignore separator rows (e.g. |---|---| or |:---|:---|)
        const isSeparator = cells.every((cell) => /^:?-+:?$/.test(cell));
        if (!isSeparator && cells.length > 0) {
          tableRows.push(cells);
        }
      }
    }

    // Try to use parsed table rows
    if (tableRows.length > 1) {
      csvRows = tableRows;
    } else {
      // Fallback: Parse timestamp list items if table isn't present
      csvRows.push([
        "Timestamp",
        "Visual Suggestion / แนะนำภาพประกอบ",
        "Reasoning / เหตุผลประกอบ",
        "Viewer Benefit / ประโยชน์ต่อผู้ชม",
      ]);

      let currentTimestamp = "";
      let currentVisual = "";
      let currentReasoning = "";
      let currentBenefit = "";

      for (let line of lines) {
        const tsMatch = line.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/);
        if (tsMatch) {
          // If we had a previously built item, push it
          if (currentTimestamp) {
            csvRows.push([
              currentTimestamp,
              currentVisual || "Show topic visuals",
              currentReasoning || "Keep visual tempo",
              currentBenefit || "Better interest retention",
            ]);
          }
          currentTimestamp = tsMatch[0];
          // Extrude initial text of the timestamp line as suggestion
          const cleanText = line
            .replace(/^[-\*\s\d\.\#\:]+/, "")
            .replace(tsMatch[0], "")
            .replace(/\*\*+/g, "")
            .trim();
          currentVisual = cleanText;
          currentReasoning = "";
          currentBenefit = "";
        } else if (currentTimestamp && line.trim()) {
          const trimmed = line.trim();
          if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
            const text = trimmed.replace(/^[-\*\s]+/, "").trim();
            if (
              text.toLowerCase().includes("visual") ||
              text.includes("ภาพ") ||
              text.includes("ฟุตเทจ")
            ) {
              currentVisual = text.replace(
                /^(visual\s*(type)?|ภาพประกอบ|ภาพ|ฟุตเทจประกอบ|ฟุตเทจ)\s*[:：]\s*/i,
                "",
              );
            } else if (
              text.toLowerCase().includes("reason") ||
              text.includes("เหตุผล") ||
              text.includes("เพราะอะไร")
            ) {
              currentReasoning = text.replace(
                /^(reasoning|why|reason|เหตุผล)\s*[:：]\s*/i,
                "",
              );
            } else if (
              text.toLowerCase().includes("benefit") ||
              text.includes("ประโยชน์")
            ) {
              currentBenefit = text.replace(
                /^(benefit|viewer benefit|ประโยชน์)\s*[:：]\s*/i,
                "",
              );
            } else {
              if (!currentVisual) currentVisual = text;
              else if (!currentReasoning) currentReasoning = text;
              else if (!currentBenefit) currentBenefit = text;
            }
          }
        }
      }

      // Push last row if exists
      if (currentTimestamp) {
        csvRows.push([
          currentTimestamp,
          currentVisual || "Show final visuals",
          currentReasoning || "Maintain tempo",
          currentBenefit || "Summarize context",
        ]);
      }
    }

    // Secondary fallback with highly educational real visual structure if no rows are constructed
    if (csvRows.length <= 1) {
      if (visualStyle === "NotebookLM Analytical Indigo") {
        csvRows = [
          [
            "Timestamp",
            "Visual Suggestion / แนะนำภาพประกอบ",
            "Reasoning & Viewer Benefit / เหตุผลและประโยชน์",
            "Google Flow Prompt / Prompt เจนรูปภาษาอังกฤษสไตล์ NotebookLM",
          ],
          [
            "[0:00] Intro Hook",
            "Minimalist index card layout with glowing nodes and a title text representing core SEO concepts.",
            "Grab visual focus using a tech-analytical style; keeps immediate viewer retention high.",
            '"Minimalist workspace interface, NotebookLM aesthetic, glowing network nodes, translucent floating index cards displaying neat charts, hyper-detailed slate blue color palette, tech workspace, cinematic focus, 8k resolution"',
          ],
          [
            "[1:30] Step-by-step",
            "Structured list of keyword statistics showing custom graph connectors on a deep slate surface.",
            "Convert raw spoken stats into a visually interactive node chart to simplify comprehension.",
            '"Professional dark slate grey document workspace with blue and golden neon connecting lines, sleek glowing checkmark notes, high-tech academic feel, soft ambient glows, high contrast, 3d render"',
          ],
          [
            "[5:00] Technical Deep Dive",
            "Abstract glowing mind map linking high-volume search metrics and niche optimization secrets.",
            "Break technical fatigue and increase retention by visualizing complex data networks.",
            '"Highly sophisticated visual workflow of logical data blocks, dark minimalist theme, floating charts with cyan highlight curves, cybernetic office study desk, elegant atmospheric lighting, 8k"',
          ],
          [
            "[8:00] Conclusion CTA",
            "Minimal styled clean document folder detailing link sources with clear call-to-action indicators.",
            "Direct viewer interest specifically to the description link when user interest is peaked.",
            '"Sleek document stack folder, polished clean white and blue outline sheets, glowing modern CTA arrows on dark studio background, elegant 3d representation"',
          ],
        ];
      } else {
        csvRows = [
          [
            "Timestamp",
            "Visual Suggestion / แนะนำภาพประกอบ",
            "Reasoning / เหตุผลประกอบ",
            "Viewer Benefit / ประโยชน์ต่อผู้ชม",
          ],
          [
            "[0:00] Intro Hook",
            "Dramatic close-up of dynamic stock footage matching the target keyword alongside big display text.",
            "Grab visual focus in the first 5 seconds to minimize initial drops (Bounce Rate).",
            "Hook users immediately, prompting high curiosity to continue watching.",
          ],
          [
            "[1:30] Storytelling",
            "Split screens showing practical case study, simulated screenshot illustrations or charts.",
            "Substantiate claims and add authentic human credibility to abstract audio scripts.",
            "Enhances immediate understanding and builds trusted authority on the target topic.",
          ],
          [
            "[5:00] Mid-roll / Core Analysis",
            "Motion graphics of simplified tables of competitors or step-by-step checklist.",
            "Organize and present bulk information visually so that viewers can digest complex points easily.",
            "Increases video retention by breaking monotony with custom structural transitions.",
          ],
          [
            "[8:00] Outro / Action Call",
            "Show clear Call-To-Action overlay pointing directly to the website / articles with arrows.",
            "Instruct and direct viewers to click the link below in the description at the moment interest is peaked.",
            "Maximizes CTR and directly converts passive YouTube viewers to active website traffic.",
          ],
        ];
      }
    }

    // Convert CSV rows into appropriate string with correct escaping
    const csvContent = csvRows
      .map((row) =>
        row
          .map((cell) => {
            const escaped = cell.replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(","),
      )
      .join("\n");

    // UTF-8 BOM indicator so Excel opens Thai characters seamlessly
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "youtube_broll_visual_guide.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900 flex flex-col">
      {/* Header */}
      <header className="h-[60px] bg-slate-800 text-white flex items-center px-6 justify-between border-b-2 border-blue-600 sticky top-0 z-10 gap-4">
        <div className="font-extrabold text-xl tracking-tight flex items-center gap-2 shrink-0">
          YT <span className="text-red-500">Faceless</span> Podcast SEO Master
        </div>

        {/* Sync status/Project Saved Indicator */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/40 border border-slate-700/50 rounded-full shadow-inner select-none transition-all">
            {draftSavedStatus === "saving" ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.2,
                      ease: "easeInOut",
                    }}
                    className="flex items-center justify-center shrink-0"
                  >
                    <Cloud className="w-3.5 h-3.5 text-amber-400" />
                  </motion.div>
                  <span>กำลังบันทึกร่าง...</span>
                  {lastSynced && (
                    <span className="text-[10px] text-slate-400 font-mono border-l border-slate-700 pl-1.5 ml-1">
                      {lastSynced}
                    </span>
                  )}
                </div>
              </>
            ) : draftSavedStatus === "saved" ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: [1, 1.2, 1.05, 1] }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="flex items-center justify-center shrink-0"
                  >
                    <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                  </motion.div>
                  <span>Project Saved</span>
                  {lastSynced ? (
                    <span className="text-[10px] text-slate-400 font-mono border-l border-slate-700 pl-1.5 ml-1">
                      ล่าสุด {lastSynced}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-mono border-l border-slate-700 pl-1.5 ml-1">
                      เซฟแล้ว
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-500"></span>
                </span>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                  <Cloud className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>ยังไม่มีข้อมูลใหม่</span>
                  {lastSynced && (
                    <span className="text-[10px] text-slate-500 font-mono border-l border-slate-800 pl-1.5 ml-1">
                      เซฟล่าสุด {lastSynced}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="text-xs opacity-70 hidden md:block select-none shrink-0 border-l border-slate-700 pl-3 font-mono">
            v2.4
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:flex lg:gap-6 lg:h-[calc(100vh-60px)]">
        {/* Left Panel - Input & History */}
        {isSidebarOpen && (
          <div className="w-full lg:w-[400px] flex-none flex flex-col gap-4 overflow-y-auto pb-4 custom-scrollbar">
            {/* Input Section */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col shrink-0">
              <div className="text-[0.85rem] font-bold uppercase tracking-[0.05em] text-slate-500 mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[0.7rem]">
                    INPUT
                  </span>
                  ข้อมูลตั้งต้น
                </div>

                {/* Auto-save Status Indicator */}
                {input.trim() && (
                  <div className="flex items-center gap-1.5 text-[0.65rem] font-medium text-slate-400 capitalize transition-all duration-200">
                    {draftSavedStatus === "saving" ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                        <span className="text-blue-500 text-[10px]">
                          กำลังบันทึก...
                        </span>
                      </>
                    ) : draftSavedStatus === "saved" ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600 text-[10px]">
                          บันทึกร่างแล้ว
                        </span>
                      </>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Trending Niches Tool */}
              <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[0.75rem] font-bold text-slate-600 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-orange-500" />
                    เทรนด์ Niche (ประจำสัปดาห์)
                  </span>
                  <button
                    type="button"
                    onClick={handleGetTrendingNiches}
                    disabled={isFetchingTrends}
                    className="text-[0.7rem] font-bold flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors text-orange-700 bg-orange-100 hover:bg-orange-200 cursor-pointer shadow-sm"
                    title="ดูเทรนด์นิชรายสัปดาห์"
                  >
                    {isFetchingTrends ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        กำลังดึงข้อมูล...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-orange-500" />
                        ค้นหาเทรนด์ใหม่
                      </>
                    )}
                  </button>
                </div>

                {trendingNiches.length > 0 && (
                  <div className="bg-white border border-orange-100 rounded-lg p-2 space-y-2 transition-all duration-200 shadow-sm mt-3">
                    <div className="text-[0.65rem] text-slate-400 flex items-center justify-between px-1">
                      <span>
                        🔥 คลิก Niche เพื่อเพิ่มเข้าสู่ข้อมูลตั้งต้นด้านล่าง:
                      </span>
                      <button
                        onClick={() => setTrendingNiches([])}
                        className="text-slate-400 hover:text-red-500 text-[0.65rem] transition-colors"
                      >
                        ซ่อน
                      </button>
                    </div>
                    <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                      {trendingNiches.map((item, idx) => {
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleAddTrendingNiche(item.niche)}
                            className="flex flex-col gap-1 p-2 rounded-md text-left transition-all border border-orange-100 hover:bg-orange-50 hover:border-orange-200"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[0.75rem] text-slate-800">
                                {item.niche}
                              </span>
                              <span
                                className={cn(
                                  "text-[0.6rem] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                                  item.growth === "Hot"
                                    ? "text-rose-600 bg-rose-100"
                                    : "text-amber-600 bg-amber-100",
                                )}
                              >
                                {item.growth}
                              </span>
                            </div>
                            <span className="text-[0.7rem] text-slate-500 leading-snug">
                              {item.reason}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[0.8rem] text-slate-500 mb-3 leading-relaxed">
                ใส่ URL เว็บไซต์, หัวข้อ (Niche) หรือข้อมูลจาก Ahrefs / GSC
                เพื่อเริ่มวิเคราะห์
              </p>

              {isDraftRestored && (
                <div
                  id="draft-alert"
                  className="mb-3.5 p-3.5 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between gap-3 shadow-sm text-xs text-blue-800 transition-all duration-200 animate-in fade-in slide-in-from-top-2"
                >
                  <div className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-blue-900 mb-0.5">
                        📝 กู้คืนแบบร่างสำเร็จ!
                      </span>
                      <span className="text-[11px] text-blue-700 font-medium">
                        ระบบได้ฟื้นฟูข้อมูลร่างล่าสุดจากการพิมพ์ครั้งก่อนหน้าของคุณโดยอัตโนมัติ
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                    <button
                      type="button"
                      onClick={() => setIsDraftRestored(false)}
                      className="px-2.5 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold rounded-lg transition-colors cursor-pointer text-[11px]"
                    >
                      เก็บไว้
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInput("");
                        try {
                          localStorage.removeItem("podcast_input_draft");
                        } catch (err) {}
                        setIsDraftRestored(false);
                        setDraftSavedStatus("idle");
                      }}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
                      title="ลบฉบับร่างนี้ทิ้งทั้งหมด"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>เริ่มใหม่</span>
                    </button>
                  </div>
                </div>
              )}

              <textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // If they type, dismiss the "restored" popup banner since they are actively editing now
                  if (isDraftRestored) {
                    setIsDraftRestored(false);
                  }
                }}
                placeholder="เช่น: เว็บไซต์ขายอุปกรณ์แคมป์ปิ้ง (campinggear.com) อยากทำ podcast..."
                className="w-full h-36 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none transition-all"
              />

              {/* Keyword Suggestion Tool */}
              <div className="mt-2.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[0.75rem] font-bold text-slate-500 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                    คำค้นหา Long-Tail แนะนำ
                  </span>
                  <button
                    type="button"
                    onClick={handleGetSuggestions}
                    disabled={isSuggesting || !input.trim()}
                    className={cn(
                      "text-[0.7rem] font-bold flex items-center gap-1 px-2 py-1 rounded transition-colors",
                      !input.trim()
                        ? "text-slate-400 bg-slate-100 cursor-not-allowed"
                        : "text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer",
                    )}
                    title="วิเคราะห์คีย์เวิร์ดต่อยอด"
                  >
                    {isSuggesting ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        กำลังประมวลผล...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        แนะนำ Long-Tail
                      </>
                    )}
                  </button>
                </div>

                {suggestions.length > 0 && (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2 transition-all duration-200">
                    <div className="text-[0.65rem] text-slate-400 flex items-center justify-between">
                      <span>💡 คลิกคำเพื่อเพิ่มเป็นข้อเสนอทาง SEO:</span>
                      <button
                        onClick={() => setSuggestions([])}
                        className="text-slate-400 hover:text-red-500 text-[0.65rem] transition-colors"
                      >
                        ซ่อนไอเดีย
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                      {suggestions.map((item, idx) => {
                        const isAdded = input.includes(item.keyword);
                        return (
                          <motion.button
                            key={idx}
                            type="button"
                            onClick={() => handleAddSuggestion(item.keyword)}
                            disabled={isAdded}
                            initial={{ opacity: 0, y: 10, scale: 0.94 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            whileHover={
                              isAdded
                                ? {}
                                : {
                                    scale: 1.03,
                                    y: -1.5,
                                    boxShadow:
                                      "0 4px 6px -1px rgba(0,0,0,0.06)",
                                  }
                            }
                            whileTap={isAdded ? {} : { scale: 0.97 }}
                            transition={{
                              type: "spring",
                              stiffness: 260,
                              damping: 18,
                              delay: Math.min(idx * 0.04, 0.45),
                            }}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[0.75rem] transition-colors border text-left cursor-pointer",
                              isAdded
                                ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed line-through shadow-none"
                                : "bg-white hover:bg-blue-50/65 border-slate-200 hover:border-blue-300 text-slate-700 shadow-sm",
                            )}
                          >
                            <span className="font-semibold">
                              {item.keyword}
                            </span>
                            <span className="flex items-center gap-0.5 text-[0.65rem] text-slate-500 bg-slate-100 px-1 py-0.5 rounded font-mono">
                              {item.volume}
                              {item.trend === "rising" && (
                                <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
                              )}
                              {item.trend === "falling" && (
                                <TrendingDown className="w-2.5 h-2.5 text-rose-500" />
                              )}
                              {item.trend === "flat" && (
                                <Minus className="w-2.5 h-2.5 text-slate-400" />
                              )}
                            </span>
                            <span
                              className={cn(
                                "text-[0.6rem] font-bold px-1 rounded-sm uppercase tracking-wider scale-95",
                                item.difficulty.toLowerCase() === "low" ||
                                  item.difficulty.toLowerCase() === "easy"
                                  ? "text-emerald-600 bg-emerald-50"
                                  : item.difficulty.toLowerCase() ===
                                        "medium" ||
                                      item.difficulty.toLowerCase() ===
                                        "moderate"
                                    ? "text-amber-600 bg-amber-50"
                                    : "text-rose-600 bg-rose-50",
                              )}
                            >
                              {item.difficulty}
                            </span>
                            {!isAdded && (
                              <span className="text-blue-500 font-bold ml-0.5 text-xs">
                                +
                              </span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                <div>
                  <label
                    htmlFor="storytellingFormat"
                    className="block text-[0.75rem] font-bold text-slate-600 mb-1.5"
                  >
                    รูปแบบการเล่าเรื่อง (Storytelling Format):
                  </label>
                  <select
                    id="storytellingFormat"
                    value={storytellingFormat}
                    onChange={(e) => setStorytellingFormat(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all cursor-pointer"
                  >
                    {FORMAT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2.5 border-t border-slate-100">
                  <label
                    htmlFor="visualStyle"
                    className="block text-[0.75rem] font-bold text-slate-600 mb-1.5"
                  >
                    สไตล์ภาพประกอบ (Visual / B-Roll Style):
                  </label>
                  <select
                    id="visualStyle"
                    value={visualStyle}
                    onChange={(e) => setVisualStyle(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all cursor-pointer"
                  >
                    {VISUAL_STYLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {visualStyle === "NotebookLM Analytical Indigo" && (
                    <p className="mt-1.5 text-[0.7rem] text-slate-500 leading-snug">
                      💡 ระบบจะเจน{" "}
                      <strong>Google Flow Image Prompt (ภาษาอังกฤษ)</strong>{" "}
                      คุมโทนเรียบหรู คลีนมินิมอล สีกราฟเชื่อมโยงแบบ NotebookLM
                      สำหรับเอาไปใส่ใน AI Image Generators ได้ทันที!
                    </p>
                  )}
                </div>
              </div>

              {error && (
                <div className="mt-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className={cn(
                  "mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-white transition-all",
                  isGenerating
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow active:scale-[0.98]",
                )}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังวิเคราะห์ข้อมูล...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    เริ่มวิเคราะห์ & สร้างสคริปต์
                  </>
                )}
              </button>

              {/* Collapsible Info */}
              <details className="mt-4 bg-slate-50 rounded-xl p-3 border border-slate-100 text-sm text-slate-600 [&_summary]:font-semibold [&_summary]:cursor-pointer [&_summary]:select-none [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex items-center justify-between">
                  <span>🤔 วิธีใช้งานระบบ (Workflow)</span>
                  <span className="text-slate-400 text-xs opacity-60">
                    คลิกเพื่อดูรายละเอียด
                  </span>
                </summary>
                <div className="pt-3 mt-3 border-t border-slate-200 space-y-2 text-[0.8rem] text-slate-500">
                  <p>
                    <span className="font-bold text-blue-600">
                      1. วิเคราะห์ SEO Gap & คู่แข่ง:
                    </span>{" "}
                    หา Niche ที่มีโอกาสสูง และวิเคราะห์คู่แข่งเบื้องต้น
                  </p>
                  <p>
                    <span className="font-bold text-blue-600">
                      2. Topic Selection & Value:
                    </span>{" "}
                    เลือกหัวข้อที่ดีที่สุด พร้อมวิเคราะห์
                    **"การแก้ปัญหาและประโยชน์"** ที่ผู้ฟังจะได้รับ
                  </p>
                  <p>
                    <span className="font-bold text-blue-600">
                      3. Content Generation:
                    </span>{" "}
                    สร้าง Title, Script, Description และ B-Roll Visual Guide
                    (คำแนะนำภาพประกอบวิดีโอ & ประโยชน์เชิงลึก)
                  </p>
                </div>
              </details>
            </section>

            {/* Competitor Watchlist Section */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col shrink-0">
              <div className="text-[0.85rem] font-bold uppercase tracking-[0.05em] text-slate-500 mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="bg-rose-600 text-white px-2 py-0.5 rounded text-[0.7rem]">
                    WATCHLIST
                  </span>
                  คู่แข่งที่ต้องเฝ้าระวัง
                </div>
                <button
                  id="toggle-add-competitor-btn"
                  type="button"
                  onClick={() => setShowAddComp(!showAddComp)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 transition-colors bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg cursor-pointer"
                >
                  {showAddComp ? (
                    "ยกเลิก"
                  ) : (
                    <>
                      <Plus className="w-3 h-3" /> เพิ่ม
                    </>
                  )}
                </button>
              </div>

              {showAddComp && (
                <form
                  onSubmit={handleAddCompetitor}
                  className="mb-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3"
                >
                  <div className="text-[0.8rem] font-bold text-slate-700">
                    เพิ่มช่อง/วิดีโอคู่แข่งลงในระบบ
                  </div>

                  <div>
                    <label
                      htmlFor="compName"
                      className="block text-[0.7rem] font-bold text-slate-500 mb-1"
                    >
                      ชื่อช่องหรือชื่อวิดีโอ *
                    </label>
                    <input
                      id="compName"
                      type="text"
                      value={compName}
                      onChange={(e) => setCompName(e.target.value)}
                      placeholder="เช่น Ali Abdaal หรือ วิธีเริ่ม Podcast 2026"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="compUrl"
                      className="block text-[0.7rem] font-bold text-slate-500 mb-1"
                    >
                      ลิงก์ URL (YouTube) *
                    </label>
                    <input
                      id="compUrl"
                      type="url"
                      value={compUrl}
                      onChange={(e) => setCompUrl(e.target.value)}
                      placeholder="เช่น https://www.youtube.com/@..."
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="compNotes"
                      className="block text-[0.7rem] font-bold text-slate-500 mb-1"
                    >
                      คำอธิบาย / SEO Content Gap ที่ต้องเฝ้าระวัง
                      (ระบุหรือไม่ก็ได้)
                    </label>
                    <textarea
                      id="compNotes"
                      value={compNotes}
                      onChange={(e) => setCompNotes(e.target.value)}
                      placeholder="เช่น วิเคราะห์สคริปต์สั้นกระชับ, จุดแข็งเรื่อง Visual B-Roll เคลื่อนไหวเร็ว"
                      className="w-full h-16 p-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>

                  {compError && (
                    <div className="text-[11px] text-red-600 font-semibold bg-red-50 p-2 rounded-md border border-red-100">
                      ⚠️ {compError}
                    </div>
                  )}

                  <button
                    id="add-competitor-submit-btn"
                    type="submit"
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 font-bold text-white text-xs rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                    บันทึกลง Watchlist
                  </button>
                </form>
              )}

              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                {watchlist.length === 0 ? (
                  <div className="text-xs text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50 flex flex-col items-center justify-center gap-2">
                    <Eye className="w-5 h-5 text-slate-300 opacity-80" />
                    <span>ยังไม่มีคู่แข่งใน Watchlist</span>
                  </div>
                ) : (
                  watchlist.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/50 transition-all duration-150 flex flex-col justify-between gap-1.5 shadow-sm relative group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <Youtube className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="font-bold text-[0.8rem] text-slate-800 block truncate leading-tight">
                              {item.name}
                            </span>
                            <a
                              id={`ext-link-comp-${item.id}`}
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-blue-500 hover:text-blue-600 hover:underline flex items-center gap-0.5 mt-0.5 font-mono truncate"
                              title="เปิดช่อง/วิดีโอในหน้าต่างใหม่"
                            >
                              <Link className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{item.url}</span>
                              <ExternalLink className="w-2.5 h-2.5 shrink-0 ml-0.5" />
                            </a>
                          </div>
                        </div>

                        <button
                          id={`delete-comp-${item.id}`}
                          type="button"
                          onClick={() => handleRemoveCompetitor(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                          title="ลบออกจาก Watchlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {item.notes && (
                        <p className="text-[11px] text-slate-600 bg-white px-2 py-1.5 rounded-lg border border-slate-50 leading-relaxed">
                          📌 {item.notes}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-[9px] text-slate-400 font-mono">
                          {new Date(item.timestamp).toLocaleDateString(
                            "th-TH",
                            { day: "2-digit", month: "short" },
                          )}
                        </span>

                        <button
                          id={`use-comp-${item.id}`}
                          type="button"
                          onClick={() => handleUseCompetitorForInput(item)}
                          className="text-[10.5px] bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="คลิกเพื่อป้อนคีย์เวิร์ดคู่แข่งนี้เข้าเป็นข้อมูลตั้งต้นด้านบนเพื่อวิเคราะห์ต่อ"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>ดึงข้อมูลมาเทียบ Content Gap</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* History Section */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col flex-1 min-h-[250px]">
              <div className="text-[0.85rem] font-bold uppercase tracking-[0.05em] text-slate-500 mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[0.7rem]">
                    HISTORY
                  </span>
                  ประวัติการสร้าง
                </div>
                {history.length > 0 && (
                  <button
                    onClick={() => setHistory([])}
                    className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> ล้างประวัติ
                  </button>
                )}
              </div>
              <div className="overflow-y-auto flex-1 space-y-2 pr-1 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="text-sm text-slate-400 h-full flex flex-col justify-center items-center gap-2">
                    <Clock className="w-6 h-6 opacity-20" />
                    ยังไม่มีประวัติ
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setInput(item.input);
                        setResult(item.result);
                      }}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-[0.7rem] text-slate-400 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(item.timestamp).toLocaleString("th-TH", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <div className="text-[0.8rem] text-slate-700 line-clamp-2 leading-snug">
                        {item.input}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {/* Right Panel - Output Section */}
        <div className="flex-1 flex flex-col min-w-0 mt-6 lg:mt-0 h-full lg:h-[calc(100vh-108px)]">
          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col h-full min-h-0">
            <div className="text-[0.85rem] font-bold uppercase tracking-[0.05em] text-slate-500 mb-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors hidden lg:block"
                  title={isSidebarOpen ? "ซ่อนแถบด้านซ้าย" : "แสดงแถบด้านซ้าย"}
                >
                  {isSidebarOpen ? (
                    <PanelLeftClose className="w-4 h-4" />
                  ) : (
                    <PanelLeftOpen className="w-4 h-4" />
                  )}
                </button>
                <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[0.7rem]">
                  OUTPUT
                </span>
                ผลลัพธ์ (Content Preview)
              </div>
              {result && (
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer mr-1"
                    title="คัดลอกทั้งหมด"
                  >
                    {copied ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={handleDownloadScript}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    title="ดาวน์โหลดเฉพาะสคริปต์ (.txt)"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Script (.txt)
                  </button>
                  <button
                    onClick={handleDownloadBrollCSV}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-emerald-100"
                    title="ดาวน์โหลดตารางภาพประกอบและ B-Roll สำหรับวิดีโอ (.csv)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    B-Roll & Visuals (.csv)
                  </button>
                  <button
                    onClick={handleDownloadAll}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    title="ดาวน์โหลดทั้งหมด (.md)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Everything (.md)
                  </button>
                </div>
              )}
            </div>

            <div
              className={cn(
                "flex-1 rounded-xl overflow-hidden relative flex flex-col min-h-0",
                result
                  ? ""
                  : "bg-slate-900 border border-slate-800 shadow-inner",
              )}
            >
              {result ? (
                <>
                  {isGeneratingAIFix && (
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center pointer-events-auto">
                      <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                      <p className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-sky-400 animate-pulse drop-shadow-md">
                        กำลังให้ AI ทำการแก้ไขข้อมูลตารางภาพที่ขาดตกบกพร่อง...
                      </p>
                      <p className="text-slate-400 mt-2 text-sm font-medium">
                        Please wait while matching visuals.
                      </p>
                    </div>
                  )}
                  <ResultTabs
                    result={result}
                    onUpdateResult={setResult}
                    onAIAssistFix={handleAIAssistFix}
                  />
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center p-6">
                  <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-5 border border-slate-700 shadow-inner">
                    <Youtube className="w-10 h-10 text-slate-400" />
                  </div>
                  <p className="text-lg font-bold text-sky-400 mb-2 tracking-wide">
                    WAITING FOR INPUT
                  </p>
                  <p className="text-sm max-w-sm font-sans text-slate-400 leading-relaxed">
                    พิมพ์ข้อมูลตั้งต้นที่ด้านซ้าย และกดปุ่มวิเคราะห์
                    ข้อมูลผลลัพธ์ที่ได้จะแสดงที่นี่
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

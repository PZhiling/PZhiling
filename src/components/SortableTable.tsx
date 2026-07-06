import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowUpDown, Search, Flame, Sparkles, Compass, Layers, ListChecks, FileText, Download } from 'lucide-react';
import { cn } from '../lib/utils';

// Helper to parse volume values like "8.5K/mo", "1.2M", "500"
const parseVolume = (val: string): number => {
  const cleaned = val.replace(/,/g, '').toLowerCase().trim();
  const match = cleaned.match(/([\d\.]+)\s*([km])?/);
  if (match) {
    let num = parseFloat(match[1]);
    const unit = match[2];
    if (unit === 'k') num *= 1000;
    if (unit === 'm') num *= 1000000;
    return num;
  }
  return 0;
};

// Helper to parse difficulty like "Low", "Medium", "High", or numeric values
const parseDifficulty = (val: string): { label: "Low" | "Medium" | "High"; score: number } => {
  const cleaned = val.toLowerCase().trim();
  const numMatch = cleaned.match(/\d+/);
  if (numMatch) {
    const score = parseInt(numMatch[0], 10);
    if (score <= 30) return { label: 'Low', score };
    if (score <= 70) return { label: 'Medium', score };
    return { label: 'High', score };
  }
  if (cleaned.includes('low') || cleaned.includes('easy') || cleaned.includes('ง่าย') || cleaned.includes('ต่ำ')) {
    return { label: 'Low', score: 15 };
  }
  if (cleaned.includes('high') || cleaned.includes('hard') || cleaned.includes('ยาก') || cleaned.includes('สูง')) {
    return { label: 'High', score: 85 };
  }
  return { label: 'Medium', score: 50 };
};

export function SortableTable({ children, ...props }: any) {
  const [filter, setFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: number; direction: 'asc' | 'desc' } | null>(null);
  const [activeCell, setActiveCell] = useState<{ vol: 'High' | 'Medium' | 'Low'; diff: 'Low' | 'Medium' | 'High' }>({ vol: 'High', diff: 'Low' });
  const [activePhaseTab, setActivePhaseTab] = useState<'matrix' | 'clusters'>('matrix');
  const [selectedClusterId, setSelectedClusterId] = useState<string>('');
  const [showHighPotentialOnly, setShowHighPotentialOnly] = useState(false);

  // Extract thead and tbody from children
  const childrenArray = React.Children.toArray(children);
  const thead = childrenArray.find((child: any) => child.type === 'thead');
  const tbody = childrenArray.find((child: any) => child.type === 'tbody');

  // Fallback to default table if structure is unexpected
  if (!thead || !tbody) {
    return <table {...props}>{children}</table>;
  }

  // Extract headers
  const headRow = React.Children.toArray((thead as any).props.children).find((child: any) => child.type === 'tr');
  const headers = React.Children.toArray((headRow as any).props.children).map((th: any) => th.props.children);

  // Extract rows
  const bodyRows = React.Children.toArray((tbody as any).props.children).filter((child: any) => child.type === 'tr');
  const rows = bodyRows.map((tr: any) => {
    return React.Children.toArray(tr.props.children).map((td: any) => td.props.children);
  });

  // Helper to extract plain text from React nodes for sorting and filtering
  const getText = (node: any): string => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(getText).join('');
    if (React.isValidElement(node)) return getText((node.props as any).children);
    return '';
  };

  // Check if Table is an SEO Column table
  const keywordColIdx = headers.findIndex((h: any) => {
    const s = getText(h).toLowerCase();
    return s.includes('keyword') || s.includes('คีย์เวิร์ด') || s.includes('คำค้นหา');
  });

  const volumeColIdx = headers.findIndex((h: any) => {
    const s = getText(h).toLowerCase();
    return s.includes('volume') || s.includes('ปริมาณ') || s.includes('การค้นหา') || s.includes('search');
  });

  const difficultyColIdx = headers.findIndex((h: any) => {
    const s = getText(h).toLowerCase();
    return s.includes('difficulty') || s.includes('ความยาก') || s.includes('kd');
  });

  const isSeoTable = keywordColIdx >= 0 && volumeColIdx >= 0 && difficultyColIdx >= 0;

  // Compute Heatmap and Score data if SEO Table detected
  const heatmapData = useMemo(() => {
    if (!isSeoTable) return null;

    const parsedKeywords = rows.map((row) => {
      const rawKeyword = getText(row[keywordColIdx]);
      const rawVolume = getText(row[volumeColIdx]);
      const rawDifficulty = getText(row[difficultyColIdx]);

      const volNum = parseVolume(rawVolume);
      const diffInfo = parseDifficulty(rawDifficulty);

      return {
        keyword: rawKeyword,
        volumeStr: rawVolume,
        volumeNum: volNum,
        difficultyLabel: diffInfo.label,
        difficultyScore: diffInfo.score,
        originalRow: row
      };
    });

    const volumes = parsedKeywords.map(k => k.volumeNum).filter(v => v > 0);
    const maxVol = volumes.length > 0 ? Math.max(...volumes) : 1000;
    const minVol = volumes.length > 0 ? Math.min(...volumes) : 0;
    const volRange = maxVol - minVol;

    const categorizedKeywords = parsedKeywords.map(k => {
      let volCategory: 'High' | 'Medium' | 'Low' = 'Medium';
      if (volRange === 0) {
        volCategory = 'High';
      } else {
        const relative = (k.volumeNum - minVol) / volRange;
        if (relative >= 0.66) {
          volCategory = 'High';
        } else if (relative >= 0.33) {
          volCategory = 'Medium';
        } else {
          volCategory = 'Low';
        }
      }

      // Opportunity score weighting: low difficulty is highly prioritized for SEO Gaps (60% weight) vs volume (40% weight)
      const volScore = maxVol > 0 ? (k.volumeNum / maxVol) * 100 : 50;
      const diffInverse = 100 - k.difficultyScore;
      const oppScore = Math.round((volScore * 0.4) + (diffInverse * 0.6));

      return {
        ...k,
        volCategory,
        oppScore
      };
    });

    return categorizedKeywords;
  }, [isSeoTable, rows, keywordColIdx, volumeColIdx, difficultyColIdx]);

  // Compute thematic clusters based on heatmap data
  const clusters = useMemo(() => {
    if (!heatmapData || heatmapData.length === 0) return [];

    const THEME_DEFINITIONS = [
      {
        id: 'ai_tech',
        name: 'ซีรีส์: AI & Automation Secrets',
        keywords: ['ai', 'chatgpt', 'gemini', 'midjourney', 'canva', 'เครื่องมือ', 'โปรแกรม', 'เว็บ', 'เทคโนโลยี', 'tech', 'อัตโนมัติ'],
        description: 'เน้นแนะนำเครื่องมืออัจฉริยะและการประหยัดเวลาด้วยระบบอัตโนมัติ เหมาะที่จะปั้นเป็นวิดีโอ How-To สำหรับคนยุคใหม่'
      },
      {
        id: 'creator_business',
        name: 'ซีรีส์: Creator Economy & Branding',
        keywords: ['ธุรกิจ', 'ขาย', 'แบรนด์', 'แชร์', 'ไอเดีย', 'ตลาด', 'ช่อง', 'youtube', 'tiktok', 'facebook', 'วิดีโอ', 'คลิป', 'สร้างรายได้'],
        description: 'เจาะลึกกระบวนการทำงานแบบนักสร้างสรรค์ วิธีขยายแบรนด์ และกลยุทธ์การเติบโตเพื่อคว้าผู้ติดตามในช่องทางสตรีมมิ่ง'
      },
      {
        id: 'investment_finance',
        name: 'ซีรีส์: Wealth Mastery & Finance',
        keywords: ['หุ้น', 'คริปโต', 'เงิน', 'ลงโฆษณา', 'รายได้', 'หาเงิน', 'crypto', 'finance', 'gold', 'ทองคำ', 'ลงทุน', 'ออมเงิน'],
        description: 'ซีรีส์พอดแคสต์เล่าสถานการณ์เศรษฐกิจโลก วิเคราะห์ทรัพย์สินดิจิทัล ปูทางความรู้ทางการเงินที่ครอบคลุมสำหรับวัยสร้างตัว'
      },
      {
        id: 'beginner_guide',
        name: 'ซีรีส์: Ultimate Beginner Hub (จาก ศูนย์ สู่ โปร)',
        keywords: ['วิธี', 'สอน', 'คู่มือ', 'มือใหม่', 'เริ่มต้น', 'ทำอย่างไร', 'how to', 'guide', 'เบื้องต้น'],
        description: 'ตอบโจทย์ผู้เริ่มจับต้นชนปลายไม่ถูก คัดกรองหัวข้อยอดฮิตมาเล่าขั้นตอน 1-2-3-4 ให้ทุกคนเอาไปปฏิบัติตามได้ในทันที'
      },
      {
        id: 'mindset_psychology',
        name: 'ซีรีส์: Mindset & Life Psychology',
        keywords: ['จิตวิทยา', 'พัฒนาตัวเอง', 'วินัย', 'สมาธิ', 'แนวคิด', 'ความเครียด', 'คิดบวก', 'ความผ่อนคลาย', 'ความสุข'],
        description: 'รวบรวมงานวิจัยด้านจิตวิทยาเชิงบวก การปลูกสร้างนิสัยใหม่ๆ และวิธีบรรเทาจิตใจให้มีพลังใจที่แข็งแกร่ง'
      }
    ];

    const computedClusters: {
      id: string;
      name: string;
      description: string;
      keywords: typeof heatmapData;
      avgScore: number;
      totalVolume: number;
    }[] = [];

    const thematicMap = THEME_DEFINITIONS.map(def => ({
      ...def,
      keywordsList: [] as typeof heatmapData
    }));

    const wordCounts: { [word: string]: typeof heatmapData } = {};

    heatmapData.forEach(item => {
      const kwLower = item.keyword.toLowerCase();

      thematicMap.forEach(def => {
        if (def.keywords.some(pat => kwLower.includes(pat))) {
          def.keywordsList.push(item);
        }
      });

      const words = kwLower.split(/[\s_\-\|+,]+/);
      words.forEach(w => {
        const cleanW = w.trim();
        if (cleanW.length >= 3) {
          if (!wordCounts[cleanW]) wordCounts[cleanW] = [];
          if (!wordCounts[cleanW].some(x => x.keyword === item.keyword)) {
            wordCounts[cleanW].push(item);
          }
        }
      });
    });

    thematicMap.forEach(def => {
      if (def.keywordsList.length > 0) {
        const avgScore = Math.round(def.keywordsList.reduce((sum, item) => sum + item.oppScore, 0) / def.keywordsList.length);
        const totalVolume = def.keywordsList.reduce((sum, item) => sum + item.volumeNum, 0);
        
        computedClusters.push({
          id: def.id,
          name: def.name,
          description: def.description,
          keywords: def.keywordsList,
          avgScore,
          totalVolume
        });
      }
    });

    const sortedWords = Object.keys(wordCounts).sort((a, b) => wordCounts[b].length - wordCounts[a].length);
    
    for (const word of sortedWords) {
      const list = wordCounts[word];
      if (list.length >= 2 && !['and', 'the', 'for', 'with', 'podcast', 'youtube', 'how'].includes(word)) {
        const isDuplicateSet = computedClusters.some(c => 
          c.keywords.length === list.length && c.keywords.every((item, idx) => list.includes(item))
        );

        if (!isDuplicateSet && computedClusters.length < 5) {
          const avgScore = Math.round(list.reduce((sum, item) => sum + item.oppScore, 0) / list.length);
          const totalVolume = list.reduce((sum, item) => sum + item.volumeNum, 0);
          const displayLabel = word.charAt(0).toUpperCase() + word.slice(1);
          
          computedClusters.push({
            id: `dynamic_${word}`,
            name: `ซีรีส์: เจาะจงเฉพาะกลุ่ม [${displayLabel}]`,
            description: `กลุ่มหัวข้อซีรีส์พอดแคสต์ที่จัดสรรให้สอดคล้องกับคีย์เวิร์ดหลักของกลุ่มคำ "${displayLabel}" เพื่อตอบคำถามผู้ฟังอย่างตรงเป้า`,
            keywords: list,
            avgScore,
            totalVolume
          });
        }
      }
    }

    if (computedClusters.length === 0 && heatmapData.length > 0) {
      const avgScore = Math.round(heatmapData.reduce((sum, item) => sum + item.oppScore, 0) / heatmapData.length);
      const totalVolume = heatmapData.reduce((sum, item) => sum + item.volumeNum, 0);
      
      computedClusters.push({
        id: 'general_fallback',
        name: 'ซีรีส์: แนะนำหัวข้อหลักแบบครอบคลุม',
        description: 'รวมชุดเนื้อหายอดฮิตที่มีโอกาสติดอันดับ SEO ทั่วไปพร้อมกันเพื่อสร้างฐานแฟนคลับในระยะแรกเริ่ม',
        keywords: heatmapData,
        avgScore,
        totalVolume
      });
    }

    return computedClusters;
  }, [heatmapData]);

  const getKeywordsForCell = (vol: 'High' | 'Medium' | 'Low', diff: 'Low' | 'Medium' | 'High') => {
    if (!heatmapData) return [];
    return heatmapData.filter(
      item => item.volCategory === vol && item.difficultyLabel === diff
    );
  };

  const sortedRows = useMemo(() => {
    let sortableRows = [...rows];
    if (sortConfig !== null) {
      sortableRows.sort((a, b) => {
        const aVal = getText(a[sortConfig.key]);
        const bVal = getText(b[sortConfig.key]);
        
        // Try parsing numbers for a numeric sort
        const aNum = parseFloat(aVal.replace(/,/g, ''));
        const bNum = parseFloat(bVal.replace(/,/g, ''));
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
        }
        
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal, 'th', { sensitivity: 'base' })
          : bVal.localeCompare(aVal, 'th', { sensitivity: 'base' });
      });
    }
    
    // Apply filtering
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      sortableRows = sortableRows.filter(row => 
        row.some(cell => getText(cell).toLowerCase().includes(lowerFilter))
      );
    }

    // Apply High Potential Filter (hides keywords with high difficulty and low volume)
    if (isSeoTable && showHighPotentialOnly) {
      sortableRows = sortableRows.filter(row => {
        const rawDifficulty = difficultyColIdx >= 0 ? getText(row[difficultyColIdx]) : '';
        const rawVolume = volumeColIdx >= 0 ? getText(row[volumeColIdx]) : '';

        const scoreDiff = parseDifficulty(rawDifficulty).score; // High = 85, Medium = 50, Low = 15
        const volNum = parseVolume(rawVolume);

        const isHighDiff = scoreDiff >= 70;
        const isLowVol = volNum < 10000;

        // Hide if it's both high difficulty AND low volume
        return !(isHighDiff && isLowVol);
      });
    }
    
    return sortableRows;
  }, [rows, sortConfig, filter, isSeoTable, showHighPotentialOnly, difficultyColIdx, volumeColIdx]);

  const requestSort = (index: number) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === index && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: index, direction });
  };

  const handleExportCluster = (cluster: any) => {
    if (!cluster) return;
    const outline = `==================================================
PODCAST SERIES OUTLINE & SEO STRATEGY BRIEF
==================================================
ซีรีส์: ${cluster.name}
คำอธิบายโครงสร้าง: ${cluster.description}
คะแนนความน่าสนใจเฉลี่ย (SEO Score): ${cluster.avgScore}/100

--------------------------------------------------
แผนตอนและคีย์เวิร์ดเป้าหมาย (Episode Plan):
--------------------------------------------------
${cluster.keywords.map((kw: any, idx: number) => `
Episode ${idx + 1}: ${kw.keyword}
- ตลาดเป้าหมายคีย์เวิร์ด: ${kw.keyword}
- ปริมาณการค้นหา (Volume): ${kw.volumeStr} / เดือน
- ความยากในการทำอันดับ (Difficulty): ${kw.difficultyLabel} (Score: ${kw.difficultyScore})
- คะแนนโอกาสในการติดกระแส (Opportunity): ${kw.oppScore}/100
- คำแนะนำภาพประกอบ / B-Roll: แนะนำใช้ภาพและสื่อประกอบที่ดึงดูดสายตา เข้ากับเรื่องย่อย สรุปประเด็นหลักใน 3 นาทีแรก
`).join('\n')}

--------------------------------------------------
แผนการโปรโมทและข้อแนะนำ (Creator Best Practices):
1. ตั้งชื่อ Playlist ด้วยคีย์เวิร์ดหลักของซีรีส์ เพื่อดึงกระแสผู้ชมแบบสะสม
2. ทำลิงก์เชื่อมโยงระหว่างวิดีโอ (End Screen & Cards) และเนื้อหาในตอนถัดไปเพื่อเพิ่ม Session Watch Duration
3. แนบคำอธิบาย (Video Description) โดยรวมคำเชื่อมโยงของทุกตอนในซีรีส์

สรุปโดย "YT Faceless Podcast SEO Master" AI
==================================================`;
    
    const blob = new Blob([outline], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `series_brief_${cluster.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-6 space-y-4">
      {/* Dynamic SEO Opportunity Heatmap Render */}
      {isSeoTable && heatmapData && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6 space-y-4 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <Flame className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-200">วิเคราะห์ช่องว่างและคอลเลกชันซีรีส์ (SEO Gaps & Thematic Clusters)</h4>
                <p className="text-xs text-slate-400">ค้นหากลุ่มคีย์เวิร์ดระดับทองคำ และจัดคิวพอดแคสต์เป็นซีรีส์เพื่อมัดใจฐานผู้ฟัง</p>
              </div>
            </div>
            <div className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-mono uppercase tracking-wider font-bold self-start sm:self-auto">
              SEO Co-Pilot Enabled
            </div>
          </div>

          {/* Segmented Tab Toggles */}
          <div className="flex gap-2 p-1 bg-slate-950/60 rounded-xl border border-slate-800/80 max-w-sm shrink-0">
            <button
              type="button"
              onClick={() => setActivePhaseTab('matrix')}
              className={cn(
                "flex-1 text-center py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none",
                activePhaseTab === 'matrix'
                  ? "bg-slate-800 text-sky-400 shadow-[0_2px_8px_rgba(56,189,248,0.12)] ring-1 ring-slate-700/50"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/20"
              )}
            >
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              เมทริกซ์ช่องว่าง (SEO Matrix)
            </button>
            <button
              type="button"
              onClick={() => setActivePhaseTab('clusters')}
              className={cn(
                "flex-1 text-center py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none",
                activePhaseTab === 'clusters'
                  ? "bg-slate-800 text-violet-400 shadow-[0_2px_8px_rgba(168,85,247,0.12)] ring-1 ring-slate-700/50"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/20"
              )}
            >
              <Layers className="w-3.5 h-3.5 text-violet-400" />
              กลุ่มซีรีส์ (Thematic Clusters)
            </button>
          </div>

          {activePhaseTab === 'matrix' ? (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* 3x3 Heatmap Matrix - 3 columns on desktop */}
              <div className="lg:col-span-3 space-y-3">
                <div className="text-xs font-semibold text-slate-400 flex items-center justify-between mb-1">
                  <span>📊 เมทริกซ์ (Search Volume vs Keyword Difficulty)</span>
                  <span className="text-[10px] text-slate-500">💡 คลิกแต่ละช่องเพื่อดูรายละเอียด</span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {/* Empty axis label cell */}
                  <div className="flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center pr-1 border-r border-slate-800">
                    Volume \ KD
                  </div>
                  
                  {/* Columns Header (Difficulty) */}
                  <div className="text-center py-1.5 bg-slate-800/40 border border-slate-700/40 rounded-lg text-slate-300 font-bold text-[10px] sm:text-xs">
                    🟢 Easy / Low KD
                  </div>
                  <div className="text-center py-1.5 bg-slate-800/40 border border-slate-700/40 rounded-lg text-slate-300 font-bold text-[10px] sm:text-xs font-mono">
                    🟡 Moderate KD
                  </div>
                  <div className="text-center py-1.5 bg-slate-800/40 border border-slate-700/40 rounded-lg text-slate-300 font-bold text-[10px] sm:text-xs">
                    🔴 Difficult / High KD
                  </div>

                  {/* Rows mapped by Search Volume */}
                  {(['High', 'Medium', 'Low'] as const).map(vol => {
                    const volColor = vol === 'High' ? 'text-sky-400' : vol === 'Medium' ? 'text-slate-300' : 'text-slate-500';
                    const volIcon = vol === 'High' ? '🔥 High' : vol === 'Medium' ? '📈 Med' : '🌱 Low';
                    return (
                      <React.Fragment key={vol}>
                        {/* Y-Axis labels */}
                        <div className={cn("flex items-center justify-start py-1 pl-2 font-bold text-[11px] sm:text-xs rounded border-r border-slate-805 pr-1", volColor)}>
                          {volIcon}
                        </div>

                        {/* Interactive block slots */}
                        {(['Low', 'Medium', 'High'] as const).map(diff => {
                          const cellKeywords = getKeywordsForCell(vol, diff);
                          const count = cellKeywords.length;
                          const isSelected = activeCell.vol === vol && activeCell.diff === diff;
                          
                          // Select color intensity classes for the heatmap
                          let cellStyle = '';
                          if (vol === 'High' && diff === 'Low') {
                            cellStyle = 'bg-emerald-950/40 hover:bg-emerald-950/60 border-emerald-500/50 text-emerald-400 shadow-[inset_0_0_12px_rgba(16,185,129,0.15)]';
                          } else if (vol === 'High' && diff === 'Medium') {
                            cellStyle = 'bg-teal-950/30 hover:bg-teal-950/50 border-teal-600/40 text-teal-300';
                          } else if (vol === 'High' && diff === 'High') {
                            cellStyle = 'bg-amber-950/20 hover:bg-amber-950/40 border-amber-600/30 text-amber-300';
                          } else if (vol === 'Medium' && diff === 'Low') {
                            cellStyle = 'bg-emerald-950/25 hover:bg-emerald-950/40 border-emerald-600/30 text-emerald-300';
                          } else if (vol === 'Medium' && diff === 'Medium') {
                            cellStyle = 'bg-slate-800/40 hover:bg-slate-800/60 border-slate-700/50 text-slate-300';
                          } else if (vol === 'Medium' && diff === 'High') {
                            cellStyle = 'bg-rose-950/20 hover:bg-rose-950/35 border-rose-600/20 text-rose-300';
                          } else if (vol === 'Low' && diff === 'Low') {
                            cellStyle = 'bg-slate-800/20 hover:bg-slate-800/35 border-slate-700/20 text-slate-400';
                          } else if (vol === 'Low' && diff === 'Medium') {
                            cellStyle = 'bg-slate-900/50 hover:bg-slate-900/70 border-slate-800 text-slate-500';
                          } else {
                            cellStyle = 'bg-red-950/10 hover:bg-red-950/20 border-red-500/10 text-red-400';
                          }

                          return (
                            <button
                              key={diff}
                              type="button"
                              onClick={() => setActiveCell({ vol, diff })}
                              className={cn(
                                "flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer h-20 text-center font-semibold text-xs relative",
                                cellStyle,
                                isSelected ? "ring-2 ring-sky-400 border-sky-400 bg-opacity-80 scale-[1.03] z-10 shadow-lg shadow-sky-500/10" : "scale-100"
                              )}
                            >
                              <span className="text-lg font-bold">{count}</span>
                              <span className="text-[9px] opacity-80 mt-0.5">คีย์เวิร์ด</span>
                              {vol === 'High' && diff === 'Low' && count > 0 && (
                                <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Matrix selection detail panel - 2 columns on desktop */}
              <div className="lg:col-span-2 flex flex-col justify-between space-y-4">
                <div className="space-y-3 flex-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5 border-b border-slate-800 pb-2 font-mono">
                    <Compass className="w-4 h-4 text-sky-400" />
                    <span>รายละเอียดกลุ่ม {`[Volume: ${activeCell.vol} | KD: ${activeCell.diff}]`}</span>
                  </label>

                  {(() => {
                    const keywordsInCell = getKeywordsForCell(activeCell.vol, activeCell.diff);
                    
                    let cellTitle = "";
                    let cellDesc = "";
                    if (activeCell.vol === 'High' && activeCell.diff === 'Low') {
                      cellTitle = "🔥 Sweet Spot (SEO Gap)";
                      cellDesc = "กลุ่มคีย์เวิร์ดระดับทองคำ! มีปริมาณค้นหาสูงมาก ยอดเยี่ยมแก่การขุดดึงผู้ชม เพราะคู่แข่งระดับต่ำโตได้ทันที";
                    } else if (activeCell.vol === 'High' && activeCell.diff === 'Medium') {
                      cellTitle = "📈 โอกาสสำคัญทางการตลาด";
                      cellDesc = "คนเสิร์ชหนาแน่นระดังกลาง-สูง ความยากพอประมาณ สามารถแข่งขันได้หากมีสคริปต์สไตล์ NotebookLM ชั้นเลิศ";
                    } else if (activeCell.vol === 'Medium' && activeCell.diff === 'Low') {
                      cellTitle = "🌱 ตลาดเฉพาะกลุ่ม (Niche Low Hanging)";
                      cellDesc = "ความยากต่ำ สบายๆ เหมาะสำหรับดันช่องใหม่ๆ ติดอันดับหน้าแรกอย่างรวดเร็วโดยประหยัดงบตัดต่อ";
                    } else if (activeCell.vol === 'High' && activeCell.diff === 'High') {
                      cellTitle = "⚠️ สมรภูมิเดือด (Strong Competitors)";
                      cellDesc = "ปริมาณความต้องการสูงสุดๆ คนทำเพียบ ต้องเจาะลึกเฉพาะทาง เล่าเรื่องให้แตกต่างด้วย Value สูงเท่านั้นถึงจะเอาอยู่";
                    } else {
                      cellTitle = "⚙️ กลุ่มคีย์เวิร์ดเฉพาะทางย่อย";
                      cellDesc = "กลุ่มเป้าหมายขนาดเริ่มต้น เหมาะสำหรับการนำมาทำคลิปความรู้เฉพาะจุด (Long-tail) เสริมทัพ SEO หลัก";
                    }

                    return (
                      <div className="space-y-3">
                        <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/60">
                          <div className="text-xs font-bold text-slate-200">
                            {cellTitle}
                          </div>
                          <div className="text-[11px] text-slate-400 leading-normal mt-1">
                            {cellDesc}
                          </div>
                        </div>

                        <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                          {keywordsInCell.length > 0 ? (
                            keywordsInCell.map((kw, i) => (
                              <div key={i} className="flex items-center justify-between p-2 bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors">
                                <span className="text-xs font-semibold text-slate-200 truncate pr-2 max-w-[150px] sm:max-w-none">{kw.keyword}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                                    {kw.volumeStr}
                                  </span>
                                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold">
                                    Score: {kw.oppScore}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-6 text-slate-500 text-xs italic">
                              ไม่มีคีย์เวิร์ดตกในกลุ่มนี้ (ลองกดเลือกช่องอื่นๆ)
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Top Recommended SEO Gaps directly extracted */}
                {heatmapData && heatmapData.length > 0 && (
                  <div className="bg-gradient-to-r from-emerald-950/40 to-blue-950/25 border border-emerald-500/25 rounded-xl p-3">
                    <div className="text-xs font-bold text-emerald-400 flex items-center gap-1 mb-2">
                      <Sparkles className="w-3.5 h-3.5 animate-bounce" />
                      <span>🚀 ช่องว่างแนะนำสูงสุด (Top Dynamic SEO Gaps):</span>
                    </div>
                    <div className="space-y-1.5">
                      {heatmapData
                        .sort((a, b) => b.oppScore - a.oppScore)
                        .slice(0, 3)
                        .map((kw, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px] p-1.5 px-2.5 bg-emerald-950/30 rounded-lg border border-emerald-500/15">
                            <span className="font-semibold text-slate-200 truncate max-w-[160px]">{idx + 1}. {kw.keyword}</span>
                            <span className="text-[10px] font-bold text-emerald-400 font-mono">Score: {kw.oppScore}/100</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Thematic Clusters tab content */
            <div className="space-y-4">
              <div className="text-xs text-slate-400 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
                <span>อัลกอริทึมได้ทำการวิเคราะห์ความสัมพันธ์แบบอัจฉริยะ และจัดแบ่งคีย์เวิร์ดเป็น <strong>{clusters.length} ชุดซีรีส์พอดแคสต์หลัก</strong> เพื่อปั้นผู้ชมสะสมได้อย่างรวดเร็ว</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left Column: List of Clusters */}
                <div className="lg:col-span-2 space-y-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                  {clusters.map((cluster) => {
                    const isSelected = (selectedClusterId || clusters[0]?.id) === cluster.id;
                    return (
                      <button
                        key={cluster.id}
                        type="button"
                        onClick={() => setSelectedClusterId(cluster.id)}
                        className={cn(
                          "w-full text-left p-4 rounded-xl border transition-all relative flex flex-col gap-2 cursor-pointer outline-none focus:ring-1 focus:ring-violet-500/40",
                          isSelected
                            ? "bg-slate-800 border-violet-500/80 shadow-md shadow-violet-500/5 text-violet-300"
                            : "bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/30 text-slate-400"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={cn("text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full border border-slate-700", 
                            isSelected 
                              ? "bg-violet-500/15 border-violet-500/30 text-violet-400" 
                              : "bg-slate-800 border-slate-700 text-slate-350"
                          )}>
                            {cluster.keywords.length} ตอน (Episodes)
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/20 border border-emerald-500/15 px-2 py-0.5 rounded-full font-bold">
                            Avg Score: {cluster.avgScore}/100
                          </span>
                        </div>
                        <h5 className="font-bold text-sm text-slate-200 mt-1 line-clamp-1">{cluster.name}</h5>
                        <p className="text-[11px] text-slate-400 leading-normal line-clamp-2">{cluster.description}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Right Column: Outline details of Selected Cluster */}
                <div className="lg:col-span-3 bg-slate-950/40 p-5 border border-slate-800/80 rounded-xl flex flex-col justify-between min-h-[350px]">
                  {(() => {
                    const currentId = selectedClusterId || clusters[0]?.id;
                    const cluster = clusters.find(c => c.id === currentId) || clusters[0];
                    if (!cluster) return null;

                    return (
                      <div className="flex flex-col h-full justify-between gap-4">
                        <div className="space-y-3.5">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
                            <div>
                              <h5 className="text-sm font-bold text-violet-400 flex items-center gap-1.5 font-sans">
                                <Layers className="w-4 h-4 text-violet-400" />
                                {cluster.name}
                              </h5>
                              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{cluster.description}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleExportCluster(cluster)}
                              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-violet-900/30 hover:bg-violet-800/50 text-violet-300 hover:text-violet-200 rounded-lg text-xs font-semibold shrink-0 transition-all border border-violet-800/30 cursor-pointer shadow-sm shadow-black/20"
                            >
                              <Download className="w-3.5 h-3.5" />
                              ดาวน์โหลดบทสรุปซีรีส์
                            </button>
                          </div>

                          {/* Episode Timeline list */}
                          <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1 font-mono">แผนจัดระเบียบตอนวิดีโอ (Series Episode Plan)</div>
                            {cluster.keywords.map((kw, idx) => (
                              <div key={idx} className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-lg flex items-start gap-3 hover:border-slate-700/60 transition-colors">
                                <div className="w-5 h-5 bg-violet-500/10 text-violet-400 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-violet-500/25 font-mono">
                                  {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-slate-200 truncate">{kw.keyword}</span>
                                    <div className="flex items-center gap-1.5 shrink-0 font-mono">
                                      <span className="text-[9px] text-slate-400 bg-slate-800 px-1.5 rounded">
                                        Vol: {kw.volumeStr}
                                      </span>
                                      <span className="text-[9px] text-emerald-400 bg-emerald-950/20 border border-emerald-500/15 px-1.5 rounded font-bold">
                                        Score: {kw.oppScore}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                                    💡 จุดขายเฉพาะตอน: <span className="text-slate-300 font-medium">เจาะความถนัดเรื่อง {kw.keyword} ผ่านเรื่องย่อย และสรุปใจความสำคัญใน 3 บรรทัดแรก</span>
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2">
                          <ListChecks className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                          <span><strong>ข้อแนะนำการทำ SEO:</strong> ยอดผู้ชมแบบซีรีส์จะเติบโตได้สูงขึ้นอย่างมีนัยสำคัญ เมื่อตอนถัดไปเชื่อมโยงกับปัญหาก่อนหน้า เช่น การกระตุ้นให้ผู้ชมกดฟังสุนทรียะความรู้ต่อแบบ Playlists</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

{/* Structured Search input & default Table render */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap mb-2">
        <div className="flex items-center gap-4 flex-wrap w-full sm:w-auto">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg w-full max-w-sm">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาในตาราง..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-transparent border-none text-sm text-slate-200 focus:outline-none w-full placeholder:text-slate-500"
            />
          </div>
          
          <span className="text-xs text-slate-400 font-medium select-none">
            แสดง <b className="text-blue-400 font-mono">{sortedRows.length}</b> จากทั้งหมด <b className="text-slate-300 font-mono">{rows.length}</b> รายการ
          </span>
        </div>

        {isSeoTable && (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => setShowHighPotentialOnly(prev => !prev)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all border shadow-sm cursor-pointer select-none",
                showHighPotentialOnly 
                  ? "bg-emerald-950/45 text-emerald-300 border-emerald-500/40 hover:bg-emerald-950/60" 
                  : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-slate-200"
              )}
            >
              <span className={cn(
                "w-2 h-2 rounded-full",
                showHighPotentialOnly ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
              )}></span>
              ✨ กรองเฉพาะโอกาสสูง (High Potential Only)
            </button>
            <span className="text-[10px] text-slate-500 select-none text-right">
              * ซ่อนคีย์เวิร์ดกลุ่ม Difficulty High ที่มียอดค้นหา (Volume) ค่อนข้างต่ำ เพื่อให้วิเคราะห์โอกาสคีย์เวิร์ดที่ปั้นง่ายได้เร็วขึ้น
            </span>
          </div>
        )}
      </div>
      <div className="overflow-auto max-h-[400px] rounded-lg border border-slate-700 relative">
        <table className="w-full text-sm text-left m-0">
          <thead className="text-slate-300 sticky top-0 z-10 shadow-[0_1px_0_0_#334155]">
            <tr>
              {headers.map((header, idx) => (
                <th
                  key={idx}
                  onClick={() => requestSort(idx)}
                  className="p-3 cursor-pointer bg-slate-800 hover:bg-slate-700 transition-colors select-none group whitespace-nowrap border-none"
                >
                  <div className="flex items-center gap-1">
                    {header}
                    <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700 bg-slate-900/45">
            {sortedRows.map((row, rowIdx) => {
              const isHighVolume = (() => {
                if (volumeColIdx >= 0) {
                  const volText = getText(row[volumeColIdx]);
                  const volVal = parseVolume(volText);
                  return volVal >= 10000;
                }
                return false;
              })();

              const motionProps = isHighVolume ? {
                initial: { opacity: 0, x: -10, backgroundColor: "rgba(16, 185, 129, 0.3)" },
                animate: { opacity: 1, x: 0, backgroundColor: "rgba(16, 185, 129, 0)" },
                transition: { duration: 0.6, delay: Math.min(rowIdx * 0.1, 1) } // cap the delay
              } : {};

              return (
                <motion.tr 
                  key={rowIdx} 
                  {...motionProps}
                  className={cn(
                    "hover:bg-slate-800/50 transition-colors",
                    isHighVolume 
                      ? "bg-emerald-950/20 hover:bg-emerald-950/30" 
                      : ""
                  )}
                >
                  {row.map((cell, cellIdx) => {
                    const isVolCell = cellIdx === volumeColIdx;
                    return (
                      <td 
                        key={cellIdx} 
                        className={cn(
                          "p-3 text-slate-300 border-none transition-colors",
                          cellIdx === 0 && isHighVolume ? "border-l-4 border-l-emerald-500 pl-2" : "",
                          isVolCell && isHighVolume ? "font-bold text-emerald-400" : ""
                        )}
                      >
                        {cell}
                        {isVolCell && isHighVolume && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">
                            🔥 High Vol
                          </span>
                        )}
                      </td>
                    );
                  })}
                </motion.tr>
              );
            })}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="p-4 text-center text-slate-500 italic border-none">
                  ไม่พบข้อมูลที่ค้นหา
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

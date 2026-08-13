# ตำนานนักสู้ — คู่มือทำ Asset (ภาพ + เสียง)

เกมนี้ **เล่นได้เต็มรูปแบบตั้งแต่ตอนนี้โดยไม่ต้องมีไฟล์ภาพหรือเสียงเลย** —
ตัวละครทั้ง 15 ตัว ฉากทั้ง 10 ด่าน เอฟเฟกต์ และเสียงทั้งหมดถูก "วาด/สังเคราะห์ด้วยโค้ด"

เอกสารนี้คือวิธีเอาภาพที่เจนจาก ChatGPT และเพลงจาก Google Flow Music
มาแทนที่ของที่วาดด้วยโค้ด **ทีละชิ้นได้** ไม่ต้องทำครบทั้งชุดถึงจะใช้ได้

---

## 1. หลักการ: ใส่เท่าที่มี

ทุกอย่างอ่านจากไฟล์เดียว: `public/game/assets/manifest.json`

- ชิ้นไหน **มี** ใน manifest → เกมใช้ภาพ/เสียงจริง
- ชิ้นไหน **ไม่มี** → เกมใช้ของที่วาดด้วยโค้ดเหมือนเดิม
- ถ้าไม่มีไฟล์ `manifest.json` เลย → เกมทำงานปกติ 100%

เริ่มจาก `public/game/assets/manifest.example.json` — คัดลอกเป็น `manifest.json`
แล้วลบส่วนที่ยังไม่มีภาพออก

```bash
cp public/game/assets/manifest.example.json public/game/assets/manifest.json
```

> **แนะนำลำดับการทำ:** ภาพพอร์ตเทรต (ง่ายสุด เห็นผลเร็วสุด) → ฉากพื้นหลัง →
> เพลง → ตัวละครแบบ sprite sheet (ยากสุด ทำทีหลังได้)

---

## 2. ภาพพอร์ตเทรต (เริ่มที่นี่)

ใช้ในหน้าเลือกตัวละคร ไฟล์เดียวต่อหนึ่งตัวละคร ไม่ต้องมี sprite sheet

- ขนาด: **512 × 512 px**, PNG พื้นหลังโปร่งใส
- วาง: `public/game/assets/portraits/<id>.png`
- ใส่ใน manifest:

```json
"portraits": { "kraisorn": "portraits/kraisorn.png" }
```

### Prompt กลาง (ใส่ต่อท้ายทุกตัวเพื่อให้สไตล์ตรงกัน)

```
Style: stylised 2D game character art, semi-realistic Thai fantasy, bold clean
shapes, strong rim light, cinematic contrast, painterly but crisp edges,
transparent background, centred bust portrait, no text, no watermark,
no logo, square 1:1.
```

### Prompt ต่อตัวละคร

ต่อไปนี้คือ prompt สำหรับ ChatGPT (DALL·E / GPT Image) — วาง prompt ตัวละคร
แล้วต่อท้ายด้วย Prompt กลางข้างบน

| # | id | ชื่อ | Prompt |
|---|----|------|--------|
| 1 | `kraisorn` | ไกรสร | Thai lion-knight swordsman, crimson lacquered armour over dark brown leather, gold trim, topknot hair, crimson half-cape, straight single-edged sword wreathed in orange embers, proud and steady expression |
| 2 | `adisorn` | อดิศร | Young dual-blade duellist, azure blue tunic with white trim, short dark-blue hair, twin short swords crossed, wind-swept posture, confident half-smile, cyan speed glow |
| 3 | `nilrat` | นิลรัตน์ | Hooded shadow assassin, deep indigo and black wrapped cloth, violet glowing eyes, high ponytail, curved dagger, purple shadow wisps curling off the shoulders |
| 4 | `krutthep` | ครุฑเทพ | Garuda demigod warrior, red and gold feathered mantle, spiky crimson crest, bronze skin, taloned gauntlets, emerald wind currents around the arms, fierce eagle-like features |
| 5 | `ramasoon` | รามสูร | Giant green-skinned thunder ogre, huge shoulders, dark brown hide armour with gold studs, spiky black hair, enormous axe crackling with pale blue lightning, roaring |
| 6 | `mekhala` | เมขลา | Thai lightning goddess, flowing white hair, royal blue and gold celestial robes, holding a glowing crystal orb, arcs of pale blue lightning, serene divine expression |
| 7 | `himawan` | หิมวัน | Snow mage from a frozen peak, pale blue robes with white fur collar, long ice-blue hair, frost-crusted staff, snowflakes suspended in the air, calm and distant |
| 8 | `phailin` | ไพลิน | Gem-sorceress marksman, violet and magenta coat, purple ponytail, crystal-tipped staff aimed like a rifle, floating amethyst shards, sharp focused eyes |
| 9 | `suriya` | สุริยา | Shaven-headed sun monk, saffron and orange robes, gold sash, glowing golden mandala behind the head, open palm radiating warm light, peaceful |
| 10 | `sroithong` | สร้อยทอง | Royal Thai court dancer turned fighter, magenta and gold silk with a long braid, golden folding fan held like a blade, pink blossom petals swirling, elegant poised stance |
| 11 | `nakarin` | นาคินทร์ | Naga king warrior, teal-green scaled skin, dark jade hooded mantle, seven-headed serpent crest, water-blue spear, luminous green venom mist |
| 12 | `wayu` | วายุ | Storm lancer, indigo and silver plate over a violet cloak, short grey hair, long spear crackling with violet lightning, mid-lunge posture |
| 13 | `bunlue` | บุญเหลือ | Muay-boran stone wrestler, bare-chested tanned fighter, rope-bound fists and head band, ochre and brown wraps, cracked stone dust on the forearms, grounded heavy stance |
| 14 | `thoranee` | ธรณี | Earth guardian, olive-green armour with a huge round stone shield, long brown hair, moss and vine detailing, warm green earth aura, immovable stance |
| 15 | `ratree` | ราตรี | Night reaper, deep purple hooded cloak, pale skin, violet glowing sigils, long curved scythe trailing dark mist, unsettling calm |

---

## 3. ฉากพื้นหลัง (parallax layers)

หนึ่งด่านใช้ 3–4 ชั้น ยิ่ง `parallax` มากยิ่งเลื่อนเร็ว (ใกล้กล้อง)

- ขนาดที่แนะนำ: **1920 × 540 px** PNG (ชั้น sky ทึบได้, ชั้นอื่นต้องโปร่งใส)
- **ต้องต่อขอบซ้าย-ขวาได้** (seamless / tileable) เพราะเกมวนภาพซ้ำ
- วาง: `public/game/assets/stages/<stage>-<layer>.png`

```json
"stages": {
  "village": { "layers": [
    { "src": "stages/village-sky.png",  "parallax": 0.0,  "y": 0 },
    { "src": "stages/village-far.png",  "parallax": 0.18, "y": 120 },
    { "src": "stages/village-mid.png",  "parallax": 0.40, "y": 190 },
    { "src": "stages/village-near.png", "parallax": 0.70, "y": 260 }
  ]}
}
```

> `y` คือระยะจากขอบบนจอ (จอเกมสูง 540 หน่วย, พื้นสนามเริ่มที่ y = 306)
> ชั้น near ควรอยู่ต่ำกว่า 260 เพื่อไม่บังตัวละคร

### Prompt กลางสำหรับฉาก

```
Style: stylised 2D game background layer for a side-scrolling fighting game,
painterly silhouettes, strong atmospheric depth, cinematic lighting,
horizontally seamless tileable, transparent background except the sky layer,
no characters, no text, no watermark, wide 1920x540.
```

### Prompt ต่อด่าน

| # | id | ชื่อด่าน | Prompt |
|---|----|---------|--------|
| 1 | `village` | หมู่บ้านรุ่งอรุณ | Thai rural village at sunrise, steep tiered temple roofs, palm trees, rice paddies, warm orange and deep blue sky |
| 2 | `bamboo` | ป่าไผ่ยามวิกาล | Dense bamboo forest at night, teal moonlight through the stalks, fireflies, thin mist near the ground |
| 3 | `market` | ตลาดน้ำคลองใหญ่ | Thai floating market on a wide canal, long-tail boats, striped awnings, wooden shophouses, bright midday sky |
| 4 | `snowpeak` | ยอดเขาหิมพานต์ | Himalayan-style frozen peaks, snow-laden pines, pale blue twilight, drifting snow |
| 5 | `desert` | ซากเมืองทะเลทราย | Sun-bleached desert ruins, broken sandstone columns, dunes, hazy golden light, blowing sand |
| 6 | `lava` | ถ้ำลาวาใต้พิภพ | Underground volcanic cavern, cracked black rock glowing with molten seams, rising embers, deep red haze |
| 7 | `temple` | วัดร้างกลางสายฝน | Abandoned Thai temple in heavy rain, moss-covered prangs, broken naga balustrades, cold grey-blue storm light |
| 8 | `skycity` | นครลอยฟ้า | Floating sky city above the clouds, slender golden spires, stone bridges, bright cumulus, clear blue day |
| 9 | `fortress` | ป้อมปราการเงา | Dark obsidian fortress, violet witch-light in the windows, jagged spires, falling ash |
| 10 | `astral` | วิหารดวงดาว | Cosmic star sanctum, floating stone pillars in a nebula, deep indigo and violet, scattered starlight |

---

## 4. Sprite sheet ตัวละคร (ทำทีหลังได้)

ส่วนนี้ยากที่สุดเพราะต้องได้ **ตัวละครเดิม ท่าทางต่างกัน สัดส่วนเท่ากันทุกเฟรม**
ถ้ายังไม่พร้อม ข้ามไปก่อนได้ — ตัวที่วาดด้วยโค้ดขยับครบทุกท่าอยู่แล้ว

### รูปแบบไฟล์

- ตารางเฟรมขนาดเท่ากันทุกช่อง เช่น **256 × 256 px** เรียงซ้าย→ขวา บน→ล่าง
- ตัวละคร **หันขวา** เสมอ (เกมพลิกภาพเองเวลาหันซ้าย)
- เท้าอยู่ที่ประมาณ 95% ของความสูงเฟรม, ตัวอยู่กึ่งกลางแนวนอน
- พื้นหลังโปร่งใส

```json
"characters": {
  "kraisorn": {
    "src": "characters/kraisorn.png",
    "frameW": 256, "frameH": 256, "cols": 6,
    "anchorX": 0.5, "anchorY": 0.95,
    "ppu": 2.6,
    "poses": { "stand": [0, 1], "walk1": [2], "punch1": [8] }
  }
}
```

- `ppu` = พิกเซลต่อ 1 หน่วยโลก ตัวละครสูงประมาณ 74 หน่วย
  ถ้าตัวสูง ~192 px ในเฟรม 256 px → `ppu ≈ 2.6`
- `poses` แมป **ชื่อท่า → หมายเลขเฟรม** ท่าไหนไม่ใส่ เกมจะ fallback ไปที่ `stand`

### ชุดท่าขั้นต่ำที่คุ้มค่าที่สุด (8 ท่า)

`stand`, `walk1`, `walk3`, `jumpRise`, `jumpFall`, `punch2`, `guard`, `hurt1`

### ชุดเต็ม (ชื่อท่าทั้งหมดที่เกมใช้)

```
stand stand2 walk1 walk2 walk3 walk4 run1 run2 run3 crouch
jumpPrep jumpRise jumpApex jumpFall land dash airStall
punch1 punch2 punch3 hook uppercut kick kickHigh sweep spinKick
aerialKick stomp elbow headbutt
slashWind slash1 slash2 stab overhead guardSword
castWind castPush castUp castDown channel summon superCast
guard guardHit hurt1 hurt2 hurtUp tumble lying getup frozen
grab hold throwWind throwRelease held
taunt victory intro dead
```

---

## 5. เพลง (Google Flow Music)

- ไฟล์: MP3 หรือ OGG, **วนลูปได้เนียน** (loopable) ยาว 90–120 วินาที
- วาง: `public/game/assets/music/<stage>.mp3`

```json
"music": { "village": "music/village.mp3" }
```

Prompt ของแต่ละด่านถูกเก็บไว้ในโค้ดข้าง ๆ ด่านนั้นเลย (`game/src/data/stages.ts`
ฟิลด์ `musicPrompt`) เพื่อไม่ให้บรีฟเพลงหลุดจากอาร์ตไดเรกชันของด่าน
คัดลอกมาไว้ที่นี่เพื่อความสะดวก:

| ด่าน | Prompt |
|------|--------|
| 1 village | Warm sunrise adventure theme, Thai folk fusion — khim and ranat ek over soft taiko and acoustic bass, 96 BPM, hopeful and open, light strings pad, no vocals, loopable 90 seconds. |
| 2 bamboo | Nocturnal stealth theme — bamboo flute and pizzicato guzheng over a sparse hand-drum groove, 88 BPM, tense and airy, wide reverb, no vocals, loopable 90 seconds. |
| 3 market | Bright market bustle theme — plucked phin and marimba over a shuffling 6/8 groove, 112 BPM, playful and busy, hand percussion and finger cymbals, no vocals, loopable 90 seconds. |
| 4 snowpeak | Frozen summit theme — glassy bells and sustained strings over a slow half-time drum, 76 BPM, vast and cold, distant choir pad, no vocals, loopable 90 seconds. |
| 5 desert | Sunbaked ruins theme — oud and duduk over deep frame drums, 100 BPM, weary and grand, brass swells on the turnaround, no vocals, loopable 90 seconds. |
| 6 lava | Molten depths theme — distorted low brass and industrial taiko, 128 BPM, driving and dangerous, metallic percussion hits, no vocals, loopable 90 seconds. |
| 7 temple | Rain-soaked temple theme — solo erhu over muted piano and rolling toms, 84 BPM, melancholy turning resolute, temple bell accents, no vocals, loopable 90 seconds. |
| 8 skycity | Sky fortress theme — soaring synth strings and arpeggiated bells over a driving four-on-the-floor, 132 BPM, heroic and weightless, big cinematic snare, no vocals, loopable 90 seconds. |
| 9 fortress | Dark fortress theme — detuned choir and low brass over a relentless 3/4 ostinato, 92 BPM, oppressive and ceremonial, chain and anvil percussion, no vocals, loopable 90 seconds. |
| 10 astral | Final confrontation theme — full orchestra with wordless choir and taiko, 140 BPM, two-part structure: solemn 30-second intro then relentless main section, no vocals, loopable 120 seconds. |

---

## 6. เสียงเอฟเฟกต์ (ไม่จำเป็น)

เกมสังเคราะห์เสียงเองด้วย WebAudio อยู่แล้ว ถ้าอยากใช้ไฟล์จริงให้ใส่ทับเป็นราย id
ไฟล์สั้น ๆ WAV/OGG (< 1 วินาที ยกเว้น `super`, `beam`)

```json
"sfx": { "hit1": "sfx/hit1.wav" }
```

รายชื่อ id ทั้งหมด:

```
hit1 hit2 hit3 slash block break whoosh cast shot
thunder ice blizzard quake wave beam super
ko land landHard thud grab throw clash
spit drain heal buff root warp
pickupHeal pickupMana pickupWeapon
uiMove uiSelect uiBack
```

---

## 7. เช็กว่าใช้งานได้

```bash
npm run dev
# เปิด http://localhost:3000/game/
```

- ภาพไม่ขึ้น → เปิด DevTools → Network ดูว่า path 404 ไหม
  (path ใน manifest อ้างอิงจาก `/game/assets/`)
- ตัวละครลอย/จม → ปรับ `anchorY`
- ตัวใหญ่/เล็กเกิน → ปรับ `ppu`
- ฉากมีรอยต่อ → ภาพยัง tile ไม่เนียน ต้องแก้ที่ไฟล์ภาพ

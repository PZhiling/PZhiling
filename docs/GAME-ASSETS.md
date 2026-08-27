# ตำนานนักสู้ — ชุด Prompt สร้าง Asset ทั้งหมด

เกมนี้ **เล่นได้เต็มรูปแบบโดยไม่ต้องมีไฟล์ภาพหรือเสียงเลย** — ตัวละคร 15 ตัว
ฉาก 10 ด่าน เอฟเฟกต์ และเสียงทั้งหมดวาด/สังเคราะห์ด้วยโค้ด

เอกสารนี้คือชุด prompt สำหรับเจนภาพใน ChatGPT และเพลงใน Google Flow
พร้อมวิธีเอามาใส่เกม **ทีละชิ้นได้** ไม่ต้องทำครบทั้งชุดถึงจะใช้ได้

- [0. อ่านก่อนเริ่ม](#0-อ่านก่อนเริ่ม-ข้อจำกัดจริงของ-chatgpt)
- [1. Style Lock](#1-style-lock--ข้อความที่ต้องต่อท้ายทุก-prompt)
- [2. ตัวละคร](#2-ตัวละคร)
- [3. ฉาก](#3-ฉาก-parallax-4-เลเยอร์ต่อด่าน)
- [4. เอฟเฟกต์](#4-เอฟเฟกต์-sprite-sheet-animation)
- [5. ไอคอนสกิลและไอเทม](#5-ไอคอนสกิลและไอเทม)
- [6. โลโก้และ UI](#6-โลโก้และ-ui)
- [7. เพลงและเสียง](#7-เพลงและเสียง)
- [8. manifest.json](#8-manifestjson--ผูกทุกอย่างเข้าเกม)

---

## 0. อ่านก่อนเริ่ม: ข้อจำกัดจริงของ ChatGPT

ผมต้องบอกตรง ๆ ก่อน เพราะมันเปลี่ยนวิธีทำงานทั้งหมด:

**ChatGPT เจน sprite sheet ที่ตัวละครเหมือนกันทุกเฟรมไม่ได้** ถ้าสั่งว่า
"ทำ sprite sheet 12 ท่าของตัวละครนี้" จะได้ตารางที่หน้าตา สัดส่วน และสีเพี้ยน
ไปคนละทาง ใช้ในเกมไม่ได้ เพราะเวลาเล่นจะเห็นตัวละคร "สั่น" ทุกครั้งที่เปลี่ยนท่า

**วิธีที่ได้ผลจริง** คือทำทีละภาพแล้วล็อกด้วยภาพอ้างอิง:

```
ขั้น 1  เจน "Character Sheet" 1 ภาพต่อตัวละคร  ← ภาพอ้างอิงหลัก
ขั้น 2  เจน Portrait โดยแนบภาพขั้น 1 เป็น reference
ขั้น 3  เจนท่าทีละท่า โดยแนบภาพขั้น 1 ทุกครั้ง + prompt ท่านั้น
ขั้น 4  ตัดพื้นหลัง แล้วประกอบเป็นตารางเอง (Photopea / Figma / ImageMagick)
```

ในแชทเดียวกัน ให้พิมพ์ทุกครั้งว่า
`Same character as the reference image. Identical proportions, palette, hair
and costume. Only the pose changes.`

> **ทางลัดที่คุ้มที่สุด:** ทำแค่ **Portrait** (15 ภาพ) + **ฉาก** (10 ด่าน) +
> **เอฟเฟกต์** ก่อน เกมจะดูดีขึ้นทันทีโดยที่ตัวละครในสนามยังใช้ตัวที่วาดด้วยโค้ด
> ซึ่งขยับครบทุกท่าและไม่มีปัญหาความไม่สม่ำเสมอเลย
> ส่วน sprite ตัวละครเต็ม 22 ท่า × 15 ตัว = 330 ภาพ เก็บไว้ทำทีหลัง

**ก่อนเจน**: ตั้งค่าใน ChatGPT ให้ออกภาพ **สี่เหลี่ยมจัตุรัส** สำหรับตัวละคร/
ไอคอน/เอฟเฟกต์ และ **แนวนอนกว้าง (16:9 หรือกว้างกว่า)** สำหรับฉาก

---

## 1. Style Lock — ข้อความที่ต้องต่อท้ายทุก prompt

นี่คือสิ่งที่ทำให้ของทั้ง 300 ชิ้นดูเป็นเกมเดียวกัน **ต่อท้ายทุกครั้ง อย่าข้าม**

```
STYLE LOCK — stylised 2D game art, Thai fantasy, semi-realistic proportions,
bold readable silhouette, clean crisp edges (not sketchy, not blurry),
painterly cel shading with 3 tonal steps, strong rim light from behind,
saturated but not neon, deep contrast, subtle warm-cool colour split.
Rendered as flat 2D artwork viewed straight on — no perspective distortion,
no camera tilt, no ground shadow, no floor, no scenery.
Transparent background (PNG alpha). No text, no letters, no watermark,
no logo, no signature, no border, no frame, no UI, no colour swatches.
```

ถ้าภาพออกมามีพื้นหลังทึบ ให้พิมพ์ต่อว่า
`The background must be fully transparent, not white, not a colour.`

---

## 2. ตัวละคร

### 2.1 ขั้น 1 — Character Sheet (ภาพอ้างอิงหลัก)

ทำ **1 ภาพต่อตัวละคร** เก็บไว้ใช้อ้างอิงตลอด ไม่ได้เอาเข้าเกมโดยตรง

**Template** (แทน `{CHARACTER}` ด้วยบล็อกจากตาราง 2.4):

```
Full-body character reference sheet for a 2D fighting game.

{CHARACTER}

Layout: one single figure, standing in a neutral A-pose, facing three-quarter
to the RIGHT, full body from head to feet, weight even on both legs, arms
slightly away from the body so the costume silhouette is fully visible.
Head is 1/7 of total body height. Centred, full figure fits inside the frame
with a small margin.

STYLE LOCK — (วางบล็อกจากข้อ 1)
```

### 2.2 ขั้น 2 — Portrait (เริ่มที่นี่ ง่ายสุด คุ้มสุด)

ใช้ในหน้าเลือกตัวละครและแผง HUD ทำได้เลยโดยไม่ต้องมี sprite

- **512 × 512 px** PNG โปร่งใส
- วางที่ `public/game/assets/portraits/<id>.png`

```
Bust portrait (head, shoulders and upper chest) of this character for a
game character-select screen. Same character as the reference image —
identical face, hair, palette and costume.

{CHARACTER}

Framing: head fills the upper two thirds, shoulders squared to the viewer,
face turned slightly to the RIGHT, chin up, confident and intense.
Dramatic rim light from behind-right in the character's signature aura colour
{AURA}. Soft inner glow, deep shadow on the opposite side.
Square 1:1.

STYLE LOCK — (วางบล็อกจากข้อ 1)
```

### 2.3 ขั้น 3 — Sprite ท่าต่าง ๆ

**สเปกที่เกมต้องการ** (ผิดข้อไหนข้อหนึ่งแล้วตัวละครจะลอย จม หรือหันผิดทาง):

| ข้อกำหนด | ค่า |
|---|---|
| ขนาดเฟรม | 256 × 256 px (เท่ากันทุกเฟรม) |
| ทิศทาง | **หันขวาเสมอ** — เกมพลิกภาพเองตอนหันซ้าย |
| ตำแหน่งเท้า | อยู่ที่ ~95% ของความสูงเฟรม |
| ตำแหน่งตัว | กึ่งกลางแนวนอน |
| ความสูงตัว | ~190 px ในเฟรม 256 px (`ppu` ≈ 2.6) |
| พื้นหลัง | โปร่งใส ไม่มีเงาพื้น ไม่มีฉาก |
| การเรียง | ซ้าย→ขวา บน→ล่าง ในตารางเดียว |

**Template ต่อท่า** — แนบภาพ Character Sheet ทุกครั้ง:

```
Same character as the reference image. Identical proportions, palette, hair,
costume and weapon. Only the pose changes.

Pose: {POSE}

Full body, facing RIGHT (character's right side toward the viewer's right),
side-scrolling fighting game sprite. Feet near the bottom edge of the frame,
figure centred horizontally, small margin all round. Square 1:1.

STYLE LOCK — (วางบล็อกจากข้อ 1)
```

**ชุด 8 ท่าที่คุ้มที่สุด** — ทำแค่นี้ก่อนก็ใช้ได้แล้ว

| ชื่อท่าในเกม | `{POSE}` |
|---|---|
| `stand` | relaxed combat idle, weight on the back leg, guard low, chest open, chin level |
| `walk1` | mid-stride walking forward, right leg forward and planted, left arm swung forward |
| `walk3` | mid-stride walking forward, mirrored — left leg forward, right arm swung forward |
| `jumpRise` | rising through a jump, both arms swept back and down, knees tucked slightly, body stretched vertically |
| `jumpFall` | falling from a jump, arms forward for balance, trailing leg bent behind, body leaning forward |
| `punch2` | committed straight punch at full extension, lead fist thrust forward, shoulder rotated in, back leg driving |
| `guard` | defensive guard, crouched slightly, both forearms raised and crossed in front of the face and chest |
| `hurt1` | recoiling from a hit, head snapped back, torso arched backward, arms flung loose, off balance |

**ชุดเต็ม 22 ท่า** — เพิ่มอีก 14 ท่าจากข้างบน

| ชื่อท่าในเกม | `{POSE}` |
|---|---|
| `stand2` | same idle, one frame later — chest lifted on an inhale, shoulders a touch higher |
| `walk2` | passing position of a walk, both legs close together, body at its highest point |
| `walk4` | passing position of a walk, mirrored |
| `run1` | full sprint, deep forward lean, front knee driving high, opposite arm pumped forward |
| `run3` | full sprint, mirrored |
| `punch1` | quick jab, lead fist snapping out, body barely committed, back hand still guarding |
| `punch3` | finishing power blow, whole body rotated behind the strike, back foot pivoted, huge extension |
| `kick` | straight front kick at full extension, kicking leg horizontal, arms flared for balance |
| `slash1` | weapon swung downward through the diagonal, blade at the bottom of the arc, body rotated forward |
| `slash2` | weapon swung upward through the reverse diagonal, blade high, body counter-rotated |
| `castWind` | gathering power — both hands drawn back to the chest, elbows tucked, slight crouch, head lowered |
| `castPush` | releasing power — both palms thrust forward at full extension, body driving after them |
| `lying` | knocked flat on the back on the ground, limbs sprawled, seen from the side |
| `victory` | victory pose, one arm raised high, chin up, weight on the back leg, triumphant |

> ท่าที่ไม่ได้ทำ เกมจะ fallback ไปใช้ `stand` เอง ไม่พัง

### 2.4 บล็อก `{CHARACTER}` ของทั้ง 15 ตัว

สีทั้งหมดตรงกับที่เอนจิ้นใช้อยู่จริง (ดึงจาก `game/src/data/characters.ts`)

---

**1. ไกรสร `kraisorn`** — อัศวินสิงห์เพลิง · สายบาลานซ์

```
Kraisorn, a Thai lion-knight swordsman and disgraced royal guard.
Athletic warrior build, mid-twenties, tanned skin #e8b98c.
Dark brown hair #3a2418 pulled into a high samurai-style topknot.
Crimson lacquered plate armour #b8342c over dark brown leather #3a2a20,
gold filigree trim #f0c66a on the pauldrons and belt, crimson half-cape
#8f2620 hanging from the left shoulder.
Carries a straight single-edged longsword; the blade is wreathed in a thin
skin of orange flame and drifting embers #ff7a2e.
Expression: proud, steady, jaw set. Reads as the reliable hero of the roster.
```

**2. อดิศร `adisorn`** — ดาบคู่สายลม · สายบุกเร็ว

```
Adisorn, a young dual-blade duellist who believes speed beats strength.
Lean and wiry, early twenties, warm skin #e6b489.
Short windswept navy hair #2b4a7a.
Azure blue fitted tunic #2f8fd8 over dark navy underlayer #183a5e,
near-white trim #e8f4ff along the collar, cuffs and sash.
Twin short swords, one held forward in a reverse grip, one back.
Pale cyan speed streaks #5fd0ff trailing off the blades and heels.
Expression: cocky half-smile, eyes sharp and amused. Light on his feet.
```

**3. นิลรัตน์ `nilrat`** — เงามีดสั้น · สายลอบสังหาร

```
Nilrat, a faceless shadow assassin nobody has seen twice.
Slight and dangerous, wrapped rather than armoured, skin #d9a87f.
Near-black hair #1b1a24 in a high ponytail; lower face covered by a wrap.
Deep indigo layered cloth #241f38 over black underwrap #12101c,
violet glowing seams and buckles #8b5cf6.
A single curved dagger held in a reverse grip, close to the body.
Violet shadow wisps #a855f7 curling off the shoulders and trailing hem,
edges of the silhouette dissolving into smoke.
Expression: unreadable, only the eyes visible and glowing faintly violet.
```

**4. ครุฑเทพ `krutthep`** — พญาครุฑเวหา · สายบุกทางอากาศ

```
Krutthep, a Garuda demigod — a winged eagle-warrior of the sky.
Powerful V-taper build, bronze skin #e9c07a with fine feather detailing
on the forearms and calves.
Spiky crimson feather crest #c9302c instead of hair, sharp avian brow and
golden raptor eyes.
Vermilion red feathered mantle and chest guard #d4432f over dark oxblood
underlayer #7a2118, heavy gold ornament #ffd166 at the collar and belt,
orange-red feathered half-cape #e0673f.
Bronze taloned gauntlets, claws extended.
Emerald wind currents #57e6b0 spiralling around both arms, loose feathers
suspended mid-air around him.
Expression: fierce, predatory, chin lowered.
```

**5. รามสูร `ramasoon`** — ยักษ์ขว้างขวาน · สายถึก

```
Ramasoon, a giant thunder-ogre from Thai myth whose thrown axe makes thunder.
Enormous and heavy — 1.3x the width of a normal fighter, huge shoulders and
forearms, short thick neck. Olive-green skin #7fa86e, tusked lower jaw.
Wild black hair #241a12 in coarse spikes.
Dark brown hide armour #4a3a2a over near-black leather #2b2018, heavy antique
gold studs and arm bands #c9a227.
Wields a massive double-headed axe, far too big for a normal person, its edge
crackling with pale blue lightning #9fd8ff. Bronze knuckle gauntlets.
Expression: roaring, brows down, all aggression and no finesse.
```

**6. เมขลา `mekhala`** — เทพีล่อแก้ว · สายคุมระยะไกล

```
Mekhala, the Thai goddess of lightning who carries the celestial crystal orb.
Graceful divine figure, floating slightly, fair skin #f2d3ae.
Long flowing white-silver hair #f4f7ff lifted as if underwater.
Royal blue celestial robes #2f6bd8 with deep navy underlayer #12224a,
heavy gold ornament #ffe066 at the crown, collar and wrists,
a long blue mantle #3b7fe0 trailing behind.
Holds a glowing crystal orb in one open palm.
Arcs of pale blue lightning #7cc4ff crawling between her fingers and around
the orb; a faint halo of sparks around the whole figure.
Expression: serene, distant, utterly unbothered — divine calm.
```

**7. หิมวัน `himawan`** — นักเวทหิมะ · สายคุมระยะไกล

```
Himawan, a snow mage from a frozen peak nobody returns from.
Tall and still, pale skin #f0dcc4, frost forming on the eyelashes.
Long ice-blue hair #bfe6ff drifting slowly.
Deep blue mage robes #2b5f9e over dark navy #14304f, pale ice-white fur
collar and trim #d9f2ff, a long pale blue cloak #cfe8ff.
Carries a tall wooden staff crusted with jagged ice at the head.
Suspended snowflakes and drifting frost motes #79c9ff hanging motionless in
the air around him; a faint cold vapour off the shoulders.
Expression: calm, remote, faintly sad.
```

**8. ไพลิน `phailin`** — มือปืนแก้วมณี · สายคุมระยะไกล

```
Phailin, a gem-sorceress who shoots crystal shards with a rifleman's accuracy.
Poised and precise, warm skin #eec7a4.
Violet hair #7a3fa0 in a high, tight ponytail.
Violet-purple long coat #7b3fb0 over dark plum #331452, pale pink trim
#ffd9f2 on the lapels and cuffs, one gloved hand and one bare.
Holds a crystal-tipped staff braced across the body like a marksman's rifle.
Faceted amethyst shards #c33bd6 floating in a slow orbit around her,
each catching a hard specular highlight.
Expression: sharp, focused, one eye slightly narrowed as if sighting.
```

**9. สุริยา `suriya`** — พระอาทิตย์ทรงกลด · สายบาลานซ์

```
Suriya, a shaven-headed sun monk who turned light into a martial art.
Grounded and centred, medium build, weathered skin #e3b183, clean-shaven head.
Saffron-orange monk's robes #f2a33c over deeper burnt orange #c8642a,
cream-gold sash and trim #fff0c2 wrapped across one shoulder, chest bare
on the right side. Barefoot.
Carries a plain wooden staff, held loosely, not aggressively.
A golden mandala halo #ffd15c behind his head, warm light motes rising
around him, one open palm radiating soft light.
Expression: peaceful, eyes half closed, completely unhurried.
```

**10. สร้อยทอง `sroithong`** — นางรำพัดทอง · สายเทคนิค

```
Sroithong, a royal Thai court dancer who turned dance figures into kill moves.
Elegant, poised on the balls of the feet, fair skin #f0c9a0.
Very long black hair #241a20 in a single thick braid that trails behind her.
Magenta-pink Thai silk costume #d9407a over deep wine #6d1f3f, elaborate gold
Thai dance ornament #ffd76a — a pointed chada headdress, shoulder pieces and
long pointed golden fingernails. Pink silk sabai sash #f06a9a across the chest.
Holds a golden folding fan open, gripped like a blade.
Pink blossom petals #ff7fb0 swirling in a slow spiral around her.
Expression: composed, chin lifted, a dancer's controlled poise.
```

**11. นาคินทร์ `nakarin`** — พญานาคเจ็ดเศียร · สายเทคนิค

```
Nakarin, the Naga king of the underworld waters in humanoid warrior form.
Tall and serpentine, teal-green scaled skin #7fd4c0 with finer scales on the
neck, forearms and cheekbones. Slit pupils.
Dark jade hooded mantle #073b3a raised over the head; behind him a fanned
crest of seven small serpent heads.
Deep teal scaled armour #0e7a68, luminous mint-green trim #7ef0d0 tracing the
plate edges, dark green cloak #0b5f56.
Carries a long water-blue spear with a leaf-shaped head.
Luminous green venom mist #33e0b8 rolling off the spear tip and the shoulders.
Expression: cold, regal, contemptuous.
```

**12. วายุ `wayu`** — หอกอสนีบาต · สายเทคนิค

```
Wayu, a storm lancer who lost his horse but kept the spear.
Disciplined soldier's build, weathered skin #dfae82.
Short cropped grey hair #4a4a58, a scar across one brow.
Indigo-violet plate over mail #5b5fd6 with dark navy underlayer #26295e,
pale lavender-white trim #cfd4ff on the pauldrons and greaves,
a violet-blue cavalry cloak #4a4fbf pinned at one shoulder.
Holds a long cavalry spear angled across the body, ready to lunge.
Violet lightning #8f6bff crackling along the spear shaft and leaping to the
gauntlets.
Expression: level, professional, entirely unimpressed.
```

**13. บุญเหลือ `bunlue`** — ยอดมวยหินผา · สายจับทุ่ม

```
Bunlue, a muay boran stone-wrestler who trained by punching boulders.
Bare-chested, thick and heavy, 1.24x the width of a normal fighter, huge
shoulders and a low centre of gravity. Deep tanned skin #c98a52, old scars.
Short black hair #191410 under a traditional mongkhon head band.
Rope-bound fists in the kaad chuek style, ochre and brown wraps #8c5a2b over
dark brown shorts #4a2f18, cream-gold prajioud arm bands #e8d6a8.
No weapon — hands are the weapon.
Cracked stone dust and grit #e0b070 falling from the forearms and knuckles.
Expression: quiet, unbothered, absolutely immovable.
```

**14. ธรณี `thoranee`** — ผู้พิทักษ์ปฐพี · สายถึก

```
Thoranee, the earth-mother goddess of Thai myth in the form of a shield
guardian. Broad and rooted, 1.2x the width of a normal fighter, tanned skin
#c9955f. Very long dark brown hair #3c2a16 loose down the back, with a
single braid, moss and small leaves caught in it.
Olive-green armour #6b7f3a over dark forest green #3a4520, cream-gold stone
trim #d8c98a, moss-green cloak #5c6f30, vines growing along the plate seams.
Carries an enormous round stone shield covering most of her body, and
stone-plated gauntlets.
Warm green earth aura #a8d06a rising from the ground at her feet, drifting
leaves.
Expression: patient, maternal, immovable.
```

**15. ราตรี `ratree`** — เคียวรัตติกาล · สายลอบสังหาร

```
Ratree, a night reaper who only works after dark.
Tall and thin, unnaturally pale skin #cbb6c9, dark circles under the eyes.
Near-black violet hair #2a1030 under a deep hood.
Deep purple hooded cloak #3a1a4a over near-black robes #170820, glowing
violet sigils #b57bff burning along the hem, cuffs and hood edge,
darker violet inner cape #2a1038.
Carries a long curved scythe, the blade thin and wickedly hooked, trailing
dark violet mist.
Violet soul-wisps #b57bff drifting up from the ground around her, the lower
edge of the cloak dissolving into shadow.
Expression: unsettlingly calm, a faint knowing smile.
```

---

## 3. ฉาก (parallax 4 เลเยอร์ต่อด่าน)

หนึ่งด่านใช้ 4 ชั้น ยิ่ง `parallax` มากยิ่งเลื่อนเร็ว (= ใกล้กล้อง)

| เลเยอร์ | ขนาด | `parallax` | `y` | พื้นหลัง | เนื้อหา |
|---|---|---|---|---|---|
| `sky` | 1920 × 540 | 0.0 | 0 | **ทึบ** | ท้องฟ้า เมฆ ดวงอาทิตย์/ดวงจันทร์ |
| `far` | 1920 × 300 | 0.18 | 120 | โปร่งใส | เงาภูเขา/เส้นขอบฟ้าไกลสุด |
| `mid` | 1920 × 300 | 0.40 | 190 | โปร่งใส | อาคาร/ต้นไม้/เสาหลัก |
| `near` | 1920 × 260 | 0.70 | 260 | โปร่งใส | ของใกล้กล้อง เตี้ย ๆ ไม่บังตัวละคร |

**สำคัญที่สุด: ต้องต่อขอบซ้าย-ขวาได้เนียน (seamless)** เพราะเกมวนภาพซ้ำ
และ **เลเยอร์ `near` ห้ามสูงเกิน 260 px** ไม่งั้นจะบังตัวละคร

**Template**:

```
Horizontally seamless tileable background layer for a 2D side-scrolling
fighting game. This is the {LAYER_ROLE} layer.

Scene: {STAGE}

{LAYER_NOTE}

The left and right edges must match perfectly so the image can repeat
side by side with no visible seam. Flat 2D artwork, no perspective
distortion, no characters, no creatures, no text.
Aspect ratio {RATIO}, very wide panorama.

STYLE LOCK — (วางบล็อกจากข้อ 1)
```

`{LAYER_ROLE}` / `{LAYER_NOTE}` / `{RATIO}`:

| เลเยอร์ | `{LAYER_ROLE}` | `{LAYER_NOTE}` | `{RATIO}` |
|---|---|---|---|
| sky | far sky | Sky and clouds only, filling the whole frame. Opaque background — no transparency. Nothing below the horizon. | 16:5 |
| far | distant silhouette | Only the most distant landforms, rendered as flat low-contrast silhouettes fading into the atmosphere. Everything above the bottom edge; the bottom 20% empty and transparent. Strong aerial haze. | 32:5 |
| mid | midground | Midground structures and vegetation as clear silhouettes with a little interior detail. Fully transparent above and below the shapes. Moderate haze. | 32:5 |
| near | foreground | Low foreground elements no taller than the bottom third of the frame — nothing tall enough to block a fighter. Dark, high-contrast, almost fully unlit silhouettes. Fully transparent everywhere else. | 32:4 |

### `{STAGE}` ของทั้ง 10 ด่าน

| # | id | `{STAGE}` |
|---|----|-----------|
| 1 | `village` | A rural Thai village at sunrise. Steep tiered temple roofs with upturned gold finials, stilt houses, coconut palms, rice paddies. Deep blue upper sky #1b2a4a burning down into warm orange #f0a45c at the horizon, pale gold sun #ffd9a0. Warm hazy air, fireflies. |
| 2 | `bamboo` | A dense bamboo forest at night. Tall straight bamboo stalks in receding ranks, thin ground mist, teal moonlight cutting between the stalks. Near-black sky #08121e into deep teal #123a3a, pale mint moon #bfe8d0. Cold, still, tense. |
| 3 | `market` | A Thai floating market on a wide canal at midday. Long-tail boats piled with fruit, striped awnings, weathered wooden shophouses on stilts, hanging lanterns. Deep blue sky #2a4a7a into bright pale blue #8fc4e8, white sun. Bright, busy, cheerful. |
| 4 | `snowpeak` | A frozen Himalayan-style mountain range at twilight. Jagged snow-capped peaks in receding ranks, snow-laden pines, wind-blown drifts. Dark blue-violet sky #14213d into cold slate blue #6f9ecb, pale white sun #e8f4ff. Vast, silent, freezing. |
| 5 | `desert` | Sun-bleached desert ruins under a hard midday sun. Broken sandstone columns and collapsed archways half-swallowed by dunes, blowing sand. Steel blue sky #3d5a8a into hot gold #f2c46a at the horizon, white-hot sun #fff3c4. Dry, hazy, oppressive heat. |
| 6 | `lava` | An underground volcanic cavern. Cracked black basalt formations glowing with molten orange seams, lava pools, rising embers, dead petrified trees. Near-black red sky #180608 into deep ember red #7a1c0a, glowing orange light source #ff9a3c. Dangerous, hot, close. |
| 7 | `temple` | An abandoned Thai temple complex in heavy rain. Moss-covered prangs and crumbling stupas, broken naga staircase balustrades, standing water, sheets of rain. Cold dark blue-grey sky #141c2c into slate #3a4a63, diffuse pale light #c8d8ea. Melancholy, soaked, grey. |
| 8 | `skycity` | A floating city high above the clouds at midday. Slender golden spires and white stone towers on floating islands, arched stone bridges, banners. Rich blue sky #1e2f66 into pale sky blue #8fb8f0, brilliant white sun. Bright cumulus below. Airy, heroic, weightless. |
| 9 | `fortress` | A dark obsidian fortress at night. Jagged black spires and buttresses, violet witch-light burning in the arrow slits, iron chains, falling ash. Near-black sky #0d0716 into deep violet #3a1a52, sickly violet light #c88bff. Oppressive, ceremonial, wrong. |
| 10 | `astral` | A cosmic star sanctum floating in a nebula. Vast broken stone pillars and platforms suspended in space, scattered starlight, slow-drifting rubble. Near-black #05030f into deep indigo-violet #1a1246, pale gold light #ffe9a8. Silent, enormous, final. |

---

## 4. เอฟเฟกต์ (sprite sheet animation)

**อันนี้เจนใน ChatGPT ได้ผลดีกว่าตัวละครมาก** เพราะแต่ละเฟรมไม่ต้องเหมือนกัน
เป๊ะ ๆ — มันเปลี่ยนรูปอยู่แล้วโดยธรรมชาติ

- ตารางเฟรมเท่ากันทุกช่อง เช่น **4 คอลัมน์ × 2–3 แถว** ในไฟล์เดียว
- เฟรมละ **256 × 256 px** (ท่ากวาดยาว ๆ ใช้ 512 × 256)
- พื้นหลังโปร่งใส **ดำสนิทก็ได้** ถ้าตั้ง `"additive": true` (โหมดบวกแสงจะกลืนสีดำหายไปเอง) — ง่ายกว่าและได้ผลสวยกว่าสำหรับไฟ/แสง/ไฟฟ้า
- วางที่ `public/game/assets/effects/<id>.png`

**Template**:

```
A {COLS}x{ROWS} sprite sheet grid of an explosion effect animation for a
2D fighting game, {FRAMES} frames total, read left to right then top to
bottom. Each cell is exactly the same size and the effect is centred in
every cell.

Effect: {EFFECT}

Animation arc: frame 1 is a tiny bright core, the middle frames are the
full violent expansion, the last frames dissipate into thinning wisps and
sparks. The effect grows then fades — it must NOT be the same size in
every frame.

Pure black background. Bright saturated glowing energy, additive-friendly —
the light should read clearly against black. No characters, no ground,
no text, no frame borders, no grid lines, no numbers.
```

> เปลี่ยน `{COLS}x{ROWS}` เป็น `4x2` (8 เฟรม) หรือ `4x3` (12 เฟรม)
> ถ้า ChatGPT ใส่เส้นตารางมาด้วย ให้พิมพ์ย้ำว่า
> `No grid lines and no borders between cells — only the artwork.`

### `{EFFECT}` ของแต่ละ id

| id ในเกม | เกิดเมื่อ | `{EFFECT}` | `size` แนะนำ |
|---|---|---|---|
| `impact` | ต่อยโดนทุกครั้ง | A sharp white-hot impact flash — a compact starburst with 4 long spikes and a shockwave ring, cream-white core #ffe9c4 | 70 |
| `hitSpark` | โจมตีธรรมดาโดน | A tight burst of white-hot sparks flying outward, short trails, no smoke | 60 |
| `fireBurst` | ธาตุไฟโดน | A billowing fire explosion, orange-gold core #ffca6a into deep red #ff3a00, rising ember trails and black smoke curls at the end | 110 |
| `frostBurst` | ธาตุน้ำแข็งโดน | An ice shatter burst — pale cyan #dff6ff and deep blue #4aa8ff crystal shards flying outward with a frozen vapour puff | 100 |
| `shockBurst` | ธาตุไฟฟ้าโดน | An electric discharge burst, jagged white-blue lightning forks #eaf6ff radiating from a bright core, crackling arcs | 100 |
| `darkBurst` | ธาตุมืดโดน | A dark magic implosion-then-burst, violet #8b5cf6 energy with black smoke tendrils curling inward and outward | 100 |
| `poisonBurst` | ธาตุพิษโดน | A toxic gas burst, sickly green #8fdc5a bubbling cloud with dripping globules | 90 |
| `guardSpark` | กันโดน | A hard deflection spark — a curved pale blue shield-shaped flash #9fc8ff with sparks skidding off it | 60 |
| `guardbreak` | การ์ดแตก | A shattering golden barrier — an amber #ffd166 hexagonal shield breaking into glass shards | 90 |
| `slash` / `arc` | ฟันธรรมดา | A single curved slash arc, a crescent blade of white-hot light with a thin sharp leading edge and a soft fading tail | 90 |
| `crossSlash` | ท่าใหญ่ | Two enormous crossing slash arcs forming an X, brilliant white cores with coloured outer glow, motion blur streaks | 180 |
| `shockring` | ทุบพื้น/ท่าไม้ตาย | A ground shockwave — a flat expanding ring seen at a low angle, a dust rim kicking up along the leading edge | 200 |
| `charge` | เริ่มร่ายสกิล | Energy motes streaming INWARD to a central point, converging trails, a small bright core building up | 90 |
| `chargeBig` | เริ่มท่าไม้ตาย | A huge power-up aura — a vertical column of energy rising, converging motes, a rotating magic circle at the base, ground debris lifting | 200 |
| `koBurst` | ศัตรูตาย | A massive white flash-out — a blinding core, a wide shockwave ring, and long radiating light spikes | 220 |
| `muzzle` | ปล่อยกระสุน | A small directional muzzle flash pointing RIGHT, cone-shaped, bright core with short sparks | 50 |
| `clash` | กระสุนชนกัน | Two energies colliding — a compressed white core with sparks and shockwave rings thrown out sideways | 90 |
| `healRing` | ฟื้นเลือด | A gentle rising ring of green-gold light #6fe08a with soft motes floating upward, calm and clean | 90 |
| `dust` | ลงพื้น/วิ่ง | A small puff of tan dust #d8c9ac kicking up and dissipating — soft, opaque, NOT glowing (ตั้ง `"additive": false`) | 60 |
| `vanish` | วาร์ป | A teleport-out — the shape collapsing into a vertical violet #a855f7 streak, then a ring of smoke where it stood | 90 |
| `firePillar` | อัปเปอร์คัตไฟ | A tall vertical column of fire erupting upward, gold core into deep red, rising embers, narrow at the base | 160 |
| `frostRing` | ระเบิดน้ำแข็ง | An expanding ring of ice spikes growing outward along the ground, pale cyan crystal, frost vapour | 160 |
| `petalSwirl` | ท่านางรำ | A spiralling vortex of pink #ff7fb0 cherry blossom petals, soft and layered (ตั้ง `"additive": false`) | 130 |
| `featherBurst` | ท่าครุฑ | An explosion of white and gold feathers scattering outward, drifting and rotating (ตั้ง `"additive": false`) | 130 |

**ตัวที่คุ้มที่สุดถ้าจะทำแค่ไม่กี่อัน:** `impact`, `fireBurst`, `crossSlash`,
`shockring`, `koBurst` — ห้าอันนี้เห็นบ่อยที่สุดและเปลี่ยนหน้าตาเกมมากที่สุด

---

## 5. ไอคอนสกิลและไอเทม

ไอคอนขึ้นบนปุ่มสกิลกลม 4 ปุ่มด้านขวาของจอ แทนตัวหนังสือไทยที่ตอนนี้ถูกตัดสั้น

- **256 × 256 px** PNG โปร่งใส
- วางที่ `public/game/assets/icons/<action-id>.png`
- **id ต้องตรงกับชื่อ action** เช่น `flameSlash.png`

**Template**:

```
A single game skill icon, centred, filling most of the frame.

Icon: {ICON}

Style: bold flat-shaded fantasy game icon, thick clean silhouette that reads
clearly at 50 pixels, strong inner glow, no outer ring, no border, no frame,
no background plate. Viewed straight on.
Transparent background. Square 1:1. No text, no numbers, no watermark.
```

### `{ICON}` ของทั้ง 60 สกิล

**ไกรสร (kraisorn)** — `flameSlash` a crescent sword slash of orange fire ·
`risingLion` a roaring lion head made of flame rising upward ·
`emberDash` a forward-rushing arrow made of fire streaks ·
`solarCross` a burning cross-shaped slash inside a sun disc

**อดิศร (adisorn)** — `bladeRush` two crossed cyan swords with speed lines ·
`riseSlash` an upward cyan slash arc with a rising blade ·
`whirlBlade` a circular ring of spinning blades ·
`stormOfBlades` a storm of cyan swords converging to a point

**นิลรัตน์ (nilrat)** — `shadowStep` a violet footprint dissolving into smoke ·
`crossCut` two crossed daggers with violet trails ·
`shadowBolt` a violet arrow of dark energy with a skull-like core ·
`thousandCuts` a fan of many violet dagger slashes

**ครุฑเทพ (krutthep)** — `windBlade` two crescent green wind blades ·
`skyDive` a diving eagle silhouette with speed lines ·
`talonRush` three green claw slash marks ·
`garudaStorm` a garuda wing spread inside a green cyclone

**รามสูร (ramasoon)** — `axeThrow` a spinning double-headed axe with a lightning arc ·
`quake` a fist striking the ground with cracks spreading ·
`thunderGrip` a clenched gauntlet fist wrapped in blue lightning ·
`stormFury` a whirling axe inside a lightning storm

**เมขลา (mekhala)** — `boltOrb` a glowing crystal orb with lightning inside ·
`chainBolt` a forked blue lightning bolt splitting three ways ·
`staticField` a circular field of radiating electric arcs ·
`skyJudgement` a huge lightning bolt striking down from a cloud

**หิมวัน (himawan)** — `iceShard` three pale blue ice shards in a fan ·
`iceSpike` a jagged ice spike erupting from the ground ·
`frostNova` a snowflake bursting outward into a ring ·
`absoluteZero` a blizzard vortex around a frozen core

**ไพลิน (phailin)** — `crystalShot` a single magenta crystal bolt with a trail ·
`prismSpread` five magenta crystal shards in a fan ·
`crystalTrap` a magenta crystal mine on the ground with warning glow ·
`prismCannon` a wide magenta prism beam firing right

**สุริยา (suriya)** — `sunDisc` a spinning golden sun chakram ·
`palmStrike` an open golden palm with a light shockwave ·
`mantra` two hands pressed together in prayer with a golden halo ·
`radiance` a blinding golden beam from a mandala

**สร้อยทอง (sroithong)** — `petalStorm` pink petals spiralling upward ·
`fanSlash` a golden folding fan with a pink slash arc ·
`dancerSpin` a spiral of pink petals around a dancing silhouette ·
`blossomFinale` a golden fan inside a burst of pink blossoms

**นาคินทร์ (nakarin)** — `poisonSpit` three green venom globules in an arc ·
`waterLance` a blue water spear thrust forward ·
`coilStrike` a serpent coiled around and constricting ·
`tidalRage` a giant curling tidal wave

**วายุ (wayu)** — `spearBolt` a violet spear of lightning flying right ·
`lungeStab` a spear thrusting forward with a violet impact ·
`spearVault` a spear planted in the ground with a leaping arc over it ·
`thousandSpears` many violet spears converging to a point

**บุญเหลือ (bunlue)** — `stoneGrab` a rope-bound fist gripping and slamming ·
`boulderThrow` a heavy boulder held overhead ·
`ironBody` a torso silhouette turning to cracked stone ·
`mountainBreaker` a fist splitting a mountain in half

**ธรณี (thoranee)** — `stoneWall` a stone wall rising out of the ground ·
`shieldBash` a round stone shield driving forward with impact lines ·
`rootGrasp` gnarled roots erupting and grasping upward ·
`gaiaJudgement` the earth splitting open in a glowing green fissure

**ราตรี (ratree)** — `scytheWave` a violet crescent scythe wave ·
`soulDrain` a violet soul wisp being pulled into a hand ·
`voidMine` a black void sphere with a violet event horizon ·
`nightHarvest` a scythe sweeping through a ring of violet souls

### ไอคอนไอเทม (4 ชิ้น)

| id | `{ICON}` |
|---|---|
| `pickup-heal` | A glowing green healing orb with a soft cross of light inside |
| `pickup-mana` | A glowing blue mana orb with a spiral of energy inside |
| `pickup-knife` | A simple steel throwing knife, blade up |
| `pickup-stick` | A sturdy wooden fighting staff, angled |

---

## 6. โลโก้และ UI

โลโก้/ปุ่มยังไม่มีช่องใน manifest — ทำไว้เผื่อได้ แต่ตอนนี้ยังต้องเอาไปแก้ใน
`game/src/ui/screens.ts` เอง (ทักผมได้ถ้าอยากให้เพิ่มช่องใน manifest)

**โลโก้เกม**:

```
A game logo wordmark for a Thai fantasy fighting game.
The Thai text reads exactly: ตำนานนักสู้
Heavy angular display lettering with sharp cut edges, gold #ffb347 to deep
orange #e8722c vertical gradient, thick dark outline, subtle inner bevel,
a few sparks and ember flecks around it.
Below it, smaller, in clean Latin capitals: LEGEND FIGHTERS
Transparent background. No other text. Wide 16:5.
```

> ChatGPT มักสะกดภาษาไทยผิด **ตรวจตัวอักษรทุกตัวก่อนใช้** ถ้าผิดให้เจนโลโก้
> เป็นสัญลักษณ์เปล่า ๆ แล้วพิมพ์ตัวหนังสือทับเองด้วย Photopea/Figma

---

## 7. เพลงและเสียง

### เพลง (Google Flow Music)

- MP3 หรือ OGG **วนลูปได้เนียน** ยาว 90–120 วินาที
- วางที่ `public/game/assets/music/<stage>.mp3`

Prompt เก็บอยู่ในโค้ดข้างด่านนั้นเลย (`game/src/data/stages.ts` ฟิลด์
`musicPrompt`) เพื่อไม่ให้บรีฟเพลงหลุดจากอาร์ตไดเรกชัน คัดลอกมาไว้ที่นี่:

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

### เสียงเอฟเฟกต์ (ไม่จำเป็น)

เกมสังเคราะห์เสียงเองด้วย WebAudio อยู่แล้ว ถ้าอยากใช้ไฟล์จริงให้ใส่ทับเป็นราย id
ไฟล์สั้น WAV/OGG (< 1 วินาที ยกเว้น `super`, `beam`)

```
hit1 hit2 hit3 slash block break whoosh cast shot
thunder ice blizzard quake wave beam super
ko land landHard thud grab throw clash
spit drain heal buff root warp
pickupHeal pickupMana pickupWeapon
uiMove uiSelect uiBack
```

---

## 8. manifest.json — ผูกทุกอย่างเข้าเกม

ทุกอย่างอ่านจากไฟล์เดียว: `public/game/assets/manifest.json`

- ชิ้นไหน **มี** ใน manifest → เกมใช้ภาพ/เสียงจริง
- ชิ้นไหน **ไม่มี** → เกมใช้ของที่วาดด้วยโค้ดเหมือนเดิม
- ไม่มีไฟล์ manifest เลย → เกมทำงานปกติ 100%

```bash
cp public/game/assets/manifest.example.json public/game/assets/manifest.json
# แก้ไฟล์ ลบส่วนที่ยังไม่มีภาพออกให้หมด
```

โครงสร้างเต็มดูที่ [`manifest.example.json`](../public/game/assets/manifest.example.json)
สรุปช่องสำคัญ:

```jsonc
{
  "portraits": { "<charId>": "portraits/x.png" },

  "characters": {
    "<charId>": {
      "src": "characters/x.png",
      "frameW": 256, "frameH": 256, "cols": 6,
      "anchorX": 0.5,   // จุดกึ่งกลางตัวในแนวนอน (0–1)
      "anchorY": 0.95,  // ตำแหน่งเท้าในแนวตั้ง (0–1)
      "ppu": 2.6,       // พิกเซลต่อ 1 หน่วยโลก (ตัวสูง ~74 หน่วย)
      "poses": { "stand": [0, 1], "walk1": [2] }   // ชื่อท่า → เลขเฟรม
    }
  },

  "stages": {
    "<stageId>": { "layers": [
      { "src": "stages/x-sky.png", "parallax": 0.0, "y": 0 }
    ]}
  },

  "effects": {
    "<effectId>": {
      "src": "effects/x.png",
      "frameW": 256, "frameH": 256, "cols": 4,
      "frames": 8,       // จำนวนเฟรมที่เล่นจริง
      "hold": 2,         // กี่ tick ต่อเฟรม (2 = 30 fps)
      "size": 70,        // ขนาดในหน่วยโลก
      "additive": true,  // true = โหมดบวกแสง (พื้นหลังดำหายไปเอง)
      "flip": true       // พลิกตามทิศที่ตัวละครหัน
    }
  },

  "icons": { "<actionId>": "icons/x.png", "pickup-heal": "icons/heal.png" },
  "music": { "<stageId>": "music/x.mp3" },
  "sfx":   { "<sfxId>": "sfx/x.wav" }
}
```

### เช็กว่าใช้งานได้

```bash
npm run dev
# เปิด http://localhost:3000/game/
```

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| ภาพไม่ขึ้นเลย | เปิด DevTools → Network ดูว่า 404 ไหม (path อ้างอิงจาก `/game/assets/`) |
| JSON ผิด → ไม่มีอะไรเปลี่ยน | เกม fallback เงียบ ๆ เมื่อ manifest พัง ลองรัน `node -e "JSON.parse(require('fs').readFileSync('public/game/assets/manifest.json','utf8'))"` |
| ตัวละครลอย / จมพื้น | ปรับ `anchorY` |
| ตัวใหญ่หรือเล็กเกิน | ปรับ `ppu` |
| ตัวละครหันผิดทาง | ภาพต้องหันขวา เกมพลิกเอง |
| ฉากมีรอยต่อชัด | ภาพยัง tile ไม่เนียน ต้องแก้ที่ไฟล์ภาพ |
| เอฟเฟกต์มีขอบดำเป็นสี่เหลี่ยม | ตั้ง `"additive": true` หรือลบพื้นหลังออกให้โปร่งใส |
| เอฟเฟกต์เล่นเร็ว/ช้าไป | ปรับ `hold` (1 = 60 fps, 2 = 30 fps, 4 = 15 fps) |

# วิธีใช้งานบน Android Tablet (ไม่ต้องมีคอมพิวเตอร์)

แอปนี้ต้องมีเซิร์ฟเวอร์ Node.js รันอยู่ (เพื่อเก็บ API key ไว้ฝั่งเซิร์ฟเวอร์)
บน Tablet ทำได้ 2 ทาง — เลือกทางเดียวพอ

---

## ทาง A: เปิดผ่าน Google AI Studio (ง่ายสุด ไม่ต้องติดตั้งอะไร)

แอปนี้สร้างจาก AI Studio อยู่แล้ว เปิดใช้จากเบราว์เซอร์บน Tablet ได้เลย:

1. เปิด Chrome ไปที่ **https://aistudio.google.com/apps** แล้วล็อกอิน Google
2. เปิดแอปของคุณ (YT Faceless Podcast SEO Master) — รันได้ทันที
   โดย AI Studio ใส่ `GEMINI_API_KEY` ให้อัตโนมัติจากเมนู Secrets
3. ถ้าอยากได้ลิงก์ถาวร + ติดตั้งเป็นไอคอนแอป: กดปุ่ม **Deploy**
   (ขึ้น Cloud Run) แล้วเปิดลิงก์ https ที่ได้ → Chrome จะขึ้นปุ่ม
   **"ติดตั้งแอป" (Install app)** ให้เอง

> ⚠️ ข้อจำกัด: AI Studio ดึงโค้ดจาก GitHub กลับเข้าไปไม่ได้ (push ออกได้
> อย่างเดียว) — ทาง A จึง deploy โค้ด "เวอร์ชันเดิมใน AI Studio" ไม่ใช่
> เวอร์ชันปรับปรุงใน repo นี้ ถ้าต้องการเวอร์ชันปรับปรุง ใช้ **ทาง C**

## ทาง C: Deploy เวอร์ชันปรับปรุงขึ้น Cloud Run จาก GitHub (แนะนำ)

repo นี้มี `Dockerfile` พร้อม deploy แล้ว ทำจากเบราว์เซอร์บน Tablet ได้ทั้งหมด:

1. เปิด **https://console.cloud.google.com** → สร้างโปรเจกต์ใหม่
   (ต้องเปิด Billing — Cloud Run มี free tier รายเดือนค่อนข้างเยอะ
   แอปส่วนตัวแบบนี้ปกติอยู่ในโซนฟรี และ scale-to-zero ตอนไม่มีคนใช้)
2. เมนู ☰ → **Cloud Run** → **Create service** →
   เลือก **"Continuously deploy from a repository"** → **Set up with Cloud Build**
3. เชื่อมบัญชี GitHub → เลือก repo **`PZhiling/PZhiling`**
   → branch **`claude/file-reading-zip-creation-dmdarb`**
   → Build type: **Dockerfile** (ระบบเจอไฟล์ให้อัตโนมัติ)
4. ตั้งค่า service:
   - Region: **asia-southeast1 (Singapore)** — ใกล้ไทยสุด
   - Authentication: **Allow unauthenticated invocations** (ให้เปิดจากเบราว์เซอร์ได้)
5. หัวข้อ **Variables & Secrets** เพิ่ม environment variables:
   - `GEMINI_API_KEY` = คีย์จาก https://aistudio.google.com/apikey
   - `GOOGLE_TTS_API_KEY` = (ถ้าใช้ฟีเจอร์เสียง — ไม่ใส่ก็ได้)
6. กด **Create** → รอ build ~3-5 นาที → ได้ URL `https://…run.app`
7. เปิด URL บน Tablet → Chrome จะขึ้นปุ่ม **"ติดตั้งแอป"** (PWA เต็มรูปแบบ
   เพราะเป็น HTTPS) → ได้ไอคอนแอปบนหน้าจอเหมือนแอปจริง

หลังจากนี้ทุกครั้งที่โค้ดใน branch อัปเดต Cloud Build จะ build + deploy
ให้อัตโนมัติ ไม่ต้องทำอะไรเพิ่ม

> ทางเลือกไม่ใช้ Dockerfile: buildpacks ของ Google ก็รองรับ repo นี้แล้ว
> (มี script `gcp-build` ใน package.json) — แต่ Dockerfile จะเร็วและชัวร์กว่า

---

## ทาง B: รันในเครื่อง Tablet เลย ด้วย Termux (ออฟไลน์จากฝั่งเซิร์ฟเวอร์ 100%)

Termux คือแอป Terminal Linux บน Android — รัน Node.js ได้จริง

### 1. ติดตั้ง Termux

ดาวน์โหลดจาก **F-Droid** (แนะนำ — เวอร์ชันใน Play Store เก่ามาก):
https://f-droid.org/packages/com.termux/

### 2. ติดตั้ง Node.js และแตกไฟล์โปรเจกต์

วางไฟล์ zip โปรเจกต์นี้ไว้ในโฟลเดอร์ **Downloads** ของ Tablet ก่อน
แล้วเปิด Termux พิมพ์ทีละบรรทัด:

```bash
pkg update -y
pkg install -y nodejs-lts unzip
termux-setup-storage        # กดอนุญาตให้เข้าถึงไฟล์
cp ~/storage/downloads/ytfaceless-tablet-ready.zip ~
unzip ytfaceless-tablet-ready.zip -d seo-master
cd seo-master
```

### 3. ติดตั้งเฉพาะแพ็กเกจฝั่งเซิร์ฟเวอร์ (ตัว UI ถูก build มาให้แล้วใน `dist/`)

```bash
npm install --omit=dev
```

> ใช้เวลาสักพัก และ **ทุกแพ็กเกจเป็น JavaScript ล้วน** — ทดสอบแล้วว่า
> ไม่มี native binary ที่จะติดปัญหาบน Android

### 4. ใส่ Gemini API Key (ขอฟรีได้จาก https://aistudio.google.com/apikey)

```bash
echo 'GEMINI_API_KEY="วางคีย์ของคุณตรงนี้"' > .env.local
```

### 5. รันแอป

```bash
npm start
```

จะขึ้น `Server running on http://localhost:3000`
เปิด **Chrome บน Tablet เครื่องเดียวกัน** ไปที่:

**http://localhost:3000**

แล้วกดเมนู ⋮ → **เพิ่มลงในหน้าจอหลัก (Add to Home screen)**
จะได้ไอคอนแอปไว้เปิดใช้ครั้งต่อไป

### ครั้งต่อๆ ไป เปิดใช้แค่นี้

```bash
cd seo-master && npm start
```

(ต้องเปิด Termux ค้างไว้เบื้องหลังตอนใช้แอป)

### ปัญหาที่อาจเจอ

- **พอร์ต 3000 ถูกใช้แล้ว** → รันด้วยพอร์ตอื่น: `PORT=8080 npm start`
  แล้วเปิด http://localhost:8080
- **Android ฆ่าโปรเซส Termux เบื้องหลัง** → เข้า Settings ของ Android
  ปิด Battery optimization ให้แอป Termux
- **อยากอัปเดตโค้ดใหม่** → ลบโฟลเดอร์ `seo-master` แล้วแตก zip ใหม่
  (ไฟล์ `.env.local` ต้องสร้างใหม่ด้วย)

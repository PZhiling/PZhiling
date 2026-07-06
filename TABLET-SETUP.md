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

> โค้ดเวอร์ชันปรับปรุงนี้รองรับ Cloud Run แล้ว (อ่านพอร์ตจากตัวแปร `PORT`)

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

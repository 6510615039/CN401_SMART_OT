# SMART OT — คู่มือการติดตั้งระบบ
## สำหรับผู้ดูแลระบบ (IT Administrator)

---

## ความต้องการของระบบ (System Requirements)

| รายการ | เวอร์ชันขั้นต่ำ |
|--------|----------------|
| Python | 3.10 ขึ้นไป |
| Node.js | 18 ขึ้นไป |
| MySQL | 8.0 ขึ้นไป |
| เว็บเบราว์เซอร์ | Chrome / Firefox / Edge รุ่นล่าสุด |

---

## ขั้นตอนที่ 1 — เตรียมฐานข้อมูล MySQL

สร้างฐานข้อมูลและผู้ใช้งานสำหรับระบบด้วยคำสั่ง SQL ดังนี้

```sql
CREATE DATABASE smart_ot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'smart_ot_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON smart_ot.* TO 'smart_ot_user'@'localhost';
FLUSH PRIVILEGES;
```

---

## ขั้นตอนที่ 2 — ติดตั้งส่วนหลังบ้าน (Backend)

**2.1 เข้าไปในโฟลเดอร์ Backend**
```bash
cd smart_ot_backend
```

**2.2 ติดตั้ง Python packages**
```bash
pip install -r requirements.txt
```

**2.3 สร้างไฟล์ `.env`** โดยคัดลอกจากไฟล์ตัวอย่าง แล้วแก้ไขค่าให้ตรงกับเซิร์ฟเวอร์จริง
```bash
cp .env.example .env
```

เนื้อหาในไฟล์ `.env` ที่ต้องกรอก:
```
TU_API_KEY=your_tu_api_key_here
TU_API_URL=https://restapi.tu.ac.th

DB_ENGINE=mysql
DB_NAME=smart_ot
DB_USER=smart_ot_user
DB_PASSWORD=your_password
DB_HOST=127.0.0.1
DB_PORT=3306
```

> **หมายเหตุ:** TU_API_KEY ขอได้จากสำนักงานสารสนเทศ มหาวิทยาลัยธรรมศาสตร์

**2.4 สร้างตารางฐานข้อมูล**
```bash
python manage.py migrate
```

**2.5 สร้างข้อมูลเริ่มต้นของระบบ** (การตั้งค่าระบบและข้อมูลพื้นฐาน)
```bash
python manage.py seed_data
```

**2.6 รวบรวมไฟล์ Static**
```bash
python manage.py collectstatic --noinput
```

**2.7 รัน Backend Server**
```bash
python manage.py runserver 0.0.0.0:8000
```

---

## ขั้นตอนที่ 3 — ติดตั้งส่วนหน้าบ้าน (Frontend)

**3.1 เข้าไปในโฟลเดอร์ root ของโปรเจกต์**
```bash
cd ..
```

**3.2 ติดตั้ง Node.js packages**
```bash
npm install
```

**3.3 สร้าง Production Build**
```bash
npm run build
```

ไฟล์ที่สร้างขึ้นจะอยู่ในโฟลเดอร์ `dist/` พร้อมสำหรับนำไปวางบน Web Server (เช่น Nginx)

**3.4 รันในโหมดพัฒนา (Development)**
```bash
npm run dev
```
ระบบจะพร้อมใช้งานที่ `http://localhost:5173`

---

## ขั้นตอนที่ 4 — ตั้งค่าหลังการติดตั้ง

หลังจากเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบแล้ว ให้ดำเนินการดังนี้

1. ไปที่ **การตั้งค่าระบบ** → กรอก TU AD API Key
2. ไปที่ **จัดการวันหยุด** → นำเข้าปฏิทินวันหยุดนักขัตฤกษ์ประจำปี
3. ไปที่ **จัดการบุคลากร** → สร้างบัญชีผู้ใช้งานและกำหนดบทบาทให้บุคลากรแต่ละคน
4. ไปที่ **นำเข้าข้อมูล** → นำเข้าบันทึกเวลาการปฏิบัติงานจากไฟล์ Excel

---

## โครงสร้างโปรเจกต์

```
smart_ot_backend/
├── manage.py
├── requirements.txt
├── .env.example
├── smart_ot/           ← Django project config
│   ├── settings.py
│   └── urls.py
└── api/                ← App หลัก
    ├── models.py       ← Database models
    ├── serializers.py  ← API serializers
    ├── views.py        ← API views
    ├── urls.py         ← URL routing
    └── management/commands/
        └── seed_data.py
```

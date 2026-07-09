# SMART OT — ระบบจัดการค่าตอบแทนการทำงานล่วงเวลา
### สำนักงานทะเบียนนักศึกษา มหาวิทยาลัยธรรมศาสตร์

---

## Tech Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| Backend | Django 4.2 + Django REST Framework + Django Channels |
| Database | MySQL 8.0 |
| Authentication | JWT (djangorestframework-simplejwt) + TU AD API |
| Real-time | WebSocket (Django Channels) |

---

## โครงสร้างโปรเจกต์

```
CN1401_SMART_OT/
├── smart_ot_backend/     # Django Backend
│   ├── api/              # App หลัก (models, views, serializers)
│   ├── smart_ot/         # Settings และ URL config
│   └── .env              # Environment variables (ไม่อยู่ใน git)
├── src/                  # React Frontend
│   └── app/
│       └── components/   # Components แยกตามบทบาท
├── index.html
├── vite.config.ts
└── package.json
```

---

## การติดตั้งสำหรับ Production (Server สำนักงาน)

### ความต้องการของระบบ
- Python 3.11+
- Node.js 18+
- MySQL 8.0+

---

### 1. Clone โปรเจกต์

```bash
git clone <repository-url>
cd CN1401_SMART_OT
```

---

### 2. ตั้งค่าฐานข้อมูล

สร้าง database ใน MySQL:

```sql
CREATE DATABASE smart_ot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

นำเข้าโครงสร้างตาราง:

```bash
mysql -u root -p smart_ot < smart_ot_schema.sql
```

---

### 3. ตั้งค่า Backend

```bash
cd smart_ot_backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/macOS

pip install -r requirements.txt
```

สร้างไฟล์ `.env` จาก template:

```bash
copy .env.example .env      # Windows
# cp .env.example .env      # Linux/macOS
```

แก้ไขค่าใน `.env` ให้ตรงกับ server:

```env
TU_API_KEY=<รับจากทีมพัฒนา>
TU_API_URL=https://restapi.tu.ac.th

DB_ENGINE=mysql
DB_NAME=smart_ot
DB_USER=<mysql username>
DB_PASSWORD=<mysql password>
DB_HOST=127.0.0.1
DB_PORT=3306
```

รัน migration และสร้าง Admin user:

```bash
python manage.py migrate
python manage.py createsuperuser
```

---

### 4. ตั้งค่า Frontend

```bash
cd ..         # กลับไปที่ root ของโปรเจกต์
npm install
npm run build
```

ไฟล์ที่ build จะอยู่ในโฟลเดอร์ `dist/` ให้นำไปให้ Web Server เสิร์ฟ (เช่น Nginx)

---

### 5. รัน Backend Server

```bash
cd smart_ot_backend
python manage.py runserver 0.0.0.0:8000
```

---

## บทบาทผู้ใช้งาน (User Roles)

| บทบาท | คำอธิบาย |
|---|---|
| Staff | บุคลากรผู้ยื่นคำร้อง OT |
| Department Head | หัวหน้างานผู้อนุมัติคำร้อง |
| Department Representative | ตัวแทนฝ่ายรวบรวมและส่งออกเอกสาร |
| Checker | ผู้ตรวจสอบเอกสารส่วนกลาง |
| Executive | ผู้บริหารดูภาพรวมสถิติ |
| Admin | ผู้ดูแลระบบและจัดการข้อมูล |

---

## ไฟล์ที่ต้องเตรียมส่ง IT

| ไฟล์ | รายละเอียด |
|---|---|
| `smart_ot_schema.sql` | โครงสร้าง database ทั้งหมด |
| `.env.example` | Template การตั้งค่า environment |
| Source code (git) | โค้ดทั้งหมดของระบบ |

---

## ติดต่อทีมพัฒนา

- นางสาวศรุตา มีงาม
- นายขวัญ ดาวเรือง

คณะวิศวกรรมศาสตร์ สาขาวิชาวิศวกรรมคอมพิวเตอร์
มหาวิทยาลัยธรรมศาสตร์ ปีการศึกษา 2567

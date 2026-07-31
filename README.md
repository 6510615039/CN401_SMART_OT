# SMART OT

### ระบบคำนวณและตรวจสอบค่าตอบแทนการปฏิบัติงานนอกเวลาราชการ
#### สำนักงานทะเบียนนักศึกษา มหาวิทยาลัยธรรมศาสตร์

> โครงงานวิศวกรรมคอมพิวเตอร์ (CN401/CN402) · คณะวิศวกรรมศาสตร์ มหาวิทยาลัยธรรมศาสตร์ · ปีการศึกษา 2568  
> ศรุตา มีงาม · ขวัญ ดาวเรือง · อาจารย์ที่ปรึกษา: อ.วชิรา พรหมสาขา ณ สกลนคร

---

## ภาพรวมของระบบ

สำนักงานทะเบียนนักศึกษา มธ. มีบุคลากรปฏิบัติงานนอกเวลาราชการเป็นประจำ แต่กระบวนการเดิมพึ่งพา Microsoft Excel และเอกสารกระดาษ ทำให้เกิดความล่าช้า ข้อผิดพลาดในการคำนวณ และตรวจสอบย้อนหลังได้ยาก

**SMART OT** แก้ปัญหาด้วยการดิจิทัลไลซ์กระบวนการทั้งหมดตั้งแต่ต้นจนจบ ตั้งแต่ขั้นตอนการยื่นคำร้องของพนักงาน ไปจนถึงการอนุมัติตามลำดับชั้น และการออกเอกสารเบิกจ่าย พร้อมแจ้งเตือนแบบ Real-time ทุกขั้นตอน

---

## Tech Stack

| ส่วน | เทคโนโลยี | รายละเอียด |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite | Single Page Application |
| | Tailwind CSS + shadcn/ui | UI Components |
| | SheetJS (xlsx) | Export Excel จาก Client-side |
| **Backend** | Django 4.2 + Django REST Framework | REST API + Business Logic |
| | Django Channels + Daphne | WebSocket Server (ASGI) |
| **Database** | MySQL 8.0 | Production |
| | SQLite | Development (default) |
| **Authentication** | JWT (djangorestframework-simplejwt) | Access Token 8h / Refresh 7d |
| | TU Active Directory API | ยืนยันตัวตนผ่านระบบ มธ. |
| **Real-time** | WebSocket (Django Channels) | การแจ้งเตือนทันที |
| **Deployment** | Railway (ทดสอบ) | ส่งมอบจริงบน Server สำนักงาน |

---

## สถาปัตยกรรมระบบ (Architecture)

```
┌─────────────────────────────────────────────────────────┐
│                     Web Browser                         │
│         React SPA (TypeScript + Vite)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  REST API    │  │  WebSocket   │  │  SheetJS     │  │
│  │  (HTTP/S)    │  │  (WS/WSS)    │  │  Excel Export│  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘  │
└─────────┼─────────────────┼───────────────────────────── ┘
          │                 │
┌─────────▼─────────────────▼───────────────────────────── ┐
│               Django Backend (ASGI / Daphne)              │
│  ┌─────────────────────┐   ┌───────────────────────────┐  │
│  │  Django REST        │   │  Django Channels          │  │
│  │  Framework          │   │  (WebSocket Consumer)     │  │
│  │  - Authentication   │   │  - Notification push      │  │
│  │  - Business Logic   │   │  - InMemoryChannelLayer   │  │
│  │  - OT Calculation   │   └───────────────────────────┘  │
│  │  - Permission check │                                   │
│  └──────────┬──────────┘                                   │
│             │                                               │
│  ┌──────────▼──────────┐   ┌───────────────────────────┐  │
│  │  MySQL / SQLite     │   │  TU AD API (External)     │  │
│  │  Database           │   │  restapi.tu.ac.th         │  │
│  └─────────────────────┘   └───────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### 3-Layer Architecture

| Layer | เทคโนโลยี | หน้าที่ |
|---|---|---|
| **Presentation** | React + TypeScript | UI, State Management, Client-side Excel Export |
| **Application** | Django REST Framework | Business Logic, OT Calculation, Auth, Permission |
| **Data** | MySQL 8.0 | จัดเก็บ Users, OT Requests, Timelog, Audit Log |

---

## กระบวนการทำงาน (Business Workflow)

กระบวนการเบิกจ่าย OT มี **5 ขั้นตอน** เรียงตามลำดับ:

```
[Staff]          ยื่นคำร้อง OT
                      │
                      ▼
[Dept Head]      อนุมัติ / ตีกลับ (head_approved / head_rejected)
                      │
                      ▼
[Dept Rep]       รวบรวมคำร้องทั้งแผนก → ส่งต่อ Checker (rep_forwarded)
                 พร้อม Export Excel รายงาน
                      │
                      ▼
[Checker]        ตรวจสอบเอกสาร → อนุมัติ / ตีกลับ (checker_approved / checker_rejected)
                 + ตรวจสอบงบประมาณ OT รายแผนก
                      │
                      ▼
[Executive]      ดูภาพรวม KPI และสถิติค่าใช้จ่ายทุกแผนก
```

**สถานะคำร้อง (OT Request Status):**

| สถานะ | ความหมาย |
|---|---|
| `pending` | รอหัวหน้าอนุมัติ |
| `head_approved` | หัวหน้าอนุมัติแล้ว รอตัวแทนรวบรวม |
| `head_rejected` | หัวหน้าตีกลับ (Staff แก้ไขและยื่นใหม่ได้) |
| `rep_forwarded` | ตัวแทนส่งต่อ Checker แล้ว |
| `checker_approved` | Checker อนุมัติแล้ว (สิ้นสุดกระบวนการ) |
| `checker_rejected` | Checker ตีกลับ (ย้อนไปแก้ไขใหม่) |

**การคำนวณค่าตอบแทน OT:**

| ประเภทวัน | อัตรา | เพดาน |
|---|---|---|
| วันธรรมดา | ตามระเบียบราชการ | ตามงบประมาณรายแผนก |
| วันหยุด | ตามระเบียบราชการ | ตามงบประมาณรายแผนก |

Checker สามารถกำหนดวงเงินงบประมาณ OT รายแผนกรายเดือน ระบบจะตรวจสอบอัตโนมัติเมื่ออนุมัติ

---

## บทบาทผู้ใช้งาน (User Roles)

ผู้ใช้งานหนึ่งรายสามารถมีได้หลายบทบาทพร้อมกัน (เช่น เป็นทั้ง Staff และ Dept Head)

| บทบาท | สิทธิ์หลัก |
|---|---|
| **Staff** | ยื่นคำร้อง OT, ติดตามสถานะคำร้อง |
| **Department Head** | อนุมัติ/ตีกลับคำร้องในแผนก, แจ้งไม่มี OT ประจำเดือน |
| **Department Representative** | รวบรวมคำร้อง, ส่งต่อ Checker, Export Excel |
| **Checker** | ตรวจสอบเอกสาร, อนุมัติ/ตีกลับรายแผนก, กำหนดงบประมาณ OT |
| **Executive** | ดู Dashboard KPI สถิติค่าใช้จ่ายทุกแผนก (Read-only) |
| **Admin** | จัดการ Users/แผนก, นำเข้า Timelog และรายชื่อพนักงาน, ตั้งค่าระบบ |

---

## โครงสร้างโปรเจกต์ (Code Structure)

```
CN1401_SMART_OT/
│
├── smart_ot_backend/               # Django Backend
│   ├── api/                        # Django App หลัก
│   │   ├── models.py               # Data models ทั้งหมด
│   │   ├── views.py                # API endpoints (business logic)
│   │   ├── serializers.py          # DRF Serializers (JSON ↔ Model)
│   │   ├── consumers.py            # WebSocket Consumer (แจ้งเตือน Real-time)
│   │   ├── urls.py                 # URL routing ของ API
│   │   ├── permissions.py          # Custom permission classes
│   │   ├── admin.py                # Django Admin panel config
│   │   └── management/commands/    # Custom management commands
│   │       ├── test_email.py       # ทดสอบส่งอีเมล
│   │       └── seed_holidays.py    # นำเข้าวันหยุดนักขัตฤกษ์
│   │
│   ├── smart_ot/                   # Django Project config
│   │   ├── settings.py             # Settings (DB, JWT, CORS, Email, Channels)
│   │   ├── urls.py                 # Root URL config
│   │   ├── asgi.py                 # ASGI config (รองรับ WebSocket)
│   │   └── wsgi.py                 # WSGI config (fallback)
│   │
│   ├── .env.example                # Template ตั้งค่า environment
│   ├── requirements.txt            # Python dependencies
│   └── manage.py
│
├── src/                            # React Frontend
│   └── app/
│       ├── App.tsx                 # Root component (routing, auth state)
│       ├── api.ts                  # Axios instance + API calls ทั้งหมด
│       ├── types.ts                # TypeScript types/interfaces
│       ├── context/                # React Context (auth, websocket)
│       └── components/
│           ├── roles/              # UI แยกตามบทบาท
│           │   ├── staff.tsx       # หน้า Staff
│           │   ├── depthead.tsx    # หน้า Department Head
│           │   ├── deptrep.tsx     # หน้า Department Representative
│           │   ├── checker.tsx     # หน้า Checker
│           │   ├── executive.tsx   # หน้า Executive
│           │   └── admin.tsx       # หน้า Admin
│           └── shared/             # Shared components
│               ├── Navbar.tsx      # Navigation bar + bell notification
│               ├── KpiCard.tsx     # Card แสดงสถิติ
│               └── NotificationBell.tsx
│
├── public/
│   └── manuals/                    # PDF คู่มือการใช้งานแยกตามบทบาท
│       ├── manual-staff.pdf
│       ├── manual-admin.pdf
│       ├── manual-depthead.pdf
│       ├── manual-deptrep.pdf
│       ├── manual-checker.pdf
│       └── manual-executive.pdf
│
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Data Models

```
User ──────────────────── OTRequest
 │  (many-to-many roles)   │  status: pending → head_approved
 │                          │          → rep_forwarded
 │                          │          → checker_approved
 │                          │
 ├── Department             ├── Timelog (บันทึกเวลาเข้า-ออก)
 │    └── OTBudget          │    (Admin import จาก Excel)
 │        (งบ OT/เดือน)    │
 │                          └── AuditLog (ประวัติการเปลี่ยนสถานะ)
 ├── Notification
 │    (แจ้งเตือน Real-time)
 │
 ├── Holiday (วันหยุดนักขัตฤกษ์)
 ├── OTDeadline (กำหนดส่งคำร้องรายเดือน)
 └── ImportHistory (ประวัติการ Import)
```

---

## API Endpoints

Base URL: `/api/`

### Authentication
| Method | Endpoint | คำอธิบาย |
|---|---|---|
| POST | `auth/login/` | Login ผ่าน TU AD API, คืน JWT |
| POST | `auth/refresh/` | Refresh Access Token |
| GET | `auth/me/` | ข้อมูล User ที่ Login อยู่ |
| POST | `auth/logout/` | Logout (Blacklist token) |

### OT Requests
| Method | Endpoint | คำอธิบาย |
|---|---|---|
| GET/POST | `ot-requests/` | รายการคำร้อง / ยื่นคำร้องใหม่ |
| GET/PATCH | `ot-requests/{id}/` | ดู / แก้ไขคำร้อง |
| POST | `ot-requests/bulk-head-approve/` | Dept Head อนุมัติหลายคำร้องพร้อมกัน |
| POST | `ot-requests/bulk-head-reject/` | Dept Head ตีกลับหลายคำร้อง |
| POST | `ot-requests/bulk-forward/` | Dept Rep ส่งต่อ Checker |
| POST | `ot-requests/bulk-approve/` | Checker อนุมัติทั้งแผนก |
| POST | `ot-requests/bulk-reject/` | Checker ตีกลับทั้งแผนก |

### Data & Settings
| Method | Endpoint | คำอธิบาย |
|---|---|---|
| GET/POST | `users/` | จัดการ Users (Admin) |
| GET/POST | `departments/` | จัดการแผนก |
| POST | `timelog/import/` | Admin import Timelog จาก Excel |
| POST | `admin/import-staff/` | Admin import รายชื่อพนักงานจาก Excel |
| GET | `checker/budget/` | งบประมาณ OT รายแผนก |
| GET | `notifications/` | การแจ้งเตือนของ User |
| POST | `no-ot-declaration/` | แจ้งไม่มี OT ประจำเดือน |

### WebSocket
| Event | คำอธิบาย |
|---|---|
| `ws://.../ws/notifications/` | Real-time notification push ตาม User |

---

## การแจ้งเตือน (Notification System)

ระบบแจ้งเตือนทำงาน 2 ช่องทางพร้อมกัน:

**1. In-app Bell (Real-time WebSocket)**  
ทุกการเปลี่ยนสถานะคำร้องจะ push แจ้งเตือนทันทีผ่าน WebSocket ไปยังผู้เกี่ยวข้อง

| การกระทำ | ผู้รับแจ้งเตือน |
|---|---|
| Staff ยื่นคำร้อง | Dept Head ทั้งแผนก |
| Dept Head อนุมัติ/ตีกลับ | Staff เจ้าของคำร้อง |
| Dept Head แจ้งพร้อมส่ง | Dept Rep |
| Dept Rep ส่งต่อ Checker | Checker ทั้งหมด |
| Checker อนุมัติ/ตีกลับ | Dept Rep + Staff |

**2. Email (SMTP — ต้องตั้งค่า)**  
- Debounce 10 นาที: Staff ยื่นคำร้องหลายใบ → แจ้ง Dept Head แค่ครั้งเดียว
- Batch notify: Checker อนุมัติ/ตีกลับ → สรุปอีเมลรายแผนก
- Admin import Timelog → แจ้ง Staff ที่มีบันทึกเวลาในรอบนั้น

---

## การติดตั้งสำหรับ Production (Self-hosted Server)

### ความต้องการของระบบ

- Python 3.11+
- Node.js 18+
- MySQL 8.0+

### 1. Clone โปรเจกต์

```bash
git clone <repository-url>
cd CN1401_SMART_OT
```

### 2. ตั้งค่าฐานข้อมูล

```sql
CREATE DATABASE smart_ot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. ตั้งค่า Backend

```bash
cd smart_ot_backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/macOS

pip install -r requirements.txt

copy .env.example .env       # Windows
# cp .env.example .env       # Linux/macOS
```

แก้ไขค่าใน `.env`:

```env
# TU AD API (รับจากทีมพัฒนา)
TU_API_KEY=your_tu_api_key
TU_API_URL=https://restapi.tu.ac.th

# Database
DB_ENGINE=mysql
DB_NAME=smart_ot
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_HOST=127.0.0.1
DB_PORT=3306

# Email (ไม่บังคับ — ถ้าไม่ตั้งค่าระบบยังทำงานได้ปกติ ใช้ in-app bell แทน)
# สมัครฟรีที่ mailjet.com → Account Settings → API Key Management
EMAIL_HOST=in-v3.mailjet.com
EMAIL_PORT=587
EMAIL_HOST_USER=your_mailjet_api_key
EMAIL_HOST_PASSWORD=your_mailjet_secret_key
DEFAULT_FROM_EMAIL="SMART OT <your_email>"
```

```bash
python manage.py migrate
python manage.py createsuperuser   # สร้าง Admin user แรก
```

### 4. Build Frontend

```bash
cd ..
npm install
npm run build
```

### 5. รัน Server

```bash
cd smart_ot_backend
daphne -b 0.0.0.0 -p 8000 smart_ot.asgi:application
```

> **หมายเหตุ:** ใช้ `daphne` (ไม่ใช่ `runserver`) เพื่อรองรับ WebSocket

### 6. ทดสอบอีเมล (ถ้าตั้งค่า Email)

```bash
python manage.py test_email your@email.com
```

---

## การติดตั้งบน Server จริง (Production Deployment)

### ขั้นตอน

```bash
# 1. Clone source code
git clone https://github.com/6510615039/CN401_SMART_OT.git
cd CN401_SMART_OT

# 2. ตั้งค่า environment
cp smart_ot_backend/.env.example smart_ot_backend/.env
# แก้ค่าใน .env ให้ตรงกับ server (database, TU_API_KEY, email ฯลฯ)

# 3. Setup ระบบและสร้างบัญชีผู้ใช้ทั้งหมด (รันครั้งเดียว)
cd smart_ot_backend
bash setup_prod.sh
```

script `setup_prod.sh` จะทำทุกอย่างอัตโนมัติ:
- สร้างตาราง database (migrate)
- ตั้งค่าเกณฑ์ OT และวันหยุดประจำปี
- **สร้างบัญชีพนักงาน 53 คน** จากไฟล์รายชื่อใน `raw_data/` พร้อมสิทธิ์ที่ถูกต้อง
- สร้างบัญชี IT superuser

### บัญชีที่ได้หลัง setup

| บัญชี | username | password เริ่มต้น |
|---|---|---|
| IT superuser | `admin_su` | `SmartOT2569!` |
| พนักงานทุกคน | รหัสพนักงาน เช่น `0001`, `0013` | รหัสพนักงาน |

> พนักงาน login ด้วย TU username + password จริง (TU Active Directory) ระบบจะผูก account อัตโนมัติตอน login ครั้งแรก

---

## การใช้งานครั้งแรก (First-time Setup)

หลัง Deploy เสร็จ ให้ทำตามขั้นตอนนี้:

1. **Admin login** ที่ `/admin/` ด้วย superuser (`admin_su`)
2. **นำเข้า Timelog** (บันทึกเวลาเข้า-ออก) ผ่าน Admin Panel ทุกต้นเดือน
3. **กำหนดวันหยุดเพิ่มเติม** ผ่าน Admin Panel → Holidays (sync อัตโนมัติหรือเพิ่มเอง)
4. **ปรับสิทธิ์พนักงาน** หากมีการเปลี่ยนตำแหน่ง ผ่าน Admin Panel → Users

---

## ไฟล์สำคัญสำหรับส่งมอบ IT

| ไฟล์/โฟลเดอร์ | รายละเอียด |
|---|---|
| Source code (git) | โค้ดทั้งหมดพร้อม version history |
| `smart_ot_backend/.env.example` | Template การตั้งค่า environment ทั้งหมด |
| `public/manuals/*.pdf` | คู่มือการใช้งานแยกตามบทบาท (6 ไฟล์) |

---

## ทีมพัฒนา

| ชื่อ | GitHub |
|---|---|
| นางสาวศรุตา มีงาม | — |
| นายขวัญ ดาวเรือง | — |

**คณะวิศวกรรมศาสตร์ สาขาวิชาวิศวกรรมคอมพิวเตอร์ มหาวิทยาลัยธรรมศาสตร์ · ปีการศึกษา 2568**

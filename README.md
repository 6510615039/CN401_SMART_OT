# SMART OT — ระบบจัดการค่าตอบแทนการทำงานล่วงเวลา
### สำนักงานทะเบียนนักศึกษา มหาวิทยาลัยธรรมศาสตร์

---

## Tech Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| Backend | Django 4.2 + Django REST Framework + JWT |
| Database | SQLite (dev) → PostgreSQL (production) |
| Excel Export | SheetJS (xlsx) + file-saver |

---

## โครงสร้างโปรเจกต์

```
project/
├── src/                          ← React frontend
│   └── app/
│       ├── App.tsx               ← Root: routing, role switching, fetch interceptor
│       └── components/
│           ├── AppShell.tsx      ← Layout: sidebar + header
│           ├── Login.tsx         ← หน้า login
│           ├── OTDetailPage.tsx  ← รายละเอียดคำร้อง OT (shared)
│           ├── shared.tsx        ← KpiCard, StatusChip, PageHeader ฯลฯ
│           ├── roles/
│           │   ├── admin.tsx     ← Admin: dashboard, users, import, holidays, deadlines
│           │   ├── staff.tsx     ← Staff: timelog, submit, status
│           │   ├── depthead.tsx  ← DeptHead: pending, history, report
│           │   ├── deptrep.tsx   ← DepRep: export Excel, forward to checker
│           │   ├── checker.tsx   ← Checker: review, budget, report
│           │   └── executive.tsx ← Executive: dashboard, trend
│           └── ui/               ← shadcn/ui components (อย่าแก้)
│
└── smart_ot_backend/             ← Django backend
    ├── manage.py
    ├── requirements.txt
    ├── smart_ot/
    │   ├── settings.py           ← Config: DB, JWT, CORS, Email
    │   └── urls.py
    └── api/
        ├── models.py             ← User, OTRequest, Holiday, OTDeadline, TimeLog
        ├── serializers.py
        ├── views.py              ← API views + business logic
        ├── urls.py
        ├── tu_api_service.py     ← TU Employee API integration
        └── management/commands/
            └── seed_data.py      ← สร้างข้อมูลตัวอย่าง
```

---

## วิธีรัน (ครั้งแรก)

### 1. Backend

```bash
cd smart_ot_backend
pip install -r requirements.txt
python manage.py makemigrations api --name add_ot_deadline_rep_note
python manage.py migrate
python manage.py seed_data   # สร้าง test users + ข้อมูลตัวอย่าง
python manage.py runserver   # → http://127.0.0.1:8000
```

### 2. Frontend

```bash
# จาก root ของโปรเจกต์
npm install
npm run dev   # → http://localhost:5173
```

> **ต้องรัน backend ก่อนเสมอ** — Vite proxy `/api/*` → port 8000 อัตโนมัติ (ดู `vite.config.ts`)

---

## บัญชีทดสอบ

| Username | Password | Role |
|---|---|---|
| `admin` | `admin1234` | ผู้ดูแลระบบ |
| `somchai` | `staff1234` | พนักงาน |
| `onanong` | `head1234` | หัวหน้าแผนก |
| `panadda` | `rep1234` | ตัวแทนแผนก |
| `checker` | `chk1234` | ผู้ตรวจสอบ |
| `exec` | `exec1234` | ผู้บริหาร |

> บัญชีที่มีหลาย role → สลับได้จาก dropdown ที่ header

---

## OT Workflow

```
Staff ยื่นคำร้อง
    ↓  status: submitted
DeptHead อนุมัติ
    ↓  status: head_approved
DepRep export Excel + ส่งต่อ  →  ส่งอีเมลแจ้ง Checker อัตโนมัติ
    ↓  status: rep_forwarded
Checker ตรวจสอบ + อนุมัติ
    ↓  status: checker_approved / completed
```

---

## Multi-Role Architecture

ผู้ใช้คนหนึ่งมีได้หลาย role:
- `user.role` = primary role
- `user.extra_roles` = JSON array ของ role เพิ่มเติม
- `user.available_roles` = property รวมทั้งหมด

**Frontend:** `App.tsx` เก็บ `active_role` ใน localStorage + ส่ง `X-Acting-Role` header กับทุก `/api/` call  
**Backend:** `get_effective_role(user, request)` ใน `views.py` อ่าน header แล้วกรองข้อมูลตาม role จริง

---

## API Endpoints หลัก

```
POST   /api/auth/login/                    เข้าสู่ระบบ (รับ JWT)
GET    /api/auth/me/                       user ปัจจุบัน

GET    /api/ot-requests/                   คำร้อง OT (auto-filter by role)
POST   /api/ot-requests/                   ยื่นคำร้องใหม่
POST   /api/ot-requests/{id}/approve/      อนุมัติ
POST   /api/ot-requests/{id}/reject/       ตีกลับ
POST   /api/ot-requests/bulk-forward/      DepRep ส่งต่อหลายรายการ + email

GET    /api/users/?role=checker            รายชื่อผู้ใช้ (filter: role, department)
GET    /api/holidays/?year=2568            วันหยุด
GET    /api/timelog/my/                    เวลาเข้า-ออกของ user ปัจจุบัน
POST   /api/timelog/import/                นำเข้าไฟล์เวลา (admin)

GET    /api/ot-deadline/?month=2569-06     กำหนดวันปิดรับ OT
POST   /api/ot-deadline/set/               ตั้งค่า deadline (admin)

GET    /api/settings/                      ตั้งค่าระบบ
PUT    /api/settings/                      อัปเดต
```

Query params ที่ใช้บ่อย: `?status=head_approved`, `?month=2026-06`, `?department=1`

---

## Features สถานะ

### ✅ พัฒนาแล้ว
- Authentication (JWT + TU Employee API integration)
- Multi-role switching พร้อม X-Acting-Role header
- Staff: ดู timelog, ยื่น OT, ติดตามสถานะ, deadline banner
- DeptHead: อนุมัติ/ตีกลับ, ดูประวัติ, รายงาน
- DepRep: export Excel แบบฟอร์มราชการ, ส่งต่อ + email checker
- Checker: review คำร้อง, จัดการงบประมาณ
- Executive: dashboard KPI, trend chart
- Admin: จัดการผู้ใช้/แผนก/วันหยุด/import timelog
- OT Deadline: กำหนดวันปิดรับต่อเดือน (hard block ทั้ง frontend + backend)
- Email notification เมื่อ DepRep ส่งต่อให้ Checker

### 🔧 ยังค้าง
- [ ] CheckerBudget API integration
- [ ] Email HTML template
- [ ] PDF export (HeadReport, ExecSummary)
- [ ] PostgreSQL + production deploy
- [ ] Unit/integration tests

---

## Environment Variables

สร้างไฟล์ `.env` ใน `smart_ot_backend/` สำหรับ production:

```env
SECRET_KEY=your-secret-key-here
DEBUG=False
DATABASE_URL=postgres://user:pass@host:5432/smart_ot
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your@email.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=SMART OT <noreply@tu.ac.th>
```

---

## Git Workflow

```bash
# สร้าง branch ตาม feature
git checkout -b feature/checker-budget-api
git checkout -b fix/staff-submit-validation

# commit message format
git commit -m "feat: CheckerBudget เชื่อม /api/budget/"
git commit -m "fix: staff submit ตรวจ deadline ก่อน POST"
git commit -m "chore: เพิ่ม .env.example"
git commit -m "docs: อัปเดต README"

# push + pull request
git push origin feature/checker-budget-api
```

---

*SMART OT v1.0.0 · สำนักงานทะเบียนนักศึกษา มหาวิทยาลัยธรรมศาสตร์*

# SMART OT — Django Backend

## วิธีติดตั้งและรัน

### ขั้นตอนที่ 1 — ติดตั้ง Python packages
```bash
pip install -r requirements.txt
```

### ขั้นตอนที่ 2 — สร้าง Database
```bash
python manage.py migrate
```

### ขั้นตอนที่ 3 — สร้างข้อมูลตัวอย่าง
```bash
python manage.py seed_data
```

### ขั้นตอนที่ 4 — รัน Server
```bash
python manage.py runserver
```

Server จะรันที่ http://127.0.0.1:8000

---

## บัญชีทดสอบ

| Username     | Password   | Role        |
|--------------|------------|-------------|
| admin        | admin1234  | ผู้ดูแลระบบ  |
| somchai      | staff1234  | พนักงาน     |
| onanong      | head1234   | หัวหน้าแผนก  |
| panadda      | rep1234    | ตัวแทนแผนก  |
| checker      | chk1234    | ผู้ตรวจสอบ  |
| exec         | exec1234   | ผู้บริหาร    |
| s6512345678  | dome1234   | ทดสอบ @dome |

---

## API Endpoints หลัก

### Authentication
| Method | URL | คำอธิบาย |
|--------|-----|---------|
| POST | /api/auth/login/ | เข้าสู่ระบบ รับ JWT token |
| GET  | /api/auth/me/   | ดูข้อมูล user ปัจจุบัน |
| POST | /api/auth/logout/ | ออกจากระบบ |

### ตัวอย่าง Login
```bash
curl -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "somchai", "password": "staff1234"}'
```

### ใช้ token กับ API อื่น
```bash
curl http://127.0.0.1:8000/api/ot-requests/ \
  -H "Authorization: Bearer <access_token>"
```

### OT Requests
| Method | URL | คำอธิบาย |
|--------|-----|---------|
| GET    | /api/ot-requests/ | ดูคำร้องทั้งหมด (กรองตาม role อัตโนมัติ) |
| POST   | /api/ot-requests/ | ยื่นคำร้องใหม่ |
| POST   | /api/ot-requests/{id}/approve/ | อนุมัติ |
| POST   | /api/ot-requests/{id}/reject/  | ตีกลับ |

### Holidays
| Method | URL | คำอธิบาย |
|--------|-----|---------|
| GET    | /api/holidays/?year=2568 | ดูวันหยุดตามปี |
| POST   | /api/holidays/ | เพิ่มวันหยุด (ชดเชย/พิเศษ) |
| PUT    | /api/holidays/{id}/ | แก้ไข |
| DELETE | /api/holidays/{id}/ | ลบ (เฉพาะที่ไม่ใช่ is_system) |

### Settings
| Method | URL | คำอธิบาย |
|--------|-----|---------|
| GET    | /api/settings/ | ดูตั้งค่าระบบ |
| PUT    | /api/settings/ | อัปเดตตั้งค่า |

---

## โครงสร้างโปรเจกต์
```
smart_ot_backend/
├── manage.py
├── requirements.txt
├── smart_ot/           ← Django project config
│   ├── settings.py
│   └── urls.py
└── api/                ← App หลัก
    ├── models.py       ← Database models
    ├── serializers.py  ← API serializers
    ├── views.py        ← API views
    ├── urls.py         ← URL routing
    ├── admin.py        ← Django admin
    └── management/commands/
        └── seed_data.py ← สร้างข้อมูลตัวอย่าง
```

---

## อัปเดต: Django Templates (ไม่ต้องใช้ React)

ระบบรันได้ด้วย Django อย่างเดียวเลย — เปิด browser เห็นหน้าตาสวยงามทันที

### รันด้วย 4 คำสั่ง
```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data
python manage.py runserver
```

เปิด http://127.0.0.1:8000 → เห็นหน้า Login ทันที

### โครงสร้างไฟล์ templates
```
templates/
├── base.html          ← CSS variables, fonts, shared styles
├── layout.html        ← AppShell: header + sidebar + content
├── login.html         ← หน้า Login
├── ot_detail.html     ← รายละเอียดคำร้อง OT
├── profile.html
├── includes/
│   ├── nav_admin.html ← sidebar admin
│   └── nav_staff.html ← sidebar staff
├── admin/
│   ├── dashboard.html
│   ├── holidays.html
│   ├── settings.html
│   ├── users.html
│   └── audit.html
└── staff/
    ├── dashboard.html
    ├── submit.html
    └── status.html
```

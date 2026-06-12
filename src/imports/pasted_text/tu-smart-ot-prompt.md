# Figma Prompt — SMART OT System (มหาวิทยาลัยธรรมศาสตร์)

> **วิธีใช้:** คัดลอกแต่ละ section ไปวางใน Figma AI / Figma Make / Figma First Draft หรือใช้เป็น brief ให้ designer ก็ได้ — แต่ละหัวข้อสามารถสร้างเป็น 1 frame หรือ 1 หน้าได้เลย ครอบคลุมทุก role ที่ออกแบบไว้

---

## 0. Design System (ใช้ร่วมกันทุกหน้า — Set up ก่อน)

**Brand Identity (CI):** สีประจำมหาวิทยาลัยธรรมศาสตร์ — เหลือง–แดง

**Color Tokens:**
- `primary/red` = `#B8001F` (TU Blood Red) — ใช้กับ header, primary action, brand accent
- `primary/red-dark` = `#8A0017` — hover/pressed state
- `primary/red-soft` = `#FCE7EB` — background ของ alert, badge
- `accent/yellow` = `#FFD400` (TU Yellow) — ใช้กับ secondary highlight, focus ring, badge
- `accent/yellow-soft` = `#FFF8D6` — background ของ notification, tag
- `neutral/black` = `#1A1A1A` — heading หลัก
- `neutral/700` = `#404040` — body text
- `neutral/500` = `#737373` — caption, helper text
- `neutral/300` = `#D4D4D4` — border, divider
- `neutral/100` = `#F5F5F5` — page background
- `neutral/0` = `#FFFFFF` — card background
- `success` = `#0A8A44` — approved status
- `warning` = `#CC8800` — pending status
- `danger` = `#D32F2F` — rejected, budget over status
- `info` = `#1976D2` — informational (sparingly)

**Typography:**
- Headline: `Sarabun` (Thai) / `Inter` (English) — weights 600/700
- Body: `Sarabun` 400/500
- Number/Monospace: `Inter` หรือ `JetBrains Mono` สำหรับยอดเงิน/ชั่วโมง
- Sizes (rem-style scale):
  - Display: 32px / 40px line-height (weight 700)
  - H1: 24px / 32px (weight 700)
  - H2: 20px / 28px (weight 600)
  - H3: 16px / 24px (weight 600)
  - Body: 14px / 22px (weight 400)
  - Caption: 12px / 18px (weight 400)

**Spacing scale:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64

**Radius:** xs=4, sm=6, md=8, lg=12, pill=999

**Shadow:**
- `shadow/sm`: 0 1px 2px rgba(0,0,0,0.06)
- `shadow/md`: 0 4px 12px rgba(0,0,0,0.08)
- `shadow/lg`: 0 12px 32px rgba(0,0,0,0.12)

**Logo zone:** ด้านบนซ้ายของ sidebar — มีพื้นที่ 200×60px สำหรับโลโก้มหาวิทยาลัย พร้อม wordmark "SMART OT" ตัวอักษรสีแดง #B8001F และเส้นใต้สีเหลือง #FFD400 หนา 3px

**Layout grid:** 12 columns, gutter 24px, margin 32px, max-content-width 1280px ภายใต้ viewport 1440px

---

## 1. หน้าใช้ร่วมกัน (Shared / Public Pages)

### 1.1 Login Page
ออกแบบหน้า Login สำหรับระบบ SMART OT ของสำนักงานทะเบียน มหาวิทยาลัยธรรมศาสตร์ บน desktop 1440×900px แบ่งจอเป็น 2 ส่วน: ซีกซ้าย 55% เป็น hero panel สีแดง `#B8001F` มีโลโก้มหาวิทยาลัยธรรมศาสตร์ขนาดใหญ่ตรงกลาง ใต้โลโก้มีข้อความ "SMART OT SYSTEM" ตัวอักษรสีเหลือง `#FFD400` weight 700 ขนาด 36px และ subheading สีขาวว่า "ระบบคำนวณและตรวจสอบค่าตอบแทนการปฏิบัติงานนอกเวลาราชการ" 16px ด้านล่าง hero มีลายเส้นเฉียงสีเหลืองเป็นลวดลายตกแต่งบางๆ ซีกขวา 45% เป็น white card form มี header "เข้าสู่ระบบ" 24px bold สีดำ ตามด้วย field "Username (หรืออีเมล)" ที่มี icon คน, field "Password" ที่มี icon กุญแจและปุ่ม toggle แสดง/ซ่อน, checkbox "จดจำการเข้าสู่ระบบ", ปุ่ม "เข้าสู่ระบบ" สีแดง #B8001F เต็มความกว้าง สูง 48px มี ripple effect, ลิงก์ "ลืมรหัสผ่าน?" สีแดงด้านล่าง, และ footer caption สีเทาว่า "© 2569 สำนักงานทะเบียนนักศึกษา มธ." ใช้ฟอนต์ Sarabun ตลอด

### 1.2 Forgot Password Page
หน้ารีเซ็ตรหัสผ่าน layout เดียวกับ Login (hero ซ้าย/form ขวา) form มี header "ลืมรหัสผ่าน" subheader "กรอกอีเมลที่ลงทะเบียนไว้ ระบบจะส่งลิงก์รีเซ็ตให้" field "อีเมล" ปุ่ม "ส่งลิงก์รีเซ็ต" สีแดง และลิงก์ "← กลับไปเข้าสู่ระบบ"

### 1.3 404 / Error Page
หน้า error แบบ minimal — ตรงกลางจอมีตัวเลข "404" ขนาด 120px สีแดง `#B8001F` มีเส้นใต้สีเหลือง `#FFD400` หนา 6px กว้าง 80px ใต้ตัวเลขมีข้อความ "ไม่พบหน้าที่คุณกำลังค้นหา" 20px และปุ่ม "กลับสู่หน้าหลัก" สีแดงด้านล่าง

---

## 2. App Shell (Layout ร่วม หลังจาก Login ทุก Role)

ออกแบบ application shell ที่ใช้ร่วมกันทุก role:
- **Top bar (สูง 64px, สีขาว shadow/sm)**: ซ้าย — โลโก้ SMART OT (สีแดง+เส้นใต้เหลือง) + breadcrumb; ขวา — ไอคอนกระดิ่ง notification ที่มี badge สีเหลือง #FFD400 (เลขแจ้งเตือนสีดำ), avatar ผู้ใช้พร้อมชื่อ-role และ dropdown menu (โปรไฟล์ / ออกจากระบบ)
- **Sidebar ซ้าย (กว้าง 240px, สีขาว, มี divider ขวาสีเทา neutral/300)**: รายการเมนู vertical แต่ละข้อสูง 44px มี icon ซ้าย 20px + ข้อความ 14px, active state เป็นพื้น `primary/red-soft` #FCE7EB + ข้อความสีแดง #B8001F + แถบ indicator สีเหลือง #FFD400 หนา 4px ที่ขอบซ้าย, hover state เป็นพื้น neutral/100 — เมนูจะแตกต่างตาม role (ดูแต่ละ section)
- **Content area**: พื้น `neutral/100` #F5F5F5, padding 32px, ใช้ card สีขาว radius 12 shadow/sm สำหรับเนื้อหาแต่ละกลุ่ม
- **Footer mini (สูง 40px)**: caption สีเทาบอกเวอร์ชันระบบและลิขสิทธิ์

---

## 3. ROLE 1 — ผู้ดูแลระบบ (System Admin / พี่ขวัญ)

**เมนู Sidebar:** Dashboard / นำเข้าข้อมูลเวลา / จัดการผู้ใช้ / จัดการแผนก / ตั้งค่าระบบ / ประวัติการนำเข้า / Audit Log

### 3.1 Admin Dashboard
ออกแบบหน้า Dashboard ของผู้ดูแลระบบ: H1 "Dashboard ผู้ดูแลระบบ" 24px และวันที่ปัจจุบันด้านขวา; แถวบน 4 KPI cards (สีขาว radius 12 shadow/sm สูง 110px) แสดง: "ผู้ใช้ทั้งหมด" พร้อมตัวเลขใหญ่ 32px และ icon คน, "นำเข้าข้อมูลล่าสุด" พร้อมวันที่, "คำร้องในระบบเดือนนี้" พร้อมตัวเลข, "สถานะระบบ" พร้อม dot สีเขียว + "ปกติ"; แถวกลาง 2 columns — ซ้าย "Activity Log ล่าสุด" เป็น timeline แสดง 8 รายการล่าสุด (icon + ผู้ทำรายการ + การกระทำ + เวลา), ขวา "การกระจายผู้ใช้ตามแผนก" เป็น donut chart 6 สี (แดง/เหลือง/น้ำเงิน/เขียว/ม่วง/ส้ม) มี legend ด้านขวา; แถวล่าง quick actions 3 ปุ่มใหญ่ (สีแดง outline) — "นำเข้าไฟล์ใหม่", "เพิ่มผู้ใช้", "ตั้งค่างบประมาณ"

### 3.2 Import Time Attendance Data
ออกแบบหน้านำเข้าข้อมูลเวลา: H1 "นำเข้าข้อมูลเวลาเข้า-ออกงาน"; Stepper 3 ขั้นบนสุด (Upload → Preview → Confirm) — ขั้นที่ active สีแดง #B8001F ขั้นเสร็จแล้วสีเขียว ขั้นที่ยังไม่ถึงสีเทา; การ์ดหลัก: ขั้น 1 = drop zone กรอบ dashed สีแดง #B8001F สูง 280px มี icon cloud upload 64px ข้อความ "ลากไฟล์ .xlsx หรือ .csv มาวางที่นี่ หรือ" และปุ่ม "เลือกไฟล์" สีแดง, ใต้ drop zone มี helper text "รองรับไฟล์จากเครื่องสแกนนิ้ว/ใบหน้า — ขนาดสูงสุด 50MB"; ด้านบนขวามี selector "เดือน/ปี ของข้อมูล" (default = เดือนปัจจุบัน); ตรงด้านล่างมี warning card สีเหลือง #FFF8D6 พร้อม icon ⚠️ ว่า "หากนำเข้าไฟล์ของเดือนที่มีข้อมูลอยู่แล้ว ระบบจะตัดข้อมูลซ้ำซ้อนทิ้งอัตโนมัติ ห้ามนำเข้าไฟล์ซ้ำ"; ปุ่ม "ถัดไป →" สีแดงด้านล่างขวา

### 3.3 Import — Preview & Confirm
หน้าตัวอย่างข้อมูลก่อนยืนยันนำเข้า: บนสุด summary 4 ตัวเลข — "รายการทั้งหมด: 1,247", "พนักงาน: 89 คน", "วันที่ครอบคลุม: 1–31 พ.ค.", "พบความผิดปกติ: 3 รายการ"; ตารางใหญ่แสดงตัวอย่าง 20 แถวแรกของข้อมูล columns = [วันที่, รหัสพนักงาน, ชื่อ, แผนก, เวลาเข้า, เวลาออก, ชั่วโมง OT, สถานะ]; แถวที่มีปัญหามีพื้นหลังสีแดงอ่อน #FCE7EB และ icon ⚠️ ตรง column สถานะ; ด้านล่างมีปุ่ม "← ย้อนกลับ" outline และ "✓ ยืนยันนำเข้า" สีแดงทึบ; modal confirm ก่อนกด — ขนาด 480px มีคำถาม "ยืนยันนำเข้าข้อมูลเดือน พ.ค. 2569 ใช่หรือไม่?" สองปุ่ม "ยกเลิก" และ "ยืนยัน" สีแดง

### 3.4 User Management (จัดการผู้ใช้)
หน้ารายชื่อผู้ใช้: H1 "จัดการผู้ใช้งาน" + ปุ่ม "+ เพิ่มผู้ใช้" สีแดงด้านขวาบน; แถบ filter — search box, dropdown แผนก (5 แผนก + ทั้งหมด), dropdown role (6 role + ทั้งหมด), toggle "Active เท่านั้น"; ตารางผู้ใช้ columns = [Avatar, ชื่อ-นามสกุล, รหัสพนักงาน, แผนก, Role (เป็น chip สีตาม role: Admin=แดงเข้ม, Checker=ม่วง, DeptHead=ส้ม, DeptRep=เหลือง #FFD400, Staff=น้ำเงิน, Executive=เขียว), อีเมล, สถานะ (toggle Active/Inactive), Actions (icon ดินสอ-แก้ไข, icon ถังขยะ-ลบ)]; pagination ด้านล่าง 10/หน้า; row hover สีเทาอ่อน

### 3.5 Add / Edit User Modal
Modal ขนาด 640×720px มี header สีแดง #B8001F สูง 60px ข้อความสีขาว "เพิ่มผู้ใช้ใหม่" + ปุ่ม ✕ ขวา; form แบ่ง 2 columns: ซ้าย — รหัสพนักงาน, คำนำหน้า (dropdown), ชื่อ, นามสกุล, อีเมล, เบอร์โทร; ขวา — แผนก (dropdown 5 แผนก), Role (radio 6 ตัวเลือก พร้อม description สั้นๆ ใต้แต่ละข้อ), ฐานเงินเดือน (input ตัวเลข), อัตราค่า OT/ชั่วโมง (input ตัวเลข auto-calc จากเงินเดือนแต่แก้ไขได้); footer — ปุ่ม "ยกเลิก" outline และ "บันทึก" สีแดงทึบ

### 3.6 Department & Permission Settings
หน้าจัดการแผนกและตัวแทนแผนก: H1 "จัดการแผนกและสิทธิ์"; แสดง 5 cards (1 card ต่อ 1 แผนก) เรียงเป็น 2 columns; แต่ละ card สูง ~280px มี header เป็นชื่อแผนกสีแดง #B8001F + จำนวนสมาชิก, ในการ์ดมี 3 sub-section: (1) "หัวหน้าแผนก" แสดง avatar+ชื่อ พร้อมปุ่มเปลี่ยน, (2) "ตัวแทนแผนก (Dept Rep)" แสดง avatar+ชื่อ พร้อมปุ่มเปลี่ยน — มี badge เหลือง "1 คน/แผนก", (3) "สมาชิก" แสดงจำนวน + ปุ่ม "ดูทั้งหมด"

### 3.7 System Settings (ตั้งค่าระบบ)
หน้าตั้งค่าระบบและงบประมาณ: เป็น tab 3 อัน — "งบประมาณ" / "เกณฑ์ OT" / "การแจ้งเตือน"
- Tab งบประมาณ: input "งบประมาณค่า OT รายเดือน (บาท)" ขนาดใหญ่, ตารางงบประมาณแยกตามแผนก 5 แถว (แผนก / งบที่จัดสรร / ใช้ไปแล้ว / คงเหลือ — มี progress bar สีตามสัดส่วน เขียว <70%, เหลือง 70–90%, แดง >90%)
- Tab เกณฑ์ OT: input "ชั่วโมง OT สูงสุดวันธรรมดา" (default 4), "ชั่วโมง OT สูงสุดวันหยุด" (default 7), อัตราคูณ (×1.5 วันธรรมดา / ×3 วันหยุด)
- Tab การแจ้งเตือน: toggle "เปิดการแจ้งเตือนภายในระบบ", "เปิดการแจ้งเตือนทางอีเมล", input "อีเมลผู้ดูแลระบบ"

### 3.8 Import History
หน้าประวัติการนำเข้า: ตารางแสดงประวัติเรียงล่าสุดบนสุด columns = [วันที่นำเข้า, เดือนของข้อมูล, ผู้นำเข้า, จำนวนรายการ, จำนวนพนักงาน, สถานะ (chip เขียว "สำเร็จ"/แดง "มีข้อผิดพลาด"), Actions (👁 ดูรายละเอียด, ↻ นำเข้าใหม่)]; filter ด้านบนเลือกช่วงวันที่ได้

---

## 4. ROLE 2 — พนักงาน (Staff)

**เมนู Sidebar:** Dashboard / เวลาเข้า-ออกของฉัน / ยื่นคำร้อง OT / สถานะคำร้อง / โปรไฟล์

### 4.1 Staff Dashboard
หน้าหลักพนักงาน: H1 "สวัสดี, {ชื่อ}" + caption "{แผนก} • รหัส {empID}"; แถวบน 4 KPI cards — "ชั่วโมง OT เดือนนี้" 32px ตัวเลขสีแดง, "ค่า OT คาดว่าจะได้รับ" สีเขียว, "สถานะคำร้องเดือนนี้" chip สี (รออนุมัติ=เหลือง / อนุมัติแล้ว=เขียว / ตีกลับ=แดง), "ครั้งต่อไปที่ยื่นได้" วันที่; แถวกลาง 2 columns — ซ้าย "กิจกรรมล่าสุดของฉัน" timeline 5 รายการ (ยื่นคำร้อง, อนุมัติ, ตีกลับ, แก้ไข), ขวา "ปฏิทินการทำงานเดือนนี้" mini-calendar สีบ่งบอกวันที่มี OT (สีเหลือง #FFD400) วันหยุด (สีเทา) วันที่ทำงานปกติ (สีขาว); แถวล่าง alert card ถ้ามีคำร้องถูกตีกลับ — พื้น `primary/red-soft` #FCE7EB ข้อความ "คุณมีคำร้อง 1 รายการถูกตีกลับ กรุณาแก้ไข" + ปุ่ม "ไปแก้ไข →" สีแดง

### 4.2 My Time Log (เวลาเข้า-ออกของฉัน)
หน้าตรวจสอบเวลา: H1 "เวลาเข้า-ออกของฉัน" + selector เดือน/ปี; toggle "มุมมองตาราง / ปฏิทิน"; มุมมองตาราง — columns = [วันที่ (พร้อม weekday), เวลาเข้า, เวลาออก, ชั่วโมงทำงาน, ชั่วโมง OT, สถานะ (สี: ปกติ/มาสาย/ขาด/วันหยุด)]; มุมมองปฏิทิน — calendar grid 7×5 แต่ละช่องวันที่ขนาด ~140×100px แสดงเวลาเข้า-ออก ชั่วโมง OT พร้อม background color อ่อนๆ ตามสถานะ; ด้านบนขวามี summary card mini "รวม OT เดือนนี้: X ชั่วโมง — ประเมินค่าตอบแทน Y บาท"

### 4.3 Submit OT Request
หน้ายื่นคำร้องเบิก OT: H1 "ยื่นคำร้องขอเบิกค่า OT"; ขั้นบนสุด banner สีเหลือง #FFF8D6 บอกข้อกำหนด "วันธรรมดา OT สูงสุด 4 ชม. / วันหยุดสูงสุด 7 ชม."; ตารางเลือกวันที่จะยื่น — checkbox ซ้ายสุด, columns = [✓, วันที่, ประเภทวัน (วันธรรมดา/หยุด), เวลาเข้า, เวลาออก, ชั่วโมง OT (input แก้ได้ แต่ระบบเตือนถ้าเกินเกณฑ์ — input เปลี่ยนเป็นพื้นแดงอ่อนถ้าเกิน), อัตราค่า OT (อ่านอย่างเดียว), จำนวนเงิน (auto-calc, แสดงสีเขียว)]; แถวเลือกแล้วจะ highlight สีเหลือง #FFF8D6; field "เหตุผลการขอเบิก" textarea บังคับกรอก; sticky bottom bar — แสดง "เลือก X รายการ • รวมเงิน Y บาท" และปุ่ม "ส่งคำร้อง" สีแดงขนาดใหญ่ + ปุ่ม "ยกเลิก" outline; modal confirm ก่อนส่ง

### 4.4 Request Status / History (สถานะคำร้อง)
หน้ารายการคำร้อง: H1 "สถานะคำร้องของฉัน"; tab "ทั้งหมด / รออนุมัติ / อนุมัติแล้ว / ถูกตีกลับ"; แต่ละ tab มีตัวเลข badge; ตาราง columns = [วันที่ยื่น, เดือนของข้อมูล, จำนวนวัน, รวมชั่วโมง, รวมเงิน, สถานะ (chip สี + ขั้นปัจจุบัน เช่น "รอหัวหน้าแผนก"/"รอผู้ตรวจสอบ"/"อนุมัติทั้งหมด"), เหตุผลตีกลับ (ถ้ามี — แสดง icon 💬 hover เห็นข้อความ), Actions (👁 ดูรายละเอียด, ✏️ แก้ไข — เฉพาะที่ถูกตีกลับ)]; click แถวเปิด side panel ขวาแสดงรายละเอียดเต็ม + timeline ขั้นตอนการอนุมัติ (จากพนักงาน → หัวหน้าแผนก → ตัวแทนแผนก → ผู้ตรวจสอบ → ผู้บริหาร) แต่ละจุดมี checkmark/timestamp/ผู้ดำเนินการ

### 4.5 Edit Rejected Request
หน้าแก้ไขคำร้องที่ถูกตีกลับ: top banner สีแดงอ่อน #FCE7EB icon ⚠️ "คำร้องนี้ถูกตีกลับโดย {ชื่อหัวหน้า} เมื่อ {วันที่} — เหตุผล: {เหตุผล}"; UI เหมือนหน้า Submit OT แต่ pre-fill ข้อมูลเดิม + highlight แถวที่หัวหน้าตีกลับด้วยพื้นแดงอ่อน + comment ของหัวหน้าใน tooltip; sticky bottom "ส่งใหม่" สีแดง

### 4.6 My Profile
หน้าโปรไฟล์ของพนักงาน: card ซ้าย — avatar ใหญ่, ชื่อ, รหัส, แผนก, role, ปุ่ม "เปลี่ยนรหัสผ่าน"; card ขวา — ข้อมูลการเงิน (ฐานเงินเดือน, อัตรา OT — readonly), ข้อมูลติดต่อ (อีเมล, เบอร์ — แก้ได้), preferences (toggle รับการแจ้งเตือนทางอีเมล)

---

## 5. ROLE 3 — หัวหน้าแผนก (Department Head)

**เมนู Sidebar:** Dashboard / คำร้องรออนุมัติ / ประวัติการอนุมัติ / สมาชิกในแผนก / รายงานแผนก

### 5.1 Dept Head Dashboard
H1 "Dashboard หัวหน้าแผนก — {ชื่อแผนก}"; แถวบน 4 KPI cards — "คำร้องรออนุมัติ" ตัวเลขใหญ่สีส้ม + ปุ่ม "ไปอนุมัติ →", "อนุมัติแล้วเดือนนี้" สีเขียว, "ยอด OT รวมแผนก" แสดงเงิน, "% งบประมาณที่ใช้" + progress bar (เขียว→เหลือง→แดง); แถวกลาง — ซ้าย "พนักงานที่ทำ OT สูงสุด 5 อันดับ" bar chart นอนนอน, ขวา "แนวโน้ม OT 6 เดือนย้อนหลัง" line chart; แถวล่าง alert ถ้ามีคำร้องถูกผู้ตรวจสอบตีกลับ — สีแดง icon ⚠️ "คุณมี 2 คำร้องที่ผู้ตรวจสอบขอให้พิจารณาใหม่"

### 5.2 Pending Requests (คำร้องรออนุมัติ)
H1 "คำร้องรออนุมัติ — {ชื่อแผนก}" + badge count; filter — search ชื่อพนักงาน, dropdown เดือน, dropdown ช่วงเงิน; ตารางคำร้อง columns = [☑ checkbox, ชื่อพนักงาน + avatar, เดือนของข้อมูล, จำนวนวัน, รวมชั่วโมง, รวมเงิน, วันที่ยื่น, Action (ปุ่ม "ดูรายละเอียด" outline สีแดง)]; checkbox header เลือกทั้งหมดได้; sticky bottom bar เมื่อมีการเลือก — แสดง "เลือก X รายการ • รวม Y บาท" + ปุ่ม "✓ อนุมัติทั้งหมดที่เลือก" สีเขียว #0A8A44 + ปุ่ม "✕ ตีกลับ" สีแดง #D32F2F

### 5.3 Request Detail & Partial Approve
หน้ารายละเอียดคำร้องของพนักงาน 1 คน — แสดงเป็น page เต็ม ไม่ใช่ modal: ส่วน header — info card ขนาดใหญ่แสดงชื่อพนักงาน รหัส แผนก ตำแหน่ง อัตรา OT/ชม. และยอดรวมทั้งคำร้อง; ส่วน main — ตารางรายวันที่ขอเบิก columns = [☑, วันที่, ประเภทวัน, เวลาเข้า, เวลาออก, ชั่วโมง OT, อัตรา, จำนวนเงิน, สถานะ chip (รออนุมัติ)]; แต่ละแถวเลือกได้แยกกัน, click แถวเปิด detail expand แสดงเวลา raw จากเครื่องสแกน + เหตุผลของพนักงาน; sticky bottom 3 ปุ่ม — "✓ อนุมัติเฉพาะที่เลือก" สีเขียว, "✓ อนุมัติทั้งหมด" สีเขียวเข้ม, "✕ ตีกลับทั้งคำร้อง" สีแดง พร้อม textarea เหตุผลการตีกลับ (บังคับ); confirm modal ก่อนกดทุกปุ่ม

### 5.4 Approval History
หน้าประวัติการอนุมัติของหัวหน้า: ตาราง columns = [วันที่ดำเนินการ, ชื่อพนักงาน, เดือนของข้อมูล, จำนวนวัน, รวมเงิน, การกระทำ (chip: "อนุมัติทั้งหมด"=เขียว / "อนุมัติบางส่วน"=เหลือง / "ตีกลับ"=แดง), หมายเหตุ, Actions (👁)]; filter ช่วงวันที่ + dropdown action

### 5.5 Department Members
หน้ารายชื่อสมาชิกในแผนก: grid card 4 columns แต่ละ card 240×280px มี avatar กลาง, ชื่อ, role, ปุ่มลิงก์ "ดู OT ของคนนี้" → ไปหน้า detail; ด้านบนมี summary card สรุปจำนวนสมาชิก / จำนวนที่ทำ OT เดือนนี้

### 5.6 Department Report
หน้ารายงานของแผนก: H1 "รายงานแผนก {ชื่อ}"; selector ช่วงเดือน; ตัวเลข summary 3 cards — รวมชั่วโมง OT, รวมเงิน, จำนวนคนที่ทำ; charts 2 อัน — bar chart "OT per พนักงาน" และ pie "สัดส่วนวันธรรมดา vs วันหยุด"; ปุ่ม "ดาวน์โหลด PDF" + "ดาวน์โหลด Excel" ด้านขวาบน

---

## 6. ROLE 4 — ตัวแทนแผนก (Department Representative)

**เมนู Sidebar:** Dashboard / ส่งออก Excel / ประวัติการส่งออก / สมาชิกในแผนก

### 6.1 Dept Rep Dashboard
H1 "Dashboard ตัวแทนแผนก — {ชื่อแผนก}"; แถวบน 4 KPI cards — "พร้อมส่งออก" ตัวเลขใหญ่สีแดง + ปุ่ม "ไปส่งออก →", "ส่งออกแล้วเดือนนี้" สีเขียว, "ส่งล่าสุดเมื่อ" วันที่+เวลา, "สถานะหลังส่ง" chip; ส่วนกลาง — call-to-action card ใหญ่ขนาด full-width สูง 160px พื้น `accent/yellow-soft` #FFF8D6 มี icon Excel ขนาดใหญ่ ข้อความ "มี 24 คำร้องพร้อมส่งออกประจำเดือน พ.ค. 2569 — กดเพื่อสร้างไฟล์ Excel" + ปุ่ม "ส่งออกเลย →" สีแดง #B8001F; ด้านล่าง mini timeline 5 รายการสุดท้ายที่ส่งออก

### 6.2 Export Excel Page
H1 "ส่งออกข้อมูลเป็น Excel"; ขั้นบนสุด stepper 3 ขั้น — เลือกข้อมูล → ตรวจสอบ → ส่งออก; การ์ดหลัก — selector "เดือน/ปี" (default = เดือนล่าสุด), checkbox "เลือกเฉพาะที่หัวหน้าแผนกอนุมัติแล้ว" (default ✓), checkbox group เลือกพนักงาน (เลือกทั้งหมด/เฉพาะคน); ตาราง preview คำร้องที่จะส่งออก columns = [☑, พนักงาน, รวมชั่วโมง, รวมเงิน, สถานะอนุมัติ chip เขียว "อนุมัติแล้ว"]; summary footer — "จะส่งออก X รายการ • รวม Y บาท • คาดว่าจะใช้งบ Z% ของแผนก"; ปุ่ม "ตรวจสอบและส่งออก →" สีแดง

### 6.3 Export Preview Modal / Page
หน้าตัวอย่างไฟล์ Excel ก่อนสร้างจริง — แสดง preview เป็น mock-up ของ spreadsheet (column header สีแดง #B8001F text ขาว) มี radio button format "Excel (.xlsx)" / "CSV (.csv)" / "PDF (.pdf)" ด้านล่าง; ปุ่ม "← ย้อนกลับ" + "📥 ดาวน์โหลดไฟล์" สีแดง; modal สำเร็จหลังกด — icon ✓ สีเขียว ข้อความ "ส่งออกสำเร็จ — ไฟล์ถูกบันทึกและพร้อมนำส่งผู้ตรวจสอบ" + ปุ่ม "ส่งให้ผู้ตรวจสอบทันที →" สีแดง

### 6.4 Forward to Checker
หน้ายืนยันการส่งต่อให้ผู้ตรวจสอบ: card ใหญ่ตรงกลาง แสดง info ไฟล์ที่จะส่ง (ชื่อไฟล์, ขนาด, จำนวนรายการ, รวมเงิน) + dropdown เลือกผู้ตรวจสอบ (default = คุณยุ่น) + textarea "ข้อความถึงผู้ตรวจสอบ" (optional) + ปุ่ม "ส่งไฟล์ทาง In-app + Email" สีแดง; toast แจ้งสำเร็จด้านล่างขวา

### 6.5 Export History
ตารางประวัติส่งออก columns = [วันที่/เวลา, เดือนของข้อมูล, จำนวนรายการ, รวมเงิน, ผู้รับ, สถานะ chip (รอผู้ตรวจสอบ=เหลือง / ตรวจผ่าน=เขียว / ตีกลับ=แดง), Actions (📥 ดาวน์โหลดซ้ำ, 👁 ดู, ↻ ส่งใหม่)]

---

## 7. ROLE 5 — ผู้ตรวจสอบ (Checker / พี่ยุ่น)

**เมนู Sidebar:** Dashboard / ตรวจสอบคำร้อง / ตรวจสอบงบประมาณ / ประวัติการตรวจสอบ / รายงานภาพรวม

### 7.1 Checker Dashboard
H1 "Dashboard ผู้ตรวจสอบ"; แถวบน 4 KPI cards ขนาดใหญ่ — "รอตรวจสอบ" สีส้ม + นับจำนวนแผนกที่ส่งมา, "งบประมาณเดือนนี้" + ตัวเลข + caption "ใช้ไป X%", "ทะลุงบหรือไม่" chip ใหญ่ (เขียว "ปลอดภัย" / เหลือง "ใกล้เพดาน" / แดง "เกินงบ"), "รวมยอด OT 5 แผนก" ตัวเลขสีแดง; แถวกลาง — Budget Gauge ขนาดใหญ่ครึ่งวงกลม (semi-circular gauge) แสดงสัดส่วนใช้งบ — เข็มสีแดง พื้นไล่สีเขียว→เหลือง→แดง + ตัวเลข % ตรงกลาง + caption "เพดาน X บาท / ใช้ไป Y บาท / คงเหลือ Z บาท"; แถวล่าง — ตาราง "สถานะการส่งจาก 5 แผนก" — แต่ละแถว 1 แผนก columns = [แผนก, ตัวแทน, สถานะ (chip), จำนวนรายการ, ยอดเงิน, วันที่ส่ง, Action (ปุ่ม "ตรวจสอบ")]

### 7.2 Combined Review (ตรวจสอบคำร้องรวม 5 แผนก)
H1 "ตรวจสอบคำร้องประจำเดือน"; selector เดือน + view toggle "รวม / แยกแผนก"; มุมมองรวม — ตารางใหญ่ columns = [☑, แผนก (chip สี), พนักงาน, รวมชั่วโมง, รวมเงิน, สถานะ chip, Flag (⚠️ ถ้ามีคำร้องที่เกินเกณฑ์)]; filter ด้านบน — checkbox "เฉพาะที่มี flag", dropdown แผนก, slider ช่วงเงิน; แถวที่ flag มีพื้นแดงอ่อน; sticky bottom — แสดง "เลือก X จาก 5 แผนก • รวม Y บาท" + ปุ่ม "✓ อนุมัติให้ผ่าน" สีเขียว + ปุ่ม "✕ ตีกลับให้หัวหน้าแผนก" สีแดง; กดตีกลับเปิด modal เลือกแผนกที่จะตีกลับ + textarea เหตุผล

### 7.3 Budget Monitor
H1 "ติดตามงบประมาณ"; tabs "ภาพรวม / รายแผนก / รายเดือน"; tab ภาพรวม — กราฟ stacked bar 12 เดือน + เส้น threshold สีแดงแสดงเพดาน + dot สีแดงในเดือนที่เกิน; tab รายแผนก — 5 cards แต่ละ card แสดง progress bar แนวนอน สีตามสัดส่วน + ตัวเลขใช้/เพดาน/คงเหลือ + recommendation text (เช่น "ใช้งบ 92% ควรเตือนหัวหน้าแผนก"); ปุ่ม "ส่งแจ้งเตือนงบเกิน" สีแดง (เปิดใช้เมื่อมีแผนกที่เกิน) → เปิด modal เลือกแผนก + แก้ message + ส่ง

### 7.4 Reject to Dept Head Form
หน้า/Modal ตีกลับให้หัวหน้าแผนก: header สีแดง #B8001F "ตีกลับคำร้องให้หัวหน้าแผนก"; แสดงรายการที่จะตีกลับ (อ่านอย่างเดียว); checkbox group เลือกหัวหน้าแผนกที่จะส่งหา; textarea "เหตุผลการตีกลับ" บังคับ ≥20 ตัวอักษร; checkbox "ส่งทางอีเมลด้วย" + checkbox "ส่งทาง Line group"; ปุ่ม "✕ ตีกลับและส่งการแจ้งเตือน" สีแดง

### 7.5 Audit Log / Review History
หน้าประวัติการตรวจสอบ: timeline แนวตั้งเรียงจากใหม่→เก่า แต่ละ entry มี icon (✓ เขียว = อนุมัติ / ✕ แดง = ตีกลับ) ผู้ดำเนินการ การกระทำ เป้าหมาย เวลา และ link "ดูรายละเอียด"; filter ด้านบน — ช่วงวันที่, dropdown action, dropdown แผนก

### 7.6 Overall Report
หน้ารายงานภาพรวม 5 แผนก: H1 "รายงานภาพรวม"; KPI 4 ตัวบน, charts 2 อัน — stacked bar 5 แผนก × 6 เดือน, donut "สัดส่วน OT แต่ละแผนก"; ตารางสรุปด้านล่าง; ปุ่ม "ดาวน์โหลด PDF/Excel" + "ส่งให้ผู้บริหาร"

---

## 8. ROLE 6 — ผู้บริหาร (Executive)

**เมนู Sidebar:** Dashboard / รายงานประจำเดือน / แนวโน้ม / ดาวน์โหลดรายงาน / อนุมัติเบิกจ่าย

### 8.1 Executive Dashboard
หน้าหลักของผู้บริหาร — ดีไซน์ premium feel เน้น data visualization: H1 "Executive Dashboard" + selector "เดือน/ปี" + chip "ปรับปรุงล่าสุด: {เวลา}"; แถวบน 4 KPI cards ใหญ่กว่า role อื่น (สูง 140px) สีเด่นแต่ละใบ — "รวมค่า OT เดือนนี้" พื้นแดง #B8001F text ขาว ตัวเลข 36px, "เทียบเดือนก่อน" +/-% พร้อม icon ลูกศร, "% งบประมาณ" + progress bar, "จำนวนพนักงานที่ทำ OT"; แถวกลาง 3 columns — ซ้าย bar chart "OT 5 แผนก" สี 5 แผนก, กลาง line chart "แนวโน้ม 12 เดือน" + เส้น forecast dashed, ขวา donut "Top 10 ผู้ทำ OT สูงสุด" + legend; แถวล่าง — ตาราง "รายการที่รอลงนาม" 3 รายการล่าสุด + ปุ่ม "ดูทั้งหมด →"; ทุก chart มี tooltip บอกตัวเลขละเอียดเมื่อ hover

### 8.2 Monthly Summary
H1 "รายงานสรุปประจำเดือน {เดือน/ปี}"; layout เหมือนรายงาน printable — กระดาษ A4 portrait, header มีโลโก้มหาวิทยาลัย + ชื่อสำนักงาน + ชื่อรายงาน + เลขที่เอกสาร + วันที่; ส่วน 1 ตารางสรุปยอดต่อแผนก, ส่วน 2 charts mini, ส่วน 3 ตารางรายชื่อพนักงานที่ทำ OT พร้อมยอดเงิน; footer — เส้นลายเซ็น 3 ช่อง (ผู้จัดทำ/ผู้ตรวจสอบ/ผู้อนุมัติ); ด้านขวาบนของหน้ามีปุ่ม sticky "🖨 ปริ้นท์", "📥 ดาวน์โหลด PDF", "✍️ ลงนามอิเล็กทรอนิกส์"

### 8.3 Trend Analysis
หน้าวิเคราะห์แนวโน้ม: filter range 3/6/12/24 เดือน; กราฟใหญ่ multi-line chart เปรียบเทียบ 5 แผนก พร้อม checkbox เปิด/ปิดเส้น; ด้านข้างมี insight cards ที่ generate อัตโนมัติ — เช่น "แผนก A มีแนวโน้ม OT เพิ่มขึ้น 23% ใน 3 เดือนล่าสุด"; ปุ่ม share report

### 8.4 Download Reports
หน้าดาวน์โหลดรายงาน: grid cards 3 columns — แต่ละ card แทนรายงาน 1 ฉบับ (สรุปประจำเดือน, ภาพรวมไตรมาส, ภาพรวมประจำปี, เปรียบเทียบรายแผนก) มี thumbnail preview + ปุ่มดาวน์โหลด

### 8.5 E-Sign / Final Approval
H1 "อนุมัติเบิกจ่ายค่า OT — {เดือน/ปี}"; แสดงเอกสารสรุปเหมือนหน้า Monthly Summary ใน iframe/preview; ด้านขวามี panel sticky 320px มี checklist "✓ ตรวจสอบยอดเงินรวม", "✓ ตรวจสอบงบประมาณ", "✓ ตรวจสอบรายแผนก" — บังคับติ๊กครบก่อนกด; ปุ่ม "✍️ ลงนามอนุมัติ" สีแดง #B8001F ขนาดใหญ่ — เปิด modal ให้วาดลายเซ็นหรือ upload หรือใช้ stored signature; หลังลงนามแสดง success state + "ส่งให้ฝ่ายการเงินดำเนินการเบิกจ่ายต่อไป"

---

## 9. Notifications & Toasts (ใช้ร่วมทุก role)

### 9.1 Notification Dropdown (จาก icon กระดิ่ง)
Panel กว้าง 380px shadow/lg radius 12 — header "การแจ้งเตือน" + ปุ่ม "ทำเป็นอ่านแล้วทั้งหมด"; รายการ noti แต่ละชิ้นสูง 80px มี icon ซ้าย (สีตามประเภท: เขียว=approve, แดง=reject, เหลือง=budget alert, น้ำเงิน=info), ข้อความ 2 บรรทัด + เวลา "5 นาทีที่แล้ว"; รายการที่ยังไม่อ่านมี dot สีเหลือง #FFD400 ด้านขวา + background `accent/yellow-soft`; footer "ดูทั้งหมด →"

### 9.2 Toast / Snackbar
มุมขวาล่างหน้าจอ — กล่องสูง 64px กว้าง 360px radius 8 shadow/lg, มี icon ซ้าย + ข้อความ + ปุ่ม ✕; 4 variants:
- success — พื้นเขียวอ่อน text เขียวเข้ม
- error — พื้นแดงอ่อน text แดง
- warning — พื้นเหลืองอ่อน text น้ำตาล
- info — พื้นฟ้าอ่อน text น้ำเงิน

### 9.3 Email Template (สำหรับ noti email)
รูปแบบอีเมล HTML — header สีแดง #B8001F สูง 80px มีโลโก้ขาว, body พื้นเทาอ่อน card ขาวตรงกลาง 600px width, มี greeting "เรียน คุณ{ชื่อ}", ข้อความเหตุการณ์, ปุ่ม CTA สีแดง "ไปยังระบบ", footer สีเทา ลิงก์ unsubscribe + ที่อยู่หน่วยงาน

---

## 10. Components Library (ใช้ซ้ำในทุกหน้า)

ออกแบบ component library ใน Figma แยก page ต่างหาก ครอบคลุม:
- **Buttons:** primary (สีแดง #B8001F ทึบ text ขาว), secondary (outline แดง text แดง), tertiary/ghost (text แดงไม่มี border), warning (เหลือง #FFD400 text ดำ), success (เขียว #0A8A44), danger (แดง #D32F2F) — 3 sizes (sm 32px, md 40px, lg 48px) — states (default/hover/pressed/disabled/loading with spinner)
- **Form fields:** text input, textarea, select dropdown, checkbox, radio, toggle switch, date picker, time picker, file upload — states (default/focus ring สีเหลือง 2px/error สีแดง+helper text/disabled)
- **Tables:** header สีแดง #B8001F text ขาว + sort icon, alternate row สีเทาอ่อน #FAFAFA, hover แถวสีเหลืองอ่อน, sticky header on scroll, pagination ด้านล่าง, empty state มี illustration + ข้อความ
- **Cards:** plain (สีขาว shadow/sm), highlighted (border-left 4px สีแดง), warning (พื้น `accent/yellow-soft`), danger (พื้น `primary/red-soft`)
- **Badges/Chips:** สำหรับ status — `success`, `warning`, `danger`, `info`, `neutral` — radius pill, padding 4×10, font 12px weight 600
- **Modals:** สูงสุด 720px กว้าง 480/640/800, มี backdrop สีดำ opacity 50%, header มีปุ่ม ✕ ขวาบน
- **Tabs:** underline style — active มี border-bottom สีแดง 3px + text สีแดง
- **Stepper:** horizontal — แต่ละขั้นเป็นวงกลม 32px มีหมายเลข, ขั้น active สีแดง, ขั้นเสร็จสีเขียวมี ✓
- **Avatar:** วงกลม 32/40/48px มี initial หรือรูป, fallback สีเหลือง #FFD400 text ดำ
- **Empty state:** ตรงกลาง — illustration เส้นเรียบสีแดง+เหลือง + ข้อความหลัก 18px + caption + ปุ่ม CTA
- **Loading:** skeleton (สี neutral/300 → neutral/100 shimmer) + spinner (สีแดง)

---

## 11. Responsive Notes (Mobile / Tablet — Optional)

ออกแบบ responsive breakpoint: 
- Desktop ≥1280px (default ที่ออกแบบไว้)
- Tablet 768–1279px — sidebar ยุบเป็น icon-only กว้าง 64px, KPI cards เปลี่ยนจาก 4 col เป็น 2 col
- Mobile <768px — sidebar กลายเป็น bottom navigation 5 icon หลัก, top bar เหลือโลโก้+กระดิ่ง+เมนู hamburger, ตารางใหญ่กลายเป็น card list

---

## 12. Prototype Flow (สำหรับ Figma Prototyping)

ตั้งค่า prototype connections ดังนี้:
- Login → Dashboard ตาม role (กดปุ่มเข้าสู่ระบบ)
- Staff: Dashboard → My Time Log → Submit OT → Confirm modal → Status page
- Staff: Status page (มีคำร้องที่ถูกตีกลับ) → Edit Rejected → Resubmit → Status page
- Dept Head: Dashboard → Pending Requests → Request Detail → Approve/Reject → กลับ Dashboard
- Dept Rep: Dashboard → Export Excel → Preview → Forward → Success
- Checker: Dashboard → Combined Review → Reject form → Dashboard (budget gauge updated)
- Executive: Dashboard → Monthly Summary → E-Sign modal → Success
- Admin: Dashboard → Import → Preview → Confirm → Import History

ใช้ smart animate สำหรับ transition ระหว่างหน้าเดียวกัน 300ms ease-out, dissolve 200ms สำหรับเปลี่ยนหน้า

---

**จบ Prompt** — รวม **48 หน้า/หน้าจอ** ครอบคลุม **6 roles** พร้อม design system, components และ prototyping notes — สามารถใช้ Figma First Draft / Figma AI / หรือใช้เป็น brief ให้ designer สร้าง mockup ได้ทันที
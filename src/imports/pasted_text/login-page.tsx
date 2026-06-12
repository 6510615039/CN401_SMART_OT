## Prompt 1 — หน้า Login

```
Redesign the Login page for "SMART OT SYSTEM" 
(ระบบคำนวณค่าตอบแทนการปฏิบัติงานนอกเวลาราชการ สำนักงานทะเบียนนักศึกษา มหาวิทยาลัยธรรมศาสตร์)

Layout: Split screen — left 55% hero panel, right 45% form panel

Left panel:
- Background color #B8001F (TU Red)
- Diagonal stripe pattern overlay (gold #FFD400, opacity 15%)
- Logo block: black rounded rectangle, white bold text "RegTU"
- Headline: "SMART OT SYSTEM" in #FFD400, bold, 36px
- Subtitle: "ระบบคำนวณและตรวจสอบค่าตอบแทนการปฏิบัติงานนอกเวลาราชการ" in white
- Small text: "สำนักงานทะเบียนนักศึกษา มหาวิทยาลัยธรรมศาสตร์" in white 70% opacity

Right panel (white background):
- Heading: "เข้าสู่ระบบ" bold 24px
- Subtext: "กรุณากรอกข้อมูลเพื่อเข้าใช้งานระบบ SMART OT" gray

Form fields:
1. Username field
   - Label: "Username"
   - Placeholder: "กรอก Username เช่น s6512345678"
   - Helper text below field: "รองรับบัญชี @tu.ac.th และ @dome.tu.ac.th"
   - Left icon: person/user icon

2. Password field
   - Label: "รหัสผ่าน"
   - Placeholder: "••••••••"
   - Left icon: key icon
   - Right icon: eye toggle (show/hide password)

3. Row: checkbox "จดจำการเข้าสู่ระบบ" left + link "ลืมรหัสผ่าน?" right (color #B8001F)

4. Primary button full-width: "เข้าสู่ระบบด้วย TU Account" background #B8001F white text height 48px

5. Small text center: "ระบบเชื่อมต่อกับ TU REST API • สิทธิ์การใช้งานถูกกำหนดโดยผู้ดูแลระบบ"

Design 3 states on the same frame:
- State A (Default): empty fields, no error
- State B (Error): red border on both fields, error message below password: "Username หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" in red
- State C (Loading): button shows spinner + "กำลังตรวจสอบ..." disabled state, fields disabled

Footer: "© 2569 สำนักงานทะเบียนนักศึกษา มธ."
Brand colors: primary #B8001F, accent #FFD400, text #1A1A1A, gray #737373
Font: Sarabun (Thai), Inter (English/numbers)
```

---

## Prompt 2 — หน้าจัดการวันหยุด (Admin)

```
Design a full admin page "จัดการวันหยุดประจำปี" for a Thai university OT management system.
This page is inside an existing dashboard layout (sidebar nav already exists, do not redesign it).
Content area only.

Page header row:
- Left: title "จัดการวันหยุดประจำปี" bold 24px + subtitle "เพิ่ม แก้ไข หรือลบวันหยุดที่ใช้คำนวณ OT"
- Right: dropdown year selector (show 2567 selected), button "โหลดวันหยุดอัตโนมัติ" (outlined style with download icon), button "+ เพิ่มวันหยุด" (filled #B8001F)

Summary chips row (below header):
- "วันหยุดราชการ 16 วัน" (red badge)
- "วันหยุดชดเชย 3 วัน" (orange badge)  
- "วันหยุดพิเศษ 1 วัน" (purple badge)

Data table (white card, rounded corners, shadow):
Columns: ลำดับ | วันที่ | วัน | ชื่อวันหยุด | ประเภท | จัดการ

Sample rows:
- 1 Jan 1 / วันพุธ / วันขึ้นปีใหม่ / badge "วันหยุดราชการ" red / edit+delete icons
- 2 Apr 6 / วันจันทร์ / วันจักรี / badge "วันหยุดราชการ" red / edit+delete icons
- 3 Apr 14 / วันอังคาร / วันสงกรานต์ / badge "วันหยุดราชการ" red / edit+delete icons
- 4 Apr 18 / วันเสาร์ / ชดเชยวันสงกรานต์ / badge "วันหยุดชดเชย" orange / edit+delete icons
- 5 May 1 / วันศุกร์ / วันแรงงานแห่งชาติ / badge "วันหยุดราชการ" red / edit+delete icons

Pagination at bottom: showing "แสดง 1-10 จาก 20 รายการ"

Modal overlay "เพิ่ม / แก้ไขวันหยุด" (show as separate frame):
- Title: "เพิ่มวันหยุด"
- Date picker field: "วันที่"
- Text input: "ชื่อวันหยุด" placeholder "เช่น วันขึ้นปีใหม่"
- Dropdown: "ประเภท" options: วันหยุดราชการ / วันหยุดชดเชย / วันหยุดพิเศษ
- Buttons row: "ยกเลิก" (outlined) + "บันทึก" (filled #B8001F)

Modal overlay "โหลดวันหยุดอัตโนมัติ" (show as separate frame):
- Title: "โหลดวันหยุดปี 2568 อัตโนมัติ"
- Body text: "ระบบจะดึงข้อมูลวันหยุดราชการจากฐานข้อมูลกลาง กรุณาตรวจสอบและยืนยันก่อนบันทึก"
- Preview list: show 5 sample holidays with checkboxes (all checked by default)
- Warning text in yellow box: "วันหยุดพิเศษและวันหยุดชดเชยบางส่วนอาจต้องเพิ่มเติมด้วยตนเอง"
- Buttons: "ยกเลิก" + "ยืนยันและบันทึก" (#B8001F)

Brand colors: #B8001F red, #FFD400 yellow, white cards, #F5F5F5 background
Font: Sarabun, Inter
```

---

## Prompt 3 — เปลี่ยน Pop-up เป็นหน้าใหม่ (Detail Page)

```
Design a full detail page for an OT request record, replacing the existing pop-up dialog.
This page is inside the existing dashboard layout (sidebar nav already exists).
Context: User clicks "ดูรายละเอียด" on any OT record row → navigates to this full page.

Page header row:
- Back button (arrow left icon + "กลับ") on the far left
- Title: "รายละเอียดคำขอ OT" bold 24px
- Right side: status badge (e.g. "รออนุมัติ" yellow / "อนุมัติแล้ว" green / "ถูกปฏิเสธ" red) + action buttons depending on role

Layout: 2-column grid (left 60%, right 40%)

Left column — main info card (white, rounded, shadow):
Section "ข้อมูลผู้ยื่นคำขอ":
- Name, Employee ID, Department, Position in a 2x2 grid of label+value pairs

Section "รายละเอียดการปฏิบัติงาน OT":
- วันที่ปฏิบัติงาน, ประเภทวัน (วันธรรมดา/วันหยุด badge), เวลาเริ่ม–เวลาสิ้นสุด, จำนวนชั่วโมง
- สถานที่ปฏิบัติงาน, หมวดงาน
- รายละเอียดงาน (text area style, read-only)

Section "การคำนวณค่าตอบแทน":
- Table: ประเภทชั่วโมง | จำนวนชั่วโมง | อัตรา | รวม
- Total row highlighted in light red background
- Bold total amount in #B8001F

Right column:
Card "สถานะการอนุมัติ" — vertical timeline/stepper:
- ขั้นที่ 1: ยื่นคำขอ (completed green)
- ขั้นที่ 2: หัวหน้าแผนกอนุมัติ (completed or pending)
- ขั้นที่ 3: ตัวแทนแผนกส่งเรื่อง (pending)
- ขั้นที่ 4: ผู้ตรวจสอบอนุมัติ (pending)
Each step shows: icon, label, approver name, date+time if completed

Card "เอกสารแนบ" below timeline:
- List of attached files with file icon, filename, download button

Card "หมายเหตุ/ความคิดเห็น" (if rejected):
- Show rejection reason in yellow warning box

Bottom action bar (sticky):
- Role-based buttons e.g. "อนุมัติ" (green filled) + "ปฏิเสธ" (red outlined) for approver role
- Or "แก้ไข" + "ถอนคำขอ" for staff role

Brand colors: #B8001F, #FFD400, white, #F5F5F5
Font: Sarabun, Inter
Design 2 variants: status = "รออนุมัติ" and status = "ถูกปฏิเสธ"
```

เอาไปปรับตามหน้าจริงของตัวเองได้เลยนะครับ แต่ละ prompt เขียนไว้ให้ครบรายละเอียดพอที่ Figma AI จะ generate ออกมาใกล้เคียงของจริง
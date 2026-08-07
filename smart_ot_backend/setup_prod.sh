#!/usr/bin/env bash
# Production setup — รันครั้งแรกหลัง deploy บน server ใหม่
# ใช้: cd smart_ot_backend && bash setup_prod.sh
set -e

MAPPING_FILE="/raw_data/07.employee_id_email_mapping.xlsx"
ROLES_FILE="/raw_data/08.รายชื่อจากพี่ขวัญ.xlsx"

echo "========================================"
echo "[1/5] Running migrations..."
echo "========================================"
python manage.py migrate

echo ""
echo "========================================"
echo "[2/5] Seeding SystemSettings + Holidays..."
echo "========================================"
python manage.py seed_initial

echo ""
echo "========================================"
echo "[3/5] Creating real user accounts..."
echo "========================================"
python manage.py update_staff_from_mapping "$MAPPING_FILE"

echo ""
echo "========================================"
echo "[4/5] Setting roles..."
echo "========================================"
python manage.py update_staff_roles "$ROLES_FILE"

echo ""
echo "========================================"
echo "[5/5] Creating IT superuser..."
echo "========================================"
python ../create_su.py

echo ""
echo "========================================"
echo "Production setup complete."
echo ""
echo "บัญชี IT superuser:"
echo "  username : admin_su"
echo "  password : SmartOT2569!"
echo ""
echo "บัญชีพนักงาน (53 คน):"
echo "  username : รหัสพนักงาน เช่น 0001, 0013"
echo "  password : รหัสพนักงาน (ให้พนักงานเปลี่ยนเองหลัง login ครั้งแรก)"
echo "========================================"

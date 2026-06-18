#!/usr/bin/env bash
set -e

echo "========================================"
echo "[1/6] Running migrations..."
echo "========================================"
python manage.py migrate

echo ""
echo "========================================"
echo "[2/6] Flushing database..."
echo "========================================"
python manage.py flush --no-input

echo ""
echo "========================================"
echo "[3/6] Seeding initial data..."
echo "========================================"
python manage.py seed_data

echo ""
echo "========================================"
echo "[4/6] Importing staff from mapping file..."
echo "========================================"
python manage.py update_staff_from_mapping "../raw_data/07.employee_id_email_mapping.xlsx"

echo ""
echo "========================================"
echo "[5/6] Updating staff roles..."
echo "========================================"
python manage.py update_staff_roles "../raw_data/08.รายชื่อจากพี่ขวัญ.xlsx"

echo ""
echo "========================================"
echo "[6/6] Fixing OT amounts..."
echo "========================================"
python manage.py fix_ot_amounts --apply

echo ""
echo "========================================"
echo "Setup complete."
echo "========================================"

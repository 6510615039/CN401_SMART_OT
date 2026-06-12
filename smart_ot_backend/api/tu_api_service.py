"""
TU API Service
==============
รองรับ 2 ฟีเจอร์หลัก:
  1. verify_tu_credentials()  — ยืนยันตัวตน TU AD (login)
  2. fetch_employee()         — ดึงข้อมูลพนักงาน (import Excel)

TU Auth endpoint:
  POST https://restapi.tu.ac.th/api/v1/auth/Ad/verify
  Header: Application-Key: <token>
  Body:   {"UserName": "...", "PassWord": "..."}
  Response: { "status": true, "type": "employee"|"student",
              "username": "...", "displayname_th": "...",
              "email": "...", "department": "...", ... }
"""

import urllib.request
import urllib.error
import json
import logging

logger = logging.getLogger(__name__)

_CACHE: dict = {}  # emp_id → employee dict | None

TU_AUTH_URL = 'https://restapi.tu.ac.th/api/v1/auth/Ad/verify'


# ---------------------------------------------------------------------------
# Settings helper
# ---------------------------------------------------------------------------

def _get_settings():
    """คืน SystemSettings object หรือ None"""
    try:
        from .models import SystemSettings
        return SystemSettings.objects.first()
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

def verify_tu_credentials(username: str, password: str) -> dict | None:
    """
    ยืนยัน username/password กับ TU AD API
    คืน dict ข้อมูลผู้ใช้ หรือ None ถ้าล้มเหลว/ปิดใช้งาน

    dict ที่คืนมีรูปแบบ:
    {
      'username':   str,
      'first_name': str,
      'last_name':  str,
      'email':      str,
      'type':       'employee' | 'student',
      'dept_name':  str,
      'status_work': str,   # employee: '0'=ลาออก '1'=ปฏิบัติงาน '2'=ไม่ปฏิบัติงาน
      'tu_status':  str,    # student status
    }
    """
    settings = _get_settings()
    if not settings or not settings.tu_api_enabled or not settings.tu_api_key:
        return None

    api_key = settings.tu_api_key.strip()
    body = json.dumps({'UserName': username, 'PassWord': password}).encode()

    try:
        req = urllib.request.Request(
            TU_AUTH_URL,
            data=body,
            headers={
                'Content-Type': 'application/json',
                'Application-Key': api_key,
            },
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())

        if not data.get('status'):
            logger.info(f'TU Auth: invalid credentials for {username}')
            return None

        return _parse_tu_auth(data)

    except urllib.error.HTTPError as e:
        logger.error(f'TU Auth: HTTP {e.code} for {username}')
        return None
    except Exception as e:
        logger.error(f'TU Auth: error — {e}')
        return None


def _parse_tu_auth(data: dict) -> dict:
    """แปลง TU auth response → dict มาตรฐาน"""
    # displayname_th: "ชื่อ นามสกุล"
    display = data.get('displayname_th', '')
    parts = display.split(' ', 1)
    first = parts[0] if parts else ''
    last  = parts[1] if len(parts) > 1 else ''

    return {
        'username':    data.get('username', ''),
        'first_name':  first,
        'last_name':   last,
        'email':       data.get('email', ''),
        'type':        data.get('type', 'employee'),  # 'employee' or 'student'
        'dept_name':   data.get('department', ''),
        'organization': data.get('organization', ''),
        'faculty':     data.get('faculty', ''),
        'status_work': data.get('StatusWork', ''),
        'tu_status':   data.get('tu_status', ''),
    }


# ---------------------------------------------------------------------------
# Employee data (for Excel import)
# ---------------------------------------------------------------------------

def _parse_employee(data: dict) -> dict:
    return {
        'first_name': data.get('firstName') or data.get('first_name') or '',
        'last_name':  data.get('lastName')  or data.get('last_name')  or '',
        'dept_name':  data.get('deptName')  or data.get('dept_name')  or data.get('department') or '',
        'dept_code':  data.get('deptCode')  or data.get('dept_code')  or '',
        'email':      data.get('email') or '',
        'position':   data.get('position') or data.get('jobTitle') or '',
    }


def fetch_employee(emp_id: str) -> dict | None:
    """ดึงข้อมูลพนักงาน 1 คนจาก TU API (พร้อม cache)"""
    emp_id = str(emp_id).strip()
    if emp_id in _CACHE:
        return _CACHE[emp_id]

    settings = _get_settings()
    if not settings or not settings.tu_api_enabled or not settings.tu_api_url:
        _CACHE[emp_id] = None
        return None

    base_url = settings.tu_api_url.rstrip('/')
    api_key  = settings.tu_api_key or ''
    url = f'{base_url}/employee/{emp_id}'

    try:
        req = urllib.request.Request(
            url,
            headers={
                'Content-Type': 'application/json',
                'Application-Key': api_key,
            },
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            result = _parse_employee(data)
            _CACHE[emp_id] = result
            logger.info(f'TU API: found {emp_id} → {result["first_name"]} {result["last_name"]}')
            return result
    except urllib.error.HTTPError as e:
        if e.code == 404:
            logger.warning(f'TU API: employee {emp_id} not found')
        else:
            logger.error(f'TU API: HTTP {e.code} for {emp_id}')
        _CACHE[emp_id] = None
        return None
    except Exception as e:
        logger.error(f'TU API: error for {emp_id} — {e}')
        _CACHE[emp_id] = None
        return None


def clear_cache():
    _CACHE.clear()


def get_or_create_dept(dept_name: str, dept_code: str = '') -> object | None:
    if not dept_name:
        return None
    try:
        from .models import Department
        code = dept_code or dept_name[:10].upper().replace(' ', '_')
        dept, _ = Department.objects.get_or_create(
            name=dept_name,
            defaults={'code': code},
        )
        return dept
    except Exception as e:
        logger.error(f'get_or_create_dept error: {e}')
        return None

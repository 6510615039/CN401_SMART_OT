import re
from django.utils import timezone
from django.db.models import Q
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
import openpyxl
from .models import (
    User, Department, OTRequest, Holiday,
    SystemSettings, TimeLog, ImportHistory, AuditLog, OTDeadline
)
from .serializers import (
    UserSerializer, UserCreateSerializer, DepartmentSerializer,
    OTRequestSerializer, HolidaySerializer, SystemSettingsSerializer,
    TimeLogSerializer, ImportHistorySerializer, AuditLogSerializer,
)


def get_effective_role(user, request):
    """ดึง role ที่ใช้งานจริง — รองรับ X-Acting-Role header สำหรับ multi-role users
    ถ้า header ส่งมาและ user มี role นั้นใน available_roles → ใช้ role นั้น
    มิฉะนั้นใช้ user.role ปกติ
    """
    acting_as = request.META.get('HTTP_X_ACTING_ROLE', '').strip()
    if acting_as:
        available = getattr(user, 'available_roles', None) or []
        if acting_as in available:
            return acting_as
    return user.role


def _send_checker_notification(ot_list, note, sender):
    """ส่งอีเมลสรุปคำร้อง OT ที่ส่งต่อให้ checker ทุกคน (fail-silent)"""
    from django.core.mail import send_mail
    from django.conf import settings as djsettings
    try:
        checkers = User.objects.filter(role='checker', is_active=True)
        recipients = [
            u.notify_email or u.email
            for u in checkers
            if (u.notify_email or u.email)
        ]
        if not recipients:
            return
        dept_name = ot_list[0].department.name if ot_list else ''
        total_amount = sum(float(ot.amount) for ot in ot_list)
        total_hours  = sum(float(ot.ot_hours) for ot in ot_list)
        subject = f'[SMART OT] คำร้อง OT {len(ot_list)} รายการ รอตรวจสอบ — {dept_name}'
        lines = [
            'เรียน ผู้ตรวจสอบ',
            '',
            f'ตัวแทนแผนก {dept_name} ({sender.get_full_name()}) ส่งต่อคำร้อง OT จำนวน {len(ot_list)} รายการ:',
            '',
        ]
        for ot in ot_list:
            lines.append(f'  • {ot.staff.get_full_name()} — {ot.work_date}  {float(ot.ot_hours):.1f} ชม. / {float(ot.amount):,.0f} บาท')
        lines += [
            '',
            f'รวม: {total_hours:.1f} ชั่วโมง  —  {total_amount:,.0f} บาท',
        ]
        if note:
            lines += ['', f'หมายเหตุจากตัวแทนแผนก: {note}']
        lines += ['', 'กรุณาเข้าสู่ระบบ SMART OT เพื่อดำเนินการ']
        send_mail(subject, '\n'.join(lines),
                  djsettings.DEFAULT_FROM_EMAIL, recipients,
                  fail_silently=True)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f'send_checker_notification: {e}')


def log_action(user, action, model_name='', object_id='', detail='', request=None):
    ip = None
    if request:
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        ip = x_forwarded.split(',')[0] if x_forwarded else request.META.get('REMOTE_ADDR')
    AuditLog.objects.create(
        user=user, action=action,
        model_name=model_name, object_id=str(object_id),
        detail=detail, ip_address=ip
    )


# ─── Auth ────────────────────────────────────────────────────────────────────

def _auto_create_user_from_tu(tu_data: dict) -> 'User | None':
    """
    สร้างหรืออัปเดต User จากข้อมูล TU Auth
    - ถ้ามีอยู่แล้ว: อัปเดตชื่อ/email/dept (คง role เดิม)
    - ถ้าใหม่: สร้างด้วย role='staff' (admin เปลี่ยน role ทีหลังได้)
    """
    from .tu_api_service import get_or_create_dept
    username = tu_data.get('username', '').strip()
    if not username:
        return None

    dept = get_or_create_dept(tu_data.get('dept_name', ''))
    defaults = {
        'first_name': tu_data.get('first_name', ''),
        'last_name':  tu_data.get('last_name', ''),
        'email':      tu_data.get('email', ''),
        'is_active':  True,
    }
    # กำหนด dept เฉพาะกรณีมีข้อมูล
    if dept:
        defaults['department'] = dept

    try:
        user, created = User.objects.get_or_create(username=username, defaults={
            **defaults, 'role': 'staff',
        })
        if not created:
            # อัปเดตชื่อ/email/dept แต่ไม่เปลี่ยน role
            for k, v in defaults.items():
                setattr(user, k, v)
            user.save()
        return user
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'auto_create_user_from_tu: {e}')
        return None


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Login flow:
    1. TU API Auth (ถ้าเปิดใช้งาน) → auto-create/sync user → JWT
    2. Local Django auth (fallback หรือบัญชี admin)

    รองรับทั้ง:
      - อีเมล TU: s6512345678@dome.tu.ac.th / sariya@tu.ac.th
      - username: somchai / s6512345678
    """
    from .tu_api_service import verify_tu_credentials

    username_input = request.data.get('username', '').strip()
    password       = request.data.get('password', '').strip()

    if not username_input or not password:
        return Response({'error': 'กรุณากรอกอีเมลและรหัสผ่าน'}, status=400)

    # ตัด @domain ออกเพื่อใช้เป็น TU username
    tu_username = username_input.split('@')[0] if '@' in username_input else username_input

    user = None

    # ── ขั้นตอน 1: TU API Auth ─────────────────────────────────────────
    tu_data = verify_tu_credentials(tu_username, password)
    if tu_data:
        user = _auto_create_user_from_tu(tu_data)
        if not user:
            return Response({'error': 'ไม่สามารถสร้างบัญชีในระบบได้ กรุณาติดต่อผู้ดูแลระบบ'}, status=500)

    # ── ขั้นตอน 2: Local Auth (fallback) ──────────────────────────────
    if not user:
        if '@' in username_input:
            # ค้นจาก email field ก่อน
            try:
                found = User.objects.get(email__iexact=username_input)
                user = authenticate(request, username=found.username, password=password)
            except User.DoesNotExist:
                pass
            # ลอง local username (ส่วนก่อน @)
            if not user:
                user = authenticate(request, username=tu_username, password=password)
        else:
            user = authenticate(request, username=username_input, password=password)
            if not user:
                try:
                    found = User.objects.get(employee_id=username_input)
                    user = authenticate(request, username=found.username, password=password)
                except User.DoesNotExist:
                    pass

    if not user:
        return Response({'error': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'}, status=401)

    if not user.is_active:
        return Response({'error': 'บัญชีนี้ถูกระงับการใช้งาน'}, status=403)

    refresh = RefreshToken.for_user(user)
    log_action(user, 'เข้าสู่ระบบ', request=request)

    return Response({
        'access':  str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserSerializer(user).data,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_token_view(request):
    from rest_framework_simplejwt.views import TokenRefreshView
    return TokenRefreshView.as_view()(request._request)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response(UserSerializer(request.user).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    log_action(request.user, 'ออกจากระบบ', request=request)
    return Response({'message': 'ออกจากระบบสำเร็จ'})


# ─── Users ───────────────────────────────────────────────────────────────────

class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = User.objects.all().order_by('id')

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        role = self.request.query_params.get('role')
        dept = self.request.query_params.get('department')
        q    = self.request.query_params.get('q')
        if role: qs = qs.filter(role=role)
        if dept: qs = qs.filter(department_id=dept)
        if q:    qs = qs.filter(Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(username__icontains=q))
        return qs

    def perform_create(self, serializer):
        user = serializer.save()
        log_action(self.request.user, f'เพิ่มผู้ใช้ {user.get_full_name()}', 'User', user.id, request=self.request)

    def perform_destroy(self, instance):
        name = instance.get_full_name()
        instance.is_active = False
        instance.save()
        log_action(self.request.user, f'ระงับผู้ใช้ {name}', 'User', instance.id, request=self.request)


# ─── Departments ─────────────────────────────────────────────────────────────

class DepartmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = DepartmentSerializer
    queryset = Department.objects.all().order_by('name')


# ─── OT Requests ─────────────────────────────────────────────────────────────

class OTRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = OTRequestSerializer

    def get_queryset(self):
        user = self.request.user
        effective_role = get_effective_role(user, self.request)
        qs = OTRequest.objects.select_related('staff', 'department')

        # กรองตาม effective_role (รองรับ multi-role users ที่ส่ง X-Acting-Role header)
        if effective_role == 'staff':
            qs = qs.filter(staff=user)
        elif effective_role == 'depthead':
            qs = qs.filter(staff__department=user.department)
        elif effective_role == 'deptrep':
            if user.department:
                # ใช้ OR: ตรงกับ OTRequest.department หรือ staff.department
                qs = qs.filter(
                    Q(department=user.department) | Q(staff__department=user.department)
                ).distinct()
            # ถ้า deptrep ไม่มีแผนก: เห็นทั้งหมดในสถานะที่เกี่ยวข้อง
            # default (ไม่มี ?status): แสดงเฉพาะที่รอส่งต่อ
            if not self.request.query_params.get('status'):
                qs = qs.filter(status='head_approved')
        elif effective_role == 'checker':
            qs = qs.filter(status__in=['rep_forwarded', 'checker_approved', 'checker_rejected', 'completed'])
        # admin/executive เห็นทั้งหมด

        # filter params
        status_p = self.request.query_params.get('status')
        dept_p   = self.request.query_params.get('department')
        month_p  = self.request.query_params.get('month')  # YYYY-MM
        if status_p: qs = qs.filter(status=status_p)
        if dept_p:   qs = qs.filter(department_id=dept_p)
        if month_p:
            year, month = month_p.split('-')
            qs = qs.filter(work_date__year=year, work_date__month=month)

        return qs.order_by('-work_date')

    def create(self, request, *args, **kwargs):
        # ตรวจ deadline ก่อน create — ถ้าเลยกำหนดปฏิเสธทันที
        import datetime as _dt
        work_date_str = request.data.get('work_date', '')
        if work_date_str:
            try:
                work_date_obj = _dt.date.fromisoformat(work_date_str)
                # แปลงเป็น thai_month (ปี พ.ศ.)
                thai_year = work_date_obj.year + 543
                thai_month = f'{thai_year}-{work_date_obj.month:02d}'
                err = _check_ot_deadline(thai_month)
                if err:
                    return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)
            except ValueError:
                pass
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        # คำนวณ day_type อัตโนมัติ
        work_date = serializer.validated_data.get('work_date')
        is_holiday = Holiday.objects.filter(date=work_date).exists()
        is_weekend = work_date.weekday() >= 5
        day_type = 'holiday' if (is_holiday or is_weekend) else 'weekday'

        # คำนวณค่าตอบแทน: วันธรรมดา 60 บาท/ชม. วันหยุด 70 บาท/ชม.
        ot_hours = serializer.validated_data.get('ot_hours', 0)
        hourly_rate = 70 if day_type == 'holiday' else 60
        amount = float(ot_hours) * hourly_rate

        # ถ้า user ไม่มีแผนก ให้ใช้แผนก default หรือสร้างใหม่
        dept = self.request.user.department
        if dept is None:
            from .models import Department
            dept, _ = Department.objects.get_or_create(
                name='ไม่ระบุแผนก', defaults={'code': 'NONE'}
            )

        ot = serializer.save(
            staff=self.request.user,
            department=dept,
            day_type=day_type,
            amount=amount,
            status='submitted',
        )
        log_action(self.request.user, f'ยื่นคำร้อง OT วันที่ {ot.work_date}', 'OTRequest', ot.id, request=self.request)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        ot = self.get_object()
        user = request.user
        effective_role = get_effective_role(user, request)
        note = request.data.get('note', '')

        if effective_role == 'depthead' and ot.status == 'submitted':
            ot.status = 'head_approved'
            ot.head_approved_by = user
            ot.head_approved_at = timezone.now()
            ot.head_note = note
            ot.save()
            log_action(user, f'อนุมัติคำร้อง OT #{ot.id}', 'OTRequest', ot.id, request=request)
            return Response({'message': 'อนุมัติสำเร็จ'})

        elif effective_role == 'deptrep' and ot.status == 'head_approved':
            ot.status = 'rep_forwarded'
            ot.rep_forwarded_by = user
            ot.rep_forwarded_at = timezone.now()
            ot.rep_note = note
            ot.save()
            log_action(user, f'ส่งต่อคำร้อง OT #{ot.id}', 'OTRequest', ot.id, request=request)
            return Response({'message': 'ส่งต่อสำเร็จ'})

        elif effective_role == 'checker' and ot.status == 'rep_forwarded':
            ot.status = 'checker_approved'
            ot.checker_approved_by = user
            ot.checker_approved_at = timezone.now()
            ot.checker_note = note
            ot.save()
            log_action(user, f'ผู้ตรวจสอบอนุมัติคำร้อง OT #{ot.id}', 'OTRequest', ot.id, request=request)
            return Response({'message': 'อนุมัติสำเร็จ'})

        return Response({'error': f'ไม่สามารถดำเนินการได้ (role={effective_role}, status={ot.status})'}, status=400)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        ot = self.get_object()
        user = request.user
        effective_role = get_effective_role(user, request)
        note = request.data.get('note', '')

        if effective_role == 'depthead' and ot.status == 'submitted':
            ot.status = 'head_rejected'
            ot.head_note = note
            ot.save()
            log_action(user, f'ตีกลับคำร้อง OT #{ot.id}', 'OTRequest', ot.id, request=request)
            return Response({'message': 'ตีกลับสำเร็จ'})

        elif effective_role == 'checker' and ot.status == 'rep_forwarded':
            ot.status = 'checker_rejected'
            ot.checker_note = note
            ot.save()
            log_action(user, f'ผู้ตรวจสอบตีกลับคำร้อง OT #{ot.id}', 'OTRequest', ot.id, request=request)
            return Response({'message': 'ตีกลับสำเร็จ'})

        return Response({'error': 'ไม่สามารถดำเนินการได้ในสถานะนี้'}, status=400)


# ─── Holidays ────────────────────────────────────────────────────────────────

class HolidayViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = HolidaySerializer

    def get_queryset(self):
        qs = Holiday.objects.all()
        year = self.request.query_params.get('year')
        if year:
            qs = qs.filter(year=year)
        return qs

    def perform_create(self, serializer):
        h = serializer.save(is_system=False)
        log_action(self.request.user, f'เพิ่มวันหยุด {h.name}', 'Holiday', h.id, request=self.request)

    def perform_destroy(self, instance):
        if instance.is_system:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('ไม่สามารถลบวันหยุดราชการที่ระบบสร้างให้ได้')
        log_action(self.request.user, f'ลบวันหยุด {instance.name}', 'Holiday', instance.id, request=self.request)
        instance.delete()


# ─── System Settings ─────────────────────────────────────────────────────────

@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def settings_view(request):
    obj, _ = SystemSettings.objects.get_or_create(pk=1)
    if request.method == 'GET':
        return Response(SystemSettingsSerializer(obj).data)
    serializer = SystemSettingsSerializer(obj, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save(updated_by=request.user)
        log_action(request.user, 'อัปเดตตั้งค่าระบบ', request=request)
        return Response(serializer.data)
    return Response(serializer.errors, status=400)


# ─── Admin: fix user departments ──────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_tu_api(request):
    """ทดสอบการเชื่อมต่อ TU API ด้วย emp_id ที่ระบุ"""
    if request.user.role != 'admin':
        return Response({'error': 'Permission denied'}, status=403)
    emp_id = request.data.get('emp_id', '0001')
    from .tu_api_service import fetch_employee, clear_cache
    clear_cache()
    result = fetch_employee(str(emp_id))
    if result:
        return Response(result)
    return Response({'error': f'ไม่พบข้อมูลพนักงาน {emp_id} หรือเชื่อมต่อ TU API ไม่ได้'}, status=404)


@api_view(['POST'])
@permission_classes([AllowAny])
def test_tu_auth(request):
    """
    Debug endpoint: ทดสอบ TU Auth API โดยตรง
    POST { "username": "...", "password": "..." }
    คืน raw response จาก TU API (สำหรับ debug เท่านั้น)
    """
    import urllib.request, urllib.error, json as _json
    from .models import SystemSettings

    username = request.data.get('username', '').strip()
    password = request.data.get('password', '').strip()
    if not username or not password:
        return Response({'error': 'กรุณาส่ง username และ password'}, status=400)

    s = SystemSettings.objects.first()
    if not s or not s.tu_api_key:
        return Response({'error': 'ยังไม่ได้ตั้งค่า TU API Key'}, status=400)

    url = 'https://restapi.tu.ac.th/api/v1/auth/Ad/verify'
    body = _json.dumps({'UserName': username, 'PassWord': password}).encode()
    headers = {'Content-Type': 'application/json', 'Application-Key': s.tu_api_key}

    try:
        req = urllib.request.Request(url, data=body, headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = _json.loads(resp.read().decode())
        return Response({'tu_response': raw, 'api_key_prefix': s.tu_api_key[:10] + '...'})
    except urllib.error.HTTPError as e:
        body_text = e.read().decode() if hasattr(e, 'read') else ''
        return Response({'error': f'HTTP {e.code}', 'detail': body_text}, status=500)
    except Exception as e:
        return Response({'error': str(e)}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def fix_user_departments(request):
    """Admin assigns all users with department=None to a given department."""
    if request.user.role not in ('admin', 'depthead'):
        return Response({'error': 'Permission denied'}, status=403)
    dept_id = request.data.get('department_id')
    if not dept_id:
        return Response({'error': 'department_id required'}, status=400)
    try:
        from .models import Department
        dept = Department.objects.get(id=int(dept_id))
    except (Department.DoesNotExist, ValueError):
        return Response({'error': 'ไม่พบแผนก'}, status=404)
    updated = User.objects.filter(department__isnull=True, role='staff').update(department=dept)
    return Response({'updated': updated, 'department': dept.name})


# ─── Staff Roster Import ──────────────────────────────────────────────────────

HONORIFICS = [
    'รองศาสตราจารย์ ดร.', 'ผู้ช่วยศาสตราจารย์ ดร.', 'รองศาสตราจารย์',
    'ศาสตราจารย์ ดร.', 'ศาสตราจารย์', 'ว่าที่ ร.ต.', 'ว่าที่ร.ต.',
    'อาจารย์ ดร.', 'อาจารย์', 'นางสาว', 'นาง', 'นาย', 'ดร.',
]

def _strip_honorific(name: str):
    for h in sorted(HONORIFICS, key=len, reverse=True):
        if name.startswith(h):
            name = name[len(h):].strip()
            break
    parts = name.split()
    return (parts[0] if parts else name), (' '.join(parts[1:]) if len(parts) > 1 else '')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_staff_roster(request):
    """
    Admin อัปโหลด Excel รายชื่อบุคลากร → สร้าง User accounts
    รูปแบบไฟล์: col A=ลำดับ, col B=ชื่อ-สกุล, col C=ตำแหน่ง
    แถว section header = col A ว่าง + col B = ชื่องาน
    """
    if request.user.role != 'admin':
        return Response({'error': 'Permission denied'}, status=403)
    if 'file' not in request.FILES:
        return Response({'error': 'กรุณาแนบไฟล์ Excel'}, status=400)

    default_password = request.data.get('password', 'tustaff2025')
    default_role     = request.data.get('role', 'staff')

    try:
        wb = openpyxl.load_workbook(request.FILES['file'])
    except Exception as e:
        return Response({'error': f'อ่านไฟล์ไม่ได้: {e}'}, status=400)

    ws = wb.active
    created, skipped, errors = [], [], []
    current_dept = None

    for row in ws.iter_rows(values_only=True):
        seq, name_raw, position = (row + (None, None, None))[:3]
        if not name_raw:
            continue
        name_raw = str(name_raw).strip()
        if name_raw in ('ชื่อ-สกุล',) or 'รายชื่อบุคลากร' in name_raw:
            continue

        # section header
        if seq is None:
            existing = Department.objects.filter(name=name_raw).first()
            if existing:
                current_dept = existing
            else:
                import time as _time
                base_code = name_raw[:15].upper().replace(' ', '_')
                code = base_code
                if Department.objects.filter(code=code).exists():
                    code = f'{base_code[:10]}_{int(_time.time()) % 10000}'
                current_dept = Department.objects.create(name=name_raw, code=code)
            continue

        # employee row
        first, last = _strip_honorific(name_raw)
        import re as _re
        clean = _re.sub(r'[^฀-๿a-zA-Z0-9]', '', first)
        username = f'{clean}_{seq}'

        if User.objects.filter(username=username).exists():
            skipped.append({'username': username, 'name': f'{first} {last}'})
            continue

        try:
            u = User(
                username=username,
                first_name=first,
                last_name=last,
                email='',
                role=default_role,
                department=current_dept,
                is_active=True,
            )
            u.set_password(default_password)
            u.save()
            created.append({
                'username': username,
                'name': f'{first} {last}',
                'department': current_dept.name if current_dept else '',
                'position': str(position or '').strip(),
            })
        except Exception as e:
            errors.append({'name': name_raw, 'error': str(e)})

    log_action(request.user, f'import staff roster: สร้าง {len(created)} บัญชี', request=request)
    return Response({
        'created': len(created),
        'skipped': len(skipped),
        'errors':  len(errors),
        'users':   created,
        'default_password': default_password,
    })


# ─── Time Log Import ──────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_timelog(request):
    if 'file' not in request.FILES:
        return Response({'error': 'กรุณาแนบไฟล์ Excel'}, status=400)

    f = request.FILES['file']

    # รับ department_id จาก form (ถ้ามี) เพื่อ assign ให้ user ที่สร้างใหม่
    import_dept = None
    dept_id_param = request.data.get('department_id') or request.data.get('department')
    if dept_id_param:
        try:
            from .models import Department
            import_dept = Department.objects.get(id=int(dept_id_param))
        except (Department.DoesNotExist, ValueError, TypeError):
            pass
    # fallback: ใช้แผนกของ admin ที่ import (ถ้ามี)
    if import_dept is None and request.user.department:
        import_dept = request.user.department

    history = ImportHistory.objects.create(
        filename=f.name, imported_by=request.user, status='partial'
    )

    # ── helpers ──────────────────────────────────────────────
    def fmt_time(t):
        if t is None:
            return ''
        if hasattr(t, 'strftime'):
            try:
                return t.strftime('%H:%M')
            except Exception:
                return ''
        s = str(t).strip()
        # If it looks like a datetime string "2026-03-01 08:30:00", extract time
        if len(s) > 10 and ' ' in s:
            s = s.split(' ')[1]
        return s[:5] if len(s) >= 5 else s

    def fmt_date(d):
        if d is None:
            return ''
        if hasattr(d, 'strftime'):
            try:
                return d.strftime('%Y-%m-%d')
            except Exception:
                return str(d)
        return str(d).strip()[:10]

    def calc_ot(in_str, out_str):
        try:
            ih, im = map(int, in_str.replace('.', ':').split(':')[:2])
            oh, om = map(int, out_str.replace('.', ':').split(':')[:2])
            ot_mins = max(0, (oh * 60 + om) - 17 * 60)
            return round(ot_mins / 60, 2)
        except Exception:
            return 0.0

    def looks_like_id(val):
        """Return True if val looks like an employee ID (numeric or EMP-xxx format)."""
        if val is None:
            return False
        s = str(val).strip()
        if not s:
            return False
        # pure numeric (0004, 1024, etc.)
        if s.isdigit():
            return True
        # EMP-xxx, AD-xxx, CHK-xxx, etc.
        if re.match(r'^[A-Z]{2,4}-\d+$', s):
            return True
        return False

    # ── auto-detect column layout from header row ─────────────
    try:
        wb = openpyxl.load_workbook(f, data_only=True)
        ws = wb.active

        # Keyword maps for column detection
        ID_KEYS     = {'id', 'รหัส', 'emp id', 'employee id', 'รหัสพนักงาน', 'no', 'no.', 'เลขที่'}
        NAME_KEYS   = {'name', 'ชื่อ', 'ชื่อ-สกุล', 'ชื่อพนักงาน', 'ชื่อ สกุล'}
        DATE_KEYS   = {'date', 'วันที่', 'วัน/เดือน/ปี'}
        IN_KEYS     = {'in', 'check in', 'เข้า', 'เวลาเข้า', 'check-in', 'time in', 'in time'}
        OUT_KEYS    = {'out', 'check out', 'ออก', 'เวลาออก', 'check-out', 'time out', 'out time'}
        STATUS_KEYS = {'attendance status', 'status', 'สถานะ', 'attendance', 'หมายเหตุ', 'note', 'remark'}

        col_id = col_name = col_date = col_in = col_out = col_status = None
        data_start_row = 2  # default: start from row 2

        all_rows = list(ws.iter_rows(min_row=1, max_row=15, values_only=True))
        for row_idx, row in enumerate(all_rows):
            clean = [str(v).strip().lower() if v is not None else '' for v in row]
            # Check if this row looks like a header row
            matches = 0
            tmp_id = tmp_name = tmp_date = tmp_in = tmp_out = tmp_status = None
            for ci, cell in enumerate(clean):
                if cell in ID_KEYS and tmp_id is None:
                    tmp_id = ci; matches += 1
                elif cell in NAME_KEYS and tmp_name is None:
                    tmp_name = ci; matches += 1
                elif cell in DATE_KEYS and tmp_date is None:
                    tmp_date = ci; matches += 1
                elif cell in IN_KEYS and tmp_in is None:
                    tmp_in = ci; matches += 1
                elif cell in OUT_KEYS and tmp_out is None:
                    tmp_out = ci; matches += 1
                elif cell in STATUS_KEYS and tmp_status is None:
                    tmp_status = ci
            if matches >= 2:
                col_id     = tmp_id
                col_name   = tmp_name
                col_date   = tmp_date
                col_in     = tmp_in
                col_out    = tmp_out
                col_status = tmp_status
                data_start_row = row_idx + 2  # next row (1-indexed)
                break

        # Fallback: guess by position if auto-detect failed
        # Try to sniff from first data-like row
        if col_id is None:
            for row in ws.iter_rows(min_row=data_start_row, max_row=data_start_row + 5, values_only=True):
                if not any(row):
                    continue
                # Try col0=id or col1=id
                if looks_like_id(row[0]):
                    col_id = 0
                    # guess: id, name, date, weekday, in, out, overtime, status
                    col_name = None; col_date = 2; col_in = 4; col_out = 5; col_status = 7
                elif len(row) > 1 and looks_like_id(row[1]):
                    col_id = 1
                    col_name = 0; col_date = 2; col_in = 4; col_out = 5; col_status = 7
                break
            if col_id is None:
                col_id = 0; col_name = None; col_date = 2; col_in = 4; col_out = 5; col_status = 7

        total = success = errors = 0
        error_lines = []
        rows_out = []
        row_id = 1

        for row in ws.iter_rows(min_row=data_start_row, values_only=True):
            if not any(row):
                continue

            def gcol(idx):
                return row[idx] if idx is not None and len(row) > idx else None

            emp_id      = gcol(col_id)
            excel_name  = gcol(col_name)
            date_val    = gcol(col_date)
            check_in    = gcol(col_in)
            check_out   = gcol(col_out)
            att_status  = str(gcol(col_status) or '').strip()

            # Skip rows where emp_id looks like a header or is empty
            if not looks_like_id(emp_id):
                continue

            date_str  = fmt_date(date_val)
            in_str    = fmt_time(check_in)
            out_str   = fmt_time(check_out)
            ot_val    = calc_ot(in_str, out_str) if (in_str and out_str) else 0.0
            flag      = not in_str or not out_str or ot_val > 8

            total += 1

            # ดึงข้อมูลจาก TU API (ถ้าเปิดใช้งาน) หรือใช้จาก Excel
            from .tu_api_service import fetch_employee, get_or_create_dept
            tu_data = fetch_employee(str(emp_id))  # คืน dict หรือ None

            if tu_data:
                # ใช้ข้อมูลจาก TU API (น่าเชื่อถือกว่า)
                first = tu_data['first_name']
                last  = tu_data['last_name']
                # dept จาก TU API มีความสำคัญกว่า import_dept ที่ admin เลือก
                resolved_dept = get_or_create_dept(tu_data['dept_name'], tu_data['dept_code']) or import_dept
            else:
                # fallback: ใช้ชื่อจาก Excel
                raw_name = str(excel_name).strip() if excel_name else ''
                parts = raw_name.split() if raw_name else []
                first = parts[0] if parts else str(emp_id)
                last  = ' '.join(parts[1:]) if len(parts) > 1 else ''
                resolved_dept = import_dept

            # Try to match user in DB — auto-create if not found
            try:
                user = User.objects.get(employee_id=str(emp_id))
                # อัปเดตข้อมูลที่อาจเปลี่ยนแปลง (ชื่อ/แผนก)
                changed = False
                if tu_data and user.first_name != first:
                    user.first_name = first; changed = True
                if tu_data and user.last_name != last:
                    user.last_name = last;  changed = True
                if user.department is None and resolved_dept:
                    user.department = resolved_dept; changed = True
                if tu_data and tu_data.get('email') and not user.email:
                    user.email = tu_data['email']; changed = True
                if changed:
                    user.save()
            except User.DoesNotExist:
                user = User.objects.create(
                    username=str(emp_id),
                    employee_id=str(emp_id),
                    first_name=first,
                    last_name=last,
                    email=tu_data['email'] if tu_data else '',
                    role='staff',
                    department=resolved_dept,
                    is_active=True,
                )
                user.set_password(str(emp_id))  # password เริ่มต้น = รหัสพนักงาน
                user.save()

            success += 1
            db_name   = (f'{user.first_name} {user.last_name}'.strip()) or user.username
            dept_name = (user.department.name if getattr(user, 'department', None) else None) or 'ไม่ระบุ'
            try:
                TimeLog.objects.update_or_create(
                    user=user, log_date=date_val or date_str,
                    defaults={'check_in': check_in, 'check_out': check_out, 'source_file': f.name}
                )
            except Exception as e:
                error_lines.append(f'แถว {total}: บันทึก timelog ไม่ได้ — {e}')

            rows_out.append({
                'id': row_id, 'date': date_str,
                'empId': str(emp_id), 'name': db_name,
                'dept': dept_name, 'in': in_str, 'out': out_str,
                'ot': str(ot_val), 'flag': flag,
                'attendanceStatus': att_status,
            })
            row_id += 1

        history.total_rows = total
        history.success_rows = success
        history.error_rows = errors
        history.error_detail = '\n'.join(error_lines[:50])
        history.status = 'success' if errors == 0 else ('failed' if success == 0 else 'partial')
        history.rows_data = rows_out  # persist all rows regardless of user match
        history.save()

        from .tu_api_service import clear_cache
        clear_cache()

        log_action(request.user, f'นำเข้าไฟล์ {f.name} ({success}/{total} รายการ)', request=request)
        resp = dict(ImportHistorySerializer(history).data)
        resp['rows'] = rows_out
        return Response(resp)

    except Exception as e:
        from .tu_api_service import clear_cache
        clear_cache()
        history.status = 'failed'
        history.error_detail = str(e)
        history.save()
        return Response({'error': str(e)}, status=400)


# ─── Import History & Audit Log ───────────────────────────────────────────────

class ImportHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ImportHistorySerializer
    queryset = ImportHistory.objects.all().order_by('-imported_at')


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.all().order_by('-created_at')


# ─── Timelog & Dashboard API ──────────────────────────────────────────────────

def _thai_to_greg(month_str):
    """Convert "2569-03" (Thai year) to (2026, 3)."""
    try:
        thai_year, mon = month_str.split('-')
        return int(thai_year) - 543, int(mon)
    except Exception:
        return None, None


def _calc_ot(check_in, check_out):
    """Return OT hours (float) from time fields."""
    try:
        ih = check_in.hour;  im = check_in.minute
        oh = check_out.hour; om = check_out.minute
        return max(0.0, round(((oh * 60 + om) - 17 * 60) / 60, 2))
    except Exception:
        return 0.0


def _row_from_timelog(idx, tl):
    in_str  = tl.check_in.strftime('%H:%M')  if tl.check_in  else ''
    out_str = tl.check_out.strftime('%H:%M') if tl.check_out else ''
    ot_val  = _calc_ot(tl.check_in, tl.check_out) if (tl.check_in and tl.check_out) else 0.0
    flag    = not in_str or not out_str or ot_val > 8
    return {
        'id':    idx,
        'date':  str(tl.log_date),
        'empId': tl.user.employee_id or '',
        'name':  tl.user.get_full_name() or tl.user.username,
        'dept':  tl.user.department.name if tl.user.department else 'ไม่ระบุ',
        'in':    in_str,
        'out':   out_str,
        'ot':    str(ot_val),
        'flag':  flag,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def timelog_list_view(request):
    """Admin: list all timelogs for a given Thai-calendar month.
    Falls back to ImportHistory.rows_data if no TimeLog rows saved (unmatched users).
    """
    month_param = request.query_params.get('month', '')
    greg_year, mon = _thai_to_greg(month_param)

    qs = TimeLog.objects.select_related('user', 'user__department')
    if greg_year and mon:
        qs = qs.filter(log_date__year=greg_year, log_date__month=mon)
    qs = qs.order_by('log_date', 'user__employee_id')

    rows = [_row_from_timelog(i + 1, tl) for i, tl in enumerate(qs)]

    # Fallback: if no TimeLog rows but ImportHistory has raw data for this month
    if not rows and greg_year and mon:
        from datetime import date as _date
        import calendar
        last_day = calendar.monthrange(greg_year, mon)[1]
        month_start = _date(greg_year, mon, 1)
        month_end   = _date(greg_year, mon, last_day)
        hist = (ImportHistory.objects
                .filter(rows_data__isnull=False, imported_at__date__gte=month_start - __import__('datetime').timedelta(days=400))
                .order_by('-imported_at')
                .first())
        # Find the import whose first row date matches the month
        if hist and hist.rows_data:
            sample_date = (hist.rows_data[0].get('date', '') or '')[:7]  # 'YYYY-MM'
            if sample_date == f'{greg_year}-{mon:02d}':
                rows = hist.rows_data

    return Response({'rows': rows, 'total': len(rows)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def timelog_my_view(request):
    """Staff: list own timelogs for a given Thai-calendar month.
    Falls back to ImportHistory.rows_data filtered by employee_id."""
    month_param = request.query_params.get('month', '')
    greg_year, mon = _thai_to_greg(month_param)

    qs = TimeLog.objects.filter(user=request.user).select_related('user', 'user__department')
    if greg_year and mon:
        qs = qs.filter(log_date__year=greg_year, log_date__month=mon)
    qs = qs.order_by('log_date')

    rows = [_row_from_timelog(i + 1, tl) for i, tl in enumerate(qs)]

    # Fallback: use ImportHistory rows filtered by employee_id
    if not rows and greg_year and mon:
        emp_id = request.user.employee_id or request.user.username
        hist = (ImportHistory.objects
                .filter(rows_data__isnull=False)
                .order_by('-imported_at').first())
        if hist and hist.rows_data:
            month_prefix = f'{greg_year}-{mon:02d}'
            my_rows = [r for r in hist.rows_data
                       if str(r.get('empId', '')) == str(emp_id)
                       and str(r.get('date', '')).startswith(month_prefix)]
            if my_rows:
                rows = my_rows

    total_ot = sum(float(r.get('ot', 0)) for r in rows)
    flag_count = sum(1 for r in rows if r.get('flag'))
    # Calculate total OT baht using correct TU rates: weekday 60, holiday 70
    import datetime as _dt
    def is_weekend(d):
        return d.weekday() >= 5  # Saturday=5, Sunday=6
    total_ot_baht = 0.0
    for tl in qs:
        ot_val = _calc_ot(tl.check_in, tl.check_out) if (tl.check_in and tl.check_out) else 0.0
        rate = 70 if is_weekend(tl.log_date) else 60
        total_ot_baht += ot_val * rate
    return Response({
        'rows': rows,
        'total': len(rows),
        'total_ot': round(total_ot, 2),
        'total_ot_baht': round(total_ot_baht, 2),
        'flag_count': flag_count,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def seed_holidays_view(request):
    """รับ holiday data จาก frontend แล้ว upsert ลง DB
    Body: { year: 2569, holidays: [{date, name, holiday_type?, is_system?}, ...] }
    """
    import datetime as _dt

    thai_year = request.data.get('year')
    holidays_data = request.data.get('holidays', [])

    if not thai_year:
        return Response({'error': 'กรุณาระบุปี พ.ศ.'}, status=400)
    if not isinstance(holidays_data, list) or len(holidays_data) == 0:
        return Response({'error': 'ไม่มีข้อมูลวันหยุด'}, status=400)
    try:
        thai_year = int(thai_year)
    except (ValueError, TypeError):
        return Response({'error': 'ปีไม่ถูกต้อง'}, status=400)

    created_count = 0
    updated_count = 0
    for h in holidays_data:
        try:
            date_obj = _dt.date.fromisoformat(h['date'])
        except (ValueError, KeyError):
            continue
        name = (h.get('localName') or h.get('name', '')).strip()
        holiday_type = h.get('holiday_type', 'official')
        obj, was_created = Holiday.objects.get_or_create(
            date=date_obj,
            defaults={
                'name':         name,
                'holiday_type': holiday_type,
                'year':         thai_year,
                'is_system':    True,
            }
        )
        if was_created:
            created_count += 1
        elif obj.is_system and obj.name != name:
            obj.name = name
            obj.save(update_fields=['name'])
            updated_count += 1

    log_action(request.user, f'sync วันหยุดราชการ พ.ศ. {thai_year} ({created_count} ใหม่)', 'Holiday', None, request=request)
    return Response({
        'year':    thai_year,
        'created': created_count,
        'updated': updated_count,
        'message': f'ซิงค์วันหยุด {len(holidays_data)} รายการ (ใหม่ {created_count}, อัปเดต {updated_count})',
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_summary_view(request):
    """Admin dashboard KPIs."""
    from datetime import date as _date
    today = _date.today()

    total_users   = User.objects.filter(is_active=True).exclude(role='admin').count()
    latest_import = ImportHistory.objects.order_by('-imported_at').first()
    ot_count      = OTRequest.objects.filter(
        created_at__year=today.year, created_at__month=today.month
    ).count()

    # Available imported months — from TimeLog first, then fall back to ImportHistory.rows_data
    from django.db.models.functions import TruncMonth
    months = (TimeLog.objects
              .annotate(ym=TruncMonth('log_date'))
              .values_list('ym', flat=True)
              .distinct()
              .order_by('-ym'))
    thai_months = []
    for m in months:
        if m:
            thai_months.append(f'{m.year + 543}-{m.month:02d}')

    # If no TimeLogs, derive months from ImportHistory raw data
    if not thai_months:
        for hist in ImportHistory.objects.filter(rows_data__isnull=False).order_by('-imported_at'):
            if hist.rows_data:
                sample_date = (hist.rows_data[0].get('date', '') or '')
                if len(sample_date) >= 7:
                    y_str, m_str = sample_date[:4], sample_date[5:7]
                    tag = f'{int(y_str) + 543}-{m_str}'
                    if tag not in thai_months:
                        thai_months.append(tag)

    # Department user distribution
    from django.db.models import Count as _Count
    dept_dist = list(
        User.objects
        .filter(is_active=True, department__isnull=False)
        .exclude(role='admin')
        .values('department__id', 'department__name')
        .annotate(count=_Count('id'))
        .order_by('-count')
    )

    return Response({
        'total_users':    total_users,
        'ot_requests':    ot_count,
        'system_status':  'ปกติ',
        'imported_months': thai_months,
        'dept_distribution': [
            {'id': d['department__id'], 'name': d['department__name'], 'count': d['count']}
            for d in dept_dist
        ],
        'latest_import': {
            'date':     latest_import.imported_at.strftime('%d/%m/%Y %H:%M') if latest_import else None,
            'by':       latest_import.imported_by.get_full_name()            if latest_import else None,
            'filename': latest_import.filename                               if latest_import else None,
            'total':    latest_import.total_rows                             if latest_import else 0,
        } if latest_import else None,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def staff_summary_view(request):
    """Staff dashboard KPIs: their OT totals & request statuses."""
    month_param = request.query_params.get('month', '')
    greg_year, mon = _thai_to_greg(month_param)

    tl_qs = TimeLog.objects.filter(user=request.user)
    if greg_year and mon:
        tl_qs = tl_qs.filter(log_date__year=greg_year, log_date__month=mon)

    total_ot = 0.0
    for tl in tl_qs:
        total_ot += _calc_ot(tl.check_in, tl.check_out) if (tl.check_in and tl.check_out) else 0.0

    # Fallback: use ImportHistory rows_data if no TimeLog entries
    if tl_qs.count() == 0 and greg_year and mon:
        emp_id = request.user.employee_id or request.user.username
        hist = ImportHistory.objects.filter(rows_data__isnull=False).order_by('-imported_at').first()
        if hist and hist.rows_data:
            month_prefix = f'{greg_year}-{mon:02d}'
            my_rows = [r for r in hist.rows_data
                       if str(r.get('empId', '')) == str(emp_id)
                       and str(r.get('date', '')).startswith(month_prefix)]
            total_ot = sum(float(r.get('ot', 0)) for r in my_rows)

    ot_qs = OTRequest.objects.filter(staff=request.user)
    if greg_year and mon:
        ot_qs = ot_qs.filter(work_date__year=greg_year, work_date__month=mon)

    status_counts = {}
    for r in ot_qs.values('status'):
        status_counts[r['status']] = status_counts.get(r['status'], 0) + 1

    total_ot_baht = sum(float(r.amount) for r in ot_qs)
    rejected = ['head_rejected', 'checker_rejected']
    approved = ['checker_approved', 'completed']
    pending  = ['submitted', 'head_approved', 'rep_forwarded']

    return Response({
        'total_ot_hours': round(total_ot, 2),
        'total_ot_baht':  round(total_ot_baht, 2),
        'timelog_days':   tl_qs.count(),
        'ot_total':       ot_qs.count(),
        'ot_submitted':   ot_qs.filter(status__in=pending).count(),
        'ot_approved':    ot_qs.filter(status__in=approved).count(),
        'ot_rejected':    ot_qs.filter(status__in=rejected).count(),
        'ot_draft':       status_counts.get('draft', 0),
    })


# ─── Bulk Forward (deptrep → checker) ───────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_forward_view(request):
    """POST /api/ot-requests/bulk-forward/
    deptrep ส่งต่อหลายคำร้องพร้อมกัน + ส่งอีเมลสรุปให้ checker ทุกคน
    body: { ids: [1,2,3], note: "..." }
    response: { forwarded: N, notified_emails: [...] }
    """
    effective_role = get_effective_role(request.user, request)
    if effective_role != 'deptrep':
        return Response({'error': 'สิทธิ์ไม่เพียงพอ'}, status=status.HTTP_403_FORBIDDEN)

    ids  = request.data.get('ids', [])
    note = request.data.get('note', '')

    if not ids:
        return Response({'error': 'ไม่มีรายการที่เลือก'}, status=status.HTTP_400_BAD_REQUEST)

    forwarded_list = []
    for ot_id in ids:
        try:
            ot = OTRequest.objects.get(id=ot_id, status='head_approved')
            ot.status           = 'rep_forwarded'
            ot.rep_forwarded_by = request.user
            ot.rep_forwarded_at = timezone.now()
            ot.rep_note         = note
            ot.save()
            log_action(request.user, f'ส่งต่อคำร้อง OT #{ot.id}',
                       'OTRequest', ot.id, request=request)
            forwarded_list.append(ot)
        except OTRequest.DoesNotExist:
            pass

    # ส่งอีเมลแจ้ง checker (fail-silent)
    notified_emails = []
    if forwarded_list:
        checkers = User.objects.filter(role='checker', is_active=True)
        notified_emails = [u.notify_email or u.email for u in checkers if (u.notify_email or u.email)]
        _send_checker_notification(forwarded_list, note, request.user)

    return Response({'forwarded': len(forwarded_list), 'notified_emails': notified_emails})


# ─── OT Deadline views ────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def deadline_list_view(request):
    """GET /api/ot-deadline/
    ดึงรายการ deadline ทั้งหมด (admin) หรือ deadline ของเดือนปัจจุบัน (staff)
    query params:
      ?month=2569-06   → ดึงเฉพาะเดือนนั้น
      ?all=1           → ดึงทั้งหมด (admin only)
    """
    import datetime as _dt
    month_param = request.query_params.get('month', '')
    get_all = request.query_params.get('all', '') == '1'

    qs = OTDeadline.objects.all()
    if month_param:
        qs = qs.filter(thai_month=month_param)
    elif not get_all:
        # Default: return only current + next 2 months
        today = _dt.date.today()
        thai_year = today.year + 543
        months = []
        for delta in range(3):
            m = today.month + delta
            y = thai_year
            if m > 12:
                m -= 12
                y += 1
            months.append(f'{y}-{m:02d}')
        qs = qs.filter(thai_month__in=months)

    data = [
        {
            'id':            d.id,
            'thai_month':    d.thai_month,
            'deadline_date': d.deadline_date.isoformat(),
            'note':          d.note,
            'is_passed':     d.deadline_date < _dt.date.today(),
        }
        for d in qs
    ]
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def deadline_upsert_view(request):
    """POST /api/ot-deadline/
    สร้างหรืออัปเดต deadline สำหรับเดือนที่ระบุ (admin only)
    Body: { thai_month: '2569-06', deadline_date: '2026-06-10', note?: '...' }
    """
    import datetime as _dt
    if request.user.role != 'admin':
        return Response({'error': 'ไม่มีสิทธิ์'}, status=403)

    thai_month    = request.data.get('thai_month', '').strip()
    deadline_date = request.data.get('deadline_date', '').strip()
    note          = request.data.get('note', '').strip()

    if not thai_month or not deadline_date:
        return Response({'error': 'กรุณาระบุ thai_month และ deadline_date'}, status=400)

    import re as _re
    if not _re.match(r'^\d{4}-\d{2}$', thai_month):
        return Response({'error': 'รูปแบบ thai_month ต้องเป็น YYYY-MM เช่น 2569-06'}, status=400)

    try:
        date_obj = _dt.date.fromisoformat(deadline_date)
    except ValueError:
        return Response({'error': 'รูปแบบ deadline_date ไม่ถูกต้อง (YYYY-MM-DD)'}, status=400)

    obj, created = OTDeadline.objects.update_or_create(
        thai_month=thai_month,
        defaults={
            'deadline_date': date_obj,
            'note':          note,
            'created_by':    request.user,
        }
    )
    log_action(request.user, 'SET_DEADLINE', 'OTDeadline', str(obj.id),
               f'{thai_month} → {deadline_date}', request)
    return Response({
        'id':            obj.id,
        'thai_month':    obj.thai_month,
        'deadline_date': obj.deadline_date.isoformat(),
        'note':          obj.note,
        'created':       created,
        'message':       f'{"ตั้ง" if created else "อัปเดต"}วันปิดรับ {thai_month} → {deadline_date} เรียบร้อย',
    })


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def deadline_delete_view(request, pk):
    """DELETE /api/ot-deadline/<pk>/"""
    if request.user.role != 'admin':
        return Response({'error': 'ไม่มีสิทธิ์'}, status=403)
    try:
        obj = OTDeadline.objects.get(pk=pk)
    except OTDeadline.DoesNotExist:
        return Response({'error': 'ไม่พบรายการ'}, status=404)
    thai_month = obj.thai_month
    obj.delete()
    log_action(request.user, 'DELETE_DEADLINE', 'OTDeadline', str(pk), thai_month, request)
    return Response({'message': f'ลบกำหนดวันปิดรับ {thai_month} เรียบร้อย'})


def _check_ot_deadline(thai_month: str) -> 'str | None':
    """ตรวจว่าเดือน thai_month เลย deadline หรือยัง
    Return error message ถ้าเลย, None ถ้าไม่เลยหรือยังไม่ได้ตั้ง deadline
    """
    import datetime as _dt
    try:
        d = OTDeadline.objects.get(thai_month=thai_month)
        if _dt.date.today() > d.deadline_date:
            return f'เลยกำหนดยื่นคำร้องโอทีเดือน {thai_month} แล้ว (ปิดรับวันที่ {d.deadline_date.strftime("%d/%m/%Y")})'
    except OTDeadline.DoesNotExist:
        pass
    return None

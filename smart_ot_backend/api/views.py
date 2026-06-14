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
    SystemSettings, TimeLog, ImportHistory, AuditLog, OTDeadline, Notification
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


def send_notification(recipient, message, notif_type, ot_request=None, send_email=False):
    """
    สร้าง Notification record + push real-time ผ่าน WebSocket + ส่งอีเมล (ถ้า send_email=True)
    Fail-silent: ถ้า WebSocket หรือ email ล้มเหลวก็ยังบันทึก Notification ไว้ใน DB
    """
    try:
        notif = Notification.objects.create(
            recipient=recipient,
            message=message,
            notif_type=notif_type,
            ot_request=ot_request,
        )

        # ─── WebSocket push ───────────────────────────────────────────────────
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f'user_{recipient.id}',
                    {
                        'type': 'notification.send',
                        'data': {
                            'id':               notif.id,
                            'message':          message,
                            'notif_type':       notif_type,
                            'ot_request':       ot_request.id if ot_request else None,
                            'ot_request_date':  str(ot_request.work_date) if ot_request else None,
                            'is_read':          False,
                            'created_at':       notif.created_at.isoformat(),
                        },
                    }
                )
        except Exception as ws_err:
            import logging
            logging.getLogger(__name__).debug(f'send_notification ws error: {ws_err}')

        # ─── Email (HTML) ─────────────────────────────────────────────────────
        if send_email:
            try:
                from django.core.mail import EmailMultiAlternatives
                from django.conf import settings as djsettings
                email = recipient.notify_email or recipient.email
                if email:
                    work_date_str = str(ot_request.work_date) if ot_request else ''
                    ot_hours_str  = str(int(float(ot_request.ot_hours))) if ot_request else ''
                    amount_str    = f'{float(ot_request.amount):,.0f}' if ot_request else ''
                    plain_body = (
                        f'เรียน {recipient.get_full_name()}\n\n'
                        f'{message}\n\n'
                        f'กรุณาเข้าสู่ระบบ SMART OT เพื่อดำเนินการ'
                    )
                    html_body = f'''<!DOCTYPE html>
<html lang="th">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:Sarabun,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#F5F5F5">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:#B8001F;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">🏛 SMART OT</h1>
          <p style="margin:4px 0 0;color:#ffc9c9;font-size:13px;">ระบบบริหารจัดการ OT มหาวิทยาลัยธรรมศาสตร์</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;color:#444;font-size:15px;">เรียน <strong>{recipient.get_full_name()}</strong></p>
          <div style="background:#FFF3F3;border-left:4px solid #B8001F;padding:16px;border-radius:4px;margin:16px 0;">
            <p style="margin:0;color:#B8001F;font-size:15px;font-weight:600;">{message}</p>
          </div>
          {f"""<table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #E0E0E0;border-radius:8px;font-size:13px;color:#555;">
            <tr style="background:#FAFAFA;">
              <td><strong>วันที่ทำ OT</strong></td><td>{work_date_str}</td>
              <td><strong>จำนวนชั่วโมง</strong></td><td>{ot_hours_str} ชม.</td>
            </tr>
            <tr><td><strong>ค่าตอบแทน</strong></td><td>{amount_str} บาท</td><td></td><td></td></tr>
          </table>""" if ot_request else ""}
          <p style="margin:24px 0 0;color:#666;font-size:13px;">กรุณาเข้าสู่ระบบ SMART OT เพื่อดำเนินการ</p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#F5F5F5;padding:16px 32px;border-top:1px solid #E0E0E0;">
          <p style="margin:0;font-size:11px;color:#999;">อีเมลนี้ส่งโดยอัตโนมัติจากระบบ SMART OT · กรุณาอย่าตอบกลับ</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>'''
                    msg = EmailMultiAlternatives(
                        f'[SMART OT] {message}',
                        plain_body,
                        djsettings.DEFAULT_FROM_EMAIL,
                        [email],
                    )
                    msg.attach_alternative(html_body, 'text/html')
                    msg.send(fail_silently=True)
            except Exception as mail_err:
                import logging
                logging.getLogger(__name__).debug(f'send_notification email error: {mail_err}')

    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f'send_notification: {e}')


def _send_checker_notification(ot_list, note, sender):
    """ส่งอีเมล HTML สรุปคำร้อง OT ที่ส่งต่อให้ checker ทุกคน (fail-silent)"""
    from django.core.mail import EmailMultiAlternatives
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
        dept_name    = ot_list[0].department.name if ot_list else ''
        total_amount = sum(float(ot.amount) for ot in ot_list)
        total_hours  = sum(float(ot.ot_hours) for ot in ot_list)
        subject = f'[SMART OT] คำร้อง OT {len(ot_list)} รายการ รอตรวจสอบ — {dept_name}'

        # Plain text fallback
        lines = [
            'เรียน ผู้ตรวจสอบ',
            '',
            f'ตัวแทนแผนก {dept_name} ({sender.get_full_name()}) ส่งต่อคำร้อง OT จำนวน {len(ot_list)} รายการ:',
            '',
        ]
        for ot in ot_list:
            lines.append(f'  • {ot.staff.get_full_name()} — {ot.work_date}  {int(float(ot.ot_hours))} ชม. / {float(ot.amount):,.0f} บาท')
        lines += ['', f'รวม: {int(total_hours)} ชั่วโมง  —  {total_amount:,.0f} บาท']
        if note:
            lines += ['', f'หมายเหตุจากตัวแทนแผนก: {note}']
        lines += ['', 'กรุณาเข้าสู่ระบบ SMART OT เพื่อดำเนินการ']
        plain_body = '\n'.join(lines)

        # HTML rows
        rows_html = ''
        for i, ot in enumerate(ot_list):
            bg = '#FAFAFA' if i % 2 == 0 else '#FFFFFF'
            rows_html += f'''<tr style="background:{bg};">
              <td style="padding:8px 12px;">{ot.staff.get_full_name()}</td>
              <td style="padding:8px 12px;">{ot.work_date}</td>
              <td style="padding:8px 12px;text-align:right;">{int(float(ot.ot_hours))} ชม.</td>
              <td style="padding:8px 12px;text-align:right;">{float(ot.amount):,.0f} บาท</td>
            </tr>'''
        note_html = f'<p style="margin:16px 0 0;padding:12px;background:#FFFDE7;border-left:4px solid #FFD400;font-size:13px;color:#555;">หมายเหตุ: {note}</p>' if note else ''

        html_body = f'''<!DOCTYPE html>
<html lang="th">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:Sarabun,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#F5F5F5">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#B8001F;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">🏛 SMART OT</h1>
          <p style="margin:4px 0 0;color:#ffc9c9;font-size:13px;">ระบบบริหารจัดการ OT มหาวิทยาลัยธรรมศาสตร์</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 4px;color:#333;font-size:16px;font-weight:700;">คำร้อง OT รอตรวจสอบ</p>
          <p style="margin:0 0 20px;color:#666;font-size:13px;">
            ตัวแทนแผนก <strong>{dept_name}</strong> ({sender.get_full_name()}) ส่งต่อคำร้อง OT จำนวน <strong>{len(ot_list)} รายการ</strong>
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E0E0E0;border-radius:8px;overflow:hidden;font-size:13px;">
            <tr style="background:#B8001F;color:#fff;">
              <th style="padding:10px 12px;text-align:left;">พนักงาน</th>
              <th style="padding:10px 12px;text-align:left;">วันที่</th>
              <th style="padding:10px 12px;text-align:right;">ชั่วโมง</th>
              <th style="padding:10px 12px;text-align:right;">ค่าตอบแทน</th>
            </tr>
            {rows_html}
            <tr style="background:#F5F5F5;font-weight:700;">
              <td colspan="2" style="padding:10px 12px;">รวมทั้งหมด</td>
              <td style="padding:10px 12px;text-align:right;">{int(total_hours)} ชม.</td>
              <td style="padding:10px 12px;text-align:right;">{total_amount:,.0f} บาท</td>
            </tr>
          </table>
          {note_html}
          <p style="margin:24px 0 0;color:#666;font-size:13px;">กรุณาเข้าสู่ระบบ SMART OT เพื่อดำเนินการตรวจสอบ</p>
        </td></tr>
        <tr><td style="background:#F5F5F5;padding:16px 32px;border-top:1px solid #E0E0E0;">
          <p style="margin:0;font-size:11px;color:#999;">อีเมลนี้ส่งโดยอัตโนมัติจากระบบ SMART OT · กรุณาอย่าตอบกลับ</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>'''

        msg = EmailMultiAlternatives(subject, plain_body, djsettings.DEFAULT_FROM_EMAIL, recipients)
        msg.attach_alternative(html_body, 'text/html')
        msg.send(fail_silently=True)
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

        # คำนวณ OT hours จาก start_time/end_time (authoritative — ไม่ไว้ใจค่า frontend)
        # Weekday : นับจาก 16:30  |  Holiday : นับจากเข้า-ออก หักพักเที่ยง 12:00–13:00
        start_time = serializer.validated_data.get('start_time')
        end_time   = serializer.validated_data.get('end_time')

        if start_time and end_time:
            in_mins  = start_time.hour * 60 + start_time.minute
            out_mins = end_time.hour   * 60 + end_time.minute
            if day_type == 'holiday':
                lunch   = max(0, min(out_mins, 13 * 60) - max(in_mins, 12 * 60))
                ot_mins = max(0, out_mins - in_mins - lunch)
            else:
                ot_mins = max(0, out_mins - (16 * 60 + 30))
            ot_hours_floored = int(ot_mins // 60)
        else:
            import math as _math
            ot_hours = serializer.validated_data.get('ot_hours', 0)
            ot_hours_floored = _math.floor(float(ot_hours))

        # Ceiling validation per spec Section 4.2
        max_hours = 7 if day_type == 'holiday' else 4
        if ot_hours_floored > max_hours:
            from rest_framework.exceptions import ValidationError as _VE
            raise _VE({'ot_hours': f'OT เกินกำหนดสูงสุด {max_hours} ชั่วโมง (คำนวณได้ {ot_hours_floored} ชม.)'})

        hourly_rate = 70 if day_type == 'holiday' else 60
        amount = ot_hours_floored * hourly_rate

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
            ot_hours=ot_hours_floored,
            amount=amount,
            rate_per_hour=hourly_rate,   # บันทึกอัตรา ณ เวลายื่น (60/70)
            status='submitted',
        )
        log_action(self.request.user, f'ยื่นคำร้อง OT วันที่ {ot.work_date}', 'OTRequest', ot.id, request=self.request)

        # แจ้งเตือน DeptHead ของแผนกนั้น
        depthead = User.objects.filter(role='depthead', department=dept, is_active=True).first()
        if depthead:
            send_notification(
                depthead,
                f'คำร้อง OT ใหม่จาก {ot.staff.get_full_name()} วันที่ {ot.work_date}',
                'ot_submitted',
                ot,
                send_email=True,
            )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        ot = self.get_object()
        user = request.user
        effective_role = get_effective_role(user, request)
        note = request.data.get('note', '')

        if effective_role == 'depthead' and ot.status == 'submitted':
            ot.status = 'head_approved'
            ot.head_approved_by = user
            ot.head_appro
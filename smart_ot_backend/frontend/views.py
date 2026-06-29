from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from django.db.models import Sum, Count
from api.models import OTRequest, Holiday, Department, User, AuditLog, ImportHistory, SystemSettings, Notification
import json
from django.db.models import Q, F
from django.http import HttpResponse
from collections import defaultdict
import datetime


# ─── Auth ─────────────────────────────────────────────────────────────────────

def login_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    error = None
    username_input = ''
    if request.method == 'POST':
        username_input = request.POST.get('username', '').strip()
        password = request.POST.get('password', '').strip()

        tu_username = username_input.split('@')[0] if '@' in username_input else username_input
        user = None

        # 1. TU API Auth
        from api.tu_api_service import verify_tu_credentials
        from api.views import _auto_create_user_from_tu
        tu_data = verify_tu_credentials(tu_username, password)
        if tu_data:
            user = _auto_create_user_from_tu(tu_data)
            if not user:
                error = 'ยืนยันตัวตนสำเร็จ แต่ไม่พบบัญชีในระบบ กรุณาติดต่อแอดมิน'

        # 2. Local auth fallback
        if not user and not error:
            user = authenticate(request, username=tu_username, password=password)
            if not user and '@' in username_input:
                try:
                    found = User.objects.get(email__iexact=username_input)
                    user = authenticate(request, username=found.username, password=password)
                except User.DoesNotExist:
                    pass
            if not user:
                error = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'

        if user and user.is_active:
            login(request, user)
            return redirect('dashboard')
        elif user and not user.is_active:
            error = 'บัญชีนี้ถูกระงับการใช้งาน'

    return render(request, 'login.html', {'error': error, 'username': username_input})


def logout_view(request):
    logout(request)
    return redirect('login')


def forgot_password_view(request):
    sent = False
    if request.method == 'POST':
        sent = True
    return render(request, 'forgot_password.html', {'sent': sent})


# ─── Dashboard Router ─────────────────────────────────────────────────────────

@login_required
def dashboard(request):
    role = request.user.role
    routes = {
        'admin':     'admin_dashboard',
        'staff':     'staff_dashboard',
        'depthead':  'head_dashboard',
        'deptrep':   'rep_dashboard',
        'checker':   'checker_dashboard',
        'executive': 'exec_dashboard',
    }
    return redirect(routes.get(role, 'staff_dashboard'))


# ─── Admin Views ──────────────────────────────────────────────────────────────

@login_required
def admin_dashboard(request):
    now = timezone.now()
    activities = [
        {'who': 'พี่ยุ่น',    'act': 'อนุมัติคำร้องของแผนกทะเบียน',  'time': '10 นาทีที่แล้ว', 'kind': 'success'},
        {'who': 'อรอนงค์',  'act': 'ตีกลับคำร้องพนักงาน 1 คน',     'time': '25 นาทีที่แล้ว', 'kind': 'danger'},
        {'who': 'ปนัดดา',   'act': 'ส่งออก Excel เดือน พ.ค. 2569', 'time': '1 ชม. ที่แล้ว',  'kind': 'info'},
        {'who': 'สมชาย',    'act': 'ยื่นคำร้อง OT 4 รายการ',        'time': '2 ชม. ที่แล้ว',  'kind': 'info'},
        {'who': 'พี่ขวัญ',    'act': 'นำเข้าไฟล์เวลาเดือน พ.ค.',      'time': '3 ชม. ที่แล้ว',  'kind': 'success'},
    ]
    depts = Department.objects.annotate(cnt=Count('members')).order_by('-cnt')
    dept_labels = json.dumps([d.name for d in depts])
    dept_values = json.dumps([d.cnt for d in depts])

    return render(request, 'admin/dashboard.html', {
        'today': f"{now.day} {now.strftime('%B %Y')}",
        'total_users': User.objects.filter(is_active=True).count(),
        'total_ot_this_month': OTRequest.objects.filter(work_date__year=now.year, work_date__month=now.month).count(),
        'last_import': ImportHistory.objects.order_by('-imported_at').values_list('imported_at', flat=True).first(),
        'activities': activities,
        'dept_labels': dept_labels,
        'dept_values': dept_values,
    })


@login_required
def admin_holidays(request):
    selected_year = int(request.GET.get('year', timezone.now().year))
    thai_year = selected_year + 543
    holidays = Holiday.objects.filter(year=thai_year).order_by('date')
    return render(request, 'admin/holidays.html', {
        'holidays': holidays,
        'selected_year': selected_year,
        'year_choices': range(timezone.now().year - 1, timezone.now().year + 3),
        'official_count': holidays.filter(holiday_type='official').count(),
        'compensation_count': holidays.filter(holiday_type='compensation').count(),
        'special_count': holidays.filter(holiday_type='special').count(),
    })


@login_required
def admin_holiday_add(request):
    if request.method == 'POST':
        from datetime import date as date_type
        d = request.POST.get('date')
        name = request.POST.get('name')
        htype = request.POST.get('holiday_type', 'compensation')
        date_obj = date_type.fromisoformat(d)
        thai_year = date_obj.year + 543
        Holiday.objects.get_or_create(date=date_obj, defaults={
            'name': name, 'holiday_type': htype, 'year': thai_year, 'is_system': False
        })
        messages.success(request, f'เพิ่มวันหยุด "{name}" สำเร็จ')
    return redirect('admin_holidays')


@login_required
def admin_holiday_delete(request, pk):
    h = get_object_or_404(Holiday, pk=pk)
    if h.is_system and request.user.role != 'admin':
        messages.error(request, 'เฉพาะแอดมินเท่านั้นที่สามารถลบวันหยุดราชการได้')
    else:
        h.delete()
        messages.success(request, 'ลบวันหยุดสำเร็จ')
    return redirect('admin_holidays')


@login_required
def admin_holiday_edit(request, pk):
    h = get_object_or_404(Holiday, pk=pk)
    if request.method == 'POST':
        h.name = request.POST.get('name', h.name)
        h.holiday_type = request.POST.get('holiday_type', h.holiday_type)
        h.save()
        messages.success(request, 'แก้ไขวันหยุดสำเร็จ')
        return redirect('admin_holidays')
    return render(request, 'admin/holiday_edit.html', {'h': h})


@login_required
def admin_users(request):
    users = User.objects.filter(is_active=True).select_related('department').order_by('role', 'first_name')
    depts = Department.objects.all()
    return render(request, 'admin/users.html', {'users': users, 'depts': depts})


@login_required
def admin_settings(request):
    obj, _ = SystemSettings.objects.get_or_create(pk=1)
    if request.method == 'POST':
        obj.max_ot_hours_weekday = request.POST.get('max_ot_hours_weekday', obj.max_ot_hours_weekday)
        obj.max_ot_hours_holiday = request.POST.get('max_ot_hours_holiday', obj.max_ot_hours_holiday)
        obj.rate_multiplier_weekday = request.POST.get('rate_multiplier_weekday', obj.rate_multiplier_weekday)
        obj.rate_multiplier_holiday = request.POST.get('rate_multiplier_holiday', obj.rate_multiplier_holiday)
        obj.updated_by = request.user
        obj.save()
        messages.success(request, 'บันทึกการตั้งค่าสำเร็จ')
    return render(request, 'admin/settings.html', {'settings': obj})


@login_required
def admin_audit(request):
    logs = AuditLog.objects.select_related('user').order_by('-created_at')[:100]
    return render(request, 'admin/audit.html', {'logs': logs})


@login_required
def admin_history(request):
    history = ImportHistory.objects.select_related('imported_by').order_by('-imported_at')
    return render(request, 'admin/history.html', {'history': history})


@login_required
def admin_import(request):
    from django.core.paginator import Paginator
    from api.models import TimeLog

    # Upload handler — ใช้ API import_timelog เดิม
    if request.method == 'POST' and request.FILES.get('file'):
        import openpyxl
        f = request.FILES['file']
        month_param = request.POST.get('month', '')
        try:
            # เรียก API import_timelog ภายใน
            from django.test import RequestFactory
            from api.views import import_timelog
            factory = RequestFactory()
            api_req = factory.post('/api/import-timelog/', {'month': month_param}, format='multipart')
            api_req.user = request.user
            api_req.FILES['file'] = f
            api_req.data = api_req.POST
            resp = import_timelog(api_req)
            if resp.status_code < 300:
                messages.success(request, f'นำเข้าไฟล์ {f.name} สำเร็จ')
            else:
                data = json.loads(resp.content)
                messages.error(request, data.get('error', 'เกิดข้อผิดพลาด'))
        except Exception as e:
            messages.error(request, f'เกิดข้อผิดพลาด: {e}')

    # ดึงข้อมูลจาก DB — ใช้ ImportHistory.rows_data ล่าสุด หรือ TimeLog
    latest_import = ImportHistory.objects.filter(status__in=['success', 'partial']).order_by('-imported_at').first()
    all_rows = []
    meta = None

    if latest_import and latest_import.rows_data:
        all_rows = latest_import.rows_data
        unique_emps = len(set(r.get('empId', '') for r in all_rows))
        dates = sorted(set(r.get('date', '') for r in all_rows if r.get('date')))
        anomalies = sum(1 for r in all_rows if r.get('flag'))
        meta = {
            'filename': latest_import.filename,
            'total': len(all_rows),
            'employees': unique_emps,
            'date_range': f"{dates[0]} – {dates[-1]}" if dates else '-',
            'anomalies': anomalies,
        }

    search = request.GET.get('q', '').strip()
    if search:
        all_rows = [r for r in all_rows if search.lower() in r.get('name', '').lower() or search in r.get('empId', '')]

    paginator = Paginator(all_rows, 25)
    page_num = request.GET.get('page', 1)
    page_obj = paginator.get_page(page_num)

    return render(request, 'admin/import.html', {
        'page_obj': page_obj,
        'meta': meta,
        'search': search,
        'has_data': bool(all_rows),
    })


@login_required
def admin_depts(request):
    depts = Department.objects.annotate(member_count=Count('members')).order_by('name')
    return render(request, 'admin/depts.html', {'depts': depts})


# ─── Staff Views ──────────────────────────────────────────────────────────────

@login_required
def staff_dashboard(request):
    now = timezone.now()
    user = request.user
    ots = OTRequest.objects.filter(staff=user, work_date__year=now.year, work_date__month=now.month)
    return render(request, 'staff/dashboard.html', {
        'ot_hours': ots.aggregate(total=Sum('ot_hours'))['total'] or 0,
        'ot_amount': ots.aggregate(total=Sum('amount'))['total'] or 0,
        'pending_count': ots.filter(status='submitted').count(),
        'rejected_count': OTRequest.objects.filter(staff=user, status__in=['head_rejected','checker_rejected']).count(),
        'total_requests': OTRequest.objects.filter(staff=user).count(),
        'recent_requests': OTRequest.objects.filter(staff=user).order_by('-work_date')[:5],
    })


@login_required
def staff_submit(request):
    if request.method == 'POST':
        from datetime import date as date_type, time as time_type
        work_date = date_type.fromisoformat(request.POST['work_date'])
        start_str = request.POST['start_time']
        end_str   = request.POST['end_time']
        h1, m1 = map(int, start_str.split(':'))
        h2, m2 = map(int, end_str.split(':'))
        ot_hours = round(((h2 * 60 + m2) - (h1 * 60 + m1)) / 60, 2)
        is_hol = Holiday.objects.filter(date=work_date).exists() or work_date.weekday() >= 5
        day_type = 'holiday' if is_hol else 'weekday'
        settings, _ = SystemSettings.objects.get_or_create(pk=1)
        rate = float(settings.rate_multiplier_holiday if is_hol else settings.rate_multiplier_weekday)
        OTRequest.objects.create(
            staff=request.user,
            department=request.user.department,
            work_date=work_date,
            day_type=day_type,
            start_time=time_type(h1, m1),
            end_time=time_type(h2, m2),
            ot_hours=max(ot_hours, 0),
            work_detail=request.POST.get('work_detail', ''),
            location=request.POST.get('location', ''),
            amount=max(ot_hours, 0) * rate * 100,
            status='submitted',
        )
        messages.success(request, 'ยื่นคำร้อง OT สำเร็จ')
        return redirect('staff_status')
    return render(request, 'staff/submit.html')


@login_required
def staff_status(request):
    ots = OTRequest.objects.filter(staff=request.user).order_by('-work_date')
    return render(request, 'staff/status.html', {'requests': ots})


@login_required
def staff_timelog(request):
    from api.models import TimeLog
    logs = TimeLog.objects.filter(user=request.user).order_by('-log_date')[:31]
    return render(request, 'staff/timelog.html', {'logs': logs})


@login_required
def profile_view(request):
    return render(request, 'profile.html')


# ─── OT Detail ───────────────────────────────────────────────────────────────

@login_required
def ot_detail(request, pk):
    ot = get_object_or_404(OTRequest, pk=pk)
    user = request.user
    can_approve = (
        (user.role == 'depthead' and ot.status == 'submitted') or
        (user.role == 'deptrep'  and ot.status == 'head_approved') or
        (user.role == 'checker'  and ot.status == 'rep_forwarded')
    )
    steps = [
        {'label': 'ยื่นคำร้อง', 'done': True, 'current': False, 'by': ot.staff.get_full_name(), 'at': ot.created_at.strftime('%d %b %Y') if ot.created_at else ''},
        {'label': 'หัวหน้าแผนกอนุมัติ', 'done': ot.head_approved_at is not None, 'current': ot.status == 'submitted', 'by': ot.head_approved_by.get_full_name() if ot.head_approved_by else '', 'at': ot.head_approved_at.strftime('%d %b %Y') if ot.head_approved_at else ''},
        {'label': 'ตัวแทนแผนกส่งเรื่อง', 'done': ot.rep_forwarded_at is not None, 'current': ot.status == 'head_approved', 'by': ot.rep_forwarded_by.get_full_name() if ot.rep_forwarded_by else '', 'at': ot.rep_forwarded_at.strftime('%d %b %Y') if ot.rep_forwarded_at else ''},
        {'label': 'ผู้ตรวจสอบอนุมัติ', 'done': ot.checker_approved_at is not None, 'current': ot.status == 'rep_forwarded', 'by': ot.checker_approved_by.get_full_name() if ot.checker_approved_by else '', 'at': ot.checker_approved_at.strftime('%d %b %Y') if ot.checker_approved_at else ''},
    ]
    return render(request, 'ot_detail.html', {'ot': ot, 'can_approve': can_approve, 'approval_steps': steps})


@login_required
def ot_approve(request, pk):
    if request.method == 'POST':
        from api.views import log_action
        ot = get_object_or_404(OTRequest, pk=pk)
        user = request.user
        note = request.POST.get('note', '')
        if user.role == 'depthead' and ot.status == 'submitted':
            ot.status = 'head_approved'; ot.head_approved_by = user; ot.head_approved_at = timezone.now(); ot.head_note = note; ot.save()
            messages.success(request, 'อนุมัติสำเร็จ')
            log_action(user, f'อนุมัติคำร้อง OT #{ot.id}', request=request)
        elif user.role == 'deptrep' and ot.status == 'head_approved':
            ot.status = 'rep_forwarded'; ot.rep_forwarded_by = user; ot.rep_forwarded_at = timezone.now(); ot.save()
            messages.success(request, 'ส่งต่อสำเร็จ')
        elif user.role == 'checker' and ot.status == 'rep_forwarded':
            ot.status = 'checker_approved'; ot.checker_approved_by = user; ot.checker_approved_at = timezone.now(); ot.checker_note = note; ot.save()
            messages.success(request, 'อนุมัติสำเร็จ')
    return redirect('ot_detail', pk=pk)


@login_required
def ot_reject(request, pk):
    if request.method == 'POST':
        ot = get_object_or_404(OTRequest, pk=pk)
        user = request.user
        note = request.POST.get('note', '')
        if user.role == 'depthead' and ot.status == 'submitted':
            ot.status = 'head_rejected'; ot.head_note = note; ot.save()
            messages.success(request, 'ตีกลับสำเร็จ')
        elif user.role == 'checker' and ot.status == 'rep_forwarded':
            ot.status = 'checker_rejected'; ot.checker_note = note; ot.save()
            messages.success(request, 'ตีกลับสำเร็จ')
    return redirect('ot_detail', pk=pk)


# ─── Other Role Dashboards ────────────────────────────────────────────────────

# ─── DeptHead Views ──────────────────────────────────────────────────────────

@login_required
def head_dashboard(request):
    dept = request.user.department
    pending = OTRequest.objects.filter(department=dept, status='submitted').select_related('staff').order_by('-work_date')
    approved = OTRequest.objects.filter(department=dept, status='head_approved').count()
    rejected = OTRequest.objects.filter(department=dept, status='head_rejected').count()
    total_hours = OTRequest.objects.filter(department=dept).aggregate(h=Sum('ot_hours'))['h'] or 0
    return render(request, 'depthead/dashboard.html', {
        'pending': pending, 'pending_count': pending.count(),
        'approved_count': approved, 'rejected_count': rejected,
        'total_hours': total_hours, 'dept_name': dept.name if dept else '-',
    })

@login_required
def head_pending(request):
    dept = request.user.department
    pending = OTRequest.objects.filter(department=dept, status='submitted').select_related('staff').order_by('-work_date')
    return render(request, 'depthead/pending.html', {'pending': pending})

@login_required
def head_history(request):
    dept = request.user.department
    history = OTRequest.objects.filter(department=dept).exclude(status='submitted').select_related('staff').order_by('-work_date')
    return render(request, 'depthead/history.html', {'history': history})

@login_required
def head_members(request):
    dept = request.user.department
    members = User.objects.filter(department=dept, is_active=True).order_by('first_name')
    member_ot = {}
    for m in members:
        agg = OTRequest.objects.filter(staff=m).aggregate(hrs=Sum('ot_hours'), amt=Sum('amount'))
        member_ot[m.id] = {'hrs': agg['hrs'] or 0, 'amt': agg['amt'] or 0}
    return render(request, 'depthead/members.html', {
        'members': members, 'member_ot': member_ot, 'dept_name': dept.name if dept else '-',
    })

@login_required
def head_report(request):
    dept = request.user.department
    ots = OTRequest.objects.filter(department=dept).select_related('staff').order_by('-work_date')
    total_hours = ots.aggregate(h=Sum('ot_hours'))['h'] or 0
    total_amount = ots.aggregate(a=Sum('amount'))['a'] or 0
    by_month = defaultdict(lambda: {'hrs': 0, 'amt': 0, 'count': 0})
    for o in ots:
        key = o.work_date.strftime('%Y-%m')
        by_month[key]['hrs'] += float(o.ot_hours)
        by_month[key]['amt'] += float(o.amount)
        by_month[key]['count'] += 1
    chart_labels = json.dumps(sorted(by_month.keys())[-6:])
    chart_values = json.dumps([int(by_month[k]['amt']) for k in sorted(by_month.keys())[-6:]])
    return render(request, 'depthead/report.html', {
        'ots': ots, 'total_hours': total_hours, 'total_amount': total_amount,
        'dept_name': dept.name if dept else '-',
        'chart_labels': chart_labels, 'chart_values': chart_values,
    })


# ─── DeptRep Views ───────────────────────────────────────────────────────────

@login_required
def rep_dashboard(request):
    dept = request.user.department
    to_forward = OTRequest.objects.filter(department=dept, status='head_approved').select_related('staff').order_by('-work_date')
    forwarded = OTRequest.objects.filter(department=dept, status='rep_forwarded').count()
    total_amt = to_forward.aggregate(a=Sum('amount'))['a'] or 0
    return render(request, 'deptrep/dashboard.html', {
        'to_forward': to_forward, 'to_forward_count': to_forward.count(),
        'forwarded_count': forwarded, 'total_amt': total_amt,
        'dept_name': dept.name if dept else '-',
    })

@login_required
def rep_export(request):
    dept = request.user.department
    to_forward = OTRequest.objects.filter(department=dept, status='head_approved').select_related('staff').order_by('work_date')
    return render(request, 'deptrep/export.html', {'to_forward': to_forward})

@login_required
def rep_export_preview(request):
    if request.method == 'POST':
        ids = request.POST.getlist('ids')
        ots = OTRequest.objects.filter(id__in=ids, status='head_approved').select_related('staff').order_by('work_date')
        grouped = defaultdict(list)
        for o in ots:
            grouped[o.staff.get_full_name()].append(o)
        employees = []
        for i, (name, reqs) in enumerate(grouped.items(), 1):
            weekday_hrs = sum(float(r.ot_hours) for r in reqs if r.day_type == 'weekday')
            weekend_hrs = sum(float(r.ot_hours) for r in reqs if r.day_type == 'holiday')
            amount = sum(int(float(r.ot_hours)) * (70 if r.day_type == 'holiday' else 60) for r in reqs)
            employees.append({
                'seq': i, 'name': name, 'reqs': reqs,
                'weekday_hrs': int(weekday_hrs), 'weekend_hrs': int(weekend_hrs), 'amount': amount,
            })
        total = sum(e['amount'] for e in employees)
        request.session['export_ids'] = ids
        dept = request.user.department
        return render(request, 'deptrep/preview.html', {
            'employees': employees, 'total': total,
            'dept_name': dept.name if dept else '-',
            'count': len(ids),
        })
    return redirect('rep_export')

@login_required
def rep_export_download(request):
    import openpyxl
    ids = request.session.get('export_ids', [])
    ots = OTRequest.objects.filter(id__in=ids).select_related('staff').order_by('work_date')
    dept = request.user.department

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'หลักฐานจ่าย'

    ws.append(['หลักฐานการเบิกจ่ายเงินค่าตอบแทนการปฏิบัติงานนอกเวลาราชการ'])
    ws.append([f'  {dept.name if dept else ""}  ประจำเดือน'])
    ws.append(['ลำดับที่', 'ชื่อ-สกุล', 'วันปฏิบัติงาน', '', '', '', '', '', '', '', 'วันปกติ(ชม.)', 'วันหยุด(ชม.)', 'จำนวนเงิน', 'วดป.รับเงิน', 'ลายมือชื่อ', 'หมายเหตุ'])

    grouped = defaultdict(list)
    for o in ots:
        grouped[o.staff.get_full_name()].append(o)

    total = 0
    for i, (name, reqs) in enumerate(grouped.items(), 1):
        weekday_hrs = sum(int(float(r.ot_hours)) for r in reqs if r.day_type == 'weekday')
        weekend_hrs = sum(int(float(r.ot_hours)) for r in reqs if r.day_type == 'holiday')
        amount = sum(int(float(r.ot_hours)) * (70 if r.day_type == 'holiday' else 60) for r in reqs)
        total += amount
        date_row = [i, name]
        time_row = ['', '']
        for r in reqs[:8]:
            d = r.work_date
            date_row.append(f'{d.day} {["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."][d.month-1]} {d.year+543}')
            time_row.append(f'{r.start_time.strftime("%H.%M")}-{r.end_time.strftime("%H.%M")} น.')
        while len(date_row) < 10: date_row.append('')
        while len(time_row) < 10: time_row.append('')
        date_row += [weekday_hrs or '', weekend_hrs or '', amount, '', '', '']
        time_row += ['', '', '', '', '', '']
        ws.append(date_row)
        ws.append(time_row)

    ws.append([])
    ws.append(['', f'  รวมเงินจ่ายทั้งสิ้น', '', '', '', '', '', '', '', '', 'รวมเป็นเงิน', '', total])

    for col_num, width in enumerate([8, 40, 16, 13, 13, 13, 13, 13, 13, 13, 7, 7, 9, 8, 13, 11], 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(col_num)].width = width

    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = 'attachment; filename="OT-Report.xlsx"'
    wb.save(response)
    return response

@login_required
def rep_forward(request):
    if request.method == 'POST':
        ids = request.POST.getlist('ids')
        note = request.POST.get('note', '')
        forwarded = 0
        for ot_id in ids:
            try:
                ot = OTRequest.objects.get(id=ot_id, status='head_approved')
                ot.status = 'rep_forwarded'
                ot.rep_forwarded_by = request.user
                ot.rep_forwarded_at = timezone.now()
                ot.rep_note = note
                ot.save()
                forwarded += 1
            except OTRequest.DoesNotExist:
                pass
        messages.success(request, f'ส่งต่อ {forwarded} คำร้องให้ผู้ตรวจสอบเรียบร้อยแล้ว')
    return redirect('rep_dashboard')

@login_required
def rep_history(request):
    dept = request.user.department
    history = OTRequest.objects.filter(department=dept).exclude(status__in=['submitted', 'draft']).select_related('staff').order_by('-work_date')
    return render(request, 'deptrep/history.html', {'history': history})

@login_required
def rep_members(request):
    dept = request.user.department
    members = User.objects.filter(department=dept, is_active=True).order_by('first_name')
    member_ot = {}
    for m in members:
        agg = OTRequest.objects.filter(staff=m).aggregate(hrs=Sum('ot_hours'), amt=Sum('amount'))
        member_ot[m.id] = {'hrs': agg['hrs'] or 0, 'amt': agg['amt'] or 0}
    return render(request, 'deptrep/members.html', {
        'members': members, 'member_ot': member_ot, 'dept_name': dept.name if dept else '-',
    })


# ─── Checker Views ───────────────────────────────────────────────────────────

@login_required
def checker_dashboard(request):
    to_check = OTRequest.objects.filter(status='rep_forwarded').select_related('staff', 'department').order_by('-work_date')
    approved = OTRequest.objects.filter(status__in=['checker_approved', 'completed']).count()
    rejected = OTRequest.objects.filter(status='checker_rejected').count()

    by_dept = defaultdict(lambda: {'pending': [], 'approved': 0, 'rejected': 0})
    for ot in to_check:
        by_dept[ot.department.name]['pending'].append(ot)
    for ot in OTRequest.objects.filter(status__in=['checker_approved', 'completed']).select_related('department'):
        by_dept[ot.department.name]['approved'] += 1
    for ot in OTRequest.objects.filter(status='checker_rejected').select_related('department'):
        by_dept[ot.department.name]['rejected'] += 1

    no_ot_depts = Department.objects.exclude(
        id__in=OTRequest.objects.filter(
            work_date__year=timezone.now().year, work_date__month=timezone.now().month
        ).values_list('department_id', flat=True).distinct()
    )

    return render(request, 'checker/dashboard.html', {
        'to_check': to_check, 'to_check_count': to_check.count(),
        'approved_count': approved, 'rejected_count': rejected,
        'by_dept': dict(by_dept), 'no_ot_depts': no_ot_depts,
    })

@login_required
def checker_budget(request):
    depts = Department.objects.all().order_by('name')
    dept_data = []
    for d in depts:
        used = OTRequest.objects.filter(department=d, status__in=['checker_approved', 'completed']).aggregate(a=Sum('amount'))['a'] or 0
        budget = float(d.ot_budget or 0)
        pct = int(used / budget * 100) if budget > 0 else 0
        dept_data.append({'name': d.name, 'budget': budget, 'used': float(used), 'pct': pct, 'remaining': budget - float(used)})
    total_budget = sum(d['budget'] for d in dept_data)
    total_used = sum(d['used'] for d in dept_data)
    return render(request, 'checker/budget.html', {
        'dept_data': dept_data, 'total_budget': total_budget, 'total_used': total_used,
        'total_pct': int(total_used / total_budget * 100) if total_budget > 0 else 0,
    })

@login_required
def checker_set_budget(request):
    depts = Department.objects.all().order_by('name')
    if request.method == 'POST':
        for d in depts:
            val = request.POST.get(f'budget_{d.id}', '')
            if val:
                d.ot_budget = float(val)
                d.save()
        messages.success(request, 'บันทึกงบประมาณเรียบร้อย')
        return redirect('checker_set_budget')
    return render(request, 'checker/set_budget.html', {'depts': depts})

@login_required
def checker_history(request):
    history = OTRequest.objects.filter(
        status__in=['checker_approved', 'checker_rejected', 'completed']
    ).select_related('staff', 'department').order_by('-updated_at')
    return render(request, 'checker/history.html', {'history': history})

@login_required
def checker_report(request):
    approved = OTRequest.objects.filter(status__in=['checker_approved', 'completed']).select_related('department')
    by_dept = defaultdict(int)
    for o in approved:
        by_dept[o.department.name] += int(float(o.amount))
    total = sum(by_dept.values())
    chart_labels = json.dumps(list(by_dept.keys()))
    chart_values = json.dumps(list(by_dept.values()))
    dept_pct = [{'name': k, 'amount': v, 'pct': int(v / total * 100) if total > 0 else 0} for k, v in by_dept.items()]
    return render(request, 'checker/report.html', {
        'dept_pct': dept_pct, 'total': total,
        'chart_labels': chart_labels, 'chart_values': chart_values,
        'total_requests': approved.count(),
    })


# ─── Executive Views ─────────────────────────────────────────────────────────

@login_required
def exec_dashboard(request):
    approved = OTRequest.objects.filter(status__in=['checker_approved', 'completed'])
    summary = approved.aggregate(total_amount=Sum('amount'), total_hours=Sum('ot_hours'), total_requests=Count('id'))

    by_dept = defaultdict(lambda: {'hrs': 0, 'amt': 0})
    for o in approved.select_related('department'):
        name = o.department.name if o.department else 'ไม่ระบุ'
        by_dept[name]['hrs'] += float(o.ot_hours)
        by_dept[name]['amt'] += float(o.amount)
    dept_breakdown = [{'name': k, 'hrs': int(v['hrs']), 'amt': int(v['amt'])} for k, v in by_dept.items()]

    return render(request, 'executive/dashboard.html', {
        'summary': summary, 'dept_breakdown': dept_breakdown,
    })

@login_required
def exec_trend(request):
    approved = OTRequest.objects.filter(status__in=['checker_approved', 'completed']).order_by('work_date')
    by_month = defaultdict(int)
    for o in approved:
        key = o.work_date.strftime('%Y-%m')
        by_month[key] += int(float(o.amount))
    months = sorted(by_month.keys())[-12:]
    chart_labels = json.dumps(months)
    chart_values = json.dumps([by_month[m] for m in months])
    return render(request, 'executive/trend.html', {
        'chart_labels': chart_labels, 'chart_values': chart_values,
    })


# ─── Notifications ───────────────────────────────────────────────────────────

@login_required
def notifications_json(request):
    from django.http import JsonResponse
    notifs = Notification.objects.filter(recipient=request.user).order_by('-created_at')[:20]
    unread = Notification.objects.filter(recipient=request.user, is_read=False).count()
    data = [{
        'id': n.id, 'message': n.message, 'is_read': n.is_read,
        'created_at': n.created_at.strftime('%d-%m-%y %H:%M'),
    } for n in notifs]
    return JsonResponse({'notifications': data, 'unread': unread})

@login_required
def notifications_mark_read(request):
    from django.http import JsonResponse
    if request.method == 'POST':
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
    return JsonResponse({'status': 'ok'})


# ─── Role Switch ─────────────────────────────────────────────────────────────

@login_required
def switch_role(request, role):
    available = request.user.available_roles
    if role in available:
        request.session['active_role'] = role
    routes = {
        'admin': 'admin_dashboard', 'staff': 'staff_dashboard',
        'depthead': 'head_dashboard', 'deptrep': 'rep_dashboard',
        'checker': 'checker_dashboard', 'executive': 'exec_dashboard',
    }
    return redirect(routes.get(role, 'dashboard'))
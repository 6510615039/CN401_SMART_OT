from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from django.db.models import Sum, Count
from api.models import OTRequest, Holiday, Department, User, AuditLog, ImportHistory, SystemSettings
import json


# ─── Auth ─────────────────────────────────────────────────────────────────────

def login_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    error = None
    username = ''
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '').strip()
        # รับทั้ง username เต็มและ @domain
        if '@' in username:
            username = username.split('@')[0]
        user = authenticate(request, username=username, password=password)
        if user and user.is_active:
            login(request, user)
            return redirect('dashboard')
        error = 'Username หรือรหัสผ่านไม่ถูกต้อง'
    return render(request, 'login.html', {'error': error, 'username': username})


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
        'years': range(timezone.now().year - 1, timezone.now().year + 3),
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
    if h.is_system:
        messages.error(request, 'ไม่สามารถลบวันหยุดราชการได้')
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

    if request.method == 'POST' and request.FILES.get('file'):
        import openpyxl
        f = request.FILES['file']
        try:
            wb = openpyxl.load_workbook(f)
            ws = wb.active
            rows_data = []
            all_rows  = []
            header_found = False

            for row in ws.iter_rows(values_only=True):
                if not header_found:
                    row_str = [str(c).strip().lower() if c else '' for c in row]
                    if 'id' in row_str and 'name' in row_str:
                        header_found = True
                    continue

                emp_id   = str(row[0]).strip() if row[0] else ''
                name     = str(row[1]).strip() if row[1] else ''
                date_val = str(row[2]).strip() if row[2] else ''
                week     = str(row[3]).strip() if row[3] else ''
                checkin  = str(row[4]).strip() if row[4] else '-'
                checkout = str(row[5]).strip() if row[5] else '-'
                overtime = str(row[6]).strip() if row[6] else '00 : 00'
                att_status = str(row[7]).strip() if row[7] else ''

                if not (emp_id and name and date_val):
                    continue

                # คำนวณ OT เป็นตัวเลข
                try:
                    parts = overtime.replace(' ', '').split(':')
                    ot_h = int(parts[0]); ot_m = int(parts[1]) if len(parts) > 1 else 0
                    ot_decimal = round(ot_h + ot_m / 60, 2)
                except:
                    ot_decimal = 0

                # สถานะ
                if att_status and att_status not in ('None',):
                    row_status = att_status
                    row_status_kind = 'warning'
                elif ot_decimal > 0:
                    row_status = 'ปกติ (มี OT)'
                    row_status_kind = 'success'
                else:
                    row_status = 'ปกติ'
                    row_status_kind = 'neutral'

                all_rows.append({
                    'emp_id': emp_id,
                    'name': name,
                    'date': date_val,
                    'week': week,
                    'checkin': checkin,
                    'checkout': checkout,
                    'overtime': f'{ot_decimal:.1f}' if ot_decimal else '0',
                    'status': row_status,
                    'status_kind': row_status_kind,
                })
                if ot_decimal > 0:
                    rows_data.append(all_rows[-1])

            # สรุป
            unique_names   = len(set(r['name'] for r in all_rows))
            anomaly_count  = sum(1 for r in all_rows if r['status_kind'] == 'warning')
            dates = sorted(set(r['date'] for r in all_rows if r['date'] not in ('', 'None')))
            date_range = f"{dates[0]} – {dates[-1]}" if dates else '-'

            request.session['import_rows'] = all_rows
            request.session['import_meta'] = {
                'filename': f.name,
                'total': len(all_rows),
                'employees': unique_names,
                'date_range': date_range,
                'anomalies': anomaly_count,
            }

            ImportHistory.objects.create(imported_by=request.user, filename=f.name, status='success')
            messages.success(request, f'นำเข้าสำเร็จ — พบ {len(all_rows)} รายการ จาก {unique_names} พนักงาน')

        except Exception as e:
            messages.error(request, f'เกิดข้อผิดพลาด: {e}')

    # แสดงผล
    all_rows = request.session.get('import_rows', [])
    meta     = request.session.get('import_meta', None)
    search   = request.GET.get('q', '').strip()

    if search:
        all_rows = [r for r in all_rows if search.lower() in r['name'].lower() or search in r['emp_id']]

    paginator = Paginator(all_rows, 25)
    page_num  = request.GET.get('page', 1)
    page_obj  = paginator.get_page(page_num)

    return render(request, 'admin/import.html', {
        'page_obj': page_obj,
        'meta': meta,
        'search': search,
        'has_data': bool(request.session.get('import_rows')),
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

@login_required
def head_dashboard(request):
    pending = OTRequest.objects.filter(department=request.user.department, status='submitted').order_by('-work_date')
    return render(request, 'depthead/dashboard.html', {'pending': pending, 'pending_count': pending.count()})


@login_required
def rep_dashboard(request):
    to_forward = OTRequest.objects.filter(department=request.user.department, status='head_approved').order_by('-work_date')
    return render(request, 'deptrep/dashboard.html', {'to_forward': to_forward})


@login_required
def checker_dashboard(request):
    to_check = OTRequest.objects.filter(status='rep_forwarded').select_related('staff','department').order_by('-work_date')
    return render(request, 'checker/dashboard.html', {'to_check': to_check})


@login_required
def exec_dashboard(request):
    summary = OTRequest.objects.filter(status='checker_approved').aggregate(
        total_amount=Sum('amount'), total_hours=Sum('ot_hours'), total_requests=Count('id')
    )
    return render(request, 'executive/dashboard.html', {'summary': summary})
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Clock, FilePlus, ListChecks, UserCircle,
  Calendar as CalendarIcon, AlertTriangle, CheckCircle2, ChevronRight, Lock,
} from 'lucide-react';
import { NavItem } from '../AppShell';
import { KpiCard, PageHeader, SectionCard, StatusChip } from '../shared';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Switch } from '../ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../ui/dialog';

export const STAFF_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard',         icon: <LayoutDashboard /> },
  { key: 'timelog',   label: 'เวลาเข้า-ออกของฉัน',  icon: <Clock /> },
  { key: 'submit',    label: 'ยื่นคำร้อง OT',         icon: <FilePlus /> },
  { key: 'status',    label: 'สถานะคำร้อง',         icon: <ListChecks /> },
  { key: 'profile',   label: 'โปรไฟล์',             icon: <UserCircle /> },
];

export function StaffDashboard({ onGoEdit }: { onGoEdit: () => void }) {
  const [summary, setSummary] = useState<any>(null);
  const [activeMonth, setActiveMonth] = useState('');
  const [otRequests, setOtRequests] = useState<any[]>([]);
  const [otDays, setOtDays] = useState<number[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    // 1. Get latest imported month
    fetch('/api/admin/summary/', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const m = d?.imported_months?.[0] || '';
        setActiveMonth(m);
        // 2. Get staff summary for that month
        return Promise.all([
          fetch(`/api/staff/summary/${m ? '?month=' + m : ''}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
          fetch(`/api/timelog/my/${m ? '?month=' + m : ''}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
          fetch('/api/ot-requests/?ordering=-created_at', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
        ]);
      })
      .then(([summaryData, timelogData, reqData]) => {
        if (summaryData) setSummary(summaryData);
        if (timelogData?.rows) {
          const days = timelogData.rows
            .filter((r: any) => parseFloat(r.ot) > 0)
            .map((r: any) => new Date(r.date).getDate());
          setOtDays(days);
        }
        if (reqData) {
          const arr = Array.isArray(reqData) ? reqData : (reqData.results || []);
          setOtRequests(arr.slice(0, 5));
        }
      })
      .catch(() => {});
  }, []);

  const otHours = summary?.total_ot_hours ?? '—';
  const otBaht  = summary?.total_ot_baht != null ? Math.round(parseFloat(summary.total_ot_baht)).toLocaleString() : '—';
  const statusMap: Record<string,string> = { approved:'success', rejected:'danger', pending:'warning', draft:'neutral' };
  const statusLabel: Record<string,string> = { approved:'อนุมัติแล้ว', rejected:'ถูกตีกลับ', pending:'รออนุมัติ', draft:'ยังไม่ยื่น' };
  const reqStatus = !summary || summary.ot_total === 0 ? 'draft'
    : summary.ot_rejected > 0 ? 'rejected'
    : summary.ot_approved > 0 ? 'approved'
    : 'pending';

  const STATUS_LABEL: Record<string,string> = {
    submitted:'ยื่นคำร้อง', head_approved:'หัวหน้าอนุมัติ', head_rejected:'ถูกตีกลับ',
    rep_forwarded:'ส่งต่อแล้ว', checker_approved:'อนุมัติแล้ว', checker_rejected:'ถูกปฏิเสธ', completed:'เสร็จสิ้น',
  };
  const STATUS_KIND: Record<string,string> = {
    submitted:'info', head_approved:'info', head_rejected:'danger',
    rep_forwarded:'info', checker_approved:'success', checker_rejected:'danger', completed:'success',
  };

  const hasRejected = summary?.ot_rejected > 0;

  return (
    <>
      <PageHeader title="สวัสดี" subtitle="ระบบ OT" />
      <div className="grid grid-cols-4 gap-5 mb-6">
        <KpiCard label="ชั่วโมง OT เดือนนี้" value={<span className="text-tu-red">{otHours}</span>} hint="ชั่วโมง" accent="red" />
        <KpiCard label="ค่า OT คาดว่าจะได้รับ" value={<span className="text-success">{otBaht}</span>} hint="บาท" accent="green" />
        <KpiCard label="สถานะคำร้องเดือนนี้" value={<StatusChip kind={statusMap[reqStatus] as any}>{statusLabel[reqStatus]}</StatusChip>} accent="yellow" />
        <KpiCard label="คำร้องทั้งหมด" value={<span>{summary?.ot_total ?? '—'}</span>} hint="รายการ" accent="blue" />
      </div>

      <div className="grid grid-cols-2 gap-5 mb-6">
        <SectionCard title="กิจกรรมล่าสุดของฉัน">
          <div className="space-y-3">
            {otRequests.length === 0 ? (
              <p className="text-center py-6 text-[var(--neutral-500)] text-[13px]">ยังไม่มีคำร้อง OT</p>
            ) : otRequests.map((r: any, i: number) => {
              const k = STATUS_KIND[r.status] || 'info';
              const label = STATUS_LABEL[r.status] || r.status;
              const dateStr = r.work_date || '';
              return (
                <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0 border-[var(--neutral-300)]">
                  <div className={`size-9 rounded-full grid place-items-center ${k === 'success' ? 'bg-green-100 text-success' : k === 'danger' ? 'bg-tu-red-soft text-danger' : 'bg-blue-100 text-info'}`}><CheckCircle2 className="size-4" /></div>
                  <div className="flex-1">
                    <p className="text-[13px]">{label} — {dateStr}</p>
                    <p className="text-[11px] text-[var(--neutral-500)]">{parseFloat(r.ot_hours).toFixed(1)} ชม. • {Math.round(parseFloat(r.amount)).toLocaleString()} บาท</p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="ปฏิทินการทำงานเดือนนี้">
          <MiniCalendar month={activeMonth} otDays={otDays} totalOT={otHours} />
        </SectionCard>
      </div>

      {hasRejected && (
        <div className="bg-tu-red-soft border border-tu-red rounded-xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-6 text-tu-red" />
            <p>คุณมีคำร้อง <strong>{summary.ot_rejected} รายการ</strong> ถูกตีกลับ กรุณาแก้ไข</p>
          </div>
          <Button onClick={onGoEdit} className="bg-tu-red hover:bg-tu-red-dark text-white">ไปแก้ไข <ChevronRight className="size-4 ml-1" /></Button>
        </div>
      )}
    </>
  );
}

const THAI_MONTHS_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

function MiniCalendar({ month, otDays, totalOT }: { month: string; otDays: number[]; totalOT: number }) {
  // month = "2569-03" → Gregorian 2026-03
  const parts = month.split('-');
  const gregYear = parts[0] ? parseInt(parts[0]) - 543 : new Date().getFullYear();
  const mon = parts[1] ? parseInt(parts[1]) - 1 : new Date().getMonth(); // 0-based
  const firstDay = new Date(gregYear, mon, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(gregYear, mon + 1, 0).getDate();
  const thaiYear = gregYear + 543;
  const monthLabel = THAI_MONTHS_FULL[mon] || '';

  const cells = Array.from({ length: 42 }, (_, i) => i - firstDay + 1);
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h4>{monthLabel} {thaiYear}</h4>
        <span className="text-[12px] text-[var(--neutral-500)]">รวม OT: {totalOT} ชม.</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[11px] text-center text-[var(--neutral-500)] mb-1">{['อา','จ','อ','พ','พฤ','ศ','ส'].map(d => <div key={d}>{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {cells.slice(0, 35).map((d, i) => {
          const valid = d >= 1 && d <= daysInMonth;
          const weekend = i % 7 === 0 || i % 7 === 6;
          const hasOT = valid && otDays.includes(d);
          return (
            <div key={i} className={`aspect-square rounded text-[12px] grid place-items-center ${!valid ? 'bg-transparent' : hasOT ? 'bg-tu-yellow text-black font-bold' : weekend ? 'bg-[var(--neutral-100)] text-[var(--neutral-500)]' : 'bg-white border border-[var(--neutral-300)]'}`}>{valid && d}</div>
          );
        })}
      </div>
    </div>
  );
}

export function StaffTimeLog() {
  const [view, setView] = useState<'table' | 'cal'>('table');
  const [month, setMonth] = useState('2569-05');
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const MONTH_OPTIONS = Array.from({length:12}, (_,i) => ({
    value: `2569-${String(i+1).padStart(2,'0')}`,
    label: `${THAI_MONTHS[i]} 2569`,
  }));

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    setLoading(true); setRows([]);
    fetch(`/api/timelog/my/?month=${month}`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setRows(d.rows || []); setSummary(d); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month]);

  const totalOT = summary?.total_ot ?? 0;
  const otBaht = summary?.total_ot_baht != null ? Math.round(parseFloat(summary.total_ot_baht)).toLocaleString() : Math.round(totalOT * 60).toLocaleString();

  return (
    <>
      <PageHeader title="เวลาเข้า-ออกของฉัน" right={
        <>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTH_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex border border-[var(--neutral-300)] rounded-lg overflow-hidden">
            <button onClick={() => setView('table')} className={`px-3 py-1.5 text-[13px] ${view === 'table' ? 'bg-tu-red text-white' : ''}`}>ตาราง</button>
            <button onClick={() => setView('cal')} className={`px-3 py-1.5 text-[13px] ${view === 'cal' ? 'bg-tu-red text-white' : ''}`}>ปฏิทิน</button>
          </div>
        </>
      } />

      <div className="grid grid-cols-4 gap-5 mb-5">
        <div className="col-span-3" />
        <div className="bg-tu-yellow-soft rounded-xl p-4 border border-tu-yellow">
          <p className="text-[12px] text-[var(--neutral-700)]">รวม OT เดือนนี้</p>
          <p className="text-[24px] font-bold text-tu-red">{loading ? '...' : `${totalOT} ชม.`}</p>
          <p className="text-[12px] text-success font-semibold">≈ {otBaht} บาท</p>
        </div>
      </div>

      <SectionCard>
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-3 text-[var(--neutral-500)]">
            <div className="size-8 border-4 border-tu-red border-t-transparent rounded-full animate-spin"/>
            <span>กำลังโหลดข้อมูล...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-[var(--neutral-500)]">
            <p>ยังไม่มีข้อมูลสำหรับเดือนนี้</p>
            <p className="text-[12px]">กรุณานำเข้าข้อมูลจากหน้าผู้ดูแลระบบก่อน</p>
          </div>
        ) : view === 'table' ? (
          <div className="overflow-x-auto rounded-lg border border-[var(--neutral-300)]">
            <table className="w-full text-[13px]">
              <thead className="bg-tu-red text-white"><tr>{['วันที่','เวลาเข้า','เวลาออก','ชั่วโมง OT','สถานะ'].map(h => <th key={h} className="text-left px-3 py-3">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-[var(--neutral-300)] hover:bg-tu-yellow-soft">
                    <td className="px-3 py-2">{r.date}</td>
                    <td className="px-3 py-2 font-mono">{r.in || '-'}</td>
                    <td className="px-3 py-2 font-mono">{r.out || '-'}</td>
                    <td className="px-3 py-2 font-mono">{r.ot}</td>
                    <td className="px-3 py-2">{r.flag ? <StatusChip kind="danger">ผิดปกติ</StatusChip> : <StatusChip kind="success">ปกติ</StatusChip>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-[var(--neutral-500)]">
            <p>มุมมองปฏิทิน — กำลังพัฒนา</p>
          </div>
        )}
      </SectionCard>
    </>
  );
}

const SUBMIT_ROWS = Array.from({ length: 8 }, (_, i) => {
  const day = i * 3 + 2;
  const weekend = day % 7 === 0;
  return { day, weekend, hrs: weekend ? 5 : 1.5, in: '08:00', out: weekend ? '14:00' : '18:30', rate: 156 };
});

const SHORT_MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
function deadlineDateDisplay(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  const thaiY = d.getFullYear() + 543;
  return `${d.getDate()} ${SHORT_MONTHS_TH[d.getMonth()]} ${thaiY}`;
}

export function StaffSubmit() {
  const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const MONTH_OPTIONS = Array.from({length:12}, (_,i) => ({
    value: `2569-${String(i+1).padStart(2,'0')}`,
    label: `${THAI_MONTHS[i]} 2569`,
  }));

  const [month, setMonth] = useState('2569-03');
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [hours, setHours] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // date → existing OT request { id, status }
  const [existingReqs, setExistingReqs] = useState<Record<string, { id: number; status: string }>>({});
  const [deadline, setDeadline] = useState<{ date: string; is_passed: boolean } | null>(null);

  const token = () => localStorage.getItem('access_token');

  // Fetch deadline for current month
  useEffect(() => {
    setDeadline(null);
    const tok = token();
    fetch(`/api/ot-deadline/?month=${month}`, { headers: { Authorization: `Bearer ${tok}` } })
      .then(r => r.ok ? r.json() : [])
      .then((data: any) => {
        const list: any[] = Array.isArray(data) ? data : (data?.results ?? []);
        if (list.length > 0) setDeadline({ date: list[0].deadline_date, is_passed: list[0].is_passed });
        else setDeadline(null);
      })
      .catch(() => setDeadline(null));
  }, [month]);

  // Fetch timelog rows + existing OT requests whenever month changes
  useEffect(() => {
    setLoading(true); setRows([]); setSelected([]); setExistingReqs({});
    const tok = token();
    Promise.all([
      fetch(`/api/timelog/my/?month=${month}`, { headers: { 'Authorization': `Bearer ${tok}` } }).then(r => r.ok ? r.json() : null),
      fetch(`/api/ot-requests/`, { headers: { 'Authorization': `Bearer ${tok}` } }).then(r => r.ok ? r.json() : null),
    ])
      .then(([tl, reqs]) => {
        if (tl?.rows) {
          const otRows = tl.rows.filter((r: any) => parseFloat(r.ot) > 0);
          setRows(otRows);
          const initHours: Record<string,string> = {};
          otRows.forEach((r: any) => { initHours[r.date] = String(Math.min(parseFloat(r.ot), isWeekend(r.date) ? 7 : 4)); });
          setHours(initHours);
        }
        if (reqs) {
          const arr: any[] = Array.isArray(reqs) ? reqs : (reqs.results || []);
          // Filter to same month
          const parts = month.split('-');
          const gregYear = parts[0] ? parseInt(parts[0]) - 543 : 0;
          const mon = parts[1] ? parseInt(parts[1]) : 0;
          const prefix = gregYear && mon ? `${gregYear}-${String(mon).padStart(2,'0')}` : '';
          const map: Record<string, { id: number; status: string }> = {};
          arr.forEach((r: any) => {
            if (!prefix || String(r.work_date || '').startsWith(prefix)) {
              map[r.work_date] = { id: r.id, status: r.status };
            }
          });
          setExistingReqs(map);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month]);

  function isWeekend(dateStr: string) {
    const d = new Date(dateStr).getDay();
    return d === 0 || d === 6;
  }

  function calcAmount(dateStr: string, hrs: string) {
    const h = parseFloat(hrs) || 0;
    const rate = isWeekend(dateStr) ? 70 : 60;
    return Math.round(h * rate);
  }

  // Exclude locked dates from selection (shouldn't be selectable, but guard anyway)
  const selRows = rows.filter(r => selected.includes(r.date) && !existingReqs[r.date]);
  const total = selRows.reduce((s, r) => s + calcAmount(r.date, hours[r.date] || r.ot), 0);

  async function handleSubmit() {
    setSubmitting(true);
    const token_ = token();
    try {
      for (const r of selRows) {
        const h = parseFloat(hours[r.date] || r.ot);
        await fetch('/api/ot-requests/', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token_}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            work_date: r.date,
            start_time: r.in || '08:00',
            end_time: r.out || '17:00',
            ot_hours: h,
            work_detail: reason || 'ปฏิบัติงานนอกเวลาราชการ',
            location: 'สำนักงานทะเบียนนักศึกษา',
          }),
        });
      }
      // Re-fetch existing requests after submit to update UI immediately
      const newReqs = await fetch('/api/ot-requests/', { headers: { 'Authorization': `Bearer ${token_}` } }).then(r => r.ok ? r.json() : null);
      if (newReqs) {
        const arr: any[] = Array.isArray(newReqs) ? newReqs : (newReqs.results || []);
        const parts = month.split('-');
        const gregYear = parts[0] ? parseInt(parts[0]) - 543 : 0;
        const mon = parts[1] ? parseInt(parts[1]) : 0;
        const prefix = gregYear && mon ? `${gregYear}-${String(mon).padStart(2,'0')}` : '';
        const map: Record<string, { id: number; status: string }> = {};
        arr.forEach((r: any) => {
          if (!prefix || String(r.work_date || '').startsWith(prefix)) {
            map[r.work_date] = { id: r.id, status: r.status };
          }
        });
        setExistingReqs(map);
      }
      setSubmitted(true);
      setOpen(false);
      setSelected([]);
    } catch {}
    setSubmitting(false);
  }

  if (submitted) return (
    <>
      <PageHeader title="ยื่นคำร้องขอเบิกค่า OT" />
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <CheckCircle2 className="size-16 text-success" />
        <p className="text-[18px] font-semibold">ส่งคำร้องเรียบร้อยแล้ว</p>
        <p className="text-[var(--neutral-500)]">รอหัวหน้าแผนกพิจารณา</p>
        <Button onClick={() => setSubmitted(false)} variant="outline">ยื่นเพิ่มเติม</Button>
      </div>
    </>
  );

  return (
    <>
      <PageHeader title="ยื่นคำร้องขอเบิกค่า OT" right={
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTH_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      } />
      {/* Deadline banner */}
      {deadline?.is_passed ? (
        <div className="flex items-start gap-3 p-4 rounded-xl border mb-5 bg-red-50 border-red-300">
          <Lock className="size-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-red-700">ปิดรับคำร้องโอทีเดือนนี้แล้ว</p>
            <p className="text-[12px] text-red-600 mt-0.5">
              วันปิดรับคือ {deadlineDateDisplay(deadline.date)} — ไม่สามารถยื่นคำร้องใหม่ได้
            </p>
          </div>
        </div>
      ) : deadline ? (
        <div className="flex items-start gap-3 p-4 rounded-xl border mb-5 bg-orange-50 border-orange-300">
          <AlertTriangle className="size-5 text-orange-500 shrink-0 mt-0.5" />
          <p className="text-[13px] text-orange-800">
            <strong>กำหนดยื่นคำร้องโอทีเดือนนี้: ภายใน {deadlineDateDisplay(deadline.date)}</strong>
            {' '}(หลังจากนั้นจะไม่สามารถยื่นได้)
          </p>
        </div>
      ) : null}

      <div className="bg-tu-yellow-soft border border-tu-yellow rounded-xl p-4 flex items-center gap-3 mb-5">
        <AlertTriangle className="size-5 text-[var(--warning)]" />
        <p className="text-[13px]"><strong>ข้อกำหนด:</strong> วันธรรมดา OT สูงสุด 4 ชม./วัน • วันหยุดสูงสุด 7 ชม./วัน</p>
      </div>

      <SectionCard>
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-3 text-[var(--neutral-500)]">
            <div className="size-8 border-4 border-tu-red border-t-transparent rounded-full animate-spin"/>
            <span>กำลังโหลด...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-[var(--neutral-500)]">
            <p>ไม่มีข้อมูล OT สำหรับเดือนนี้</p>
            <p className="text-[12px]">เฉพาะวันที่มีชั่วโมง OT เท่านั้นที่แสดง</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--neutral-300)]">
            <table className="w-full text-[13px]">
              <thead className="bg-tu-red text-white">
                <tr>{['','วันที่','ประเภท','เข้า','ออก','ชม. OT','อัตรา','จำนวนเงิน','สถานะ'].map(h => <th key={h} className="text-left px-3 py-3">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const existing = existingReqs[r.date];
                  const isRejected = existing?.status === 'head_rejected' || existing?.status === 'checker_rejected';
                  const isLocked = !!existing && !isRejected; // locked if submitted (not rejected)
                  const isSel = selected.includes(r.date);
                  const weekend = isWeekend(r.date);
                  const h = parseFloat(hours[r.date] || r.ot);
                  const maxH = weekend ? 7 : 4;
                  const overLimit = !isLocked && h > maxH;

                  const REQ_STATUS_LABEL: Record<string,string> = {
                    submitted:'รออนุมัติ', head_approved:'หัวหน้าอนุมัติ',
                    rep_forwarded:'ส่งต่อแล้ว', checker_approved:'อนุมัติแล้ว',
                    checker_rejected:'ถูกปฏิเสธ', head_rejected:'ถูกตีกลับ', completed:'เสร็จสิ้น',
                  };
                  const REQ_STATUS_KIND: Record<string,string> = {
                    submitted:'warning', head_approved:'warning', rep_forwarded:'warning',
                    checker_approved:'success', checker_rejected:'danger', head_rejected:'danger', completed:'success',
                  };

                  return (
                    <tr key={r.date} className={`border-t border-[var(--neutral-300)] transition-colors ${
                      isLocked ? 'bg-[var(--neutral-50)] opacity-70' :
                      isRejected ? 'bg-tu-red-soft' :
                      isSel ? 'bg-tu-yellow-soft' : ''
                    }`}>
                      <td className="px-3 py-2">
                        {isLocked ? (
                          <div className="size-4 rounded border-2 border-[var(--neutral-300)] bg-[var(--neutral-100)] cursor-not-allowed" title="ยื่นไปแล้ว" />
                        ) : (
                          <Checkbox
                            checked={isSel}
                            onCheckedChange={c => setSelected(s => c ? [...s, r.date] : s.filter(x => x !== r.date))}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium">{r.date}</td>
                      <td className="px-3 py-2"><StatusChip kind={weekend ? 'danger' : 'neutral'}>{weekend ? 'วันหยุด' : 'วันธรรมดา'}</StatusChip></td>
                      <td className="px-3 py-2 font-mono">{r.in || '-'}</td>
                      <td className="px-3 py-2 font-mono">{r.out || '-'}</td>
                      <td className="px-3 py-2">
                        {isLocked ? (
                          <span className="font-mono text-[var(--neutral-500)]">{parseFloat(r.ot).toFixed(2)}</span>
                        ) : (
                          <>
                            <Input
                              value={hours[r.date] ?? r.ot}
                              onChange={e => setHours(prev => ({ ...prev, [r.date]: e.target.value }))}
                              className={`w-20 h-8 font-mono ${overLimit ? 'bg-tu-red-soft border-tu-red' : ''}`}
                            />
                            {overLimit && <p className="text-[11px] text-danger mt-0.5">เกิน {maxH} ชม.</p>}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono">{weekend ? '70' : '60'} บาท/ชม.</td>
                      <td className="px-3 py-2 font-mono text-success font-semibold">
                        {isLocked ? (
                          <span className="text-[var(--neutral-400)]">{calcAmount(r.date, r.ot).toLocaleString()}</span>
                        ) : calcAmount(r.date, hours[r.date] || r.ot).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        {existing ? (
                          <StatusChip kind={REQ_STATUS_KIND[existing.status] as any}>
                            {REQ_STATUS_LABEL[existing.status] || existing.status}
                          </StatusChip>
                        ) : (
                          <span className="text-[11px] text-[var(--neutral-400)]">ยังไม่ยื่น</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <div className="mt-5">
            <label className="text-[13px] font-medium">เหตุผลการขอเบิก *</label>
            <Textarea className="mt-1" rows={3} placeholder="โปรดระบุเหตุผลและงานที่ปฏิบัติในช่วง OT"
              value={reason} onChange={e => setReason(e.target.value)} />
          </div>
        )}
      </SectionCard>

      {rows.length > 0 && (
        <div className="sticky bottom-0 -mx-8 px-8 py-4 bg-white border-t border-[var(--neutral-300)] shadow-[0_-4px_12px_rgba(0,0,0,0.06)] flex items-center justify-between mt-6">
          <div>
            <p className="text-[13px] text-[var(--neutral-500)]">เลือก <strong className="text-[var(--neutral-black)]">{selected.length}</strong> รายการ</p>
            <p className="text-[20px] font-bold text-success">รวม {total.toLocaleString()} บาท</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSelected([])}>ยกเลิก</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button
                  className="bg-tu-red hover:bg-tu-red-dark text-white h-12 px-8"
                  disabled={selected.length === 0 || !reason.trim() || !!deadline?.is_passed}
                  title={deadline?.is_passed ? 'ปิดรับคำร้องโอทีเดือนนี้แล้ว' : undefined}
                >
                  {deadline?.is_passed ? <><Lock className="size-4 mr-1" />ปิดรับแล้ว</> : 'ส่งคำร้อง'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>ยืนยันการส่งคำร้อง</DialogTitle></DialogHeader>
                <p>ส่งคำร้อง <strong>{selected.length}</strong> รายการ รวม <strong className="text-success">{total.toLocaleString()} บาท</strong> ใช่หรือไม่?</p>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
                  <Button className="bg-tu-red text-white" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'กำลังส่ง...' : 'ยืนยัน'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}
    </>
  );
}

export function StaffStatus({ onEdit, onDetail }: { onEdit?: () => void; onDetail?: (id: number) => void }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('all');
  const token = () => localStorage.getItem('access_token');

  const STATUS_LABEL: Record<string,string> = {
    draft:'ร่าง', submitted:'รออนุมัติ', head_approved:'หัวหน้าอนุมัติ',
    head_rejected:'หัวหน้าตีกลับ', rep_forwarded:'ตัวแทนส่งต่อแล้ว',
    checker_approved:'ผู้ตรวจสอบอนุมัติ', checker_rejected:'ผู้ตรวจสอบตีกลับ', completed:'เสร็จสิ้น',
  };
  const STATUS_KIND: Record<string,string> = {
    draft:'neutral', submitted:'warning', head_approved:'warning',
    head_rejected:'danger', rep_forwarded:'warning',
    checker_approved:'warning', checker_rejected:'danger', completed:'success',
  };
  const isRejected = (s: string) => s === 'head_rejected' || s === 'checker_rejected';
  const isApproved = (s: string) => s === 'completed' || s === 'checker_approved';

  function loadRequests() {
    setLoading(true);
    fetch('/api/ot-requests/', { headers: { 'Authorization': `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : { results: [] })
      .then(d => setRequests(Array.isArray(d) ? d : (d.results || [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(() => { loadRequests(); }, []);

  const counts = {
    all:      requests.length,
    pending:  requests.filter(r => !isRejected(r.status) && !isApproved(r.status) && r.status !== 'draft').length,
    approved: requests.filter(r => isApproved(r.status)).length,
    rejected: requests.filter(r => isRejected(r.status)).length,
  };

  const filtered = tab === 'all'     ? requests
                 : tab === 'pending' ? requests.filter(r => !isRejected(r.status) && !isApproved(r.status) && r.status !== 'draft')
                 : tab === 'approved'? requests.filter(r => isApproved(r.status))
                 : requests.filter(r => isRejected(r.status));

  return (
    <>
      <PageHeader title="สถานะคำร้องของฉัน" right={
        <Button variant="outline" size="sm" onClick={loadRequests} disabled={loading} className="gap-1">
          <span className={loading ? 'animate-spin inline-block' : ''}>🔄</span> รีเฟรช
        </Button>
      } />
      <SectionCard>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">ทั้งหมด <span className="ml-1.5 text-[11px] bg-[var(--neutral-100)] rounded-full px-1.5">{counts.all}</span></TabsTrigger>
            <TabsTrigger value="pending">รออนุมัติ <span className="ml-1.5 text-[11px] bg-tu-yellow-soft text-[var(--warning)] rounded-full px-1.5">{counts.pending}</span></TabsTrigger>
            <TabsTrigger value="approved">อนุมัติแล้ว <span className="ml-1.5 text-[11px] bg-green-100 text-success rounded-full px-1.5">{counts.approved}</span></TabsTrigger>
            <TabsTrigger value="rejected">ถูกตีกลับ <span className="ml-1.5 text-[11px] bg-tu-red-soft text-danger rounded-full px-1.5">{counts.rejected}</span></TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center h-32 gap-3 text-[var(--neutral-500)]">
                <div className="size-7 border-4 border-tu-red border-t-transparent rounded-full animate-spin"/>
                <span>กำลังโหลด...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-[var(--neutral-500)]">ไม่มีคำร้องในหมวดนี้</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--neutral-300)]">
                <table className="w-full text-[13px]">
                  <thead className="bg-tu-red text-white">
                    <tr>{['วันที่ยื่น','วันที่ทำ OT','ประเภท','ชม.','รวมเงิน','สถานะ','Actions'].map(h => <th key={h} className="text-left px-3 py-3">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filtered.map((r: any) => (
                      <tr key={r.id} className={`border-t border-[var(--neutral-300)] ${isRejected(r.status) ? 'bg-tu-red-soft' : ''}`}>
                        <td className="px-3 py-2">{r.created_at ? new Date(r.created_at).toLocaleDateString('th-TH') : '-'}</td>
                        <td className="px-3 py-2">{r.work_date}</td>
                        <td className="px-3 py-2"><StatusChip kind={r.day_type === 'holiday' ? 'danger' : 'neutral'}>{r.day_type === 'holiday' ? 'วันหยุด' : 'วันธรรมดา'}</StatusChip></td>
                        <td className="px-3 py-2 font-mono">{r.ot_hours}</td>
                        <td className="px-3 py-2 font-mono">{parseFloat(r.amount).toLocaleString()}</td>
                        <td className="px-3 py-2"><StatusChip kind={STATUS_KIND[r.status] as any}>{STATUS_LABEL[r.status] || r.status}</StatusChip></td>
                        <td className="px-3 py-2">
                          {isRejected(r.status)
                            ? <Button size="sm" onClick={onEdit} className="bg-tu-red text-white">แก้ไข</Button>
                            : <Button size="sm" variant="ghost" onClick={() => onDetail && onDetail(r.id)}>👁</Button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SectionCard>
    </>
  );
}

export function StaffEditRejected() {
  return (
    <>
      <PageHeader title="แก้ไขคำร้องที่ถูกตีกลับ" />
      <div className="bg-tu-red-soft border border-tu-red rounded-xl p-4 flex items-start gap-3 mb-5">
        <AlertTriangle className="size-5 text-tu-red mt-0.5" />
        <div>
          <p className="font-semibold text-tu-red">คำร้องนี้ถูกตีกลับโดย อรอนงค์ ใจกล้า เมื่อ 12 พ.ค. 2569</p>
          <p className="text-[13px] text-[var(--neutral-700)] mt-1">เหตุผล: ชั่วโมง OT วันที่ 10/5 เกินเกณฑ์ที่กำหนด กรุณาปรับลดให้อยู่ในกรอบ 4 ชั่วโมง</p>
        </div>
      </div>
      <StaffSubmit />
    </>
  );
}

export function StaffProfile() {
  const [saved, setSaved] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    fetch('/api/auth/me/', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setUserInfo(d);
          setEmail(d.email || '');
          setPhone(d.phone || '');
        }
      }).catch(() => {});
  }, []);

  const fullName = userInfo ? `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim() || userInfo.username : '...';
  const empId = userInfo?.employee_id || userInfo?.username || '—';
  const dept = userInfo?.department_name || userInfo?.department || 'งานทะเบียนนักศึกษา';
  const initial = fullName.charAt(0) || '?';

  return (
    <>
      <PageHeader title="โปรไฟล์ของฉัน" />
      {saved && (
        <div className="flex items-center gap-2 p-3 mb-5 bg-green-50 border border-success rounded-xl">
          <CheckCircle2 className="size-5 text-success" />
          <p className="text-success font-semibold">บันทึกข้อมูลเรียบร้อยแล้ว</p>
        </div>
      )}
      <div className="grid grid-cols-3 gap-5">
        <SectionCard>
          <div className="flex flex-col items-center text-center gap-3">
            <Avatar className="size-24"><AvatarFallback className="bg-tu-yellow text-black text-3xl">{initial}</AvatarFallback></Avatar>
            <div>
              <h3>{fullName}</h3>
              <p className="text-[var(--neutral-500)] text-[13px]">{empId}</p>
            </div>
            <div className="text-[13px] space-y-1 w-full text-left">
              <div className="flex justify-between">
                <span className="text-[var(--neutral-500)]">แผนก</span>
                <span className="font-semibold">{dept}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--neutral-500)]">Role</span>
                <span className="font-semibold">Staff</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--neutral-500)]">รหัสพนักงาน</span>
                <span className="font-mono">{empId}</span>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-2">เปลี่ยนรหัสผ่าน</Button>
          </div>
        </SectionCard>

        <SectionCard title="ข้อมูลส่วนตัว" className="col-span-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label>ชื่อ-นามสกุล <span className="text-[var(--neutral-500)] text-[11px]">(readonly)</span></label>
              <Input className="mt-1" value={fullName} readOnly />
            </div>
            <div>
              <label>แผนก <span className="text-[var(--neutral-500)] text-[11px]">(readonly)</span></label>
              <Input className="mt-1" value={dept} readOnly />
            </div>
            <div>
              <label>รหัสพนักงาน <span className="text-[var(--neutral-500)] text-[11px]">(readonly)</span></label>
              <Input className="mt-1" value={empId} readOnly />
            </div>
            <div>
              <label>อีเมลติดต่อ</label>
              <Input className="mt-1" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label>เบอร์โทร</label>
              <Input className="mt-1" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>

            <div className="col-span-2 mt-1 p-4 bg-tu-yellow-soft border border-tu-yellow rounded-xl">
              <label className="font-semibold block mb-1">อีเมลสำหรับรับแจ้งเตือนเอกสาร OT</label>
              <p className="text-[12px] text-[var(--neutral-500)] mb-2">
                ระบบจะส่งแจ้งเตือนให้ที่อีเมลนี้เมื่อเอกสารคำร้องมีความคืบหน้า (อนุมัติ / ตีกลับ)
              </p>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="กรอกอีเมลสำหรับรับการแจ้งเตือน" />
            </div>

            <label className="col-span-2 flex items-center justify-between border border-[var(--neutral-300)] rounded-lg px-4 py-3">
              <div>
                <span className="font-medium">เปิดรับการแจ้งเตือนทางอีเมล</span>
                <p className="text-[12px] text-[var(--neutral-500)] mt-0.5">แจ้งเมื่อมีการอนุมัติ, ตีกลับ หรืออัปเดตสถานะคำร้อง</p>
              </div>
              <Switch defaultChecked />
            </label>
          </div>

          <div className="flex justify-end mt-5">
            <Button className="bg-tu-red hover:bg-tu-red-dark text-white" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 3000); }}>
              บันทึกข้อมูล
            </Button>
          </div>
        </SectionCard>
      </div>
    </>
  );
}

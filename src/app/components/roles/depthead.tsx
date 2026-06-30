import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  LayoutDashboard, Inbox, History, Users, FileBarChart, ChevronRight,
  CheckCircle2, X, AlertTriangle, Download, Send, PlusCircle, Clock,
} from 'lucide-react';
import { NavItem } from '../AppShell';
import { KpiCard, PageHeader, SectionCard, StatusChip } from '../shared';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Progress } from '../ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';

function downloadXlsx(wb: XLSX.WorkBook, filename: string) {
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
}

export const HEAD_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard',       icon: <LayoutDashboard /> },
  { key: 'pending',   label: 'คำร้องรออนุมัติ',  icon: <Inbox /> },
  { key: 'history',   label: 'ประวัติการอนุมัติ', icon: <History /> },
  { key: 'members',   label: 'สมาชิกในแผนก',    icon: <Users /> },
  { key: 'report',    label: 'รายงานแผนก',      icon: <FileBarChart /> },
];

function HeadBreadcrumb({ page }: { page: string }) {
  const labels: Record<string, string> = {
    dashboard: 'Dashboard',
    pending:   'คำร้องรออนุมัติ',
    history:   'ประวัติการอนุมัติ',
    members:   'สมาชิกในแผนก',
    report:    'รายงานแผนก',
  };
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-[var(--neutral-500)] mb-4">
      <span>หัวหน้างาน</span>
      <ChevronRight className="size-3" />
      <span className="text-[var(--neutral-800)] font-medium">{labels[page] ?? page}</span>
    </div>
  );
}

const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const THAI_MONTHS_FULL  = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

/** แปลง YYYY-MM-DD → DD/MM/YYYY พ.ศ. */
function fmtDate(s: string | null | undefined): string {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const day   = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year  = d.getUTCFullYear() + 543;
  return `${day}/${month}/${year}`;
}

/** แปลง ISO datetime → DD/MM/YYYY พ.ศ. (local time) */
function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const day   = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year  = d.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

/** ตัดเวลาให้เหลือ HH:MM */
function fmtTime(t: string | null | undefined): string {
  if (!t) return '-';
  return t.substring(0, 5);
}

const DASH_PERIODS = [
  { value: 'month',   label: 'รายเดือน' },
  { value: 'quarter', label: 'ไตรมาส' },
  { value: 'half',    label: 'ครึ่งปีงบ' },
  { value: 'year',    label: 'ปีงบประมาณ' },
];

export function HeadDashboard({ onGo, onBudgetRequest }: { onGo: () => void; onBudgetRequest?: () => void }) {
  const _now = new Date();
  const _curThaiYear = _now.getFullYear() + 543 + (_now.getMonth() >= 9 ? 1 : 0);
  const _curMon = _now.getMonth() + 1;
  const _curQ   = _curMon >= 10 ? '1' : _curMon <= 3 ? '2' : _curMon <= 6 ? '3' : '4';

  const [allRequests, setAllRequests] = useState<any[]>([]);
  const [budget, setBudget]           = useState<number | null>(null);
  const [period, setPeriod]           = useState('month');
  const [selThaiYear, setSelThaiYear] = useState(String(_curThaiYear));
  const [selMonth, setSelMonth]       = useState(String(_now.getMonth() + 1).padStart(2, '0'));
  const [selQuarter, setSelQuarter]   = useState(_curQ);
  const [loading, setLoading]         = useState(true);
  const [noOtConfirm, setNoOtConfirm]     = useState(false);
  const [noOtSending, setNoOtSending]     = useState(false);
  const [noOtToast, setNoOtToast]         = useState<{ ok: boolean; msg: string } | null>(null);
  // เก็บ set ของ "gregYear-month" ที่แจ้งไปแล้ว
  const [noOtDeclared, setNoOtDeclared]   = useState<Set<string>>(new Set());

  // ไม่ใช้ yearOptions แล้ว — เปลี่ยนเป็น input กรอกปีเอง

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const h = { 'Authorization': `Bearer ${token}` };
    Promise.all([
      fetch('/api/auth/me/', { headers: h }).then(r => r.ok ? r.json() : null),
      fetch('/api/ot-requests/', { headers: h }).then(r => r.ok ? r.json() : null),
      fetch('/api/no-ot-declaration/', { headers: h }).then(r => r.ok ? r.json() : []),
    ]).then(([me, d, declarations]) => {
      const arr: any[] = Array.isArray(d) ? d : (d?.results || []);
      setAllRequests(arr);
      if (Array.isArray(declarations)) {
        const keys = new Set<string>(declarations.map((dec: any) => `${dec.greg_year}-${dec.month}`));
        setNoOtDeclared(keys);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // ดึงงบประมาณของเดือน/ปีที่เลือกใหม่ทุกครั้งที่ผู้ใช้เปลี่ยนตัวกรอง
  // (งบเป็นแบบรายเดือนแล้ว ต้องดึงตามเดือนที่กำลังดูจริง ไม่ใช่ดึงครั้งเดียวตอนเปิดหน้า)
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const h = { 'Authorization': `Bearer ${token}` };
    const gregYear = parseInt(selThaiYear) - 543;
    const monthNum = period === 'month' ? parseInt(selMonth) : _now.getMonth() + 1;
    const actualGregYear = period === 'month' && monthNum >= 10 ? gregYear - 1 : gregYear;
    const monthStr = `${actualGregYear}-${String(monthNum).padStart(2, '0')}`;

    fetch('/api/auth/me/', { headers: h }).then(r => r.ok ? r.json() : null).then(me => {
      if (!me) return;
      fetch(`/api/checker/budget/?month=${monthStr}`, { headers: h }).then(r => r.ok ? r.json() : null).then(budgets => {
        if (!budgets) { setBudget(null); return; }
        const budgetList: any[] = Array.isArray(budgets) ? budgets : (budgets.departments || []);
        const myDept = budgetList.find((b: any) => b.id === me.department || b.id === Number(me.department));
        setBudget(myDept ? (myDept.ot_budget ?? myDept.budget ?? 0) : 0);
      });
    }).catch(() => {});
  }, [selThaiYear, selMonth, period]);

  // ── ฟังก์ชัน filter เดียวกับ HeadReport ────────────────────────────────
  function inRangeDash(dateStr: string): boolean {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const gregYear = parseInt(selThaiYear) - 543;
    if (period === 'month') {
      const monthNum = parseInt(selMonth);
      const actualGregYear = monthNum >= 10 ? gregYear - 1 : gregYear;
      return y === actualGregYear && m === monthNum;
    } else if (period === 'quarter') {
      const Q_MAP: Record<string, { months: number[]; year: number }[]> = {
        '1': [{ months: [10,11,12], year: gregYear - 1 }],
        '2': [{ months: [1,2,3],   year: gregYear }],
        '3': [{ months: [4,5,6],   year: gregYear }],
        '4': [{ months: [7,8,9],   year: gregYear }],
      };
      return (Q_MAP[selQuarter] || []).some(({ months, year }) => year === y && months.includes(m));
    } else if (period === 'half') {
      const h1 = (y === gregYear - 1 && m >= 10) || (y === gregYear && m <= 3);
      const h2 = y === gregYear && m >= 4 && m <= 9;
      return selQuarter === '1' ? h1 : h2;
    } else {
      return (y === gregYear - 1 && m >= 10) || (y === gregYear && m <= 9);
    }
  }

  // คำนวณ KPI
  const selArr    = allRequests.filter(r => r.work_date && inRangeDash(r.work_date));
  const pending   = allRequests.filter(r => r.status === 'submitted').length;
  // approved — filter ตาม period เดียวกัน
  const approved  = selArr.filter(r => ['head_approved','rep_forwarded','checker_approved','completed'].includes(r.status)).length;
  const totalBaht = selArr.reduce((s: number, r: any) =>
    s + Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60), 0);

  // งบประมาณสำหรับช่วงที่เลือก
  const periodMultiplier = period === 'month' ? 1 : period === 'quarter' ? 3 : period === 'half' ? 6 : 12;
  const periodBudget     = budget !== null ? budget * periodMultiplier : null;
  const periodBudgetLabel = period === 'month' ? 'งบประมาณรายเดือน'
    : period === 'quarter' ? `งบประมาณไตรมาส`
    : period === 'half'    ? `งบประมาณครึ่งปี`
    : `งบประมาณปีงบ`;

  // Top5
  const staffMap: Record<string, number> = {};
  selArr.forEach((r: any) => {
    const name = (r.staff_name || 'ไม่ระบุ').split(' ')[0];
    staffMap[name] = (staffMap[name] || 0) + parseFloat(r.ot_hours || 0);
  });
  const chartData = Object.entries(staffMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }));

  // Trend — แสดงตามช่วงเวลาจริงของ period ที่เลือก
  const gregYear = parseInt(selThaiYear) - 543;

  function getPeriodMonths(): { year: number; month: number }[] {
    if (period === 'month') {
      // 6 เดือนย้อนหลังจากเดือนที่เลือก
      const m = parseInt(selMonth);
      const endYear = m >= 10 ? gregYear - 1 : gregYear;
      return Array.from({ length: 6 }, (_, i) => {
        const d2 = new Date(endYear, m - 1 - (5 - i), 1);
        return { year: d2.getFullYear(), month: d2.getMonth() + 1 };
      });
    } else if (period === 'quarter') {
      const Q: Record<string, { months: number[]; year: number }> = {
        '1': { months: [10, 11, 12], year: gregYear - 1 },
        '2': { months: [1, 2, 3],   year: gregYear },
        '3': { months: [4, 5, 6],   year: gregYear },
        '4': { months: [7, 8, 9],   year: gregYear },
      };
      const q = Q[selQuarter] || Q['1'];
      return q.months.map(m => ({ year: q.year, month: m }));
    } else if (period === 'half') {
      if (selQuarter === '1') {
        // ต.ค.(ปีก่อน) – มี.ค.(ปีนี้)
        return [
          { year: gregYear - 1, month: 10 }, { year: gregYear - 1, month: 11 }, { year: gregYear - 1, month: 12 },
          { year: gregYear, month: 1 },  { year: gregYear, month: 2 },  { year: gregYear, month: 3 },
        ];
      } else {
        // เม.ย. – ก.ย.
        return [4, 5, 6, 7, 8, 9].map(m => ({ year: gregYear, month: m }));
      }
    } else {
      // ปีงบ: ต.ค.(ปีก่อน) – ก.ย.(ปีนี้) = 12 เดือน
      return [
        { year: gregYear - 1, month: 10 }, { year: gregYear - 1, month: 11 }, { year: gregYear - 1, month: 12 },
        ...Array.from({ length: 9 }, (_, i) => ({ year: gregYear, month: i + 1 })),
      ];
    }
  }

  const periodMonths = getPeriodMonths();
  const trendMap: Record<string, number> = {};
  periodMonths.forEach(({ year, month }) => {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    trendMap[key] = 0;
  });
  allRequests.forEach((r: any) => {
    const key = (r.work_date || '').substring(0, 7);
    if (key in trendMap) {
      trendMap[key] += Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60);
    }
  });
  const trendData = Object.entries(trendMap).map(([k, v]) => ({
    m: THAI_MONTHS_SHORT[parseInt(k.split('-')[1]) - 1], v,
  }));
  const trendTitle = period === 'month' ? 'แนวโน้ม OT 6 เดือนย้อนหลัง'
    : period === 'quarter' ? `OT ไตรมาส ${selQuarter} (3 เดือน)`
    : period === 'half' ? `OT ครึ่ง${selQuarter === '1' ? 'แรก' : 'หลัง'} (6 เดือน)`
    : `OT ปีงบประมาณ ${selThaiYear} (12 เดือน)`;

  const selMonthLabel = period === 'month'
    ? `${THAI_MONTHS_FULL[parseInt(selMonth) - 1]} ${selThaiYear}`
    : period === 'quarter' ? `ไตรมาส ${selQuarter} ปี ${selThaiYear}`
    : period === 'half' ? `ครึ่ง${selQuarter === '1' ? 'แรก' : 'หลัง'} ปี ${selThaiYear}`
    : `ปีงบ ${selThaiYear}`;
  const overBudget = periodBudget !== null && periodBudget > 0 && totalBaht > periodBudget;

  // ── แจ้งไม่มีOTเดือนนี้ ───────────────────────────────────────────────
  async function handleDeclareNoOT() {
    setNoOtSending(true);
    const gregYear = parseInt(selThaiYear) - 543;
    const month    = parseInt(selMonth);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/no-ot-declaration/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ greg_year: gregYear, month }),
      });
      if (res.status === 409) {
        // ถือว่า declared แล้ว — ล็อกปุ่มด้วย
        setNoOtDeclared(prev => new Set(prev).add(`${gregYear}-${month}`));
        setNoOtToast({ ok: false, msg: 'แจ้งเดือนนี้ไปแล้ว' });
      } else if (res.ok) {
        setNoOtDeclared(prev => new Set(prev).add(`${gregYear}-${month}`));
        setNoOtToast({ ok: true, msg: 'แจ้งสำเร็จ — ส่งการแจ้งเตือนไปยังตัวแทนฝ่ายและผู้ตรวจสอบแล้ว' });
      } else {
        setNoOtToast({ ok: false, msg: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
      }
    } catch {
      setNoOtToast({ ok: false, msg: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
    } finally {
      setNoOtSending(false);
      setNoOtConfirm(false);
      setTimeout(() => setNoOtToast(null), 4000);
    }
  }

  // card base style — ทุก card ใช้ h เท่ากัน
  const card = 'bg-white rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] border border-[var(--neutral-300)] flex flex-col justify-between min-h-[140px]';

  return (
    <>
      <HeadBreadcrumb page="dashboard" />
      <PageHeader
        title="Dashboard หัวหน้างาน"
        right={
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={v => {
              setPeriod(v);
              // reset quarter default: ครึ่งปีงบ → ครึ่งแรก, ไตรมาส → ไตรมาสปัจจุบัน
              if (v === 'half') setSelQuarter('1');
              if (v === 'quarter') setSelQuarter(_curQ);
            }}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DASH_PERIODS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={selThaiYear}
              onChange={e => setSelThaiYear(e.target.value)}
              className="w-[90px] text-center"
              min={2560}
              max={2599}
            />
            {period === 'month' && (
              <Select value={selMonth} onValueChange={setSelMonth}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {THAI_MONTHS_FULL.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1).padStart(2, '0')}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(period === 'quarter' || period === 'half') && (
              <Select value={selQuarter} onValueChange={setSelQuarter}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {period === 'quarter'
                    ? ['1','2','3','4'].map(q => <SelectItem key={q} value={q}>ไตรมาส {q}</SelectItem>)
                    : [{ v:'1', l:'ครึ่งแรก (ต.ค.–มี.ค.)' },{ v:'2', l:'ครึ่งหลัง (เม.ย.–ก.ย.)' }]
                        .map(h => <SelectItem key={h.v} value={h.v}>{h.l}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            )}
          </div>
        }
      />

      {/* 4 KPI cards */}
      <div className="grid grid-cols-4 gap-5 mb-4">
        {/* card 1 — รออนุมัติ */}
        <div className={card}>
          <p className="text-[12px] text-[var(--neutral-500)]">คำร้องรออนุมัติ</p>
          <p className="text-[32px] font-bold text-orange-600 tabular-nums">{loading ? '—' : pending}</p>
          <Button size="sm" onClick={onGo} className="bg-tu-red text-white">
            ไปอนุมัติ <ChevronRight className="size-4 ml-1" />
          </Button>
        </div>

        {/* card 2 — อนุมัติแล้ว (ตาม period) */}
        <div className={card}>
          <div>
            <p className="text-[12px] text-[var(--neutral-500)]">อนุมัติแล้ว</p>
            <p className="text-[11px] text-[var(--neutral-400)]">{selMonthLabel}</p>
          </div>
          <p className="text-[32px] font-bold text-success tabular-nums">{loading ? '—' : approved}</p>
          <p className="text-[11px] text-[var(--neutral-500)]">รายการ</p>
        </div>

        {/* card 3 — ยอด OT รวมแผนก */}
        <div className={card}>
          <div>
            <p className="text-[12px] text-[var(--neutral-500)]">ยอดรวม OT ของแผนก</p>
            <p className="text-[11px] text-[var(--neutral-400)]">{selMonthLabel}</p>
          </div>
          <p className="text-[28px] font-bold text-tu-red tabular-nums">
            {loading ? '—' : totalBaht.toLocaleString()}
          </p>
          {periodBudget !== null && (
            <div>
              <div className="flex justify-between text-[11px] text-[var(--neutral-500)] mb-0.5">
                <span>งบ {periodBudget.toLocaleString()} บาท</span>
                <span>{periodBudget > 0 ? Math.min(100, Math.round(totalBaht / periodBudget * 100)) : 0}%</span>
              </div>
              <Progress value={periodBudget > 0 ? Math.min(100, Math.round(totalBaht / periodBudget * 100)) : 0} className="h-1.5" />
            </div>
          )}
        </div>

        {/* card 4 — งบประมาณตาม period */}
        <div className={card}>
          <div>
            <p className="text-[12px] text-[var(--neutral-500)]">{periodBudgetLabel}</p>
            {period !== 'month' && budget !== null && (
              <p className="text-[11px] text-[var(--neutral-400)]">{budget.toLocaleString()} บาท/เดือน × {periodMultiplier}</p>
            )}
          </div>
          <p className="text-[28px] font-bold text-[var(--neutral-800)] tabular-nums">
            {periodBudget !== null ? periodBudget.toLocaleString() : '—'}
          </p>
          <p className="text-[11px] text-[var(--neutral-500)]">บาท</p>
        </div>
      </div>

      {/* alert banner ใต้ cards ทันที */}
      {overBudget && (
        <div className="bg-tu-red-soft border border-tu-red rounded-xl p-4 flex items-start gap-3 mb-5">
          <AlertTriangle className="size-5 text-tu-red shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-tu-red">แผนกของคุณมียอด OT เกินงบประมาณที่ตั้งไว้</p>
            <p className="text-[13px] mt-1">
              ยอด OT ช่วง{selMonthLabel} สูงกว่าเพดาน <strong>{periodBudget!.toLocaleString()} บาท</strong>
              {' '}— กรุณาดำเนินการขออนุมัติงบประมาณเพิ่มเติมตามขั้นตอนภายนอกระบบ
              แล้วแจ้งผู้ตรวจสอบอัปเดตเพดานใหม่
            </p>
          </div>
        </div>
      )}

      {/* แจ้งไม่มี OT เดือนนี้ — แสดงเมื่อ period=month */}
      {period === 'month' && (() => {
        const gregYear = parseInt(selThaiYear) - 543;
        const declaredKey = `${gregYear}-${parseInt(selMonth)}`;
        const alreadyDeclared = noOtDeclared.has(declaredKey);
        return alreadyDeclared ? (
          <div className="flex items-center gap-3 bg-green-50 border border-green-300 rounded-xl px-5 py-4 mb-5">
            <CheckCircle2 className="size-6 text-green-600 shrink-0" />
            <div>
              <p className="text-[14px] font-semibold text-green-800">แจ้งไม่มี OT เดือนนี้เรียบร้อยแล้ว</p>
              <p className="text-[12px] text-green-700 mt-0.5">ตัวแทนฝ่ายและผู้ตรวจสอบได้รับแจ้งแล้ว</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-orange-50 border border-orange-300 rounded-xl px-5 py-4 mb-5">
            <div className="flex items-center gap-3">
              <Send className="size-5 text-orange-500 shrink-0" />
              <div>
                <p className="text-[14px] font-semibold text-orange-800">แผนกไม่มีการทำ OT เดือนนี้?</p>
                <p className="text-[12px] text-orange-700 mt-0.5">กดปุ่มเพื่อแจ้งตัวแทนฝ่ายและผู้ตรวจสอบ</p>
              </div>
            </div>
            <Button
              className="gap-2 bg-orange-500 hover:bg-orange-600 text-white shrink-0 ml-4"
              onClick={() => setNoOtConfirm(true)}
            >
              <Send className="size-4" />
              แจ้งไม่มี OT เดือนนี้
            </Button>
          </div>
        );
      })()}

      {/* toast — บนกลาง */}
      {noOtToast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3 rounded-xl shadow-xl text-white text-[13px] whitespace-nowrap ${noOtToast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {noOtToast.ok ? <CheckCircle2 className="size-5 shrink-0" /> : <AlertTriangle className="size-5 shrink-0" />}
          {noOtToast.msg}
        </div>
      )}

      {/* confirm dialog */}
      <Dialog open={noOtConfirm} onOpenChange={setNoOtConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แจ้งไม่มีOTประจำเดือน</DialogTitle>
          </DialogHeader>
          <p className="text-[14px] text-[var(--neutral-600)]">
            ยืนยันการแจ้งว่าแผนกของคุณ<strong>ไม่มีการทำ OT</strong>ประจำเดือน
            <strong> {THAI_MONTHS_FULL[parseInt(selMonth) - 1]} {selThaiYear}</strong>
          </p>
          <p className="text-[12px] text-[var(--neutral-500)]">
            ระบบจะส่งการแจ้งเตือนไปยังตัวแทนฝ่ายและผู้ตรวจสอบโดยอัตโนมัติ
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoOtConfirm(false)} disabled={noOtSending}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleDeclareNoOT}
              disabled={noOtSending}
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
            >
              <Send className="size-4" />
              {noOtSending ? 'กำลังส่ง...' : 'ยืนยันแจ้ง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* charts */}
      <div className="grid grid-cols-2 gap-5">
        <SectionCard title="พนักงานที่ทำ OT สูงสุด 5 อันดับ">
          <p className="text-[11px] text-[var(--neutral-500)] mb-3">ยอด OT สะสม <strong>{selMonthLabel}</strong> · หน่วย: ชั่วโมง (ชม.)</p>
          <div className="h-[220px]">
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[var(--neutral-400)] text-[13px]">
                ยังไม่มีข้อมูล OT เดือนนี้
              </div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={chartData} layout="vertical" margin={{ left: 30, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" />
                  <Tooltip formatter={(v: any) => [v + ' ชม.', 'ชั่วโมง OT']} />
                  <Bar dataKey="hours" fill="#B8001F" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
        <SectionCard title={trendTitle}>
          <p className="text-[11px] text-[var(--neutral-500)] mb-3">ยอด OT <strong>รายเดือน</strong> (บาท) · {selMonthLabel}</p>
          <div className="h-[220px]">
            {loading ? (
              <div className="flex items-center justify-center h-full text-[var(--neutral-400)] text-[13px]">กำลังโหลด...</div>
            ) : (
              <ResponsiveContainer>
                <LineChart data={trendData} margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="m" />
                  <YAxis tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                  <Tooltip formatter={(v: any) => [Number(v).toLocaleString() + ' บาท', 'ยอด OT']} />
                  <Line type="monotone" dataKey="v" stroke="#B8001F" strokeWidth={3} dot={{ r: 5, fill: '#FFD400' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
      </div>
    </>
  );
}

export function HeadPending({ onDetail }: { onDetail: (id: number) => void }) {
  const _n = new Date();
  const _curThaiYearPending = _n.getFullYear() + 543;
  const [thaiYear, setThaiYear] = useState(String(_curThaiYearPending));
  const [selMonth, setSelMonth] = useState(_n.getMonth() + 1);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<number[]>([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [search, setSearch] = useState('');
  const [actionMsg, setActionMsg] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);
  const token = () => localStorage.getItem('access_token');

  function loadRequests() {
    setLoading(true);
    fetch('/api/ot-requests/?status=submitted', { headers: { 'Authorization': `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setRequests(Array.isArray(d) ? d : (d.results || [])); })
      .catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { loadRequests(); }, []);

  const gregYearPending = parseInt(thaiYear) - 543;

  const filtered = requests.filter(r => {
    if (search && !(r.staff_name || '').toLowerCase().includes(search.toLowerCase())) return false;
    const d = new Date(r.work_date);
    return d.getFullYear() === gregYearPending && d.getMonth() + 1 === selMonth;
  });
  const all = filtered.length > 0 && sel.length === filtered.length;
  const totalAmount = filtered.filter(r => sel.includes(r.id)).reduce((s, r) => s + Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60), 0);

  async function handleApprove() {
    const tok = token();
    for (const id of sel) {
      await fetch(`/api/ot-requests/${id}/approve/`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    }
    setSel([]);
    setActionMsg({ kind: 'success', text: `อนุมัติ ${sel.length} คำร้องเรียบร้อยแล้ว` });
    setTimeout(() => setActionMsg(null), 3000);
    loadRequests();
  }

  async function handleRejectConfirm() {
    const tok = token();
    for (const id of sel) {
      await fetch(`/api/ot-requests/${id}/reject/`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: rejectReason }),
      });
    }
    setRejectOpen(false);
    setSel([]);
    setRejectReason('');
    setActionMsg({ kind: 'danger', text: `ตีกลับ ${sel.length} คำร้องเรียบร้อยแล้ว` });
    setTimeout(() => setActionMsg(null), 3000);
    loadRequests();
  }

  return (
    <>
      <HeadBreadcrumb page="pending" />
      <PageHeader
        title="คำร้องรออนุมัติ"
        subtitle={`${filtered.length} รายการ รอการพิจารณา · ${THAI_MONTHS_FULL[selMonth - 1]} ${thaiYear}`}
        right={
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={thaiYear}
              onChange={e => { setThaiYear(e.target.value); setSel([]); }}
              className="w-[90px] text-center"
              min={2560}
              max={2599}
            />
            <Select value={String(selMonth)} onValueChange={v => { setSelMonth(Number(v)); setSel([]); }}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {THAI_MONTHS_FULL.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {actionMsg && (
        <div className={`flex items-center gap-2 p-3 mb-4 rounded-xl border ${actionMsg.kind === 'success' ? 'bg-green-50 border-success text-success' : 'bg-tu-red-soft border-tu-red text-tu-red'}`}>
          {actionMsg.kind === 'success' ? <CheckCircle2 className="size-4" /> : <X className="size-4" />}
          <p className="font-semibold text-[13px]">{actionMsg.text}</p>
        </div>
      )}

      <SectionCard>
        <div className="mb-4">
          <Input placeholder="ค้นหาชื่อพนักงาน" value={search} onChange={e => setSearch(e.target.value)} className="max-w-[300px]" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 gap-3 text-[var(--neutral-500)]">
            <div className="size-7 border-4 border-tu-red border-t-transparent rounded-full animate-spin" />
            <span>กำลังโหลด...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[var(--neutral-500)]">
            <CheckCircle2 className="size-12 mx-auto mb-3 text-success opacity-50" />
            <p className="font-semibold">ไม่มีคำร้องรออนุมัติ</p>
            <p className="text-[12px] mt-1">คำร้องทั้งหมดได้รับการพิจารณาแล้ว</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--neutral-300)]">
            <table className="w-full text-[13px]">
              <thead className="bg-tu-red text-white"><tr>
                <th className="px-3 py-3">
                  <Checkbox checked={all} onCheckedChange={c => setSel(c ? filtered.map(r => r.id) : [])} />
                </th>
                {['พนักงาน','วันที่ทำ OT','ประเภท','ชม.','รวมเงิน','วันที่ยื่น','Action'].map(h => (
                  <th key={h} className="text-left px-3 py-3">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className={`border-t border-[var(--neutral-300)] ${sel.includes(r.id) ? 'bg-tu-yellow-soft' : 'hover:bg-[var(--neutral-50)]'}`}>
                    <td className="px-3 py-2">
                      <Checkbox checked={sel.includes(r.id)} onCheckedChange={c => setSel(s => c ? [...s, r.id] : s.filter(x => x !== r.id))} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7"><AvatarFallback className="bg-tu-yellow text-black text-[11px]">{(r.staff_name || '?').charAt(0)}</AvatarFallback></Avatar>
                        <span>{r.staff_name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">{fmtDate(r.work_date)}</td>
                    <td className="px-3 py-2"><StatusChip kind={r.day_type === 'holiday' ? 'danger' : 'neutral'}>{r.day_type === 'holiday' ? 'วันหยุด' : 'วันธรรมดา'}</StatusChip></td>
                    <td className="px-3 py-2 font-mono">{Math.floor(parseFloat(r.ot_hours))}</td>
                    <td className="px-3 py-2 font-mono font-semibold">{(Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60)).toLocaleString()}</td>
                    <td className="px-3 py-2 text-[var(--neutral-500)]">{fmtDateTime(r.created_at)}</td>
                    <td className="px-3 py-2 flex gap-1">
                      <Button size="sm" className="bg-success text-white h-7" onClick={async () => {
                        await fetch(`/api/ot-requests/${r.id}/approve/`, {
                          method: 'POST', headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
                          body: JSON.stringify({}),
                        });
                        setActionMsg({ kind: 'success', text: 'อนุมัติเรียบร้อยแล้ว' });
                        setTimeout(() => setActionMsg(null), 3000);
                        loadRequests();
                      }}>✓</Button>
                      <Button size="sm" variant="outline" onClick={() => onDetail(r.id)} className="border-tu-red text-tu-red h-7">ดู</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {sel.length > 0 && (
        <div className="sticky bottom-0 -mx-8 px-8 py-4 bg-white border-t border-[var(--neutral-300)] shadow-[0_-4px_12px_rgba(0,0,0,0.06)] flex items-center justify-between mt-6">
          <div>
            <p className="text-[13px] text-[var(--neutral-500)]">เลือก <strong className="text-[var(--neutral-black)]">{sel.length}</strong> รายการ</p>
            <p className="text-[18px] font-bold text-success">รวม {Math.round(totalAmount).toLocaleString()} บาท</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSel([])}>ยกเลิก</Button>
            <Button className="bg-success hover:bg-success/90 text-white" onClick={handleApprove}>
              <CheckCircle2 className="size-4 mr-1" />อนุมัติทั้งหมดที่เลือก ({sel.length})
            </Button>
            <Button className="bg-danger hover:bg-danger/90 text-white" onClick={() => setRejectOpen(true)}>
              <X className="size-4 mr-1" />ตีกลับ ({sel.length})
            </Button>
          </div>
        </div>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader><DialogTitle>ระบุเหตุผลการตีกลับ</DialogTitle></DialogHeader>
          <div className="py-2">
            <p className="text-[13px] text-[var(--neutral-500)] mb-3">
              ตีกลับ <strong>{sel.length}</strong> คำร้อง — พนักงานจะเห็นเหตุผลนี้และสามารถแก้ไขยื่นใหม่ได้
            </p>
            <label className="text-[13px] font-medium block mb-1">เหตุผลในการตีกลับ <span className="text-[var(--neutral-400)]">(ไม่บังคับ)</span></label>
            <Textarea rows={6} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="เช่น เอกสารไม่ครบถ้วน / OT เกินเกณฑ์ที่กำหนด / ไม่มีเหตุผลความจำเป็นเพียงพอ ฯลฯ" />
            <p className="text-[11px] text-[var(--neutral-500)] mt-1">{rejectReason.length} / 200 ตัวอักษร</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>ยกเลิก</Button>
            <Button className="bg-danger hover:bg-danger/90 text-white" onClick={handleRejectConfirm}>
              <X className="size-4 mr-1" />ยืนยันตีกลับ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const DETAIL_ROWS = Array.from({ length: 5 }, (_, i) => ({
  id: i, day: 2 + i * 4, weekend: i === 3, hours: i === 3 ? 5 : 1.5, in: '08:00', out: '18:30', rate: 234,
}));

export function HeadDetail() {
  const [sel, setSel] = useState<number[]>([0, 1, 2]);
  const allSelected = sel.length === DETAIL_ROWS.length;
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<'selected' | 'all'>('all');
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);

  function openReject(target: 'selected' | 'all') {
    setRejectTarget(target);
    setRejectOpen(true);
  }

  function handleRejectConfirm() {
    setRejectOpen(false);
    setRejected(true);
    setRejectReason('');
  }

  if (approved) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="size-20 rounded-full bg-green-100 grid place-items-center">
        <CheckCircle2 className="size-12 text-success" />
      </div>
      <h2>อนุมัติคำร้องแล้ว</h2>
      <p className="text-[var(--neutral-500)]">คำร้องของสมชาย สุขใจ ได้รับการอนุมัติเรียบร้อย</p>
    </div>
  );

  if (rejected) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="size-20 rounded-full bg-tu-red-soft grid place-items-center">
        <X className="size-12 text-danger" />
      </div>
      <h2>ตีกลับคำร้องแล้ว</h2>
      <p className="text-[var(--neutral-500)]">แจ้งเหตุผลให้สมชาย สุขใจ ทราบทางอีเมลแล้ว</p>
    </div>
  );

  return (
    <>
      <PageHeader title="รายละเอียดคำร้อง" />
      <SectionCard className="mb-5">
        <div className="flex items-center gap-5">
          <Avatar className="size-16"><AvatarFallback className="bg-tu-yellow text-black text-2xl">ส</AvatarFallback></Avatar>
          <div className="flex-1">
            <h2>สมชาย สุขใจ <span className="text-[var(--neutral-500)] font-normal text-[14px]">EMP-1024</span></h2>
            <p className="text-[var(--neutral-500)]">งานทะเบียนนักศึกษา • เจ้าหน้าที่ระดับ 4 • อัตรา OT: 156 บาท/ชม.</p>
          </div>
          <div className="text-right"><p className="text-[12px] text-[var(--neutral-500)]">ยอดรวมคำร้อง</p><p className="text-[28px] font-bold text-tu-red tabular-nums">2,808 บาท</p></div>
        </div>
      </SectionCard>

      <SectionCard title="รายวันที่ขอเบิก">
        <div className="overflow-x-auto rounded-lg border border-[var(--neutral-300)]">
          <table className="w-full text-[13px]">
            <thead className="bg-tu-red text-white"><tr>
              <th className="px-3 py-3">
                <Checkbox checked={allSelected} onCheckedChange={c => setSel(c ? DETAIL_ROWS.map(r => r.id) : [])} />
              </th>
              {['วันที่','ประเภท','เข้า','ออก','ชม.','อัตรา','จำนวนเงิน','สถานะ'].map(h => <th key={h} className="text-left px-3 py-3">{h}</th>)}
            </tr></thead>
            <tbody>
              {DETAIL_ROWS.map(r => (
                <tr key={r.id} className={`border-t border-[var(--neutral-300)] ${sel.includes(r.id) ? 'bg-tu-yellow-soft' : ''}`}>
                  <td className="px-3 py-2"><Checkbox checked={sel.includes(r.id)} onCheckedChange={c => setSel(s => c ? [...s, r.id] : s.filter(x => x !== r.id))} /></td>
                  <td className="px-3 py-2">{r.day}/5/69</td>
                  <td className="px-3 py-2"><StatusChip kind={r.weekend ? 'danger' : 'neutral'}>{r.weekend ? 'วันหยุด' : 'วันธรรมดา'}</StatusChip></td>
                  <td className="px-3 py-2 font-mono">{r.in}</td>
                  <td className="px-3 py-2 font-mono">{r.out}</td>
                  <td className="px-3 py-2 font-mono">{r.hours}</td>
                  <td className="px-3 py-2 font-mono">{r.weekend ? 70 : 60} บ/ชม.</td>
                  <td className="px-3 py-2 font-mono">{(Math.floor(r.hours) * (r.weekend ? 70 : 60)).toLocaleString()}</td>
                  <td className="px-3 py-2"><StatusChip kind="warning">รออนุมัติ</StatusChip></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="sticky bottom-0 -mx-8 px-8 py-4 bg-white border-t border-[var(--neutral-300)] flex justify-end gap-2 mt-6">
        <Button className="bg-success hover:bg-success/90 text-white" onClick={() => setApproved(true)}>
          <CheckCircle2 className="size-4 mr-1" />อนุมัติเฉพาะที่เลือก ({sel.length})
        </Button>
        <Button className="bg-success/90 hover:bg-success text-white" onClick={() => setApproved(true)}>อนุมัติทั้งหมด</Button>
        <Button className="bg-danger hover:bg-danger/90 text-white" onClick={() => openReject('all')}>
          <X className="size-4 mr-1" />ตีกลับทั้งคำร้อง
        </Button>
      </div>

      {/* Reject reason dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>ระบุเหตุผลการตีกลับ</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-[13px] text-[var(--neutral-500)] mb-3">
              {rejectTarget === 'all' ? 'ตีกลับคำร้องทั้งหมด' : `ตีกลับ ${sel.length} วันที่เลือก`}
              {' '}— ระบบจะแจ้งเหตุผลให้พนักงานทางอีเมล
            </p>
            <label className="text-[13px] font-medium block mb-1">
              เหตุผลในการตีกลับ <span className="text-[var(--neutral-400)]">(ไม่บังคับ)</span>
            </label>
            <Textarea
              rows={6}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="เช่น OT เกินเกณฑ์ที่กำหนด / เอกสารไม่ครบถ้วน / ไม่ได้รับอนุญาตให้ทำ OT ล่วงหน้า ฯลฯ"
            />
            <p className="text-[11px] text-[var(--neutral-500)] mt-1">{rejectReason.length} / 200 ตัวอักษร</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>ยกเลิก</Button>
            <Button
              className="bg-danger hover:bg-danger/90 text-white"
              onClick={handleRejectConfirm}
            >
              <X className="size-4 mr-1" />ยืนยันตีกลับ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const STATUS_HIST: Record<string, { kind: 'success' | 'danger' | 'warning' | 'neutral' | 'info'; label: string }> = {
  head_approved:    { kind: 'success', label: 'อนุมัติแล้ว' },
  head_rejected:    { kind: 'danger',  label: 'ตีกลับ' },
  rep_forwarded:    { kind: 'info',    label: 'ส่งต่อแล้ว' },
  checker_approved: { kind: 'success', label: 'เสร็จสิ้น' },
  checker_rejected: { kind: 'danger',  label: 'ปฏิเสธโดย Checker' },
  completed:        { kind: 'success', label: 'เสร็จสิ้น' },
};

export function HeadHistory() {
  const _n = new Date();
  const [thaiYear, setThaiYear] = useState(String(_n.getFullYear() + 543));
  const [selMonth, setSelMonth] = useState(_n.getMonth() + 1);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const token = () => localStorage.getItem('access_token');

  useEffect(() => {
    fetch('/api/ot-requests/', { headers: { 'Authorization': `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          const all = Array.isArray(d) ? d : (d.results || []);
          setHistory(all.filter((r: any) => r.status !== 'submitted'));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const gregYearHist = parseInt(thaiYear) - 543;

  const filtered = history.filter(r => {
    if (search && !(r.staff_name || '').toLowerCase().includes(search.toLowerCase())) return false;
    const d = new Date(r.work_date);
    return d.getFullYear() === gregYearHist && d.getMonth() + 1 === selMonth;
  });

  return (
    <>
      <HeadBreadcrumb page="history" />
      <PageHeader
        title="ประวัติการอนุมัติ"
        subtitle={`${filtered.length} รายการ · ${THAI_MONTHS_FULL[selMonth - 1]} ${thaiYear}`}
        right={
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={thaiYear}
              onChange={e => setThaiYear(e.target.value)}
              className="w-[90px] text-center"
              min={2560}
              max={2599}
            />
            <Select value={String(selMonth)} onValueChange={v => setSelMonth(Number(v))}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {THAI_MONTHS_FULL.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />
      <SectionCard>
        <div className="mb-4">
          <Input placeholder="ค้นหาชื่อพนักงาน" value={search} onChange={e => setSearch(e.target.value)} className="max-w-[300px]" />
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-3 text-[var(--neutral-500)]">
            <div className="size-7 border-4 border-tu-red border-t-transparent rounded-full animate-spin" />
            <span>กำลังโหลด...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[var(--neutral-500)]">
            <p className="font-semibold">ไม่มีประวัติในเดือนนี้</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--neutral-300)]">
            <table className="w-full text-[13px]">
              <thead className="bg-tu-red text-white">
                <tr>{['วันที่ยื่น','พนักงาน','วันที่ OT','ประเภท','ชม.','รวมเงิน','สถานะ','หมายเหตุ'].map(h => (
                  <th key={h} className="text-left px-3 py-3">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map((r: any) => {
                  const st = STATUS_HIST[r.status] || { kind: 'neutral' as const, label: r.status };
                  const note = r.head_note || r.checker_note || '—';
                  return (
                    <tr key={r.id} className="border-t border-[var(--neutral-300)] hover:bg-[var(--neutral-50)]">
                      <td className="px-3 py-2">{fmtDateTime(r.created_at)}</td>
                      <td className="px-3 py-2 font-medium">{r.staff_name || '—'}</td>
                      <td className="px-3 py-2">{fmtDate(r.work_date)}</td>
                      <td className="px-3 py-2"><StatusChip kind={r.day_type === 'holiday' ? 'danger' : 'neutral'}>{r.day_type === 'holiday' ? 'วันหยุด' : 'วันธรรมดา'}</StatusChip></td>
                      <td className="px-3 py-2 font-mono">{Math.floor(parseFloat(r.ot_hours))}</td>
                      <td className="px-3 py-2 font-mono font-semibold">{(Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60)).toLocaleString()}</td>
                      <td className="px-3 py-2"><StatusChip kind={st.kind}>{st.label}</StatusChip></td>
                      <td className="px-3 py-2 text-[var(--neutral-500)] max-w-[160px] truncate" title={note}>{note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}

export function HeadMembers() {
  const [members, setMembers] = useState<any[]>([]);
  const [otMap, setOtMap] = useState<Record<number, any[]>>({});
  const [deptName, setDeptName] = useState('');
  const [detailMember, setDetailMember] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const token = () => localStorage.getItem('access_token');
  const headers = { 'Authorization': `Bearer ${token()}` };

  useEffect(() => {
    fetch('/api/auth/me/', { headers })
      .then(r => r.json())
      .then(me => {
        setDeptName(me.department_name || '');
        return Promise.all([
          fetch(`/api/users/?department=${me.department}`, { headers }).then(r => r.json()),
          fetch('/api/ot-requests/', { headers }).then(r => r.json()),
        ]);
      })
      .then(([usersData, otData]) => {
        const userList = Array.isArray(usersData) ? usersData : (usersData.results || []);
        const otList: any[] = Array.isArray(otData) ? otData : (otData.results || []);
        const map: Record<number, any[]> = {};
        for (const r of otList) {
          if (!map[r.staff]) map[r.staff] = [];
          map[r.staff].push(r);
        }
        setMembers(userList.filter((u: any) => ['staff', 'depthead'].includes(u.role)));
        setOtMap(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalHours = members.reduce((s, m) => s + (otMap[m.id] || []).reduce((ss: number, r: any) => ss + parseFloat(r.ot_hours || 0), 0), 0);
  const totalAmt   = members.reduce((s, m) => s + (otMap[m.id] || []).reduce((ss: number, r: any) => ss + Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60), 0), 0);
  const hasOt      = members.filter(m => (otMap[m.id] || []).length > 0).length;

  if (loading) return (
    <div className="flex items-center justify-center h-60 gap-3 text-[var(--neutral-500)]">
      <div className="size-8 border-4 border-tu-red border-t-transparent rounded-full animate-spin" />
      <span>กำลังโหลด...</span>
    </div>
  );

  // ─── Subpage: รายละเอียด OT ของสมาชิก ───────────────────────────────────
  if (detailMember) {
    const reqs = otMap[detailMember.id] || [];
    const totalDetailAmt = reqs.reduce((s: number, r: any) =>
      s + Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60), 0);

    return (
      <>
        <HeadBreadcrumb page="members" />
        <div className="flex items-center gap-3 mb-6">
          <Button variant="outline" className="gap-2 shrink-0" onClick={() => setDetailMember(null)}>
            <ChevronRight className="size-4 rotate-180" />ย้อนกลับ
          </Button>
          <Avatar className="size-10 shrink-0">
            {detailMember.profile_image && <AvatarImage src={detailMember.profile_image} alt={detailMember.first_name} className="object-cover" />}
            <AvatarFallback className="bg-tu-yellow text-black font-bold">
              {(detailMember.first_name || '?').charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-[20px] font-bold">
              OT ของ {detailMember.first_name} {detailMember.last_name}
            </h1>
            <p className="text-[12px] text-[var(--neutral-500)]">
              {detailMember.employee_id || detailMember.username} · {deptName}
            </p>
          </div>
        </div>

        {reqs.length === 0 ? (
          <div className="text-center py-20 text-[var(--neutral-400)]">
            <Clock className="size-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">ยังไม่มีคำขอ OT</p>
          </div>
        ) : (
          <SectionCard>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] text-[var(--neutral-500)]">{reqs.length} รายการ</p>
              <p className="font-bold text-tu-red text-[16px]">รวม {totalDetailAmt.toLocaleString()} บาท</p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-[var(--neutral-300)]">
              <table className="w-full text-[13px]">
                <thead className="bg-tu-red text-white">
                  <tr>{['วันที่','ประเภท','เริ่ม','สิ้นสุด','ชม.','จำนวนเงิน','สถานะ'].map(h => (
                    <th key={h} className="text-left px-3 py-3">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {reqs.sort((a: any, b: any) => b.work_date.localeCompare(a.work_date)).map((r: any) => {
                    const st  = STATUS_HIST[r.status] || { kind: 'neutral' as const, label: r.status };
                    const amt = Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60);
                    return (
                      <tr key={r.id} className="border-t border-[var(--neutral-300)] hover:bg-[var(--neutral-50)]">
                        <td className="px-3 py-2">{fmtDate(r.work_date)}</td>
                        <td className="px-3 py-2">
                          <StatusChip kind={r.day_type === 'holiday' ? 'danger' : 'neutral'}>
                            {r.day_type === 'holiday' ? 'วันหยุด' : 'วันธรรมดา'}
                          </StatusChip>
                        </td>
                        <td className="px-3 py-2 font-mono">{fmtTime(r.start_time)}</td>
                        <td className="px-3 py-2 font-mono">{fmtTime(r.end_time)}</td>
                        <td className="px-3 py-2 font-mono">{Math.floor(parseFloat(r.ot_hours || 0))}</td>
                        <td className="px-3 py-2 font-mono font-semibold text-tu-red">
                          {amt.toLocaleString()} บาท
                        </td>
                        <td className="px-3 py-2"><StatusChip kind={st.kind}>{st.label}</StatusChip></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--neutral-300)] bg-[var(--neutral-50)]">
                    <td colSpan={5} className="px-3 py-2 font-semibold text-right">รวมทั้งสิ้น</td>
                    <td className="px-3 py-2 font-bold text-tu-red">{totalDetailAmt.toLocaleString()} บาท</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </SectionCard>
        )}
      </>
    );
  }

  // ─── Member list ─────────────────────────────────────────────────────────
  return (
    <>
      <HeadBreadcrumb page="members" />
      <PageHeader title={`สมาชิกในแผนก${deptName ? ' — ' + deptName : ''}`} />
      <div className="grid grid-cols-4 gap-5 mb-5">
        <KpiCard label="จำนวนสมาชิก" value={members.length.toString()} accent="red" />
        <KpiCard label="ทำ OT แล้ว" value={hasOt.toString()} accent="yellow" />
        <KpiCard label="รวมชั่วโมง OT" value={Math.floor(totalHours).toString()} accent="blue" />
        <KpiCard label="รวมยอด OT" value={Math.round(totalAmt).toLocaleString()} accent="green" />
      </div>
      {members.length === 0 ? (
        <div className="text-center py-16 text-[var(--neutral-500)]">ไม่พบสมาชิกในแผนก</div>
      ) : (
        <div className="grid grid-cols-4 gap-5">
          {members.map(m => {
            const reqs = otMap[m.id] || [];
            const hrs  = reqs.reduce((s: number, r: any) => s + parseFloat(r.ot_hours || 0), 0);
            const amt  = reqs.reduce((s: number, r: any) => s + Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60), 0);
            return (
              <div key={m.id} className="bg-white border border-[var(--neutral-300)] rounded-xl p-5 text-center shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                <Avatar className="size-20 mx-auto mb-3">
                  {m.profile_image && <AvatarImage src={m.profile_image} alt={m.first_name} className="object-cover" />}
                  <AvatarFallback className="bg-tu-yellow text-black text-2xl">
                    {(m.first_name || m.username || '?').charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <h4 className="text-[14px] font-semibold">{m.first_name} {m.last_name}</h4>
                <p className="text-[11px] text-[var(--neutral-500)] mb-0.5">{m.employee_id || m.username}</p>
                {hrs > 0
                  ? <p className="text-tu-red font-semibold text-[13px] mb-3">{Math.round(amt).toLocaleString()} บาท ({Math.floor(hrs)} ชม.)</p>
                  : <p className="text-[12px] text-[var(--neutral-400)] mb-3">ยังไม่มีคำขอ OT</p>
                }
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-tu-red text-tu-red"
                  onClick={() => setDetailMember(m)}
                >
                  ดู OT
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// แปลงจำนวนเงินเป็นคำอ่านภาษาไทย
function thaiNumber(n: number): string {
  if (n === 0) return 'ศูนย์บาทถ้วน';
  const ones = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  function below1M(num: number): string {
    if (num === 0) return '';
    let s = '';
    const แสน = Math.floor(num / 100000); if (แสน) s += ones[แสน] + 'แสน'; num %= 100000;
    const หมื่น = Math.floor(num / 10000);  if (หมื่น) s += ones[หมื่น] + 'หมื่น'; num %= 10000;
    const พัน  = Math.floor(num / 1000);   if (พัน)  s += ones[พัน]  + 'พัน';  num %= 1000;
    const ร้อย = Math.floor(num / 100);    if (ร้อย) s += ones[ร้อย] + 'ร้อย'; num %= 100;
    const สิบ  = Math.floor(num / 10);
    if (สิบ === 1) s += 'สิบ';
    else if (สิบ === 2) s += 'ยี่สิบ';
    else if (สิบ > 2)  s += ones[สิบ] + 'สิบ';
    const หน่วย = num % 10;
    if (หน่วย === 1 && สิบ > 0) s += 'เอ็ด';
    else if (หน่วย > 0) s += ones[หน่วย];
    return s;
  }
  const int = Math.floor(n);
  let result = '';
  if (int >= 1000000) { result += below1M(Math.floor(int / 1000000)) + 'ล้าน'; result += below1M(int % 1000000); }
  else result = below1M(int);
  return result + 'บาทถ้วน';
}

function buildOtSheet(
  wb: XLSX.WorkBook,
  employees: { seq: number; name: string; reqs: any[]; weekdayHrs: number; weekendHrs: number; amount: number }[],
  deptName: string,
  signatoryName: string,
  month: string,
  carryover: number,
  pageIdx: number,
  totalPages: number,
  grandTotalAmount: number,
) {
  const startDay    = pageIdx * 5;
  const endDay      = startDay + 5;
  const isFirstPage = pageIdx === 0;
  const sheetName   = totalPages > 1 ? `หน้า ${pageIdx + 1}` : 'OT Report';

  const rows: any[][] = [];
  rows.push(['หลักฐานการเบิกจ่ายเงินค่าตอบแทนการปฏิบัติงานนอกเวลาราชการ']);
  rows.push([`${deptName}  ประจำเดือน ${month}`]);
  if (totalPages > 1) rows.push([`(หน้า ${pageIdx + 1} / ${totalPages})`]);
  rows.push([]);
  if (isFirstPage && carryover > 0) {
    rows.push(['ยอดยกมาจากเดือนที่แล้ว', '', '', '', '', '', '', '', '', carryover, '', '', '']);
  }
  const dayLabels = Array.from({ length: 5 }, (_, i) => `วันที่ ${startDay + i + 1}`);
  rows.push(['ลำดับที่', 'ชื่อ-สกุล', ...dayLabels, 'วันปกติ(ชม.)', 'วันหยุด(ชม.)', 'จำนวนเงิน', 'ว.ด.ป.ที่รับเงิน', 'ลายมือชื่อ', 'หมายเหตุ']);
  const empHere = isFirstPage ? employees : employees.filter(e => e.reqs.length > startDay);
  empHere.forEach(emp => {
    const dr: any[] = [emp.seq, emp.name];
    for (let i = startDay; i < endDay; i++) dr.push(emp.reqs[i]?.work_date ?? '');
    if (isFirstPage) dr.push(emp.weekdayHrs || '', emp.weekendHrs || '', emp.amount, '', '', '');
    else             dr.push('', '', '', '', '', '');
    rows.push(dr);
    const tr: any[] = ['', ''];
    for (let i = startDay; i < endDay; i++) {
      const r = emp.reqs[i];
      tr.push(r ? `${r.start_time || ''}-${r.end_time || ''} น.` : '');
    }
    tr.push('', '', '', '', '', '');
    rows.push(tr);
  });
  rows.push([]);
  if (isFirstPage) {
    rows.push(['', '', 'รวมเงินทั้งสิ้น', '', '', '', '', 'รวมเป็นเงิน', '', grandTotalAmount, '', '', '']);
    rows.push(['', '', '', '', '', '', '', '', '', `(${thaiNumber(grandTotalAmount)})`, '', '', '']);
    if (carryover > 0) {
      rows.push(['', '', '', '', '', '', '', 'ยอดยกมา', '', carryover, '', '', '']);
      rows.push(['', '', '', '', '', '', '', 'ยอดสุทธิเดือนนี้', '', grandTotalAmount - carryover, '', '', '']);
    }
  }
  rows.push([]);
  rows.push(['ขอรับรองว่า ผู้มีรายชื่อข้างต้นปฏิบัติงานนอกเวลาราชการจริง']);
  rows.push([]);
  rows.push(['ลงชื่อ', '', '', 'ผู้รับรองการปฏิบัติงาน']);
  rows.push(['', '', '', `(${signatoryName})`]);
  rows.push(['ตำแหน่ง', '', '', `หัวหน้า${deptName}`]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:8},{wch:30},{wch:14},{wch:14},{wch:14},{wch:14},{wch:14},{wch:14},{wch:14},{wch:14},{wch:14},{wch:18},{wch:12}];
  const merges: any[] = [
    { s:{r:0,c:0}, e:{r:0,c:12} },
    { s:{r:1,c:0}, e:{r:1,c:12} },
  ];
  if (totalPages > 1) merges.push({ s:{r:2,c:0}, e:{r:2,c:12} });
  ws['!merges'] = merges;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
}

function generateHeadXlsx(requests: any[], deptName: string, signatoryName: string, carryover = 0) {
  const now = new Date();
  const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const month = `${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;
  const byStaff: Record<string, { name: string; reqs: any[] }> = {};
  for (const r of requests) {
    const key = r.staff || r.staff_name;
    if (!byStaff[key]) byStaff[key] = { name: r.staff_name || String(key), reqs: [] };
    byStaff[key].reqs.push(r);
  }
  Object.values(byStaff).forEach(s => s.reqs.sort((a, b) => a.work_date.localeCompare(b.work_date)));
  const employees = Object.values(byStaff).map((s, idx) => {
    const weekdayHrs = s.reqs.filter(r => r.day_type !== 'holiday')
      .reduce((sum, r) => sum + Math.floor(parseFloat(r.ot_hours || 0)), 0);
    const weekendHrs = s.reqs.filter(r => r.day_type === 'holiday')
      .reduce((sum, r) => sum + Math.floor(parseFloat(r.ot_hours || 0)), 0);
    const amount = s.reqs.reduce(
      (sum, r) => sum + Math.floor(parseFloat(r.ot_hours || 0)) * (r.day_type === 'holiday' ? 70 : 60), 0
    );
    return { seq: idx + 1, name: s.name, reqs: s.reqs, weekdayHrs, weekendHrs, amount };
  });
  const grandTotalAmount = employees.reduce((s, e) => s + e.amount, 0);
  const maxDays    = Math.max(...employees.map(e => e.reqs.length), 1);
  const totalPages = Math.ceil(maxDays / 5);
  const wb = XLSX.utils.book_new();
  for (let page = 0; page < totalPages; page++) {
    buildOtSheet(wb, employees, deptName, signatoryName, month, carryover, page, totalPages, grandTotalAmount);
  }
  downloadXlsx(wb, `OT-${deptName}-${month}.xlsx`);
}

const HEAD_REPORT_PERIODS = [
  { value: 'month',   label: 'รายเดือน' },
  { value: 'quarter', label: 'ไตรมาส' },
  { value: 'half',    label: 'ครึ่งปีงบ' },
  { value: 'year',    label: 'ปีงบประมาณ' },
];
const HEAD_REPORT_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

export function HeadReport() {
  const now = new Date();
  // ปีงบประมาณ: ต.ค. ปีก่อน – ก.ย. ปีนี้ → เดือน ต.ค.(m=9) ขึ้นปีงบใหม่
  const curThaiYear = now.getFullYear() + 543 + (now.getMonth() >= 9 ? 1 : 0);

  const [requests, setRequests]           = useState<any[]>([]);
  const [deptName, setDeptName]           = useState('');
  const [headName, setHeadName]           = useState('');
  const [loading, setLoading]             = useState(true);
  const [showExportDlg, setShowExportDlg] = useState(false);
  const [carryover, setCarryover]         = useState(0);
  const [signatoryName, setSignatoryName] = useState('');
  // Period filter state
  const [period, setPeriod]       = useState('month');
  const [thaiYear, setThaiYear]   = useState(String(curThaiYear));
  const [thaiMonth, setThaiMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const _m = now.getMonth() + 1;
  const curQuarter = _m >= 10 ? '1' : _m <= 3 ? '2' : _m <= 6 ? '3' : '4';
  const [quarter, setQuarter]     = useState(curQuarter);

  const token = () => localStorage.getItem('access_token');
  const h = { 'Authorization': `Bearer ${token()}` };

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me/', { headers: h }).then(r => r.json()),
      fetch('/api/ot-requests/', { headers: h }).then(r => r.json()),
    ]).then(([me, otData]) => {
      setDeptName(me.department_name || '');
      const fullName = `${me.first_name || ''} ${me.last_name || ''}`.trim();
      setHeadName(fullName);
      setSignatoryName(fullName);
      const all: any[] = Array.isArray(otData) ? otData : (otData.results || []);
      setRequests(all);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // ─── Date filter (same logic as CheckerReport) ────────────────────────────
  function inRange(dateStr: string): boolean {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const gregYear = parseInt(thaiYear) - 543;
    if (period === 'month') {
      const monthNum = parseInt(thaiMonth);
      // ต.ค.-ธ.ค. อยู่ใน greg ปีก่อนของปีงบ
      const actualGregYear = monthNum >= 10 ? gregYear - 1 : gregYear;
      return y === actualGregYear && m === monthNum;
    } else if (period === 'quarter') {
      const Q_MAP: Record<string, { months: number[]; year: number }[]> = {
        '1': [{ months: [10,11,12], year: gregYear - 1 }],
        '2': [{ months: [1,2,3],   year: gregYear }],
        '3': [{ months: [4,5,6],   year: gregYear }],
        '4': [{ months: [7,8,9],   year: gregYear }],
      };
      return (Q_MAP[quarter] || []).some(({ months, year }) => year === y && months.includes(m));
    } else if (period === 'half') {
      const h1 = (y === gregYear - 1 && m >= 10) || (y === gregYear && m <= 3);
      const h2 = y === gregYear && m >= 4 && m <= 9;
      return quarter === '1' ? h1 : h2;
    } else {
      return (y === gregYear - 1 && m >= 10) || (y === gregYear && m <= 9);
    }
  }

  const filtered = requests.filter(r => inRange(r.work_date));

  const byStaff: Record<string, { name: string; hours: number; amount: number }> = {};
  for (const r of filtered) {
    const k = r.staff_name || String(r.staff);
    if (!byStaff[k]) byStaff[k] = { name: k, hours: 0, amount: 0 };
    byStaff[k].hours  += parseFloat(r.ot_hours || 0);
    byStaff[k].amount += Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60);
  }
  const chartData    = Object.values(byStaff).sort((a, b) => b.hours - a.hours).slice(0, 8);
  const totalHrs     = filtered.reduce((s, r) => s + parseFloat(r.ot_hours || 0), 0);
  const totalAmt     = filtered.reduce((s, r) => s + Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60), 0);
  const weekdayCount = filtered.filter(r => r.day_type !== 'holiday').length;
  const holidayCount = filtered.filter(r => r.day_type === 'holiday').length;
  const staffCount   = Object.keys(byStaff).length;
  const pieData = [
    { name: 'วันธรรมดา', v: weekdayCount },
    { name: 'วันหยุด',   v: holidayCount },
  ];

  return (
    <>
      <HeadBreadcrumb page="report" />
      <PageHeader
        title={`รายงานแผนก${deptName ? ' ' + deptName : ''}`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            {/* Period filter */}
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>{HEAD_REPORT_PERIODS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input
              type="number"
              value={thaiYear}
              onChange={e => setThaiYear(e.target.value)}
              className="w-[90px] text-center"
              min={2560}
              max={2599}
            />
            {period === 'month' && (
              <Select value={thaiMonth} onValueChange={setThaiMonth}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>{HEAD_REPORT_MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1).padStart(2,'0')}>{m}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {(period === 'quarter' || period === 'half') && (
              <Select value={quarter} onValueChange={setQuarter}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {period === 'quarter'
                    ? ['1','2','3','4'].map(q => <SelectItem key={q} value={q}>ไตรมาส {q}</SelectItem>)
                    : [{ v:'1', l:'ครึ่งแรก (ต.ค.–มี.ค.)' },{ v:'2', l:'ครึ่งหลัง (เม.ย.–ก.ย.)' }].map(h => <SelectItem key={h.v} value={h.v}>{h.l}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            )}
            {/* Export buttons */}
            <Button
              onClick={() => setShowExportDlg(true)}
              className="bg-tu-red hover:bg-tu-red-dark text-white"
              disabled={loading || filtered.length === 0}
            >
              <Download className="size-4 mr-1" />Export Excel
            </Button>
          </div>
        }
      />
      {loading ? (
        <div className="flex items-center justify-center h-60 gap-3 text-[var(--neutral-500)]">
          <div className="size-8 border-4 border-tu-red border-t-transparent rounded-full animate-spin"/>
          <span>กำลังโหลด...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-5 mb-5">
            <KpiCard label="รวมชั่วโมง OT" value={Math.floor(totalHrs).toString()} accent="red" />
            <KpiCard label="รวมเงิน (บาท)" value={Math.round(totalAmt).toLocaleString()} accent="green" />
            <KpiCard label="จำนวนคน" value={staffCount.toString()} accent="blue" />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <SectionCard title="OT per พนักงาน">
              <p className="text-[11px] text-[var(--neutral-500)] mb-3">ชั่วโมง OT สะสม <strong>ตามช่วงที่เลือก</strong> · หน่วย: ชั่วโมง (ชม.)</p>
              <div className="h-[260px]">
                {chartData.length === 0
                  ? <p className="text-center text-[var(--neutral-500)] pt-20">ยังไม่มีข้อมูล OT</p>
                  : <ResponsiveContainer>
                      <BarChart data={chartData} layout="vertical" margin={{ right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: any) => [`${v} ชม.`, 'OT']} />
                        <Bar dataKey="hours" fill="#B8001F" radius={[0,6,6,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                }
              </div>
            </SectionCard>
            <SectionCard title="สัดส่วนวันธรรมดา vs วันหยุด">
              <p className="text-[11px] text-[var(--neutral-500)] mb-3">สัดส่วนจำนวนรายการ OT <strong>ตามช่วงที่เลือก</strong> · % คำนวณจากจำนวนรายการทั้งหมด</p>
              <div className="h-[260px]">
                {weekdayCount + holidayCount === 0
                  ? <p className="text-center text-[var(--neutral-500)] pt-20">ยังไม่มีข้อมูล</p>
                  : <ResponsiveContainer>
                      <PieChart>
                        <Pie data={pieData} dataKey="v" nameKey="name" outerRadius={95} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                          <Cell fill="#B8001F" /><Cell fill="#FFD400" />
                        </Pie>
                        <Tooltip /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                }
              </div>
            </SectionCard>
          </div>
        </>
      )}

      <Dialog open={showExportDlg} onOpenChange={setShowExportDlg}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>ตั้งค่าก่อน Export Excel</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-[13px] font-medium block mb-1">ยอดยกมาจากเดือนที่แล้ว (บาท)</label>
              <Input type="number" min={0} value={carryover || ''} onChange={e => setCarryover(parseFloat(e.target.value) || 0)} placeholder="0 (ถ้าไม่มีให้เว้นว่าง)" />
            </div>
            <div>
              <label className="text-[13px] font-medium block mb-1">ชื่อผู้รับรองการปฏิบัติงาน</label>
              <Input value={signatoryName} onChange={e => setSignatoryName(e.target.value)} placeholder="ชื่อ-สกุล หัวหน้า" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDlg(false)}>ยกเลิก</Button>
            <Button className="bg-tu-red hover:bg-tu-red-dark text-white" onClick={() => { generateHeadXlsx(filtered, deptName, signatoryName || headName, carryover); setShowExportDlg(false); }}>
              <Download className="size-4 mr-1" />Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function HeadBudgetRequest() {
  const [submitted, setSubmitted] = useState(false);
  const [amount, setAmount] = useState('15000');
  const [reason, setReason] = useState('');
  if (submitted) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="size-20 rounded-full bg-green-100 grid place-items-center"><CheckCircle2 className="size-12 text-success" /></div>
      <h2>ส่งคำขอเพิ่มงบประมาณแล้ว</h2>
      <Button onClick={() => setSubmitted(false)} variant="outline">ยื่นคำขอใหม่</Button>
    </div>
  );
  return (
    <>
      <PageHeader title="ขออนุมัติงบประมาณเพิ่มเติม" />
      <div className="max-w-[600px]">
        <SectionCard title="แบบฟอร์มขออนุมัติงบประมาณเพิ่มเติม">
          <div className="space-y-5">
            <div>
              <label className="text-[13px] font-medium block mb-1">จำนวนงบที่ขอเพิ่ม (บาท)</label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="ระบุจำนวนเงิน" />
            </div>
            <div>
              <label className="text-[13px] font-medium block mb-1">เหตุผลในการขอเพิ่มงบประมาณ <span className="text-danger">*</span></label>
              <Textarea rows={4} value={reason} onChange={e => setReason(e.target.value)} placeholder="อธิบายเหตุผลความจำเป็น" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button className="bg-tu-red hover:bg-tu-red-dark text-white" disabled={!amount || !reason || reason.length < 20} onClick={() => setSubmitted(true)}>
                <Send className="size-4 mr-2" />ส่งคำขอ
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  );
}


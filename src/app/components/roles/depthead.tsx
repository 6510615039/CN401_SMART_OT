import { useState, useEffect } from 'react';
import { smartDefaultDate, smartDefaultThaiYear } from '../../utils/smartDefault';
import { otRate, OT_RATE_WEEKDAY, OT_RATE_HOLIDAY } from '../../constants/otRate';
import * as XLSX from 'xlsx-js-style';
import * as fflate from 'fflate';
import {
  LayoutDashboard, Inbox, History, Users, FileBarChart, ChevronRight,
  CheckCircle2, X, AlertTriangle, Download, Send, PlusCircle, Clock, Bell, BookOpen,
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

function injectPageSetup(rawBuf: number[]): Uint8Array {
  try {
    const u8 = new Uint8Array(rawBuf);
    const T = new Uint32Array(256);
    for (let i = 0; i < 256; i++) { let c = i; for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[i] = c; }
    const crc32 = (b: Uint8Array) => { let v = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) v = T[(v ^ b[i]) & 0xFF] ^ (v >>> 8); return (v ^ 0xFFFFFFFF) >>> 0; };
    const r32 = (b: Uint8Array, o: number) => (b[o] | b[o+1]<<8 | b[o+2]<<16 | b[o+3]<<24) >>> 0;
    const w32 = (b: Uint8Array, o: number, v: number) => { b[o]=v&0xFF; b[o+1]=(v>>>8)&0xFF; b[o+2]=(v>>>16)&0xFF; b[o+3]=(v>>>24)&0xFF; };
    let eocdOff = -1;
    for (let i = u8.length - 22; i >= 0; i--) {
      if (u8[i]===0x50&&u8[i+1]===0x4B&&u8[i+2]===0x05&&u8[i+3]===0x06) {
        if (i + 22 + (u8[i+20]|(u8[i+21]<<8)) === u8.length) { eocdOff = i; break; }
      }
    }
    if (eocdOff < 0) return u8;
    const cdOffset = r32(u8, eocdOff+16), cdCount = u8[eocdOff+8]|(u8[eocdOff+9]<<8);
    const target = new TextEncoder().encode('xl/worksheets/sheet1.xml');
    let cdEntryOff = -1, localHdrOff = 0, oldCsize = 0, oldUsize = 0;
    let p = cdOffset;
    for (let e = 0; e < cdCount; e++) {
      if (u8[p]!==0x50||u8[p+1]!==0x4B||u8[p+2]!==0x01||u8[p+3]!==0x02) break;
      const fnl=u8[p+28]|(u8[p+29]<<8), exl=u8[p+30]|(u8[p+31]<<8), cml=u8[p+32]|(u8[p+33]<<8);
      let ok = fnl === target.length;
      if (ok) for (let j=0;j<fnl;j++) if (u8[p+46+j]!==target[j]) { ok=false; break; }
      if (ok) { cdEntryOff=p; oldCsize=r32(u8,p+20); oldUsize=r32(u8,p+24); localHdrOff=r32(u8,p+42); break; }
      p += 46+fnl+exl+cml;
    }
    if (cdEntryOff < 0) return u8;
    const method=u8[localHdrOff+8]|(u8[localHdrOff+9]<<8);
    const fnl2=u8[localHdrOff+26]|(u8[localHdrOff+27]<<8), exl2=u8[localHdrOff+28]|(u8[localHdrOff+29]<<8);
    const dataOff = localHdrOff + 30 + fnl2 + exl2;
    const xmlBytes = method===8 ? fflate.inflateSync(u8.slice(dataOff, dataOff+oldCsize)) : u8.slice(dataOff, dataOff+oldCsize);
    let xml = new TextDecoder().decode(xmlBytes);
    if (/<pageSetUp/.test(xml)) return u8;
    if (/<sheetPr\s*\/>/.test(xml))     xml=xml.replace(/<sheetPr\s*\//,'<sheetPr><pageSetUp fitToPage="1"/></');
    else if (/<sheetPr/.test(xml))       xml=xml.replace(/<sheetPr([^>]*)>/,'<sheetPr$1><pageSetUp fitToPage="1"/>');
    else                                 xml=xml.replace('<sheetData','<sheetPr><pageSetUp fitToPage="1"/></sheetPr><sheetData');
    const newXml=new TextEncoder().encode(xml), newComp=method===8?fflate.deflateSync(newXml):newXml;
    const newCrc=crc32(newXml), newCsz=newComp.length, newUsz=newXml.length, diff=newCsz-oldCsize;
    const out = new Uint8Array(u8.length+diff);
    out.set(u8.slice(0,dataOff)); out.set(newComp,dataOff); out.set(u8.slice(dataOff+oldCsize),dataOff+newCsz);
    w32(out,localHdrOff+14,newCrc); w32(out,localHdrOff+18,newCsz); w32(out,localHdrOff+22,newUsz);
    if (u8[localHdrOff+6]&8) { const ddOff=dataOff+newCsz, hasSig=out[ddOff]===0x50&&out[ddOff+1]===0x4B&&out[ddOff+2]===0x07&&out[ddOff+3]===0x08, base=ddOff+(hasSig?4:0); w32(out,base,newCrc);w32(out,base+4,newCsz);w32(out,base+8,newUsz); }
    const newCdOff=cdOffset+diff; let np=newCdOff;
    for (let e=0;e<cdCount;e++) {
      if (out[np]!==0x50||out[np+1]!==0x4B||out[np+2]!==0x01||out[np+3]!==0x02) break;
      const fnl=out[np+28]|(out[np+29]<<8),exl=out[np+30]|(out[np+31]<<8),cml=out[np+32]|(out[np+33]<<8), lh=r32(out,np+42);
      if (lh===localHdrOff) { w32(out,np+16,newCrc);w32(out,np+20,newCsz);w32(out,np+24,newUsz); }
      else if (lh>localHdrOff) w32(out,np+42,lh+diff);
      np+=46+fnl+exl+cml;
    }
    w32(out,eocdOff+diff+16,newCdOff);
    return out;
  } catch { return new Uint8Array(rawBuf); }
}

function downloadXlsx(wb: XLSX.WorkBook, filename: string) {
  const rawBuf: number[] = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  const blob = new Blob([injectPageSetup(rawBuf)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
}

function parseOTHoursHead(timeStr: string): number {
  const m = timeStr.match(/(\d+)\.(\d+)-(\d+)\.(\d+)/);
  if (!m) return 0;
  const startMins = parseInt(m[1]) * 60 + parseInt(m[2]);
  const endMins   = parseInt(m[3]) * 60 + parseInt(m[4]);
  return Math.max(0, (endMins - startMins) / 60);
}

export const HEAD_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard',       icon: <LayoutDashboard /> },
  { key: 'pending',   label: 'คำร้องรออนุมัติ',  icon: <Inbox /> },
  { key: 'history',   label: 'ประวัติการอนุมัติ', icon: <History /> },
  { key: 'members',   label: 'สมาชิกในแผนก',    icon: <Users /> },
  { key: 'report',    label: 'รายงานแผนก',      icon: <FileBarChart /> },
  { key: 'manual',   label: 'คู่มือการใช้งาน',  icon: <BookOpen /> },
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
  const _sd = smartDefaultDate();
  const _curThaiYear = smartDefaultThaiYear();
  const _curMon = _sd.month;
  const _curQ   = _curMon >= 10 ? '1' : _curMon <= 3 ? '2' : _curMon <= 6 ? '3' : '4';

  const [allRequests, setAllRequests] = useState<any[]>([]);
  const [budget, setBudget]           = useState<number | null>(null);
  const [period, setPeriod]           = useState('month');
  const [selThaiYear, setSelThaiYear] = useState(() => localStorage.getItem('head_dashboard_thai_year') || String(_curThaiYear));
  const [selMonth, setSelMonth]       = useState(() => localStorage.getItem('head_dashboard_month') || String(_curMon).padStart(2, '0'));
  const [selQuarter, setSelQuarter]   = useState(_curQ);
  const [loading, setLoading]         = useState(true);
  const [noOtConfirm, setNoOtConfirm]     = useState(false);
  const [noOtSending, setNoOtSending]     = useState(false);
  const [noOtToast, setNoOtToast]         = useState<{ ok: boolean; msg: string } | null>(null);
  const [noOtDeclared, setNoOtDeclared]   = useState<Set<string>>(new Set());
  const [dashDeadline, setDashDeadline]   = useState<{ deadline_date: string } | null>(null);

  // ไม่ใช้ yearOptions แล้ว — เปลี่ยนเป็น input กรอกปีเอง

  // budget month param — reactive กับ filter period/เดือน/ปี
  const selGregYear   = parseInt(selThaiYear) - 543;
  const selMonthNum   = parseInt(selMonth);
  const selBudgetYear = selMonthNum >= 10 ? selGregYear - 1 : selGregYear;
  const budgetMonthParam = `${selBudgetYear}-${selMonth}`;

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const h = { 'Authorization': `Bearer ${token}` };
    const now2 = new Date();
    const curThaiMonthStr = `${now2.getFullYear() + 543}-${String(now2.getMonth() + 1).padStart(2, '0')}`;
    fetch(`/api/ot-deadline/?month=${curThaiMonthStr}`, { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const list = Array.isArray(d) ? d : (d?.results || []);
        setDashDeadline(list.find((x: any) => x.thai_month === curThaiMonthStr) || null);
      }).catch(() => {});

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
      if (me?.department) sessionStorage.setItem('_my_dept_id', String(me.department));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // ดึงงบประมาณของเดือน/ปีที่เลือกใหม่ทุกครั้งที่ผู้ใช้เปลี่ยนตัวกรอง
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const h = { 'Authorization': `Bearer ${token}` };
    const gregYear = parseInt(selThaiYear) - 543;
    const monthNum = period === 'month' ? parseInt(selMonth) : new Date().getMonth() + 1;
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
    s + Math.floor(parseFloat(r.ot_hours || '0')) * (otRate(r.day_type)), 0);

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
      trendMap[key] += Math.floor(parseFloat(r.ot_hours || '0')) * (otRate(r.day_type));
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
              onChange={e => { localStorage.setItem('head_dashboard_thai_year', e.target.value); setSelThaiYear(e.target.value); }}
              className="w-[90px] text-center"
              min={2560}
              max={2599}
            />
            {period === 'month' && (
              <Select value={selMonth} onValueChange={m => { localStorage.setItem('head_dashboard_month', m); setSelMonth(m); }}>
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
          <Button size="sm" onClick={() => {
            const pendingReqs = allRequests.filter(r => r.status === 'submitted');
            if (pendingReqs.length > 0) {
              const cnt: Record<string, number> = {};
              pendingReqs.forEach(r => { const k = (r.work_date || '').substring(0, 7); if (k) cnt[k] = (cnt[k] || 0) + 1; });
              const dom = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0];
              if (dom) sessionStorage.setItem('notif_nav_month', dom);
            }
            onGo();
          }} className="bg-tu-red text-white">
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

      {/* Deadline banner — เดือนปัจจุบัน */}
      {dashDeadline && (() => {
        const dlDate = new Date(dashDeadline.deadline_date);
        const today = new Date(); today.setHours(0,0,0,0);
        const isPast = dlDate < today;
        const diffDays = Math.ceil((dlDate.getTime() - today.getTime()) / 86400000);
        return (
          <div className={`flex items-center gap-3 p-3 mb-4 rounded-xl border text-[13px] ${isPast ? 'bg-red-50 border-red-300 text-danger' : diffDays <= 3 ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
            <Clock className="size-4 shrink-0" />
            <p>
              <strong>เดดไลน์พนักงานยื่น OT เดือนนี้:</strong>{' '}
              {fmtDate(dashDeadline.deadline_date)}{' '}
              {isPast ? '— หมดเขตแล้ว' : diffDays === 0 ? '— วันนี้วันสุดท้าย!' : `(อีก ${diffDays} วัน)`}
            </p>
          </div>
        );
      })()}

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
  const _initDate = (() => {
    const stored = sessionStorage.getItem('notif_nav_month');
    if (stored) { sessionStorage.removeItem('notif_nav_month'); return { year: new Date(stored + '-01').getFullYear() + 543, month: new Date(stored + '-01').getMonth() + 1 }; }
    const sd = smartDefaultDate();
    return { year: sd.year + 543, month: sd.month };
  })();
  const _curThaiYearPending = _initDate.year;
  const [thaiYear, setThaiYear] = useState(() => localStorage.getItem('head_pending_thai_year') || String(_curThaiYearPending));
  const [selMonth, setSelMonth] = useState(() => Number(localStorage.getItem('head_pending_month') || _initDate.month));
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<number[]>([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [search, setSearch] = useState('');
  const [actionMsg, setActionMsg] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);
  const [notifyingRep, setNotifyingRep] = useState(false);
  const [notifiedMonths, setNotifiedMonths] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('head_notified_months') || '[]')); } catch { return new Set(); }
  });
  const [budgetStatus, setBudgetStatus] = useState<{ budget: number; used: number; remaining: number | null } | null>(null);
  const [deadline, setDeadline] = useState<{ deadline_date: string; month: string } | null>(null);
  const token = () => localStorage.getItem('access_token');

  useEffect(() => {
    // โหลด deadline — ใช้ thai_month (พ.ศ.) ตรงกับที่ backend เก็บ
    const thaiMonthStr = `${thaiYear}-${String(selMonth).padStart(2, '0')}`;
    fetch(`/api/ot-deadline/?month=${thaiMonthStr}`, { headers: { 'Authorization': `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const list = Array.isArray(d) ? d : (d?.results || []);
        setDeadline(list.find((x: any) => x.thai_month === thaiMonthStr) || null);
      })
      .catch(() => setDeadline(null));
  }, [selMonth, thaiYear]);

  function loadRequests() {
    setLoading(true);
    fetch('/api/ot-requests/?status=submitted', { headers: { 'Authorization': `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setRequests(Array.isArray(d) ? d : (d.results || [])); })
      .catch(() => {}).finally(() => setLoading(false));
  }

  function loadBudget(deptId: number | string, year: number, month: number) {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    fetch(`/api/budget-status/?department=${deptId}&month=${monthStr}`, {
      headers: { 'Authorization': `Bearer ${token()}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setBudgetStatus(d); else setBudgetStatus(null); })
      .catch(() => setBudgetStatus(null));
  }

  useEffect(() => { loadRequests(); }, []);

  const gregYearPending = parseInt(thaiYear) - 543;

  const filtered = requests.filter(r => {
    if (search && !(r.staff_name || '').toLowerCase().includes(search.toLowerCase())) return false;
    const d = new Date(r.work_date);
    return d.getFullYear() === gregYearPending && d.getMonth() + 1 === selMonth;
  });

  // โหลดงบทุกครั้งที่เดือน/ปีเปลี่ยน หรือ requests โหลดใหม่
  useEffect(() => {
    const deptId = requests.find(r => r.department)?.department;
    if (deptId) loadBudget(deptId, gregYearPending, selMonth);
    else setBudgetStatus(null);
  }, [requests, gregYearPending, selMonth]);

  const all = filtered.length > 0 && sel.length === filtered.length;
  const totalAmount = filtered.filter(r => sel.includes(r.id)).reduce((s, r) => s + Math.floor(parseFloat(r.ot_hours || '0')) * (otRate(r.day_type)), 0);
  const willExceedBudget = !!(budgetStatus && budgetStatus.budget && budgetStatus.remaining !== null && budgetStatus.used + totalAmount > budgetStatus.budget);

  async function doApprove(id: number): Promise<string | null> {
    const res = await fetch(`/api/ot-requests/${id}/approve/`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return d.error || 'เกิดข้อผิดพลาด';
    }
    return null;
  }

  async function handleApprove() {
    const res = await fetch('/api/ot-requests/bulk-head-approve/', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: sel }),
    });
    const d = await res.json().catch(() => ({}));
    setSel([]);
    if (!res.ok) {
      setActionMsg({ kind: 'danger', text: d.error || 'เกิดข้อผิดพลาด' });
    } else {
      setActionMsg({ kind: 'success', text: `อนุมัติ ${d.approved ?? sel.length} คำร้องเรียบร้อยแล้ว` });
    }
    setTimeout(() => setActionMsg(null), 5000);
    loadRequests();
  }

  async function handleNotifyRep() {
    setNotifyingRep(true);
    const gregYear = parseInt(thaiYear) - 543;
    const monthStr = `${gregYear}-${String(selMonth).padStart(2, '0')}`;
    const res = await fetch('/api/notify-rep-ready/', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: monthStr }),
    });
    setNotifyingRep(false);
    if (res.ok) {
      const gregYear = parseInt(thaiYear) - 543;
      const monthKey = `${gregYear}-${String(selMonth).padStart(2, '0')}`;
      setNotifiedMonths(prev => {
        const next = new Set([...prev, monthKey]);
        localStorage.setItem('head_notified_months', JSON.stringify([...next]));
        return next;
      });
      setActionMsg({ kind: 'success', text: 'แจ้งตัวแทนแผนกเรียบร้อยแล้ว' });
    } else {
      const d = await res.json().catch(() => ({}));
      setActionMsg({ kind: 'danger', text: d.error || 'ไม่สามารถแจ้งตัวแทนได้' });
    }
    setTimeout(() => setActionMsg(null), 4000);
  }

  async function handleRejectConfirm() {
    await fetch('/api/ot-requests/bulk-head-reject/', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: sel, note: rejectReason }),
    });
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
              onChange={e => { localStorage.setItem('head_pending_thai_year', e.target.value); setThaiYear(e.target.value); setSel([]); }}
              className="w-[90px] text-center"
              min={2560}
              max={2599}
            />
            <Select value={String(selMonth)} onValueChange={v => { localStorage.setItem('head_pending_month', v); setSelMonth(Number(v)); setSel([]); }}>
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

      {/* Deadline banner */}
      {deadline ? (() => {
        const dlDate = new Date(deadline.deadline_date);
        const today = new Date(); today.setHours(0,0,0,0);
        const isPast = dlDate < today;
        const diffDays = Math.ceil((dlDate.getTime() - today.getTime()) / 86400000);
        return (
          <div className={`flex items-center gap-3 p-3 mb-4 rounded-xl border text-[13px] ${isPast ? 'bg-red-50 border-red-300 text-danger' : diffDays <= 3 ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
            <Clock className="size-4 shrink-0" />
            <p>
              <strong>เดดไลน์พนักงานยื่นคำร้อง OT:</strong>{' '}
              {fmtDate(deadline.deadline_date)}{' '}
              {isPast ? '(หมดเขตแล้ว — พนักงานไม่สามารถยื่นได้อีก)' : `(อีก ${diffDays} วัน)`}
            </p>
          </div>
        );
      })() : (
        <div className="flex items-center gap-3 p-3 mb-4 rounded-xl border text-[13px] bg-[var(--neutral-50)] border-[var(--neutral-200)] text-[var(--neutral-500)]">
          <Clock className="size-4 shrink-0" />
          <p><strong>เดดไลน์พนักงานยื่นคำร้อง OT:</strong> ยังไม่ได้กำหนด (แอดมินสามารถตั้งค่าได้ในหน้าตั้งค่าเดดไลน์)</p>
        </div>
      )}

      {/* Budget bar */}
      {budgetStatus && budgetStatus.budget > 0 && (() => {
        const pct = Math.min(100, Math.round((budgetStatus.used / budgetStatus.budget) * 100));
        const selAmt = filtered.filter(r => sel.includes(r.id)).reduce((s, r) => s + Math.floor(parseFloat(r.ot_hours || '0')) * (otRate(r.day_type)), 0);
        const afterPct = Math.min(100, Math.round(((budgetStatus.used + selAmt) / budgetStatus.budget) * 100));
        const willExceed = budgetStatus.used + selAmt > budgetStatus.budget;
        return (
          <div className={`mb-4 p-4 rounded-xl border ${willExceed ? 'bg-red-50 border-red-300' : 'bg-[var(--neutral-50)] border-[var(--neutral-200)]'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-semibold text-[var(--neutral-700)]">งบประมาณ OT เดือนนี้</span>
              <span className={`text-[13px] font-bold ${willExceed ? 'text-danger' : pct >= 80 ? 'text-orange-500' : 'text-success'}`}>
                {budgetStatus.used.toLocaleString()} / {budgetStatus.budget.toLocaleString()} บาท
              </span>
            </div>
            <div className="relative h-3 bg-[var(--neutral-200)] rounded-full overflow-hidden">
              <div className="absolute left-0 top-0 h-full bg-success/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
              {selAmt > 0 && (
                <div className={`absolute top-0 h-full rounded-full transition-all ${willExceed ? 'bg-danger/60' : 'bg-orange-400/60'}`}
                  style={{ left: `${pct}%`, width: `${afterPct - pct}%` }} />
              )}
            </div>
            <div className="flex justify-between mt-1.5 text-[11px] text-[var(--neutral-500)]">
              <span>ใช้ไปแล้ว {pct}%</span>
              {budgetStatus.remaining !== null && (
                <span className={willExceed ? 'text-danger font-semibold' : ''}>
                  {willExceed
                    ? `เกินงบ ${(budgetStatus.used + selAmt - budgetStatus.budget).toLocaleString()} บาท`
                    : `คงเหลือ ${budgetStatus.remaining.toLocaleString()} บาท`}
                </span>
              )}
            </div>
          </div>
        );
      })()}

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
                    <td className="px-3 py-2 font-mono font-semibold">{(Math.floor(parseFloat(r.ot_hours || '0')) * (otRate(r.day_type))).toLocaleString()}</td>
                    <td className="px-3 py-2 text-[var(--neutral-500)]">{fmtDateTime(r.created_at)}</td>
                    <td className="px-3 py-2 flex gap-1">
                        <Button size="sm" className="bg-success text-white h-7" onClick={async () => {
                          const err = await doApprove(r.id);
                          if (err) setActionMsg({ kind: 'danger', text: err });
                          else setActionMsg({ kind: 'success', text: 'อนุมัติเรียบร้อยแล้ว' });
                          setTimeout(() => setActionMsg(null), 5000);
                          loadRequests();
                        }}>อนุมัติ</Button>
                      <Button size="sm" variant="outline" onClick={() => onDetail(r.id)} className="border-tu-red text-tu-red h-7">ดู</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ปุ่มแจ้งตัวแทนว่าพร้อมส่งออก */}
      {(() => {
        const gregYear = parseInt(thaiYear) - 543;
        const monthKey = `${gregYear}-${String(selMonth).padStart(2, '0')}`;
        const alreadyNotified = notifiedMonths.has(monthKey);
        return (
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              className={alreadyNotified
                ? 'border-green-400 text-green-700 bg-green-50 gap-2 cursor-default'
                : 'border-blue-400 text-blue-700 hover:bg-blue-50 gap-2'}
              onClick={alreadyNotified ? undefined : handleNotifyRep}
              disabled={notifyingRep || alreadyNotified}
            >
              <Bell className="size-4" />
              {notifyingRep ? 'กำลังแจ้ง…' : alreadyNotified ? `แจ้งตัวแทนไปแล้ว (เดือนนี้)` : 'แจ้งตัวแทนว่าพร้อมส่งออก'}
            </Button>
          </div>
        );
      })()}

      {sel.length > 0 && (
        <div className="sticky bottom-0 -mx-8 px-8 py-4 bg-white border-t border-[var(--neutral-300)] shadow-[0_-4px_12px_rgba(0,0,0,0.06)] flex items-center justify-between mt-6">
          <div>
            <p className="text-[13px] text-[var(--neutral-500)]">เลือก <strong className="text-[var(--neutral-black)]">{sel.length}</strong> รายการ</p>
            <p className="text-[18px] font-bold text-success">รวม {Math.round(totalAmount).toLocaleString()} บาท</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSel([])}>ยกเลิก</Button>
            <Button
              className="bg-success hover:bg-success/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleApprove}
              disabled={willExceedBudget}
              title={willExceedBudget ? 'ยอดรวมที่เลือกเกินงบประมาณคงเหลือ' : undefined}
            >
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
                  <td className="px-3 py-2 font-mono">{r.weekend ? OT_RATE_HOLIDAY : OT_RATE_WEEKDAY} บ/ชม.</td>
                  <td className="px-3 py-2 font-mono">{(Math.floor(r.hours) * (r.weekend ? OT_RATE_HOLIDAY : OT_RATE_WEEKDAY)).toLocaleString()}</td>
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
  const _sd = smartDefaultDate();
  const [thaiYear, setThaiYear] = useState(() => localStorage.getItem('head_history_thai_year') || String(_sd.year + 543));
  const [selMonth, setSelMonth] = useState(() => Number(localStorage.getItem('head_history_month') || _sd.month));
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
        subtitle={`${filtered.length} รายการ · กรองตาม วันที่ทำ OT ของ${THAI_MONTHS_FULL[selMonth - 1]} ${thaiYear}`}
        right={
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={thaiYear}
              onChange={e => { localStorage.setItem('head_history_thai_year', e.target.value); setThaiYear(e.target.value); }}
              className="w-[90px] text-center"
              min={2560}
              max={2599}
            />
            <Select value={String(selMonth)} onValueChange={v => { localStorage.setItem('head_history_month', v); setSelMonth(Number(v)); }}>
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
                      <td className="px-3 py-2 font-mono font-semibold">{(Math.floor(parseFloat(r.ot_hours || '0')) * (otRate(r.day_type))).toLocaleString()}</td>
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
  const _now = new Date();
  const [members, setMembers] = useState<any[]>([]);
  const [otMap, setOtMap] = useState<Record<number, any[]>>({});
  const [deptName, setDeptName] = useState('');
  const [detailMember, setDetailMember] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  // detail view filter
  const [detailThaiYear, setDetailThaiYear] = useState(String(_now.getFullYear() + 543));
  const [detailMonth, setDetailMonth] = useState<number | 0>(0); // 0 = ทุกเดือน
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
        setMembers(userList.filter((u: any) => u.role !== 'admin'));
        setOtMap(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalHours = members.reduce((s, m) => s + (otMap[m.id] || []).reduce((ss: number, r: any) => ss + parseFloat(r.ot_hours || 0), 0), 0);
  const totalAmt   = members.reduce((s, m) => s + (otMap[m.id] || []).reduce((ss: number, r: any) => ss + Math.floor(parseFloat(r.ot_hours || '0')) * (otRate(r.day_type)), 0), 0);
  const hasOt      = members.filter(m => (otMap[m.id] || []).length > 0).length;

  if (loading) return (
    <div className="flex items-center justify-center h-60 gap-3 text-[var(--neutral-500)]">
      <div className="size-8 border-4 border-tu-red border-t-transparent rounded-full animate-spin" />
      <span>กำลังโหลด...</span>
    </div>
  );

  // ─── Subpage: รายละเอียด OT ของสมาชิก ───────────────────────────────────
  if (detailMember) {
    const allReqs = otMap[detailMember.id] || [];
    const detailGregYear = parseInt(detailThaiYear) - 543;
    const reqs = allReqs.filter((r: any) => {
      const d = new Date(r.work_date);
      if (d.getFullYear() !== detailGregYear) return false;
      if (detailMonth !== 0 && d.getMonth() + 1 !== detailMonth) return false;
      return true;
    });
    const totalDetailAmt = reqs.reduce((s: number, r: any) =>
      s + Math.floor(parseFloat(r.ot_hours || '0')) * (otRate(r.day_type)), 0);

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
          <div className="flex-1">
            <h1 className="text-[20px] font-bold">
              OT ของ {detailMember.first_name} {detailMember.last_name}
            </h1>
            <p className="text-[12px] text-[var(--neutral-500)]">
              {detailMember.employee_id || detailMember.username} · {deptName}
            </p>
          </div>
          {/* ตัวกรองเดือน / ปี */}
          <div className="flex items-center gap-2 shrink-0">
            <Select value={String(detailMonth)} onValueChange={v => setDetailMonth(Number(v))}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">ทุกเดือน</SelectItem>
                {THAI_MONTHS_FULL.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={detailThaiYear}
              onChange={e => setDetailThaiYear(e.target.value)}
              className="w-[90px] text-center"
              min={2560} max={2599}
              placeholder="ปี พ.ศ."
            />
          </div>
        </div>

        {reqs.length === 0 ? (
          <div className="text-center py-20 text-[var(--neutral-400)]">
            <Clock className="size-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">ไม่มีคำขอ OT ในช่วงเวลาที่เลือก</p>
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
                    const amt = Math.floor(parseFloat(r.ot_hours || '0')) * (otRate(r.day_type));
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
      <PageHeader title={`สมาชิกในแผนก${deptName ? ` — ${deptName} (${members.length} คน)` : ''}`} />
      {members.length === 0 ? (
        <div className="text-center py-16 text-[var(--neutral-500)]">ไม่พบสมาชิกในแผนก</div>
      ) : (
        <div className="grid grid-cols-4 gap-5">
          {members.map(m => {
            const reqs = otMap[m.id] || [];
            const hrs  = reqs.reduce((s: number, r: any) => s + parseFloat(r.ot_hours || 0), 0);
            const amt  = reqs.reduce((s: number, r: any) => s + Math.floor(parseFloat(r.ot_hours || '0')) * (otRate(r.day_type)), 0);
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

function headThaiDate(s: string) {
  const d = new Date(s);
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function generateHeadXlsx(requests: any[], deptName: string, signatoryName: string, carryover = 0, monthLabel?: string, payerName = '') {
  // ── แปลง requests → employees (เหมือน deptrep) ──────────────────────────
  const DATESPR = 8;
  const grouped: Record<string, { name: string; reqs: any[] }> = {};
  requests.forEach(r => {
    const name = r.staff_name || 'ไม่ระบุ';
    if (!grouped[name]) grouped[name] = { name, reqs: [] };
    grouped[name].reqs.push(r);
  });
  const employees = Object.values(grouped).map((g, i) => {
    const sorted = [...g.reqs].sort((a, b) => (a.work_date || '').localeCompare(b.work_date || ''));
    const days = sorted.map(r => {
      const startRaw = r.start_time ? r.start_time.slice(0, 5) : (r.day_type === 'weekday' ? '16:30' : '08:00');
      const endRaw   = r.end_time   ? r.end_time.slice(0, 5)   : startRaw;
      return {
        date: headThaiDate(r.work_date),
        time: `${startRaw.replace(':', '.')}-${endRaw.replace(':', '.')} น.`,
        isWeekend: r.day_type === 'holiday',
      };
    });
    const weekdayHrs = g.reqs.filter(r => r.day_type !== 'holiday').reduce((s, r) => s + parseFloat(r.ot_hours || 0), 0);
    const weekendHrs = g.reqs.filter(r => r.day_type === 'holiday').reduce((s, r) => s + parseFloat(r.ot_hours || 0), 0);
    const amount = g.reqs.reduce((s, r) => s + Math.floor(parseFloat(r.ot_hours || '0')) * otRate(r.day_type), 0);
    return { seq: i + 1, name: g.name, days, weekdayHrs: Math.round(weekdayHrs * 10) / 10, weekendHrs: Math.round(weekendHrs * 10) / 10, amount: Math.round(amount) };
  });

  // ── คำนวณ month label จาก requests ถ้าไม่ได้ส่งมา ──────────────────────
  const month = monthLabel || (() => {
    const wd = requests[0]?.work_date;
    if (wd) { const d = new Date(wd); return `${THAI_MONTHS_FULL[d.getMonth()]} ${d.getFullYear() + 543}`; }
    const now = new Date(); return `${THAI_MONTHS_FULL[now.getMonth()]} ${now.getFullYear() + 543}`;
  })();

  const grandTotal = employees.reduce((s, e) => s + e.amount, 0) + carryover;
  const wb = XLSX.utils.book_new();
  const rows: any[][] = [];
  const C = 16;
  const pad = (n: number) => Array(n).fill('');

  // ── Header rows (เหมือน deptrep ทุกอย่าง) ──────────────────────────────
  rows.push(['หลักฐานการเบิกจ่ายเงินค่าตอบแทนการปฏิบัติงานนอกเวลาราชการ', ...pad(C - 1)]);
  rows.push([`  ${deptName}  ประจำเดือน ${month}`, ...pad(C - 1)]);
  rows.push(['ลำดับที่', 'ชื่อ-สกุล', 'วันปฏิบัติงานนอกเวลาราชการ', '', '', '', '', '', '', '', 'รวมเวลา', '', 'จำนวนเงิน', '', '', 'หมายเหตุ']);
  rows.push(['', '', '', '', '', '', '', '', '', '', 'ปฏิบัติงาน', '', '', 'ว.ด.ป.', 'ลายมือชื่อ', '']);
  rows.push(['', '', '', '', '', '', '', '', '', '', 'วันปกติ', 'วันหยุด', '', 'ที่รับเงิน', 'ผู้รับเงิน', '']);
  rows.push(['', '', '', '', '', '', '', '', '', '', '(ชั่วโมง)', '(ชั่วโมง)', '', '', '', '']);

  // ── Data rows (เหมือน deptrep: date row + time row) ────────────────────
  const holidayCells: { r: number; c: number }[] = [];
  const leftAlignCells: { r: number; c: number }[] = [];
  const boldCells: { r: number; c: number }[] = [];
  const timeRowSet     = new Set<number>();
  const lastTimeRowSet = new Set<number>();
  let curRow = 6;
  let isFirstDataRow = true;

  employees.forEach(emp => {
    const chunks: typeof emp.days[] = [];
    for (let i = 0; i < emp.days.length; i += DATESPR) chunks.push(emp.days.slice(i, i + DATESPR));
    if (chunks.length === 0) chunks.push([]);

    chunks.forEach((chunk, ci) => {
      const isLast = ci === chunks.length - 1;

      // date row: A, B ว่าง — ใส่ "ยอดยกมา" (ถ้ามี) ใน K ของ first data row
      const dateRow: any[] = ['', ''];
      for (let i = 0; i < DATESPR; i++) {
        dateRow.push(chunk[i]?.date ?? '');
        if (chunk[i]?.isWeekend) {
          holidayCells.push({ r: curRow, c: 2 + i });
          holidayCells.push({ r: curRow + 1, c: 2 + i });
        }
      }
      if (isFirstDataRow) {
        const carryoverLabel = carryover > 0 ? `ยอดยกมา ${carryover.toLocaleString()} บ.` : 'ยอดยกมา';
        dateRow.push(carryoverLabel, '', '', '', '', '');
        boldCells.push({ r: curRow, c: 10 });
      } else {
        dateRow.push('', '', '', '', '', '');
      }
      rows.push(dateRow);
      isFirstDataRow = false;

      // time row: A=seq, B=ชื่อ (chunk แรก); K=ชม.วันธรรมดา, L=ชม.วันหยุด, M=ยอดบาท batch; P=รวมของ employee (last batch)
      const chunkWD = Math.floor(chunk.filter(d => !d.isWeekend).reduce((s, d) => s + parseOTHoursHead(d.time), 0));
      const chunkWE = Math.floor(chunk.filter(d =>  d.isWeekend).reduce((s, d) => s + parseOTHoursHead(d.time), 0));
      const chunkAmt = Math.round(chunk.reduce((s, d) => {
        const hrs = parseOTHoursHead(d.time);
        return s + Math.floor(hrs) * (d.isWeekend ? otRate('holiday') : otRate('weekday'));
      }, 0));
      const timeRow: any[] = [ci === 0 ? emp.seq : '', ci === 0 ? emp.name : ''];
      if (ci === 0) leftAlignCells.push({ r: curRow + 1, c: 1 });
      for (let i = 0; i < DATESPR; i++) timeRow.push(chunk[i]?.time ?? '');
      timeRow.push(chunkWD || '', chunkWE || '', chunkAmt ? chunkAmt.toLocaleString() : '', '', '', isLast ? emp.amount.toLocaleString() : '');
      rows.push(timeRow);
      timeRowSet.add(curRow + 1);
      if (isLast) lastTimeRowSet.add(curRow + 1);
      curRow += 2;
    });
  });

  // ── Sum row ──────────────────────────────────────────────────────────────
  rows.push([]);
  const sumRowIdx = curRow + 1;
  leftAlignCells.push({ r: sumRowIdx, c: 2 });
  const sumRow: any[] = ['', '', `  รวมเงินจ่ายทั้งสิ้น  (ตัวอักษร)  -${thaiNumber(grandTotal)}-`];
  for (let i = 0; i < DATESPR - 1; i++) sumRow.push('');
  sumRow.push('รวมเป็นเงิน', '', grandTotal.toLocaleString(), '', '', '');
  rows.push(sumRow);

  // ── Footer (เหมือน deptrep ทุกอย่าง) ────────────────────────────────────
  rows.push([]);
  rows.push(['', 'ขอรับรองว่า  ผู้มีรายชื่อข้างต้นปฏิบัติงานนอกเวลาราชการจริง', ...pad(C - 2)]);
  rows.push(['ลงชื่อ', '', '', 'ผู้รับรองการปฏิบัติงาน', '', '', '', '', '', 'ลายมือชื่อ', '', '', '', 'ผู้จ่ายเงิน', '', '']);
  rows.push(['', `(${signatoryName})`, '', '', '', '', '', '', '', '', payerName ? `(${payerName})` : '', '', '', '', '', '']);
  rows.push(['ตำแหน่ง', `หัวหน้า${deptName}`, '', '', '', '', '', '', '', '         ตำแหน่ง', '', '', '', '', '', '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 8 }, { wch: 40 }, { wch: 16 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 },
    { wch: 7 }, { wch: 7 }, { wch: 9 }, { wch: 8 }, { wch: 13 }, { wch: 11 },
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 15 } },
    { s: { r: 2, c: 0 }, e: { r: 5, c: 0 } },
    { s: { r: 2, c: 1 }, e: { r: 5, c: 1 } },
    { s: { r: 2, c: 2 }, e: { r: 5, c: 9 } },
    { s: { r: 2, c: 10 }, e: { r: 2, c: 11 } },
    { s: { r: 3, c: 10 }, e: { r: 3, c: 11 } },
    { s: { r: 2, c: 12 }, e: { r: 5, c: 12 } },
    { s: { r: 2, c: 15 }, e: { r: 5, c: 15 } },
    { s: { r: 6, c: 10 }, e: { r: 6, c: 11 } },
    { s: { r: sumRowIdx, c: 2 }, e: { r: sumRowIdx, c: 9 } },
    { s: { r: sumRowIdx, c: 10 }, e: { r: sumRowIdx, c: 11 } },
    { s: { r: sumRowIdx + 4, c: 1 }, e: { r: sumRowIdx + 4, c: 2 } },
    { s: { r: sumRowIdx + 4, c: 10 }, e: { r: sumRowIdx + 4, c: 12 } },
    { s: { r: sumRowIdx + 5, c: 10 }, e: { r: sumRowIdx + 5, c: 12 } },
  ];

  // ── Cell styling (เหมือน deptrep ทุกอย่าง) ─────────────────────────────
  const FONT = 'TH Sarabun New';
  const centerAlign = { horizontal: 'center', vertical: 'center', wrapText: true };
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = range.s.r; r <= range.e.r; r++) {
    const isTitle  = r <= 1;
    const isColHdr = r >= 2 && r <= 5;
    const isSumRow = r === sumRowIdx;
    const fontSize = isTitle ? 16 : isColHdr ? 13 : 14;
    const bold     = isTitle || isColHdr || isSumRow;
    const font = { name: FONT, sz: fontSize, bold };
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      let border: any = undefined;
      const thin = { style: 'thin' };
      if (r >= 2 && r <= 5) {
        if ((c === 10 || c === 11) && r === 2) border = { top: thin, left: thin, right: thin };
        else if ((c === 10 || c === 11) && r === 3) border = { bottom: thin, left: thin, right: thin };
        else if (c === 13 || c === 14) {
          if (r === 2)      border = { top: thin, left: thin, right: thin };
          else if (r === 5) border = { bottom: thin, left: thin, right: thin };
          else              border = { left: thin, right: thin };
        } else {
          border = { top: thin, bottom: thin, left: thin, right: thin };
        }
      } else if (r >= 6 && r < sumRowIdx - 1) {
        if (c === 0 || c === 1) {
          if (r === 6)                   border = { top: thin, left: thin, right: thin };
          else if (lastTimeRowSet.has(r)) border = { bottom: thin, left: thin, right: thin };
          else                           border = { left: thin, right: thin };
        } else {
          border = { top: thin, bottom: thin, left: thin, right: thin };
        }
      } else if (r === sumRowIdx - 1) {
        if (c === 10)      border = { top: thin, left: thin };
        else if (c === 11) border = { top: thin, right: thin };
        else if (c === 12) border = { top: thin, left: thin, right: thin };
      } else if (r === sumRowIdx) {
        if (c === 10)      border = { bottom: thin, left: thin };
        else if (c === 11) border = { bottom: thin, right: thin };
        else if (c === 12) border = { bottom: thin, left: thin, right: thin };
      }
      const s = { font, alignment: centerAlign, ...(border ? { border } : {}) };
      if (ws[addr]) ws[addr].s = { ...ws[addr].s, ...s };
      else ws[addr] = { v: '', t: 's', s };
    }
  }
  holidayCells.forEach(({ r, c }) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    if (ws[addr]) ws[addr].s = { ...ws[addr].s, font: { name: FONT, sz: 14, color: { rgb: 'FF0000' } }, alignment: centerAlign };
    else ws[addr] = { v: '', t: 's', s: { font: { name: FONT, sz: 14, color: { rgb: 'FF0000' } }, alignment: centerAlign } };
  });
  const leftAlign = { horizontal: 'left', vertical: 'center', wrapText: true };
  leftAlignCells.forEach(({ r, c }) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    const font = { name: FONT, sz: 14, bold: r === sumRowIdx };
    if (ws[addr]) ws[addr].s = { ...ws[addr].s, font, alignment: leftAlign };
    else ws[addr] = { v: '', t: 's', s: { font, alignment: leftAlign } };
  });
  boldCells.forEach(({ r, c }) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    if (ws[addr]) ws[addr].s = { ...ws[addr].s, font: { name: FONT, sz: 14, bold: true }, alignment: centerAlign };
    else ws[addr] = { v: '', t: 's', s: { font: { name: FONT, sz: 14, bold: true }, alignment: centerAlign } };
  });
  // เส้นลายเซ็น
  const hairBottom = { bottom: { style: 'hair' } };
  const hairTop    = { top:    { style: 'hair' } };
  [[sumRowIdx+3,1],[sumRowIdx+3,2],[sumRowIdx+3,10],[sumRowIdx+3,11],[sumRowIdx+3,12]].forEach(([r,c])=>{
    const addr = XLSX.utils.encode_cell({ r, c });
    if (!ws[addr]) ws[addr] = { v: '', t: 's', s: { font: { name: FONT }, alignment: centerAlign } };
    ws[addr].s = { ...ws[addr].s, border: hairBottom };
  });
  [[sumRowIdx+4,1],[sumRowIdx+4,2],[sumRowIdx+4,10],[sumRowIdx+4,11],[sumRowIdx+4,12]].forEach(([r,c])=>{
    const addr = XLSX.utils.encode_cell({ r, c });
    if (!ws[addr]) ws[addr] = { v: '', t: 's', s: { font: { name: FONT }, alignment: centerAlign } };
    ws[addr].s = { ...ws[addr].s, border: hairTop };
  });

  ws['!pageSetup'] = { paperSize: 9, orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 };
  ws['!margins'] = { left: 0.39, right: 0.39, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 };
  XLSX.utils.book_append_sheet(wb, ws, 'OT Report');
  downloadXlsx(wb, `หลักฐานเบิกจ่าย OT-${deptName}-${month}.xlsx`);
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
  const [payerName, setPayerName]         = useState('');
  // Period filter state
  const [period, setPeriod]       = useState(() => localStorage.getItem('head_report_period') || 'month');
  const [thaiYear, setThaiYear]   = useState(() => localStorage.getItem('head_report_thai_year') || String(curThaiYear));
  const [thaiMonth, setThaiMonth] = useState(() => localStorage.getItem('head_report_month') || String(now.getMonth() + 1).padStart(2, '0'));
  const _m = now.getMonth() + 1;
  const curQuarter = _m >= 10 ? '1' : _m <= 3 ? '2' : _m <= 6 ? '3' : '4';
  const [quarter, setQuarter]     = useState(() => localStorage.getItem('head_report_quarter') || curQuarter);

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

  // label เดือน/ช่วงเวลาสำหรับ Excel export
  const exportMonthLabel = (() => {
    if (period === 'month') return `${HEAD_REPORT_MONTHS[parseInt(thaiMonth) - 1]} ${thaiYear}`;
    if (period === 'quarter') return `ไตรมาส ${quarter} ปีงบ ${thaiYear}`;
    if (period === 'half') return `ครึ่งปีที่ ${quarter} ปีงบ ${thaiYear}`;
    return `ปีงบประมาณ ${thaiYear}`;
  })();

  const byStaff: Record<string, { name: string; hours: number; amount: number }> = {};
  for (const r of filtered) {
    const k = r.staff_name || String(r.staff);
    if (!byStaff[k]) byStaff[k] = { name: k, hours: 0, amount: 0 };
    byStaff[k].hours  += parseFloat(r.ot_hours || 0);
    byStaff[k].amount += Math.floor(parseFloat(r.ot_hours || '0')) * (otRate(r.day_type));
  }
  const chartData    = Object.values(byStaff).sort((a, b) => b.hours - a.hours).slice(0, 8);
  const totalHrs     = filtered.reduce((s, r) => s + parseFloat(r.ot_hours || 0), 0);
  const totalAmt     = filtered.reduce((s, r) => s + Math.floor(parseFloat(r.ot_hours || '0')) * (otRate(r.day_type)), 0);
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
            <Select value={period} onValueChange={v => { localStorage.setItem('head_report_period', v); setPeriod(v); }}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>{HEAD_REPORT_PERIODS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input
              type="number"
              value={thaiYear}
              onChange={e => { localStorage.setItem('head_report_thai_year', e.target.value); setThaiYear(e.target.value); }}
              className="w-[90px] text-center"
              min={2560}
              max={2599}
            />
            {period === 'month' && (
              <Select value={thaiMonth} onValueChange={v => { localStorage.setItem('head_report_month', v); setThaiMonth(v); }}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>{HEAD_REPORT_MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1).padStart(2,'0')}>{m}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {(period === 'quarter' || period === 'half') && (
              <Select value={quarter} onValueChange={v => { localStorage.setItem('head_report_quarter', v); setQuarter(v); }}>
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
              <label className="text-[13px] font-medium block mb-1">ยอดค้างจ่าย OT จากเดือนก่อน (บาท)</label>
              <p className="text-[11px] text-[var(--neutral-500)] mb-1">กรณีมีเงิน OT ค้างจ่ายจากเดือนก่อนที่ยังไม่ได้รับ ให้กรอกเพื่อรวมในรายงาน ถ้าไม่มีให้เว้นว่าง</p>
              <Input type="number" min={0} value={carryover || ''} onChange={e => setCarryover(parseFloat(e.target.value) || 0)} placeholder="0" />
            </div>
            <div>
              <label className="text-[13px] font-medium block mb-1">ชื่อผู้รับรองการปฏิบัติงาน</label>
              <Input value={signatoryName} onChange={e => setSignatoryName(e.target.value)} placeholder="ชื่อ-สกุล หัวหน้า" />
            </div>
            <div>
              <label className="text-[13px] font-medium block mb-1">ชื่อผู้จ่ายเงิน <span className="text-[var(--neutral-400)] font-normal">(ถ้ามี)</span></label>
              <Input value={payerName} onChange={e => setPayerName(e.target.value)} placeholder="ชื่อ-สกุล ผู้จ่ายเงิน" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDlg(false)}>ยกเลิก</Button>
            <Button className="bg-tu-red hover:bg-tu-red-dark text-white" onClick={() => { generateHeadXlsx(filtered, deptName, signatoryName || headName, carryover, exportMonthLabel, payerName); setShowExportDlg(false); }}>
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


import { useState, useEffect } from 'react';
import { smartDefaultDate } from '../../utils/smartDefault';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  LayoutDashboard, FileSpreadsheet, History, Users, Download, CheckCircle2,
  ChevronRight, Send, RefreshCw, Upload,
} from 'lucide-react';
import { NavItem } from '../AppShell';
import { KpiCard, PageHeader, SectionCard, StatusChip, fmtDate, fmtDateTime } from '../shared';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog';

export const REP_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard',    icon: <LayoutDashboard /> },
  { key: 'export',    label: 'ส่งออก Excel',  icon: <FileSpreadsheet /> },
  { key: 'history',   label: 'ประวัติส่งออก', icon: <History /> },
  { key: 'members',   label: 'สมาชิกในแผนก',  icon: <Users /> },
];

const token = () => localStorage.getItem('access_token') || '';

const DATES_PER_ROW = 8;  // 8 คอลัมน์วันที่ (C-J) ตามแบบฟอร์มจริง

// ── Helpers ──────────────────────────────────────────────────────────────────

const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const THAI_MONTHS_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

function thaiDate(s: string) {
  const d = new Date(s);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function thaiMonthFull(ym: string) {
  const [y, m] = ym.split('-');
  return `${THAI_MONTHS_FULL[parseInt(m) - 1]} ${parseInt(y) + 543}`;
}

// ── Data types ──────────────────────────────────────────────────────────────
interface OTDay { date: string; time: string; isWeekend: boolean; }
interface OTEmployee {
  seq: number; name: string; days: OTDay[];
  weekdayHrs: number; weekendHrs: number; amount: number; note: string;
}

function requestsToEmployees(requests: any[]): OTEmployee[] {
  const grouped: Record<string, { name: string; reqs: any[] }> = {};
  requests.forEach(r => {
    const name = r.staff_name || 'ไม่ระบุ';
    if (!grouped[name]) grouped[name] = { name, reqs: [] };
    grouped[name].reqs.push(r);
  });
  return Object.values(grouped).map((g, i) => {
    const days: OTDay[] = g.reqs.map(r => ({
      date: thaiDate(r.work_date),
      time: `${(r.start_time || '').slice(0,5)}-${(r.end_time || '').slice(0,5)} น.`,
      isWeekend: r.day_type === 'holiday',
    }));
    const weekdayHrs = g.reqs.filter(r => r.day_type === 'weekday').reduce((s, r) => s + parseFloat(r.ot_hours || 0), 0);
    const weekendHrs = g.reqs.filter(r => r.day_type === 'holiday').reduce((s, r) => s + parseFloat(r.ot_hours || 0), 0);
    const amount = g.reqs.reduce((s, r) => s + Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60), 0);
    return { seq: i + 1, name: g.name, days, weekdayHrs: Math.round(weekdayHrs * 10) / 10, weekendHrs: Math.round(weekendHrs * 10) / 10, amount: Math.round(amount), note: '' };
  });
}

// ── Thai number → text ──────────────────────────────────────────────────────
function thaiAmountText(n: number): string {
  if (n === 0) return 'ศูนย์บาทถ้วน';
  const ones = ['','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
  const tens = ['','สิบ','ยี่สิบ','สามสิบ','สี่สิบ','ห้าสิบ','หกสิบ','เจ็ดสิบ','แปดสิบ','เก้าสิบ'];
  function chunk(num: number): string {
    if (num === 0) return '';
    if (num < 10) return ones[num];
    if (num < 100) { const t = Math.floor(num/10), o = num%10; return (t===1?'สิบ':tens[t])+ones[o]; }
    if (num < 1000) return ones[Math.floor(num/100)]+'ร้อย'+chunk(num%100);
    if (num < 10000) return ones[Math.floor(num/1000)]+'พัน'+chunk(num%1000);
    if (num < 100000) return chunk(Math.floor(num/10000))+'หมื่น'+chunk(num%10000);
    if (num < 1000000) return chunk(Math.floor(num/100000))+'แสน'+chunk(num%100000);
    return chunk(Math.floor(num/1000000))+'ล้าน'+chunk(num%1000000);
  }
  return chunk(n)+'บาทถ้วน';
}

// ── Excel generation (ตามแบบฟอร์มจริง — 16 คอลัมน์ A-P) ──────────────────
function generateXlsx(employees: OTEmployee[], month: string, deptName = 'สำนักงานทะเบียนนักศึกษา', signer = '') {
  const wb = XLSX.utils.book_new();
  const rows: any[][] = [];
  const C = 16;
  const pad = (n: number) => Array(n).fill('');

  rows.push(['หลักฐานการเบิกจ่ายเงินค่าตอบแทนการปฏิบัติงานนอกเวลาราชการ', ...pad(C-1)]);
  rows.push([`  ${deptName}  ประจำเดือน ${month}`, ...pad(C-1)]);
  rows.push(['ลำดับที่','ชื่อ-สกุล','วันปฏิบัติงานนอกเวลาราชการ','','','','','','','','รวมเวลา','','จำนวนเงิน','','','หมายเหตุ']);
  rows.push(['','','','','','','','','','','ปฏิบัติงาน','','','ว.ด.ป.','ลายมือชื่อ','']);
  rows.push(['','','','','','','','','','','วันปกติ','วันหยุด','','ที่รับเงิน','ผู้รับเงิน','']);
  rows.push(['','','','','','','','','','','(ชั่วโมง)','(ชั่วโมง)','','','','']);
  rows.push(['','','','','','','','','','','ยอดยกมา','','','','','']);

  const grandTotal = employees.reduce((s, e) => s + e.amount, 0);

  employees.forEach(emp => {
    const chunks: OTDay[][] = [];
    for (let i = 0; i < emp.days.length; i += DATES_PER_ROW) {
      chunks.push(emp.days.slice(i, i + DATES_PER_ROW));
    }
    if (chunks.length === 0) chunks.push([]);

    chunks.forEach((chunk, ci) => {
      const isLast = ci === chunks.length - 1;
      const dateRow: any[] = [ci === 0 ? emp.seq : '', ci === 0 ? emp.name : ''];
      for (let i = 0; i < DATES_PER_ROW; i++) dateRow.push(chunk[i]?.date ?? '');
      if (isLast) {
        dateRow.push(emp.weekdayHrs || '', emp.weekendHrs || '', emp.amount.toLocaleString(), '', '', emp.amount.toLocaleString());
      } else {
        dateRow.push('', '', '', '', '', '');
      }
      rows.push(dateRow);

      const timeRow: any[] = ['', ''];
      for (let i = 0; i < DATES_PER_ROW; i++) timeRow.push(chunk[i]?.time ?? '');
      timeRow.push('', '', '', '', '', '');
      rows.push(timeRow);
    });
  });

  const sumRow: any[] = ['', `  รวมเงินจ่ายทั้งสิ้น  (ตัวอักษร)  -${thaiAmountText(grandTotal)}-`];
  for (let i = 0; i < DATES_PER_ROW; i++) sumRow.push('');
  sumRow.push('รวมเป็นเงิน', '', grandTotal.toLocaleString(), '', '', '');
  rows.push(sumRow);

  rows.push([]);
  rows.push(['ขอรับรองว่า  ผู้มีรายชื่อข้างต้นปฏิบัติงานนอกเวลาราชการจริง', ...pad(C-1)]);
  rows.push(['ลงชื่อ', '', '', 'ผู้รับรองการปฏิบัติงาน', '', '', '', 'ลายมือชื่อ', '', 'ลงชื่อ', '', '', '', 'ผู้จ่ายเงิน', '', '']);
  const signerName = signer || 'นางสาวสาริยา  นวมจิต';
  rows.push(['', `(${signerName})`, '', '', '', '', '', '', '', '', '(นางสาวทองยุ่น  มธุรส)', '', '', '', '', '']);
  rows.push(['ตำแหน่ง', 'รักษาการในตำแหน่งเลขานุการสำนักงานทะเบียนนักศึกษา', '', '', '', '', '', '', '', '         ตำแหน่ง', 'นักวิชาการเงินและบัญชีชำนาญการ', '', '', '', '', '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    {wch:8},{wch:40},{wch:16},{wch:13},{wch:13},{wch:13},{wch:13},{wch:13},{wch:13},{wch:13},
    {wch:7},{wch:7},{wch:9},{wch:8},{wch:13},{wch:11},
  ];
  ws['!merges'] = [
    {s:{r:0,c:0},e:{r:0,c:15}},
    {s:{r:1,c:0},e:{r:1,c:15}},
    {s:{r:2,c:0},e:{r:5,c:0}},
    {s:{r:2,c:1},e:{r:5,c:1}},
    {s:{r:2,c:2},e:{r:2,c:9}},
    {s:{r:2,c:10},e:{r:2,c:11}},
    {s:{r:3,c:10},e:{r:3,c:11}},
    {s:{r:4,c:10},e:{r:4,c:11}},
    {s:{r:5,c:10},e:{r:5,c:11}},
    {s:{r:2,c:12},e:{r:5,c:12}},
    {s:{r:2,c:13},e:{r:5,c:13}},
    {s:{r:2,c:14},e:{r:5,c:14}},
    {s:{r:2,c:15},e:{r:5,c:15}},
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'OT Report');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `OT-Report-${month}.xlsx`);
}

// ── Excel Preview ────────────────────────────────────────────────────────────
function ExcelPreview({ employees, month, deptName }: { employees: OTEmployee[]; month: string; deptName: string }) {
  const total = employees.reduce((s, e) => s + e.amount, 0);
  const th = 'border border-gray-400 px-1 py-0.5 text-center bg-gray-100 text-[11px] font-semibold';
  const td = 'border border-gray-400 px-1 py-0.5 text-[11px]';
  const tdC = td + ' text-center';
  return (
    <div className="overflow-auto rounded-lg border border-[var(--neutral-300)] bg-white shadow-inner">
      <div style={{ minWidth: 1100, fontFamily: 'Sarabun, sans-serif', fontSize: 12 }} className="p-4">
        <div className="text-center font-semibold mb-0.5" style={{ fontSize: 13 }}>หลักฐานการเบิกจ่ายเงินค่าตอบแทนการปฏิบัติงานนอกเวลาราชการ</div>
        <div className="text-center mb-3" style={{ fontSize: 12 }}>{deptName}&nbsp;&nbsp;ประจำเดือน {month}</div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th} rowSpan={2} style={{width:36}}>ลำดับที่</th>
              <th className={th} rowSpan={2} style={{width:180}}>ชื่อ-สกุล</th>
              <th className={th} colSpan={DATES_PER_ROW}>วันปฏิบัติงานนอกเวลาราชการ</th>
              <th className={th} colSpan={2}>รวมเวลา<br/>ปฏิบัติงาน</th>
              <th className={th} rowSpan={2} style={{width:70}}>จำนวนเงิน</th>
              <th className={th} rowSpan={2} style={{width:60}}>ว.ด.ป.<br/>ที่รับเงิน</th>
              <th className={th} rowSpan={2} style={{width:90}}>ลายมือชื่อ<br/>ผู้รับเงิน</th>
              <th className={th} rowSpan={2} style={{width:70}}>หมายเหตุ</th>
            </tr>
            <tr>
              {Array.from({length:DATES_PER_ROW},(_,i)=><th key={i} className={th} style={{width:90}}>วันที่ {i+1}</th>)}
              <th className={th} style={{width:55}}>วันปกติ<br/>(ชั่วโมง)</th>
              <th className={th} style={{width:55}}>วันหยุด<br/>(ชั่วโมง)</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <>
                <tr key={`d-${emp.seq}`}>
                  <td className={tdC} rowSpan={2}>{emp.seq}</td>
                  <td className={td} rowSpan={2}>{emp.name}</td>
                  {Array.from({length:DATES_PER_ROW},(_,i)=>(
                    <td key={i} className={tdC} style={{color:emp.days[i]?.isWeekend?'#B8001F':undefined}}>{emp.days[i]?.date??''}</td>
                  ))}
                  <td className={tdC} rowSpan={2}>{emp.weekdayHrs||''}</td>
                  <td className={tdC} rowSpan={2}>{emp.weekendHrs||''}</td>
                  <td className={tdC} rowSpan={2}>{emp.amount.toLocaleString()}</td>
                  <td className={tdC} rowSpan={2}></td><td className={tdC} rowSpan={2}></td><td className={tdC} rowSpan={2}>{emp.note}</td>
                </tr>
                <tr key={`t-${emp.seq}`}>
                  {Array.from({length:DATES_PER_ROW},(_,i)=>(
                    <td key={i} className={tdC} style={{color:emp.days[i]?.isWeekend?'#B8001F':undefined}}>{emp.days[i]?.time??''}</td>
                  ))}
                </tr>
              </>
            ))}
            <tr>
              <td className={td} colSpan={DATES_PER_ROW+2+1}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;รวมเงินจ่ายทั้งสิ้น (ตัวอักษร) &nbsp;-{thaiAmountText(total)}-</td>
              <td className={th} colSpan={2}>รวมเป็นเงิน</td>
              <td className={tdC+' font-semibold'}>{total.toLocaleString()}</td>
              <td className={td}></td><td className={td}></td><td className={td}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Pages ─────────────────────────────────────────────────────────────────────

export function RepDashboard({ onGo }: { onGo: () => void }) {
  const [pending, setPending] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = { Authorization: `Bearer ${token()}` };
    // history = ทุก status ที่ผ่าน rep_forwarded แล้ว (รวมที่ checker ดำเนินการแล้ว)
    const now = new Date();
    const monthParam = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    Promise.all([
      fetch('/api/ot-requests/?status=head_approved', { headers: h }).then(r => r.json()),
      fetch(`/api/ot-requests/?status_in=rep_forwarded,checker_approved,checker_rejected,completed&month=${monthParam}`, { headers: h }).then(r => r.json()),
    ]).then(([p, f]) => {
      setPending(Array.isArray(p) ? p : (p.results || []));
      setHistory(Array.isArray(f) ? f : (f.results || []));
    }).finally(() => setLoading(false));
  }, []);

  const totalAmt = pending.reduce((s, r) => s + Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60), 0);

  const exportedMonths = loading ? 0 : new Set(history.map((r: any) => (r.work_date || '').substring(0, 7)).filter(Boolean)).size;

  return (
    <>
      <PageHeader title="Dashboard ตัวแทนฝ่าย" />
      <div className="grid grid-cols-3 gap-5 mb-6">
        <div className="bg-white rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] border border-[var(--neutral-300)] flex flex-col justify-between">
          <p className="text-[12px] text-[var(--neutral-500)]">พร้อมส่งออก</p>
          <p className="text-[32px] font-bold text-tu-red tabular-nums">{loading ? '...' : pending.length}</p>
          <Button size="sm" onClick={() => {
            if (pending.length > 0) {
              const cnt: Record<string, number> = {};
              pending.forEach((r: any) => { const k = (r.work_date || '').substring(0, 7); if (k) cnt[k] = (cnt[k] || 0) + 1; });
              const dom = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0];
              if (dom) sessionStorage.setItem('notif_nav_month', dom);
            }
            onGo();
          }} className="bg-tu-red text-white">ไปส่งออก <ChevronRight className="size-4 ml-1" /></Button>
        </div>
        <KpiCard label="ส่งออกแล้วเดือนนี้" value={<span className="text-success">{loading ? '...' : `${exportedMonths} ไฟล์`}</span>} accent="green" />
        <KpiCard label="รวมยอดรอส่งออก" value={`${totalAmt.toLocaleString()} ฿`} accent="blue" />
      </div>

      {pending.length > 0 && (
        <div className="bg-tu-yellow-soft border border-tu-yellow rounded-xl p-6 mb-6 flex items-center gap-5">
          <div className="size-20 rounded-xl bg-success grid place-items-center text-white">
            <FileSpreadsheet className="size-10" />
          </div>
          <div className="flex-1">
            <h2>มี {pending.length} คำร้องพร้อมส่งออก</h2>
            <p className="text-[var(--neutral-500)] mt-1">รวมยอด {totalAmt.toLocaleString()} บาท • ผ่านการอนุมัติจากหัวหน้างานแล้วทั้งหมด</p>
          </div>
          <Button onClick={() => {
            if (pending.length > 0) {
              const cnt: Record<string, number> = {};
              pending.forEach((r: any) => { const k = (r.work_date || '').substring(0, 7); if (k) cnt[k] = (cnt[k] || 0) + 1; });
              const dom = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0];
              if (dom) sessionStorage.setItem('notif_nav_month', dom);
            }
            onGo();
          }} className="bg-tu-red hover:bg-tu-red-dark text-white h-12 px-6">
            ส่งออกเลย <ChevronRight className="size-4 ml-1" />
          </Button>
        </div>
      )}

      <SectionCard title="คำร้องที่ส่งต่อล่าสุด">
        {history.length === 0 ? (
          <p className="text-[var(--neutral-500)] text-center py-6">ยังไม่มีประวัติการส่งต่อ</p>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 5).map((r, i) => (
              <div key={i} className="flex items-center gap-4 py-2 border-b last:border-0 border-[var(--neutral-300)]">
                <div className="size-9 rounded-full bg-green-100 text-success grid place-items-center">
                  <CheckCircle2 className="size-4" />
                </div>
                <div className="flex-1">
                  <p className="text-[14px]"><strong>{r.staff_name}</strong> — {Math.floor(parseFloat(r.ot_hours || '0'))} ชม. {(Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60)).toLocaleString()} บาท</p>
                  <p className="text-[12px] text-[var(--neutral-500)]">{r.work_date}</p>
                </div>
                <StatusChip kind="success">ส่งต่อแล้ว</StatusChip>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}

// ── RepExport + RepPreview (รวม state ไว้ด้วยกัน) ────────────────────────────

export function RepExportFlow({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<'select' | 'preview' | 'forward'>('select');
  const [requests, setRequests] = useState<any[]>([]);
  const [selIds, setSelIds] = useState<number[]>([]);
  const _sd0 = smartDefaultDate();
  const _initMonth = (() => {
    const stored = sessionStorage.getItem('notif_nav_month');
    if (stored) { sessionStorage.removeItem('notif_nav_month'); return stored; }
    return null;
  })();
  const [selThaiYear, setSelThaiYear] = useState(_initMonth ? String(parseInt(_initMonth.split('-')[0]) + 543) : String(_sd0.year + 543));
  const [selMonth,    setSelMonth]    = useState(_initMonth ? String(parseInt(_initMonth.split('-')[1])) : String(_sd0.month));
  const [autoDetecting, setAutoDetecting] = useState(!_initMonth);
  // month param ที่ส่ง API (Gregorian YYYY-MM)
  const gregYear = parseInt(selThaiYear) - 543;
  const month = `${gregYear}-${selMonth.padStart(2, '0')}`;
  const [loading, setLoading] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [done, setDone] = useState(false);
  const [note, setNote] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [checkers, setCheckers] = useState<{ id: number; full_name: string; notify_email: string; email: string }[]>([]);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setDeptName(JSON.parse(u).department_name || '');
    fetch('/api/users/?role=checker', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => setCheckers(Array.isArray(d) ? d : (d.results || [])));

    // auto-detect เดือนที่มี head_approved request — ลองย้อนหลัง 12 เดือนแบบ parallel
    const now = new Date();
    const candidates = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return { ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, year: d.getFullYear(), mon: d.getMonth() + 1 };
    });
    const h = { Authorization: `Bearer ${token()}` };
    Promise.all(
      candidates.map(c =>
        fetch(`/api/ot-requests/?status_in=head_approved,checker_rejected&month=${c.ym}&page_size=1`, { headers: h })
          .then(r => r.json())
          .then(res => ({ c, count: (Array.isArray(res) ? res : (res.results || [])).length }))
          .catch(() => ({ c, count: 0 }))
      )
    ).then(results => {
      const found = results.find(r => r.count > 0);
      if (found) {
        setSelThaiYear(String(found.c.year + 543));
        setSelMonth(String(found.c.mon));
      }
      setAutoDetecting(false);
    });
  }, []);

  function loadRequests() {
    setDownloaded(false);
    setLoading(true);
    fetch(`/api/ot-requests/?status_in=head_approved,checker_rejected&month=${month}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : (d.results || []);
        setRequests(list);
        setSelIds(list.map((r: any) => r.id));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { if (!autoDetecting) loadRequests(); }, [month, autoDetecting]);

  const selRequests = requests.filter(r => selIds.includes(r.id));
  const employees = requestsToEmployees(selRequests);
  const totalAmt = selRequests.reduce((s, r) => s + Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60), 0);
  const monthLabel = month ? thaiMonthFull(month) : '';

  async function forwardAll() {
    setForwarding(true);
    const body = new FormData();
    body.append('ids', JSON.stringify(selIds));
    body.append('note', note);
    if (uploadedFile) body.append('document', uploadedFile);
    await fetch('/api/ot-requests/bulk-forward/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` },
      body,
    });
    setForwarding(false);
    setDone(true);
  }

  // ── Step: เลือกข้อมูล ──
  if (step === 'select') return (
    <>
      <PageHeader title="ส่งออกข้อมูลเป็น Excel" />
      <StepBar step={0} />
      <SectionCard>
        {autoDetecting && (
          <div className="flex items-center gap-2 mb-4 text-[13px] text-[var(--neutral-500)]">
            <RefreshCw className="size-4 animate-spin" />
            กำลังค้นหาเดือนที่มีข้อมูล...
          </div>
        )}
        <div className="flex items-end gap-3 mb-5">
          <div>
            <label className="text-[12px] text-[var(--neutral-500)] mb-1 block">เดือน</label>
            <Select value={selMonth} onValueChange={v => { setSelMonth(v); }} disabled={autoDetecting}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={autoDetecting ? 'กำลังค้นหา...' : undefined} />
              </SelectTrigger>
              <SelectContent>
                {THAI_MONTHS_FULL.map((name, i) => (
                  <SelectItem key={i+1} value={String(i+1)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[12px] text-[var(--neutral-500)] mb-1 block">ปี (พ.ศ.)</label>
            <Select value={selThaiYear} onValueChange={v => { setSelThaiYear(v); }} disabled={autoDetecting}>
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({length:3},(_,i)=>{
                  const y = String(new Date().getFullYear() + 543 - i);
                  return <SelectItem key={y} value={y}>{y}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={loadRequests} disabled={loading || autoDetecting}>
            <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> รีเฟรช
          </Button>
        </div>

        {(loading || autoDetecting) ? (
          <p className="text-center py-8 text-[var(--neutral-500)]">กำลังโหลด...</p>
        ) : requests.length === 0 ? (
          <p className="text-center py-8 text-[var(--neutral-500)]">ไม่มีคำร้องที่ผ่านการอนุมัติในเดือนนี้</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-[var(--neutral-300)]">
              <table className="w-full text-[13px]">
                <thead className="bg-tu-red text-white">
                  <tr>
                    <th className="px-3 py-3">
                      <Checkbox
                        checked={selIds.length === requests.length}
                        onCheckedChange={c => setSelIds(c ? requests.map(r => r.id) : [])}
                      />
                    </th>
                    {['ชื่อ-สกุล','วันที่','ชั่วโมง','จำนวนเงิน','ประเภท'].map(h => (
                      <th key={h} className="text-left px-3 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.map(r => (
                    <tr key={r.id} className="border-t border-[var(--neutral-300)]">
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={selIds.includes(r.id)}
                          onCheckedChange={c => setSelIds(s => c ? [...s, r.id] : s.filter(x => x !== r.id))}
                        />
                      </td>
                      <td className="px-3 py-2">{r.staff_name}</td>
                      <td className="px-3 py-2 text-[var(--neutral-500)]">{r.work_date}</td>
                      <td className="px-3 py-2 font-mono">{Math.floor(parseFloat(r.ot_hours))} ชม.</td>
                      <td className="px-3 py-2 font-mono font-semibold">{(Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60)).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <StatusChip kind={r.day_type === 'holiday' ? 'warning' : 'info'}>
                          {r.day_type === 'holiday' ? 'วันหยุด' : 'วันธรรมดา'}
                        </StatusChip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 bg-[var(--neutral-100)] rounded-lg p-4">
              <p className="text-[13px]">
                เลือก <strong>{selIds.length}</strong> รายการ • รวม{' '}
                <strong className="text-success">{totalAmt.toLocaleString()}</strong> บาท
              </p>
            </div>
          </>
        )}
      </SectionCard>
      <div className="flex justify-end mt-6">
        <Button onClick={() => setStep('preview')} disabled={selIds.length === 0} className="bg-tu-red hover:bg-tu-red-dark text-white">
          ตรวจสอบและส่งออก <ChevronRight className="size-4 ml-1" />
        </Button>
      </div>
    </>
  );

  // ── Step: ตรวจสอบ ──
  if (step === 'preview') return (
    <>
      <PageHeader title="ตัวอย่างไฟล์ Excel — แบบฟอร์มหลักฐานการจ่ายค่า OT" />
      <StepBar step={1} />
      <SectionCard className="mb-5">
        <ExcelPreview employees={employees} month={monthLabel} deptName={deptName} />
        <div className="mt-5 pt-4 border-t border-[var(--neutral-300)] flex items-center gap-6">
          <p className="text-[13px] text-[var(--neutral-500)]">รูปแบบไฟล์: Excel (.xlsx) • {employees.length} พนักงาน • {selIds.length} คำร้อง</p>
        </div>
      </SectionCard>
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep('select')}>← ย้อนกลับ</Button>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="border-tu-red text-tu-red"
            onClick={() => { generateXlsx(employees, monthLabel, deptName); setDownloaded(true); }}
          >
            <Download className="size-4 mr-1" />ดาวน์โหลด Excel
          </Button>
          <Button
            className="bg-tu-red hover:bg-tu-red-dark text-white"
            onClick={() => setStep('forward')}
          >
            ส่งต่อผู้ตรวจสอบ <ChevronRight className="size-4 ml-1" />
          </Button>
        </div>
      </div>
    </>
  );

  // ── Step: ส่งต่อ ──
  return (
    <>
      <PageHeader title="ส่งต่อให้ผู้ตรวจสอบ" />
      <StepBar step={2} />
      <div className="max-w-2xl mx-auto">
        <SectionCard>
          {checkers.length > 0 && (
            <div className="mb-4 rounded-lg border border-[var(--neutral-300)] bg-[var(--neutral-50)] px-4 py-3">
              <p className="text-[12px] text-[var(--neutral-500)] mb-1.5">📧 จะส่งอีเมลแจ้งผู้ตรวจสอบ {checkers.length} คน</p>
              <div className="flex flex-wrap gap-2">
                {checkers.map(c => {
                  const mail = c.notify_email || c.email || '';
                  return (
                    <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-white border border-[var(--neutral-300)] px-3 py-1 text-[12px]">
                      <span className="font-medium">{c.full_name}</span>
                      {mail && <span className="text-[var(--neutral-400)]">— {mail}</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {/* อัปโหลดไฟล์ Excel ที่แก้ไขแล้ว */}
          <div className="mb-5">
            <label className="block text-[14px] font-medium mb-1">
              แนบไฟล์ Excel ที่ปรับแก้เรียบร้อยแล้ว <span className="text-tu-red">*</span>
            </label>
            <label className={`flex items-center gap-3 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${uploadedFile ? 'border-success bg-green-50' : 'border-[var(--neutral-300)] hover:border-tu-red hover:bg-tu-red-soft'}`}>
              <input
                type="file"
                accept=".xlsx,.xls,.pdf"
                className="hidden"
                onChange={e => setUploadedFile(e.target.files?.[0] ?? null)}
              />
              {uploadedFile ? (
                <>
                  <CheckCircle2 className="size-5 text-success shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-success truncate">{uploadedFile.name}</p>
                    <p className="text-[11px] text-[var(--neutral-500)]">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <span className="text-[12px] text-[var(--neutral-500)] shrink-0">คลิกเพื่อเปลี่ยนไฟล์</span>
                </>
              ) : (
                <>
                  <Upload className="size-5 text-[var(--neutral-400)] shrink-0" />
                  <div>
                    <p className="text-[13px] font-medium">คลิกเพื่อเลือกไฟล์ Excel</p>
                    <p className="text-[11px] text-[var(--neutral-500)]">รองรับ .xlsx, .xls, .pdf</p>
                  </div>
                </>
              )}
            </label>
          </div>

          <div className="mb-5">
            <label>หมายเหตุถึงผู้ตรวจสอบ (optional)</label>
            <Textarea
              className="mt-1"
              rows={3}
              placeholder="โปรดตรวจสอบและอนุมัติเพื่อดำเนินการเบิกจ่ายต่อไป"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="h-12 px-6" onClick={() => setStep('preview')} disabled={forwarding}>
              ← ย้อนกลับ
            </Button>
            <Button
              className="flex-1 h-12 bg-tu-red hover:bg-tu-red-dark text-white disabled:opacity-50"
              disabled={forwarding || !uploadedFile}
              onClick={forwardAll}
            >
              {forwarding ? (
                <><RefreshCw className="size-4 mr-2 animate-spin" />กำลังส่งต่อ...</>
              ) : (
                <><Send className="size-4 mr-2" />ส่งต่อ {selIds.length} คำร้องให้ผู้ตรวจสอบ</>
              )}
            </Button>
          </div>
        </SectionCard>
      </div>

      <Dialog open={done} onOpenChange={setDone}>
        <DialogContent>
          <div className="text-center py-4">
            <div className="size-16 rounded-full bg-green-100 grid place-items-center mx-auto mb-3">
              <CheckCircle2 className="size-10 text-success" />
            </div>
            <h3>ส่งต่อสำเร็จ!</h3>
            <p className="text-[var(--neutral-500)] mt-2">
              ส่งต่อ {selIds.length} คำร้องให้ผู้ตรวจสอบแล้ว
            </p>
            {checkers.length > 0 && (
              <p className="text-[12px] text-[var(--neutral-400)] mt-1">
                📧 แจ้งทางอีเมล {checkers.length} คน:{' '}
                {checkers.map(c => c.notify_email || c.email || c.full_name).filter(Boolean).join(', ')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => { setDone(false); onDone(); }} className="bg-tu-red text-white w-full">
              กลับหน้า Dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-4 mb-6">
      {['เลือกข้อมูล','ตรวจสอบ Excel','ส่งต่อผู้ตรวจสอบ'].map((s, i) => (
        <div key={s} className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`size-8 rounded-full grid place-items-center font-bold text-[13px] ${
              i < step ? 'bg-success text-white' : i === step ? 'bg-tu-red text-white' : 'bg-[var(--neutral-300)] text-[var(--neutral-500)]'
            }`}>{i < step ? '✓' : i + 1}</span>
            <span className={`font-semibold text-[14px] ${i === step ? 'text-tu-red' : i < step ? 'text-success' : 'text-[var(--neutral-500)]'}`}>{s}</span>
          </div>
          {i < 2 && <div className="w-16 h-px bg-[var(--neutral-300)]" />}
        </div>
      ))}
    </div>
  );
}

export function RepMembers() {
  const [members, setMembers] = useState<any[]>([]);
  const [deptName, setDeptName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = { Authorization: `Bearer ${token()}` };
    fetch('/api/auth/me/', { headers: h })
      .then(r => r.json())
      .then(me => {
        setDeptName(me.department_name || '');
        if (me.department) {
          return fetch(`/api/users/?department=${me.department}`, { headers: h })
            .then(r => r.json())
            .then(u => setMembers(Array.isArray(u) ? u : (u.results || [])));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <><PageHeader title="สมาชิกในแผนก" /><p className="text-center py-10">กำลังโหลด...</p></>;

  return (
    <>
      <PageHeader title={`สมาชิกในแผนก${deptName ? ` — ${deptName} (${members.length} คน)` : ''}`} />
      <div className="grid grid-cols-4 gap-5">
        {members.map(m => (
          <div key={m.id} className="bg-white border border-[var(--neutral-300)] rounded-xl p-5 text-center shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
            {m.profile_image
              ? <img src={m.profile_image} alt={m.full_name} className="size-14 rounded-full object-cover mx-auto mb-2" />
              : <div className={`size-14 rounded-full grid place-items-center mx-auto mb-2 text-xl font-bold ${m.role === 'depthead' ? 'bg-orange-500 text-white' : 'bg-tu-yellow text-black'}`}>
                  {(m.full_name || m.username || '?').charAt(0)}
                </div>
            }
            <h4 className="text-[13px] font-semibold leading-tight">{m.full_name || m.username}</h4>
            <p className="text-[11px] text-[var(--neutral-400)] mt-0.5">{m.employee_id || m.username}</p>
            <p className="text-[11px] text-[var(--neutral-500)] mt-0.5">{m.role === 'depthead' ? 'หัวหน้างาน' : 'พนักงาน'}</p>
          </div>
        ))}
      </div>
    </>
  );
}

const REP_STATUS_MAP: Record<string, { label: string; kind: 'success' | 'danger' | 'warning' | 'info' | 'neutral' }> = {
  submitted:        { label: 'รออนุมัติหัวหน้า',  kind: 'warning' },
  head_approved:    { label: 'หัวหน้าอนุมัติ',    kind: 'info' },
  head_rejected:    { label: 'หัวหน้าตีกลับ',     kind: 'danger' },
  rep_forwarded:    { label: 'ส่งต่อแล้ว',         kind: 'info' },
  checker_approved: { label: 'ตรวจผ่าน',           kind: 'success' },
  checker_rejected: { label: 'ตีกลับโดย Checker',  kind: 'danger' },
  completed:        { label: 'เสร็จสิ้น',           kind: 'success' },
};

export function RepHistory({ onGoExport }: { onGoExport?: (month: string) => void }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/ot-requests/?status_in=rep_forwarded,checker_approved,checker_rejected,completed', {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json())
      .then(d => setRequests(Array.isArray(d) ? d : (d.results || [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // จัดกลุ่มตามเดือน OT (work_date YYYY-MM) เรียงตาม rep_forwarded_at ล่าสุดก่อน
  const groups = (() => {
    const map: Record<string, any[]> = {};
    requests.forEach(r => {
      const key = (r.work_date || '').substring(0, 7);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return Object.entries(map).sort((a, b) => {
      // เรียงตามเวลาที่ส่งล่าสุดในกลุ่ม (rep_forwarded_at)
      const latestA = a[1].reduce((m: string, r: any) => (r.rep_forwarded_at || '') > m ? (r.rep_forwarded_at || '') : m, '');
      const latestB = b[1].reduce((m: string, r: any) => (r.rep_forwarded_at || '') > m ? (r.rep_forwarded_at || '') : m, '');
      return latestB.localeCompare(latestA);
    });
  })();

  function batchStatus(rows: any[]): 'checker_rejected' | 'checker_approved' | 'completed' | 'rep_forwarded' {
    if (rows.some(r => r.status === 'checker_rejected')) return 'checker_rejected';
    if (rows.every(r => r.status === 'completed'))       return 'completed';
    if (rows.some(r => r.status === 'checker_approved')) return 'checker_approved';
    return 'rep_forwarded';
  }

  const BATCH_STATUS: Record<string, { label: string; kind: 'success' | 'info' | 'danger' | 'warning'; icon: string }> = {
    completed:        { label: 'เสร็จสิ้น',       kind: 'success', icon: '✅' },
    checker_approved: { label: 'ตรวจผ่านแล้ว',    kind: 'success', icon: '✅' },
    rep_forwarded:    { label: 'รอผู้ตรวจสอบ',    kind: 'info',    icon: '⏳' },
    checker_rejected: { label: 'ถูกตีกลับ',        kind: 'danger',  icon: '❌' },
  };

  return (
    <>
      <PageHeader title="ประวัติส่งออก" subtitle={`${groups.length} เดือน`} />
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="size-8 border-4 border-tu-red border-t-transparent rounded-full animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <SectionCard>
          <p className="text-center py-12 text-[var(--neutral-500)]">ยังไม่มีประวัติการส่งออก</p>
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {groups.map(([monthKey, rows]) => {
            const st    = batchStatus(rows);
            const info  = BATCH_STATUS[st];
            const isExp = expanded === monthKey;
            const gregM = parseInt(monthKey.split('-')[1]);
            const gregY = parseInt(monthKey.split('-')[0]);
            const thaiMonthLabel = `${THAI_MONTHS_FULL[gregM - 1]} ${gregY + 543}`;
            const totalAmt = rows.reduce((s, r) => s + Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60), 0);
            const isRejected = st === 'checker_rejected';
            // หาเวลาส่งล่าสุดของกลุ่มนี้
            const latestForwardedAt = rows.reduce((m: string, r: any) => (r.rep_forwarded_at || '') > m ? (r.rep_forwarded_at || '') : m, '');
            // หา checker_note จากรายการที่ถูกตีกลับ (แสดงอันแรกที่มี)
            const rejectedNote = isRejected ? (rows.find((r: any) => r.checker_note)?.checker_note || '') : '';

            return (
              <SectionCard key={monthKey} className={isRejected ? 'border-red-300 bg-red-50' : ''}>
                <div className="flex items-center gap-4">
                  <div className={`size-12 rounded-xl grid place-items-center text-xl shrink-0 ${isRejected ? 'bg-red-100' : 'bg-green-100'}`}>
                    {info.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[15px] font-semibold">{thaiMonthLabel}</h3>
                      <StatusChip kind={info.kind}>{info.label}</StatusChip>
                    </div>
                    <p className="text-[13px] text-[var(--neutral-500)] mt-0.5">
                      {rows.length} คำร้อง · รวม {totalAmt.toLocaleString()} บาท
                      {latestForwardedAt && (
                        <span className="ml-2">· ส่งเมื่อ {fmtDateTime(latestForwardedAt)}</span>
                      )}
                    </p>
                    {isRejected && (
                      <p className="text-[12px] text-tu-red mt-1 font-medium">
                        ⚠️ ผู้ตรวจสอบตีกลับ — กรุณาแก้ไขไฟล์แล้วส่งใหม่
                        {rejectedNote && <span className="font-normal ml-1">({rejectedNote})</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isRejected && onGoExport && (
                      <Button
                        size="sm"
                        className="bg-tu-red text-white"
                        onClick={() => {
                          sessionStorage.setItem('notif_nav_month', monthKey);
                          onGoExport(monthKey);
                        }}
                      >
                        ส่งออกใหม่ →
                      </Button>
                    )}
                    <button
                      className="text-[12px] text-blue-500 hover:underline"
                      onClick={() => setExpanded(isExp ? null : monthKey)}
                    >
                      {isExp ? 'ซ่อน' : 'ดูรายละเอียด'}
                    </button>
                  </div>
                </div>

                {isExp && (
                  <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--neutral-300)]">
                    <table className="w-full text-[13px]">
                      <thead className="bg-[var(--neutral-100)]">
                        <tr>
                          {['พนักงาน','วันที่ OT','ประเภท','ชม.','รวมเงิน','สถานะ'].map(h => (
                            <th key={h} className="text-left px-3 py-2 font-medium text-[var(--neutral-700)]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => {
                          const rs = REP_STATUS_MAP[r.status] || { label: r.status, kind: 'neutral' as const };
                          return (
                            <tr key={r.id} className="border-t border-[var(--neutral-300)] hover:bg-[var(--neutral-50)]">
                              <td className="px-3 py-2 font-medium">{r.staff_name || '—'}</td>
                              <td className="px-3 py-2 font-mono">{fmtDate(r.work_date)}</td>
                              <td className="px-3 py-2">
                                <StatusChip kind={r.day_type === 'holiday' ? 'danger' : 'neutral'}>
                                  {r.day_type === 'holiday' ? 'วันหยุด' : 'วันธรรมดา'}
                                </StatusChip>
                              </td>
                              <td className="px-3 py-2 text-right font-mono">{Math.floor(parseFloat(r.ot_hours || '0'))}</td>
                              <td className="px-3 py-2 text-right font-mono font-semibold">
                                {(Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60)).toLocaleString()}
                              </td>
                              <td className="px-3 py-2"><StatusChip kind={rs.kind as any}>{rs.label}</StatusChip></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            );
          })}
        </div>
      )}
    </>
  );
}

const STATUS_LABELS: Record<string, { label: string; kind: string }> = {
  rep_forwarded:    { label: 'ส่งต่อแล้ว',    kind: 'info' },
  checker_approved: { label: 'ตรวจผ่าน',       kind: 'success' },
  checker_rejected: { label: 'ตีกลับ',         kind: 'danger' },
  completed:        { label: 'เสร็จสิ้น',      kind: 'success' },
};


// Legacy exports (compat)
export const RepExport = RepExportFlow;
export const RepPreview = RepExportFlow;
export const RepForward = RepExportFlow;

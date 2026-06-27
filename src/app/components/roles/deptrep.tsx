import { useState, useEffect } from 'react';
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
    g.reqs.sort((a, b) => a.work_date.localeCompare(b.work_date));
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
  const C = 16; // total columns A(0)-P(15)
  const pad = (n: number) => Array(n).fill('');

  // Row 1: Title (merged A1:P1)
  rows.push(['หลักฐานการเบิกจ่ายเงินค่าตอบแทนการปฏิบัติงานนอกเวลาราชการ', ...pad(C-1)]);
  // Row 2: Subtitle (merged A2:P2)
  rows.push([`  ${deptName}  ประจำเดือน ${month}`, ...pad(C-1)]);
  // Row 3: Header row 1
  rows.push(['ลำดับที่','ชื่อ-สกุล','วันปฏิบัติงานนอกเวลาราชการ','','','','','','','','รวมเวลา','','จำนวนเงิน','','','หมายเหตุ']);
  // Row 4: Header row 2
  rows.push(['','','','','','','','','','','ปฏิบัติงาน','','','ว.ด.ป.','ลายมือชื่อ','']);
  // Row 5: Header row 3
  rows.push(['','','','','','','','','','','วันปกติ','วันหยุด','','ที่รับเงิน','ผู้รับเงิน','']);
  // Row 6: Header row 4
  rows.push(['','','','','','','','','','','(ชั่วโมง)','(ชั่วโมง)','','','','']);

  // Row 7: ยอดยกมา (dates will be filled per employee in date row)
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
      // Date row
      const dateRow: any[] = [ci === 0 ? emp.seq : '', ci === 0 ? emp.name : ''];
      for (let i = 0; i < DATES_PER_ROW; i++) dateRow.push(chunk[i]?.date ?? '');
      if (isLast) {
        dateRow.push(emp.weekdayHrs || '', emp.weekendHrs || '', emp.amount.toLocaleString(), '', '', emp.amount.toLocaleString());
      } else {
        dateRow.push('', '', '', '', '', '');
      }
      rows.push(dateRow);

      // Time row
      const timeRow: any[] = ['', ''];
      for (let i = 0; i < DATES_PER_ROW; i++) timeRow.push(chunk[i]?.time ?? '');
      timeRow.push('', '', '', '', '', '');
      rows.push(timeRow);
    });
  });

  // Summary
  rows.push([]);
  const sumRow: any[] = ['', `  รวมเงินจ่ายทั้งสิ้น  (ตัวอักษร)  -${thaiAmountText(grandTotal)}-`];
  for (let i = 0; i < DATES_PER_ROW; i++) sumRow.push('');
  sumRow.push('รวมเป็นเงิน', '', grandTotal.toLocaleString(), '', '', '');
  rows.push(sumRow);

  // Signature block 1
  rows.push([]);
  rows.push(['ขอรับรองว่า  ผู้มีรายชื่อข้างต้นปฏิบัติงานนอกเวลาราชการจริง', ...pad(C-1)]);
  const sig1: any[] = ['ลงชื่อ', '', '', 'ผู้รับรองการปฏิบัติงาน', '', '', '', 'ลายมือชื่อ', '', 'ลงชื่อ', '', '', '', 'ผู้จ่ายเงิน', '', ''];
  rows.push(sig1);
  const name1 = signer || 'นางสาวสาริยา  นวมจิต';
  rows.push(['', `(${name1})`, '', '', '', '', '', '', '', '', '(นางสาวทองยุ่น  มธุรส)', '', '', '', '', '']);
  rows.push(['ตำแหน่ง', 'รักษาการในตำแหน่งเลขานุการสำนักงานทะเบียนนักศึกษา', '', '', '', '', '', '', '', '         ตำแหน่ง', 'นักวิชาการเงินและบัญชีชำนาญการ', '', '', '', '', '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths (match original form)
  ws['!cols'] = [
    {wch:8},   // A: ลำดับ
    {wch:40},  // B: ชื่อ-สกุล
    {wch:16},  // C: date1
    {wch:13},  // D: date2
    {wch:13},  // E: date3
    {wch:13},  // F: date4
    {wch:13},  // G: date5
    {wch:13},  // H: date6
    {wch:13},  // I: date7
    {wch:13},  // J: date8
    {wch:7},   // K: วันปกติ
    {wch:7},   // L: วันหยุด
    {wch:9},   // M: จำนวนเงิน
    {wch:8},   // N: วดป
    {wch:13},  // O: ลายมือชื่อ
    {wch:11},  // P: หมายเหตุ
  ];

  // Merges (match original form)
  ws['!merges'] = [
    {s:{r:0,c:0},e:{r:0,c:15}},   // Title A1:P1
    {s:{r:1,c:0},e:{r:1,c:15}},   // Subtitle A2:P2
    {s:{r:2,c:0},e:{r:5,c:0}},    // ลำดับที่ A3:A6
    {s:{r:2,c:1},e:{r:5,c:1}},    // ชื่อ-สกุล B3:B6
    {s:{r:2,c:2},e:{r:2,c:9}},    // วันปฏิบัติงาน C3:J3
    {s:{r:2,c:10},e:{r:2,c:11}},  // รวมเวลา K3:L3
    {s:{r:3,c:10},e:{r:3,c:11}},  // ปฏิบัติงาน K4:L4
    {s:{r:2,c:12},e:{r:5,c:12}},  // จำนวนเงิน M3:M6
    {s:{r:2,c:15},e:{r:5,c:15}},  // หมายเหตุ P3:P6
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'หลักฐานจ่าย');
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
              <th className={th} rowSpan={4} style={{width:36}}>ลำดับที่</th>
              <th className={th} rowSpan={4} style={{width:180}}>ชื่อ-สกุล</th>
              <th className={th} colSpan={8}>วันปฏิบัติงานนอกเวลาราชการ</th>
              <th className={th} colSpan={2}>รวมเวลา</th>
              <th className={th} rowSpan={4} style={{width:70}}>จำนวนเงิน</th>
              <th className={th} rowSpan={4} style={{width:50}}>ว.ด.ป.<br/>ที่รับเงิน</th>
              <th className={th} rowSpan={4} style={{width:80}}>ลายมือชื่อ<br/>ผู้รับเงิน</th>
              <th className={th} rowSpan={4} style={{width:60}}>หมายเหตุ</th>
            </tr>
            <tr><th className={th} colSpan={8}></th><th className={th} colSpan={2}>ปฏิบัติงาน</th></tr>
            <tr>
              {Array.from({length:8},(_,i)=><th key={i} className={th} style={{width:80}}></th>)}
              <th className={th} style={{width:50}}>วันปกติ</th>
              <th className={th} style={{width:50}}>วันหยุด</th>
            </tr>
            <tr>
              {Array.from({length:8},(_,i)=><th key={i} className={th}></th>)}
              <th className={th}>(ชั่วโมง)</th>
              <th className={th}>(ชั่วโมง)</th>
            </tr>
          </thead>
          <tbody>
            {/* ยอดยกมา */}
            <tr className="bg-gray-50">
              <td className={td} colSpan={10}></td>
              <td className={th} colSpan={2}>ยอดยกมา</td>
              <td className={tdC}></td>
              <td className={td}></td><td className={td}></td><td className={td}></td>
            </tr>
            {employees.map(emp => {
              const chunks: OTDay[][] = [];
              for (let i = 0; i < emp.days.length; i += DATES_PER_ROW) {
                chunks.push(emp.days.slice(i, i + DATES_PER_ROW));
              }
              if (chunks.length === 0) chunks.push([]);
              const totalRows = chunks.length * 2;

              return chunks.map((chunk, ci) => {
                const isFirst = ci === 0;
                const isLast = ci === chunks.length - 1;
                return (
                  <>
                    <tr key={`d-${emp.seq}-${ci}`}>
                      {isFirst && <td className={tdC} rowSpan={totalRows}>{emp.seq}</td>}
                      {isFirst && <td className={td} rowSpan={totalRows}>{emp.name}</td>}
                      {Array.from({length:8},(_,i)=>(
                        <td key={i} className={tdC} style={{color:chunk[i]?.isWeekend?'#B8001F':undefined}}>{chunk[i]?.date??''}</td>
                      ))}
                      {isFirst && <td className={tdC} rowSpan={totalRows}>{emp.weekdayHrs||''}</td>}
                      {isFirst && <td className={tdC} rowSpan={totalRows}>{emp.weekendHrs||''}</td>}
                      {isFirst && <td className={tdC+' font-semibold'} rowSpan={totalRows}>{emp.amount.toLocaleString()}</td>}
                      {isFirst && <td className={tdC} rowSpan={totalRows}></td>}
                      {isFirst && <td className={tdC} rowSpan={totalRows}></td>}
                      {isFirst && <td className={tdC} rowSpan={totalRows}>{emp.amount.toLocaleString()}</td>}
                    </tr>
                    <tr key={`t-${emp.seq}-${ci}`}>
                      {Array.from({length:8},(_,i)=>(
                        <td key={i} className={tdC} style={{color:chunk[i]?.isWeekend?'#B8001F':undefined}}>{chunk[i]?.time??''}</td>
                      ))}
                    </tr>
                  </>
                );
              });
            })}
            {/* รวมเงินจ่ายทั้งสิ้น */}
            <tr>
              <td className={td} colSpan={10}>&nbsp;&nbsp;รวมเงินจ่ายทั้งสิ้น (ตัวอักษร)&nbsp;&nbsp;-{thaiAmountText(total)}-</td>
              <td className={th} colSpan={2}>รวมเป็นเงิน</td>
              <td className={tdC+' font-semibold'}>{total.toLocaleString()}</td>
              <td className={td}></td><td className={td}></td><td className={td}></td>
            </tr>
          </tbody>
        </table>
        {/* Signature block */}
        <div className="mt-6 text-[11px]">
          <p>ขอรับรองว่า ผู้มีรายชื่อข้างต้นปฏิบัติงานนอกเวลาราชการจริง</p>
          <div className="grid grid-cols-2 gap-8 mt-4">
            <div className="text-center">
              <p>ลงชื่อ...................................ผู้รับรองการปฏิบัติงาน</p>
              <p className="mt-1">(นางสาวสาริยา  นวมจิต)</p>
              <p>รักษาการในตำแหน่งเลขานุการสำนักงานทะเบียนนักศึกษา</p>
            </div>
            <div className="text-center">
              <p>ลงชื่อ...................................ผู้จ่ายเงิน</p>
              <p className="mt-1">(นางสาวทองยุ่น  มธุรส)</p>
              <p>นักวิชาการเงินและบัญชีชำนาญการ</p>
            </div>
          </div>
        </div>
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
    Promise.all([
      fetch('/api/ot-requests/?status=head_approved', { headers: h }).then(r => r.json()),
      fetch('/api/ot-requests/?status=rep_forwarded', { headers: h }).then(r => r.json()),
    ]).then(([p, f]) => {
      setPending(Array.isArray(p) ? p : (p.results || []));
      setHistory(Array.isArray(f) ? f : (f.results || []));
    }).finally(() => setLoading(false));
  }, []);

  const totalAmt = pending.reduce((s, r) => s + Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60), 0);

  return (
    <>
      <PageHeader title="Dashboard ตัวแทนฝ่าย" />
      <div className="grid grid-cols-4 gap-5 mb-6">
        <div className="bg-white rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] border border-[var(--neutral-300)] flex flex-col justify-between">
          <p className="text-[12px] text-[var(--neutral-500)]">พร้อมส่งออก</p>
          <p className="text-[32px] font-bold text-tu-red tabular-nums">{loading ? '...' : pending.length}</p>
          <Button size="sm" onClick={onGo} className="bg-tu-red text-white">ไปส่งออก <ChevronRight className="size-4 ml-1" /></Button>
        </div>
        <KpiCard label="ส่งออกแล้วเดือนนี้" value={<span className="text-success">{loading ? '...' : history.length}</span>} accent="green" />
        <KpiCard label="รวมยอดรอส่งออก" value={`${totalAmt.toLocaleString()} ฿`} accent="blue" />
        <KpiCard label="สถานะ" value={pending.length > 0 ? <StatusChip kind="warning">รอดำเนินการ</StatusChip> : <StatusChip kind="success">ทันสมัย</StatusChip>} accent="green" />
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
          <Button onClick={onGo} className="bg-tu-red hover:bg-tu-red-dark text-white h-12 px-6">
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
                  <p className="text-[12px] text-[var(--neutral-500)]">{fmtDate(r.work_date)}</p>
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
  const [loading, setLoading] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [done, setDone] = useState(false);
  const [note, setNote] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [checkers, setCheckers] = useState<{ id: number; full_name: string; notify_email: string; email: string }[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [signerName, setSignerName] = useState('');

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setDeptName(JSON.parse(u).department_name || '');
    // โหลด checker list ล่วงหน้า (แสดงในหน้า forward)
    fetch('/api/users/?role=checker', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => setCheckers(Array.isArray(d) ? d : (d.results || [])));
  }, []);

  function loadRequests() {
    setDownloaded(false);
    setLoading(true);
    fetch('/api/ot-requests/?status=head_approved', {
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

  useEffect(() => { loadRequests(); }, []);

  const selRequests = requests.filter(r => selIds.includes(r.id));
  const employees = requestsToEmployees(selRequests);
  const totalAmt = selRequests.reduce((s, r) => s + Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60), 0);

  // คำนวณเดือนจากข้อมูลคำร้อง
  const firstDate = selRequests[0]?.work_date || '';
  const monthLabel = firstDate ? thaiMonthFull(`${parseInt(firstDate.split('-')[0]) + 543}-${firstDate.split('-')[1]}`) : '';

  async function forwardAll() {
    setForwarding(true);
    await fetch('/api/ot-requests/bulk-forward/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selIds, note }),
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
        <div className="flex items-center gap-4 mb-5">
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={loadRequests} disabled={loading}>
              <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> รีเฟรช
            </Button>
          </div>
        </div>

        {loading ? (
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
                      <td className="px-3 py-2 text-[var(--neutral-500)]">{fmtDate(r.work_date)}</td>
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
            onClick={() => { generateXlsx(employees, monthLabel, deptName, signerName); setDownloaded(true); }}
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
          <div className="bg-tu-yellow-soft border border-tu-yellow rounded-lg p-4 mb-5 flex items-center justify-between">
            <div>
              <p className="font-semibold">📎 OT-Report-{monthLabel}.xlsx</p>
              <p className="text-[13px] text-[var(--neutral-500)] mt-1">
                {employees.length} พนักงาน • {selIds.length} คำร้อง • รวม {totalAmt.toLocaleString()} บาท
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-tu-red text-tu-red shrink-0"
              onClick={() => generateXlsx(employees, monthLabel, deptName, signerName)}
            >
              <Download className="size-3.5 mr-1" />ดาวน์โหลดอีกครั้ง
            </Button>
          </div>
          {checkers.length > 0 && (
            <div className="mb-4 rounded-lg border border-[var(--neutral-300)] bg-[var(--neutral-50)] px-4 py-3">
              <p className="text-[12px] text-[var(--neutral-500)] mb-1.5">📧 จะส่งอีเมลแจ้งผู้ตรวจสอบ {checkers.length} คน</p>
              <div className="flex flex-wrap gap-2">
                {checkers.map(c => {
                  const mail = c.notify_email || '';
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
          {/* อัปโหลดเอกสารเพิ่มเติม (กรณีตัวแทนฝ่ายปรับฟอร์แมตเอง) */}
          <div className="mb-5">
            <label className="font-medium block mb-1">อัปโหลดเอกสารเพิ่มเติม (ถ้ามี)</label>
            <p className="text-[12px] text-[var(--neutral-500)] mb-2">หากต้องการปรับฟอร์แมตเอกสารเอง สามารถอัปโหลดไฟล์ที่แก้ไขแล้วได้ที่นี่</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-[var(--neutral-400)] cursor-pointer hover:bg-[var(--neutral-50)] transition-colors">
                <Upload className="size-4 text-[var(--neutral-500)]" />
                <span className="text-[13px] text-[var(--neutral-600)]">{uploadedFile ? uploadedFile.name : 'เลือกไฟล์ (.xlsx, .pdf)'}</span>
                <input type="file" accept=".xlsx,.pdf,.xls" className="hidden"
                  onChange={e => setUploadedFile(e.target.files?.[0] || null)} />
              </label>
              {uploadedFile && (
                <Button variant="outline" size="sm" onClick={() => setUploadedFile(null)} className="text-danger border-danger text-[12px]">
                  ลบไฟล์
                </Button>
              )}
            </div>
          </div>

          {/* ชื่อผู้ลงนามในเอกสาร */}
          <div className="mb-5">
            <label className="font-medium block mb-1">ชื่อผู้ลงนามในเอกสาร (ถ้าต้องการเปลี่ยน)</label>
            <input
              type="text"
              className="w-full rounded-lg border border-[var(--neutral-300)] px-3 py-2 text-[13px]"
              placeholder="ระบุชื่อผู้ลงนาม หากต้องการเปลี่ยนจากค่าเริ่มต้น"
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
            />
          </div>

          <div className="mb-5">
            <label className="font-medium block mb-1">หมายเหตุถึงผู้ตรวจสอบ (optional)</label>
            <Textarea
              className="mt-1"
              rows={4}
              placeholder="โปรดตรวจสอบและอนุมัติเพื่อดำเนินการเบิกจ่ายต่อไป"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
          <Button
            className="w-full h-12 bg-tu-red hover:bg-tu-red-dark text-white"
            disabled={forwarding}
            onClick={forwardAll}
          >
            {forwarding ? (
              <><RefreshCw className="size-4 mr-2 animate-spin" />กำลังส่งต่อ...</>
            ) : (
              <><Send className="size-4 mr-2" />ส่งต่อ {selIds.length} คำร้องให้ผู้ตรวจสอบ</>
            )}
          </Button>
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
                {checkers.map(c => c.notify_email || c.full_name).filter(Boolean).join(', ')}
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
  const [requests, setRequests] = useState<any[]>([]);
  const [deptName, setDeptName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = { Authorization: `Bearer ${token()}` };
    fetch('/api/auth/me/', { headers: h })
      .then(r => r.json())
      .then(me => {
        setDeptName(me.department_name || '');
        if (me.department) {
          return Promise.all([
            fetch(`/api/users/?department=${me.department}`, { headers: h }).then(r => r.json()),
            fetch('/api/ot-requests/', { headers: h }).then(r => r.json()),
          ]).then(([u, ot]) => {
            setMembers(Array.isArray(u) ? u : (u.results || []));
            setRequests(Array.isArray(ot) ? ot : (ot.results || []));
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <><PageHeader title="สมาชิกในแผนก" /><p className="text-center py-10">กำลังโหลด...</p></>;

  const otMap: Record<number, { hrs: number; amt: number }> = {};
  requests.forEach(r => {
    if (!otMap[r.staff]) otMap[r.staff] = { hrs: 0, amt: 0 };
    otMap[r.staff].hrs += parseFloat(r.ot_hours || 0);
    otMap[r.staff].amt += Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60);
  });

  return (
    <>
      <PageHeader title={`สมาชิกในแผนก — ${deptName}`} />
      <div className="grid grid-cols-4 gap-5 mb-6">
        <KpiCard label="จำนวนสมาชิก" value={members.length.toString()} accent="red" />
        <KpiCard label="ทำ OT เดือนนี้" value={Object.values(otMap).filter(v => v.hrs > 0).length.toString()} accent="yellow" />
        <KpiCard label="รวมชั่วโมง OT" value={Math.floor(Object.values(otMap).reduce((s,v)=>s+v.hrs,0)).toString()} accent="blue" />
        <KpiCard label="รวมยอด OT" value={Object.values(otMap).reduce((s,v)=>s+v.amt,0).toLocaleString()} accent="green" />
      </div>
      <div className="grid grid-cols-4 gap-5">
        {members.map(m => {
          const ot = otMap[m.id] || { hrs: 0, amt: 0 };
          return (
            <div key={m.id} className="bg-white border border-[var(--neutral-300)] rounded-xl p-5 text-center shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              <div className={`size-14 rounded-full grid place-items-center mx-auto mb-2 text-xl font-bold ${m.role === 'depthead' ? 'bg-orange-500 text-white' : 'bg-tu-yellow text-black'}`}>
                {(m.full_name || m.username || '?').charAt(0)}
              </div>
              <h4 className="text-[13px] font-semibold leading-tight">{m.full_name || m.username}</h4>
              <p className="text-[11px] text-[var(--neutral-500)] mt-0.5 mb-2">{m.role === 'depthead' ? 'หัวหน้างาน' : 'พนักงาน'}</p>
              {ot.hrs > 0 ? (
                <>
                  <p className="text-tu-red font-semibold text-[13px]">{Math.floor(ot.hrs)} ชม.</p>
                  <p className="text-[11px] text-[var(--neutral-500)]">{ot.amt.toLocaleString()} บาท</p>
                </>
              ) : (
                <p className="text-[11px] text-[var(--neutral-400)]">ไม่มี OT เดือนนี้</p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function RepHistory() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch('/api/ot-requests/', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => setRequests(Array.isArray(d) ? d : (d.results || [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <><PageHeader title="ประวัติคำร้อง" /><p className="text-center py-10">กำลังโหลด...</p></>;

  return (
    <>
      <PageHeader title="ประวัติคำร้อง OT" subtitle={`${requests.length} รายการ`} />
      <SectionCard>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-tu-red text-white">
              <th className="px-3 py-2 text-left">วันที่ยื่น</th>
              <th className="px-3 py-2 text-left">วันที่ OT</th>
              <th className="px-3 py-2 text-left">ประเภท</th>
              <th className="px-3 py-2 text-right">ชม.</th>
              <th className="px-3 py-2 text-right">รวมเงิน</th>
              <th className="px-3 py-2 text-left">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.id} className="border-b border-[var(--neutral-100)] hover:bg-[var(--neutral-50)]">
                <td className="px-3 py-2 text-[var(--neutral-500)]">{r.created_at ? fmtDateTime(r.created_at) : '-'}</td>
                <td className="px-3 py-2">{fmtDate(r.work_date)}</td>
                <td className="px-3 py-2"><StatusChip kind={r.day_type === 'holiday' ? 'danger' : 'neutral'}>{r.day_type === 'holiday' ? 'วันหยุด' : 'วันธรรมดา'}</StatusChip></td>
                <td className="px-3 py-2 font-mono text-right">{Math.floor(parseFloat(r.ot_hours || '0'))}</td>
                <td className="px-3 py-2 font-mono font-semibold text-right">{(Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60)).toLocaleString()}</td>
                <td className="px-3 py-2"><StatusChip kind={r.status === 'completed' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}>{r.status}</StatusChip></td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </>
  );
}
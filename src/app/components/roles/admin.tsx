import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Upload, Users, Building2, Settings, History, ListChecks,
  Plus, AlertTriangle, CheckCircle2, Search, Pencil, Trash2,
  CloudUpload, UserPlus, CalendarDays, Download, X, Lock, Info, Clock, RefreshCw,
} from 'lucide-react';
import { NavItem } from '../AppShell';
import { KpiCard, PageHeader, SectionCard, StatusChip, fmtDate, fmtDateTime } from '../shared';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Switch } from '../ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Progress } from '../ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../ui/dialog';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
} from 'recharts';

export const ADMIN_NAV: NavItem[] = [
  { key: 'dashboard',   label: 'Dashboard',         icon: <LayoutDashboard /> },
  { key: 'import',      label: 'นำเข้าข้อมูลเวลา',   icon: <Upload /> },
  { key: 'users',       label: 'จัดการผู้ใช้',         icon: <Users /> },
  { key: 'depts',       label: 'จัดการแผนก',          icon: <Building2 /> },
  { key: 'holidays',    label: 'จัดการวันหยุด',        icon: <CalendarDays /> },
  { key: 'deadlines',   label: 'กำหนดวันปิดรับโอที',    icon: <Clock /> },
  { key: 'settings',    label: 'ตั้งค่าระบบ',           icon: <Settings /> },
  { key: 'history',     label: 'ประวัติการนำเข้า',     icon: <History /> },
  { key: 'audit',       label: 'Audit Log',           icon: <ListChecks /> },
];


const PIE_COLORS = ['#B8001F','#FFD400','#1976D2','#0A8A44','#7B1FA2','#EF6C00','#00838F','#558B2F'];

export function AdminDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<AuditEntry[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const h = { 'Authorization': `Bearer ${token}` };
    fetch('/api/admin/summary/', { headers: h })
      .then(r => r.json()).then(setSummary).catch(() => {});
    fetch('/api/audit-log/?limit=8', { headers: h })
      .then(r => r.json())
      .then((d: any) => setRecentLogs(Array.isArray(d) ? d.slice(0,8) : (d?.results ?? []).slice(0,8)))
      .catch(() => {});
  }, []);

  const li = summary?.latest_import;
  // แสดงเดือน Thai จาก imported_months[0] แทนชื่อไฟล์
  const importLabel = summary?.imported_months?.[0]
    ? thaiMonthLabel(summary.imported_months?.[0] ?? '')
    : (li ? 'นำเข้าแล้ว' : '—');
  const importHint = li ? `${li.total?.toLocaleString()} รายการ` : 'ยังไม่มีการนำเข้า';

  const deptDist: { id: number; name: string; count: number }[] = summary?.dept_distribution ?? [];
  const pieData = deptDist.map((d, i) => ({ name: d.name, value: d.count, color: PIE_COLORS[i % PIE_COLORS.length] }));

  return (
    <>
      <PageHeader title="Dashboard ผู้ดูแลระบบ" right={<span className="text-[var(--neutral-500)]">วันที่ {new Date().toLocaleDateString('th-TH', {day:'numeric',month:'long',year:'numeric'})}</span>} />
      <div className="grid grid-cols-4 gap-5 mb-6">
        <KpiCard label="ผู้ใช้ทั้งหมด" value={summary ? (summary.total_users ?? 0).toString() : '—'} icon={<Users className="size-6" />} accent="red" />
        <KpiCard label="นำเข้าข้อมูลล่าสุด" value={importLabel} icon={<Upload className="size-6" />} accent="yellow" hint={importHint} />
        <KpiCard label="คำร้องในระบบเดือนนี้" value={summary ? (summary.ot_requests ?? 0).toString() : '—'} icon={<ListChecks className="size-6" />} accent="blue" />
        <KpiCard label="สถานะระบบ" value={<span className="flex items-center gap-2 text-[20px]"><span className="size-3 rounded-full bg-success animate-pulse" />ปกติ</span>} icon={<CheckCircle2 className="size-6" />} accent="green" />
      </div>

      <div className="grid grid-cols-2 gap-5 mb-6">
        <SectionCard title="Activity Log ล่าสุด">
          <div className="space-y-3">
            {recentLogs.length === 0 ? (
              <p className="text-[13px] text-[var(--neutral-500)] py-4 text-center">ยังไม่มี activity</p>
            ) : recentLogs.map(a => {
              const kind = auditKind(a.action);
              return (
                <div key={a.id} className="flex items-center gap-3 py-2 border-b border-[var(--neutral-300)] last:border-0">
                  <div className={`size-9 rounded-full grid place-items-center shrink-0 ${kind === 'success' ? 'bg-green-100 text-success' : kind === 'danger' ? 'bg-tu-red-soft text-danger' : 'bg-blue-100 text-info'}`}>
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] truncate"><strong>{a.user_name}</strong> — <span className="capitalize">{a.action}</span> [{a.model_name}]</p>
                    <p className="text-[11px] text-[var(--neutral-500)]">{fmtRelative(a.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="การกระจายผู้ใช้ตามแผนก">
          <div className="h-[320px]">
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[13px] text-[var(--neutral-500)]">ยังไม่มีข้อมูล</div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`${v} คน`]} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Admin Import
// ─────────────────────────────────────────────

type ImportRow = {
  id: number; date: string; empId: string; name: string; dept: string;
  in: string; out: string; ot: string; flag: boolean;
  attendanceStatus?: string;
  timePeriod?: string;
  dayType?: string;
  holidayName?: string;
  holidayType?: string;
};

const PAGE_SIZE = 10;

const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const DAY_ABBR = ['อา','จ','อ','พ','พฤ','ศ','ส']; // อาทิตย์=0 … เสาร์=6
const CURRENT_THAI_YEAR = new Date().getFullYear() + 543;

function MonthYearPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parts = value.split('-');
  const year = parts[0] || String(CURRENT_THAI_YEAR);
  const mon  = parts[1] || String(new Date().getMonth() + 1).padStart(2, '0');
  return (
    <div className="flex gap-2">
      <Select value={mon} onValueChange={m => onChange(`${year}-${m}`)}>
        <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {THAI_MONTHS.map((label, i) => (
            <SelectItem key={i} value={String(i + 1).padStart(2, '0')}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        value={year}
        onChange={e => { if (e.target.value.length <= 4) onChange(`${e.target.value}-${mon}`); }}
        className="w-[80px] font-mono text-center"
        min={2500}
        max={2600}
      />
    </div>
  );
}

function gregToThai(dateStr: string): string {
  if (!dateStr) return '';
  // "2026-03-01" -> "2569-03"
  const [y, m] = dateStr.split('-');
  return `${parseInt(y) + 543}-${m}`;
}
function thaiMonthLabel(monthStr: string): string {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-');
  return `${THAI_MONTHS[parseInt(m)-1]} ${y}`;
}

export function AdminImport() {
  const [month, setMonth] = useState(`${CURRENT_THAI_YEAR}-${String(new Date().getMonth()+1).padStart(2,'0')}`);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploaded = rows.length > 0;
  const token = () => localStorage.getItem('access_token');

  // Load available months
  useEffect(() => {
    const h = { 'Authorization': `Bearer ${token()}` };
    fetch('/api/admin/summary/', { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.imported_months?.length) { setAvailableMonths(d.imported_months); setMonth(d.imported_months[0]); } })
      .catch(() => {});
  }, []);

  // Load rows from DB whenever month changes
  const loadRows = useCallback(async (m: string) => {
    setLoading(true);
    setRows([]);
    try {
      const res = await fetch(`/api/timelog/list/?month=${m}`, { headers: { 'Authorization': `Bearer ${token()}` } });
      if (res.ok) { const d = await res.json(); setRows(Array.isArray(d.rows) ? d.rows : []); }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadRows(month); }, [month, loadRows]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/timelog/import/', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
      const importedRows = Array.isArray(data.rows) ? data.rows : [];
      // Detect month from first row's date
      if (importedRows.length > 0 && importedRows[0].date) {
        const detectedMonth = gregToThai(importedRows[0].date);
        if (!availableMonths.includes(detectedMonth)) setAvailableMonths(prev => [detectedMonth, ...prev]);
        setMonth(detectedMonth);
      }
      setRows(importedRows);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }


  return (
    <>
      <PageHeader title="นำเข้าข้อมูลเวลาเข้า-ออกงาน" right={
        <div className="flex items-center gap-2">
          <MonthYearPicker value={month} onChange={v => { setMonth(v); }} />
          <Button
            variant="outline"
            className="border-tu-red text-tu-red"
            onClick={() => loadRows(month)}
            disabled={loading}
            title="ซิงค์วันหยุดใหม่ — กดหลังจากเพิ่ม/ลบวันหยุดในหน้าจัดการวันหยุด"
          >
            <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            ซิงค์วันหยุด
          </Button>
        </div>
      } />

      {error && (
        <div className="flex items-center gap-3 p-4 mb-5 bg-tu-red-soft border border-danger rounded-xl">
          <AlertTriangle className="size-5 text-danger shrink-0" />
          <p className="text-[13px]">{error}</p>
        </div>
      )}

      {loading ? (
        <SectionCard><div className="flex items-center justify-center h-40 gap-3 text-[var(--neutral-500)]"><div className="size-8 border-4 border-tu-red border-t-transparent rounded-full animate-spin"/><span>กำลังโหลดข้อมูล...</span></div></SectionCard>
      ) : uploaded ? (
        <>
          <div className="flex items-center gap-3 p-4 mb-5 bg-tu-yellow-soft border border-tu-yellow rounded-xl">
            <AlertTriangle className="size-5 text-[var(--warning)] shrink-0" />
            <p className="text-[13px]">
              <strong>นำเข้าข้อมูลแล้ว</strong> — {thaiMonthLabel(month)} พบ {rows.length.toLocaleString()} รายการ
              หากต้องการแก้ไขข้อมูลรายคน ให้แก้ไขในตารางด้านล่างแล้วกดบันทึก
            </p>
          </div>
          <AdminEditableTable rows={rows} setRows={setRows} month={month} />
        </>
      ) : (
        /* ยังไม่เคยนำเข้า → upload zone ปกติ */
        <SectionCard>
          <div
            className="border-2 border-dashed border-tu-red rounded-xl h-[280px] flex flex-col items-center justify-center gap-3 bg-tu-red-soft/30 cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <>
                <div className="size-12 border-4 border-tu-red border-t-transparent rounded-full animate-spin" />
                <p className="text-[var(--neutral-700)]">กำลังอ่านไฟล์...</p>
              </>
            ) : (
              <>
                <CloudUpload className="size-16 text-tu-red" />
                <p className="text-[var(--neutral-700)]">ลากไฟล์ .xlsx หรือ .csv มาวางที่นี่ หรือ</p>
                <Button
                  className="bg-tu-red hover:bg-tu-red-dark text-white"
                  onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                  disabled={uploading}
                >เลือกไฟล์</Button>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={handleFile}
          />
          <p className="text-[12px] text-[var(--neutral-500)] mt-3 text-center">
            รองรับไฟล์จากเครื่องสแกนนิ้ว/ใบหน้า — ขนาดสูงสุด 50MB
          </p>
          <div className="mt-6 bg-tu-yellow-soft border border-tu-yellow rounded-lg p-4 flex gap-3">
            <AlertTriangle className="size-5 text-[var(--warning)] shrink-0 mt-0.5" />
            <p className="text-[13px] text-[var(--neutral-700)]">
              เมื่อนำเข้าไฟล์แล้ว <strong>ระบบจะไม่อนุญาตให้นำเข้าซ้ำ</strong> — หากต้องการแก้ไขข้อมูล ให้แก้ไขในตารางแทน
            </p>
          </div>
        </SectionCard>
      )}
    </>
  );
}


function getAttendanceStatus(r: ImportRow): { label: string; kind: 'success' | 'warning' | 'danger' | 'neutral'; color?: string } {
  if (r.dayType === 'holiday') {
    const name = r.holidayName || '';
    const htype = r.holidayType || '';
    if (htype === 'weekend') {
      return { label: name || 'เสาร์-อาทิตย์', kind: 'neutral', color: 'bg-[var(--neutral-100)] text-[var(--neutral-600)] border border-[var(--neutral-300)]' };
    }
    if (htype === 'compensation') {
      return { label: name || 'วันหยุดชดเชย', kind: 'neutral', color: 'bg-orange-100 text-orange-700 border border-orange-300' };
    }
    if (htype === 'special') {
      return { label: name || 'วันหยุดพิเศษ', kind: 'neutral', color: 'bg-purple-100 text-purple-700 border border-purple-300' };
    }
    // official / is_system
    return { label: name || 'วันหยุดราชการ', kind: 'neutral', color: 'bg-blue-50 text-blue-700 border border-blue-200' };
  }
  const raw = r.attendanceStatus?.trim();
  if (raw) return { label: raw, kind: 'neutral' };
  if (r.in?.trim()) return { label: 'ปกติ', kind: 'success' };
  return { label: '', kind: 'neutral' };
}

function AdminEditableTable({ rows, setRows, month }: { rows: ImportRow[]; setRows: React.Dispatch<React.SetStateAction<ImportRow[]>>; month: string }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<ImportRow>>({});
  const [savedId, setSavedId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [saveConfirmId, setSaveConfirmId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  function startEdit(r: ImportRow) {
    setEditingId(r.id);
    setDraft({ in: r.in, out: r.out, ot: r.ot });
  }

  function saveRow(id: number) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...draft, flag: false } : r));
    setEditingId(null);
    setSaveConfirmId(null);
    setSavedId(id);
    setTimeout(() => setSavedId(null), 2000);
  }

  function deleteRow(id: number) {
    setRows(rs => rs.filter(r => r.id !== id));
    if (editingId === id) setEditingId(null);
    setDeleteConfirmId(null);
  }

  const filtered = rows.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.empId.toLowerCase().includes(q);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
    <SectionCard title={`ข้อมูลเวลาเข้า-ออก ${thaiMonthLabel(month)}`}>
      <div className="grid grid-cols-4 gap-4 mb-5">
        <KpiCard label="รายการทั้งหมด" value={rows.length.toLocaleString()} accent="red" />
        <KpiCard label="พนักงาน" value={`${new Set(rows.map(r => r.empId)).size} คน`} accent="blue" />
        <KpiCard label="วันที่ครอบคลุม" value={thaiMonthLabel(month)} accent="yellow" />
        <KpiCard label="พบความผิดปกติ" value={rows.filter(r => r.flag).length.toString()} accent="orange" />
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-[400px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neutral-500)]" />
          <Input
            className="pl-10"
            placeholder="ค้นหาชื่อพนักงาน หรือ รหัสพนักงาน (EMP-XXXX)"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        {search && (
          <Button variant="outline" className="h-9 text-[13px]" onClick={() => { setSearch(''); setPage(1); }}>
            ล้างการค้นหา
          </Button>
        )}
        <span className="text-[13px] text-[var(--neutral-500)] ml-auto">
          พบ <strong>{filtered.length}</strong> รายการ
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--neutral-300)]">
        <table className="w-full text-[13px]">
          <thead className="bg-tu-red text-white">
            <tr>
              {['วันที่','วัน','รหัส','ชื่อ','แผนก','เข้า','ออก','กะ','ชม. OT','สถานะเข้างาน','สถานะข้อมูล','Actions'].map(h => (
                <th key={h} className="text-left px-3 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => {
              const isEditing = editingId === r.id;
              const justSaved = savedId === r.id;
              const [ry,rm,rd] = r.date.split('-').map(Number);
              const dayAbbr = DAY_ABBR[new Date(ry, rm-1, rd).getDay()];
              const isWeekend = dayAbbr === 'ส' || dayAbbr === 'อา';
              return (
                <tr key={r.id} className={
                  justSaved ? 'bg-green-50' :
                  isEditing ? 'bg-tu-yellow-soft' :
                  r.flag ? 'bg-tu-red-soft' :
                  isWeekend ? 'bg-gray-200' :
                  i % 2 === 0 ? 'bg-[var(--neutral-50)]' : 'bg-white'
                }>
                  <td className="px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2 text-center">{dayAbbr}</td>
                  <td className="px-3 py-2 font-mono">{r.empId}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">{r.dept}</td>

                  {/* Editable fields */}
                  <td className="px-3 py-2">
                    {isEditing
                      ? <Input value={draft.in} onChange={e => setDraft(d => ({ ...d, in: e.target.value }))} className="w-24 h-7 font-mono text-[12px]" />
                      : <span className="font-mono">{r.in}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing
                      ? <Input value={draft.out} onChange={e => setDraft(d => ({ ...d, out: e.target.value }))} className="w-24 h-7 font-mono text-[12px]" />
                      : <span className="font-mono">{r.out}</span>}
                  </td>
                  <td className="px-3 py-2 text-center">{r.timePeriod || ''}</td>
                  <td className="px-3 py-2">
                    {isEditing
                      ? <Input value={draft.ot} onChange={e => setDraft(d => ({ ...d, ot: e.target.value }))} className="w-20 h-7 font-mono text-[12px]" />
                      : <span className="font-mono">{r.ot}</span>}
                  </td>

                  <td className="px-3 py-2">
                    {(() => {
                      const s = getAttendanceStatus(r);
                      if (s.color) return (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.color}`}>{s.label}</span>
                      );
                      return s.label ? <StatusChip kind={s.kind}>{s.label}</StatusChip> : null;
                    })()}
                  </td>
                  <td className="px-3 py-2">
                    {justSaved
                      ? <StatusChip kind="success">บันทึกแล้ว</StatusChip>
                      : r.flag
                        ? <span className="text-danger flex items-center gap-1"><AlertTriangle className="size-3" />ตรวจสอบ</span>
                        : <StatusChip kind="success">ผ่าน</StatusChip>}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <div className="flex gap-1">
                        <Button size="sm" className="h-7 bg-success text-white px-2" onClick={() => setSaveConfirmId(r.id)}>
                          บันทึก
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditingId(null)}>
                          ยกเลิก
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 px-2 border-tu-red text-tu-red" onClick={() => startEdit(r)}>
                          <Pencil className="size-3 mr-1" />แก้ไข
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 border-danger text-danger" onClick={() => setDeleteConfirmId(r.id)}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 text-[13px] text-[var(--neutral-500)]">
        <span>
          แสดง <strong>{filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}</strong>–<strong>{Math.min(safePage * PAGE_SIZE, filtered.length)}</strong> จาก <strong>{filtered.length}</strong> รายการ
        </span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" disabled={safePage === 1} onClick={() => setPage(p => p - 1)}>←</Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
            .reduce<(number | '...')[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === '...'
                ? <span key={`ellipsis-${i}`} className="px-2 py-1 text-[var(--neutral-500)]">…</span>
                : <Button key={p} size="sm" variant={p === safePage ? 'default' : 'outline'} className={p === safePage ? 'bg-tu-red text-white' : ''} onClick={() => setPage(p as number)}>{p}</Button>
            )}
          <Button size="sm" variant="outline" disabled={safePage === totalPages} onClick={() => setPage(p => p + 1)}>→</Button>
        </div>
      </div>
    </SectionCard>

    {/* Delete confirmation dialog */}
    <Dialog open={deleteConfirmId !== null} onOpenChange={open => { if (!open) setDeleteConfirmId(null); }}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader><DialogTitle>ยืนยันการลบรายการ</DialogTitle></DialogHeader>
        <p className="text-[13px]">ต้องการลบรายการนี้ออกจากระบบใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>ยกเลิก</Button>
          <Button className="bg-danger text-white" onClick={() => deleteConfirmId !== null && deleteRow(deleteConfirmId)}>
            <Trash2 className="size-4 mr-1" />ลบรายการ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Save confirmation dialog */}
    <Dialog open={saveConfirmId !== null} onOpenChange={open => { if (!open) setSaveConfirmId(null); }}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader><DialogTitle>ยืนยันการบันทึกการแก้ไข</DialogTitle></DialogHeader>
        <p className="text-[13px]">ต้องการบันทึกการแก้ไขข้อมูลรายการนี้ใช่หรือไม่?</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSaveConfirmId(null)}>ยกเลิก</Button>
          <Button className="bg-success text-white" onClick={() => saveConfirmId !== null && saveRow(saveConfirmId)}>
            <CheckCircle2 className="size-4 mr-1" />บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}


const ROLE_OPTIONS = [
  { role: 'staff',     label: 'พนักงาน',      desc: 'พนักงานทั่วไป',       color: 'bg-blue-600 text-white'    },
  { role: 'depthead',  label: 'หัวหน้างาน',   desc: 'หัวหน้าแผนก/งาน',    color: 'bg-orange-500 text-white'  },
  { role: 'deptrep',   label: 'ตัวแทนฝ่าย',   desc: 'ตัวแทนฝ่าย (1/แผนก)', color: 'bg-tu-yellow text-black'   },
  { role: 'checker',   label: 'ผู้ตรวจสอบ',   desc: 'ผู้ตรวจสอบกลาง',      color: 'bg-purple-600 text-white'  },
  { role: 'executive', label: 'ผู้บริหาร',    desc: 'ผู้บริหาร',            color: 'bg-success text-white'     },
  { role: 'admin',     label: 'Admin',         desc: 'ผู้ดูแลระบบทั้งหมด',  color: 'bg-tu-red text-white'      },
];


type ApiUser = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  extra_roles: string[];
  available_roles: string[];
  department: number | null;
  department_name: string | null;
  is_active: boolean;
  employee_id: string | null;
};

const ROLE_COLOR_MAP: Record<string, string> = {
  admin:     'bg-tu-red text-white',
  staff:     'bg-blue-600 text-white',
  depthead:  'bg-orange-500 text-white',
  deptrep:   'bg-tu-yellow text-black',
  checker:   'bg-purple-600 text-white',
  executive: 'bg-success text-white',
};
const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin', staff: 'พนักงาน', depthead: 'หัวหน้างาน',
  deptrep: 'ตัวแทนฝ่าย', checker: 'ผู้ตรวจสอบ', executive: 'ผู้บริหาร',
};

function EditRoleApiDialog({ user, onSaved, onClose }: {
  user: ApiUser;
  onSaved: (updated: ApiUser) => void;
  onClose: () => void;
}) {
  const [primaryRole, setPrimaryRole] = useState(user.role);
  const [extraRoles, setExtraRoles] = useState<string[]>(user.extra_roles || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const token = () => localStorage.getItem('access_token');

  // สิทธิ์ที่จะมีทั้งหมด = staff + role หลัก + extra_roles
  const allRoles = Array.from(new Set(['staff', primaryRole, ...extraRoles]));

  function toggleExtra(role: string) {
    if (role === 'staff') return; // staff ลบไม่ได้
    setExtraRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  }

  async function handleSave() {
    setSaving(true); setError('');
    const res = await fetch(`/api/users/${user.id}/`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: primaryRole, extra_roles: extraRoles }),
    });
    if (res.ok) {
      const updated = await res.json();
      onSaved(updated);
      onClose();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.detail || d.error || 'บันทึกไม่สำเร็จ');
    }
    setSaving(false);
  }

  const NON_STAFF_ROLES = ROLE_OPTIONS.filter(r => r.role !== 'staff');

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[580px] p-0 overflow-hidden">
        <div className="bg-tu-red text-white px-6 h-[60px] flex items-center">
          <DialogTitle className="text-white">แก้ไขสิทธิ์ — {user.first_name} {user.last_name}</DialogTitle>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          <p className="text-[12px] text-[var(--neutral-500)]">username: <span className="font-mono">{user.username}</span></p>

          {/* Section 1: Role หลัก */}
          <div>
            <p className="text-[13px] font-medium mb-2">Role หลัก <span className="text-[11px] text-[var(--neutral-500)] font-normal">(เลือกได้ 1 อย่าง — กำหนดหน้าที่หลักของผู้ใช้)</span></p>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map(r => {
                const rk = r.role;
                const active = primaryRole === rk;
                return (
                  <label key={rk}
                    className={`border rounded-lg p-3 flex items-start gap-2 cursor-pointer transition-colors ${active ? 'border-tu-red bg-tu-red-soft' : 'border-[var(--neutral-300)] hover:border-tu-red'}`}
                  >
                    <input type="radio" name="primary-role" className="mt-0.5 accent-[var(--tu-red)]"
                      checked={active}
                      onChange={() => {
                        setPrimaryRole(rk);
                        // ถ้า role หลักเปลี่ยน ลบออกจาก extra ด้วย (ไม่จำเป็นต้องซ้ำ)
                        setExtraRoles(prev => prev.filter(x => x !== rk));
                      }} />
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold mb-1 ${r.color}`}>{r.label}</span>
                      <p className="text-[11px] text-[var(--neutral-500)]">{r.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 2: Extra roles */}
          <div>
            <p className="text-[13px] font-medium mb-1">สิทธิ์เพิ่มเติม <span className="text-[11px] text-[var(--neutral-500)] font-normal">(เลือกได้หลายอย่าง — ผู้ใช้จะสลับ view ได้)</span></p>
            <p className="text-[11px] text-[var(--neutral-500)] mb-2">Staff เป็นสิทธิ์พื้นฐานของทุกคน ไม่สามารถลบออกได้</p>
            <div className="grid grid-cols-2 gap-2">
              {/* Staff: always checked, disabled */}
              <label className="border rounded-lg p-3 flex items-start gap-2 border-[var(--neutral-200)] bg-[var(--neutral-50)] opacity-70 cursor-not-allowed">
                <input type="checkbox" className="mt-0.5 accent-[var(--tu-red)]" checked disabled />
                <div>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold mb-1 bg-blue-600 text-white">พนักงาน</span>
                  <p className="text-[11px] text-[var(--neutral-500)]">สิทธิ์พื้นฐาน (ทุกคน)</p>
                </div>
              </label>

              {NON_STAFF_ROLES.map(r => {
                const rk = r.role;
                const isPrimary = primaryRole === rk;
                const isChecked = isPrimary || extraRoles.includes(rk);
                return (
                  <label key={rk}
                    className={`border rounded-lg p-3 flex items-start gap-2 cursor-pointer transition-colors ${isPrimary ? 'border-[var(--neutral-200)] bg-[var(--neutral-50)] opacity-70 cursor-not-allowed' : isChecked ? 'border-tu-red bg-tu-red-soft' : 'border-[var(--neutral-300)] hover:border-tu-red'}`}
                  >
                    <input type="checkbox" className="mt-0.5 accent-[var(--tu-red)]"
                      checked={isChecked}
                      disabled={isPrimary}
                      onChange={() => toggleExtra(rk)} />
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold mb-1 ${r.color}`}>{r.label}</span>
                      {isPrimary
                        ? <p className="text-[11px] text-[var(--neutral-500)]">Role หลัก (รวมอยู่แล้ว)</p>
                        : <p className="text-[11px] text-[var(--neutral-500)]">{r.desc}</p>
                      }
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-[var(--neutral-50)] border border-[var(--neutral-200)] rounded-lg p-3">
            <p className="text-[12px] text-[var(--neutral-600)]">
              สรุป: <strong>{user.first_name || user.username}</strong> จะสามารถสลับดูได้:{' '}
              {allRoles.map(r => (
                <span key={r} className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold mr-1 ${ROLE_COLOR_MAP[r] || 'bg-[var(--neutral-300)] text-[var(--neutral-700)]'}`}>
                  {ROLE_LABEL[r] || r}
                </span>
              ))}
            </p>
          </div>

          {error && <p className="text-[12px] text-danger">{error}</p>}
        </div>

        <DialogFooter className="px-6 pb-5">
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button className="bg-tu-red hover:bg-tu-red-dark text-white" onClick={handleSave} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PAGE_SIZE_USERS = 15;

export function AdminUsers() {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [activeOnly, setActiveOnly] = useState(false);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [editUser, setEditUser] = useState<ApiUser | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const token = () => localStorage.getItem('access_token');

  // Load departments
  useEffect(() => {
    fetch('/api/departments/', { headers: { 'Authorization': `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(d => setDepartments(Array.isArray(d) ? d : (d?.results || [])))
      .catch(() => {});
  }, []);

  const [allUsers, setAllUsers] = useState<ApiUser[]>([]);

  // Load all users (filter client-side) — โหลดทุกหน้าจนครบ (ตาม "next" ของ DRF pagination)
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterRole !== 'all') params.set('role', filterRole);
    if (filterDept !== 'all') params.set('department', filterDept);

    let cancelled = false;

    async function loadAll() {
      let url: string | null = `/api/users/?${params}`;
      let all: ApiUser[] = [];
      while (url) {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token()}` } });
        if (!res.ok) break;
        const d = await res.json();
        if (Array.isArray(d)) {
          all = all.concat(d);
          url = null;
        } else {
          all = all.concat(d?.results || []);
          url = d?.next || null;
        }
      }
      if (!cancelled) setAllUsers(all);
    }

    loadAll()
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [filterRole, filterDept, refreshKey]);

  // Client-side filter + pagination
  const filtered = allUsers.filter(u => {
    const q = search.toLowerCase();
    if (q && !`${u.first_name} ${u.last_name} ${u.username} ${u.email}`.toLowerCase().includes(q)) return false;
    if (activeOnly && !u.is_active) return false;
    return true;
  });

  useEffect(() => { setPage(1); }, [search, filterRole, filterDept, activeOnly]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE_USERS, page * PAGE_SIZE_USERS);
  const total2 = filtered.length;

  async function toggleActive(u: ApiUser) {
    const res = await fetch(`/api/users/${u.id}/`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !u.is_active }),
    });
    if (res.ok) setAllUsers(us => us.map(x => x.id === u.id ? { ...x, is_active: !u.is_active } : x));
  }

  const totalPages = Math.max(1, Math.ceil(total2 / PAGE_SIZE_USERS));
  const start = (page - 1) * PAGE_SIZE_USERS + 1;
  const end = Math.min(page * PAGE_SIZE_USERS, total2);

  return (
    <>
      <PageHeader title="จัดการผู้ใช้งาน" right={
        <div className="flex gap-2">
          <ImportStaffDialog onImported={() => setRefreshKey(k => k + 1)} />
          <AddUserDialog onCreated={() => setRefreshKey(k => k + 1)} />
        </div>
      } />

      <SectionCard>
        <div className="grid grid-cols-[1fr_200px_180px_auto] gap-3 mb-4">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neutral-500)]" />
            <Input className="pl-10" placeholder="ค้นหาชื่อ / username / อีเมล"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger><SelectValue placeholder="ทุกแผนก" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกแผนก</SelectItem>
              {departments.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger><SelectValue placeholder="ทุก Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุก Role</SelectItem>
              {ROLE_OPTIONS.map(r => <SelectItem key={r.role} value={r.role.toLowerCase()}>{r.role}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 px-3 cursor-pointer">
            <Switch checked={activeOnly} onCheckedChange={setActiveOnly} />
            <span className="text-[13px]">Active เท่านั้น</span>
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 gap-3 text-[var(--neutral-500)]">
            <div className="size-8 border-4 border-tu-red border-t-transparent rounded-full animate-spin" />
            <span>กำลังโหลด...</span>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--neutral-300)]">
            <table className="w-full text-[13px]">
              <thead className="bg-tu-red text-white">
                <tr>{['','ชื่อ-นามสกุล','Username','แผนก','Role','อีเมล','สถานะ','Actions'].map(h =>
                  <th key={h} className="text-left px-3 py-3">{h}</th>
                )}</tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-[var(--neutral-500)]">ไม่พบข้อมูล</td></tr>
                ) : paged.map((u, i) => {
                  const fullName = `${u.first_name} ${u.last_name}`.trim() || u.username;
                  const roleLabel = ROLE_LABEL[u.role] || u.role;
                  const roleColor = ROLE_COLOR_MAP[u.role] || 'bg-[var(--neutral-300)] text-[var(--neutral-700)]';
                  return (
                    <tr key={u.id} className={`hover:bg-tu-yellow-soft ${i % 2 === 0 ? 'bg-[var(--neutral-50)]' : 'bg-white'}`}>
                      <td className="px-3 py-2 w-12">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-tu-yellow text-black text-[12px]">
                            {(u.first_name || u.username).charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </td>
                      <td className="px-3 py-2 font-medium">{fullName}</td>
                      <td className="px-3 py-2 font-mono text-[var(--neutral-600)]">{u.username}</td>
                      <td className="px-3 py-2">{u.department_name || <span className="text-[var(--neutral-400)]">—</span>}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {(u.available_roles?.length ? u.available_roles : [u.role]).map(r => (
                            <span key={r} className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${ROLE_COLOR_MAP[r] || 'bg-[var(--neutral-300)] text-[var(--neutral-700)]'}`}>
                              {ROLE_LABEL[r] || r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[var(--neutral-500)]">{u.email || '—'}</td>
                      <td className="px-3 py-2">
                        <Switch checked={u.is_active} onCheckedChange={() => toggleActive(u)} />
                      </td>
                      <td className="px-3 py-2">
                        <Button size="icon" variant="ghost" className="size-7 text-tu-red hover:bg-tu-red-soft"
                          onClick={() => setEditUser(u)}>
                          <Pencil className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between mt-4 text-[13px] text-[var(--neutral-500)]">
          <span>แสดง <strong>{total2 === 0 ? 0 : start}</strong>–<strong>{end}</strong> จาก <strong>{total2}</strong> รายการ</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>←</Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                acc.push(p); return acc;
              }, [])
              .map((p, i) => p === '...'
                ? <span key={`e${i}`} className="px-2 py-1">…</span>
                : <Button key={p} size="sm" variant={p === page ? 'default' : 'outline'}
                    className={p === page ? 'bg-tu-red text-white' : ''}
                    onClick={() => setPage(p as number)}>{p}</Button>
              )}
            <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>→</Button>
          </div>
        </div>
      </SectionCard>

      {editUser && (
        <EditRoleApiDialog
          user={editUser}
          onSaved={updated => setAllUsers(us => us.map(u => u.id === updated.id ? updated : u))}
          onClose={() => setEditUser(null)}
        />
      )}
    </>
  );
}

function ImportStaffDialog({ onImported }: { onImported?: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('tustaff2025');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: number; users: any[]; default_password: string } | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const token = () => localStorage.getItem('access_token');

  function reset() {
    setFile(null);
    setResult(null);
    setError('');
    setLoading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('password', password);
    try {
      const res = await fetch('/api/admin/import-staff/', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}` },
        body: fd,
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error(`Server error (${res.status}): ${text.slice(0, 200)}`); }
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
      setResult(data);
      onImported?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-tu-red text-tu-red hover:bg-tu-red-soft">
          <Upload className="size-4 mr-1" />นำเข้าจาก Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[560px] p-0 overflow-hidden">
        <div className="bg-tu-red text-white px-6 h-[60px] flex items-center">
          <DialogTitle className="text-white">นำเข้ารายชื่อพนักงานจาก Excel</DialogTitle>
        </div>
        <div className="p-6 space-y-4">
          {!result ? (
            <>
              {/* File picker */}
              <div>
                <label className="text-[13px] font-medium block mb-1">ไฟล์ Excel รายชื่อพนักงาน (.xlsx)</label>
                <div
                  className="border-2 border-dashed border-tu-red rounded-xl h-[120px] flex flex-col items-center justify-center gap-2 bg-tu-red-soft/30 cursor-pointer"
                  onClick={() => fileRef.current?.click()}
                >
                  {file ? (
                    <>
                      <CheckCircle2 className="size-8 text-success" />
                      <p className="text-[13px] font-medium text-[var(--neutral-700)]">{file.name}</p>
                      <button className="text-[12px] text-tu-red underline" onClick={e => { e.stopPropagation(); reset(); }}>เปลี่ยนไฟล์</button>
                    </>
                  ) : (
                    <>
                      <Upload className="size-8 text-tu-red" />
                      <p className="text-[13px] text-[var(--neutral-600)]">คลิกเพื่อเลือกไฟล์ .xlsx</p>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
              </div>

              {/* Password */}
              <div>
                <label className="text-[13px] font-medium block mb-1">รหัสผ่านเริ่มต้น</label>
                <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="tustaff2025" />
                <p className="text-[12px] text-[var(--neutral-500)] mt-1">พนักงานทุกคนจะได้รหัสผ่านนี้ (เปลี่ยนได้ภายหลัง)</p>
              </div>

              {/* Info box */}
              <div className="bg-tu-yellow-soft border border-tu-yellow rounded-lg p-3 flex gap-2">
                <AlertTriangle className="size-4 text-[var(--warning)] shrink-0 mt-0.5" />
                <p className="text-[12px] text-[var(--neutral-700)]">
                  ระบบจะสร้าง username จากชื่อ+ลำดับ เช่น <strong>สาริยา_4</strong><br />
                  หากมีชื่อซ้ำอยู่แล้วในระบบ จะข้ามรายการนั้น (ไม่ทับข้อมูลเดิม)
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-tu-red-soft border border-danger rounded-lg">
                  <AlertTriangle className="size-4 text-danger shrink-0" />
                  <p className="text-[13px] text-danger">{error}</p>
                </div>
              )}
            </>
          ) : (
            /* Result */
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#f0fdf4] border border-success rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-success">{result.created}</p>
                  <p className="text-[12px] text-[var(--neutral-600)] mt-1">สร้างสำเร็จ</p>
                </div>
                <div className="bg-tu-yellow-soft border border-tu-yellow rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-[var(--warning)]">{result.skipped}</p>
                  <p className="text-[12px] text-[var(--neutral-600)] mt-1">ข้าม (ซ้ำ)</p>
                </div>
                <div className="bg-tu-red-soft border border-danger rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-danger">{result.errors}</p>
                  <p className="text-[12px] text-[var(--neutral-600)] mt-1">ผิดพลาด</p>
                </div>
              </div>
              <div className="bg-[var(--neutral-50)] rounded-lg p-3 border border-[var(--neutral-200)]">
                <p className="text-[12px] text-[var(--neutral-600)]">
                  รหัสผ่านเริ่มต้น: <strong className="font-mono">{result.default_password}</strong>
                </p>
              </div>
              {result.users.length > 0 && (
                <div className="max-h-[200px] overflow-y-auto rounded-lg border border-[var(--neutral-200)]">
                  <table className="w-full text-[12px]">
                    <thead className="bg-tu-red text-white sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2">Username</th>
                        <th className="text-left px-3 py-2">ชื่อ-นามสกุล</th>
                        <th className="text-left px-3 py-2">แผนก</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.users.map((u: any, i: number) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[var(--neutral-50)]'}>
                          <td className="px-3 py-1.5 font-mono">{u.username}</td>
                          <td className="px-3 py-1.5">{u.name}</td>
                          <td className="px-3 py-1.5 text-[var(--neutral-500)]">{u.dept}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-[12px] text-[var(--neutral-500)]">
                ขั้นตอนต่อไป: ไปที่ตารางด้านล่าง → แก้ไข username ให้ตรงกับ TU username จริง → กำหนด Role ที่เหมาะสม
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 pb-6">
          {!result ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
              <Button
                className="bg-tu-red hover:bg-tu-red-dark text-white"
                onClick={handleImport}
                disabled={!file || loading}
              >
                {loading ? (
                  <><div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />กำลังนำเข้า...</>
                ) : (
                  <><Upload className="size-4 mr-1" />นำเข้าข้อมูล</>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => { reset(); }}>นำเข้าเพิ่มเติม</Button>
              <Button className="bg-tu-red hover:bg-tu-red-dark text-white" onClick={() => setOpen(false)}>ปิด</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddUserDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [depts, setDepts] = useState<{ id: number; name: string }[]>([]);
  const [form, setForm] = useState({ employee_id: '', prefix: '', first_name: '', last_name: '', email: '', phone: '', department: '', role: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const tok = localStorage.getItem('access_token');
    fetch('/api/departments/', { headers: { 'Authorization': `Bearer ${tok}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDepts(Array.isArray(d) ? d : (d.results || [])); });
  }, [open]);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.first_name || !form.last_name || !form.role) { setError('กรุณากรอกชื่อ นามสกุล และ Role'); return; }
    setSaving(true); setError('');
    const tok = localStorage.getItem('access_token');
    const username = form.employee_id || form.email.split('@')[0] || `user_${Date.now()}`;
    const body = {
      username,
      password: 'TU@' + (form.employee_id || '1234'),
      first_name: (form.prefix ? form.prefix + ' ' : '') + form.first_name,
      last_name: form.last_name,
      email: form.email,
      employee_id: form.employee_id,
      role: form.role,
      department: form.department || null,
      phone: form.phone,
    };
    try {
      const res = await fetch('/api/users/', { method: 'POST', headers: { 'Authorization': `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); setError(JSON.stringify(e)); }
      else { setOpen(false); setForm({ employee_id:'',prefix:'',first_name:'',last_name:'',email:'',phone:'',department:'',role:'' }); onCreated?.(); }
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-tu-red hover:bg-tu-red-dark text-white"><Plus className="size-4 mr-1" />เพิ่มผู้ใช้</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[640px] p-0 overflow-hidden">
        <div className="bg-tu-red text-white px-6 h-[60px] flex items-center justify-between">
          <DialogTitle className="text-white">เพิ่มผู้ใช้ใหม่</DialogTitle>
        </div>
        <div className="grid grid-cols-2 gap-4 p-6">
          <div><label className="text-[13px] font-medium">รหัสพนักงาน</label><Input className="mt-1" value={form.employee_id} onChange={e => set('employee_id', e.target.value)} /></div>
          <div><label className="text-[13px] font-medium">คำนำหน้า</label>
            <Select value={form.prefix} onValueChange={v => set('prefix', v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="เลือก" /></SelectTrigger>
              <SelectContent><SelectItem value="นาย">นาย</SelectItem><SelectItem value="นางสาว">นางสาว</SelectItem><SelectItem value="นาง">นาง</SelectItem></SelectContent>
            </Select>
          </div>
          <div><label className="text-[13px] font-medium">ชื่อ</label><Input className="mt-1" value={form.first_name} onChange={e => set('first_name', e.target.value)} /></div>
          <div><label className="text-[13px] font-medium">นามสกุล</label><Input className="mt-1" value={form.last_name} onChange={e => set('last_name', e.target.value)} /></div>
          <div><label className="text-[13px] font-medium">อีเมล</label><Input className="mt-1" value={form.email} onChange={e => set('email', e.target.value)} /></div>
          <div><label className="text-[13px] font-medium">เบอร์โทร</label><Input className="mt-1" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-[13px] font-medium">แผนก</label>
            <Select value={form.department} onValueChange={v => set('department', v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="เลือกแผนก" /></SelectTrigger>
              <SelectContent>{depts.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <label className="text-[13px] font-medium">Role</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {ROLE_OPTIONS.map(r => (
                <label key={r.role} className={`border rounded-md p-2 flex items-start gap-2 cursor-pointer transition-colors ${form.role === r.role ? 'border-tu-red bg-tu-red-soft' : 'border-[var(--neutral-300)] hover:border-tu-red'}`}>
                  <input type="radio" name="add-role" className="mt-1 accent-[var(--tu-red)]" checked={form.role === r.role} onChange={() => set('role', r.role)} />
                  <div>
                    <p className="font-semibold text-[13px]">{r.label}</p>
                    <p className="text-[11px] text-[var(--neutral-500)]">{r.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          {error && <div className="col-span-2 text-[12px] text-danger bg-tu-red-soft rounded p-2">{error}</div>}
        </div>
        <DialogFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
          <Button className="bg-tu-red hover:bg-tu-red-dark text-white" onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ApiDept = { id: number; name: string; code: string; member_count: number };

function ChangeRoleDialog({
  deptName, roleLabel, currentUserId, members, onSave,
}: { deptName: string; roleLabel: string; currentUserId: number | null; members: ApiUser[]; onSave: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const candidates = members.filter(m => m.id !== currentUserId);
  const currentUser = members.find(m => m.id === currentUserId);
  const currentName = currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : '—';
  const selectedUser = candidates.find(m => m.id === selectedId);

  function handleSave() {
    if (selectedUser) {
      onSave(`${selectedUser.first_name} ${selectedUser.last_name}`);
      setOpen(false);
      setSelectedId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">เปลี่ยน</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>เปลี่ยน{roleLabel} — {deptName}</DialogTitle>
        </DialogHeader>
        <p className="text-[13px] text-[var(--neutral-500)] mb-3">
          ปัจจุบัน: <strong>{currentName}</strong>
        </p>
        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {candidates.map(s => {
            const name = `${s.first_name} ${s.last_name}`;
            return (
              <label
                key={s.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedId === s.id ? 'border-tu-red bg-tu-red-soft' : 'border-[var(--neutral-300)] hover:border-tu-red'
                }`}
              >
                <input
                  type="radio" name="pick" className="accent-[var(--tu-red)]"
                  checked={selectedId === s.id}
                  onChange={() => setSelectedId(s.id)}
                />
                <Avatar className="size-9"><AvatarFallback className="bg-tu-yellow text-black text-[13px]">{name.charAt(0)}</AvatarFallback></Avatar>
                <div>
                  <p className="font-semibold text-[14px]">{name}</p>
                  <p className="text-[11px] text-[var(--neutral-500)]">{s.employee_id ?? s.username} • {ROLE_LABEL[s.role] ?? s.role}</p>
                </div>
              </label>
            );
          })}
          {candidates.length === 0 && (
            <p className="text-center text-[var(--neutral-400)] py-4">ไม่มีสมาชิกในแผนก</p>
          )}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
          <Button className="bg-tu-red hover:bg-tu-red-dark text-white" disabled={!selectedId} onClick={handleSave}>
            ยืนยันเปลี่ยน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewMembersDialog({ deptName, members }: { deptName: string; members: ApiUser[] }) {
  const [open, setOpen] = useState(false);

  function memberRoleLabel(u: ApiUser) {
    if (u.role === 'depthead' || u.extra_roles?.includes('depthead')) return 'DeptHead';
    if (u.role === 'deptrep'  || u.extra_roles?.includes('deptrep'))  return 'DeptRep';
    return ROLE_LABEL[u.role] ?? u.role;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-tu-red">ดูทั้งหมด ({members.length} คน) →</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>สมาชิก — {deptName}</DialogTitle>
        </DialogHeader>
        <div className="overflow-x-auto overflow-y-auto max-h-96 rounded-lg border border-[var(--neutral-300)] mt-2">
          <table className="w-full text-[13px]">
            <thead className="bg-tu-red text-white">
              <tr>
                {['Avatar','ชื่อ-นามสกุล','รหัส','Role'].map(h => (
                  <th key={h} className="text-left px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => {
                const name = `${m.first_name} ${m.last_name}`;
                const rl = memberRoleLabel(m);
                return (
                  <tr key={m.id} className={`border-t border-[var(--neutral-300)] ${i % 2 === 0 ? 'bg-[var(--neutral-50)]' : 'bg-white'}`}>
                    <td className="px-3 py-2 w-10">
                      <Avatar className="size-8"><AvatarFallback className="bg-tu-yellow text-black text-[11px]">{name.charAt(0)}</AvatarFallback></Avatar>
                    </td>
                    <td className="px-3 py-2 font-medium">{name}</td>
                    <td className="px-3 py-2 font-mono text-[var(--neutral-500)]">{m.employee_id ?? m.username}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        rl === 'DeptHead' ? 'bg-orange-100 text-orange-700' :
                        rl === 'DeptRep'  ? 'bg-tu-yellow text-black' :
                        'bg-blue-100 text-blue-700'
                      }`}>{rl}</span>
                    </td>
                  </tr>
                );
              })}
              {members.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-[var(--neutral-400)]">ไม่มีสมาชิก</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>ปิด</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminDepts() {
  const [depts, setDepts] = useState<ApiDept[]>([]);
  const [allUsers, setAllUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<number, { head?: string; rep?: string }>>({});

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('access_token');
    const h = { Authorization: `Bearer ${token}` };

    async function load() {
      const deptRes = await fetch('/api/departments/', { headers: h });
      const deptData = await deptRes.json();
      const deptList: ApiDept[] = Array.isArray(deptData) ? deptData : (deptData.results ?? []);

      const users: ApiUser[] = [];
      let url: string | null = '/api/users/';
      while (url) {
        const res = await fetch(url, { headers: h });
        const data = await res.json();
        users.push(...(Array.isArray(data) ? data : (data.results ?? [])));
        url = data.next ?? null;
      }

      if (!cancelled) {
        setDepts(deptList);
        setAllUsers(users);
        setLoading(false);
      }
    }

    load().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function changeRole(deptId: number, roleKey: 'head' | 'rep', newName: string) {
    setOverrides(ov => ({ ...ov, [deptId]: { ...ov[deptId], [roleKey]: newName } }));
  }

  if (loading) return (
    <>
      <PageHeader title="จัดการแผนกและสิทธิ์" />
      <p className="text-center text-[var(--neutral-500)] py-10">กำลังโหลด...</p>
    </>
  );

  return (
    <>
      <PageHeader title="จัดการแผนกและสิทธิ์" />
      <div className="grid grid-cols-2 gap-5">
        {depts.map(d => {
          const members = allUsers.filter(u => u.department === d.id);
          const head = members.find(u => u.role === 'depthead' || u.extra_roles?.includes('depthead'));
          const rep  = members.find(u => u.role === 'deptrep'  || u.extra_roles?.includes('deptrep'));
          const headName = overrides[d.id]?.head ?? (head ? `${head.first_name} ${head.last_name}` : '—');
          const repName  = overrides[d.id]?.rep  ?? (rep  ? `${rep.first_name} ${rep.last_name}`   : '—');

          return (
            <div key={d.id} className="bg-white rounded-xl border border-[var(--neutral-300)] shadow-[0_1px_2px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="bg-tu-red text-white px-5 py-3 flex items-center justify-between">
                <h3 className="text-white">{d.name}</h3>
                <span className="text-[12px]">{d.member_count} คน</span>
              </div>
              <div className="p-5 space-y-4">
                {([
                  { label: 'หัวหน้าแผนก', roleKey: 'head' as const, name: headName, userId: head?.id ?? null, badge: null },
                  { label: 'ตัวแทนแผนก (Dept Rep)', roleKey: 'rep' as const, name: repName, userId: rep?.id ?? null, badge: '1 คน/แผนก' },
                ]).map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-10"><AvatarFallback className="bg-tu-yellow text-black">{s.name.charAt(0)}</AvatarFallback></Avatar>
                      <div>
                        <p className="text-[12px] text-[var(--neutral-500)] flex items-center gap-2">
                          {s.label}
                          {s.badge && <span className="px-1.5 py-0.5 rounded bg-tu-yellow-soft text-[10px] text-[var(--warning)] font-semibold">{s.badge}</span>}
                        </p>
                        <p className="font-semibold text-[14px]">{s.name}</p>
                      </div>
                    </div>
                    <ChangeRoleDialog
                      deptName={d.name}
                      roleLabel={s.label}
                      currentUserId={s.userId}
                      members={members}
                      onSave={name => changeRole(d.id, s.roleKey, name)}
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--neutral-300)]">
                  <p className="text-[13px]">สมาชิก <strong>{d.member_count}</strong> คน</p>
                  <ViewMembersDialog deptName={d.name} members={members} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function AdminSettings() {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const token = () => localStorage.getItem('access_token');
  const h = { 'Authorization': `Bearer ${token()}` };

  useEffect(() => {
    fetch('/api/settings/', { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSettings(d); })
      .catch(() => {});
  }, []);

  function set(key: string, val: any) {
    setSettings((s: any) => ({ ...s, [key]: val }));
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    await fetch('/api/settings/', {
      method: 'PATCH',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleTestTuApi() {
    setTestResult('กำลังทดสอบ...');
    try {
      const res = await fetch('/api/admin/test-tu-api/', {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ emp_id: '0001' }),
      });
      const d = await res.json();
      setTestResult(res.ok ? `✅ เชื่อมต่อสำเร็จ — ${d.first_name} ${d.last_name} (${d.dept_name})` : `❌ ข้อผิดพลาด: ${d.error || 'ไม่ทราบสาเหตุ'}`);
    } catch {
      setTestResult('❌ เชื่อมต่อไม่ได้ ตรวจสอบ URL และ API Key');
    }
  }

  return (
    <>
      <PageHeader title="ตั้งค่าระบบ" right={
        <Button onClick={handleSave} disabled={saving} className="bg-tu-red text-white">
          {saving ? 'กำลังบันทึก...' : saved ? '✓ บันทึกแล้ว' : 'บันทึกการตั้งค่า'}
        </Button>
      } />
      <SectionCard>
        <Tabs defaultValue="rules">
          <TabsList>
            <TabsTrigger value="rules">เกณฑ์ OT</TabsTrigger>
            <TabsTrigger value="noti">การแจ้งเตือน</TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="mt-6 grid grid-cols-2 gap-6 max-w-2xl">
            <div><label>ชม. OT สูงสุดวันธรรมดา</label><Input className="mt-1" value={settings?.max_ot_hours_weekday ?? 4} onChange={e => set('max_ot_hours_weekday', e.target.value)} /></div>
            <div><label>ชม. OT สูงสุดวันหยุด</label><Input className="mt-1" value={settings?.max_ot_hours_holiday ?? 7} onChange={e => set('max_ot_hours_holiday', e.target.value)} /></div>
            <div><label>อัตราค่าจ้างวันธรรมดา (บาท/ชม.)</label><Input className="mt-1" defaultValue="60" disabled /></div>
            <div><label>อัตราค่าจ้างวันหยุด (บาท/ชม.)</label><Input className="mt-1" defaultValue="70" disabled /></div>
          </TabsContent>

          <TabsContent value="noti" className="mt-6 space-y-4 max-w-md">
            <label className="flex items-center justify-between"><span>แจ้งเตือนเมื่อยื่นคำร้อง</span><Switch checked={!!settings?.notify_on_submit} onCheckedChange={v => set('notify_on_submit', v)} /></label>
            <label className="flex items-center justify-between"><span>แจ้งเตือนเมื่ออนุมัติ</span><Switch checked={!!settings?.notify_on_approve} onCheckedChange={v => set('notify_on_approve', v)} /></label>
            <label className="flex items-center justify-between"><span>แจ้งเตือนเมื่อตีกลับ</span><Switch checked={!!settings?.notify_on_reject} onCheckedChange={v => set('notify_on_reject', v)} /></label>
          </TabsContent>

        </Tabs>
      </SectionCard>
    </>
  );
}

// ─── AdminHistory helpers ───────────────────────────────────────
type ImportRec = {
  id: number;
  filename: string;
  imported_by: number;
  imported_by_name: string;
  imported_at: string;
  status: 'success' | 'partial' | 'failed';
  total_rows: number;
  success_rows: number;
  error_rows: number;
  error_detail: string | null;
};

function fmtThaiDT(iso: string) {
  const d = new Date(iso);
  const m = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()+543} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function fmtThaiMonthFull(iso: string) {
  const d = new Date(iso);
  const m = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  return `${m[d.getMonth()]} ${d.getFullYear()+543}`;
}

function importStatusLabel(s: ImportRec['status']) {
  return s === 'success' ? 'สำเร็จ' : s === 'partial' ? 'บางส่วน' : 'ล้มเหลว';
}
function importStatusKind(s: ImportRec['status']): 'success'|'warning'|'danger' {
  return s === 'success' ? 'success' : s === 'partial' ? 'warning' : 'danger';
}

export function AdminHistory() {
  const [records, setRecords] = useState<ImportRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(''); // "YYYY-MM"
  const [expandId, setExpandId] = useState<number|null>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    fetch('/api/import-history/', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: any) => {
        const list: ImportRec[] = Array.isArray(data) ? data : (data?.results ?? []);
        setRecords(list); setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = filterMonth
    ? records.filter(r => r.imported_at.startsWith(filterMonth))
    : records;

  return (
    <>
      <PageHeader
        title="ประวัติการนำเข้า"
        right={
          <Input
            type="month"
            className="w-[180px]"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
          />
        }
      />
      <SectionCard>
        {loading ? (
          <p className="text-[13px] text-[var(--neutral-500)] py-6 text-center">กำลังโหลด…</p>
        ) : filtered.length === 0 ? (
          <p className="text-[13px] text-[var(--neutral-500)] py-6 text-center">ไม่มีข้อมูล</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--neutral-300)]">
            <table className="w-full text-[13px]">
              <thead className="bg-tu-red text-white">
                <tr>
                  {['วันที่นำเข้า','เดือนข้อมูล','ไฟล์','ผู้นำเข้า','รายการ','สำเร็จ','ผิดพลาด','สถานะ','รายละเอียด'].map(h => (
                    <th key={h} className="text-left px-3 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <React.Fragment key={r.id}>
                    <tr className="border-t border-[var(--neutral-300)] hover:bg-[var(--neutral-100)]">
                      <td className="px-3 py-3 font-mono whitespace-nowrap">{fmtThaiDT(r.imported_at)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{fmtThaiMonthFull(r.imported_at)}</td>
                      <td className="px-3 py-3 max-w-[160px] truncate" title={r.filename}>{r.filename}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{r.imported_by_name}</td>
                      <td className="px-3 py-3 font-mono text-right">{r.total_rows.toLocaleString()}</td>
                      <td className="px-3 py-3 font-mono text-right text-success">{r.success_rows.toLocaleString()}</td>
                      <td className="px-3 py-3 font-mono text-right text-danger">{r.error_rows.toLocaleString()}</td>
                      <td className="px-3 py-3">
                        <StatusChip kind={importStatusKind(r.status)}>{importStatusLabel(r.status)}</StatusChip>
                      </td>
                      <td className="px-3 py-3">
                        {r.error_rows > 0 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            onClick={() => setExpandId(expandId === r.id ? null : r.id)}
                          >
                            {expandId === r.id ? '▲' : '▼'}
                          </Button>
                        )}
                      </td>
                    </tr>
                    {expandId === r.id && r.error_detail && (
                      <tr className="border-t border-[var(--neutral-300)] bg-[var(--neutral-100)]">
                        <td colSpan={9} className="px-4 py-3">
                          <p className="text-[12px] font-semibold text-danger mb-1">รายละเอียดข้อผิดพลาด:</p>
                          <pre className="text-[11px] text-[var(--neutral-600)] whitespace-pre-wrap break-all leading-5">
                            {r.error_detail}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}

// ─── AdminAudit helpers ─────────────────────────────────────────
type AuditEntry = {
  id: number;
  user: number;
  user_name: string;
  action: string;
  model_name: string;
  object_id: string | null;
  detail: string | null;
  ip_address: string | null;
  created_at: string;
};

function auditKind(action: string): 'success' | 'danger' | 'info' {
  const a = action.toLowerCase();
  if (a.includes('approve') || a.includes('create') || a.includes('import')) return 'success';
  if (a.includes('reject') || a.includes('delete')) return 'danger';
  return 'info';
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'เมื่อกี้';
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชม. ที่แล้ว`;
  return `${Math.floor(h / 24)} วันก่อน`;
}

export function AdminAudit() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    fetch('/api/audit-log/', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: any) => {
        const list: AuditEntry[] = Array.isArray(data) ? data : (data?.results ?? []);
        setLogs(list); setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = search
    ? logs.filter(l =>
        l.user_name.includes(search) ||
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.model_name.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <>
      <PageHeader
        title="Audit Log"
        right={
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-[var(--neutral-500)]" />
            <Input
              className="pl-8 w-[220px]"
              placeholder="ค้นหาผู้ใช้ / action…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        }
      />
      <SectionCard>
        {loading ? (
          <p className="text-[13px] text-[var(--neutral-500)] py-6 text-center">กำลังโหลด…</p>
        ) : filtered.length === 0 ? (
          <p className="text-[13px] text-[var(--neutral-500)] py-6 text-center">ไม่มีข้อมูล</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(a => {
              const kind = auditKind(a.action);
              return (
                <div key={a.id} className="flex items-start gap-4 p-3 rounded-lg border border-[var(--neutral-300)]">
                  <div className={`size-9 rounded-full grid place-items-center shrink-0 ${kind === 'success' ? 'bg-green-100 text-success' : kind === 'danger' ? 'bg-tu-red-soft text-danger' : 'bg-blue-100 text-info'}`}>
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px]">
                      <strong>{a.user_name}</strong>
                      {' — '}
                      <span className="capitalize">{a.action}</span>
                      {' '}
                      <span className="text-[var(--neutral-500)]">[{a.model_name}
                        {a.object_id ? ` #${a.object_id}` : ''}]
                      </span>
                    </p>
                    {a.detail && (
                      <p className="text-[11px] text-[var(--neutral-500)] mt-0.5 truncate">{a.detail}</p>
                    )}
                    {a.ip_address && (
                      <p className="text-[11px] text-[var(--neutral-400)]">IP: {a.ip_address}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--neutral-500)] whitespace-nowrap shrink-0">
                    {fmtRelative(a.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </>
  );
}

// ─────────────────────────────────────────────
// Admin Holidays
// ─────────────────────────────────────────────

type HolidayType = 'official' | 'compensation' | 'special';
type HolidayRec = {
  id: number;
  date: string;       // "YYYY-MM-DD"
  name: string;
  holiday_type: HolidayType;
  year: number;       // Thai Buddhist year
  is_system: boolean;
};
type HolidayDraft = { date: string; name: string; holiday_type: HolidayType };

const THAI_DAY_NAMES = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสฯ','ศุกร์','เสาร์'];
const SHORT_MONTHS   = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

// ── วันหยุดราชการไทย พ.ศ. 2567–2571 ─────────────────────────────
// รวมวันหยุดตายตัวและวันหยุดตามปฏิทินจันทรคติ (มาฆบูชา วิสาขบูชา อาสาฬหบูชา เข้าพรรษา)
// ที่มา: ราชกิจจานุเบกษา + สำนักงานพระพุทธศาสนาแห่งชาติ
const TH_OFFICIAL_HOLIDAYS: Record<string, Array<{date: string; name: string; holiday_type: string}>> = {
  '2567': [
    {date:'2024-01-01', name:'วันขึ้นปีใหม่',                              holiday_type:'official'},
    {date:'2024-02-24', name:'วันมาฆบูชา',                                  holiday_type:'official'},
    {date:'2024-04-06', name:'วันจักรี',                                    holiday_type:'official'},
    {date:'2024-04-13', name:'วันสงกรานต์',                                 holiday_type:'official'},
    {date:'2024-04-14', name:'วันสงกรานต์',                                 holiday_type:'official'},
    {date:'2024-04-15', name:'วันสงกรานต์',                                 holiday_type:'official'},
    {date:'2024-05-01', name:'วันแรงงานแห่งชาติ',                           holiday_type:'official'},
    {date:'2024-05-04', name:'วันฉัตรมงคล',                                 holiday_type:'official'},
    {date:'2024-05-22', name:'วันวิสาขบูชา',                                holiday_type:'official'},
    {date:'2024-06-03', name:'วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี',         holiday_type:'official'},
    {date:'2024-07-20', name:'วันอาสาฬหบูชา',                               holiday_type:'official'},
    {date:'2024-07-21', name:'วันเข้าพรรษา',                                holiday_type:'official'},
    {date:'2024-07-28', name:'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว', holiday_type:'official'},
    {date:'2024-08-12', name:'วันแม่แห่งชาติ',                              holiday_type:'official'},
    {date:'2024-10-13', name:'วันคล้ายวันสวรรคต รัชกาลที่ 9',              holiday_type:'official'},
    {date:'2024-10-23', name:'วันปิยมหาราช',                                holiday_type:'official'},
    {date:'2024-12-05', name:'วันพ่อแห่งชาติ',                              holiday_type:'official'},
    {date:'2024-12-10', name:'วันรัฐธรรมนูญ',                               holiday_type:'official'},
    {date:'2024-12-31', name:'วันสิ้นปี',                                   holiday_type:'official'},
  ],
  '2568': [
    {date:'2025-01-01', name:'วันขึ้นปีใหม่',                              holiday_type:'official'},
    {date:'2025-02-12', name:'วันมาฆบูชา',                                  holiday_type:'official'},
    {date:'2025-04-06', name:'วันจักรี',                                    holiday_type:'official'},
    {date:'2025-04-13', name:'วันสงกรานต์',                                 holiday_type:'official'},
    {date:'2025-04-14', name:'วันสงกรานต์',                                 holiday_type:'official'},
    {date:'2025-04-15', name:'วันสงกรานต์',                                 holiday_type:'official'},
    {date:'2025-05-01', name:'วันแรงงานแห่งชาติ',                           holiday_type:'official'},
    {date:'2025-05-04', name:'วันฉัตรมงคล',                                 holiday_type:'official'},
    {date:'2025-05-12', name:'วันวิสาขบูชา',                                holiday_type:'official'},
    {date:'2025-06-03', name:'วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี',         holiday_type:'official'},
    {date:'2025-07-10', name:'วันอาสาฬหบูชา',                               holiday_type:'official'},
    {date:'2025-07-11', name:'วันเข้าพรรษา',                                holiday_type:'official'},
    {date:'2025-07-28', name:'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว', holiday_type:'official'},
    {date:'2025-08-12', name:'วันแม่แห่งชาติ',                              holiday_type:'official'},
    {date:'2025-10-13', name:'วันคล้ายวันสวรรคต รัชกาลที่ 9',              holiday_type:'official'},
    {date:'2025-10-23', name:'วันปิยมหาราช',                                holiday_type:'official'},
    {date:'2025-12-05', name:'วันพ่อแห่งชาติ',                              holiday_type:'official'},
    {date:'2025-12-10', name:'วันรัฐธรรมนูญ',                               holiday_type:'official'},
    {date:'2025-12-31', name:'วันสิ้นปี',                                   holiday_type:'official'},
  ],
  '2569': [
    {date:'2026-01-01', name:'วันขึ้นปีใหม่',                              holiday_type:'official'},
    {date:'2026-03-03', name:'วันมาฆบูชา',                                  holiday_type:'official'},
    {date:'2026-04-06', name:'วันจักรี',                                    holiday_type:'official'},
    {date:'2026-04-13', name:'วันสงกรานต์',                                 holiday_type:'official'},
    {date:'2026-04-14', name:'วันสงกรานต์',                                 holiday_type:'official'},
    {date:'2026-04-15', name:'วันสงกรานต์',                                 holiday_type:'official'},
    {date:'2026-05-01', name:'วันแรงงานแห่งชาติ',                           holiday_type:'official'},
    {date:'2026-05-04', name:'วันฉัตรมงคล',                                 holiday_type:'official'},
    {date:'2026-05-31', name:'วันวิสาขบูชา',                                holiday_type:'official'},
    {date:'2026-06-03', name:'วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี',         holiday_type:'official'},
    {date:'2026-07-28', name:'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว', holiday_type:'official'},
    {date:'2026-07-29', name:'วันอาสาฬหบูชา',                               holiday_type:'official'},
    {date:'2026-07-30', name:'วันเข้าพรรษา',                                holiday_type:'official'},
    {date:'2026-08-12', name:'วันแม่แห่งชาติ',                              holiday_type:'official'},
    {date:'2026-10-13', name:'วันคล้ายวันสวรรคต รัชกาลที่ 9',              holiday_type:'official'},
    {date:'2026-10-23', name:'วันปิยมหาราช',                                holiday_type:'official'},
    {date:'2026-12-05', name:'วันพ่อแห่งชาติ',                              holiday_type:'official'},
    {date:'2026-12-10', name:'วันรัฐธรรมนูญ',                               holiday_type:'official'},
    {date:'2026-12-31', name:'วันสิ้นปี',                                   holiday_type:'official'},
  ],
  '2570': [
    {date:'2027-01-01', name:'วันขึ้นปีใหม่',                              holiday_type:'official'},
    {date:'2027-02-20', name:'วันมาฆบูชา',                                  holiday_type:'official'},
    {date:'2027-04-06', name:'วันจักรี',                                    holiday_type:'official'},
    {date:'2027-04-13', name:'วันสงกรานต์',                                 holiday_type:'official'},
    {date:'2027-04-14', name:'วันสงกรานต์',                                 holiday_type:'official'},
    {date:'2027-04-15', name:'วันสงกรานต์',                                 holiday_type:'official'},
    {date:'2027-05-01', name:'วันแรงงานแห่งชาติ',                           holiday_type:'official'},
    {date:'2027-05-04', name:'วันฉัตรมงคล',                                 holiday_type:'official'},
    {date:'2027-05-20', name:'วันวิสาขบูชา',                                holiday_type:'official'},
    {date:'2027-06-03', name:'วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี',         holiday_type:'official'},
    {date:'2027-07-18', name:'วันอาสาฬหบูชา',                               holiday_type:'official'},
    {date:'2027-07-19', name:'วันเข้าพรรษา',                                holiday_type:'official'},
    {date:'2027-07-28', name:'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว', holiday_type:'official'},
    {date:'2027-08-12', name:'วันแม่แห่งชาติ',                              holiday_type:'official'},
    {date:'2027-10-13', name:'วันคล้ายวันสวรรคต รัชกาลที่ 9',              holiday_type:'official'},
    {date:'2027-10-23', name:'วันปิยมหาราช',                                holiday_type:'official'},
    {date:'2027-12-05', name:'วันพ่อแห่งชาติ',                              holiday_type:'official'},
    {date:'2027-12-10', name:'วันรัฐธรรมนูญ',                               holiday_type:'official'},
    {date:'2027-12-31', name:'วันสิ้นปี',                                   holiday_type:'official'},
  ],
  '2571': [
    {date:'2028-01-01', name:'วันขึ้นปีใหม่',                              holiday_type:'official'},
    {date:'2028-03-09', name:'วันมาฆบูชา',                                  holiday_type:'official'},
    {date:'2028-04-06', name:'วันจักรี',                                    holiday_type:'official'},
    {date:'2028-04-13', name:'วันสงกรานต์',                                 holiday_type:'official'},
    {date:'2028-04-14', name:'วันสงกรานต์',                                 holiday_type:'official'},
    {date:'2028-04-15', name:'วันสงกรานต์',                                 holiday_type:'official'},
    {date:'2028-05-01', name:'วันแรงงานแห่งชาติ',                           holiday_type:'official'},
    {date:'2028-05-04', name:'วันฉัตรมงคล',                                 holiday_type:'official'},
    {date:'2028-06-03', name:'วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี',         holiday_type:'official'},
    {date:'2028-06-07', name:'วันวิสาขบูชา',                                holiday_type:'official'},
    {date:'2028-07-05', name:'วันอาสาฬหบูชา',                               holiday_type:'official'},
    {date:'2028-07-06', name:'วันเข้าพรรษา',                                holiday_type:'official'},
    {date:'2028-07-28', name:'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว', holiday_type:'official'},
    {date:'2028-08-12', name:'วันแม่แห่งชาติ',                              holiday_type:'official'},
    {date:'2028-10-13', name:'วันคล้ายวันสวรรคต รัชกาลที่ 9',              holiday_type:'official'},
    {date:'2028-10-23', name:'วันปิยมหาราช',                                holiday_type:'official'},
    {date:'2028-12-05', name:'วันพ่อแห่งชาติ',                              holiday_type:'official'},
    {date:'2028-12-10', name:'วันรัฐธรรมนูญ',                               holiday_type:'official'},
    {date:'2028-12-31', name:'วันสิ้นปี',                                   holiday_type:'official'},
  ],
};

function dateToThaiShort(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}
function dateToThaiDay(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return THAI_DAY_NAMES[d.getDay()];
}
function holidayTypeLabel(t: HolidayType) {
  return t === 'official' ? 'วันหยุดราชการ' : t === 'compensation' ? 'วันหยุดชดเชย' : 'วันหยุดพิเศษ';
}

export function AdminHolidays() {
  const [holidays, setHolidays]   = useState<HolidayRec[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [apiError, setApiError]   = useState('');
  const [year, setYear]           = useState(String(CURRENT_THAI_YEAR));
  const [editDlg, setEditDlg]     = useState<{ open: boolean; id: number | null; draft: HolidayDraft }>({
    open: false, id: null, draft: { date: '', name: '', holiday_type: 'compensation' }
  });
  const [deleteDlg, setDeleteDlg] = useState<HolidayRec | null>(null);
  const [seeding, setSeeding]     = useState(false);

  const token = () => localStorage.getItem('access_token');

  // ── Fetch holidays for selected year ──────────────────────────
  const loadHolidays = useCallback(async (y: string) => {
    setLoading(true); setApiError('');
    try {
      const res = await fetch(`/api/holidays/?year=${y}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      setHolidays(Array.isArray(data) ? data : (data?.results ?? []));
    } catch {
      setApiError('โหลดข้อมูลไม่สำเร็จ');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadHolidays(year); }, [year, loadHolidays]);

  // ── Seed official holidays ────────────────────────────────────
  async function seedHolidays() {
    if (!window.confirm(`ซิงค์วันหยุดราชการ พ.ศ. ${year}?\nระบบจะเพิ่มวันหยุดที่ยังไม่มี และอัปเดตชื่อวันหยุดที่มีอยู่แล้ว`)) return;
    setSeeding(true); setApiError('');
    try {
      const holidays = TH_OFFICIAL_HOLIDAYS[year];
      if (!holidays || holidays.length === 0)
        throw new Error(`ยังไม่มีข้อมูลวันหยุดสำหรับ พ.ศ. ${year} ในระบบ`);

      const res = await fetch('/api/admin/seed-holidays/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: parseInt(year), holidays }),
      });
      const resText = await res.text();
      if (!resText.trim()) throw new Error('Backend ไม่ตอบกลับ');
      let data: any;
      try { data = JSON.parse(resText); } catch { throw new Error(`Backend: ${resText.slice(0, 120)}`); }
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
      alert(data.message);
      loadHolidays(year);
    } catch (e: any) {
      setApiError(`ซิงค์ไม่สำเร็จ: ${e.message}`);
    }
    setSeeding(false);
  }

  // ── Open add / edit ───────────────────────────────────────────
  function openAdd() {
    const today = new Date();
    const gregYear = parseInt(year) - 543;
    setEditDlg({
      open: true, id: null,
      draft: { date: `${gregYear}-${String(today.getMonth()+1).padStart(2,'0')}-01`, name: '', holiday_type: 'compensation' }
    });
  }
  function openEdit(h: HolidayRec) {
    setEditDlg({ open: true, id: h.id, draft: { date: h.date, name: h.name, holiday_type: h.holiday_type } });
  }

  // ── Save (create or update) ───────────────────────────────────
  async function saveHoliday() {
    const { id, draft } = editDlg;
    if (!draft.date || !draft.name) return;
    setSaving(true); setApiError('');
    // Derive Thai year from selected date
    const gregYear = new Date(draft.date + 'T00:00:00').getFullYear();
    const thaiYear = gregYear + 543;
    const body = JSON.stringify({ ...draft, year: thaiYear });
    const headers = { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' };
    try {
      const res = id
        ? await fetch(`/api/holidays/${id}/`, { method: 'PATCH', headers, body })
        : await fetch('/api/holidays/', { method: 'POST', headers, body });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(JSON.stringify(err));
      }
      setEditDlg({ open: false, id: null, draft: { date: '', name: '', holiday_type: 'compensation' } });
      loadHolidays(year);
    } catch (e: any) {
      setApiError(e.message || 'บันทึกไม่สำเร็จ');
    }
    setSaving(false);
  }

  // ── Delete ────────────────────────────────────────────────────
  async function deleteHoliday() {
    if (!deleteDlg) return;
    setSaving(true); setApiError('');
    try {
      const res = await fetch(`/api/holidays/${deleteDlg.id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || 'ลบไม่สำเร็จ');
      }
      setDeleteDlg(null);
      loadHolidays(year);
    } catch (e: any) {
      setApiError(e.message);
    }
    setSaving(false);
  }

  const counts = {
    official:     holidays.filter(h => h.holiday_type === 'official').length,
    compensation: holidays.filter(h => h.holiday_type === 'compensation').length,
    special:      holidays.filter(h => h.holiday_type === 'special').length,
  };
  const isAdding = editDlg.open && !editDlg.id;
  const yearOptions = [CURRENT_THAI_YEAR - 1, CURRENT_THAI_YEAR, CURRENT_THAI_YEAR + 1];

  return (
    <>
      <PageHeader
        title="จัดการวันหยุดประจำปี"
        subtitle="จัดการวันหยุดประจำปี — ลบหรือแก้ไขได้ทุกวันหยุดตามต้องการ"
        right={
          <div className="flex items-center gap-2">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => (
                  <SelectItem key={y} value={String(y)}>พ.ศ. {y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="border-tu-red text-tu-red"
              onClick={seedHolidays}
              disabled={seeding}
            >
              <Download className="size-4 mr-1" />
              {seeding ? 'กำลังซิงค์...' : `ซิงค์วันหยุดราชการ ${year}`}
            </Button>
            <Button className="bg-tu-red hover:bg-tu-red-dark text-white" onClick={openAdd}>
              <Plus className="size-4 mr-1" />เพิ่มวันหยุด
            </Button>
          </div>
        }
      />

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 mb-5 bg-blue-50 border border-blue-200 rounded-xl">
        <Info className="size-5 text-info shrink-0 mt-0.5" />
        <p className="text-[13px] text-blue-800">
          กด "ซิงค์วันหยุดราชการ" เพื่อโหลดวันหยุดตามปฏิทิน — จากนั้นลบวันที่หน่วยงานไม่หยุดออกได้เลย เช่น วันแรงงาน
          วันหยุดชดเชยและวันพิเศษเพิ่มด้วยตนเองตามประกาศราชกิจจาฯ
        </p>
      </div>

      {apiError && (
        <div className="flex items-center gap-3 p-3 mb-4 bg-tu-red-soft border border-danger rounded-lg text-[13px] text-danger">
          <AlertTriangle className="size-4 shrink-0" />{apiError}
        </div>
      )}

      {/* Summary chips */}
      <div className="flex gap-3 mb-5">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--neutral-100)] border border-[var(--neutral-300)] text-[13px] font-semibold text-[var(--neutral-600)]">
          <Lock className="size-3" />วันหยุดราชการ {counts.official} วัน
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-100 border border-orange-300 text-[13px] font-semibold text-orange-700">
          <CalendarDays className="size-3.5" />วันหยุดชดเชย {counts.compensation} วัน
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-100 border border-purple-300 text-[13px] font-semibold text-purple-700">
          <CalendarDays className="size-3.5" />วันหยุดพิเศษ {counts.special} วัน
        </span>
      </div>

      <SectionCard>
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-3 text-[var(--neutral-500)]">
            <div className="size-7 border-4 border-tu-red border-t-transparent rounded-full animate-spin" />
            <span>กำลังโหลด...</span>
          </div>
        ) : holidays.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-[var(--neutral-500)]">
            <CalendarDays className="size-10 mx-auto mb-3 text-[var(--neutral-300)]" />
            <p>ยังไม่มีวันหยุดสำหรับ พ.ศ. {year}</p>
            <p className="text-[11px] mt-1">กด "เพิ่มวันหยุด" เพื่อเพิ่มข้อมูล</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-[var(--neutral-300)]">
              <table className="w-full text-[13px]">
                <thead className="bg-tu-red text-white">
                  <tr>{['วันที่','วัน','ชื่อวันหยุด','ประเภท','จัดการ'].map(h => (
                    <th key={h} className="text-left px-4 py-3">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {holidays.map(h => {
                    const isRO = h.is_system;
                    return (
                      <tr key={h.id} className={`border-t border-[var(--neutral-300)] ${isRO ? 'bg-[var(--neutral-50)]' : 'bg-white'}`}>
                        <td className={`px-4 py-2.5 font-mono ${isRO ? 'text-[var(--neutral-500)]' : 'font-medium'}`}>
                          {dateToThaiShort(h.date)}
                        </td>
                        <td className={`px-4 py-2.5 ${isRO ? 'text-[var(--neutral-400)]' : 'text-[var(--neutral-600)]'}`}>
                          {dateToThaiDay(h.date)}
                        </td>
                        <td className={`px-4 py-2.5 ${isRO ? 'text-[var(--neutral-500)]' : ''}`}>{h.name}</td>
                        <td className="px-4 py-2.5">
                          {isRO ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--neutral-100)] border border-[var(--neutral-300)] text-[var(--neutral-500)]">
                              <Lock className="size-2.5" />วันหยุดราชการ
                            </span>
                          ) : h.holiday_type === 'compensation' ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 border border-orange-300 text-orange-700">วันหยุดชดเชย</span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 border border-purple-300 text-purple-700">วันหยุดพิเศษ</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {(
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="size-7 text-tu-red hover:bg-tu-red-soft" onClick={() => openEdit(h)}>
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="size-7 text-danger hover:bg-tu-red-soft" onClick={() => setDeleteDlg(h)}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[12px] text-[var(--neutral-400)] mt-3">
              แสดง {holidays.length} รายการ
            </p>
          </>
        )}
      </SectionCard>

      {/* Add/Edit dialog */}
      <Dialog open={editDlg.open} onOpenChange={open => { if (!open) setEditDlg(d => ({ ...d, open: false })); }}>
        <DialogContent className="max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{isAdding ? 'เพิ่มวันหยุด' : 'แก้ไขวันหยุด'}</DialogTitle>
          </DialogHeader>

          {isAdding && (
            <div className="flex items-start gap-2 p-3 bg-tu-yellow-soft border border-tu-yellow rounded-lg text-[12px]">
              <AlertTriangle className="size-4 text-[var(--warning)] shrink-0 mt-0.5" />
              <span>สำหรับวันหยุดชดเชยและวันพิเศษเท่านั้น วันหยุดราชการระบบจัดการให้อัตโนมัติ</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium mb-1.5">วันที่</label>
              <Input
                type="date"
                value={editDlg.draft.date}
                onChange={e => setEditDlg(d => ({ ...d, draft: { ...d.draft, date: e.target.value } }))}
              />
              {editDlg.draft.date && (
                <p className="text-[12px] text-[var(--neutral-500)] mt-1">
                  {dateToThaiShort(editDlg.draft.date)} ({dateToThaiDay(editDlg.draft.date)})
                </p>
              )}
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">ชื่อวันหยุด</label>
              <Input
                placeholder="เช่น ชดเชยวันสงกรานต์"
                value={editDlg.draft.name}
                onChange={e => setEditDlg(d => ({ ...d, draft: { ...d.draft, name: e.target.value } }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">ประเภท</label>
              <Select
                value={editDlg.draft.holiday_type}
                onValueChange={(v: HolidayType) => setEditDlg(d => ({ ...d, draft: { ...d.draft, holiday_type: v } }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="compensation">วันหยุดชดเชย</SelectItem>
                  <SelectItem value="special">วันหยุดพิเศษ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setEditDlg(d => ({ ...d, open: false }))} disabled={saving}>ยกเลิก</Button>
            <Button
              className="bg-tu-red hover:bg-tu-red-dark text-white"
              onClick={saveHoliday}
              disabled={saving || !editDlg.draft.date || !editDlg.draft.name}
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteDlg} onOpenChange={open => { if (!open) setDeleteDlg(null); }}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader><DialogTitle>ยืนยันการลบวันหยุด</DialogTitle></DialogHeader>
          {deleteDlg && (
            <div className="text-[13px] space-y-1">
              <p>ต้องการลบวันหยุด <strong>{deleteDlg.name}</strong> ออกจากระบบ?</p>
              <p className="text-[var(--neutral-500)]">{dateToThaiShort(deleteDlg.date)} ({dateToThaiDay(deleteDlg.date)}) — {holidayTypeLabel(deleteDlg.holiday_type)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDlg(null)} disabled={saving}>ยกเลิก</Button>
            <Button className="bg-danger text-white" onClick={deleteHoliday} disabled={saving}>
              <Trash2 className="size-4 mr-1" />{saving ? 'กำลังลบ...' : 'ลบ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── AdminDeadlines ──────────────────────────────────────────────────────────
type DeadlineRec = {
  id: number;
  thai_month: string;   // e.g. '2569-06'
  deadline_date: string; // ISO date
  note: string;
  is_passed: boolean;
};

function thaiMonthFull(thaiMonth: string) {
  // '2569-06' → 'มิถุนายน 2569'
  const MONTH_NAMES = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                       'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const [y, m] = thaiMonth.split('-').map(Number);
  return `${MONTH_NAMES[m] ?? ''} ${y}`;
}

function deadlineDateLabel(iso: string) {
  // '2026-06-10' → '10 มิ.ย. 2569'
  const d = new Date(iso + 'T12:00:00');
  const thaiY = d.getFullYear() + 543;
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${thaiY}`;
}

// Generate thai_month options: 3 months back → 3 months forward from today
function generateThaiMonthOptions() {
  const today = new Date();
  const opts: { value: string; label: string }[] = [];
  for (let delta = -3; delta <= 6; delta++) {
    const d = new Date(today.getFullYear(), today.getMonth() + delta, 1);
    const thaiY = d.getFullYear() + 543;
    const m = d.getMonth() + 1;
    const value = `${thaiY}-${String(m).padStart(2, '0')}`;
    // Default deadline: 10th of the following Gregorian month
    const defDate = new Date(d.getFullYear(), d.getMonth() + 1, 10);
    const defDateISO = defDate.toISOString().slice(0, 10);
    opts.push({ value, label: thaiMonthFull(value), defDate: defDateISO } as any);
  }
  return opts;
}

export function AdminDeadlines() {
  const token = () => localStorage.getItem('access_token') ?? '';
  const authH = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

  const [records, setRecords]   = useState<DeadlineRec[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [apiError, setApiError] = useState('');
  const [dlg, setDlg] = useState<{
    open: boolean; id: number | null;
    thai_month: string; deadline_date: string; note: string;
  }>({ open: false, id: null, thai_month: '', deadline_date: '', note: '' });

  const monthOptions = generateThaiMonthOptions();

  function load() {
    setLoading(true);
    fetch('/api/ot-deadline/?all=1', { headers: authH() })
      .then(r => r.json())
      .then((data: any) => {
        const list: DeadlineRec[] = Array.isArray(data) ? data : (data?.results ?? []);
        setRecords(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    const today = new Date();
    const thaiY = today.getFullYear() + 543;
    const m = today.getMonth() + 1;
    const thaiMonth = `${thaiY}-${String(m).padStart(2, '0')}`;
    // Default deadline: 10th of the NEXT Gregorian month
    const defDate = new Date(today.getFullYear(), today.getMonth() + 1, 10);
    setDlg({ open: true, id: null, thai_month: thaiMonth, deadline_date: defDate.toISOString().slice(0, 10), note: '' });
  }

  function openEdit(r: DeadlineRec) {
    setDlg({ open: true, id: r.id, thai_month: r.thai_month, deadline_date: r.deadline_date, note: r.note });
  }

  async function save() {
    setSaving(true); setApiError('');
    try {
      const res = await fetch('/api/ot-deadline/set/', {
        method: 'POST',
        headers: authH(),
        body: JSON.stringify({ thai_month: dlg.thai_month, deadline_date: dlg.deadline_date, note: dlg.note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
      setDlg(d => ({ ...d, open: false }));
      load();
    } catch (e: any) {
      setApiError(e.message);
    }
    setSaving(false);
  }

  async function deleteDeadline(rec: DeadlineRec) {
    if (!window.confirm(`ลบกำหนดวันปิดรับโอที เดือน ${thaiMonthFull(rec.thai_month)}?`)) return;
    setSaving(true);
    await fetch(`/api/ot-deadline/${rec.id}/delete/`, { method: 'DELETE', headers: authH() });
    setSaving(false);
    load();
  }

  // Compute current thai_month for highlighting
  const today = new Date();
  const currentThaiMonth = `${today.getFullYear() + 543}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  return (
    <>
      <PageHeader
        title="กำหนดวันปิดรับคำร้องโอที"
        right={
          <Button className="bg-tu-red text-white" onClick={openAdd}>
            <Plus className="size-4 mr-1" />ตั้งวันปิดรับ
          </Button>
        }
      />

      <SectionCard>
        <div className="flex items-start gap-3 p-3 mb-4 bg-tu-yellow-soft border border-tu-yellow rounded-lg text-[13px]">
          <Info className="size-4 text-[var(--warning)] shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">กฎของระบบ</p>
            <p className="text-[var(--neutral-600)] mt-0.5">
              เมื่อเลยวันปิดรับแล้ว พนักงานจะยื่นคำร้องโอทีสำหรับเดือนนั้นไม่ได้
              (ทั้ง frontend และ backend) ถ้าเดือนใดไม่ได้ตั้งไว้ จะยื่นได้ตลอด
            </p>
          </div>
        </div>

        {apiError && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">
            <AlertTriangle className="size-4 shrink-0" />
            {apiError}
          </div>
        )}

        {loading ? (
          <p className="text-center text-[var(--neutral-400)] py-8">กำลังโหลด...</p>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-[var(--neutral-400)]">
            <Clock className="size-10 mx-auto mb-3 opacity-30" />
            <p>ยังไม่ได้ตั้งวันปิดรับสำหรับเดือนใด</p>
            <p className="text-[13px]">กดปุ่ม "ตั้งวันปิดรับ" เพื่อเพิ่ม</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b text-left text-[var(--neutral-500)]">
                <th className="pb-2 font-medium">เดือน (พ.ศ.)</th>
                <th className="pb-2 font-medium">วันปิดรับ</th>
                <th className="pb-2 font-medium">สถานะ</th>
                <th className="pb-2 font-medium">หมายเหตุ</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.map(rec => {
                const isCurrent = rec.thai_month === currentThaiMonth;
                return (
                  <tr key={rec.id} className={isCurrent ? 'bg-tu-yellow-soft' : ''}>
                    <td className="py-2.5 pr-4 font-medium">
                      {thaiMonthFull(rec.thai_month)}
                      {isCurrent && (
                        <span className="ml-2 text-[10px] bg-tu-yellow text-[#7a5800] px-1.5 py-0.5 rounded-full font-semibold">เดือนนี้</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      {deadlineDateLabel(rec.deadline_date)}
                    </td>
                    <td className="py-2.5 pr-4">
                      {rec.is_passed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold">
                          <Lock className="size-2.5" />ปิดรับแล้ว
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-semibold">
                          <CheckCircle2 className="size-2.5" />เปิดรับอยู่
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--neutral-500)]">{rec.note || '—'}</td>
                    <td className="py-2.5">
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="size-7 text-tu-red hover:bg-tu-red-soft" onClick={() => openEdit(rec)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-7 text-danger hover:bg-tu-red-soft" onClick={() => deleteDeadline(rec)} disabled={saving}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Dialog */}
      <Dialog open={dlg.open} onOpenChange={open => { if (!open) setDlg(d => ({ ...d, open: false })); }}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{dlg.id ? 'แก้ไขวันปิดรับ' : 'ตั้งวันปิดรับโอที'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium mb-1.5">เดือน (พ.ศ.)</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-[13px] bg-white"
                value={dlg.thai_month}
                onChange={e => {
                  const opt = monthOptions.find(o => o.value === e.target.value) as any;
                  setDlg(d => ({ ...d, thai_month: e.target.value, deadline_date: opt?.defDate ?? d.deadline_date }));
                }}
              >
                {monthOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium mb-1.5">วันปิดรับ</label>
              <Input
                type="date"
                value={dlg.deadline_date}
                onChange={e => setDlg(d => ({ ...d, deadline_date: e.target.value }))}
              />
              {dlg.deadline_date && (
                <p className="text-[12px] text-[var(--neutral-500)] mt-1">
                  {deadlineDateLabel(dlg.deadline_date)} ({dateToThaiDay(dlg.deadline_date)})
                </p>
              )}
            </div>

            <div>
              <label className="block text-[13px] font-medium mb-1.5">หมายเหตุ (ถ้ามี)</label>
              <Input
                placeholder="เช่น เลื่อนเนื่องจากวันหยุดยาว"
                value={dlg.note}
                onChange={e => setDlg(d => ({ ...d, note: e.target.value }))}
              />
            </div>

            {apiError && (
              <p className="text-[13px] text-red-600">{apiError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(d => ({ ...d, open: false }))} disabled={saving}>ยกเลิก</Button>
            <Button
              className="bg-tu-red text-white"
              onClick={save}
              disabled={saving || !dlg.thai_month || !dlg.deadline_date}
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
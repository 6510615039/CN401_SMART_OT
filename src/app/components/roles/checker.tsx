import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Wallet, History, FileBarChart, Send,
  CheckCircle2, X, Eye, ChevronDown, ChevronUp,
} from 'lucide-react';
import { NavItem } from '../AppShell';
import { KpiCard, PageHeader, SectionCard, StatusChip } from '../shared';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ReferenceLine,
} from 'recharts';

export const CHECKER_NAV: NavItem[] = [
  { key: 'dashboard',  label: 'Dashboard',         icon: <LayoutDashboard /> },
  { key: 'budget',     label: 'ติดตามงบประมาณ',   icon: <Wallet /> },
  { key: 'budget-set', label: 'ตั้งเพดานงบประมาณ', icon: <Send /> },
  { key: 'history',    label: 'ประวัติการตรวจสอบ',  icon: <History /> },
  { key: 'report',     label: 'รายงานภาพรวม',      icon: <FileBarChart /> },
];

type OTReq = {
  id: number;
  staff: number;
  staff_name: string;
  department: number;
  department_name: string;
  work_date: string;
  day_type: string;
  start_time: string;
  end_time: string;
  ot_hours: string;
  amount: string;
  status: string;
};

type DeptGroup = {
  dept_id: number;
  dept_name: string;
  pending: OTReq[];      // rep_forwarded
  approved: OTReq[];     // checker_approved / completed
  rejected: OTReq[];     // checker_rejected
};

function groupByDept(reqs: OTReq[]): DeptGroup[] {
  const map = new Map<number, DeptGroup>();
  for (const r of reqs) {
    if (!map.has(r.department)) {
      map.set(r.department, { dept_id: r.department, dept_name: r.department_name, pending: [], approved: [], rejected: [] });
    }
    const g = map.get(r.department)!;
    if (r.status === 'rep_forwarded') g.pending.push(r);
    else if (r.status === 'checker_approved' || r.status === 'completed') g.approved.push(r);
    else if (r.status === 'checker_rejected') g.rejected.push(r);
  }
  return Array.from(map.values()).sort((a, b) => b.pending.length - a.pending.length);
}

function fmtAmt(amt: string | number) {
  return Number(amt).toLocaleString('th-TH', { maximumFractionDigits: 0 });
}

function BudgetGauge({ percent }: { percent: number }) {
  const r = 100, cx = 130, cy = 130;
  const angle = (percent / 100) * 180;
  const rad = (angle - 180) * Math.PI / 180;
  const x = cx + r * Math.cos(rad), y = cy + r * Math.sin(rad);
  return (
    <svg viewBox="0 0 260 160" className="w-full max-w-[320px]">
      <defs>
        <linearGradient id="gauge" x1="0%" x2="100%">
          <stop offset="0%" stopColor="#0A8A44" />
          <stop offset="60%" stopColor="#FFD400" />
          <stop offset="100%" stopColor="#D32F2F" />
        </linearGradient>
      </defs>
      <path d="M 30 130 A 100 100 0 0 1 230 130" stroke="#F5F5F5" strokeWidth="22" fill="none" />
      <path d="M 30 130 A 100 100 0 0 1 230 130" stroke="url(#gauge)" strokeWidth="22" fill="none" strokeDasharray={`${angle * 1.745} 1000`} />
      <line x1={cx} y1={cy} x2={x} y2={y} stroke="#B8001F" strokeWidth="4" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="8" fill="#B8001F" />
      <text x={cx} y={cy - 25} textAnchor="middle" fontSize="32" fontWeight="700" fill="#B8001F">{percent}%</text>
    </svg>
  );
}

// ─── CheckerDashboard ─────────────────────────────────────────────────────────

export function CheckerDashboard({ onGo }: { onGo: () => void; onOtDetail?: (emp: any) => void }) {
  const [groups, setGroups] = useState<DeptGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDept, setExpandedDept] = useState<number | null>(null);
  const [rejectDlg, setRejectDlg] = useState<{ open: boolean; requests: OTReq[]; dept: string }>({ open: false, requests: [], dept: '' });
  const [rejectNote, setRejectNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const token = () => localStorage.getItem('access_token');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const statuses = ['rep_forwarded', 'checker_approved', 'checker_rejected', 'completed'];
      const all: OTReq[] = [];
      for (const s of statuses) {
        const res = await fetch(`/api/ot-requests/?status=${s}`, { headers: { 'Authorization': `Bearer ${token()}` } });
        if (res.ok) { const d = await res.json(); all.push(...(Array.isArray(d) ? d : d.results || [])); }
      }
      setGroups(groupByDept(all));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approveAll(requests: OTReq[]) {
    setProcessing(true);
    for (const r of requests) {
      await fetch(`/api/ot-requests/${r.id}/approve/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    }
    setProcessing(false);
    await load();
  }

  async function rejectAll() {
    if (!rejectNote.trim() || rejectNote.length < 10) return;
    setProcessing(true);
    for (const r of rejectDlg.requests) {
      await fetch(`/api/ot-requests/${r.id}/reject/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: rejectNote }),
      });
    }
    setProcessing(false);
    setRejectDlg({ open: false, requests: [], dept: '' });
    setRejectNote('');
    await load();
  }

  const totalPending = groups.reduce((s, g) => s + g.pending.length, 0);
  const totalAmt = groups.reduce((s, g) => s + g.pending.reduce((a, r) => a + Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60), 0), 0);
  const approvedDepts = groups.filter(g => g.pending.length === 0 && g.approved.length > 0).length;

  return (
    <>
      <PageHeader title="Dashboard ผู้ตรวจสอบ" />
      <div className="grid grid-cols-4 gap-5 mb-6">
        <KpiCard label="รอตรวจสอบ" value={String(groups.filter(g => g.pending.length > 0).length) + ' แผนก'} hint={`${totalPending} รายการ`} accent="orange" />
        <KpiCard label="รวมยอด OT รอตรวจ" value={`${fmtAmt(totalAmt)} ฿`} hint="ทุกแผนก" accent="red" />
        <KpiCard label="อนุมัติแล้ว" value={String(approvedDepts) + ' แผนก'} hint="เดือนนี้" accent="green" />
        <KpiCard label="รายการทั้งหมด" value={String(groups.reduce((s, g) => s + g.pending.length + g.approved.length + g.rejected.length, 0))} hint="rep_forwarded+" accent="blue" />
      </div>

      <SectionCard title="สถานะการส่งจากตัวแทนฝ่าย">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-3 text-[var(--neutral-500)]">
            <div className="size-7 border-4 border-tu-red border-t-transparent rounded-full animate-spin" />
            <span>กำลังโหลด...</span>
          </div>
        ) : groups.length === 0 ? (
          <p className="text-center text-[var(--neutral-500)] py-10">ยังไม่มีรายการส่งมาจากตัวแทนฝ่าย</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--neutral-300)]">
            <table className="w-full text-[13px]">
              <thead className="bg-tu-red text-white">
                <tr>{['แผนก', 'รายการรอตรวจ', 'ยอดเงิน', 'สถานะ', 'ดูรายการ', 'ตรวจสอบ'].map(h =>
                  <th key={h} className="text-left px-3 py-3">{h}</th>
                )}</tr>
              </thead>
              <tbody>
                {groups.map(g => {
                  const hasPending = g.pending.length > 0;
                  const isApproved = !hasPending && g.approved.length > 0;
                  const isRejected = !hasPending && g.rejected.length > 0;
                  const pendingAmt = g.pending.reduce((s, r) => s + Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60), 0);
                  const expanded = expandedDept === g.dept_id;

                  return (
                    <>
                      <tr key={g.dept_id} className={`border-t border-[var(--neutral-300)] ${expanded ? 'bg-tu-yellow-soft' : ''}`}>
                        <td className="px-3 py-2 font-medium">{g.dept_name}</td>
                        <td className="px-3 py-2 font-mono">{g.pending.length || '—'}</td>
                        <td className="px-3 py-2 font-mono">{hasPending ? fmtAmt(pendingAmt) : '—'}</td>
                        <td className="px-3 py-2">
                          {hasPending && <StatusChip kind="warning">รอตรวจสอบ</StatusChip>}
                          {isApproved && <StatusChip kind="success">อนุมัติแล้ว</StatusChip>}
                          {isRejected && <StatusChip kind="danger">ตีกลับแล้ว</StatusChip>}
                          {!hasPending && !isApproved && !isRejected && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold bg-orange-500 text-white">
                              ยังไม่ส่งมอบ
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {(g.pending.length > 0 || g.approved.length > 0 || g.rejected.length > 0) && (
                            <Button size="sm" variant="outline"
                              className={`h-7 px-2 ${expanded ? 'bg-tu-red text-white border-tu-red' : 'border-tu-red text-tu-red'}`}
                              onClick={() => setExpandedDept(expanded ? null : g.dept_id)}
                            >
                              <Eye className="size-3 mr-1" />
                              ดู OT {expanded ? <ChevronUp className="size-3 ml-1" /> : <ChevronDown className="size-3 ml-1" />}
                            </Button>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {hasPending && (
                            <div className="flex gap-1">
                              <Button size="sm" className="h-7 px-2 bg-success text-white text-[11px]"
                                disabled={processing}
                                onClick={() => approveAll(g.pending)}>
                                <CheckCircle2 className="size-3 mr-1" />อนุมัติทั้งหมด
                              </Button>
                              <Button size="sm" className="h-7 px-2 bg-danger text-white text-[11px]"
                                disabled={processing}
                                onClick={() => { setRejectDlg({ open: true, requests: g.pending, dept: g.dept_name }); setRejectNote(''); }}>
                                <X className="size-3 mr-1" />ตีกลับ
                              </Button>
                            </div>
                          )}
                          {isApproved && <span className="text-[11px] text-success font-semibold">อนุมัติแล้ว ✓</span>}
                          {isRejected && <span className="text-[11px] text-danger font-semibold">ตีกลับแล้ว</span>}
                        </td>
                      </tr>

                      {/* Expanded rows */}
                      {expanded && [...g.pending, ...g.approved, ...g.rejected].map(r => (
                        <tr key={r.id} className="border-t border-[var(--neutral-200)] bg-[var(--neutral-50)]">
                          <td className="px-3 py-2 pl-8 text-[12px] text-[var(--neutral-600)]" colSpan={2}>
                            {r.staff_name}
                          </td>
                          <td className="px-3 py-2 text-[12px] font-mono">{r.work_date}</td>
                          <td className="px-3 py-2 text-[12px]">
                            <StatusChip kind={r.day_type === 'holiday' ? 'danger' : 'neutral'}>
                              {r.day_type === 'holiday' ? 'วันหยุด' : 'วันธรรมดา'}
                            </StatusChip>
                          </td>
                          <td className="px-3 py-2 text-[12px] font-mono">{Math.floor(parseFloat(r.ot_hours || '0'))} ชม. • {fmtAmt(Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60))} ฿</td>
                          <td className="px-3 py-2 text-[12px]">
                            {r.status === 'rep_forwarded' && (
                              <div className="flex gap-1">
                                <Button size="sm" className="h-6 px-2 bg-success text-white text-[11px]"
                                  disabled={processing} onClick={() => approveAll([r])}>✓</Button>
                                <Button size="sm" className="h-6 px-2 bg-danger text-white text-[11px]"
                                  disabled={processing}
                                  onClick={() => { setRejectDlg({ open: true, requests: [r], dept: r.staff_name }); setRejectNote(''); }}>✕</Button>
                              </div>
                            )}
                            {(r.status === 'checker_approved' || r.status === 'completed') &&
                              <span className="text-success text-[11px]">อนุมัติแล้ว</span>}
                            {r.status === 'checker_rejected' &&
                              <span className="text-danger text-[11px]">ตีกลับแล้ว</span>}
                          </td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-[var(--neutral-500)] mt-2">เมื่ออนุมัติหรือตีกลับ สถานะจะอัปเดตทันที</p>
      </SectionCard>

      {/* Reject dialog */}
      <Dialog open={rejectDlg.open} onOpenChange={open => { if (!open) setRejectDlg({ open: false, requests: [], dept: '' }); }}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader><DialogTitle>ตีกลับ — {rejectDlg.dept}</DialogTitle></DialogHeader>
          <div className="bg-tu-red-soft border border-tu-red rounded-lg p-3 text-[13px]">
            <p className="font-semibold text-tu-red">
              จะตีกลับ {rejectDlg.requests.length} รายการ — ระบบจะแจ้งเตือนพนักงานและหัวหน้างาน
            </p>
          </div>
          <div>
            <label className="font-medium block mb-1">เหตุผลการตีกลับ *</label>
            <Textarea rows={4} value={rejectNote} onChange={e => setRejectNote(e.target.value)}
              placeholder="ระบุเหตุผลที่ตีกลับ เพื่อให้พนักงานดำเนินการแก้ไข" />
            {rejectNote.length > 0 && rejectNote.length < 10 &&
              <p className="text-[12px] text-danger mt-1">กรุณากรอกอย่างน้อย 10 ตัวอักษร</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDlg({ open: false, requests: [], dept: '' })}>ยกเลิก</Button>
            <Button className="bg-danger text-white" disabled={rejectNote.length < 10 || processing} onClick={rejectAll}>
              <X className="size-4 mr-1" />{processing ? 'กำลังดำเนินการ...' : 'ยืนยันตีกลับ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── CheckerOTDetail (legacy - kept for compatibility) ───────────────────────

export function CheckerOTDetail({ onBack, name, dept }: { onBack: () => void; name: string; dept: string; idx: number }) {
  const [requests, setRequests] = useState<OTReq[]>([]);
  const [loading, setLoading] = useState(true);
  const token = () => localStorage.getItem('access_token');

  useEffect(() => {
    fetch(`/api/ot-requests/?status=rep_forwarded`, { headers: { 'Authorization': `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        const all: OTReq[] = Array.isArray(d) ? d : (d.results || []);
        setRequests(all.filter(r => r.staff_name === name));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [name]);

  const totalHrs = requests.reduce((s, r) => s + Number(r.ot_hours), 0);
  const totalAmt = requests.reduce((s, r) => s + Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60), 0);

  return (
    <>
      <PageHeader title={`OT รายวัน — ${name}`} subtitle={`${dept} • รายการที่รอตรวจสอบ`}
        right={<Button variant="outline" onClick={onBack}>← กลับ</Button>} />
      <div className="flex items-center gap-4 p-4 mb-5 bg-[var(--neutral-50)] border border-[var(--neutral-300)] rounded-xl">
        <div className="size-16 rounded-full bg-tu-yellow text-black font-bold text-2xl grid place-items-center shrink-0">{name.charAt(0)}</div>
        <div className="flex-1">
          <p className="font-semibold text-[16px]">{name}</p>
          <p className="text-[var(--neutral-500)] text-[13px]">{dept}</p>
        </div>
        <div className="text-right">
          <p className="text-[12px] text-[var(--neutral-500)]">ค่า OT รวม</p>
          <p className="font-bold text-tu-red text-xl">{fmtAmt(totalAmt)} บาท</p>
        </div>
      </div>
      <SectionCard title="รายการ OT">
        {loading ? (
          <div className="flex items-center justify-center h-24 gap-3 text-[var(--neutral-500)]">
            <div className="size-7 border-4 border-tu-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--neutral-300)]">
            <table className="w-full text-[13px]">
              <thead className="bg-tu-red text-white">
                <tr>{['วันที่', 'ประเภทวัน', 'เวลาเริ่ม', 'เวลาสิ้นสุด', 'ชม. OT', 'ค่าตอบแทน'].map(h =>
                  <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody>
                {requests.map((r, j) => (
                  <tr key={r.id} className={`border-t border-[var(--neutral-300)] ${j % 2 === 0 ? 'bg-[var(--neutral-50)]' : 'bg-white'}`}>
                    <td className="px-4 py-3 font-mono">{r.work_date}</td>
                    <td className="px-4 py-3"><StatusChip kind={r.day_type === 'holiday' ? 'danger' : 'neutral'}>{r.day_type === 'holiday' ? 'วันหยุด' : 'วันธรรมดา'}</StatusChip></td>
                    <td className="px-4 py-3 font-mono">{r.start_time}</td>
                    <td className="px-4 py-3 font-mono">{r.end_time}</td>
                    <td className="px-4 py-3 font-mono font-semibold">{r.ot_hours}</td>
                    <td className="px-4 py-3 font-mono">{fmtAmt(Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60))}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-tu-red bg-tu-red/5">
                  <td className="px-4 py-3 font-bold text-tu-red" colSpan={4}>รวม</td>
                  <td className="px-4 py-3 font-bold font-mono text-tu-red">{Math.floor(totalHrs)} ชม.</td>
                  <td className="px-4 py-3 font-bold font-mono text-tu-red">{fmtAmt(totalAmt)} ฿</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}

// ─── CheckerHistory ───────────────────────────────────────────────────────────

export function CheckerHistory() {
  const [requests, setRequests] = useState<OTReq[]>([]);
  const [loading, setLoading] = useState(true);
  const token = () => localStorage.getItem('access_token');

  useEffect(() => {
    const fetch2 = async () => {
      const all: OTReq[] = [];
      for (const s of ['checker_approved', 'checker_rejected', 'completed']) {
        const res = await fetch(`/api/ot-requests/?status=${s}`, { headers: { 'Authorization': `Bearer ${token()}` } });
        if (res.ok) { const d = await res.json(); all.push(...(Array.isArray(d) ? d : d.results || [])); }
      }
      setRequests(all.sort((a, b) => b.id - a.id));
      setLoading(false);
    };
    fetch2();
  }, []);

  return (
    <>
      <PageHeader title="ประวัติการตรวจสอบ" />
      <SectionCard>
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-3 text-[var(--neutral-500)]">
            <div className="size-7 border-4 border-tu-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-center text-[var(--neutral-500)] py-10">ยังไม่มีประวัติการตรวจสอบ</p>
        ) : (
          <div className="relative pl-8">
            <div className="absolute left-3 top-2 bottom-2 w-px bg-[var(--neutral-300)]" />
            {requests.map((r, i) => {
              const approved = r.status === 'checker_approved' || r.status === 'completed';
              return (
                <div key={r.id} className="relative mb-5 pl-2">
                  <div className={`absolute -left-8 size-6 rounded-full grid place-items-center ${approved ? 'bg-success' : 'bg-danger'}`}>
                    {approved ? <CheckCircle2 className="size-4 text-white" /> : <X className="size-4 text-white" />}
                  </div>
                  <p className="text-[13px]">
                    <strong>{r.staff_name}</strong> — แผนก{r.department_name} •{' '}
                    <span className={approved ? 'text-success font-semibold' : 'text-danger font-semibold'}>
                      {approved ? 'อนุมัติแล้ว' : 'ตีกลับแล้ว'}
                    </span>
                  </p>
                  <p className="text-[12px] text-[var(--neutral-500)]">
                    วันที่ทำ OT: {r.work_date} • {Math.floor(parseFloat(r.ot_hours || '0'))} ชม. • {fmtAmt(Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60))} บาท
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </>
  );
}

// ─── CheckerBudget ────────────────────────────────────────────────────────────

export function CheckerBudget() {
  const token = () => localStorage.getItem('access_token');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/checker/budget/', { headers: { 'Authorization': `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-60 gap-3 text-[var(--neutral-500)]">
      <div className="size-8 border-4 border-tu-red border-t-transparent rounded-full animate-spin" />
      <span>กำลังโหลด...</span>
    </div>
  );

  const trend: any[]  = data?.trend || [];
  const depts: any[]  = data?.departments || [];
  const noOt: string[] = data?.no_ot_depts || [];
  const totalBudget   = data?.total_budget || 0;
  const totalUsed     = data?.total_used || 0;

  return (
    <>
      <PageHeader title="ติดตามงบประมาณ" />
      {noOt.length > 0 && (
        <div className="flex items-start gap-2 p-3 mb-5 bg-amber-50 border border-amber-300 rounded-xl text-[13px]">
          <span className="text-amber-600 font-semibold">⚠ แผนกที่ยังไม่มี OT เดือนนี้:</span>
          <span className="text-amber-700">{noOt.join(', ')}</span>
        </div>
      )}
      <SectionCard>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
            <TabsTrigger value="dept">รายแผนก</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-5">
            <div className="grid grid-cols-3 gap-4 mb-5">
              <KpiCard label="งบรวมทั้งหมด"    value={totalBudget.toLocaleString()} hint="บาท" accent="blue" />
              <KpiCard label="ใช้ไปแล้ว"       value={totalUsed.toLocaleString()}   hint="บาท" accent="red" />
              <KpiCard label="% ใช้งบ"          value={`${data?.total_pct || 0}%`}              accent="yellow" />
            </div>
            <p className="text-[11px] text-[var(--neutral-500)] mb-3">เปรียบเทียบยอด OT <strong>รายเดือน</strong> (บาท) · 6 เดือนย้อนหลัง</p>
            <div className="h-[300px]"><ResponsiveContainer>
              <BarChart data={trend} margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="m" label={{ value: 'เดือน', position: 'insideBottom', offset: -4, style: { fontSize: 11, fill: '#888' } }} />
                <YAxis tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} label={{ value: 'บาท', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#888' } }} />
                <Tooltip formatter={(v: any) => [Number(v).toLocaleString() + ' บาท', 'ยอด OT']} />
                {totalBudget > 0 && <ReferenceLine y={totalBudget} stroke="#D32F2F" strokeDasharray="5 5" label={{ value: 'เพดาน', fill: '#D32F2F', fontSize: 11 }} />}
                <Bar dataKey="a" fill="#B8001F" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer></div>
          </TabsContent>
          <TabsContent value="dept" className="mt-5 grid grid-cols-2 gap-5">
            {depts.length === 0 ? (
              <p className="col-span-2 text-center py-10 text-[var(--neutral-500)]">ยังไม่มีข้อมูล OT เดือนนี้</p>
            ) : depts.map((b: any) => (
              <div key={b.id} className="border border-[var(--neutral-300)] rounded-xl p-5 bg-white">
                <div className="flex justify-between mb-2">
                  <h3>{b.name}</h3>
                  <span className={`font-bold ${b.pct > 90 ? 'text-danger' : ''}`}>{b.pct}%</span>
                </div>
                <div className="h-3 rounded-full bg-[var(--neutral-100)] mb-2">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(b.pct, 100)}%`, background: b.pct > 90 ? '#D32F2F' : b.pct > 70 ? '#FFD400' : '#0A8A44' }} />
                </div>
                <p className="text-[12px] text-[var(--neutral-500)]">ใช้ {Math.round(b.used).toLocaleString()} / {Math.round(b.budget).toLocaleString()} • คงเหลือ {Math.round(b.remaining).toLocaleString()}</p>
                {b.pct > 90 && <p className="text-[12px] text-danger mt-2 font-semibold">⚠ ใช้งบ {b.pct}%</p>}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </SectionCard>
    </>
  );
}

// ─── CheckerReport ────────────────────────────────────────────────────────────

const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const PERIOD_OPTIONS = [
  { value: 'month',   label: 'รายเดือน' },
  { value: 'quarter', label: 'ไตรมาส' },
  { value: 'half',    label: 'ครึ่งปีงบ' },
  { value: 'year',    label: 'ปีงบประมาณ' },
];

export function CheckerReport() {
  const token = () => localStorage.getItem('access_token');
  const now = new Date();
  // ปีงบประมาณ: ต.ค. ปีก่อน – ก.ย. ปีนี้ → เดือน ต.ค.(m=9) ขึ้นปีงบใหม่
  const curThaiYear = now.getFullYear() + 543 + (now.getMonth() >= 9 ? 1 : 0);
  const _cm = now.getMonth() + 1;
  const curQuarter = _cm >= 10 ? '1' : _cm <= 3 ? '2' : _cm <= 6 ? '3' : '4';

  const [period, setPeriod]   = useState('month');
  const [thaiYear, setThaiYear] = useState(String(curThaiYear));
  const [thaiMonth, setThaiMonth] = useState(String(now.getMonth() + 1).padStart(2,'0'));
  const [quarter, setQuarter] = useState(curQuarter);

  const [requests, setRequests] = useState<any[]>([]);
  const [budgetData, setBudgetData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/ot-requests/', { headers: { 'Authorization': `Bearer ${token()}` } }).then(r => r.json()),
      fetch('/api/checker/budget/', { headers: { 'Authorization': `Bearer ${token()}` } }).then(r => r.json()),
    ]).then(([otData, bd]) => {
      const all: any[] = Array.isArray(otData) ? otData : (otData.results || []);
      setRequests(all.filter(r => ['checker_approved','completed'].includes(r.status)));
      setBudgetData(bd);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // ─── Date filter ──────────────────────────────────────────────────────────
  function inRange(dateStr: string): boolean {
    const d    = new Date(dateStr);
    const y    = d.getFullYear();
    const m    = d.getMonth() + 1;
    const gregYear = parseInt(thaiYear) - 543;

    if (period === 'month') {
      const monthNum = parseInt(thaiMonth);
      // ต.ค.-ธ.ค. อยู่ใน greg ปีก่อนของปีงบ
      const actualGregYear = monthNum >= 10 ? gregYear - 1 : gregYear;
      return y === actualGregYear && m === monthNum;
    } else if (period === 'quarter') {
      const q = parseInt(quarter);
      // ปีงบ: ต.ค.–ก.ย. ไตรมาส 1=ต.ค.–ธ.ค. 2=ม.ค.–มี.ค. 3=เม.ย.–มิ.ย. 4=ก.ค.–ก.ย.
      const Q_MAP: Record<string, { months: number[]; year: number }[]> = {
        '1': [{ months: [10,11,12], year: gregYear - 1 }],
        '2': [{ months: [1,2,3], year: gregYear }],
        '3': [{ months: [4,5,6], year: gregYear }],
        '4': [{ months: [7,8,9], year: gregYear }],
      };
      return (Q_MAP[String(q)] || []).some(({ months, year }) => year === y && months.includes(m));
    } else if (period === 'half') {
      // ครึ่งปีงบแรก: ต.ค.–มี.ค. ครึ่งหลัง: เม.ย.–ก.ย.
      const h1 = (y === gregYear - 1 && m >= 10) || (y === gregYear && m <= 3);
      const h2 = y === gregYear && m >= 4 && m <= 9;
      return quarter === '1' ? h1 : h2;
    } else {
      // ปีงบ ต.ค.(gregYear-1)–ก.ย.(gregYear)
      return (y === gregYear - 1 && m >= 10) || (y === gregYear && m <= 9);
    }
  }

  const filtered = requests.filter(r => inRange(r.work_date));

  // Aggregate by dept
  const deptMap: Record<string, { name: string; a: number }> = {};
  for (const r of filtered) {
    const k = r.department_name || String(r.department);
    if (!deptMap[k]) deptMap[k] = { name: k, a: 0 };
    deptMap[k].a += Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60);
  }
  const chartData = Object.values(deptMap).sort((a, b) => b.a - a.a);
  const totalAmt  = filtered.reduce((s, r) => s + Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60), 0);
  const totalBudget = budgetData?.total_budget || 0;
  const pct = totalBudget > 0 ? Math.round(totalAmt / totalBudget * 100) : 0;
  const COLORS = ['#B8001F', '#FFD400', '#1976D2', '#0A8A44', '#7B1FA2', '#F57C00', '#0097A7'];

  return (
    <>
      <PageHeader title="รายงานภาพรวม" right={
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>{PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={thaiYear} onValueChange={setThaiYear}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[0,1,2].map(d => <SelectItem key={d} value={String(curThaiYear - d)}>ปี {curThaiYear - d}</SelectItem>)}
            </SelectContent>
          </Select>
          {period === 'month' && (
            <Select value={thaiMonth} onValueChange={setThaiMonth}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>{THAI_MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1).padStart(2,'0')}>{m}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {(period === 'quarter' || period === 'half') && (
            <Select value={quarter} onValueChange={setQuarter}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {period === 'quarter'
                  ? ['1','2','3','4'].map(q => <SelectItem key={q} value={q}>ไตรมาส {q}</SelectItem>)
                  : [{ v:'1', l:'ครึ่งแรก (ต.ค.–มี.ค.)' }, { v:'2', l:'ครึ่งหลัง (เม.ย.–ก.ย.)' }].map(h => <SelectItem key={h.v} value={h.v}>{h.l}</SelectItem>)
                }
              </SelectContent>
            </Select>
          )}
        </div>
      } />

      {loading ? (
        <div className="flex items-center justify-center h-60 gap-3 text-[var(--neutral-500)]">
          <div className="size-8 border-4 border-tu-red border-t-transparent rounded-full animate-spin" />
          <span>กำลังโหลด...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-5 mb-5">
            <KpiCard label="รวม OT ทั้งหมด" value={totalAmt >= 1000 ? `${Math.round(totalAmt/1000)}K` : String(Math.round(totalAmt))} hint="บาท" accent="red" />
            <KpiCard label="จำนวนรายการ" value={String(filtered.length)} accent="blue" />
            <KpiCard label="งบประมาณ" value={totalBudget >= 1000 ? `${Math.round(totalBudget/1000)}K` : String(Math.round(totalBudget))} hint="บาท" accent="yellow" />
            <KpiCard label="% ใช้งบ" value={`${pct}%`} accent={pct > 90 ? 'red' : pct > 70 ? 'yellow' : 'green'} />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <SectionCard title="OT แต่ละแผนก">
              <p className="text-[11px] text-[var(--neutral-500)] mb-3">ยอด OT สะสม <strong>ตามช่วงที่เลือก</strong> จำแนกตามแผนก · หน่วย: บาท</p>
              {chartData.length === 0 ? <p className="text-center py-10 text-[var(--neutral-500)]">ไม่มีข้อมูล</p> : (
                <div className="h-[280px]"><ResponsiveContainer>
                  <BarChart data={chartData} margin={{ left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" label={{ value: 'แผนก', position: 'insideBottom', offset: -4, style: { fontSize: 11, fill: '#888' } }} />
                    <YAxis tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} label={{ value: 'บาท', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#888' } }} />
                    <Tooltip formatter={(v: any) => [Number(v).toLocaleString() + ' บาท', 'ยอด OT']} />
                    <Bar dataKey="a" fill="#B8001F" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer></div>
              )}
            </SectionCard>
            <SectionCard title="สัดส่วน OT แต่ละแผนก">
              <p className="text-[11px] text-[var(--neutral-500)] mb-3">สัดส่วนยอดเงิน OT <strong>ตามช่วงที่เลือก</strong> · % คำนวณจากยอดรวมทุกแผนก</p>
              {chartData.length === 0 ? <p className="text-center py-10 text-[var(--neutral-500)]">ไม่มีข้อมูล</p> : (
                <div className="h-[280px]"><ResponsiveContainer>
                  <PieChart>
                    <Pie data={chartData} dataKey="a" nameKey="name" outerRadius={95} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                      {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [Number(v).toLocaleString() + ' บาท', 'ยอด OT']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer></div>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </>
  );
}

// ─── CheckerSetBudget ─────────────────────────────────────────────────────────

export function CheckerSetBudget() {
  const token = () => localStorage.getItem('access_token');
  const h = () => ({ 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' });

  const [depts, setDepts]   = useState<any[]>([]);
  const [budgets, setBudgets] = useState<Record<number, string>>({});
  const [usedMap, setUsedMap] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/departments/', { headers: { 'Authorization': `Bearer ${token()}` } }).then(r => r.json()),
      fetch('/api/checker/budget/', { headers: { 'Authorization': `Bearer ${token()}` } }).then(r => r.json()),
    ]).then(([deptData, budgetData]) => {
      const list = Array.isArray(deptData) ? deptData : (deptData.results || []);
      setDepts(list);
      // initialize budgets from dept.ot_budget
      setBudgets(Object.fromEntries(list.map((d: any) => [d.id, String(d.ot_budget || 0)])));
      // used from budget API
      const um: Record<number, number> = {};
      for (const bd of (budgetData?.departments || [])) {
        um[bd.id] = bd.used;
      }
      setUsedMap(um);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    const payload = depts.map((d: any) => ({ dept_id: d.id, budget: Number(budgets[d.id]) || 0 }));
    await fetch('/api/checker/budget/set/', {
      method: 'POST',
      headers: h(),
      body: JSON.stringify({ budgets: payload }),
    }).catch(() => {});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-60 gap-3 text-[var(--neutral-500)]">
      <div className="size-8 border-4 border-tu-red border-t-transparent rounded-full animate-spin" />
      <span>กำลังโหลด...</span>
    </div>
    );

  return (
    <>
      <PageHeader title="ตั้งงบประมาณ OT รายแผนก" />
      {saved && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-xl border bg-green-50 border-success text-success">
          <CheckCircle2 className="size-4" />บันทึกงบประมาณเรียบร้อยแล้ว
        </div>
      )}
      <SectionCard title="งบประมาณ OT แต่ละแผนก">
        <div className="space-y-3">
          {depts.map((d: any) => {
            const used = usedMap[d.id] || 0;
            const budget = Number(budgets[d.id]) || 0;
            const pct = budget > 0 ? Math.min((used / budget) * 100, 100) : 0;
            return (
              <div key={d.id} className="flex items-center gap-4 p-3 bg-[var(--neutral-50)] rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[13px] truncate">{d.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-2 bg-[var(--neutral-200)] rounded-full overflow-hidden">
                      <div className="h-full bg-tu-red rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] text-[var(--neutral-500)] whitespace-nowrap">
                      {used.toLocaleString()} / {budget.toLocaleString()} บ.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    className="w-28 text-right"
                    value={budgets[d.id] ?? ''}
                    onChange={e => setBudgets(prev => ({ ...prev, [d.id]: e.target.value }))}
                  />
                  <span className="text-[12px] text-[var(--neutral-500)]">บาท</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end mt-4">
          <Button
            className="bg-tu-red hover:bg-tu-red-dark text-white"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'กำลังบันทึก...' : <>บันทึกงบประมาณ</>}
          </Button>
        </div>
      </SectionCard>
    </>
  );
}

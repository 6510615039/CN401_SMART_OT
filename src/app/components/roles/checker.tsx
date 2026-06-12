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
  const totalAmt = groups.reduce((s, g) => s + g.pending.reduce((a, r) => a + Number(r.amount), 0), 0);
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

      <SectionCard title="สถานะการส่งจากตัวแทนแผนก">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-3 text-[var(--neutral-500)]">
            <div className="size-7 border-4 border-tu-red border-t-transparent rounded-full animate-spin" />
            <span>กำลังโหลด...</span>
          </div>
        ) : groups.length === 0 ? (
          <p className="text-center text-[var(--neutral-500)] py-10">ยังไม่มีรายการส่งมาจากตัวแทนแผนก</p>
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
                  const pendingAmt = g.pending.reduce((s, r) => s + Number(r.amount), 0);
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
                          {!hasPending && !isApproved && !isRejected && <StatusChip kind="neutral">ยังไม่ส่ง</StatusChip>}
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
                          <td className="px-3 py-2 text-[12px] font-mono">{r.ot_hours} ชม. • {fmtAmt(r.amount)} ฿</td>
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
              จะตีกลับ {rejectDlg.requests.length} รายการ — ระบบจะแจ้งเตือนพนักงานและหัวหน้าแผนก
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
  const totalAmt = requests.reduce((s, r) => s + Number(r.amount), 0);

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
                    <td className="px-4 py-3 font-mono">{fmtAmt(r.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-tu-red bg-tu-red/5">
                  <td className="px-4 py-3 font-bold text-tu-red" colSpan={4}>รวม</td>
                  <td className="px-4 py-3 font-bold font-mono text-tu-red">{totalHrs.toFixed(1)} ชม.</td>
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
                    วันที่ทำ OT: {r.work_date} • {r.ot_hours} ชม. • {fmtAmt(r.amount)} บาท
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
  const data = [
    { m: 'ม.ค.', a: 95000 }, { m: 'ก.พ.', a: 110000 }, { m: 'มี.ค.', a: 145000 },
    { m: 'เม.ย.', a: 132000 }, { m: 'พ.ค.', a: 335000 },
  ];
  return (
    <>
      <PageHeader title="ติดตามงบประมาณ" />
      <SectionCard>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
            <TabsTrigger value="dept">รายแผนก</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-5">
            <div className="h-[320px]"><ResponsiveContainer>
              <BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="m" /><YAxis /><Tooltip />
                <ReferenceLine y={500000} stroke="#D32F2F" strokeDasharray="5 5" label="เพดาน" />
                <Bar dataKey="a" fill="#B8001F" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer></div>
          </TabsContent>
          <TabsContent value="dept" className="mt-5 grid grid-cols-2 gap-5">
            {[
              { d: 'ทะเบียน', pct: 67, used: 120000, max: 180000 },
              { d: 'หลักสูตร', pct: 78, used: 78000, max: 100000 },
              { d: 'ประเมิน', pct: 92, used: 74000, max: 80000 },
              { d: 'สารสนเทศ', pct: 44, used: 35000, max: 80000 },
              { d: 'การเงิน', pct: 20, used: 12000, max: 60000 },
            ].map(b => (
              <div key={b.d} className="border border-[var(--neutral-300)] rounded-xl p-5 bg-white">
                <div className="flex justify-between mb-2"><h3>{b.d}</h3><span className="font-bold">{b.pct}%</span></div>
                <div className="h-3 rounded-full bg-[var(--neutral-100)] mb-2">
                  <div className="h-full rounded-full" style={{ width: `${b.pct}%`, background: b.pct > 90 ? '#D32F2F' : b.pct > 70 ? '#FFD400' : '#0A8A44' }} />
                </div>
                <p className="text-[12px] text-[var(--neutral-500)]">ใช้ {b.used.toLocaleString()} / {b.max.toLocaleString()} • คงเหลือ {(b.max - b.used).toLocaleString()}</p>
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

export function CheckerReport() {
  const data = [
    { d: 'ทะเบียน', a: 120000 }, { d: 'หลักสูตร', a: 78000 },
    { d: 'ประเมิน', a: 74000 }, { d: 'สารสนเทศ', a: 35000 }, { d: 'การเงิน', a: 12000 },
  ];
  return (
    <>
      <PageHeader title="รายงานภาพรวม" />
      <div className="grid grid-cols-4 gap-5 mb-5">
        <KpiCard label="รวม OT ทั้งหมด" value="319K" accent="red" />
        <KpiCard label="จำนวนรายการ" value="—" accent="blue" />
        <KpiCard label="งบประมาณ" value="500K" accent="yellow" />
        <KpiCard label="% ใช้งบ" value="64%" accent="green" />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <SectionCard title="OT แต่ละแผนก">
          <div className="h-[300px]"><ResponsiveContainer>
            <BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="d" /><YAxis /><Tooltip /><Bar dataKey="a" fill="#B8001F" radius={[6, 6, 0, 0]} /></BarChart>
          </ResponsiveContainer></div>
        </SectionCard>
        <SectionCard title="สัดส่วน OT แต่ละแผนก">
          <div className="h-[300px]"><ResponsiveContainer>
            <PieChart><Pie data={data} dataKey="a" nameKey="d" outerRadius={100} label>
              {data.map((_, i) => <Cell key={i} fill={['#B8001F', '#FFD400', '#1976D2', '#0A8A44', '#7B1FA2'][i]} />)}
            </Pie><Tooltip /><Legend /></PieChart>
          </ResponsiveContainer></div>
        </SectionCard>
      </div>
    </>
  );
}

// ─── CheckerSetBudget ─────────────────────────────────────────────────────────

const DEPTS_BUDGET = [
  { d: 'ทะเบียน', budget: 180000, used: 156000 },
  { d: 'หลักสูตร', budget: 100000, used: 82000 },
  { d: 'ประเมิน', budget: 80000, used: 95000 },
  { d: 'สารสนเทศ', budget: 80000, used: 35000 },
  { d: 'การเงิน', budget: 60000, used: 12000 },
];

export function CheckerSetBudget() {
  const [month, setMonth] = useState('2569-05');
  const [budgets, setBudgets] = useState<Record<string, string>>(
    Object.fromEntries(DEPTS_BUDGET.map(d => [d.d, String(d.budget)]))
  );
  const [saved, setSaved] = useState(false);

  function handleSave() { setSaved(true); setTimeout(() => setSaved(false), 3000); }

  return (
    <>
      <PageHeader title="ตั้งเพดานงบประมาณรายเดือน" right={
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="2569-05">พฤษภาคม 2569</SelectItem>
            <SelectItem value="2569-06">มิถุนายน 2569</SelectItem>
            <SelectItem value="2569-04">เมษายน 2569</SelectItem>
          </SelectContent>
        </Select>
      } />
      {saved && (
        <div className="flex items-center gap-2 p-3 mb-5 bg-green-50 border border-success rounded-xl">
          <CheckCircle2 className="size-5 text-success" />
          <p className="text-success font-semibold">บันทึกเพดานงบประมาณเรียบร้อยแล้ว</p>
        </div>
      )}
      <SectionCard title="งบประมาณ OT แต่ละแผนก">
        <div className="space-y-4">
          {DEPTS_BUDGET.map(dept => {
            const val = Number(budgets[dept.d]) || 0;
            const pct = val > 0 ? Math.round((dept.used / val) * 100) : 0;
            const over = dept.used > val;
            return (
              <div key={dept.d} className={`border rounded-xl p-4 ${over ? 'border-danger bg-tu-red-soft' : 'border-[var(--neutral-300)] bg-white'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-semibold">{dept.d}</span>
                    {over && <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-danger text-white">เกินงบ {(dept.used - val).toLocaleString()} บาท</span>}
                  </div>
                  <div className="text-[12px] text-[var(--neutral-500)]">ใช้ไปแล้ว: <span className="font-semibold">{dept.used.toLocaleString()} บาท</span></div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-[12px] text-[var(--neutral-500)] mb-1 block">เพดานงบประมาณ (บาท)</label>
                    <Input type="number" value={budgets[dept.d]} onChange={e => setBudgets(s => ({ ...s, [dept.d]: e.target.value }))} className={over ? 'border-danger' : ''} />
                  </div>
                  <div className="flex-1">
                    <label className="text-[12px] text-[var(--neutral-500)] mb-1 block">% การใช้งาน</label>
                    <div className="h-9 flex items-center gap-3">
                      <div className="flex-1 h-3 rounded-full bg-[var(--neutral-100)]">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: over ? '#D32F2F' : pct > 80 ? '#FFD400' : '#0A8A44' }} />
                      </div>
                      <span className={`text-[13px] font-bold w-10 text-right ${over ? 'text-danger' : ''}`}>{pct}%</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-6 pt-4 border-t border-[var(--neutral-300)] flex items-center justify-between">
          <p className="text-[13px] text-[var(--neutral-500)]">
            งบรวมทุกแผนก: <strong>{Object.values(budgets).reduce((s, v) => s + (Number(v) || 0), 0).toLocaleString()} บาท</strong>
          </p>
          <Button onClick={handleSave} className="bg-tu-red hover:bg-tu-red-dark text-white px-8">
            <CheckCircle2 className="size-4 mr-2" />บันทึกเพดานงบประมาณ
          </Button>
        </div>
      </SectionCard>
    </>
  );
}

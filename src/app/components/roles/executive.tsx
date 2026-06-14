import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, TrendingUp, ArrowUp, ArrowDown, RefreshCw,
} from 'lucide-react';
import { NavItem } from '../AppShell';
import { KpiCard, PageHeader, SectionCard } from '../shared';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';

export const EXEC_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
  { key: 'trend',     label: 'แนวโน้ม',   icon: <TrendingUp /> },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const token = () => localStorage.getItem('access_token') || '';
const headers = () => ({ Authorization: `Bearer ${token()}` });

const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const THAI_MONTHS_FULL  = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

/** "2026-05" → "พ.ค. 2569" */
function gregToThaiShort(ym: string) {
  const [y, m] = ym.split('-');
  return `${THAI_MONTHS_SHORT[parseInt(m) - 1]} ${parseInt(y) + 543}`;
}
/** "2026-05" → "พฤษภาคม 2569" */
function gregToThaiFull(ym: string) {
  const [y, m] = ym.split('-');
  return `${THAI_MONTHS_FULL[parseInt(m) - 1]} ${parseInt(y) + 543}`;
}

/** last N Gregorian months as "YYYY-MM" strings, newest first */
function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

type OTReq = {
  id: number;
  staff: number;
  staff_name: string;
  department: number;
  department_name: string;
  work_date: string;
  day_type: string;
  ot_hours: string;
  amount: string;
  status: string;
};

type DeptStat = {
  id: number;
  name: string;
  amount: number;
  hours: number;
  count: number;
  staffCount: number;
};

const COLORS = ['#B8001F', '#FFD400', '#1976D2', '#0A8A44', '#7B1FA2', '#FF6F00', '#00838F', '#558B2F'];

/** Fetch approved+completed OT requests for a given Gregorian month */
async function fetchOTForMonth(month: string): Promise<OTReq[]> {
  const all: OTReq[] = [];
  for (const s of ['checker_approved', 'completed', 'rep_forwarded']) {
    const res = await fetch(`/api/ot-requests/?status=${s}&month=${month}`, { headers: headers() });
    if (res.ok) {
      const d = await res.json();
      all.push(...(Array.isArray(d) ? d : (d.results || [])));
    }
  }
  return all;
}

function aggregateByDept(reqs: OTReq[]): DeptStat[] {
  const map = new Map<number, DeptStat>();
  const staffSets = new Map<number, Set<number>>();
  for (const r of reqs) {
    if (!map.has(r.department)) {
      map.set(r.department, { id: r.department, name: r.department_name, amount: 0, hours: 0, count: 0, staffCount: 0 });
      staffSets.set(r.department, new Set());
    }
    const g = map.get(r.department)!;
    g.amount += Number(r.amount);
    g.hours  += Number(r.ot_hours);
    g.count  += 1;
    staffSets.get(r.department)!.add(r.staff);
  }
  for (const [id, s] of staffSets) map.get(id)!.staffCount = s.size;
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}

// ─── ExecDashboard ────────────────────────────────────────────────────────────

export function ExecDashboard() {
  const months = lastNMonths(12);
  const [month, setMonth] = useState(months[0]);
  const [prevMonth] = useState(months[1]);
  const [reqs, setReqs]       = useState<OTReq[]>([]);
  const [prevReqs, setPrevReqs] = useState<OTReq[]>([]);
  const [totalStaff, setTotalStaff] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cur, prev, usersRes] = await Promise.all([
        fetchOTForMonth(month),
        fetchOTForMonth(prevMonth),
        fetch('/api/users/?is_active=true', { headers: headers() }).then(r => r.ok ? r.json() : null),
      ]);
      setReqs(cur);
      setPrevReqs(prev);
      if (usersRes) {
        const arr = Array.isArray(usersRes) ? usersRes : (usersRes.results || []);
        setTotalStaff(arr.filter((u: any) => u.role === 'staff').length);
      }
      setLastUpdated(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
    } catch {}
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const depts   = aggregateByDept(reqs);
  const totalAmt = reqs.reduce((s, r) => s + Number(r.amount), 0);
  const prevAmt  = prevReqs.reduce((s, r) => s + Number(r.amount), 0);
  const diffPct  = prevAmt > 0 ? ((totalAmt - prevAmt) / prevAmt * 100) : 0;
  const staffWithOT = new Set(reqs.map(r => r.staff)).size;
  const totalHrs = reqs.reduce((s, r) => s + Number(r.ot_hours), 0);
  const chartData = depts.slice(0, 8).map(d => ({ d: d.name, a: Math.round(d.amount) }));

  return (
    <>
      <PageHeader title="Executive Dashboard" right={
        <div className="flex items-center gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="เลือกเดือน" /></SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m} value={m}>{gregToThaiShort(m)}</SelectItem>)}
            </SelectContent>
          </Select>
          <button onClick={load} disabled={loading}
            className="p-2 rounded-lg border border-[var(--neutral-300)] hover:bg-[var(--neutral-50)]">
            <RefreshCw className={`size-4 text-[var(--neutral-500)] ${loading ? 'animate-spin' : ''}`} />
          </button>
          {lastUpdated && (
            <span className="text-[12px] px-2 py-1 rounded-full bg-tu-yellow-soft text-[var(--warning)] font-semibold">
              อัปเดต {lastUpdated} น.
            </span>
          )}
        </div>
      } />

      {loading ? (
        <div className="flex items-center justify-center h-60 gap-3 text-[var(--neutral-500)]">
          <div className="size-8 border-4 border-tu-red border-t-transparent rounded-full animate-spin" />
          <span>กำลังโหลดข้อมูล...</span>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-5 mb-6">
            <div className="bg-tu-red text-white rounded-xl p-5 h-[140px] flex flex-col justify-between">
              <p className="text-[12px] opacity-80">รวมค่า OT {gregToThaiShort(month)}</p>
              <p className="text-[32px] font-bold tabular-nums">{Math.round(totalAmt).toLocaleString()}</p>
              <p className="text-[12px] opacity-80">บาท • {reqs.length} รายการ</p>
            </div>

            <div className="bg-white rounded-xl p-5 h-[140px] border border-[var(--neutral-300)] flex flex-col justify-between">
              <p className="text-[12px] text-[var(--neutral-500)]">เทียบเดือนก่อน</p>
              {prevAmt > 0 ? (
                <>
                  <p className={`text-[28px] font-bold flex items-center gap-1 tabular-nums ${diffPct >= 0 ? 'text-danger' : 'text-success'}`}>
                    {diffPct >= 0 ? <ArrowUp className="size-5" /> : <ArrowDown className="size-5" />}
                    {Math.abs(diffPct).toFixed(1)}%
                  </p>
                  <p className="text-[12px] text-[var(--neutral-500)]">
                    {diffPct >= 0 ? 'เพิ่มขึ้น' : 'ลดลง'} {Math.abs(Math.round(totalAmt - prevAmt)).toLocaleString()} บาท
                  </p>
                </>
              ) : (
                <p className="text-[24px] font-bold text-[var(--neutral-400)]">—</p>
              )}
            </div>

            <div className="bg-white rounded-xl p-5 h-[140px] border border-[var(--neutral-300)] flex flex-col justify-between">
              <p className="text-[12px] text-[var(--neutral-500)]">รวมชั่วโมง OT</p>
              <p className="text-[28px] font-bold text-tu-red tabular-nums">{Math.floor(totalHrs)}</p>
              <p className="text-[12px] text-[var(--neutral-500)]">ชั่วโมง • {depts.length} แผนก</p>
            </div>

            <div className="bg-tu-yellow text-black rounded-xl p-5 h-[140px] flex flex-col justify-between">
              <p className="text-[12px]">พนักงานที่ทำ OT</p>
              <p className="text-[32px] font-bold tabular-nums">{staffWithOT}</p>
              <p className="text-[12px]">{totalStaff != null ? `จาก ${totalStaff} คน` : 'คน'}</p>
            </div>
          </div>

          {/* Charts */}
          {depts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-[var(--neutral-500)] bg-white rounded-xl border border-[var(--neutral-300)]">
              <p className="font-semibold">ยังไม่มีข้อมูล OT ที่ผ่านการตรวจสอบในเดือนนี้</p>
              <p className="text-[12px]">ข้อมูลจะแสดงเมื่อ Checker อนุมัติคำร้อง</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-5 mb-6">
                <SectionCard title={`OT แต่ละแผนก — ${gregToThaiShort(month)}`}>
                  <div className="h-[260px]">
                    <ResponsiveContainer>
                      <BarChart data={chartData} margin={{ bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="d" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" interval={0} />
                        <YAxis tickFormatter={v => (v / 1000).toFixed(0) + 'k'} />
                        <Tooltip formatter={(v: any) => [Math.round(v).toLocaleString() + ' บาท', 'ค่า OT']} />
                        <Bar dataKey="a" name="ค่า OT" radius={[4, 4, 0, 0]}>
                          {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </SectionCard>

                <SectionCard title="สัดส่วนค่า OT แต่ละแผนก">
                  <div className="h-[260px]">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={chartData} dataKey="a" nameKey="d" innerRadius={50} outerRadius={90}>
                          {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => [Math.round(Number(v)).toLocaleString() + ' บาท', 'ค่า OT']} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </SectionCard>

                <SectionCard title="Top 5 แผนกค่า OT สูงสุด">
                  <div className="space-y-3">
                    {depts.slice(0, 5).map((d, i) => {
                      const max = depts[0].amount;
                      const pct = max > 0 ? (d.amount / max) * 100 : 0;
                      return (
                        <div key={d.id}>
                          <div className="flex justify-between text-[13px] mb-1">
                            <span className="font-medium">{i + 1}. {d.name}</span>
                            <span className="font-mono text-[var(--neutral-500)]">{d.amount.toLocaleString()} บ.</span>
                          </div>
                          <div className="h-2 bg-[var(--neutral-200)] rounded-full overflow-hidden">
                            <div className="h-full bg-tu-red rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

export function ExecTrend() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const token = () => localStorage.getItem('access_token');

  useEffect(() => {
    fetch('/api/ot-requests/', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => {
        setRequests(Array.isArray(d) ? d : (d.results || []));
        setLastUpdated(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const months = lastNMonths(6);
  const byMonth = months.map(ym => {
    const reqs = requests.filter(r => r.work_date?.startsWith(ym));
    const hrs   = reqs.reduce((s, r) => s + Math.floor(parseFloat(r.ot_hours || '0')), 0);
    const amt   = reqs.reduce((s, r) => s + Math.floor(parseFloat(r.ot_hours || '0')) * (r.day_type === 'holiday' ? 70 : 60), 0);
    return { month: gregToThaiShort(ym), hrs, amt, count: reqs.length };
  });

  return (
    <>
      <PageHeader title="แนวโน้ม OT" subtitle={lastUpdated ? `อัปเดตล่าสุด ${lastUpdated}` : ''} />
      {loading ? (
        <p className="text-center py-10">กำลังโหลด...</p>
      ) : (
        <div className="grid grid-cols-2 gap-5">
          <SectionCard title="ชั่วโมง OT รายเดือน">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byMonth} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${v} ชม.`, 'ชั่วโมง OT']} />
                <Bar dataKey="hrs" fill="var(--tu-red)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
          <SectionCard title="ยอดเงิน OT รายเดือน">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byMonth} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${v.toLocaleString()} บ.`, 'ยอดเงิน']} />
                <Bar dataKey="amt" fill="#f59e0b" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>
      )}
    </>
  );
}

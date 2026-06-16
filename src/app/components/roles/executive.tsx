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
              <p className="text-[28px] font-bold text-tu-red tabular-nums">{totalHrs.toFixed(1)}</p>
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
                            <span className="font-mono font-semibold">{Math.round(d.amount).toLocaleString()} ฿</span>
                          </div>
                          <div className="h-2 rounded-full bg-[var(--neutral-100)]">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                          </div>
                          <p className="text-[11px] text-[var(--neutral-500)] mt-0.5">{d.staffCount} คน • {d.hours.toFixed(1)} ชม.</p>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              </div>

              {/* Dept status table */}
              <SectionCard title="รายละเอียดแต่ละแผนก">
                <div className="overflow-x-auto rounded-lg border border-[var(--neutral-300)]">
                  <table className="w-full text-[13px]">
                    <thead className="bg-tu-red text-white">
                      <tr>{['แผนก', 'ค่า OT รวม', 'ชั่วโมงรวม', 'จำนวนคน', 'จำนวนรายการ', 'เฉลี่ย/คน'].map(h => (
                        <th key={h} className="text-left px-4 py-3">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {depts.map((d, i) => (
                        <tr key={d.id} className="border-t border-[var(--neutral-300)] hover:bg-[var(--neutral-50)]">
                          <td className="px-4 py-3 font-semibold flex items-center gap-2">
                            <span className="size-3 rounded-full inline-block" style={{ background: COLORS[i % COLORS.length] }} />
                            {d.name}
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-tu-red">{Math.round(d.amount).toLocaleString()}</td>
                          <td className="px-4 py-3 font-mono">{d.hours.toFixed(1)}</td>
                          <td className="px-4 py-3 font-mono">{d.staffCount}</td>
                          <td className="px-4 py-3 font-mono">{d.count}</td>
                          <td className="px-4 py-3 font-mono">{d.staffCount > 0 ? Math.round(d.amount / d.staffCount).toLocaleString() : '—'}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-tu-red bg-[var(--neutral-50)] font-bold">
                        <td className="px-4 py-3">รวมทั้งหมด</td>
                        <td className="px-4 py-3 font-mono text-tu-red">{Math.round(totalAmt).toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono">{totalHrs.toFixed(1)}</td>
                        <td className="px-4 py-3 font-mono">{staffWithOT}</td>
                        <td className="px-4 py-3 font-mono">{reqs.length}</td>
                        <td className="px-4 py-3 font-mono">{staffWithOT > 0 ? Math.round(totalAmt / staffWithOT).toLocaleString() : '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </>
          )}
        </>
      )}
    </>
  );
}

// ─── ExecTrend ────────────────────────────────────────────────────────────────

export function ExecTrend() {
  const [range, setRange] = useState('6');
  const [trendData, setTrendData] = useState<any[]>([]);
  const [deptNames, setDeptNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<{ title: string; detail: string; kind: 'danger' | 'warning' | 'success' }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const n = parseInt(range);
      const months = lastNMonths(n).reverse(); // oldest first for chart
      const allData: Record<string, Record<string, number>> = {}; // month → dept → amount
      const deptSet = new Set<string>();

      for (const m of months) {
        const reqs = await fetchOTForMonth(m);
        allData[m] = {};
        for (const r of reqs) {
          const dname = r.department_name || 'ไม่ระบุ';
          deptSet.add(dname);
          allData[m][dname] = (allData[m][dname] || 0) + Number(r.amount);
        }
      }

      const depts = Array.from(deptSet).slice(0, 6);
      setDeptNames(depts);

      const rows = months.map(m => {
        const row: any = { m: gregToThaiShort(m), total: 0 };
        for (const d of depts) {
          row[d] = Math.round(allData[m][d] || 0);
          row.total += row[d];
        }
        return row;
      });
      setTrendData(rows);

      // Build insights
      const ins: typeof insights = [];
      if (rows.length >= 2) {
        const last = rows[rows.length - 1];
        const prev = rows[rows.length - 2];
        const diff = last.total - prev.total;
        if (diff > 0) ins.push({ title: `ค่า OT เดือนล่าสุดเพิ่มขึ้น`, detail: `+${Math.round(diff).toLocaleString()} บาท จากเดือนก่อน`, kind: 'warning' });
        else if (diff < 0) ins.push({ title: `ค่า OT เดือนล่าสุดลดลง`, detail: `${Math.round(diff).toLocaleString()} บาท จากเดือนก่อน`, kind: 'success' });

        // find fastest growing dept
        if (depts.length > 0) {
          let maxGrowth = -Infinity, maxDept = '';
          for (const d of depts) {
            const g = (last[d] || 0) - (prev[d] || 0);
            if (g > maxGrowth) { maxGrowth = g; maxDept = d; }
          }
          if (maxDept && maxGrowth > 0) ins.push({ title: `แผนก${maxDept} OT เพิ่มสูงสุด`, detail: `+${Math.round(maxGrowth).toLocaleString()} บาท เดือนล่าสุด`, kind: 'warning' });

          // find lowest spending dept
          let minAmt = Infinity, minDept = '';
          for (const d of depts) { if ((last[d] || 0) < minAmt) { minAmt = last[d] || 0; minDept = d; } }
          if (minDept) ins.push({ title: `แผนก${minDept} OT ต่ำสุด`, detail: `${Math.round(minAmt).toLocaleString()} บาท เดือนล่าสุด`, kind: 'success' });
        }
      }
      if (ins.length === 0) ins.push({ title: 'ยังไม่มีข้อมูลเพียงพอ', detail: 'เพิ่มข้อมูล OT ที่ผ่านการอนุมัติเพื่อดูการวิเคราะห์', kind: 'success' });
      setInsights(ins);
    } catch {}
    setLoading(false);
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const totalRow = trendData.length > 0 ? trendData[trendData.length - 1] : null;

  return (
    <>
      <PageHeader title="วิเคราะห์แนวโน้ม OT" right={
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[['3','3 เดือนล่าสุด'],['6','6 เดือนล่าสุด'],['12','12 เดือนล่าสุด']].map(([v,l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button onClick={load} disabled={loading}
            className="p-2 rounded-lg border border-[var(--neutral-300)] hover:bg-[var(--neutral-50)]">
            <RefreshCw className={`size-4 text-[var(--neutral-500)] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      } />

      {loading ? (
        <div className="flex items-center justify-center h-60 gap-3 text-[var(--neutral-500)]">
          <div className="size-8 border-4 border-tu-red border-t-transparent rounded-full animate-spin" />
          <span>กำลังโหลดข้อมูลแนวโน้ม...</span>
        </div>
      ) : trendData.length === 0 || trendData.every(r => r.total === 0) ? (
        <div className="flex flex-col items-center justify-center h-60 gap-2 text-[var(--neutral-500)] bg-white rounded-xl border border-[var(--neutral-300)]">
          <p className="font-semibold">ยังไม่มีข้อมูลในช่วงนี้</p>
          <p className="text-[12px]">ข้อมูลจะแสดงเมื่อมีคำร้อง OT ที่ผ่านการอนุมัติจาก Checker</p>
        </div>
      ) : (
        <>
          {/* KPI summary row */}
          {totalRow && (
            <div className="grid grid-cols-3 gap-5 mb-5">
              <KpiCard label={`ค่า OT เดือนล่าสุด`} value={`${Math.round(totalRow.total).toLocaleString()} ฿`} accent="red" />
              <KpiCard label="ค่า OT เฉลี่ย/เดือน"
                value={`${Math.round(trendData.reduce((s, r) => s + r.total, 0) / trendData.length).toLocaleString()} ฿`}
                accent="blue" />
              <KpiCard label="จำนวนแผนกที่มี OT"
                value={`${deptNames.filter(d => (totalRow[d] || 0) > 0).length} แผนก`}
                accent="yellow" />
            </div>
          )}

          <div className="grid grid-cols-[2fr_1fr] gap-5">
            {/* Trend chart */}
            <SectionCard title={`แนวโน้มค่า OT ${range} เดือนล่าสุด`}>
              <div className="h-[380px]">
                <ResponsiveContainer>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="m" />
                    <YAxis tickFormatter={v => (v / 1000).toFixed(0) + 'k'} />
                    <Tooltip formatter={(v: any, name: any) => [Math.round(v).toLocaleString() + ' บาท', name]} />
                    <Legend />
                    {deptNames.map((d, i) => (
                      <Line key={d} type="monotone" dataKey={d}
                        stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 4 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            {/* Insights panel */}
            <div className="space-y-4">
              <SectionCard title="Insights">
                <div className="space-y-3">
                  {insights.map((c, i) => (
                    <div key={i} className={`p-4 rounded-xl border ${
                      c.kind === 'danger' ? 'bg-tu-red-soft border-tu-red' :
                      c.kind === 'warning' ? 'bg-tu-yellow-soft border-tu-yellow' :
                      'bg-green-50 border-success'
                    }`}>
                      <p className="font-semibold text-[13px] mb-1">{c.title}</p>
                      <p className="text-[12px] text-[var(--neutral-700)]">{c.detail}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Monthly total table */}
              <SectionCard title="ยอดรวมรายเดือน">
                <div className="space-y-2">
                  {[...trendData].reverse().slice(0, 6).map((r, i) => (
                    <div key={i} className="flex justify-between items-center py-1 border-b border-[var(--neutral-200)] last:border-0 text-[13px]">
                      <span className="text-[var(--neutral-600)]">{r.m}</span>
                      <span className="font-mono font-semibold">{Math.round(r.total).toLocaleString()} ฿</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>

          {/* Stacked bar for dept breakdown */}
          <SectionCard title="สัดส่วนค่า OT แต่ละแผนกรายเดือน" className="mt-5">
            <div className="h-[280px]">
              <ResponsiveContainer>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="m" />
                  <YAxis tickFormatter={v => (v / 1000).toFixed(0) + 'k'} />
                  <Tooltip formatter={(v: any, nam
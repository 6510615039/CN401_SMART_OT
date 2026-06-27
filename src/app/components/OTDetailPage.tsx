import { useState, useEffect } from 'react';
import {
  ArrowLeft, CheckCircle2, Clock, AlertTriangle, X,
} from 'lucide-react';
import { Button } from './ui/button';
import { StatusChip, fmtDate, fmtDateTime } from './shared';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

interface Props {
  onBack: () => void;
  requestId?: string | number | null;
}

const STEP_LABELS = [
  { label: 'เธขเธทเนเธเธเธณเธเธญ',            role: 'เธเธเธฑเธเธเธฒเธ' },
  { label: 'เธซเธฑเธงเธซเธเนเธฒเธเธฒเธเธญเธเธธเธกเธฑเธ•เธด',   role: 'เธซเธฑเธงเธซเธเนเธฒเธเธฒเธ' },
  { label: 'เธ•เธฑเธงเนเธ—เธเธเนเธฒเธขเธชเนเธเน€เธฃเธทเนเธญเธ', role: 'เธ•เธฑเธงเนเธ—เธเธเนเธฒเธข' },
  { label: 'เธเธนเนเธ•เธฃเธงเธเธชเธญเธเธญเธเธธเธกเธฑเธ•เธด',  role: 'เธเธนเนเธ•เธฃเธงเธเธชเธญเธ' },
];

const STATUS_STEP: Record<string, number> = {
  submitted: 0, head_approved: 1, head_rejected: 1,
  rep_forwarded: 2, checker_approved: 3, checker_rejected: 3, completed: 3,
};

const STATUS_THAI: Record<string, string> = {
  submitted: 'เธฃเธญเธญเธเธธเธกเธฑเธ•เธด', head_approved: 'เธซเธฑเธงเธซเธเนเธฒเธญเธเธธเธกเธฑเธ•เธดเนเธฅเนเธง', head_rejected: 'เธซเธฑเธงเธซเธเนเธฒเธ•เธตเธเธฅเธฑเธ',
  rep_forwarded: 'เธชเนเธเธ•เนเธญเนเธฅเนเธง', checker_approved: 'เธญเธเธธเธกเธฑเธ•เธดเนเธฅเนเธง', checker_rejected: 'เธ–เธนเธเธเธเธดเน€เธชเธ', completed: 'เน€เธชเธฃเนเธเธชเธดเนเธ',
};

function thaiDate(dateStr: string) {
  if (!dateStr) return '-';
  const MONTHS = ['เธกเธเธฃเธฒเธเธก','เธเธธเธกเธ เธฒเธเธฑเธเธเน','เธกเธตเธเธฒเธเธก','เน€เธกเธฉเธฒเธขเธ','เธเธคเธฉเธ เธฒเธเธก','เธกเธดเธ–เธธเธเธฒเธขเธ','เธเธฃเธเธเธฒเธเธก','เธชเธดเธเธซเธฒเธเธก','เธเธฑเธเธขเธฒเธขเธ','เธ•เธธเธฅเธฒเธเธก','เธเธคเธจเธเธดเธเธฒเธขเธ','เธเธฑเธเธงเธฒเธเธก'];
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export function OTDetailPage({ onBack, requestId }: Props) {
  const [req, setReq] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionDone, setActionDone] = useState<'approved' | 'rejected' | null>(null);

  useEffect(() => {
    if (!requestId) { setLoading(false); return; }
    const token = localStorage.getItem('access_token');
    fetch(`/api/ot-requests/${requestId}/`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setReq(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [requestId]);

  if (loading) return (
    <div className="flex items-center justify-center h-60 gap-3 text-[var(--neutral-500)]">
      <div className="size-8 border-4 border-tu-red border-t-transparent rounded-full animate-spin"/>
      <span>เธเธณเธฅเธฑเธเนเธซเธฅเธ”...</span>
    </div>
  );

  if (!req) return (
    <div className="flex flex-col items-center justify-center h-60 gap-4">
      <p className="text-[var(--neutral-500)]">เนเธกเนเธเธเธเนเธญเธกเธนเธฅเธเธณเธฃเนเธญเธ</p>
      <Button onClick={onBack} variant="outline">โ เธเธฅเธฑเธ</Button>
    </div>
  );

  const isRejected = req.status === 'head_rejected' || req.status === 'checker_rejected';
  const isApproved = req.status === 'checker_approved' || req.status === 'completed';
  const completedStep = STATUS_STEP[req.status] ?? 0;
  const rate = req.day_type === 'holiday' ? 70 : 60;
  const ot_hours = parseFloat(req.ot_hours || 0);
  const amount = parseFloat(req.amount || 0);

  if (actionDone) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        {actionDone === 'approved' ? (
          <><CheckCircle2 className="size-16 text-success" /><h2 className="text-success">เธญเธเธธเธกเธฑเธ•เธดเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง</h2></>
        ) : (
          <><X className="size-16 text-danger" /><h2 className="text-danger">เธเธเธดเน€เธชเธเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง</h2><p className="text-[var(--neutral-500)]">เน€เธซเธ•เธธเธเธฅ: {rejectReason}</p></>
        )}
        <Button className="bg-tu-red text-white mt-4" onClick={onBack}>โ เธเธฅเธฑเธเธฃเธฒเธขเธเธฒเธฃ</Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={onBack}><ArrowLeft className="size-4" />เธเธฅเธฑเธ</Button>
          <h1>เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธเธณเธเธญ OT</h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusChip kind={isRejected ? 'danger' : isApproved ? 'success' : 'warning'}>
            {STATUS_THAI[req.status] || req.status}
          </StatusChip>
          {isRejected && <Button variant="outline" onClick={onBack}>เนเธเนเนเธ</Button>}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_380px] gap-5 pb-20">
        <div className="space-y-5">
          {/* Requester info */}
          <div className="bg-white rounded-xl border border-[var(--neutral-300)] shadow-[0_1px_2px_rgba(0,0,0,0.06)] p-6">
            <h3 className="mb-4 pb-3 border-b border-[var(--neutral-300)]">เธเนเธญเธกเธนเธฅเธเธนเนเธขเธทเนเธเธเธณเธเธญ</h3>
            <div className="grid grid-cols-2 gap-4 text-[13px]">
              {[
                ['เธเธทเนเธญ-เธเธฒเธกเธชเธเธธเธฅ', req.staff_name || 'โ€”'],
                ['เนเธเธเธ', req.department_name || 'โ€”'],
                ['เธเธฃเธฐเน€เธ เธ—เธงเธฑเธ', req.day_type === 'holiday' ? 'เธงเธฑเธเธซเธขเธธเธ”' : 'เธงเธฑเธเธเธฃเธฃเธกเธ”เธฒ'],
                ['เธงเธฑเธเธ—เธตเนเธขเธทเนเธ', req.created_at ? fmtDateTime(req.created_at) : 'โ€”'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[var(--neutral-500)] text-[11px] mb-0.5">{k}</p>
                  <p className="font-semibold">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* OT detail */}
          <div className="bg-white rounded-xl border border-[var(--neutral-300)] shadow-[0_1px_2px_rgba(0,0,0,0.06)] p-6">
            <h3 className="mb-4 pb-3 border-b border-[var(--neutral-300)]">เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธเธฒเธฃเธเธเธดเธเธฑเธ•เธดเธเธฒเธ OT</h3>
            <div className="grid grid-cols-2 gap-4 text-[13px] mb-4">
              {[
                ['เธงเธฑเธเธ—เธตเนเธเธเธดเธเธฑเธ•เธดเธเธฒเธ', fmtDate(req.work_date)],
                ['เน€เธงเธฅเธฒ', `${req.start_time || '-'} โ€“ ${req.end_time || '-'} เธ.`],
                ['เธเธณเธเธงเธเธเธฑเนเธงเนเธกเธ', `${Math.floor(ot_hours)} เธเธฑเนเธงเนเธกเธ`],
                ['เธชเธ–เธฒเธเธ—เธตเน', req.location || 'โ€”'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[var(--neutral-500)] text-[11px] mb-0.5">{k}</p>
                  <p className="font-semibold">{v}</p>
                </div>
              ))}
            </div>
            {req.work_detail && (
              <div>
                <p className="text-[var(--neutral-500)] text-[11px] mb-1">เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธเธฒเธ</p>
                <div className="bg-[var(--neutral-50)] rounded-lg border border-[var(--neutral-300)] p-3 text-[13px] leading-relaxed">{req.work_detail}</div>
              </div>
            )}
          </div>

          {/* Calculation */}
          <div className="bg-white rounded-xl border border-[var(--neutral-300)] shadow-[0_1px_2px_rgba(0,0,0,0.06)] p-6">
            <h3 className="mb-4 pb-3 border-b border-[var(--neutral-300)]">เธเธฒเธฃเธเธณเธเธงเธ“เธเนเธฒเธ•เธญเธเนเธ—เธ</h3>
            <div className="overflow-x-auto rounded-lg border border-[var(--neutral-300)]">
              <table className="w-full text-[13px]">
                <thead className="bg-[var(--neutral-100)]">
                  <tr>{['เธเธฃเธฐเน€เธ เธ—','เธเธฑเนเธงเนเธกเธ','เธญเธฑเธ•เธฃเธฒ/เธเธก.','เธฃเธงเธก'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[var(--neutral-700)]">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  <tr className="border-t border-[var(--neutral-300)]">
                    <td className="px-4 py-2.5">{req.day_type === 'holiday' ? 'เธงเธฑเธเธซเธขเธธเธ”' : 'เธงเธฑเธเธเธฃเธฃเธกเธ”เธฒ'}</td>
                    <td className="px-4 py-2.5 font-mono">{Math.floor(ot_hours)}</td>
                    <td className="px-4 py-2.5 font-mono">{rate} เธเธฒเธ—/เธเธก.</td>
                    <td className="px-4 py-2.5 font-mono">{(Math.floor(ot_hours) * rate).toLocaleString()}</td>
                  </tr>
                  <tr className="border-t-2 border-[var(--neutral-400)] bg-tu-red-soft">
                    <td className="px-4 py-3 font-bold" colSpan={3}>เธฃเธงเธกเธเนเธฒเธ•เธญเธเนเธ—เธเธ—เธฑเนเธเธชเธดเนเธ</td>
                    <td className="px-4 py-3 font-bold text-tu-red text-[16px] font-mono">{Math.round(amount).toLocaleString()} เธเธฒเธ—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Approval timeline */}
          <div className="bg-white rounded-xl border border-[var(--neutral-300)] shadow-[0_1px_2px_rgba(0,0,0,0.06)] p-6">
            <h3 className="mb-5 pb-3 border-b border-[var(--neutral-300)]">เธชเธ–เธฒเธเธฐเธเธฒเธฃเธญเธเธธเธกเธฑเธ•เธด</h3>
            <div className="relative pl-8">
              <div className="absolute left-3.5 top-3 bottom-3 w-px bg-[var(--neutral-300)]" />
              {STEP_LABELS.map((s, i) => {
                const isDone = i < completedStep || (i === completedStep && isApproved);
                const isRejStep = isRejected && i === completedStep;
                const isCurrent = !isRejected && !isApproved && i === completedStep;
                return (
                  <div key={i} className="relative mb-5 last:mb-0">
                    <div className={`absolute -left-8 size-7 rounded-full grid place-items-center border-2 ${
                      isRejStep ? 'bg-danger border-danger' :
                      isDone ? 'bg-success border-success' :
                      isCurrent ? 'bg-tu-yellow border-tu-yellow' :
                      'bg-white border-[var(--neutral-300)]'
                    }`}>
                      {isRejStep ? <X className="size-3.5 text-white" /> :
                       isDone ? <CheckCircle2 className="size-3.5 text-white" /> :
                       <Clock className="size-3.5 text-[var(--neutral-400)]" />}
                    </div>
                    <p className={`font-semibold text-[13px] ${isDone || isCurrent || isRejStep ? '' : 'text-[var(--neutral-400)]'}`}>
                      เธเธฑเนเธเธ—เธตเน {i + 1}: {s.label}
                    </p>
                    <p className="text-[11px] text-[var(--neutral-500)] mt-0.5">{s.role}</p>
                    {isCurrent && <p className="text-[11px] text-[var(--warning)] mt-0.5">เธเธณเธฅเธฑเธเธฃเธญเธ”เธณเน€เธเธดเธเธเธฒเธฃ</p>}
                    {isRejStep && <p className="text-[11px] text-danger mt-0.5">เธ–เธนเธเธ•เธตเธเธฅเธฑเธ</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rejection reason */}
          {isRejected && (req.head_note || req.checker_note) && (
            <div className="bg-tu-yellow-soft border border-tu-yellow rounded-xl p-5">
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle className="size-4 text-[var(--warning)] mt-0.5 shrink-0" />
                <p className="font-semibold text-[13px]">เน€เธซเธ•เธธเธเธฅเธ—เธตเนเธ–เธนเธเธ•เธตเธเธฅเธฑเธ</p>
              </div>
              <p className="text-[13px] text-[var(--neutral-700)]">{req.head_note || req.checker_note}</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader><DialogTitle>เธเธเธดเน€เธชเธเธเธณเธเธญ OT</DialogTitle></DialogHeader>
          <div>
            <label className="font-medium block mb-1">เน€เธซเธ•เธธเธเธฅเธเธฒเธฃเธเธเธดเน€เธชเธ *</label>
            <Textarea rows={4} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="เธฃเธฐเธเธธเน€เธซเธ•เธธเธเธฅเนเธซเนเธเธฑเธ”เน€เธเธ" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>เธขเธเน€เธฅเธดเธ</Button>
            <Button className="bg-danger text-white" disabled={rejectReason.length < 10} onClick={() => { setRejectOpen(false); setActionDone('rejected'); }}>
              <X className="size-4 mr-1" />เธเธเธดเน€เธชเธ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

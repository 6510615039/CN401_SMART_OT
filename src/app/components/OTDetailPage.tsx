import { useState, useEffect } from 'react';
import {
  ArrowLeft, CheckCircle2, Clock, AlertTriangle, X,
} from 'lucide-react';
import { Button } from './ui/button';
import { StatusChip } from './shared';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

interface Props {
  onBack: () => void;
  requestId?: string | number | null;
}

const STEP_LABELS = [
  { label: 'ยื่นคำขอ',            role: 'พนักงาน' },
  { label: 'หัวหน้าแผนกอนุมัติ', role: 'หัวหน้าแผนก' },
  { label: 'ตัวแทนแผนกส่งเรื่อง', role: 'ตัวแทนแผนก (Rep)' },
  { label: 'ผู้ตรวจสอบอนุมัติ',  role: 'Checker' },
];

const STATUS_STEP: Record<string, number> = {
  submitted: 0, head_approved: 1, head_rejected: 1,
  rep_forwarded: 2, checker_approved: 3, checker_rejected: 3, completed: 3,
};

const STATUS_THAI: Record<string, string> = {
  submitted: 'รออนุมัติ', head_approved: 'หัวหน้าอนุมัติแล้ว', head_rejected: 'หัวหน้าตีกลับ',
  rep_forwarded: 'ส่งต่อแล้ว', checker_approved: 'อนุมัติแล้ว', checker_rejected: 'ถูกปฏิเสธ', completed: 'เสร็จสิ้น',
};

function thaiDate(dateStr: string) {
  if (!dateStr) return '-';
  const MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
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
      <span>กำลังโหลด...</span>
    </div>
  );

  if (!req) return (
    <div className="flex flex-col items-center justify-center h-60 gap-4">
      <p className="text-[var(--neutral-500)]">ไม่พบข้อมูลคำร้อง</p>
      <Button onClick={onBack} variant="outline">← กลับ</Button>
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
          <><CheckCircle2 className="size-16 text-success" /><h2 className="text-success">อนุมัติเรียบร้อยแล้ว</h2></>
        ) : (
          <><X className="size-16 text-danger" /><h2 className="text-danger">ปฏิเสธเรียบร้อยแล้ว</h2><p className="text-[var(--neutral-500)]">เหตุผล: {rejectReason}</p></>
        )}
        <Button className="bg-tu-red text-white mt-4" onClick={onBack}>← กลับรายการ</Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={onBack}><ArrowLeft className="size-4" />กลับ</Button>
          <h1>รายละเอียดคำขอ OT</h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusChip kind={isRejected ? 'danger' : isApproved ? 'success' : 'warning'}>
            {STATUS_THAI[req.status] || req.status}
          </StatusChip>
          {isRejected && <Button variant="outline" onClick={onBack}>แก้ไข</Button>}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_380px] gap-5 pb-20">
        <div className="space-y-5">
          {/* Requester info */}
          <div className="bg-white rounded-xl border border-[var(--neutral-300)] shadow-[0_1px_2px_rgba(0,0,0,0.06)] p-6">
            <h3 className="mb-4 pb-3 border-b border-[var(--neutral-300)]">ข้อมูลผู้ยื่นคำขอ</h3>
            <div className="grid grid-cols-2 gap-4 text-[13px]">
              {[
                ['ชื่อ-นามสกุล', req.staff_name || '—'],
                ['แผนก', req.department_name || '—'],
                ['ประเภทวัน', req.day_type === 'holiday' ? 'วันหยุด' : 'วันธรรมดา'],
                ['วันที่ยื่น', req.created_at ? new Date(req.created_at).toLocaleDateString('th-TH') : '—'],
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
            <h3 className="mb-4 pb-3 border-b border-[var(--neutral-300)]">รายละเอียดการปฏิบัติงาน OT</h3>
            <div className="grid grid-cols-2 gap-4 text-[13px] mb-4">
              {[
                ['วันที่ปฏิบัติงาน', thaiDate(req.work_date)],
                ['เวลา', `${req.start_time || '-'} – ${req.end_time || '-'} น.`],
                ['จำนวนชั่วโมง', `${ot_hours.toFixed(1)} ชั่วโมง`],
                ['สถานที่', req.location || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[var(--neutral-500)] text-[11px] mb-0.5">{k}</p>
                  <p className="font-semibold">{v}</p>
                </div>
              ))}
            </div>
            {req.work_detail && (
              <div>
                <p className="text-[var(--neutral-500)] text-[11px] mb-1">รายละเอียดงาน</p>
                <div className="bg-[var(--neutral-50)] rounded-lg border border-[var(--neutral-300)] p-3 text-[13px] leading-relaxed">{req.work_detail}</div>
              </div>
            )}
          </div>

          {/* Calculation */}
          <div className="bg-white rounded-xl border border-[var(--neutral-300)] shadow-[0_1px_2px_rgba(0,0,0,0.06)] p-6">
            <h3 className="mb-4 pb-3 border-b border-[var(--neutral-300)]">การคำนวณค่าตอบแทน</h3>
            <div className="overflow-x-auto rounded-lg border border-[var(--neutral-300)]">
              <table className="w-full text-[13px]">
                <thead className="bg-[var(--neutral-100)]">
                  <tr>{['ประเภท','ชั่วโมง','อัตรา/ชม.','รวม'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[var(--neutral-700)]">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  <tr className="border-t border-[var(--neutral-300)]">
                    <td className="px-4 py-2.5">{req.day_type === 'holiday' ? 'วันหยุด' : 'วันธรรมดา'}</td>
                    <td className="px-4 py-2.5 font-mono">{ot_hours.toFixed(1)}</td>
                    <td className="px-4 py-2.5 font-mono">{rate} บาท/ชม.</td>
                    <td className="px-4 py-2.5 font-mono">{Math.round(ot_hours * rate).toLocaleString()}</td>
                  </tr>
                  <tr className="border-t-2 border-[var(--neutral-400)] bg-tu-red-soft">
                    <td className="px-4 py-3 font-bold" colSpan={3}>รวมค่าตอบแทนทั้งสิ้น</td>
                    <td className="px-4 py-3 font-bold text-tu-red text-[16px] font-mono">{Math.round(amount).toLocaleString()} บาท</td>
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
            <h3 className="mb-5 pb-3 border-b border-[var(--neutral-300)]">สถานะการอนุมัติ</h3>
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
                      ขั้นที่ {i + 1}: {s.label}
                    </p>
                    <p className="text-[11px] text-[var(--neutral-500)] mt-0.5">{s.role}</p>
                    {isCurrent && <p className="text-[11px] text-[var(--warning)] mt-0.5">กำลังรอดำเนินการ</p>}
                    {isRejStep && <p className="text-[11px] text-danger mt-0.5">ถูกตีกลับ</p>}
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
                <p className="font-semibold text-[13px]">เหตุผลที่ถูกตีกลับ</p>
              </div>
              <p className="text-[13px] text-[var(--neutral-700)]">{req.head_note || req.checker_note}</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader><DialogTitle>ปฏิเสธคำขอ OT</DialogTitle></DialogHeader>
          <div>
            <label className="font-medium block mb-1">เหตุผลการปฏิเสธ *</label>
            <Textarea rows={4} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="ระบุเหตุผลให้ชัดเจน" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>ยกเลิก</Button>
            <Button className="bg-danger text-white" disabled={rejectReason.length < 10} onClick={() => { setRejectOpen(false); setActionDone('rejected'); }}>
              <X className="size-4 mr-1" />ปฏิเสธ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

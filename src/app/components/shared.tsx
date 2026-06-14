import { ReactNode } from 'react';
import { cn } from './ui/utils';

export type Role = 'admin' | 'staff' | 'depthead' | 'deptrep' | 'checker' | 'executive';

export const ROLE_INFO: Record<Role, { label: string; name: string; dept: string; empId: string }> = {
  admin:     { label: 'แอดมิน',        name: 'พี่ขวัญ ใจดี',     dept: 'ฝ่ายเทคโนโลยีสารสนเทศ', empId: 'AD-001' },
  staff:     { label: 'พนักงาน',       name: 'สมชาย สุขใจ',     dept: 'งานทะเบียนนักศึกษา',    empId: 'EMP-1024' },
  depthead:  { label: 'หัวหน้างาน',    name: 'อรอนงค์ ใจกล้า',  dept: 'งานทะเบียนนักศึกษา',    empId: 'EMP-2001' },
  deptrep:   { label: 'ตัวแทนฝ่าย',   name: 'ปนัดดา แสนดี',    dept: 'งานทะเบียนนักศึกษา',    empId: 'EMP-2014' },
  checker:   { label: 'ผู้ตรวจสอบ',    name: 'พี่ยุ่น ตรวจสอบ',  dept: 'สำนักงานทะเบียนกลาง',  empId: 'CHK-001' },
  executive: { label: 'ผู้บริหาร',      name: 'ดร.วิเชียร ผู้นำ', dept: 'สำนักงานทะเบียนนักศึกษา', empId: 'EXE-001' },
};

export const ROLE_BADGE: Record<Role, string> = {
  admin:     'bg-tu-red text-white',
  checker:   'bg-purple-600 text-white',
  depthead:  'bg-orange-500 text-white',
  deptrep:   'bg-tu-yellow text-black',
  staff:     'bg-blue-600 text-white',
  executive: 'bg-success text-white',
};

export function TUWordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const txt = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-xl';
  return (
    <div className="inline-flex flex-col">
      <span className={cn('font-bold tracking-wider text-tu-red', txt)}>SMART OT</span>
      <span className="h-[3px] w-full bg-tu-yellow rounded-full" />
    </div>
  );
}

export function PageHeader({ title, right, subtitle }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="text-[var(--neutral-500)] mt-1">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function KpiCard({ label, value, icon, accent, hint }: { label: string; value: ReactNode; icon?: ReactNode; accent?: 'red' | 'yellow' | 'green' | 'blue' | 'orange'; hint?: ReactNode }) {
  const accentBg = {
    red: 'bg-tu-red-soft text-tu-red',
    yellow: 'bg-tu-yellow-soft text-[var(--warning)]',
    green: 'bg-green-100 text-success',
    blue: 'bg-blue-100 text-info',
    orange: 'bg-orange-100 text-orange-600',
  }[accent || 'red'];
  return (
    <div className="bg-white rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.06)] border border-[var(--neutral-300)] p-5 h-[110px] flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-[12px] text-[var(--neutral-500)]">{label}</span>
        <span className="text-[32px] leading-[40px] font-bold text-[var(--neutral-black)] tabular-nums">{value}</span>
        {hint && <span className="text-[12px] text-[var(--neutral-500)]">{hint}</span>}
      </div>
      {icon && <div className={cn('size-12 rounded-xl grid place-items-center', accentBg)}>{icon}</div>}
    </div>
  );
}

export function StatusChip({ kind, children }: { kind: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'orange'; children: ReactNode }) {
  const map = {
    success: 'bg-green-100 text-success',
    warning: 'bg-tu-yellow-soft text-[var(--warning)]',
    danger: 'bg-tu-red-soft text-danger',
    info: 'bg-blue-100 text-info',
    neutral: 'bg-[var(--neutral-100)] text-[var(--neutral-700)]',
    orange: 'bg-orange-100 text-orange-600',
  }[kind];
  return <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold', map)}>{children}</span>;
}

export function SectionCard({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.06)] border border-[var(--neutral-300)] p-5', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
       
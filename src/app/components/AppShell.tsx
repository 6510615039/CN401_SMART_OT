import { ReactNode, useState, useEffect } from 'react';
import { Bell, ChevronDown, LogOut, User as UserIcon, CheckCheck, Check } from 'lucide-react';
import { Role, ROLE_INFO, ROLE_BADGE, TUWordmark } from './shared';
import { NotificationItem } from '../App';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from './ui/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

export interface NavItem { key: string; label: string; icon: ReactNode; }

interface Props {
  role: Role;
  availableRoles: Role[];
  nav: NavItem[];
  current: string;
  onNavigate: (k: string) => void;
  onLogout: () => void;
  onSwitchRole: (r: Role) => void;
  breadcrumb: string;
  children: ReactNode;
  notifications?: NotificationItem[];
  onMarkRead?: (ids?: number[]) => void;
  onProfile?: () => void;
}

/** แปลง notif_type → page key ที่ควร navigate ไป (ขึ้นอยู่กับ role) */
function notifTargetPage(type: string, role: Role): string | null {
  if (type === 'ot_submitted')         return role === 'depthead' ? 'pending' : null;
  if (type === 'ot_head_approved')     return role === 'deptrep'  ? 'export'  : role === 'staff' ? 'status' : null;
  if (type === 'ot_head_rejected')     return role === 'staff'    ? 'status'  : null;
  if (type === 'ot_rep_forwarded')     return role === 'checker'  ? 'dashboard' : null;
  if (type === 'ot_rep_action_needed') return role === 'deptrep'  ? 'export'  : null;
  if (type === 'ot_checker_approved')  return role === 'staff'    ? 'status'  : role === 'depthead' ? 'history' : role === 'deptrep' ? 'history' : null;
  if (type === 'ot_checker_rejected')  return role === 'deptrep'  ? 'history' : null;
  return null;
}

/** แปลง notif_type → สีวงกลม icon */
function notifColor(type: string) {
  if (type.includes('approved'))     return 'bg-green-100 text-green-700';
  if (type.includes('rejected'))     return 'bg-red-100 text-tu-red';
  if (type.includes('forwarded'))    return 'bg-blue-100 text-blue-700';
  if (type === 'ot_rep_action_needed') return 'bg-orange-100 text-orange-600';
  return 'bg-tu-yellow-soft text-yellow-700';
}

/** แปลง ISO date → relative time ภาษาไทย */
function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return 'เมื่อกี้';
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `${hr} ชม. ที่แล้ว`;
  return `${Math.floor(hr / 24)} วันที่แล้ว`;
}

const ROLE_LABELS: Record<Role, string> = {
  staff:     'พนักงาน',
  depthead:  'หัวหน้างาน',
  deptrep:   'ตัวแทนฝ่าย',
  checker:   'ผู้ตรวจสอบ',
  executive: 'ผู้บริหาร',
  admin:     'แอดมิน',
};

export function AppShell({ role, availableRoles, nav, current, onNavigate, onLogout, onSwitchRole, breadcrumb, children, notifications = [], onMarkRead, onProfile }: Props) {
  const fallback = ROLE_INFO[role];
  const [userInfo, setUserInfo] = useState<{ name: string; dept: string; empId: string } | null>(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      if (!u) return null;
      const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
      if (!name) return null;
      return { name, dept: u.department_name || u.department || fallback.dept, empId: u.employee_id || u.username || '' };
    } catch { return null; }
  });
  const [profileImage, setProfileImage] = useState<string>(() => localStorage.getItem('profile_image_cache') || '');
  const unread = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    fetch('/api/auth/me/', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setUserInfo({
            name: `${d.first_name || ''} ${d.last_name || ''}`.trim() || d.username,
            dept: d.department_name || d.department || fallback.dept,
            empId: d.employee_id || d.username,
          });
          // อัปเดต profile image จาก backend
          if (d.profile_image) {
            setProfileImage(d.profile_image);
            // ไม่ cache profile_image ใน localStorage เพราะ base64 ขนาดใหญ่ทำให้ quota เต็ม
          }
        }
      })
      .catch(() => {});
  }, [role]);

  // รับ event เมื่อ StaffProfile อัปโหลดรูปใหม่
  useEffect(() => {
    const handler = (e: Event) => {
      const img = (e as CustomEvent).detail as string;
      setProfileImage(img || '');
    };
    window.addEventListener('profile-image-changed', handler);
    return () => window.removeEventListener('profile-image-changed', handler);
  }, []);

  const info = userInfo ?? fallback;

  const otherRoles = availableRoles.filter(r => r !== role);
  const allRoles = availableRoles;

  return (
    <div className="min-h-screen w-full flex flex-col bg-[var(--neutral-100)]">
      {/* Top bar */}
      <header className="h-16 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] flex items-center justify-between px-6 sticky top-0 z-30 border-b border-[var(--neutral-300)]">
        <div className="flex items-center gap-6">
          <TUWordmark />
          <div className="text-[14px] text-[var(--neutral-500)] hidden md:block">
            <span>หน้าแรก</span> <span className="mx-2">/</span>
            <span className="text-[var(--neutral-black)] font-medium">{breadcrumb}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="relative size-10 grid place-items-center rounded-full hover:bg-[var(--neutral-100)]">
                <Bell className="size-5 text-[var(--neutral-700)]" />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-tu-yellow text-black text-[11px] font-bold grid place-items-center">
                    {unread}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[380px] p-0 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--neutral-300)]">
                <h3 className="font-semibold text-[14px]">
                  การแจ้งเตือน {unread > 0 && <span className="ml-1 text-[12px] font-normal text-[var(--neutral-500)]">({unread} ใหม่)</span>}
                </h3>
                {unread > 0 && (
                  <button
                    onClick={() => onMarkRead?.()}
                    className="flex items-center gap-1 text-[12px] text-tu-red font-medium hover:underline"
                  >
                    <CheckCheck className="size-3.5" /> อ่านแล้วทั้งหมด
                  </button>
                )}
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center text-[13px] text-[var(--neutral-500)]">ไม่มีการแจ้งเตือน</div>
                ) : notifications.slice(0, 20).map(n => {
                  const targetPage = notifTargetPage(n.notif_type, role);
                  return (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (!n.is_read) onMarkRead?.([n.id]);
                      if (targetPage) onNavigate(targetPage);
                    }}
                    className={cn(
                      'w-full text-left flex gap-3 p-4 border-b border-[var(--neutral-300)] transition-colors',
                      !n.is_read ? 'bg-[#fffbe6] hover:bg-[#fff8d6]' : 'hover:bg-[var(--neutral-100)]',
                      targetPage ? 'cursor-pointer' : 'cursor-default',
                    )}
                  >
                    <div className={cn('size-9 rounded-full grid place-items-center shrink-0 text-[13px] font-bold', notifColor(n.notif_type))}>
                      <Bell className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[var(--neutral-black)] leading-snug">{n.message}</p>
                      {n.ot_request_date && (
                        <p className="text-[11px] text-[var(--neutral-500)] mt-0.5">วันที่ทำ OT: {n.ot_request_date}</p>
                      )}
                      <p className="text-[11px] text-[var(--neutral-500)] mt-0.5">{relativeTime(n.created_at)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {!n.is_read && <span className="size-2 rounded-full bg-tu-yellow" />}
                      {targetPage && <span className="text-[10px] text-blue-500">คลิกเพื่อดู →</span>}
                    </div>
                  </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--neutral-100)]">
                <Avatar className="size-9">
                  {profileImage && <AvatarImage src={profileImage} alt="profile" className="object-cover" />}
                  <AvatarFallback className="bg-tu-yellow text-black font-bold">{info.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="text-left hidden md:block">
                  <p className="text-[13px] font-semibold text-[var(--neutral-black)] leading-tight">{info.name}</p>
                  <p className="text-[11px] text-[var(--neutral-500)] leading-tight">{info.dept}</p>
                </div>
                <ChevronDown className="size-4 text-[var(--neutral-500)]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p>{info.name}</p>
                <p className="text-[11px] text-[var(--neutral-500)] font-normal mt-0.5">{info.empId} • {info.dept}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onProfile?.()}><UserIcon className="size-4 mr-2" />โปรไฟล์</DropdownMenuItem>
              {allRoles.length > 1 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[11px] text-[var(--neutral-500)] font-normal">สลับ Role</DropdownMenuLabel>
                  {allRoles.map(r => {
                    const isActive = r === role;
                    return (
                      <DropdownMenuItem
                        key={r}
                        onClick={() => !isActive && onSwitchRole(r)}
                        className={cn('gap-2', isActive && 'cursor-default opacity-100 bg-[var(--neutral-100)]')}
                      >
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold', ROLE_BADGE[r])}>
                          {ROLE_LABELS[r]}
                        </span>
                        {isActive && <Check className="size-3.5 ml-auto text-green-600" />}
                      </DropdownMenuItem>
                    );
                  })}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-tu-red">
                <LogOut className="size-4 mr-2" />ออกจากระบบ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside
          className="w-[240px] bg-white border-r border-[var(--neutral-300)] py-4 sticky top-16 self-start"
          style={{ height: 'calc(100vh - 64px)' }}
        >
          <nav className="flex flex-col">
            {nav.map(item => {
              const active = item.key === current;
              return (
                <button
                  key={item.key}
                  onClick={() => onNavigate(item.key)}
                  className={cn(
                    'h-11 px-5 flex items-center gap-3 text-[14px] relative transition-colors',
                    active
                      ? 'bg-tu-red-soft text-tu-red font-semibold'
                      : 'text-[var(--neutral-700)] hover:bg-[var(--neutral-100)]'
                  )}
                >
                  {active && <span className="absolute left-0 top-0 bottom-0 w-1 bg-tu-yellow" />}
                  <span className={cn('size-5', active && 'text-tu-red')}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-[1280px] mx-auto">{children}</div>
          <footer className="h-10 flex items-center justify-center text-[12px] text-[var(--neutral-500)] mt-8">
            SMART OT v1.0.0 © 2569 สำนักงานทะเบียนนักศึกษา มหาวิทยาลัยธรรมศาสตร์
          </footer>
        </main>
      </div>
    </div>
  );
}

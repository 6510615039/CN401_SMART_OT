import { useState, useEffect, useRef } from 'react';
import { Toaster } from './components/ui/sonner';
import { Login, ForgotPassword } from './components/Login';
import { AppShell } from './components/AppShell';
import { OTDetailPage } from './components/OTDetailPage';
import { Role } from './components/shared';

export type NotificationItem = {
  id: number;
  message: string;
  notif_type: string;
  ot_request: number | null;
  ot_request_date: string | null;
  is_read: boolean;
  created_at: string;
};
import {
  ADMIN_NAV, AdminDashboard, AdminImport, AdminUsers, AdminDepts,
  AdminSettings, AdminHistory, AdminAudit, AdminHolidays, AdminDeadlines,
} from './components/roles/admin';
import {
  STAFF_NAV, StaffDashboard, StaffTimeLog, StaffSubmit, StaffStatus,
  StaffEditRejected, StaffProfile,
} from './components/roles/staff';
import {
  HEAD_NAV, HeadDashboard, HeadPending, HeadDetail, HeadHistory,
  HeadMembers, HeadReport, HeadBudgetRequest,
} from './components/roles/depthead';
import {
  REP_NAV, RepDashboard, RepExportFlow, RepHistory, RepMembers,
} from './components/roles/deptrep';
import {
  CHECKER_NAV, CheckerDashboard, CheckerBudget,
  CheckerHistory, CheckerReport, CheckerSetBudget, CheckerOTDetail,
} from './components/roles/checker';
import {
  EXEC_NAV, ExecDashboard, ExecTrend,
} from './components/roles/executive';

type Screen = 'login' | 'forgot' | 'app';

function getStoredAvailableRoles(): Role[] {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    const roles: Role[] = Array.isArray(u.available_roles) ? u.available_roles : [];
    return roles.length > 0 ? roles : ['staff'];
  } catch { return ['staff']; }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [role, setRole] = useState<Role>('staff');
  const [availableRoles, setAvailableRoles] = useState<Role[]>(['staff']);
  
  // เปลี่ยนชื่อ setter เป็น _setPage เพื่อทำ Wrapper Function
  const [page, _setPage] = useState('dashboard');
  
  const [checkerOtEmp, setCheckerOtEmp] = useState<{ name: string; dept: string; idx: number } | null>(null);
  const [selectedOTId, setSelectedOTId] = useState<number | null>(null);
  const [rejectedReqInfo, setRejectedReqInfo] = useState<{ id: number; date: string; note?: string } | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // ─── Wrapper สำหรับ setPage เพื่อให้บันทึกลง localStorage อัตโนมัติทุกครั้ง ───
  const setPage = (newPage: string) => {
    _setPage(newPage);
    localStorage.setItem('current_page', newPage);
  };

  // ─── เช็ค access_token ตอน mount — restore session แล้ว fetch role ล่าสุดจาก DB ───
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    // Restore ทันทีจาก cache เพื่อให้ UI ไม่กระพริบ
    const cachedRole = (localStorage.getItem('active_role') as Role) || 'staff';
    const cachedRoles = getStoredAvailableRoles();
    setRole(cachedRole);
    setAvailableRoles(cachedRoles);
    setScreen('app');
    const savedPage = localStorage.getItem('current_page') || 'dashboard';
    setPage(savedPage);

    // Fetch role จาก DB จริง — รองรับกรณีแอดมินแก้ role หลัง login
    fetch('/api/auth/me/', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(freshUser => {
        if (!freshUser) return;
        // อัปเดต localStorage ให้ตรงกับ DB
        localStorage.setItem('user', JSON.stringify(freshUser));
        const freshRoles: Role[] = Array.isArray(freshUser.available_roles) && freshUser.available_roles.length > 0
          ? freshUser.available_roles
          : [freshUser.role || 'staff'];
        setAvailableRoles(freshRoles);
        // ถ้า role ที่ active อยู่ไม่มีแล้ว → switch ไป role แรกที่มีสิทธิ์
        if (!freshRoles.includes(cachedRole)) {
          const newRole = freshRoles[0] as Role;
          localStorage.setItem('active_role', newRole);
          setRole(newRole);
        }
      })
      .catch(() => {}); // token หมดอายุหรือ network error → ปล่อยให้ใช้ cache
  }, []);

  // Global fetch interceptor — แนบ X-Acting-Role header กับทุก /api/ call อัตโนมัติ
  // ทำให้ backend รู้ว่า user กำลัง act as role อะไร (สำหรับ multi-role users)
  useEffect(() => {
    const _origFetch = window.fetch.bind(window);
    window.fetch = function(input: RequestInfo | URL, init: RequestInit = {}) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      if (url.startsWith('/api/')) {
        const activeRole = localStorage.getItem('active_role');
        if (activeRole) {
          init = {
            ...init,
            headers: {
              ...(init.headers || {}),
              'X-Acting-Role': activeRole,
            },
          };
        }
      }
      return _origFetch(input, init);
    };
    return () => { window.fetch = _origFetch; };
  }, []);

  // ─── โหลด notifications เมื่อ login หรือสลับ role ─────────────────────────
  useEffect(() => {
    if (screen !== 'app') {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) return;

    // รีเซ็ตและโหลดใหม่ทุกครั้งที่ role เปลี่ยน
    setNotifications([]);
    fetch('/api/notifications/', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Acting-Role': role,
      },
    })
      .then(r => r.json())
      .then((data: NotificationItem[]) => {
        if (Array.isArray(data)) setNotifications(data);
      })
      .catch(() => {});

    // เชื่อม WebSocket ใหม่เมื่อ role เปลี่ยน
    wsRef.current?.close();
    const ws = new WebSocket(`/ws/notifications/?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'notification') {
          setNotifications(prev => [msg.data as NotificationItem, ...prev]);
        }
      } catch {}
    };

    ws.onerror = () => {};
    ws.onclose = () => {};

    // Polling fallback ทุก 30 วินาที (กรณี WebSocket ขาด)
    const pollId = setInterval(() => {
      const t = localStorage.getItem('access_token');
      if (!t) return;
      fetch('/api/notifications/', {
        headers: { Authorization: `Bearer ${t}`, 'X-Acting-Role': role },
      })
        .then(r => r.json())
        .then((data: NotificationItem[]) => {
          if (Array.isArray(data)) setNotifications(data);
        })
        .catch(() => {});
    }, 30000);

    return () => {
      ws.close();
      clearInterval(pollId);
    };
  }, [screen, role]);

  function handleMarkRead(ids?: number[]) {
    const token = localStorage.getItem('access_token');
    fetch('/api/notifications/mark-read/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ids ? { ids } : {}),
    }).catch(() => {});

    setNotifications(prev =>
      prev.map(n => (!ids || ids.includes(n.id) ? { ...n, is_read: true } : n))
    );
  }

  function handleLogin(r: Role) {
    const roles = getStoredAvailableRoles();
    setAvailableRoles(roles);
    const startRole = roles.includes(r) ? r : roles[0];
    localStorage.setItem('active_role', startRole);   // ← บันทึก active role
    setRole(startRole);
    setPage('dashboard');
    setScreen('app');
  }

  function handleLogout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('active_role');           // ← ล้าง active role
    localStorage.removeItem('current_page');          // ล้าง current page ทิ้งตอน logout ด้วย
    setScreen('login');
  }

  function handleSwitchRole(r: Role) {
    localStorage.setItem('active_role', r);           // ← อัปเดต active role
    setRole(r);
    setPage('dashboard');
    setCheckerOtEmp(null);
  }

  if (screen === 'login') return (
    <>
      <Login onLogin={handleLogin} onForgot={() => setScreen('forgot')} />
      <Toaster />
    </>
  );
  if (screen === 'forgot') return <><ForgotPassword onBack={() => setScreen('login')} /><Toaster /></>;

  const navMap: Record<Role, any> = {
    admin: ADMIN_NAV, staff: STAFF_NAV, depthead: HEAD_NAV,
    deptrep: REP_NAV, checker: CHECKER_NAV, executive: EXEC_NAV,
  };
  const nav = navMap[role];
  const breadcrumb = nav.find((n: any) => n.key === page)?.label || 'Dashboard';

  function renderScreen() {
    // โปรไฟล์ใช้ได้ทุก role
    if (page === 'profile') return <StaffProfile />;

    if (role === 'admin') {
      switch (page) {
        case 'dashboard': return <AdminDashboard />;
        case 'import':    return <AdminImport />;
        case 'users':     return <AdminUsers />;
        case 'depts':     return <AdminDepts />;
        case 'holidays':  return <AdminHolidays />;
        case 'deadlines': return <AdminDeadlines />;
        case 'settings':  return <AdminSettings />;
        case 'history':   return <AdminHistory />;
        case 'audit':     return <AdminAudit />;
      }
    }
    if (role === 'staff') {
      switch (page) {
        case 'dashboard': return <StaffDashboard onGoEdit={() => setPage('edit')} />;
        case 'timelog':   return <StaffTimeLog />;
        case 'submit':    return <StaffSubmit />;
        case 'status':    return <StaffStatus
          onEdit={(id, date, note) => { setRejectedReqInfo({ id, date, note }); setPage('edit'); }}
          onDetail={(id) => { setSelectedOTId(id); setPage('ot-detail'); }}
        />;
        case 'ot-detail': return <OTDetailPage onBack={() => setPage('status')} requestId={selectedOTId} />;
        case 'edit':      return <StaffEditRejected
          requestId={rejectedReqInfo?.id}
          rejectedDate={rejectedReqInfo?.date}
          rejectionNote={rejectedReqInfo?.note}
          onBack={() => setPage('status')}
        />;
        case 'profile':   return <StaffProfile />;
      }
    }
    if (role === 'depthead') {
      switch (page) {
        case 'dashboard':      return <HeadDashboard onGo={() => setPage('pending')} onBudgetRequest={() => setPage('budget-request')} />;
        case 'pending':        return <HeadPending onDetail={(id) => { setSelectedOTId(id); setPage('ot-detail'); }} />;
        case 'ot-detail':      return <OTDetailPage onBack={() => setPage('pending')} requestId={selectedOTId} />;
        case 'detail':         return <HeadDetail />;
        case 'history':        return <HeadHistory />;
        case 'members':        return <HeadMembers />;
        case 'report':         return <HeadReport />;
        case 'budget-request': return <HeadBudgetRequest />;
      }
    }
    if (role === 'deptrep') {
      switch (page) {
        case 'dashboard': return <RepDashboard onGo={() => setPage('export')} />;
        case 'export':    return <RepExportFlow onDone={() => setPage('dashboard')} />;
        case 'history':   return <RepHistory />;
        case 'members':   return <RepMembers />;
      }
    }
    if (role === 'checker') {
      if (page === 'ot-detail' && checkerOtEmp) {
        return (
          <CheckerOTDetail
            onBack={() => { setPage('dashboard'); setCheckerOtEmp(null); }}
            name={checkerOtEmp.name}
            dept={checkerOtEmp.dept}
            idx={checkerOtEmp.idx}
          />
        );
      }
      switch (page) {
        case 'dashboard':  return (
          <CheckerDashboard
            onGo={() => setPage('budget')}
            onOtDetail={emp => { setCheckerOtEmp(emp); setPage('ot-detail'); }}
          />
        );
        case 'budget':     return <CheckerBudget />;
        case 'budget-set': return <CheckerSetBudget />;
        case 'history':    return <CheckerHistory />;
        case 'report':     return <CheckerReport />;
      }
    }
    if (role === 'executive') {
      switch (page) {
        case 'dashboard': return <ExecDashboard />;
        case 'trend':     return <ExecTrend />;
      }
    }
    return <div className="p-12 text-center text-[var(--neutral-500)]">หน้านี้กำลังพัฒนา</div>;
  }

  return (
    <>
      <AppShell
        role={role}
        availableRoles={availableRoles}
        nav={nav}
        current={page}
        onNavigate={p => { setPage(p); setCheckerOtEmp(null); }}
        onSwitchRole={handleSwitchRole}
        onProfile={() => setPage('profile')}
        breadcrumb={breadcrumb}
        onLogout={handleLogout}
        notifications={notifications}
        onMarkRead={handleMarkRead}
      >
        {renderScreen()}
      </AppShell>
      <Toaster />
    </>
  );
}
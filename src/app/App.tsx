import { useState, useEffect } from 'react';
import { Toaster } from './components/ui/sonner';
import { Login, ForgotPassword } from './components/Login';
import { AppShell } from './components/AppShell';
import { OTDetailPage } from './components/OTDetailPage';
import { Role } from './components/shared';
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
  HeadMembers, HeadReport,
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
  const [page, setPage] = useState('dashboard');
  const [checkerOtEmp, setCheckerOtEmp] = useState<{ name: string; dept: string; idx: number } | null>(null);
  const [selectedOTId, setSelectedOTId] = useState<number | null>(null);

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
        case 'status':    return <StaffStatus onEdit={() => setPage('edit')} onDetail={(id) => { setSelectedOTId(id); setPage('ot-detail'); }} />;
        case 'ot-detail': return <OTDetailPage onBack={() => setPage('status')} requestId={selectedOTId} />;
        case 'edit':      return <StaffEditRejected />;
        case 'profile':   return <StaffProfile />;
      }
    }
    if (role === 'depthead') {
      switch (page) {
        case 'dashboard': return <HeadDashboard onGo={() => setPage('pending')} onBudgetRequest={() => setPage('pending')} />;
        case 'pending':   return <HeadPending onDetail={(id) => { setSelectedOTId(id); setPage('ot-detail'); }} />;
        case 'ot-detail': return <OTDetailPage onBack={() => setPage('pending')} requestId={selectedOTId} />;
        case 'detail':    return <HeadDetail />;
        case 'history':   return <HeadHistory />;
        case 'members':   return <HeadMembers />;
        case 'report':    return <HeadReport />;
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
        breadcrumb={breadcrumb}
        onLogout={handleLogout}
      >
        {renderScreen()}
      </AppShell>
      <Toaster />
    </>
  );
}
import { useState } from 'react';
import { Eye, EyeOff, KeyRound, User, Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Role } from './shared';
import regtuLogo from '../../imports/regtu-logo-cropped.png';

interface Props { onLogin: (role: Role) => void; onForgot: () => void; }

type LoginState = 'idle' | 'loading' | 'error';

export function Login({ onLogin, onForgot }: Props) {
  const [showPw, setShowPw] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<LoginState>('idle');
  const [errorMsg, setErrorMsg] = useState('อีเมลหรือรหัสผ่านไม่ถูกต้อง');

  async function handleSubmit() {
    if (!username.trim() || !password.trim()) {
      setState('error');
      setErrorMsg('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    setState('loading');

    try {
      // ส่ง username/email เต็มไปให้ backend จัดการ (รองรับ email lookup + employee_id)
      const res = await fetch('/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!res.ok) {
        setState('error');
        const body = await res.json().catch(() => null);
        setErrorMsg(body?.error || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
        return;
      }

      const { access, refresh, user } = await res.json();
      // เก็บเฉพาะ field ที่จำเป็น เพื่อไม่ให้ localStorage เต็ม
      const userToStore = {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        available_roles: user.available_roles,
        department: user.department,
        department_name: user.department_name,
        // ไม่เก็บ profile_image เพราะอาจเป็น base64 ขนาดใหญ่มาก
      };
      // ล้าง cache เก่าก่อน โดยเฉพาะ profile_image_cache ที่อาจมีขนาดใหญ่
      localStorage.removeItem('profile_image_cache');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('user', JSON.stringify(userToStore));
      onLogin(user.role as Role);

    } catch (err) {
      console.error('[Login] catch error:', err);
      // ถ้า token ถูก save ไปแล้ว (fetch สำเร็จ แต่ onLogin throw) ให้ transition เลย
      const savedToken = localStorage.getItem('access_token');
      const savedUser = localStorage.getItem('user');
      if (savedToken && savedUser) {
        try {
          const u = JSON.parse(savedUser);
          if (u.role) { onLogin(u.role as Role); return; }
        } catch {}
      }
      setState('error');
      setErrorMsg('ไม่สามารถเชื่อมต่อกับ server ได้');
    }
  }

  const isError = state === 'error';
  const isLoading = state === 'loading';

  return (
    <div className="min-h-screen w-full flex bg-white">
      {/* Hero */}
      <div className="hidden md:flex w-[55%] bg-tu-red relative overflow-hidden flex-col items-center justify-center text-center px-12">
        <div className="relative z-10">
          <img src={regtuLogo} alt="REGTU - สำนักงานทะเบียนนักศึกษา" className="w-72 max-w-full rounded-2xl mx-auto mb-8" />
          <h1 className="text-[36px] font-bold text-tu-yellow leading-tight">SMART OT SYSTEM</h1>
          <p className="text-[16px] text-white mt-4 max-w-md">
            ระบบคำนวณและตรวจสอบค่าตอบแทนการปฏิบัติงานนอกเวลาราชการ
          </p>
          <p className="text-[14px] text-white/70 mt-2">สำนักงานทะเบียนนักศึกษา มหาวิทยาลัยธรรมศาสตร์</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[400px]">
          <h1 className="mb-2">เข้าสู่ระบบ</h1>
          <p className="text-[var(--neutral-500)] mb-8">กรุณากรอกข้อมูลเพื่อเข้าใช้งานระบบ SMART OT</p>

          <div className="space-y-4">
            {/* Username */}
            <div>
              <label className="block mb-1.5">อีเมล TU หรือ Username TU</label>
              <div className="relative">
                <User className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neutral-500)]" />
                <Input
                  className={`pl-10 h-11 ${isError ? 'border-danger focus-visible:ring-danger' : ''}`}
                  placeholder="เช่น sariya@tu.ac.th หรือ sariya"
                  value={username}
                  onChange={e => { setUsername(e.target.value); if (isError) setState('idle'); }}
                  disabled={isLoading}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block mb-1.5">รหัสผ่าน</label>
              <div className="relative">
                <KeyRound className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neutral-500)]" />
                <Input
                  type={showPw ? 'text' : 'password'}
                  className={`pl-10 pr-10 h-11 ${isError ? 'border-danger focus-visible:ring-danger' : ''}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (isError) setState('idle'); }}
                  disabled={isLoading}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--neutral-500)]"
                  disabled={isLoading}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {isError && (
                <p className="text-[12px] text-danger mt-1 flex items-center gap-1">
                  <span>⚠</span> {errorMsg}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox defaultChecked disabled={isLoading} />
                <span className="text-[13px]">จดจำการเข้าสู่ระบบ</span>
              </label>
              <button onClick={onForgot} className="text-[13px] text-tu-red font-medium" disabled={isLoading}>
                ลืมรหัสผ่าน?
              </button>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full h-12 bg-tu-red hover:bg-tu-red-dark text-white"
            >
              {isLoading ? (
                <><Loader2 className="size-4 mr-2 animate-spin" />กำลังตรวจสอบ...</>
              ) : (
                'เข้าสู่ระบบด้วย TU Account'
              )}
            </Button>

            <p className="text-[12px] text-[var(--neutral-500)] text-center">
              ระบบเชื่อมต่อกับ Django API • สิทธิ์การใช้งานถูกกำหนดโดยผู้ดูแลระบบ
            </p>
          </div>

          <p className="text-[12px] text-[var(--neutral-500)] text-center mt-8">
            © 2569 สำนักงานทะเบียนนักศึกษา มธ.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ForgotPassword({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen w-full flex bg-white">
      <div className="hidden md:flex w-[55%] bg-tu-red relative overflow-hidden flex-col items-center justify-center text-center px-12">
        <div className="relative z-10">
          <h1 className="text-[36px] font-bold text-tu-yellow">SMART OT SYSTEM</h1>
          <p className="text-white/70 mt-3">สำนักงานทะเบียนนักศึกษา มหาวิทยาลัยธรรมศาสตร์</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[400px]">
          <h1 className="mb-2">ลืมรหัสผ่าน / เปลี่ยนรหัสผ่าน</h1>
          <p className="text-[var(--neutral-500)] mb-6">
            ระบบ SMART OT ใช้บัญชี TU Account เดียวกันกับระบบมหาวิทยาลัย
            กรุณาดำเนินการรีเซ็ตหรือเปลี่ยนรหัสผ่านผ่าน TU IT Center โดยตรง
          </p>
          <div className="space-y-3">
            <a
              href="https://accounts.tu.ac.th/th"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full h-12 rounded-lg bg-tu-red text-white font-semibold hover:bg-tu-red-dark transition-colors"
            >
              ไปยังหน้าจัดการบัญชี TU (สทส.)
            </a>
            <Button variant="outline" onClick={onBack} className="w-full h-11">
              ← กลับหน้าเข้าสู่ระบบ
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
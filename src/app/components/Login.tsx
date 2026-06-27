import { useState } from 'react';
import { Eye, EyeOff, KeyRound, User, Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Role } from './shared';

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
        setErrorMsg('อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
        return;
      }

      const { access, refresh, user } = await res.json();
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('user', JSON.stringify(user));
      onLogin(user.role as Role);

    } catch {
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
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, #FFD400 0 2px, transparent 2px 28px)' }}
        />
        <div className="relative z-10">
          <div className="size-32 rounded-2xl bg-black grid place-items-center mx-auto mb-8">
            <div className="text-white font-bold text-3xl tracking-widest">RegTU</div>
          </div>
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
            {/* Username / Email */}
            <div>
              <label className="block mb-1.5">รหัสพนักงาน</label>
              <div className="relative">
                <User className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neutral-500)]" />
                <Input
                  className={`pl-10 h-11 ${isError ? 'border-danger focus-visible:ring-danger' : ''}`}
                  placeholder="เช่น 0001"
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

            {/* Test accounts hint */}
            <div style={{background:'var(--neutral-50)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'var(--neutral-500)',lineHeight:1.9}}>
              <strong style={{color:'var(--neutral-700)'}}>บัญชีทดสอบ (username / password):</strong><br/>
              <span style={{color:'var(--neutral-600)'}}>admin</span> / admin1234 &nbsp;•&nbsp;
              <span style={{color:'var(--neutral-600)'}}>somchai</span> / staff1234<br/>
              <span style={{color:'var(--neutral-600)'}}>onanong</span> / head1234 &nbsp;•&nbsp;
              <span style={{color:'var(--neutral-600)'}}>checker</span> / chk1234<br/>
              <span style={{color:'var(--neutral-400)',fontSize:11}}>
                นักศึกษา: ใช้ email เต็ม เช่น s6512345678@dome.tu.ac.th
              </span>
            </div>

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
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, #FFD400 0 2px, transparent 2px 28px)' }}
        />
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
              href="https://account.tu.ac.th"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full h-12 rounded-lg bg-tu-red hover:bg-tu-red-dark text-white font-semibold transition-colors no-underline"
            >
              ไปยัง TU IT Center (account.tu.ac.th) →
            </a>
            <p className="text-[12px] text-[var(--neutral-500)] text-center">
              เปิดในแท็บใหม่ · จัดการบัญชี TU Account ของคุณ
            </p>
          </div>
          <button onClick={onBack} className="block w-full text-center text-tu-red font-medium mt-6">← กลับไปเข้าสู่ระบบ</button>
        </div>
      </div>
    </div>
  );
}
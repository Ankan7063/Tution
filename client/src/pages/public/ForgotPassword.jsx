import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, ArrowLeft, ShieldCheck } from 'lucide-react';
import api from '../../api/client.js';
import { useToast } from '../../components/ui.jsx';

export default function ForgotPassword() {
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState('request'); // request | reset
  const [form, setForm] = useState({ email: '', code: '', newPassword: '', confirmPassword: '' });
  const [demoCode, setDemoCode] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const request = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email: form.email });
      setDemoCode(data.demoCode || null);
      setStep('reset');
      toast.success(data.demoCode ? 'Email not configured — your reset code is shown below.' : 'Reset code sent to your email.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) return toast.error('Passwords do not match');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/reset-password',
        { email: form.email, code: form.code, newPassword: form.newPassword });
      toast.success(data.message || 'Password reset successfully');
      navigate('/admin/login', { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-14">
      <div className="fade-in card w-full max-w-md p-8">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-600 text-white">
            <KeyRound size={26} />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-white">Forgot password</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {step === 'request'
              ? 'Admins, teachers and students can reset their password here.'
              : 'Enter the 6-digit code and choose a new password.'}
          </p>
        </div>

        {step === 'request' ? (
          <form onSubmit={request} className="mt-6 space-y-4">
            <div>
              <label className="label">Email Address</label>
              <input className="input" type="email" required autoComplete="email"
                value={form.email} onChange={set('email')} placeholder="you@example.com" />
            </div>
            <button className="btn-primary w-full" type="submit" disabled={busy}>
              {busy ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />} Send Reset Code
            </button>
          </form>
        ) : (
          <form onSubmit={reset} className="mt-6 space-y-4">
            {demoCode && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                Demo mode (no email server): your reset code is{' '}
                <span className="font-mono text-base font-bold">{demoCode}</span> — it expires in 10 minutes.
              </div>
            )}
            <div>
              <label className="label">Reset Code</label>
              <input className="input font-mono tracking-widest" inputMode="numeric" required maxLength={6}
                value={form.code} onChange={set('code')} placeholder="6-digit code" />
            </div>
            <div>
              <label className="label">New Password</label>
              <input className="input" type="password" required minLength={8} autoComplete="new-password"
                value={form.newPassword} onChange={set('newPassword')} placeholder="At least 8 characters" />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input className="input" type="password" required autoComplete="new-password"
                value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="Repeat password" />
            </div>
            <button className="btn-primary w-full" type="submit" disabled={busy}>
              {busy ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />} Reset Password
            </button>
            <button className="btn-ghost w-full" type="button" onClick={() => setStep('request')}>
              <ArrowLeft size={16} /> Use a different email
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          Remembered it? <Link to="/login" className="font-semibold text-brand-600 hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { GraduationCap, LogIn, Loader2, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { useToast } from '../../components/ui.jsx';

export default function Login({ admin = false }) {
  const { login } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.email}`);
      if (user.role === 'STUDENT') navigate('/portal', { replace: true });
      else if (location.state?.from) navigate(location.state.from, { replace: true });
      else navigate('/admin', { replace: true });
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
            {admin ? <ShieldCheck size={26} /> : <GraduationCap size={26} />}
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-white">
            {admin ? 'Admin Login' : 'Student Login'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {admin ? 'Sign in to the management dashboard' : 'Sign in to view attendance, fees and results'}
          </p>
        </div>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label">Email Address</label>
            <input className="input" type="email" required autoComplete="email"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder={admin ? 'admin@tuitioncenter.com' : 'you@example.com'} />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required autoComplete="current-password"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Your password" />
          </div>
          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />} Sign In
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          {admin
            ? <>Looking for the student portal? <Link to="/login" className="font-semibold text-brand-600 hover:underline">Student Login</Link></>
            : <>Are you staff? <Link to="/admin/login" className="font-semibold text-brand-600 hover:underline">Admin Login</Link></>}
        </p>
      </div>
    </div>
  );
}

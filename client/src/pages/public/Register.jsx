import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Loader2, UserPlus } from 'lucide-react';
import api, { getArray, getObject } from '../../api/client.js';
import { useApp } from '../../context/AppContext.jsx';
import { useToast } from '../../components/ui.jsx';

export default function Register() {
  const { setUser } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '', phone: '',
    classGrade: '', parentName: '', parentPhone: '', address: '', courseId: '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getArray('/courses').then(setCourses).catch(() => setCourses([]));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    setBusy(true);
    try {
      const body = { ...form };
      delete body.confirmPassword;
      if (!body.courseId) delete body.courseId;
      ['phone', 'classGrade', 'parentName', 'parentPhone', 'address'].forEach((k) => { if (!body[k]) delete body[k]; });
      const { data } = await api.post('/auth/register', body);
      localStorage.setItem('tc_token', data.token);
      const me = await getObject('/auth/me');
      setUser(me);
      toast.success(`Welcome, ${me.student?.name || data.user.email}! Admission no: ${me.student?.admissionNo}`);
      navigate('/portal', { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-14">
      <div className="fade-in card w-full max-w-lg p-8">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-600 text-white">
            <GraduationCap size={26} />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-white">Student Registration</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create your student account — admins and teachers are registered by the center.
          </p>
        </div>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Full Name</label>
              <input className="input" required minLength={2} value={form.name} onChange={set('name')} placeholder="Student name" />
            </div>
            <div>
              <label className="label">Class / Grade</label>
              <input className="input" value={form.classGrade} onChange={set('classGrade')} placeholder="e.g. Class 10" />
            </div>
          </div>
          <div>
            <label className="label">Email Address</label>
            <input className="input" type="email" required autoComplete="email" value={form.email} onChange={set('email')} placeholder="you@example.com" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} placeholder="At least 8 characters" />
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input className="input" type="password" required autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="Repeat password" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Phone (optional)</label>
              <input className="input" type="tel" value={form.phone} onChange={set('phone')} placeholder="Your phone" />
            </div>
            <div>
              <label className="label">Course (optional)</label>
              <select className="input" value={form.courseId} onChange={set('courseId')}>
                <option value="">Select later</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Parent Name (optional)</label>
              <input className="input" value={form.parentName} onChange={set('parentName')} placeholder="Guardian name" />
            </div>
            <div>
              <label className="label">Parent Phone (optional)</label>
              <input className="input" type="tel" value={form.parentPhone} onChange={set('parentPhone')} placeholder="Guardian phone" />
            </div>
          </div>
          <div>
            <label className="label">Address (optional)</label>
            <textarea className="input" rows={2} value={form.address} onChange={set('address')} placeholder="Home address" />
          </div>
          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />} Register &amp; Sign In
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          Already registered? <Link to="/login" className="font-semibold text-brand-600 hover:underline">Student Login</Link>
        </p>
      </div>
    </div>
  );
}

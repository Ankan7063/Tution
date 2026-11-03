import { Navigate, Route, Routes, useLocation, Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useApp } from './context/AppContext.jsx';
import { Spinner } from './components/ui.jsx';
import PublicLayout from './components/PublicLayout.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import Home from './pages/public/Home.jsx';
import Login from './pages/public/Login.jsx';
import ForgotPassword from './pages/public/ForgotPassword.jsx';
import Register from './pages/public/Register.jsx';
import { About, Courses as PublicCourses, Teachers as PublicTeachers, Contact } from './pages/public/StaticPages.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import { Students, NewAdmission, StudentDetail } from './pages/admin/Students.jsx';
import Teachers from './pages/admin/Teachers.jsx';
import Courses from './pages/admin/Courses.jsx';
import { Batches, BatchDetail } from './pages/admin/Batches.jsx';
import Attendance from './pages/admin/Attendance.jsx';
import Fees from './pages/admin/Fees.jsx';
import Exams from './pages/admin/Exams.jsx';
import Reports from './pages/admin/Reports.jsx';
import Announcements from './pages/admin/Announcements.jsx';
import Settings from './pages/admin/Settings.jsx';
import StudentPortal from './pages/portal/StudentPortal.jsx';

function RequireStaff() {
  const { user, authLoading } = useApp();
  const location = useLocation();
  if (authLoading) return <Spinner label="Checking session…" />;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  if (user.role === 'STUDENT') return <Navigate to="/portal" replace />;
  return <AdminLayout />;
}

function RequireStudent() {
  const { user, authLoading } = useApp();
  if (authLoading) return <Spinner label="Checking session…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'STUDENT') return <Navigate to="/admin" replace />;
  return <StudentPortal />;
}

function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-600 text-white">
        <GraduationCap size={26} />
      </span>
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Page not found</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">The page you were looking for doesn’t exist.</p>
      <Link to="/" className="btn-primary mt-2">Back to home</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/courses" element={<PublicCourses />} />
        <Route path="/teachers" element={<PublicTeachers />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<Login admin />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route path="/portal" element={<RequireStudent />} />

      <Route path="/admin" element={<RequireStaff />}>
        <Route index element={<Dashboard />} />
        <Route path="students" element={<Students />} />
        <Route path="students/new" element={<NewAdmission />} />
        <Route path="students/:id" element={<StudentDetail />} />
        <Route path="teachers" element={<Teachers />} />
        <Route path="courses" element={<Courses />} />
        <Route path="batches" element={<Batches />} />
        <Route path="batches/:id" element={<BatchDetail />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="exams" element={<Exams />} />
        <Route path="fees" element={<Fees />} />
        <Route path="reports" element={<Reports />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

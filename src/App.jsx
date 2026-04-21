import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './components/Toast.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { Spinner } from './components/Spinner.jsx'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import { TodayPanel } from './features/today/TodayPanel.jsx'
import History from './pages/History.jsx'
import Insights from './pages/Insights.jsx'
import Login from './pages/Login.jsx'
import Notes from './pages/Notes.jsx'
import Signup from './pages/Signup.jsx'
import Tasks from './pages/Tasks.jsx'
import Profile from './pages/Profile.jsx'

function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner size="lg" className="text-slate-600" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard/today" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<DashboardLayout />}>
            <Route index element={<Navigate to="today" replace />} />
            <Route path="today" element={<TodayPanel />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="notes" element={<Notes />} />
            <Route path="insights" element={<Insights />} />
            <Route path="history" element={<History />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard/today" replace />} />
      </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}

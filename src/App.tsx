import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import CompleteRegistration from './pages/CompleteRegistration'
import Payment from './pages/Payment'
import Dashboard from './pages/Dashboard'
import Editor from './pages/Editor'
import JudgeDashboard from './pages/JudgeDashboard'
import JudgeEvaluate from './pages/JudgeEvaluate'
import AdminDashboard from './pages/AdminDashboard'
import AdminJudgeDetails from './pages/AdminJudgeDetails'
import Results from './pages/Results'
import VerifyCertificate from './pages/VerifyCertificate'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/results" element={<Results />} />
        <Route path="/verify" element={<VerifyCertificate />} />
        <Route path="/verify/:code" element={<VerifyCertificate />} />

        <Route path="/complete-registration" element={<ProtectedRoute roles={['participant']}><CompleteRegistration /></ProtectedRoute>} />
        <Route path="/payment" element={<ProtectedRoute roles={['participant']}><Payment /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute roles={['participant']}><Dashboard /></ProtectedRoute>} />
        <Route path="/editor" element={<ProtectedRoute roles={['participant']}><Editor /></ProtectedRoute>} />

        <Route path="/judge" element={<ProtectedRoute roles={['judge']}><JudgeDashboard /></ProtectedRoute>} />
        <Route path="/judge/:submissionId" element={<ProtectedRoute roles={['judge']}><JudgeEvaluate /></ProtectedRoute>} />

        <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/judges/:judgeId" element={<ProtectedRoute roles={['admin']}><AdminJudgeDetails /></ProtectedRoute>} />
        <Route path="*" element={<p className="p-10 text-center">Page not found.</p>} />
      </Route>
    </Routes>
  )
}

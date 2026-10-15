import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import JobListPage from './pages/JobListPage';
import JobDetailPage from './pages/JobDetailPage';
import CandidateDetailPage from './pages/CandidateDetailPage';
import SupabaseDemoPage from './pages/SupabaseDemoPage';

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public login route */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/supabase" element={<SupabaseDemoPage />} />
          <Route path="/todos" element={<SupabaseDemoPage />} />

          {/* Protected routes */}
          <Route
            path="/jobs"
            element={
              <ProtectedRoute>
                <JobListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs/:id"
            element={
              <ProtectedRoute>
                <JobDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidates/:id"
            element={
              <ProtectedRoute>
                <CandidateDetailPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback routes */}
          <Route path="/" element={<Navigate to="/jobs" replace />} />
          <Route path="*" element={<Navigate to="/jobs" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

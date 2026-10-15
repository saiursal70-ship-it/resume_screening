import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout, isHR } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-8">
            <Link to="/jobs" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-200 group-hover:bg-emerald-700 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <span className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                  Screen<span className="text-emerald-600">AI</span>
                </span>
                <span className="hidden sm:inline-block text-xs font-medium text-slate-400">
                  Resume Screening
                </span>
              </div>
            </Link>

            <nav className="flex space-x-4">
              <Link
                to="/jobs"
                className="text-slate-600 hover:text-emerald-600 px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-50 transition"
              >
                Jobs
              </Link>
            </nav>
          </div>

          {/* User profile & Logout */}
          <div className="flex items-center space-x-4">
            {user && (
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-800 leading-tight">
                    {user.name || user.email}
                  </div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                    isHR
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {user.role}
                </span>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-red-600 bg-gray-50 hover:bg-red-50 border border-gray-200 rounded-lg transition"
              title="Sign out"
            >
              <svg
                className="w-4 h-4 mr-1.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

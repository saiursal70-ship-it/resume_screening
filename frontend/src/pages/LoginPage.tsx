import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type AuthMode = 'login' | 'register';

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<'hr' | 'viewer'>('hr');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeFilled, setActiveFilled] = useState<string | null>(null);

  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as { from?: { pathname?: string } } | null;
  const from = state?.from?.pathname || '/jobs';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (mode === 'register') {
      if (!name.trim()) {
        setErrorMessage('Please enter your full name.');
        return;
      }
      if (!email.trim() || !password) {
        setErrorMessage('Please enter both email and password.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters long.');
        return;
      }

      try {
        setSubmitting(true);
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
        });
        navigate(from, { replace: true });
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Registration failed. Please try again.');
      } finally {
        setSubmitting(false);
      }
    } else {
      if (!email || !password) {
        setErrorMessage('Please enter both email and password.');
        return;
      }

      try {
        setSubmitting(true);
        await login(email, password);
        navigate(from, { replace: true });
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Invalid email or password.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleFillCredentials = (demoEmail: string, demoPassword: string, roleKey: string) => {
    setMode('login');
    setEmail(demoEmail);
    setPassword(demoPassword);
    setErrorMessage('');
    setActiveFilled(roleKey);
    setTimeout(() => setActiveFilled(null), 1000);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-emerald-50/40 to-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Decorative Animated Ambient Background Orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-24 left-1/4 w-96 h-96 bg-emerald-300/30 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 bg-teal-300/25 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-slate-300/30 rounded-full blur-3xl animate-blob animation-delay-4000" />
        {/* Subtle geometric dot grid pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-60" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md animate-fadeIn">
        {/* Floating Brand Header */}
        <div className="flex justify-center">
          <div className="relative group animate-float">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl blur-sm opacity-70 group-hover:opacity-100 transition duration-500" />
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-xl shadow-emerald-400/40">
              <svg className="w-8 h-8 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </div>
        </div>

        <h2 className="mt-5 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          {mode === 'login' ? (
            <>
              Sign in to Screen<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">AI</span>
            </>
          ) : (
            <>
              Join Screen<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">AI</span>
            </>
          )}
        </h2>
        <p className="mt-1.5 text-center text-sm text-slate-500">
          AI-Assisted Intelligent Resume Screening Platform
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="backdrop-blur-md bg-white/90 py-8 px-6 shadow-xl shadow-slate-900/5 border border-white/80 rounded-2xl sm:px-10 animate-scaleIn transition-all">
          {/* Animated Tab Switcher */}
          <div className="relative flex p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage('');
              }}
              className={`relative z-10 flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                mode === 'login'
                  ? 'text-emerald-950 font-semibold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage('');
              }}
              className={`relative z-10 flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                mode === 'register'
                  ? 'text-emerald-950 font-semibold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign Up
            </button>
            {/* Sliding Pill Indicator */}
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-xs transition-all duration-300 ease-out ${
                mode === 'login' ? 'left-1' : 'left-[calc(50%+2px)]'
              }`}
            />
          </div>

          {/* Animated Error Alert */}
          {errorMessage && (
            <div className="mb-5 p-3.5 bg-red-50/90 border border-red-200/80 rounded-xl text-sm text-red-700 flex items-center space-x-2.5 animate-slideDown shadow-xs">
              <svg className="w-5 h-5 text-red-500 shrink-0 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Animated Form Container */}
          <form key={mode} className="space-y-4 animate-fadeIn" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="animate-slideDown">
                <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                  Full Name
                </label>
                <div className="mt-1">
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Taylor"
                    className="appearance-none block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-300 rounded-lg shadow-2xs placeholder-slate-400 focus:outline-hidden focus:bg-white focus:ring-4 focus:ring-emerald-100 focus:border-emerald-600 transition-all duration-200 text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email Address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="appearance-none block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-300 rounded-lg shadow-2xs placeholder-slate-400 focus:outline-hidden focus:bg-white focus:ring-4 focus:ring-emerald-100 focus:border-emerald-600 transition-all duration-200 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Min 6 characters' : '••••••••'}
                  className="appearance-none block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-300 rounded-lg shadow-2xs placeholder-slate-400 focus:outline-hidden focus:bg-white focus:ring-4 focus:ring-emerald-100 focus:border-emerald-600 transition-all duration-200 text-sm"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div className="animate-slideDown">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Account Role
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRole('hr')}
                    className={`p-3 text-left border rounded-xl transition-all duration-200 hover:-translate-y-0.5 ${
                      role === 'hr'
                        ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 shadow-xs ring-2 ring-emerald-500'
                        : 'border-slate-200 bg-white/70 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-semibold flex items-center justify-between">
                      <span>HR Manager</span>
                      {role === 'hr' && <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />}
                    </div>
                    <div className="text-3xs text-slate-500 mt-0.5">Manage jobs & resumes</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('viewer')}
                    className={`p-3 text-left border rounded-xl transition-all duration-200 hover:-translate-y-0.5 ${
                      role === 'viewer'
                        ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 shadow-xs ring-2 ring-emerald-500'
                        : 'border-slate-200 bg-white/70 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-semibold flex items-center justify-between">
                      <span>Viewer</span>
                      {role === 'viewer' && <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />}
                    </div>
                    <div className="text-3xs text-slate-500 mt-0.5">Read-only evaluation</div>
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/35 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-all duration-200"
              >
                {submitting ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                    <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </span>
                )}
              </button>
            </div>
          </form>

          {/* Demo Credentials Section (shown in login mode) */}
          {mode === 'login' && (
            <div className="mt-6 pt-6 border-t border-slate-200/80 animate-fadeIn">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-center mb-3">
                Demo Credentials (Click to fill)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleFillCredentials('hr@example.com', 'hr-password-123', 'hr')}
                  className={`p-2.5 text-left border rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 group ${
                    activeFilled === 'hr'
                      ? 'border-emerald-500 bg-emerald-100 ring-2 ring-emerald-400'
                      : 'border-emerald-200/80 bg-emerald-50/50 hover:bg-emerald-100/70'
                  }`}
                >
                  <div className="font-semibold text-emerald-950 flex items-center justify-between">
                    <span>HR Manager</span>
                    <span className="text-3xs px-1.5 py-0.5 bg-emerald-200/80 text-emerald-800 rounded font-medium group-hover:bg-emerald-300/80 transition-colors">
                      Full Access
                    </span>
                  </div>
                  <div className="text-emerald-700 mt-0.5 truncate text-2xs">hr@example.com</div>
                  <div className="text-slate-400 font-mono text-3xs">hr-password-123</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleFillCredentials('viewer@example.com', 'viewer-password-123', 'viewer')}
                  className={`p-2.5 text-left border rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 group ${
                    activeFilled === 'viewer'
                      ? 'border-slate-500 bg-slate-200 ring-2 ring-slate-400'
                      : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="font-semibold text-slate-800 flex items-center justify-between">
                    <span>Viewer</span>
                    <span className="text-3xs px-1.5 py-0.5 bg-slate-200/80 text-slate-700 rounded font-medium group-hover:bg-slate-300/80 transition-colors">
                      Read-Only
                    </span>
                  </div>
                  <div className="text-slate-600 mt-0.5 truncate text-2xs">viewer@example.com</div>
                  <div className="text-slate-400 font-mono text-3xs">viewer-password-123</div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

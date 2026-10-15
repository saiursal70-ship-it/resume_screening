import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import type { JobListItem } from '../types';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

export default function JobListPage() {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Form states
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // AI Bot Job Description Generator states
  const [isGeneratingDesc, setIsGeneratingDesc] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [seniority, setSeniority] = useState<string>('');
  const [aiBotNote, setAiBotNote] = useState<string | null>(null);
  const [fullGeneratedText, setFullGeneratedText] = useState<string>('');
  const typingTimerRef = useRef<number | null>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { isHR } = useAuth();
  const navigate = useNavigate();

  const stopTyping = () => {
    if (typingTimerRef.current !== null) {
      window.clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setIsTyping(false);
  };

  const fastFinishTyping = () => {
    if (typingTimerRef.current !== null) {
      window.clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (fullGeneratedText) {
      setDescription(fullGeneratedText);
    }
    setIsTyping(false);
    setAiBotNote('✨ AI Bot finished typing! You can edit or tweak any part before creating.');
  };

  const handleAiGenerateDescription = async () => {
    if (!title.trim() || title.trim().length < 2) {
      setCreateError('Please enter a Job Title first so the AI Bot knows what to write!');
      return;
    }

    try {
      stopTyping();
      setIsGeneratingDesc(true);
      setCreateError(null);
      setAiBotNote(null);

      const res = await api.jobs.generateDescription({
        title: title.trim(),
        seniority: seniority || undefined,
      });

      const fullText = res?.description || '';
      if (!fullText) {
        throw new Error('No description was returned by the AI Bot.');
      }

      setFullGeneratedText(fullText);
      setIsGeneratingDesc(false);
      setIsTyping(true);
      setDescription('');

      // Focus textarea
      setTimeout(() => {
        if (descriptionTextareaRef.current) {
          descriptionTextareaRef.current.focus();
        }
      }, 50);

      let currentIdx = 0;
      const chunkSize = 4; // stream chunks for natural, responsive typewriter effect
      const intervalMs = 15;

      typingTimerRef.current = window.setInterval(() => {
        currentIdx += chunkSize;
        if (currentIdx >= fullText.length) {
          setDescription(fullText);
          if (typingTimerRef.current !== null) {
            window.clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
          }
          setIsTyping(false);
          setAiBotNote('✨ AI Bot finished typing! Review the requirements below or adjust any text.');
        } else {
          setDescription(fullText.slice(0, currentIdx));
          if (descriptionTextareaRef.current) {
            descriptionTextareaRef.current.scrollTop = descriptionTextareaRef.current.scrollHeight;
          }
        }
      }, intervalMs);
    } catch (err) {
      setIsGeneratingDesc(false);
      setIsTyping(false);
      setCreateError(
        err instanceof Error ? err.message : 'AI Bot encountered an issue generating the description.'
      );
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimerRef.current !== null) {
        window.clearInterval(typingTimerRef.current);
      }
    };
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.jobs.list();
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleCreateJob = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setCreateError('Please provide both a title and job description.');
      return;
    }

    try {
      stopTyping();
      setCreating(true);
      setCreateError(null);
      const newJob = await api.jobs.create({
        title: title.trim(),
        description: description.trim(),
      });
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setAiBotNote(null);
      if (newJob && newJob.id) {
        navigate(`/jobs/${newJob.id}`);
      } else {
        await fetchJobs();
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create job.');
    } finally {
      setCreating(false);
    }
  };

  const filteredJobs = jobs.filter((job) =>
    (job.title || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-gray-200 gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              Job Postings & Screenings
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage open positions, screening criteria, and automated candidate evaluations.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {isHR && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition"
              >
                <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Create Job
              </button>
            )}
          </div>
        </div>

        {/* Search & Filters */}
        <div className="mt-6 flex items-center justify-between">
          <div className="relative max-w-xs w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search jobs..."
              className="pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg w-full bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredJobs.length} of {jobs.length} jobs
          </span>
        </div>

        {/* Content Section */}
        <div className="mt-6">
          {loading ? (
            <LoadingSpinner message="Loading job postings..." />
          ) : error ? (
            <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
              <svg className="w-8 h-8 text-red-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-sm font-semibold text-red-800">Error loading jobs</h3>
              <p className="text-xs text-red-600 mt-1">{error}</p>
              <button
                onClick={fetchJobs}
                className="mt-4 px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
              >
                Try Again
              </button>
            </div>
          ) : filteredJobs.length === 0 ? (
            <EmptyState
              title={searchTerm ? 'No matching jobs found' : 'No jobs created yet'}
              description={
                searchTerm
                  ? `No jobs match "${searchTerm}". Clear your search query to see all jobs.`
                  : isHR
                  ? 'Get started by creating your first job posting. AI will automatically draft requirements!'
                  : 'No jobs are currently available to view.'
              }
              action={
                !searchTerm && isHR ? (
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition"
                  >
                    + Create First Job
                  </button>
                ) : null
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredJobs.map((job) => {
                const isOpen =
                  (job.status || '').toLowerCase() === 'open' || job.requirements_confirmed === true;

                return (
                  <Link
                    key={job.id}
                    to={`/jobs/${job.id}`}
                    className="group bg-white rounded-xl shadow-xs border border-slate-200 hover:border-emerald-400 hover:shadow-md transition duration-200 flex flex-col justify-between p-6"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isOpen
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              isOpen ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          {isOpen ? 'Open' : 'Draft'}
                        </span>

                        <span className="text-xs text-slate-400">
                          {job.created_at
                            ? new Date(job.created_at).toLocaleDateString()
                            : ''}
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition line-clamp-1">
                        {job.title}
                      </h3>

                      {job.description && (
                        <p className="mt-2 text-xs text-slate-500 line-clamp-3 leading-relaxed">
                          {job.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center space-x-1.5 font-medium">
                        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                        <span>
                          <strong className="text-slate-900 font-bold">{job.candidate_count ?? 0}</strong>{' '}
                          candidates
                        </span>
                      </div>

                      <span className="font-semibold text-emerald-600 group-hover:translate-x-1 transition-transform inline-flex items-center">
                        View Details &rarr;
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Create Job Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-emerald-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">Create New Job Posting</h3>
                  <p className="text-xs text-slate-500">AI-assisted requirement extraction & automated candidate screening</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopTyping();
                  setIsModalOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 text-xl font-bold transition"
              >
                &times;
              </button>
            </div>

            {createError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
                <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateJob} className="mt-5 space-y-4">
              {/* Job Title */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Job Title <span className="text-red-500">*</span>
                  </label>
                  {title.trim().length >= 2 && !isTyping && !isGeneratingDesc && (
                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                      <span>✓ Title ready for AI Bot</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (createError) setCreateError(null);
                    }}
                    placeholder="e.g. Senior Backend Engineer (Python / FastAPI)"
                    className="w-full pl-3.5 pr-28 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-2xs transition"
                  />
                  {title.trim().length >= 2 && !isTyping && !isGeneratingDesc && (
                    <button
                      type="button"
                      onClick={handleAiGenerateDescription}
                      className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition hover:scale-[1.02] active:scale-[0.98]"
                      title="Let AI Bot type the job description for this title"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>AI Type</span>
                    </button>
                  )}
                </div>
              </div>

              {/* AI Bot Assistant Panel */}
              <div className="bg-gradient-to-br from-emerald-50/90 via-teal-50/60 to-slate-50/70 border border-emerald-100/90 rounded-xl p-3.5 shadow-xs transition">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 flex items-center justify-center text-white shadow-sm">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      {isTyping && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 tracking-tight">AI Job Description Bot</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200/60">
                          {isTyping ? 'Typing live' : 'Smart Generator'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                        {isTyping
                          ? '🤖 Bot is streaming your job description live below...'
                          : isGeneratingDesc
                          ? '🧠 AI is designing responsibilities, must-haves & tech stack...'
                          : title.trim().length >= 2
                          ? `Ready to write comprehensive description for "${title.slice(0, 28)}${title.length > 28 ? '...' : ''}"`
                          : 'Type a Job Title above to let the AI Bot automatically write your description.'}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isTyping ? (
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={fastFinishTyping}
                          className="px-2.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1 shadow-xs"
                          title="Skip typing animation and show full description"
                        >
                          <span>⚡ Fast Finish</span>
                        </button>
                        <button
                          type="button"
                          onClick={stopTyping}
                          className="px-2 py-1.5 text-xs font-medium bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition"
                          title="Stop typing"
                        >
                          ⏹️ Stop
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleAiGenerateDescription}
                        disabled={isGeneratingDesc || title.trim().length < 2}
                        className="px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-xs hover:shadow transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transform active:scale-[0.98]"
                      >
                        {isGeneratingDesc ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            <span>Drafting...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Type Description with AI</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Seniority Selector Pills */}
                <div className="mt-2.5 pt-2 border-t border-emerald-100/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700">Seniority calibration:</span>
                  <div className="flex items-center space-x-1">
                    {['Auto', 'Junior', 'Mid-Level', 'Senior', 'Lead / Staff'].map((lvl) => {
                      const active = seniority === lvl || (lvl === 'Auto' && seniority === '');
                      return (
                        <button
                          key={lvl}
                          type="button"
                          disabled={isTyping || isGeneratingDesc}
                          onClick={() => setSeniority(lvl === 'Auto' ? '' : lvl)}
                          className={`px-2 py-0.5 rounded-md font-medium text-[10px] transition ${
                            active
                              ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                              : 'bg-white/90 text-slate-600 hover:bg-white hover:text-emerald-600 border border-slate-200'
                          }`}
                        >
                          {lvl}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Job Description Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Job Description <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                    {isTyping && (
                      <span className="inline-flex items-center text-emerald-600 font-semibold animate-pulse">
                        <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full mr-1.5"></span>
                        AI Bot typing...
                      </span>
                    )}
                    <span>{description.trim() ? description.trim().split(/\s+/).filter(Boolean).length : 0} words</span>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    ref={descriptionTextareaRef}
                    required
                    rows={8}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      if (isTyping) stopTyping();
                    }}
                    placeholder="Type or click 'Type Description with AI' above to let the AI Bot automatically generate a complete job description with role overview, key responsibilities, must-haves, nice-to-haves, and tech stack..."
                    className={`w-full px-3.5 py-2.5 text-xs font-mono leading-relaxed border rounded-xl transition duration-150 ${
                      isTyping
                        ? 'border-emerald-500 ring-2 ring-emerald-200 bg-emerald-50/20'
                        : 'border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white'
                    }`}
                  />
                  {isTyping && (
                    <span className="absolute bottom-3 right-3 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs animate-bounce">
                      Typing...
                    </span>
                  )}
                </div>

                {aiBotNote && (
                  <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{aiBotNote}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAiBotNote(null)}
                      className="text-emerald-600 hover:text-emerald-800 font-bold ml-2 text-base leading-none"
                    >
                      &times;
                    </button>
                  </div>
                )}

                <p className="mt-1.5 text-xs text-slate-500">
                  Tip: A detailed job description helps the AI produce highly calibrated must-have and nice-to-have screening criteria.
                </p>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    stopTyping();
                    setIsModalOpen(false);
                  }}
                  disabled={creating}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || isGeneratingDesc}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition flex items-center disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Creating & Drafting Criteria...
                    </>
                  ) : (
                    'Create Job & Draft Criteria'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Job, Requirement } from '../types';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import RequirementEditor from '../components/RequirementEditor';
import ResumeUpload from '../components/ResumeUpload';
import CandidateList from '../components/CandidateList';

type JobWithRequirements = Job & { requirements?: Requirement[] };

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isHR } = useAuth();

  const [job, setJob] = useState<JobWithRequirements | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'candidates' | 'requirements'>('candidates');
  const [candidateRefreshTrigger, setCandidateRefreshTrigger] = useState<number>(0);

  const fetchJob = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.jobs.get(id);
      // Support both JobDetailOut { job: {...}, requirements: [...] } and flattened job object
      const normalizedJob: JobWithRequirements | null = data?.job
        ? { ...data.job, requirements: data.requirements || [] }
        : (data as unknown as JobWithRequirements);

      setJob(normalizedJob);

      // If requirements not confirmed, default tab to requirements
      const isConfirmed =
        normalizedJob?.requirements_confirmed === true ||
        (normalizedJob?.status || '').toLowerCase() === 'open';
      if (!isConfirmed) {
        setActiveTab('requirements');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  const handleRequirementConfirmed = (updatedJob: Job) => {
    setJob((prev) =>
      prev
        ? {
            ...prev,
            ...updatedJob,
            requirements_confirmed: true,
            status: 'open',
          }
        : null
    );
    setActiveTab('candidates');
  };

  const handleUploadSuccess = () => {
    setCandidateRefreshTrigger((prev) => prev + 1);
  };

  const handleRequirementsUpdated = (updatedReqs: Requirement[]) => {
    setJob((prev) => (prev ? { ...prev, requirements: updatedReqs } : null));
    setCandidateRefreshTrigger((prev) => prev + 1);
  };

  const isConfirmed =
    job?.requirements_confirmed === true || (job?.status || '').toLowerCase() === 'open';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb / Back button */}
        <div className="mb-4">
          <Link
            to="/jobs"
            className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-emerald-600 transition"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to All Jobs
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner fullScreen={false} message="Loading position details..." />
        ) : error ? (
          <div className="p-8 bg-red-50 border border-red-200 rounded-xl text-center">
            <svg className="w-10 h-10 text-red-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-base font-bold text-red-800">Job Not Found or Error</h3>
            <p className="text-sm text-red-600 mt-1">{error}</p>
            <button
              onClick={fetchJob}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
            >
              Retry
            </button>
          </div>
        ) : !job ? (
          <div className="p-8 text-center text-slate-500">Job details unavailable.</div>
        ) : (
          <div className="space-y-6">
            {/* Job Header Card */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      {job.title}
                    </h1>
                    <span
                      className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold ${
                        isConfirmed
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          isConfirmed ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      {isConfirmed ? 'Open (Active)' : 'Draft (Requirements Pending)'}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-500 flex items-center gap-4">
                    <span>
                      Created: {job.created_at ? new Date(job.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                    <span>&bull;</span>
                    <span>
                      Criteria count: {job.requirements?.length ?? 0} requirement(s)
                    </span>
                  </p>
                </div>

                {/* Status indicator callout */}
                <div className="text-right">
                  {!isConfirmed && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 max-w-sm text-left">
                      <strong>Action required:</strong> Review and confirm the screening criteria below.
                      Once confirmed, the job is opened for resume uploads.
                    </div>
                  )}
                </div>
              </div>

              {/* Collapsible Job Description */}
              {job.description && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <details className="text-xs text-slate-600 group">
                    <summary className="font-semibold cursor-pointer text-emerald-600 hover:text-emerald-800 focus:outline-hidden list-none flex items-center gap-1">
                      <span>View Full Job Description</span>
                      <svg className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="mt-2 p-3 bg-slate-50 rounded-lg text-slate-700 whitespace-pre-line leading-relaxed max-h-60 overflow-y-auto border border-slate-200">
                      {job.description}
                    </div>
                  </details>
                </div>
              )}
            </div>

            {/* Navigation Tabs (if confirmed) */}
            {isConfirmed ? (
              <div>
                <div className="border-b border-slate-200">
                  <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                      type="button"
                      onClick={() => setActiveTab('candidates')}
                      className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition ${
                        activeTab === 'candidates'
                          ? 'border-emerald-600 text-emerald-600'
                          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span>Candidates & Screening</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('requirements')}
                      className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition ${
                        activeTab === 'requirements'
                          ? 'border-emerald-600 text-emerald-600'
                          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 01-2 2v12a2 2 0 012 2h10a2 2 0 012-2V7a2 2 0 01-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <span>Screening Criteria ({job.requirements?.length || 0})</span>
                      </div>
                    </button>
                  </nav>
                </div>

                <div className="mt-6">
                  {activeTab === 'candidates' ? (
                    <div className="space-y-6">
                      {/* Upload section (Only HR can upload) */}
                      {isHR && (
                        <ResumeUpload
                          jobId={id || job.id}
                          onUploadSuccess={handleUploadSuccess}
                        />
                      )}

                      {/* Candidates ranked table */}
                      <CandidateList
                        jobId={id || job.id}
                        isHR={isHR}
                        refreshTrigger={candidateRefreshTrigger}
                      />
                    </div>
                  ) : (
                    <RequirementEditor
                      jobId={id || job.id}
                      initialRequirements={job.requirements || []}
                      isConfirmed={isConfirmed}
                      isHR={isHR}
                      onConfirmed={handleRequirementConfirmed}
                      onRequirementsUpdated={handleRequirementsUpdated}
                    />
                  )}
                </div>
              </div>
            ) : (
              /* Draft state: Show Requirements Editor prominently */
              <div className="space-y-6">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <svg className="w-6 h-6 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-bold text-amber-900">Step 1: Finalize Screening Criteria</h4>
                      <p className="text-xs text-amber-700">
                        Customize or generate criteria below. When ready, click &ldquo;Confirm Requirements&rdquo; to unlock resume uploading.
                      </p>
                    </div>
                  </div>
                </div>

                <RequirementEditor
                  jobId={id || job.id}
                  initialRequirements={job.requirements || []}
                  isConfirmed={isConfirmed}
                  isHR={isHR}
                  onConfirmed={handleRequirementConfirmed}
                  onRequirementsUpdated={handleRequirementsUpdated}
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

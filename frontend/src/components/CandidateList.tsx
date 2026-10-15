import { useState, useEffect, useCallback, useRef } from 'react';
import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { CandidateListItem, Stage } from '../types';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';

type StageFilter = Stage | 'ALL';

const STAGE_OPTIONS: { value: StageFilter; label: string }[] = [
  { value: 'ALL', label: 'All Stages' },
  { value: 'new', label: 'New' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'rejected', label: 'Rejected' },
];

function formatStageLabel(stage: string | null | undefined): string {
  const s = (stage || '').toLowerCase().replace(/[\s-]/g, '_');
  if (s === 'shortlisted') return 'Shortlisted';
  if (s === 'rejected') return 'Rejected';
  if (s === 'on_hold') return 'On Hold';
  return 'New';
}

interface CandidateListProps {
  jobId: number | string;
  isHR?: boolean;
  refreshTrigger?: number;
}

export default function CandidateList({
  jobId,
  isHR = false,
  refreshTrigger = 0,
}: CandidateListProps) {
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<StageFilter>('ALL');
  const [sortBy, setSortBy] = useState<string>('score');
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCandidates = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        setError(null);
        const data = await api.candidates.list(jobId, {
          stage: selectedStage,
          sort: sortBy,
        });
        setCandidates(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : 'Failed to fetch candidate list.');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [jobId, selectedStage, sortBy]
  );

  useEffect(() => {
    fetchCandidates(false);
  }, [fetchCandidates, refreshTrigger]);

  // Auto-refresh while any candidate has status 'queued' or 'processing' (every 3 seconds)
  useEffect(() => {
    const hasPending = candidates.some((c) => {
      const status = (c.status || '').toLowerCase();
      return status === 'queued' || status === 'processing';
    });

    if (hasPending) {
      pollTimerRef.current = setInterval(() => {
        fetchCandidates(true);
      }, 3000);
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [candidates, fetchCandidates]);

  const handleRetry = async (candidateId: number, e: MouseEvent) => {
    e.stopPropagation();
    try {
      setRetryingId(candidateId);
      await api.candidates.retry(candidateId);
      await fetchCandidates(true);
    } catch (err) {
      alert(`Retry failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRetryingId(null);
    }
  };

  const renderStageBadge = (stage: string | null | undefined) => {
    const s = (stage || 'new').toLowerCase();
    let badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
    if (s.includes('shortlist')) {
      badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (s.includes('reject')) {
      badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
    } else if (s.includes('hold')) {
      badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
    }

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeClass}`}
      >
        {formatStageLabel(stage)}
      </span>
    );
  };

  const renderStatusBadge = (status: string | null | undefined) => {
    const st = (status || '').toLowerCase();
    if (st === 'done') {
      return (
        <span className="inline-flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
          <svg className="w-3 h-3 mr-1 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          Done
        </span>
      );
    }
    if (st === 'processing') {
      return (
        <span className="inline-flex items-center text-xs font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-pulse">
          <svg className="w-3 h-3 mr-1 animate-spin text-emerald-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Processing
        </span>
      );
    }
    if (st === 'queued') {
      return (
        <span className="inline-flex items-center text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
          <svg className="w-3 h-3 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Queued
        </span>
      );
    }
    if (st === 'failed') {
      return (
        <span className="inline-flex items-center text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
          <svg className="w-3 h-3 mr-1 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
          Failed
        </span>
      );
    }
    return <span className="text-xs text-gray-500">{status || '—'}</span>;
  };

  const renderScoreBar = (score: number | null | undefined, status: string) => {
    if (status === 'queued' || status === 'processing') {
      return <span className="text-xs text-gray-400 italic">Evaluating...</span>;
    }
    if (score === null || score === undefined) {
      return <span className="text-xs text-gray-400">—</span>;
    }

    const numScore = Math.round(Number(score));
    let colorClass = 'bg-emerald-500';
    let textColorClass = 'text-emerald-700';
    if (numScore < 50) {
      colorClass = 'bg-rose-500';
      textColorClass = 'text-rose-700';
    } else if (numScore < 75) {
      colorClass = 'bg-amber-500';
      textColorClass = 'text-amber-700';
    }

    return (
      <div className="flex items-center space-x-2.5 min-w-[120px]">
        <div className="w-16 bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full ${colorClass} transition-all duration-500`}
            style={{ width: `${Math.min(100, Math.max(0, numScore))}%` }}
          />
        </div>
        <span className={`text-sm font-bold ${textColorClass}`}>{numScore}%</span>
      </div>
    );
  };

  const renderMissingMustHaves = (missing: string[] | null | undefined) => {
    if (!missing || missing.length === 0) {
      return (
        <span className="inline-flex items-center text-xs font-medium text-emerald-700">
          <svg className="w-3.5 h-3.5 mr-1 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          None (All Met)
        </span>
      );
    }

    const count = missing.length;
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        <svg className="w-3.5 h-3.5 mr-1 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        {count} Missing
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
      {/* Table controls / Header */}
      <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Ranked Candidates</h3>
          <p className="text-sm text-gray-500">
            {candidates.length} candidate{candidates.length === 1 ? '' : 's'} evaluated
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Stage filter */}
          <div className="flex items-center space-x-2">
            <label className="text-xs font-medium text-gray-500">Filter Stage:</label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value as StageFilter)}
              className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-emerald-500"
            >
              {STAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort order */}
          <div className="flex items-center space-x-2">
            <label className="text-xs font-medium text-slate-500">Sort By:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="score">Score (High to Low)</option>
              <option value="created_at">Date Uploaded</option>
            </select>
          </div>

          {/* Manual refresh button */}
          <button
            onClick={() => fetchCandidates(false)}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-md transition"
            title="Refresh candidate list"
          >
            <svg
              className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="m-5 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-sm text-red-700">
          <span>{error}</span>
          <button
            onClick={() => fetchCandidates(false)}
            className="text-xs font-semibold underline text-red-700 hover:text-red-900 ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && candidates.length === 0 ? (
        <LoadingSpinner message="Loading candidates..." />
      ) : candidates.length === 0 ? (
        <div className="p-8">
          <EmptyState
            title="No candidates yet"
            description={
              selectedStage !== 'ALL'
                ? `No candidates found with stage "${formatStageLabel(selectedStage)}". Try changing the filter.`
                : 'Upload resumes above to see AI-graded candidate results here.'
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50/75 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-5 py-3.5 w-16 text-center">
                  Rank
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Candidate / Filename
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Score
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Stage
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Status
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Missing Must-Haves
                </th>
                <th scope="col" className="px-5 py-3.5 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {candidates.map((candidate, index) => {
                const isFailed = (candidate.status || '').toLowerCase() === 'failed';

                return (
                  <tr
                    key={candidate.id}
                    className="hover:bg-emerald-50/30 transition-colors group cursor-pointer"
                  >
                    {/* Rank */}
                    <td className="px-5 py-4 text-center font-medium text-slate-500 text-xs">
                      {index + 1}
                    </td>

                    {/* Name / Filename */}
                    <td className="px-5 py-4">
                      <Link
                        to={`/candidates/${candidate.id}`}
                        className="font-semibold text-slate-900 group-hover:text-emerald-600 transition flex items-center space-x-2"
                      >
                        <svg
                          className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        <span className="truncate max-w-xs">{candidate.filename}</span>
                      </Link>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Uploaded {new Date(candidate.created_at).toLocaleDateString()}
                      </div>
                    </td>

                    {/* Score */}
                    <td className="px-5 py-4">
                      {renderScoreBar(candidate.score, candidate.status)}
                    </td>

                    {/* Stage */}
                    <td className="px-5 py-4">
                      {renderStageBadge(candidate.stage)}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      {renderStatusBadge(candidate.status)}
                    </td>

                    {/* Missing must-haves */}
                    <td className="px-5 py-4">
                      {renderMissingMustHaves(candidate.missing_must_haves)}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {isFailed && isHR && (
                          <button
                            type="button"
                            onClick={(e) => handleRetry(candidate.id, e)}
                            disabled={retryingId === candidate.id}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition disabled:opacity-50"
                          >
                            {retryingId === candidate.id ? 'Retrying...' : 'Retry'}
                          </button>
                        )}
                        <Link
                          to={`/candidates/${candidate.id}`}
                          className="text-xs font-medium text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md transition"
                        >
                          View Details &rarr;
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

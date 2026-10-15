import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { CandidateDetail } from '../types';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import StageManager from '../components/StageManager';

interface VerdictItem {
  category?: string;
  requirement_text?: string;
  verdict?: string;
  reasoning?: string;
  quote?: string;
  quote_verified?: boolean;
  [key: string]: unknown;
}

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isHR } = useAuth();

  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showRedacted, setShowRedacted] = useState<boolean>(false);
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<boolean>(false);

  const fetchCandidate = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.candidates.get(id);
      setCandidate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load candidate details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCandidate();
  }, [fetchCandidate]);

  const handleStageUpdated = (updatedCandidate: CandidateDetail) => {
    setCandidate((prev) =>
      prev
        ? {
            ...prev,
            ...updatedCandidate,
          }
        : null
    );
  };

  const handleRetry = async () => {
    if (!id) return;
    try {
      setRetrying(true);
      await api.candidates.retry(id);
      await fetchCandidate();
    } catch (err) {
      alert(`Retry failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRetrying(false);
    }
  };

  // Group and sort verdicts: Must-haves first, then nice-to-haves
  const verdicts = useMemo<VerdictItem[]>(() => {
    const rawVerdicts = (candidate?.screening_result?.verdicts as VerdictItem[]) || [];
    return [...rawVerdicts].sort((a, b) => {
      const aIsMust =
        a.category === 'must_have' ||
        a.category === 'must-have' ||
        (a.requirement_text || '').toLowerCase().includes('must');
      const bIsMust =
        b.category === 'must_have' ||
        b.category === 'must-have' ||
        (b.requirement_text || '').toLowerCase().includes('must');
      if (aIsMust && !bIsMust) return -1;
      if (!aIsMust && bIsMust) return 1;
      return 0;
    });
  }, [candidate]);

  // Extract all quotes from verdicts for resume highlighting
  const evidenceQuotes = useMemo<string[]>(() => {
    return verdicts
      .map((v) => v.quote)
      .filter((q): q is string => typeof q === 'string' && q.trim().length > 5);
  }, [verdicts]);

  const renderVerdictBadge = (verdict?: string | null) => {
    const v = (verdict || '').toLowerCase().replace(/[^a-z]/g, '');
    if (v === 'met' || v === 'yes' || v === 'pass') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          Met &#10003;
        </span>
      );
    }
    if (v === 'notmet' || v === 'no' || v === 'fail') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
          Not Met &#10007;
        </span>
      );
    }
    if (v === 'partial') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
          Partial ~
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-800 border border-gray-300">
        Unknown ?
      </span>
    );
  };

  const getScoreColor = (score?: number | null) => {
    if (score === null || score === undefined) return 'text-gray-400 border-gray-200';
    const s = Number(score);
    if (s >= 75) return 'text-emerald-600 border-emerald-500 bg-emerald-50/50';
    if (s >= 50) return 'text-amber-600 border-amber-500 bg-amber-50/50';
    return 'text-rose-600 border-rose-500 bg-rose-50/50';
  };

  // Helper to render text with highlighted quotes
  const renderHighlightedResume = (text?: string | null) => {
    if (!text) {
      return (
        <p className="text-gray-400 italic p-6">No raw text extracted for this resume.</p>
      );
    }

    if (evidenceQuotes.length === 0) {
      return <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-800">{text}</div>;
    }

    // Escape special regex characters in quotes
    const escapeRegex = (string: string) =>
      string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Sort quotes by length descending to match longest first
    const sortedQuotes = [...new Set(evidenceQuotes)].sort((a, b) => b.length - a.length);

    try {
      // Build regex pattern matching any of the quotes
      const pattern = new RegExp(`(${sortedQuotes.map(escapeRegex).join('|')})`, 'gi');
      const parts = text.split(pattern);

      return (
        <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-800">
          {parts.map((part, i) => {
            const isMatch = sortedQuotes.some(
              (q) => q.toLowerCase() === part.toLowerCase()
            );

            if (isMatch) {
              const isSelected =
                selectedQuote &&
                selectedQuote.toLowerCase() === part.toLowerCase();

              return (
                <mark
                  key={i}
                  id={`quote-${i}`}
                  className={`px-1 py-0.5 rounded transition ${
                    isSelected
                      ? 'bg-amber-300 text-gray-900 font-semibold ring-2 ring-amber-500'
                      : 'bg-yellow-100 text-yellow-900 border-b-2 border-yellow-400 hover:bg-yellow-200'
                  }`}
                  title="Evidence quote referenced by AI verdict"
                >
                  {part}
                </mark>
              );
            }
            return part;
          })}
        </div>
      );
    } catch {
      return <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-800">{text}</div>;
    }
  };

  const isFailed = (candidate?.status || '').toLowerCase() === 'failed';
  const isProcessing =
    (candidate?.status || '').toLowerCase() === 'processing' ||
    (candidate?.status || '').toLowerCase() === 'queued';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header navigation & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200 gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition"
              title="Go back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {candidate?.filename || 'Candidate Screening'}
                </h1>
                {isProcessing && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 animate-pulse">
                    AI Evaluating...
                  </span>
                )}
                {isFailed && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                    Evaluation Failed
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Uploaded {candidate?.created_at ? new Date(candidate.created_at).toLocaleString() : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {isFailed && isHR && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying}
                className="inline-flex items-center px-3.5 py-2 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition disabled:opacity-50"
              >
                {retrying ? 'Retrying...' : 'Retry Evaluation'}
              </button>
            )}
            <button
              type="button"
              onClick={fetchCandidate}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              title="Reload data"
            >
              <svg className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {loading && !candidate ? (
          <div className="py-16">
            <LoadingSpinner fullScreen={false} message="Loading candidate dossier..." />
          </div>
        ) : error ? (
          <div className="mt-8 p-8 bg-red-50 border border-red-200 rounded-xl text-center">
            <h3 className="text-base font-bold text-red-800">Error loading candidate</h3>
            <p className="text-sm text-red-600 mt-1">{error}</p>
            <button
              onClick={fetchCandidate}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
            >
              Retry
            </button>
          </div>
        ) : !candidate ? (
          <div className="mt-8 text-center text-slate-500">Candidate not found.</div>
        ) : (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* ================= LEFT PANEL: RESUME TEXT (lg:col-span-6) ================= */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-14rem)] min-h-[500px]">
                {/* Resume Header & Controls */}
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h2 className="text-sm font-bold text-slate-900">Resume Content</h2>
                  </div>

                  <div className="flex items-center space-x-2">
                    {candidate.redacted_text && (
                      <button
                        type="button"
                        onClick={() => setShowRedacted(!showRedacted)}
                        className={`text-xs px-2.5 py-1 rounded font-medium border transition ${
                          showRedacted
                            ? 'bg-teal-100 text-teal-800 border-teal-300'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {showRedacted ? 'Redacted View (PII Masked)' : 'Full View'}
                      </button>
                    )}

                    {selectedQuote && (
                      <button
                        type="button"
                        onClick={() => setSelectedQuote(null)}
                        className="text-xs text-emerald-600 hover:underline"
                      >
                        Clear Focus
                      </button>
                    )}
                  </div>
                </div>

                {/* Info legend */}
                <div className="px-4 py-2 bg-yellow-50/70 border-b border-yellow-100 text-3xs text-yellow-800 flex items-center justify-between">
                  <span>
                    <mark className="bg-yellow-200 px-1 py-0.5 rounded mr-1 font-semibold">Yellow highlight</mark>
                    indicates evidence quotes verified by the screening model.
                  </span>
                  <span>{evidenceQuotes.length} quotes referenced</span>
                </div>

                {/* Resume scrollable text body */}
                <div className="flex-1 p-6 overflow-y-auto bg-white font-mono text-xs leading-relaxed selection:bg-emerald-100">
                  {renderHighlightedResume(
                    showRedacted ? candidate.redacted_text : candidate.resume_text
                  )}
                </div>

                {/* Profile Data (if extracted) */}
                {candidate.profile_data && Object.keys(candidate.profile_data).length > 0 && (
                  <div className="p-3 bg-gray-50 border-t border-gray-200 text-xs">
                    <span className="font-bold text-gray-600 uppercase tracking-wider block mb-1">
                      Parsed Profile Information:
                    </span>
                    <div className="flex flex-wrap gap-2 text-gray-700">
                      {Object.entries(candidate.profile_data).map(([key, val]) => (
                        <span key={key} className="bg-white px-2 py-0.5 rounded border border-gray-200">
                          <strong>{key}:</strong> {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ================= RIGHT PANEL: SCREENING RESULTS (lg:col-span-6) ================= */}
            <div className="lg:col-span-6 space-y-6">
              {/* Score & Verdict Overview Card */}
              <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  {/* Score circle / gauge */}
                  <div className="flex items-center space-x-4">
                    <div
                      className={`w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center font-black ${getScoreColor(
                        candidate.score
                      )}`}
                    >
                      <span className="text-2xl leading-none">
                        {candidate.score !== null && candidate.score !== undefined
                          ? Math.round(candidate.score)
                          : '—'}
                      </span>
                      <span className="text-3xs uppercase tracking-wider mt-0.5">Score</span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Overall AI Match</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Weighted evaluation based on confirmed job criteria.
                      </p>
                      {candidate.missing_must_haves &&
                        ((Array.isArray(candidate.missing_must_haves) &&
                          candidate.missing_must_haves.length > 0) ||
                          (typeof candidate.missing_must_haves === 'number' &&
                            candidate.missing_must_haves > 0)) && (
                          <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Missing Must-Have Requirements
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-gray-400 block">Evaluated Status</span>
                    <span className="font-semibold text-gray-700 capitalize">
                      {candidate.status || 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stage Manager Component */}
              <StageManager
                candidateId={candidate.id}
                currentStage={candidate.stage || 'new'}
                isHR={isHR}
                onStageUpdated={handleStageUpdated}
              />

              {/* Requirements Verdicts Breakdown Card */}
              <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Criteria Evaluation Breakdown</h3>
                    <p className="text-xs text-gray-500">
                      Detailed AI verdicts and cited quote verification.
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 font-medium">
                    {verdicts.length} Criteria Evaluated
                  </span>
                </div>

                {verdicts.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 text-xs">
                    {isProcessing
                      ? 'AI is currently analyzing the candidate against the requirements...'
                      : 'No verdict details available yet for this candidate.'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {verdicts.map((item, idx) => {
                      const isMustHave =
                        item.category === 'must_have' ||
                        item.category === 'must-have' ||
                        (item.requirement_text || '').toLowerCase().includes('must');
                      const isVerified = item.quote_verified === true;
                      const hasQuote = typeof item.quote === 'string' && item.quote.trim().length > 0;

                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl border transition-all ${
                            isMustHave
                              ? 'bg-emerald-50/20 border-emerald-200 shadow-2xs'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          {/* Requirement text and badge */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {isMustHave ? (
                                  <span className="px-2 py-0.5 rounded text-3xs font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                                    ★ Must-Have
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-3xs font-semibold uppercase tracking-wider bg-teal-100 text-teal-800 border border-teal-200">
                                    Nice-to-Have
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                                {item.requirement_text}
                              </h4>
                            </div>

                            <div className="shrink-0">{renderVerdictBadge(item.verdict)}</div>
                          </div>

                          {/* Reasoning */}
                          {item.reasoning && (
                            <div className="mt-2.5 text-xs text-slate-700 leading-relaxed">
                              <span className="font-semibold text-slate-900">Reasoning: </span>
                              {item.reasoning}
                            </div>
                          )}

                          {/* Evidence Quote */}
                          {hasQuote ? (
                            <div className="mt-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-3xs font-bold text-slate-500 uppercase tracking-wider">
                                  Evidence Quote from Resume:
                                </span>
                                <div className="flex items-center space-x-2">
                                  {isVerified ? (
                                    <span className="inline-flex items-center text-3xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                      <svg className="w-3 h-3 mr-0.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                      Quote Verified &#10003;
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center text-3xs font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                                      <svg className="w-3 h-3 mr-0.5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                      </svg>
                                      Unverified Quote &#10007;
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedQuote(item.quote || null)}
                                    className="text-3xs text-emerald-600 hover:underline"
                                    title="Highlight this quote in the resume text"
                                  >
                                    Focus in Resume
                                  </button>
                                </div>
                              </div>

                              <blockquote className="p-2.5 bg-slate-50 rounded border-l-4 border-emerald-400 font-mono text-xs text-slate-800 italic">
                                &ldquo;{item.quote}&rdquo;
                              </blockquote>

                              {!isVerified && (
                                <p className="mt-1 text-3xs text-amber-700 italic">
                                  Caution: This exact phrase was not verbatim verified in the extracted resume text.
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="mt-2 text-3xs text-gray-400 italic">
                              No explicit quote cited for this requirement.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

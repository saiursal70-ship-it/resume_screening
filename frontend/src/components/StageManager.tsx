import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { api } from '../api/client';
import type { CandidateDetail, Stage, StageHistory } from '../types';

const STAGE_OPTIONS: { value: Stage; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'rejected', label: 'Rejected' },
];

const VALID_STAGES: Stage[] = ['new', 'shortlisted', 'rejected', 'on_hold'];

function formatStageLabel(stage: string | null | undefined): string {
  const s = (stage || '').toLowerCase().replace(/[\s-]/g, '_');
  if (s === 'shortlisted') return 'Shortlisted';
  if (s === 'rejected') return 'Rejected';
  if (s === 'on_hold') return 'On Hold';
  return 'New';
}

function normalizeStageValue(stage: string | null | undefined): Stage {
  const s = (stage || '').toLowerCase().replace(/[\s-]/g, '_');
  return VALID_STAGES.find((v) => v === s) ?? 'new';
}

interface StageManagerProps {
  candidateId: number;
  currentStage?: string;
  isHR?: boolean;
  onStageUpdated?: (updated: CandidateDetail) => void;
}

export default function StageManager({
  candidateId,
  currentStage = 'new',
  isHR = false,
  onStageUpdated = () => {},
}: StageManagerProps) {
  const [stage, setStage] = useState<Stage>(normalizeStageValue(currentStage));
  const [selectedStage, setSelectedStage] = useState<Stage>(normalizeStageValue(currentStage));
  const [reason, setReason] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<StageHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);

  useEffect(() => {
    const norm = normalizeStageValue(currentStage);
    setStage(norm);
    setSelectedStage(norm);
  }, [currentStage]);

  const fetchHistory = useCallback(async () => {
    if (!candidateId) return;
    try {
      setLoadingHistory(true);
      const data = await api.candidates.getHistory(candidateId);
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch stage history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [candidateId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedStage === stage) {
      setError('Please select a different stage to update.');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason or note for this stage change.');
      return;
    }

    try {
      setIsUpdating(true);
      setError(null);
      const updated = await api.candidates.updateStage(candidateId, selectedStage, reason.trim());
      setStage(selectedStage);
      setReason('');
      onStageUpdated(updated);
      await fetchHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update stage.');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStageBadgeClass = (s: string | null | undefined) => {
    const val = (s || '').toLowerCase();
    if (val.includes('shortlist')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
    if (val.includes('reject')) {
      return 'bg-rose-100 text-rose-800 border-rose-300';
    }
    if (val.includes('hold')) {
      return 'bg-amber-100 text-amber-800 border-amber-300';
    }
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 space-y-6">
      {/* Current Stage Header */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Application Stage</h3>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getStageBadgeClass(
              stage
            )}`}
          >
            {formatStageLabel(stage)}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Track and update candidate progress through the hiring pipeline.
        </p>
      </div>

      {/* HR Stage Change Form */}
      {isHR && (
        <form onSubmit={handleSubmit} className="border-t border-gray-100 pt-4 space-y-3">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Move Candidate Stage
          </h4>

          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex justify-between items-center">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-red-500 font-bold ml-2"
              >
                &times;
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">New Stage</label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value as Stage)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {STAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} {opt.value === stage ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Reason / Feedback Note <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Meets core backend requirements, proceed to technical screen..."
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={isUpdating || selectedStage === stage}
            className="w-full py-2 px-4 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs disabled:opacity-50 transition flex items-center justify-center"
          >
            {isUpdating ? (
              <>
                <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Updating Stage...
              </>
            ) : (
              'Update Candidate Stage'
            )}
          </button>
        </form>
      )}

      {/* Stage History Timeline */}
      <div className="border-t border-slate-100 pt-4">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
          Stage History Timeline
        </h4>

        {loadingHistory ? (
          <div className="py-4 text-center text-xs text-slate-400">Loading history...</div>
        ) : history.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No stage changes recorded yet.</p>
        ) : (
          <div className="flow-root">
            <ul className="-mb-8">
              {history.map((event, idx) => {
                const isLast = idx === history.length - 1;
                return (
                  <li key={`${event.created_at}-${idx}`}>
                    <div className="relative pb-6">
                      {!isLast && (
                        <span
                          className="absolute top-4 left-3 -ml-px h-full w-0.5 bg-slate-200"
                          aria-hidden="true"
                        />
                      )}
                      <div className="relative flex items-start space-x-3">
                        <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center ring-4 ring-white shrink-0">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-900">
                              {event.from_stage ? `${formatStageLabel(event.from_stage)} → ` : ''}
                              <span className="text-emerald-600">
                                {formatStageLabel(event.to_stage)}
                              </span>
                            </span>
                            <span className="text-slate-400">
                              {event.created_at
                                ? new Date(event.created_at).toLocaleString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                          </div>
                          {event.changed_by_name && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              by <span className="font-medium">{event.changed_by_name}</span>
                            </p>
                          )}
                          {event.reason && (
                            <div className="mt-1.5 p-2 bg-slate-50 rounded text-xs text-slate-700 italic border-l-2 border-emerald-400">
                              &ldquo;{event.reason}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

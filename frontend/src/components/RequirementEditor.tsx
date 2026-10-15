import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { Job, Requirement, RequirementIn } from '../types';

interface EditableRequirement {
  id: number | string;
  job_id?: number;
  text: string;
  category: string;
  weight: number;
  sort_order: number;
}

interface RequirementEditorProps {
  jobId: number | string;
  initialRequirements?: Requirement[];
  isConfirmed?: boolean;
  isHR?: boolean;
  onConfirmed?: (job: Job) => void;
  onRequirementsUpdated?: (requirements: Requirement[]) => void;
}

export default function RequirementEditor({
  jobId,
  initialRequirements = [],
  isConfirmed = false,
  isHR = false,
  onConfirmed = () => {},
  onRequirementsUpdated = () => {},
}: RequirementEditorProps) {
  const [requirements, setRequirements] = useState<EditableRequirement[]>([]);
  const [isEditing, setIsEditing] = useState<boolean>(!isConfirmed);
  const [saving, setSaving] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [rescreening, setRescreening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  useEffect(() => {
    const sorted = [...(initialRequirements || [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    setRequirements(sorted);
    setIsDirty(false);
    if (!isConfirmed) {
      setIsEditing(true);
    } else {
      setIsEditing(false);
    }
  }, [initialRequirements, isConfirmed]);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handleTextChange = (index: number, text: string) => {
    const updated = [...requirements];
    updated[index] = { ...updated[index], text };
    setRequirements(updated);
    setIsDirty(true);
  };

  const handleCategoryToggle = (index: number) => {
    const updated = [...requirements];
    const current = updated[index].category;
    const isMustHave =
      current === 'must_have' || current === 'must-have' || current === 'Must-have';
    updated[index] = {
      ...updated[index],
      category: isMustHave ? 'nice_to_have' : 'must_have',
    };
    setRequirements(updated);
    setIsDirty(true);
  };

  const handleWeightChange = (index: number, weight: string) => {
    const val = Math.max(1, Math.min(10, parseInt(weight, 10) || 1));
    const updated = [...requirements];
    updated[index] = { ...updated[index], weight: val };
    setRequirements(updated);
    setIsDirty(true);
  };

  const handleMove = (index: number, direction: number) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= requirements.length) return;
    const updated = [...requirements];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    const reordered = updated.map((item, idx) => ({ ...item, sort_order: idx + 1 }));
    setRequirements(reordered);
    setIsDirty(true);
  };

  const handleAddRequirement = () => {
    const newItem: EditableRequirement = {
      id: `new-${Date.now()}`,
      text: '',
      category: 'must_have',
      weight: 3,
      sort_order: requirements.length + 1,
    };
    setRequirements([...requirements, newItem]);
    setIsDirty(true);
    setIsEditing(true);
  };

  const handleRemoveRequirement = (index: number) => {
    const updated = requirements.filter((_, idx) => idx !== index);
    const reordered = updated.map((item, idx) => ({ ...item, sort_order: idx + 1 }));
    setRequirements(reordered);
    setIsDirty(true);
  };

  const handleCancelEditing = () => {
    const sorted = [...(initialRequirements || [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    setRequirements(sorted);
    setIsDirty(false);
    setIsEditing(!isConfirmed);
    setError(null);
  };

  const handleSave = async () => {
    const invalid = requirements.some((r) => !r.text.trim());
    if (invalid) {
      setError('All criteria must have a description.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const payload: RequirementIn[] = requirements.map((r, idx) => ({
        text: r.text.trim(),
        category:
          r.category === 'must-have' || r.category === 'must_have'
            ? 'must_have'
            : 'nice_to_have',
        weight: Number(r.weight) || 1,
        sort_order: idx + 1,
      }));

      const res = await api.requirements.updateList(jobId, payload);
      if (Array.isArray(res)) {
        setRequirements(res);
        onRequirementsUpdated(res);
      }
      setIsDirty(false);

      if (isConfirmed) {
        setIsEditing(false);
        showNotification(
          'Screening criteria updated! Click "Re-Screen Candidates" if you want to update scores for existing applicants.'
        );
      } else {
        showNotification('Requirements saved successfully.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save criteria.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (
      requirements.length > 0 &&
      !window.confirm('Generating will re-draft requirements from the job description. Do you want to proceed?')
    ) {
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      const generated = await api.requirements.generate(jobId);
      if (Array.isArray(generated)) {
        const formatted = generated.map((item, idx) => ({
          ...item,
          id: `gen-${idx}-${Date.now()}`,
          sort_order: idx + 1,
        }));
        setRequirements(formatted);
        setIsDirty(true);
        setIsEditing(true);
        showNotification('Requirements generated from job description!');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate requirements.');
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirm = async () => {
    if (requirements.length === 0) {
      setError('Please add at least one requirement before confirming.');
      return;
    }
    const invalid = requirements.some((r) => !r.text.trim());
    if (invalid) {
      setError('All requirements must have a description before confirmation.');
      return;
    }

    if (
      !window.confirm(
        'Confirming requirements will set this job to Open and lock requirements for candidate screening. Continue?'
      )
    ) {
      return;
    }

    try {
      setConfirming(true);
      setError(null);
      if (isDirty) {
        const payload: RequirementIn[] = requirements.map((r, idx) => ({
          text: r.text.trim(),
          category:
            r.category === 'must-have' || r.category === 'must_have'
              ? 'must_have'
              : 'nice_to_have',
          weight: Number(r.weight) || 1,
          sort_order: idx + 1,
        }));
        await api.requirements.updateList(jobId, payload);
      }

      const res = await api.requirements.confirm(jobId);
      showNotification('Requirements confirmed! Job is now Open for candidate screening.');
      setIsEditing(false);
      onConfirmed(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm requirements.');
    } finally {
      setConfirming(false);
    }
  };

  const handleRescreenAll = async () => {
    if (
      !window.confirm(
        'Re-screen all existing candidates against the latest screening criteria? Their scores and missing must-haves will be re-calculated.'
      )
    ) {
      return;
    }

    try {
      setRescreening(true);
      setError(null);
      const res = await api.candidates.rescreenAll(jobId);
      showNotification(res.message || 'All candidates queued for re-screening!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger re-screening.');
    } finally {
      setRescreening(false);
    }
  };

  const isMustHaveCategory = (cat: string) =>
    cat === 'must_have' || cat === 'must-have' || cat === 'Must-have';

  return (
    <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
      {/* Header bar */}
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">Screening Requirements</h2>
            {isConfirmed ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <svg className="w-3.5 h-3.5 mr-1 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                {isEditing ? 'Editing Confirmed Criteria' : 'Locked & Active'}
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                Draft (Editable)
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {isConfirmed
              ? 'These criteria are actively used by AI to evaluate uploaded resumes. You can add new criteria or adjust existing ones.'
              : 'Define the evaluation criteria. AI will grade each candidate based on these rules.'}
          </p>
        </div>

        {/* Action buttons */}
        {isHR && (
          <div className="flex flex-wrap items-center gap-2">
            {isConfirmed && !isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleAddRequirement}
                  className="inline-flex items-center px-3.5 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition shadow-2xs"
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add New Criteria
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-2xs"
                >
                  <svg className="w-4 h-4 mr-1.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Criteria
                </button>

                <button
                  type="button"
                  onClick={handleRescreenAll}
                  disabled={rescreening}
                  className="inline-flex items-center px-3.5 py-2 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 disabled:opacity-50 transition shadow-2xs"
                  title="Re-run screening for all candidates with latest criteria"
                >
                  {rescreening ? (
                    <>
                      <svg className="w-4 h-4 mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Re-Screening...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Re-Screen Candidates
                    </>
                  )}
                </button>
              </>
            ) : isConfirmed && isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleAddRequirement}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  + Add Row
                </button>

                <button
                  type="button"
                  onClick={handleCancelEditing}
                  disabled={saving}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs disabled:opacity-50 transition"
                >
                  {saving ? 'Saving...' : 'Save & Apply Changes'}
                </button>
              </>
            ) : (
              /* Draft state buttons */
              <>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating || saving || confirming}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition"
                >
                  {generating ? (
                    <>
                      <svg className="w-4 h-4 mr-2 animate-spin text-emerald-700" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Drafting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Draft from Description
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleAddRequirement}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  + Add Row
                </button>

                {isDirty && (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || generating || confirming}
                    className="inline-flex items-center px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs disabled:opacity-50 transition"
                  >
                    {saving ? 'Saving...' : 'Save Draft'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={confirming || saving || generating}
                  className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs disabled:opacity-50 transition"
                >
                  {confirming ? (
                    <>
                      <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Confirming...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Confirm Requirements
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-sm text-red-700">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-bold ml-2">
            &times;
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-sm text-emerald-700">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700 font-bold ml-2">
            &times;
          </button>
        </div>
      )}

      {/* Requirements List */}
      <div className="p-6">
        {requirements.length === 0 ? (
          <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-sm text-gray-500">No screening criteria defined yet.</p>
            {isHR && (
              <div className="mt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handleAddRequirement}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition"
                >
                  + Add Criteria Manually
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition"
                >
                  Draft from Description
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {requirements.map((req, index) => {
              const mustHave = isMustHaveCategory(req.category);

              if (!isEditing || !isHR) {
                // Read-only presentation
                return (
                  <div
                    key={req.id || index}
                    className="flex items-start justify-between p-4 bg-slate-50/70 border border-slate-200 rounded-lg hover:border-slate-300 transition"
                  >
                    <div className="flex items-start space-x-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-xs font-medium text-slate-600 shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-900 leading-relaxed">
                          {req.text}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              mustHave
                                ? 'bg-rose-100 text-rose-800 border border-rose-200 font-semibold'
                                : 'bg-teal-100 text-teal-800 border border-teal-200'
                            }`}
                          >
                            {mustHave ? '★ Must-Have' : 'Nice-to-Have'}
                          </span>
                          <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                            Weight: {req.weight || 1}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Editable presentation (isEditing === true && isHR === true)
              return (
                <div
                  key={req.id || index}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 bg-white border border-slate-200 rounded-lg shadow-2xs hover:border-emerald-300 transition"
                >
                  {/* Reorder and Index */}
                  <div className="flex items-center space-x-1 shrink-0">
                    <span className="w-6 text-center text-xs font-semibold text-slate-400">
                      #{index + 1}
                    </span>
                    <div className="flex flex-col space-y-0.5">
                      <button
                        type="button"
                        onClick={() => handleMove(index, -1)}
                        disabled={index === 0}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded"
                        title="Move Up"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(index, 1)}
                        disabled={index === requirements.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded"
                        title="Move Down"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Text input */}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={req.text}
                      onChange={(e) => handleTextChange(index, e.target.value)}
                      placeholder="e.g. 5+ years of experience with Python and FastAPI..."
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  {/* Category toggle & weight */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCategoryToggle(index)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition ${
                        mustHave
                          ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                          : 'bg-teal-50 text-teal-700 border-teal-300 hover:bg-teal-100'
                      }`}
                    >
                      {mustHave ? '★ Must-Have' : 'Nice-to-Have'}
                    </button>

                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-slate-500">Wt:</span>
                      <select
                        value={req.weight || 1}
                        onChange={(e) => handleWeightChange(index, e.target.value)}
                        className="text-xs border border-slate-300 rounded-md py-1 px-1.5 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Delete row */}
                    <button
                      type="button"
                      onClick={() => handleRemoveRequirement(index)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                      title="Delete criterion"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom add button when editing */}
        {isEditing && isHR && requirements.length > 0 && (
          <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleAddRequirement}
              className="inline-flex items-center text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition"
            >
              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Another Criterion
            </button>

            <span className="text-xs text-gray-400">
              {requirements.filter((r) => isMustHaveCategory(r.category)).length} Must-Have &middot;{' '}
              {requirements.filter((r) => !isMustHaveCategory(r.category)).length} Nice-to-Have
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

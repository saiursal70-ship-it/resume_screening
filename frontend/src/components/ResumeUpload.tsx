import { useState, useRef, type DragEvent } from 'react';
import { api } from '../api/client';
import type { CandidateUpload } from '../types';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];

interface UploadResults {
  count: number;
  items: CandidateUpload[];
}

interface ResumeUploadProps {
  jobId: number | string;
  onUploadSuccess?: (uploaded: CandidateUpload[]) => void;
}

export default function ResumeUpload({ jobId, onUploadSuccess = () => {} }: ResumeUploadProps) {
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<UploadResults | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = (files: FileList | File[]): File[] => {
    const valid: File[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        errors.push(`"${file.name}": Unsupported format. Only .pdf and .docx are supported.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`"${file.name}": Exceeds maximum 5MB size limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
        return;
      }
      valid.push(file);
    });

    if (errors.length > 0) {
      setErrorMessage(errors.join(' '));
    } else {
      setErrorMessage(null);
    }

    return valid;
  };

  const handleFileSelection = (files: FileList | File[]) => {
    const valid = validateFiles(files);
    if (valid.length > 0) {
      // Avoid duplicate filenames
      setSelectedFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name));
        const newFiles = valid.filter((f) => !existingNames.has(f.name));
        return [...prev, ...newFiles];
      });
      setUploadResults(null);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    if (selectedFiles.length <= 1) {
      setErrorMessage(null);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    try {
      setUploading(true);
      setErrorMessage(null);
      setUploadProgress(40);

      const response = await api.candidates.upload(jobId, selectedFiles);
      setUploadProgress(100);

      const count = Array.isArray(response) ? response.length : selectedFiles.length;
      setUploadResults({
        count,
        items: Array.isArray(response) ? response : [],
      });
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onUploadSuccess(response);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to upload resumes. Please try again.');
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-gray-900">Upload Candidate Resumes</h3>
          <p className="text-sm text-gray-500">
            Upload candidate resumes to start automatic AI evaluation against confirmed criteria.
          </p>
        </div>
        <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2.5 py-1 rounded-md">
          PDF, DOCX up to 5MB
        </span>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-emerald-500 bg-emerald-50/50'
            : 'border-slate-300 hover:border-emerald-400 bg-slate-50/50 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => e.target.files && handleFileSelection(e.target.files)}
        />
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <div className="text-sm font-semibold text-slate-700">
            <span className="text-emerald-600 hover:underline">Click to upload</span> or drag and drop resumes here
          </div>
          <p className="text-xs text-slate-500">Supports batch upload of multiple files</p>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700 font-bold ml-2">
            &times;
          </button>
        </div>
      )}

      {/* Success notification */}
      {uploadResults && (
        <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>
              Successfully uploaded <strong>{uploadResults.count}</strong> resume(s). Evaluation queued!
            </span>
          </div>
          <button onClick={() => setUploadResults(null)} className="text-emerald-600 hover:text-emerald-800 font-bold ml-2">
            &times;
          </button>
        </div>
      )}

      {/* Selected files queued for upload */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 border border-slate-200 rounded-lg p-3 bg-slate-50/70">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              {selectedFiles.length} File{selectedFiles.length > 1 ? 's' : ''} Ready to Upload
            </span>
            <button
              onClick={() => setSelectedFiles([])}
              className="text-xs text-slate-500 hover:text-red-600 underline"
            >
              Clear all
            </button>
          </div>
          <ul className="max-h-48 overflow-y-auto divide-y divide-slate-200 text-sm">
            {selectedFiles.map((file, idx) => (
              <li key={`${file.name}-${idx}`} className="py-2 flex items-center justify-between">
                <div className="flex items-center space-x-2 truncate">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium text-slate-800 truncate">{file.name}</span>
                  <span className="text-xs text-slate-400">({formatFileSize(file.size)})</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  className="text-slate-400 hover:text-red-500 p-1 rounded"
                  title="Remove file"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          {uploading && uploadProgress > 0 && (
            <div className="mt-3">
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-slate-200 flex justify-end">
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs disabled:opacity-50 transition"
            >
              {uploading ? (
                <>
                  <svg className="w-4 h-4 mr-2 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Uploading & Queuing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload & Screen {selectedFiles.length} Resume{selectedFiles.length > 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

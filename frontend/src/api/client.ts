/**
 * API client helper functions for AI-assisted resume screening.
 * Uses native Fetch API with credentials: 'include' for httpOnly cookie auth.
 */

import type {
  CandidateDetail,
  CandidateListItem,
  CandidateRetry,
  CandidateUpload,
  JobCreate,
  JobDetail,
  JobListItem,
  Job,
  JobUpdate,
  LogoutResponse,
  Requirement,
  RequirementIn,
  Stage,
  StageHistory,
  User,
} from '../types';

type Id = number | string;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type RequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const defaultHeaders: Record<string, string> = {};
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  const response = await fetch(fullUrl, config);

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorData: unknown = await response.json();
      if (typeof errorData === 'object' && errorData !== null) {
        const { detail, message } = errorData as { detail?: unknown; message?: unknown };
        if (typeof detail === 'string' && detail) {
          errorMessage = detail;
        } else if (typeof message === 'string' && message) {
          errorMessage = message;
        }
      }
    } catch {
      try {
        const text = await response.text();
        if (text) errorMessage = text;
      } catch {
        // Fallback to default message
      }
    }
    throw new ApiError(errorMessage, response.status);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  try {
    return (await response.json()) as T;
  } catch {
    return null as T;
  }
}

export interface ListCandidatesParams {
  stage?: Stage | 'ALL';
  sort?: string;
}

export const api = {
  // Auth endpoints
  auth: {
    login: async (email: string, password: string) => {
      const res = await request<User>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res && res.access_token && typeof window !== 'undefined') {
        localStorage.setItem('access_token', res.access_token);
      }
      return res;
    },
    register: async (data: { name: string; email: string; password: string; role?: 'hr' | 'viewer' }) => {
      const res = await request<User>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (res && res.access_token && typeof window !== 'undefined') {
        localStorage.setItem('access_token', res.access_token);
      }
      return res;
    },
    logout: async () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
      }
      return request<LogoutResponse>('/api/auth/logout', {
        method: 'POST',
      });
    },
    me: () =>
      request<User>('/api/auth/me', {
        method: 'GET',
      }),
  },

  // Jobs endpoints
  jobs: {
    list: () =>
      request<JobListItem[]>('/api/jobs', {
        method: 'GET',
      }),
    create: (data: JobCreate) =>
      request<Job>('/api/jobs', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    get: (id: Id) =>
      request<JobDetail>(`/api/jobs/${id}`, {
        method: 'GET',
      }),
    update: (id: Id, data: JobUpdate) =>
      request<Job>(`/api/jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    generateDescription: (data: { title: string; seniority?: string; key_skills?: string }) =>
      request<{ title: string; description: string }>('/api/jobs/generate-description', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Requirements endpoints
  requirements: {
    updateList: (jobId: Id, requirements: RequirementIn[]) =>
      request<Requirement[]>(`/api/jobs/${jobId}/requirements`, {
        method: 'PUT',
        body: JSON.stringify(requirements),
      }),
    confirm: (jobId: Id) =>
      request<Job>(`/api/jobs/${jobId}/requirements/confirm`, {
        method: 'POST',
      }),
    generate: (jobId: Id) =>
      request<Requirement[]>(`/api/jobs/${jobId}/requirements/generate`, {
        method: 'POST',
      }),
  },

  // Candidates endpoints
  candidates: {
    upload: (jobId: Id, files: File[] | FileList | File) => {
      const formData = new FormData();
      if (Array.isArray(files)) {
        files.forEach((file) => formData.append('files', file));
      } else if (files instanceof FileList) {
        Array.from(files).forEach((file) => formData.append('files', file));
      } else if (files instanceof File) {
        formData.append('files', files);
      }
      return request<CandidateUpload[]>(`/api/jobs/${jobId}/candidates/upload`, {
        method: 'POST',
        body: formData,
      });
    },
    list: (jobId: Id, params: ListCandidatesParams = {}) => {
      const searchParams = new URLSearchParams();
      if (params.stage && params.stage !== 'ALL') {
        searchParams.append('stage', params.stage);
      }
      if (params.sort) {
        searchParams.append('sort', params.sort);
      }
      const queryString = searchParams.toString();
      const url = `/api/jobs/${jobId}/candidates${queryString ? `?${queryString}` : ''}`;
      return request<CandidateListItem[]>(url, { method: 'GET' });
    },
    get: (candidateId: Id) =>
      request<CandidateDetail>(`/api/candidates/${candidateId}`, {
        method: 'GET',
      }),
    retry: (candidateId: Id) =>
      request<CandidateRetry>(`/api/candidates/${candidateId}/retry`, {
        method: 'POST',
      }),
    updateStage: (candidateId: Id, stage: Stage, reason?: string) =>
      request<CandidateDetail>(`/api/candidates/${candidateId}/stage`, {
        method: 'POST',
        body: JSON.stringify({ stage, reason }),
      }),
    getHistory: (candidateId: Id) =>
      request<StageHistory[]>(`/api/candidates/${candidateId}/history`, {
        method: 'GET',
      }),
    rescreenAll: (jobId: Id) =>
      request<{ message: string; count: number }>(`/api/jobs/${jobId}/rescreen-all`, {
        method: 'POST',
      }),
  },
};

export default api;
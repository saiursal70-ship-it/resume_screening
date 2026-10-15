// Shared API types. Mirrors backend/app/schemas.py.
// Datetime fields arrive as ISO 8601 strings in JSON.

export type Stage = "new" | "shortlisted" | "rejected" | "on_hold";
export type RequirementCategory = "must_have" | "nice_to_have";

// ---------- Auth ----------
export interface LoginRequest {
  email: string;
  password: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  access_token?: string;
  token_type?: string;
}

export interface LogoutResponse {
  message: string;
}

// ---------- Requirements ----------
export interface RequirementIn {
  text: string;
  category?: RequirementCategory;
  weight?: number;
  sort_order?: number;
}

export interface Requirement {
  id: number;
  job_id: number;
  text: string;
  category: RequirementCategory;
  weight: number;
  sort_order: number;
}

// ---------- Jobs ----------
export interface JobCreate {
  title: string;
  description: string;
}

export interface JobUpdate {
  title?: string;
  description?: string;
  status?: "draft" | "open";
}

export interface Job {
  id: number;
  title: string;
  description: string;
  status: string;
  requirements_confirmed: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface JobListItem {
  id: number;
  title: string;
  description?: string;
  status: string;
  requirements_confirmed: boolean;
  created_at: string;
  candidate_count: number;
}

export interface JobDetail {
  job: Job;
  requirements: Requirement[];
}

// ---------- Candidates ----------
export interface CandidateUpload {
  id: number;
  filename: string;
  status: string;
}

export interface CandidateListItem {
  id: number;
  filename: string;
  score: number | null;
  stage: Stage;
  status: string;
  missing_must_haves: string[];
  created_at: string;
}

export interface CandidateDetail {
  id: number;
  job_id: number;
  filename: string;
  file_path: string;
  file_hash: string;
  file_size: number;
  resume_text: string | null;
  redacted_text: string | null;
  status: string;
  error_message: string | null;
  score: number | null;
  stage: Stage;
  // Loose for now; tightened once we see how components read these.
  profile_data: Record<string, any> | null;
  screening_result: Record<string, any> | null;
  model_id: string | null;
  prompt_version: string | null;
  created_at: string;
  updated_at: string;
  missing_must_haves: string[];
}

export interface CandidateRetry {
  id: number;
  status: string;
}

export interface CandidateStageUpdate {
  stage: Stage;
  reason?: string;
}

export interface StageHistory {
  from_stage: Stage | null;
  to_stage: Stage;
  reason: string | null;
  changed_by_name: string | null;
  created_at: string;
}
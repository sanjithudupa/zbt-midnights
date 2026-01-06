export type User = {
  id: string;
  username: string;
  is_active: boolean;
  created_at: string;
};

export type JobDefinition = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type JobRequirement = {
  id?: string;
  job_definition_id?: string;
  position: number;
  description: string;
};

export type WeekTemplate = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type WeekTemplateDay = {
  id: string;
  week_template_id: string;
  day_of_week: number;
  job_definition_id: string;
  sort_order: number;
};

export type Week = {
  id: string;
  start_date: string;
  template_id: string | null;
  created_at: string;
};

export type ScheduledJob = {
  id: string;
  week_id: string;
  day_of_week: number;
  job_definition_id: string;
  sort_order: number;
  created_at: string;
};

export type Submission = {
  id: string;
  scheduled_job_id: string;
  user_id: string;
  submitted_at: string;
  note: string | null;
  review_status: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export type SubmissionPhoto = {
  id?: string;
  submission_id?: string;
  position: number;
  requirement_description_snapshot: string;
  imgbb_url: string;
  created_at?: string;
};

export type SessionData = {
  role: "admin" | "user";
  userId?: string;
};

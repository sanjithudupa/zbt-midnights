PROJECT SPEC — ZBT “Midnights” Job / Chore Tracker (Web App)

Goal
- Build a web app to track completion status of recurring chores (“jobs”) performed by a set of users.
- Two roles/modes: Admin mode and User mode.
- Primary focus: correctness, clean code, minimal UI, robust data model, and reliable photo capture/upload flow.

Non-goals
- No complex styling, theming, or animations.
- No user passwords/auth for individual users (selection from list only).
- No payments, notifications, gamification, or advanced analytics (unless added later).

Core Concepts / Definitions
- User: a person who can submit job completions (no password).
- Job Definition: a reusable template describing a job and what photos are required.
- Week: a week window (Mon–Sun) that contains a schedule of jobs required each day.
- Week Template (aka “weekly configuration”): reusable schedule presets like “regular week”, “party week”, “custom”.
- Scheduled Job (Week Job): an instance of a Job Definition assigned to a specific day within a specific week.
- Submission / Job Log: a record that a user completed a scheduled job, including required photo URLs and metadata.
- Review Status: admin may view submissions; (optional) may mark as “reviewed/approved/rejected” for tracking.

Login / Mode Selection
- Landing page is a login screen with two mutually exclusive options:
  1) Admin login: enter an Admin password (single shared password).
  2) User login: select a user from a dropdown/list and continue.
- No other auth flows required, but ensure:
  - Admin mode is gated behind the admin password (server-side validation, not only UI).
  - User mode selection should not allow user impersonation beyond selecting from list (acceptable by design).
- Persist session state (admin vs user + user_id) in a secure manner (prefer httpOnly cookie or equivalent).

Required Pages / UI (Minimal but Functional)

1) Login Page
- Admin password input + “Enter Admin” button.
- User picker (list of active users) + “Continue” button.
- Error states:
  - Wrong admin password.
  - No user selected.

2) Admin Dashboard (Desktop-first)
Tabs:
A) Weeks & Scheduling
- Create New Week:
  - Choose “start date” (must be a Monday; if not Monday, warn and/or auto-adjust per defined rule).
  - Choose a Week Template (“regular week”, “party week”, “custom”).
  - For “custom”: allow per-day selection of jobs and/or ad-hoc jobs.
- Edit Existing Week:
  - Select week from list.
  - View/modify scheduled jobs per day.
  - Add/remove scheduled jobs.
  - Add “ad-hoc job definition for this week only” (or create a new global Job Definition and schedule it).
- Week Status Table:
  - For selected week, show a table:
    - Rows: each scheduled job (grouped by day).
    - Columns: Day, Job Name, Required Photo Descriptions, Submitted? (yes/no), Submitted By, Submitted At, View Submission.
  - Viewing a submission:
    - Show each required photo slot with its description + the uploaded image (via URL).
    - Show metadata (user, time, optional notes).
    - Optional review actions (if implemented): mark Approved / Rejected with comment.

B) Job Definitions
- CRUD job definitions:
  - Create/edit job name.
  - Define required photo list (ordered list of descriptions).
  - Optionally mark active/inactive.
- Validate:
  - Each job definition must have at least 0 photo requirements (allow 0 for jobs that don’t need photos).
  - Photo requirement descriptions must be non-empty strings.

C) Users
- CRUD users list:
  - username/display name (unique).
  - active/inactive flag (inactive users should not appear in login list).
- Optionally store additional fields like “role label” or “notes” (not required).

3) User Logging Flow (Mobile-first, but works on desktop)
A) Logging Page
- Prefill “current week” selection (based on today’s date; pick the week whose start_date <= today < start_date+7).
- User chooses:
  - Week (default current; can change to past week if allowed).
  - Day (default today’s day-of-week within that week).
  - Job (only show jobs scheduled for that selected week/day).
- Once job selected, show photo requirements:
  - Display N placeholders, each labeled with the corresponding description.
  - Each placeholder indicates status: not taken / taken / retake.
- Submit button:
  - Disabled until all required photos are taken and uploaded successfully.
  - Enabled immediately if the job has 0 photo requirements.

B) Photo Capture Page / Modal
- When user taps a placeholder:
  - Open camera interface (prefer device camera).
  - Allow taking a photo and previewing it.
  - User confirms “Use photo” or “Retake”.
  - On confirm, upload to ImgBB using IMG_BB_API_KEY (details below).
  - After upload success:
    - Store returned URL in local state for that requirement slot.
    - Return to logging page.
  - Handle failures:
    - Upload error (show retry).
    - Camera permission denied (instructions + fallback file upload input if possible).

C) Submission Confirmation
- Once submit is pressed:
  - Create a Job Log / Submission record in database.
  - Show success message and prevent duplicate submission (see duplicate rules below).
  - Allow viewing “your submission” details.

Business Rules / Validation

Scheduling
- Week is identified by a start_date (Monday) and represents exactly 7 days.
- A week contains per-day scheduled jobs.
- Scheduled jobs reference a Job Definition (or an ad-hoc job definition created for that week).

Submissions (Job Log)
- A submission is tied to:
  - user_id
  - scheduled_job_id (preferred) OR (week_id + day + job_definition_id) if needed
  - photo_urls in the correct order corresponding to job definition requirement list
  - submitted_at timestamp
- Duplicate handling (choose one and enforce consistently):
  Option 1 (recommended): Only one submission per user per scheduled job. Subsequent attempts either:
    - block with “already submitted”, or
    - allow “resubmit” which overwrites previous submission (requires explicit UI).
  Option 2: Allow multiple submissions; admin sees latest or all. (More complex UI.)
- Photos:
  - Must be uploaded before submission is accepted.
  - URLs stored must match the requirement slot ordering.

Admin View Status Computation
- For each scheduled job, determine:
  - Submitted? (exists at least one submission, optionally per user or overall depending on whether multiple users can complete the same job).
- Clarify assignment:
  - If a scheduled job is intended to be done by “anyone” (one completion total), then submissions are “first come”.
  - If each user must do it, scheduled jobs must include assignment to user(s).
  - Default assumption: one completion total per scheduled job. (Agent should implement in a way that can be extended to per-user assignment later.)

Database Requirements (Supabase) — MUST be created via Supabase MCP

Supabase project
- Project name: zbt_midnights
- Currently blank; agent must create tables, relationships, constraints, and indexes.

Recommended Schema (normalized; agent may refine but must preserve capabilities)

Tables:

1) users
- id (uuid, pk, default gen_random_uuid())
- username (text, unique, not null)
- is_active (boolean, default true)
- created_at (timestamptz, default now())

2) job_definitions
- id (uuid, pk)
- name (text, not null)
- is_active (boolean, default true)
- created_at (timestamptz, default now())

3) job_requirements
- id (uuid, pk)
- job_definition_id (uuid, fk -> job_definitions.id, not null, on delete cascade)
- position (int, not null)  // 0..N-1 order
- description (text, not null)
- UNIQUE(job_definition_id, position)

4) week_templates
- id (uuid, pk)
- name (text, unique, not null)  // “regular week”, “party week”, “custom”
- is_active (boolean, default true)
- created_at (timestamptz, default now())

5) week_template_days
- id (uuid, pk)
- week_template_id (uuid, fk -> week_templates.id, not null, on delete cascade)
- day_of_week (int, not null)  // 0=Mon ... 6=Sun
- job_definition_id (uuid, fk -> job_definitions.id, not null)
- sort_order (int, not null, default 0)
- UNIQUE(week_template_id, day_of_week, sort_order)

6) weeks
- id (uuid, pk)
- start_date (date, unique, not null)  // represents Monday
- template_id (uuid, fk -> week_templates.id, nullable) // record which template used, optional
- created_at (timestamptz, default now())

7) scheduled_jobs
- id (uuid, pk)
- week_id (uuid, fk -> weeks.id, not null, on delete cascade)
- day_of_week (int, not null)  // 0=Mon ... 6=Sun
- job_definition_id (uuid, fk -> job_definitions.id, not null)
- sort_order (int, not null, default 0)
- created_at (timestamptz, default now())
- UNIQUE(week_id, day_of_week, sort_order)

8) job_submissions
- id (uuid, pk)
- scheduled_job_id (uuid, fk -> scheduled_jobs.id, not null, on delete cascade)
- user_id (uuid, fk -> users.id, not null)
- submitted_at (timestamptz, default now())
- note (text, nullable)
- review_status (text, nullable) // optional enum-ish: “approved”, “rejected”, “pending”
- review_note (text, nullable)
- reviewed_at (timestamptz, nullable)
- reviewed_by (uuid, fk -> users.id, nullable) // optional if admin identity exists; else omit
- UNIQUE(scheduled_job_id, user_id)  // if enforcing 1 submission per user per scheduled job

9) submission_photos
- id (uuid, pk)
- submission_id (uuid, fk -> job_submissions.id, not null, on delete cascade)
- position (int, not null)
- requirement_description_snapshot (text, not null) // snapshot of description at time of submit
- imgbb_url (text, not null)
- created_at (timestamptz, default now())
- UNIQUE(submission_id, position)

Indexes
- scheduled_jobs: index on (week_id, day_of_week)
- job_submissions: index on (scheduled_job_id), (user_id), and (submitted_at desc)

Row Level Security (RLS) / Security Requirements
- Admin password should not be the only protection for database writes from clients.
- Preferred approach:
  - Use Supabase Auth for admin session OR use service-role access only on server routes.
  - If you do NOT want Supabase Auth, then:
    - All DB writes go through a server API with server-side admin verification.
    - Client should have anon read-only access at most.
- Minimum acceptable:
  - Admin-only operations (CRUD users, job definitions, weeks, scheduled jobs) must not be possible from user mode.
  - User mode must only be able to create submissions and read the necessary scheduling/job definition info.
- Agent must:
  - Decide and document an approach (server-side recommended).
  - Create RLS policies accordingly (even if permissive initially, must be explicitly defined).

ImgBB Upload Requirements
- There is an IMG_BB API Key in .env as IMG_BB_API_KEY.
- Upload flow:
  - Capture image -> compress/resize if necessary (agent decides; must be reliable on mobile).
  - Upload to ImgBB.
  - Store returned image URL(s) in DB as described.
- Security:
  - Do not expose IMG_BB_API_KEY directly to the browser if avoidable (preferred: proxy upload via server).
  - If key must be exposed, minimize scope and document risk; rate limit where possible.

Environment / Config Requirements (.env)
Agent must specify exact variables required, including at minimum:
- SUPABASE_URL
- SUPABASE_ANON_KEY (client)
- SUPABASE_SERVICE_ROLE_KEY (server only; never shipped to client)
- ADMIN_PASSWORD (or hashed form)
- IMG_BB_API_KEY (server only preferred)
- Any app base URL / callback URL variables needed by the chosen framework.

Operational Requirements
- The app must:
  - Work on mobile Safari/Chrome for photo capture.
  - Handle slow networks and retry uploads.
  - Prevent partial submissions (no DB record created unless all photo URLs present).
  - Show clear error messages for missing permissions, upload failures, and invalid selections.

Data Integrity Requirements
- Enforce day_of_week in [0..6].
- Enforce Monday start_date rule:
  - Either DB constraint (harder) or server validation (acceptable).
- Maintain requirement ordering:
  - job_requirements.position is authoritative.
  - submission_photos.position must match.
- Snapshot requirement descriptions at submit time to preserve meaning if job definitions change later.

Agent Deliverables / Planning Instructions
Tell the coding agent:

1) Planning
- Produce a step-by-step implementation plan, separated into:
  A) Database setup via Supabase MCP
  B) Backend/API routes (auth gating, write operations)
  C) Frontend pages and state flows
  D) ImgBB upload handling and error cases
  E) Testing plan (basic smoke tests + critical flows)

2) Database via Supabase MCP
- Use Supabase MCP to:
  - Create all tables, constraints, and indexes.
  - Enable RLS and add explicit policies.
  - Seed initial data:
    - week_templates: “regular week”, “party week”, “custom”
    - optionally seed a few job definitions and a few users for testing.
- Output:
  - A concise schema summary and any SQL/migrations generated.

3) Connection + Secrets
- Explain exactly what goes into .env for local dev and production.
- Ensure service role keys never reach the client bundle.
- Document how admin password is stored/verified (plaintext acceptable only for local; prefer hashed).

4) Correctness Requirements
- Ensure UI and API enforce:
  - only scheduled jobs for selected week/day are selectable.
  - submit disabled until all required photos uploaded.
  - correct mapping between requirement slots and URLs.
  - duplicate submission behavior is enforced consistently.

5) Code Quality
- Keep code modular and readable.
- Use typed schemas (e.g., TypeScript types) aligned with DB tables.
- Avoid “magic strings” for statuses/day mapping; centralize constants.
- Prefer minimal dependencies; no overengineering.

Open Decisions (Agent should choose and document)
- Whether submissions are “one per scheduled job total” vs “per user”.
  - Default: per user per scheduled job (allows auditing who did what), but admin status view can still show “any submission exists”.
- Whether admin identity is a separate concept from users.
  - Default: admin is not a user; admin actions are gated by password and server routes.

End of Spec
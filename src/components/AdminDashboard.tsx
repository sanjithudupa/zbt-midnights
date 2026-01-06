"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DAY_LABELS, FULL_DAY_LABELS } from "@/lib/constants";
import type {
  JobDefinition,
  JobRequirement,
  User,
  Week,
  WeekTemplate,
} from "@/lib/types";
import { formatDateInput, parseDateInput, isMonday } from "@/lib/date";

type WeekTemplateWithDays = WeekTemplate & {
  week_template_days?: Array<{
    id: string;
    day_of_week: number;
    job_definition_id: string;
    sort_order: number;
  }>;
};

type ScheduledJobItem = {
  id?: string;
  day_of_week: number;
  job_definition_id: string;
  sort_order: number;
};

type WeekStatusRow = {
  id: string;
  day_of_week: number;
  sort_order: number;
  job_definition_id: string;
  job_definitions?: {
    id: string;
    name: string;
    job_requirements?: Array<{ position: number; description: string }>;
  };
  job_submissions?: Array<{
    id: string;
    submitted_at: string;
    user_id: string;
    users?: { id: string; username: string };
    submission_photos?: Array<{
      position: number;
      imgbb_url: string;
      requirement_description_snapshot: string;
    }>;
  }>;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<"weeks" | "jobs" | "users">("weeks");
  const [users, setUsers] = useState<User[]>([]);
  const [jobDefinitions, setJobDefinitions] = useState<
    (JobDefinition & { job_requirements?: JobRequirement[] })[]
  >([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [templates, setTemplates] = useState<WeekTemplateWithDays[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedWeekId, setSelectedWeekId] = useState<string>("");
  const [statusRows, setStatusRows] = useState<WeekStatusRow[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newUserName, setNewUserName] = useState("");
  const [newJobName, setNewJobName] = useState("");
  const [newRequirementsText, setNewRequirementsText] = useState("");

  const [startDate, setStartDate] = useState(formatDateInput(new Date()));
  const [templateId, setTemplateId] = useState<string>("");

  const [scheduleDraft, setScheduleDraft] = useState<ScheduledJobItem[]>([]);
  const [scheduleDay, setScheduleDay] = useState(0);
  const [scheduleJobDefinitionId, setScheduleJobDefinitionId] = useState("");

  const [templateDraft, setTemplateDraft] = useState<ScheduledJobItem[]>([]);
  const [templateDay, setTemplateDay] = useState(0);
  const [templateJobDefinitionId, setTemplateJobDefinitionId] = useState("");

  const selectedWeek = weeks.find((week) => week.id === selectedWeekId);

  const sortedSchedule = useMemo(() => {
    return [...scheduleDraft].sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) {
        return a.day_of_week - b.day_of_week;
      }
      return a.sort_order - b.sort_order;
    });
  }, [scheduleDraft]);

  useEffect(() => {
    const loadAll = async () => {
      await Promise.all([
        loadUsers(),
        loadJobDefinitions(),
        loadWeeks(),
        loadTemplates(),
      ]);
    };
    loadAll();
  }, []);

  useEffect(() => {
    if (selectedWeekId) {
      loadWeekStatus(selectedWeekId);
      loadWeekSchedule(selectedWeekId);
    } else {
      setStatusRows([]);
      setScheduleDraft([]);
    }
  }, [selectedWeekId]);

  useEffect(() => {
    if (!selectedTemplateId) {
      setTemplateDraft([]);
      return;
    }
    const template = templates.find((item) => item.id === selectedTemplateId);
    const days = template?.week_template_days ?? [];
    setTemplateDraft(
      days.map((day) => ({
        day_of_week: day.day_of_week,
        job_definition_id: day.job_definition_id,
        sort_order: day.sort_order,
      }))
    );
  }, [selectedTemplateId, templates]);

  const loadUsers = async () => {
    const response = await fetch("/api/admin/users");
    if (response.ok) {
      const data = await response.json();
      setUsers(data.users ?? []);
    }
  };

  const loadJobDefinitions = async () => {
    const response = await fetch("/api/admin/job-definitions");
    if (response.ok) {
      const data = await response.json();
      setJobDefinitions(data.jobDefinitions ?? []);
    }
  };

  const loadWeeks = async () => {
    const response = await fetch("/api/admin/weeks");
    if (response.ok) {
      const data = await response.json();
      setWeeks(data.weeks ?? []);
    }
  };

  const loadTemplates = async () => {
    const response = await fetch("/api/admin/week-templates");
    if (response.ok) {
      const data = await response.json();
      setTemplates(data.weekTemplates ?? []);
      if (!selectedTemplateId && data.weekTemplates?.length) {
        setSelectedTemplateId(data.weekTemplates[0].id);
      }
    }
  };

  const loadWeekStatus = async (weekId: string) => {
    setStatusLoading(true);
    const response = await fetch(`/api/admin/weeks/${weekId}/status`);
    setStatusLoading(false);
    if (response.ok) {
      const data = await response.json();
      setStatusRows(data.scheduledJobs ?? []);
    }
  };

  const loadWeekSchedule = async (weekId: string) => {
    const response = await fetch(`/api/admin/weeks/${weekId}/status`);
    if (!response.ok) return;
    const data = await response.json();
    const schedule = (data.scheduledJobs ?? []).map((row: WeekStatusRow) => ({
      id: row.id,
      day_of_week: row.day_of_week,
      job_definition_id: row.job_definition_id,
      sort_order: row.sort_order,
    }));
    setScheduleDraft(schedule);
  };

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
  };

  const handleCreateUser = async () => {
    setError(null);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: newUserName }),
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Failed to create user.");
      return;
    }
    setNewUserName("");
    loadUsers();
  };

  const handleUserUpdate = async (user: User, updates: Partial<User>) => {
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (response.ok) {
      loadUsers();
    }
  };

  const handleCreateJobDefinition = async () => {
    setError(null);
    const response = await fetch("/api/admin/job-definitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newJobName }),
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Failed to create job definition.");
      return;
    }
    const data = await response.json();
    if (newRequirementsText.trim()) {
      await fetch(`/api/admin/job-definitions/${data.jobDefinition.id}/requirements`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirements: newRequirementsText
            .split("\n")
            .map((line) => ({ description: line })),
        }),
      });
    }
    setNewJobName("");
    setNewRequirementsText("");
    loadJobDefinitions();
  };

  const handleJobUpdate = async (
    jobDefinition: JobDefinition,
    updates: Partial<JobDefinition>
  ) => {
    const response = await fetch(`/api/admin/job-definitions/${jobDefinition.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (response.ok) {
      loadJobDefinitions();
    }
  };

  const handleRequirementsUpdate = async (
    jobDefinitionId: string,
    requirementsText: string
  ) => {
    const response = await fetch(
      `/api/admin/job-definitions/${jobDefinitionId}/requirements`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirements: requirementsText
            .split("\n")
            .map((line) => ({ description: line })),
        }),
      }
    );
    if (response.ok) {
      loadJobDefinitions();
    }
  };

  const handleCreateWeek = async () => {
    setError(null);
    const date = parseDateInput(startDate);
    if (!isMonday(date)) {
      setError("Start date must be a Monday.");
      return;
    }
    const response = await fetch("/api/admin/weeks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_date: startDate, template_id: templateId || null }),
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Failed to create week.");
      return;
    }
    await loadWeeks();
  };

  const handleAddScheduleItem = () => {
    if (!scheduleJobDefinitionId) return;
    setScheduleDraft((prev) => [
      ...prev,
      {
        day_of_week: scheduleDay,
        job_definition_id: scheduleJobDefinitionId,
        sort_order: prev.filter((item) => item.day_of_week === scheduleDay).length,
      },
    ]);
  };

  const handleRemoveScheduleItem = (target: ScheduledJobItem) => {
    setScheduleDraft((prev) => {
      const index = prev.findIndex((item) => item === target);
      if (index === -1) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleSaveSchedule = async () => {
    if (!selectedWeekId) return;
    const response = await fetch(`/api/admin/weeks/${selectedWeekId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule: scheduleDraft }),
    });
    if (response.ok) {
      loadWeekStatus(selectedWeekId);
    }
  };

  const handleAddTemplateItem = () => {
    if (!templateJobDefinitionId) return;
    setTemplateDraft((prev) => [
      ...prev,
      {
        day_of_week: templateDay,
        job_definition_id: templateJobDefinitionId,
        sort_order: prev.filter((item) => item.day_of_week === templateDay)
          .length,
      },
    ]);
  };

  const handleRemoveTemplateItem = (target: ScheduledJobItem) => {
    setTemplateDraft((prev) => {
      const index = prev.findIndex((item) => item === target);
      if (index === -1) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplateId) return;
    const response = await fetch(
      `/api/admin/week-templates/${selectedTemplateId}/days`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: templateDraft }),
      }
    );
    if (response.ok) {
      loadTemplates();
    }
  };

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="muted">Manage schedules, jobs, and users.</p>
        </div>
        <button className="ghost" onClick={handleLogout}>
          Log out
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="tabs">
        <button
          className={tab === "weeks" ? "tab active" : "tab"}
          onClick={() => setTab("weeks")}
        >
          Weeks & Scheduling
        </button>
        <button
          className={tab === "jobs" ? "tab active" : "tab"}
          onClick={() => setTab("jobs")}
        >
          Job Definitions
        </button>
        <button
          className={tab === "users" ? "tab active" : "tab"}
          onClick={() => setTab("users")}
        >
          Users
        </button>
      </div>

      {tab === "users" && (
        <section className="card">
          <h2>Users</h2>
          <div className="row">
            <input
              placeholder="New username"
              value={newUserName}
              onChange={(event) => setNewUserName(event.target.value)}
            />
            <button className="primary" onClick={handleCreateUser}>
              Add
            </button>
          </div>
          <div className="list">
            {users.map((user) => (
              <div key={user.id} className="list-row">
                <input
                  defaultValue={user.username}
                  onBlur={(event) =>
                    handleUserUpdate(user, { username: event.target.value })
                  }
                />
                <label className="inline">
                  <input
                    type="checkbox"
                    checked={user.is_active}
                    onChange={(event) =>
                      handleUserUpdate(user, { is_active: event.target.checked })
                    }
                  />
                  Active
                </label>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "jobs" && (
        <section className="card">
          <h2>Job Definitions</h2>
          <div className="stack">
            <input
              placeholder="Job name"
              value={newJobName}
              onChange={(event) => setNewJobName(event.target.value)}
            />
            <textarea
              placeholder="Photo requirements (one per line)"
              value={newRequirementsText}
              rows={4}
              onChange={(event) => setNewRequirementsText(event.target.value)}
            />
            <button className="primary" onClick={handleCreateJobDefinition}>
              Create Job
            </button>
          </div>

          <div className="list">
            {jobDefinitions.map((job) => (
              <div key={job.id} className="list-row">
                <div className="stack">
                  <input
                    defaultValue={job.name}
                    onBlur={(event) =>
                      handleJobUpdate(job, { name: event.target.value })
                    }
                  />
                  <textarea
                    rows={3}
                    defaultValue={(job.job_requirements ?? [])
                      .sort((a, b) => a.position - b.position)
                      .map((req) => req.description)
                      .join("\n")}
                    onBlur={(event) =>
                      handleRequirementsUpdate(job.id, event.target.value)
                    }
                  />
                  <label className="inline">
                    <input
                      type="checkbox"
                      checked={job.is_active}
                      onChange={(event) =>
                        handleJobUpdate(job, { is_active: event.target.checked })
                      }
                    />
                    Active
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "weeks" && (
        <section className="card">
          <h2>Weeks & Scheduling</h2>
          <div className="grid-two">
            <div className="stack">
              <label className="field">
                <span>Start date (Monday)</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Template</span>
                <select
                  value={templateId}
                  onChange={(event) => setTemplateId(event.target.value)}
                >
                  <option value="">Select template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary" onClick={handleCreateWeek}>
                Create Week
              </button>
            </div>
            <div className="stack">
              <label className="field">
                <span>Existing weeks</span>
                <select
                  value={selectedWeekId}
                  onChange={(event) => setSelectedWeekId(event.target.value)}
                >
                  <option value="">Select week</option>
                  {weeks.map((week) => (
                    <option key={week.id} value={week.id}>
                      {week.start_date}
                    </option>
                  ))}
                </select>
              </label>
              {selectedWeek && (
                <div className="muted">
                  Selected week starts {selectedWeek.start_date}
                </div>
              )}
            </div>
          </div>

          {selectedWeek && (
            <div className="stack">
              <h3>Schedule Editor</h3>
              <div className="row">
                <select
                  value={scheduleDay}
                  onChange={(event) => setScheduleDay(Number(event.target.value))}
                >
                  {FULL_DAY_LABELS.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={scheduleJobDefinitionId}
                  onChange={(event) =>
                    setScheduleJobDefinitionId(event.target.value)
                  }
                >
                  <option value="">Select job</option>
                  {jobDefinitions.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.name}
                    </option>
                  ))}
                </select>
                <button className="ghost" onClick={handleAddScheduleItem}>
                  Add
                </button>
              </div>
              <div className="list">
                {sortedSchedule.map((item, index) => (
                  <div key={`${item.day_of_week}-${index}`} className="list-row">
                    <span className="pill">{DAY_LABELS[item.day_of_week]}</span>
                    <span>
                      {jobDefinitions.find(
                        (job) => job.id === item.job_definition_id
                      )?.name ?? "Job"}
                    </span>
                    <button
                      className="ghost"
                      onClick={() => handleRemoveScheduleItem(item)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button className="primary" onClick={handleSaveSchedule}>
                Save Schedule
              </button>
            </div>
          )}

          <div className="stack">
            <h3>Template Builder</h3>
            <label className="field">
              <span>Template</span>
              <select
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
              >
                <option value="">Select template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedTemplateId && (
              <>
                <div className="row">
                  <select
                    value={templateDay}
                    onChange={(event) =>
                      setTemplateDay(Number(event.target.value))
                    }
                  >
                    {FULL_DAY_LABELS.map((label, index) => (
                      <option key={label} value={index}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={templateJobDefinitionId}
                    onChange={(event) =>
                      setTemplateJobDefinitionId(event.target.value)
                    }
                  >
                    <option value="">Select job</option>
                    {jobDefinitions.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.name}
                      </option>
                    ))}
                  </select>
                  <button className="ghost" onClick={handleAddTemplateItem}>
                    Add
                  </button>
                </div>
                <div className="list">
                  {[...templateDraft]
                    .sort((a, b) => {
                      if (a.day_of_week !== b.day_of_week) {
                        return a.day_of_week - b.day_of_week;
                      }
                      return a.sort_order - b.sort_order;
                    })
                    .map((item, index) => (
                      <div key={`${item.day_of_week}-${index}`} className="list-row">
                        <span className="pill">{DAY_LABELS[item.day_of_week]}</span>
                        <span>
                          {jobDefinitions.find(
                            (job) => job.id === item.job_definition_id
                          )?.name ?? "Job"}
                        </span>
                        <button
                          className="ghost"
                          onClick={() => handleRemoveTemplateItem(item)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                </div>
                <button className="primary" onClick={handleSaveTemplate}>
                  Save Template
                </button>
              </>
            )}
          </div>

          {selectedWeek && (
            <div className="stack">
              <h3>Week Status</h3>
              {statusLoading && <div className="muted">Loading status…</div>}
              <div className="table">
                <div className="table-row header">
                  <span>Day</span>
                  <span>Job</span>
                  <span>Requirements</span>
                  <span>Submitted</span>
                  <span>Submitted By</span>
                  <span>Submitted At</span>
                </div>
                {statusRows.map((row) => {
                  const submissions = row.job_submissions ?? [];
                  const submission = submissions[0];
                  return (
                    <div key={row.id} className="table-row">
                      <span>{DAY_LABELS[row.day_of_week]}</span>
                      <span>{row.job_definitions?.name ?? "Job"}</span>
                      <span>
                        {(row.job_definitions?.job_requirements ?? [])
                          .sort((a, b) => a.position - b.position)
                          .map((req) => req.description)
                          .join(", ") || "None"}
                      </span>
                      <span>{submissions.length > 0 ? "Yes" : "No"}</span>
                      <span>{submission?.users?.username ?? "-"}</span>
                      <span>
                        {submission?.submitted_at
                          ? new Date(submission.submitted_at).toLocaleString()
                          : "-"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

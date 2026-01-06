"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
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

type SelectionMap = Record<string, boolean>;

type DetailModal = {
  jobName: string;
  dayLabel: string;
  submission: WeekStatusRow["job_submissions"][number] | null;
  photos: Array<{ description: string; url: string | null }>;
  late: boolean;
};

type RequirementDraft = {
  id: string;
  description: string;
};

type PhotoViewerState = {
  photos: Array<{ description: string; url: string | null }>;
  index: number;
};

type CleanupSummaryRow = {
  week_id: string;
  start_date: string;
  total_photos: number;
  deleted_photos: number;
};

const selectionKey = (day: number, jobId: string) => `${day}:${jobId}`;

const IconEdit = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path d="M12 20h9" strokeWidth="2" />
    <path
      d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
      strokeWidth="2"
    />
  </svg>
);

const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path d="M3 6h18" strokeWidth="2" />
    <path d="M8 6V4h8v2" strokeWidth="2" />
    <path d="M6 6l1 14h10l1-14" strokeWidth="2" />
  </svg>
);

const IconRestore = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path d="M4 4v6h6" strokeWidth="2" />
    <path d="M20 20v-6h-6" strokeWidth="2" />
    <path d="M20 8a8 8 0 0 0-14.8-4M4 16a8 8 0 0 0 14.8 4" strokeWidth="2" />
  </svg>
);

function buildSelectionsFromStatus(rows: WeekStatusRow[]): SelectionMap {
  const selections: SelectionMap = {};
  rows.forEach((row) => {
    selections[selectionKey(row.day_of_week, row.job_definition_id)] = true;
  });
  return selections;
}

function buildSelectionsFromTemplate(template?: WeekTemplateWithDays): SelectionMap {
  const selections: SelectionMap = {};
  const days = template?.week_template_days ?? [];
  days.forEach((day) => {
    selections[selectionKey(day.day_of_week, day.job_definition_id)] = true;
  });
  return selections;
}

function isLateSubmission(
  submittedAt: string,
  weekStartDate: string,
  dayIndex: number
) {
  const start = parseDateInput(weekStartDate);
  const cutoff = new Date(start);
  cutoff.setDate(start.getDate() + dayIndex + 1);
  cutoff.setHours(3, 0, 0, 0);
  return new Date(submittedAt) > cutoff;
}

function formatWeekRange(startDate: string) {
  const start = parseDateInput(startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const format = (date: Date) =>
    date.toLocaleDateString(undefined, {
      month: "2-digit",
      day: "2-digit",
    });
  return `Week of ${format(start)}-${format(end)}`;
}

type JobDayGridProps = {
  jobList: Array<{ id: string; name: string }>;
  selections?: SelectionMap;
  statusMap?: Map<string, WeekStatusRow[]>;
  renderCell?: (
    args: {
      dayIndex: number;
      jobId: string;
      statusRows: WeekStatusRow[];
      isOn: boolean;
      isComplete: boolean;
      label: string;
      latestSubmission?: WeekStatusRow["job_submissions"][number];
    }
  ) => React.ReactNode;
};

function JobDayGrid({ jobList, selections = {}, statusMap, renderCell }: JobDayGridProps) {
  return (
    <div className="grid-scroll">
      <div className="grid-table">
        <div className="grid-row">
          <div className="grid-cell head">Job</div>
          {DAY_LABELS.map((label) => (
            <div key={label} className="grid-cell head">
              {label}
            </div>
          ))}
        </div>
        {jobList.map((job) => (
          <div key={job.id} className="grid-row">
            <div className="grid-cell job-name">{job.name}</div>
            {DAY_LABELS.map((_, dayIndex) => {
              const key = selectionKey(dayIndex, job.id);
              const statusRows = statusMap?.get(key) ?? [];
              const isOn = selections[key] || statusRows.length > 0;
              const submissions = statusRows.flatMap(
                (row) => row.job_submissions ?? []
              );
              const latestSubmission = submissions
                .slice()
                .sort((a, b) =>
                  new Date(b.submitted_at).getTime() -
                  new Date(a.submitted_at).getTime()
                )[0];
              const isComplete = Boolean(latestSubmission);
              const label = isComplete
                ? latestSubmission?.users?.username ?? ""
                : "";

              if (renderCell) {
                return (
                  <div key={key} className="grid-cell no-pad">
                    {renderCell({
                      dayIndex,
                      jobId: job.id,
                      statusRows,
                      isOn,
                      isComplete,
                      label,
                      latestSubmission,
                    })}
                  </div>
                );
              }

              return (
                <div key={key} className="grid-cell">
                  {label && <span>{label}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "setup" | "jobs" | "users" | "settings">(
    "overview"
  );
  const [users, setUsers] = useState<User[]>([]);
  const [jobDefinitions, setJobDefinitions] = useState<
    (JobDefinition & { job_requirements?: JobRequirement[] })[]
  >([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [templates, setTemplates] = useState<WeekTemplateWithDays[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string>("");
  const [weekSelections, setWeekSelections] = useState<SelectionMap>({});
  const [statusRows, setStatusRows] = useState<WeekStatusRow[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newUserName, setNewUserName] = useState("");
  const [newJobName, setNewJobName] = useState("");

  const [startDate, setStartDate] = useState(formatDateInput(new Date()));
  const [createTemplateId, setCreateTemplateId] = useState<string>("");
  const [applyTemplateId, setApplyTemplateId] = useState<string>("");

  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateSelections, setTemplateSelections] = useState<SelectionMap>({});

  const [detailModal, setDetailModal] = useState<DetailModal | null>(null);
  const [photoViewer, setPhotoViewer] = useState<PhotoViewerState | null>(null);
  const [createWeekOpen, setCreateWeekOpen] = useState(false);
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);
  const [createTemplateName, setCreateTemplateName] = useState("");
  const [createTemplateSelections, setCreateTemplateSelections] = useState<SelectionMap>({});
  const [cleanupSummary, setCleanupSummary] = useState<CleanupSummaryRow[]>([]);
  const [cleanupStatus, setCleanupStatus] = useState<string | null>(null);
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState({
    adminPassword: "",
    imgbbApiKey: "",
  });
  const [settingsPromptOpen, setSettingsPromptOpen] = useState(false);
  const [settingsMasterPassword, setSettingsMasterPassword] = useState("");

  const changedSettingsCount = useMemo(() => {
    let count = 0;
    if (settingsDraft.adminPassword.trim()) count += 1;
    if (settingsDraft.imgbbApiKey.trim()) count += 1;
    return count;
  }, [settingsDraft]);

  const [jobEditorOpen, setJobEditorOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editingJobName, setEditingJobName] = useState("");
  const [editingRequirements, setEditingRequirements] = useState<
    RequirementDraft[]
  >([]);
  const [requirementInput, setRequirementInput] = useState("");

  const selectedWeek = weeks.find((week) => week.id === selectedWeekId);

  const activeJobDefinitions = useMemo(() => {
    return jobDefinitions
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [jobDefinitions]);

  const weekJobDefinitions = useMemo(() => {
    const map = new Map<string, string>();
    statusRows.forEach((row) => {
      if (row.job_definitions?.name) {
        map.set(row.job_definition_id, row.job_definitions.name);
      }
    });
    const list = Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [statusRows]);

  const statusMap = useMemo(() => {
    const map = new Map<string, WeekStatusRow[]>();
    statusRows.forEach((row) => {
      const key = selectionKey(row.day_of_week, row.job_definition_id);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    });
    return map;
  }, [statusRows]);

  const selectedCleanup = useMemo(() => {
    if (!selectedWeekId) return null;
    return cleanupSummary.find((row) => row.week_id === selectedWeekId) ?? null;
  }, [cleanupSummary, selectedWeekId]);

  useEffect(() => {
    const loadAll = async () => {
      await Promise.all([
        loadUsers(),
        loadJobDefinitions(),
        loadWeeks(),
        loadTemplates(),
        loadSettingsFlags(),
      ]);
    };
    loadAll();
  }, []);

  useEffect(() => {
    if (selectedWeekId) {
      loadWeekStatus(selectedWeekId);
      loadCleanupSummary();
    } else {
      setStatusRows([]);
      setWeekSelections({});
    }
  }, [selectedWeekId]);

  useEffect(() => {
    if (!selectedTemplateId) {
      setTemplateSelections({});
      return;
    }
    const template = templates.find((item) => item.id === selectedTemplateId);
    setTemplateSelections(buildSelectionsFromTemplate(template));
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
      if (!selectedWeekId && data.weeks?.length) {
        setSelectedWeekId(data.weeks[0].id);
      }
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
      const rows = data.scheduledJobs ?? [];
      setStatusRows(rows);
      setWeekSelections(buildSelectionsFromStatus(rows));
    }
  };

  const loadSettingsFlags = async () => {
    const response = await fetch("/api/admin/settings");
    if (!response.ok) return;
    await response.json();
  };

  const loadCleanupSummary = async () => {
    const response = await fetch("/api/admin/cleanup");
    if (response.ok) {
      const data = await response.json();
      setCleanupSummary(data.summary ?? []);
    }
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

  const handleDeleteUser = async (userId: string) => {
    const confirmed = window.confirm("Delete this user permanently?");
    if (!confirmed) return;
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });
    if (response.ok) {
      loadUsers();
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    const confirmed = window.confirm("Delete this job permanently?");
    if (!confirmed) return;
    const response = await fetch(`/api/admin/job-definitions/${jobId}`, {
      method: "DELETE",
    });
    if (response.ok) {
      loadJobDefinitions();
    }
  };

  const handleCreateJobDefinition = async () => {
    setError(null);
    if (!newJobName.trim()) return;
    const response = await fetch("/api/admin/job-definitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newJobName.trim() }),
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Failed to create job definition.");
      return;
    }
    const data = await response.json();
    setNewJobName("");
    setEditingJobId(data.jobDefinition.id);
    setEditingJobName(data.jobDefinition.name);
    setEditingRequirements([]);
    setRequirementInput("");
    setJobEditorOpen(true);
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
    requirements: RequirementDraft[]
  ) => {
    const response = await fetch(
      `/api/admin/job-definitions/${jobDefinitionId}/requirements`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirements: requirements.map((req) => ({
            description: req.description,
          })),
        }),
      }
    );
    if (response.ok) {
      loadJobDefinitions();
    }
  };

  const handleOpenJobEditor = (job: JobDefinition & { job_requirements?: JobRequirement[] }) => {
    setEditingJobId(job.id);
    setEditingJobName(job.name);
    const reqs = (job.job_requirements ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((req) => ({ id: crypto.randomUUID(), description: req.description }));
    setEditingRequirements(reqs);
    setRequirementInput("");
    setJobEditorOpen(true);
  };

  const handleSaveJobEditor = async () => {
    if (!editingJobId) return;
    const job = jobDefinitions.find((item) => item.id === editingJobId);
    if (!job) return;
    await handleJobUpdate(job, { name: editingJobName });
    await handleRequirementsUpdate(editingJobId, editingRequirements);
    setJobEditorOpen(false);
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
      body: JSON.stringify({
        start_date: startDate,
        template_id: createTemplateId || null,
      }),
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Failed to create week.");
      return;
    }
    setCreateWeekOpen(false);
    await loadWeeks();
  };

  const toggleSelection = (
    updater: Dispatch<SetStateAction<SelectionMap>>,
    day: number,
    jobId: string
  ) => {
    updater((prev) => {
      const next = { ...prev };
      const key = selectionKey(day, jobId);
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return next;
    });
  };

  const buildSchedulePayload = (selections: SelectionMap) => {
    const rows: Array<{
      day_of_week: number;
      job_definition_id: string;
      sort_order: number;
    }> = [];

    for (let day = 0; day < 7; day += 1) {
      let order = 0;
      activeJobDefinitions.forEach((job) => {
        if (selections[selectionKey(day, job.id)]) {
          rows.push({
            day_of_week: day,
            job_definition_id: job.id,
            sort_order: order,
          });
          order += 1;
        }
      });
    }

    return rows;
  };

  const handleSaveWeekSchedule = async () => {
    if (!selectedWeekId) return;
    const response = await fetch(`/api/admin/weeks/${selectedWeekId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule: buildSchedulePayload(weekSelections) }),
    });
    if (response.ok) {
      loadWeekStatus(selectedWeekId);
    }
  };

  const handleApplyTemplate = () => {
    if (!applyTemplateId) return;
    const template = templates.find((item) => item.id === applyTemplateId);
    setWeekSelections(buildSelectionsFromTemplate(template));
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplateId) return;
    const response = await fetch(
      `/api/admin/week-templates/${selectedTemplateId}/days`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days: buildSchedulePayload(templateSelections),
        }),
      }
    );
    if (response.ok) {
      loadTemplates();
    }
  };

  const handleOpenCreateTemplate = () => {
    setCreateTemplateName("");
    setCreateTemplateSelections({});
    setCreateTemplateOpen(true);
  };

  const handleSubmitCreateTemplate = async () => {
    const name = createTemplateName.trim();
    if (!name) return;
    const response = await fetch("/api/admin/week-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) return;
    const data = await response.json();
    await fetch(`/api/admin/week-templates/${data.template.id}/days`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        days: buildSchedulePayload(createTemplateSelections),
      }),
    });
    await loadTemplates();
    setSelectedTemplateId(data.template.id);
    setTemplateSelections(createTemplateSelections);
    setCreateTemplateOpen(false);
    setTemplateEditorOpen(true);
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplateId) return;
    const confirmed = window.confirm("Delete this template?");
    if (!confirmed) return;
    const response = await fetch(
      `/api/admin/week-templates/${selectedTemplateId}`,
      { method: "DELETE" }
    );
    if (response.ok) {
      setSelectedTemplateId("");
      setTemplateSelections({});
      loadTemplates();
    }
  };

  const handleCleanupWeek = async (weekId: string) => {
    setCleanupStatus(null);
    const confirmed = window.confirm(
      "Delete all ImgBB images for this week?"
    );
    if (!confirmed) return;
    const response = await fetch("/api/admin/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekId }),
    });
    if (!response.ok) {
      setCleanupStatus("Cleanup failed.");
      return;
    }
    const data = await response.json();
    setCleanupStatus(
      `Deleted ${data.deleted} of ${data.attempted} images.`
    );
    loadCleanupSummary();
  };

  const handleDeleteWeek = async (weekId: string) => {
    const confirmed = window.confirm("Delete this week and all submissions?");
    if (!confirmed) return;
    const response = await fetch(`/api/admin/weeks/${weekId}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setSelectedWeekId("");
      loadWeeks();
    }
  };

  const handleSaveSettings = async () => {
    setSettingsStatus(null);
    setSettingsPromptOpen(true);
  };

  const handleConfirmSaveSettings = async () => {
    if (changedSettingsCount === 0) {
      setSettingsPromptOpen(false);
      return;
    }
    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminPassword: settingsDraft.adminPassword.trim() || undefined,
        imgbbApiKey: settingsDraft.imgbbApiKey.trim() || undefined,
        masterPassword: settingsMasterPassword,
      }),
    });
    if (!response.ok) {
      setSettingsStatus("Failed to update settings.");
      return;
    }
    setSettingsStatus("Settings updated.");
    setSettingsDraft({ adminPassword: "", imgbbApiKey: "" });
    setSettingsMasterPassword("");
    setSettingsPromptOpen(false);
    loadSettingsFlags();
  };

  const handleOpenDetail = (
    day: number,
    jobId: string,
    submission: WeekStatusRow["job_submissions"][number] | undefined
  ) => {
    if (!submission || !selectedWeek) return;
    const rows = statusMap.get(selectionKey(day, jobId)) ?? [];
    const jobName =
      rows[0]?.job_definitions?.name ??
      weekJobDefinitions.find((job) => job.id === jobId)?.name ??
      "Job";

    const photos =
      submission.submission_photos
        ?.slice()
        .sort((a, b) => a.position - b.position)
        .map((photo) => ({
          description: photo.requirement_description_snapshot,
          url: photo.imgbb_url,
        })) ?? [];

    const late = isLateSubmission(submission.submitted_at, selectedWeek.start_date, day);

    setDetailModal({
      jobName,
      dayLabel: FULL_DAY_LABELS[day] ?? "Day",
      submission,
      photos,
      late,
    });
  };

  const weekPreviewSelections = useMemo(() => {
    const template = templates.find((item) => item.id === createTemplateId);
    return buildSelectionsFromTemplate(template);
  }, [templates, createTemplateId]);

  const previewWeekList = weekPreviewSelections;

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>Midnight Maker Admin</h1>
        </div>
        <button className="ghost" onClick={handleLogout}>
          Log out
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="tabs">
        <button
          className={tab === "overview" ? "tab active" : "tab"}
          onClick={() => setTab("overview")}
        >
          Week Overview
        </button>
        <button
          className={tab === "setup" ? "tab active" : "tab"}
          onClick={() => setTab("setup")}
        >
          Week Setup
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
        <button
          className={tab === "settings" ? "tab active" : "tab"}
          onClick={() => setTab("settings")}
        >
          Settings
        </button>
      </div>

      {tab === "overview" && (
        <section className="card">
          <h2>Week Overview</h2>
          <div className="row">
            <label className="field">
              <span>Select week</span>
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
          </div>

          {statusLoading && <div className="muted">Loading status...</div>}
          {selectedWeek && weekJobDefinitions.length === 0 && (
            <div className="muted">No scheduled jobs for this week yet.</div>
          )}
          {selectedWeek && weekJobDefinitions.length > 0 && (
            <JobDayGrid
              jobList={weekJobDefinitions}
              statusMap={statusMap}
              renderCell={({ dayIndex, jobId, isOn, isComplete, label, latestSubmission }) => {
                const late =
                  isComplete &&
                  selectedWeek &&
                  latestSubmission
                    ? isLateSubmission(
                        latestSubmission.submitted_at,
                        selectedWeek.start_date,
                        dayIndex
                      )
                    : false;
                const statusClass = late
                  ? "late"
                  : isComplete
                    ? "complete"
                    : isOn
                      ? "scheduled"
                      : "not-scheduled";
                const text = isComplete ? label : isOn ? "--" : "";

                return (
                  <button
                    type="button"
                    className={`status-box ${statusClass}`}
                    onClick={() =>
                      isComplete && latestSubmission
                        ? handleOpenDetail(dayIndex, jobId, latestSubmission)
                        : undefined
                    }
                    disabled={!isComplete}
                  >
                    {text}
                  </button>
                );
              }}
            />
          )}
        </section>
      )}

      {tab === "setup" && (
        <section className="card">
          <h2>Week Setup</h2>
          <label className="field block-gap">
            <span>Select week</span>
            <select
              value={selectedWeekId}
              onChange={(event) => {
                if (event.target.value === "__create__") {
                  setCreateWeekOpen(true);
                  return;
                }
                setSelectedWeekId(event.target.value);
              }}
            >
              <option value="">Select week</option>
              {weeks.map((week) => (
                <option key={week.id} value={week.id}>
                  {week.start_date}
                </option>
              ))}
              <option value="__create__">Create week...</option>
            </select>
          </label>

          {selectedWeek && (
            <div className="stack">
              <div className="row">
                <span className="muted">
                  {formatWeekRange(selectedWeek.start_date)}
                </span>
                <select
                  value={applyTemplateId}
                  onChange={(event) => {
                    if (event.target.value === "__create_template__") {
                      setApplyTemplateId("");
                      handleOpenCreateTemplate();
                      return;
                    }
                    setApplyTemplateId(event.target.value);
                  }}
                >
                  <option value="">Select template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                  <option value="__create_template__">Create template...</option>
                </select>
                <button
                  className="primary"
                  onClick={handleApplyTemplate}
                  disabled={!applyTemplateId}
                >
                  Apply Template
                </button>
                <button
                  className="ghost"
                  onClick={() => {
                    if (!applyTemplateId) return;
                    setSelectedTemplateId(applyTemplateId);
                    setTemplateEditorOpen(true);
                  }}
                  disabled={!applyTemplateId}
                >
                  <IconEdit />
                </button>
              </div>

              <JobDayGrid
                jobList={activeJobDefinitions}
                selections={weekSelections}
                renderCell={({ dayIndex, jobId, isOn }) => (
                  <div className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() =>
                        toggleSelection(setWeekSelections, dayIndex, jobId)
                      }
                    />
                  </div>
                )}
              />

              <button className="primary" onClick={handleSaveWeekSchedule}>
                Save Week Setup
              </button>

              <div className="stack section-gap">
                <strong>Cleanup</strong>
                {cleanupStatus && <div className="muted">{cleanupStatus}</div>}
                <div className="row">
                  <span>
                    {selectedCleanup
                      ? `${selectedCleanup.deleted_photos}/${selectedCleanup.total_photos} deleted`
                      : "0/0 deleted"}
                  </span>
                  <button
                    className="ghost"
                    onClick={() => handleCleanupWeek(selectedWeek.id)}
                  >
                    Delete ImgBB images
                  </button>
                </div>
              </div>
              <div className="row-end">
                <button
                  className="danger"
                  onClick={() => handleDeleteWeek(selectedWeek.id)}
                >
                  Delete record of week
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "jobs" && (
        <section className="card">
          <h2>Job Definitions</h2>
          <div className="list">
            <div className="list-row">
              <input
                placeholder="Job name"
                value={newJobName}
                onChange={(event) => setNewJobName(event.target.value)}
              />
              <button className="primary" onClick={handleCreateJobDefinition}>
                Add Job
              </button>
            </div>
            {jobDefinitions.map((job) => (
              <div key={job.id} className="list-row">
                <div className="stack">
                  <strong>{job.name}</strong>
                  <span className="muted">
                    {(job.job_requirements ?? []).length} photos required
                  </span>
                </div>
                <button className="icon" onClick={() => handleOpenJobEditor(job)}>
                  <IconEdit />
                </button>
                <button
                  className="icon"
                  onClick={() => handleDeleteJob(job.id)}
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "users" && (
        <section className="card">
          <h2>Users</h2>
          <div className="list">
            <div className="list-row">
              <input
                placeholder="Username"
                value={newUserName}
                onChange={(event) => setNewUserName(event.target.value)}
              />
              <button className="primary" onClick={handleCreateUser}>
                Add
              </button>
            </div>
            {users.map((user) => (
              <div key={user.id} className="list-row">
                <input
                  defaultValue={user.username}
                  onBlur={(event) =>
                    handleUserUpdate(user, { username: event.target.value })
                  }
                />
                <button className="icon" onClick={() => handleDeleteUser(user.id)}>
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "settings" && (
        <section className="card">
          <h2>Settings</h2>
          <div className="text-danger">
            Be careful changing these settings as they could lock you out.
          </div>
          {settingsStatus && <div className="muted">{settingsStatus}</div>}
          <div className="stack">
            <label className="field">
              <span>
                Admin password{settingsDraft.adminPassword.trim() ? " *" : ""}
              </span>
              <input
                type="password"
                placeholder="Update admin password"
                value={settingsDraft.adminPassword}
                onChange={(event) =>
                  setSettingsDraft((prev) => ({
                    ...prev,
                    adminPassword: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>
                ImgBB API key{settingsDraft.imgbbApiKey.trim() ? " *" : ""}
              </span>
              <input
                type="password"
                placeholder="Update ImgBB API key"
                value={settingsDraft.imgbbApiKey}
                onChange={(event) =>
                  setSettingsDraft((prev) => ({
                    ...prev,
                    imgbbApiKey: event.target.value,
                  }))
                }
              />
            </label>
            <button
              className="primary"
              onClick={handleSaveSettings}
              disabled={changedSettingsCount === 0}
            >
              Update {changedSettingsCount} Settings
            </button>
          </div>
        </section>
      )}

      {createWeekOpen && (
        <div className="modal">
          <div className="modal-card large">
            <div className="modal-header">
              <h3>Create Week</h3>
              <button className="icon" onClick={() => setCreateWeekOpen(false)}>
                x
              </button>
            </div>
            <div className="grid-two">
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
                  value={createTemplateId}
                  onChange={(event) => setCreateTemplateId(event.target.value)}
                >
                  <option value="">Select template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="stack">
              <span className="muted">Preview</span>
              <JobDayGrid
                jobList={activeJobDefinitions}
                selections={previewWeekList}
                renderCell={({ isOn }) => (
                  <div className={`status-box ${isOn ? "scheduled" : "not-scheduled"}`}>
                    {isOn ? "--" : ""}
                  </div>
                )}
              />
            </div>
            <button className="primary" onClick={handleCreateWeek}>
              Create
            </button>
          </div>
        </div>
      )}

      {createTemplateOpen && (
        <div className="modal">
          <div className="modal-card large">
            <div className="modal-header">
              <h3>Create Template</h3>
              <button className="icon" onClick={() => setCreateTemplateOpen(false)}>
                x
              </button>
            </div>
            <label className="field">
              <span>Template name</span>
              <input
                value={createTemplateName}
                onChange={(event) => setCreateTemplateName(event.target.value)}
              />
            </label>
            <JobDayGrid
              jobList={activeJobDefinitions}
              selections={createTemplateSelections}
              renderCell={({ dayIndex, jobId, isOn }) => (
                <div className="checkbox-cell">
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() =>
                      toggleSelection(setCreateTemplateSelections, dayIndex, jobId)
                    }
                  />
                </div>
              )}
            />
            <button className="primary" onClick={handleSubmitCreateTemplate}>
              Create Template
            </button>
          </div>
        </div>
      )}

      {templateEditorOpen && (
        <div className="modal">
          <div className="modal-card large">
            <div className="modal-header">
              <h3>Edit Template</h3>
              <button className="icon" onClick={() => setTemplateEditorOpen(false)}>
                x
              </button>
            </div>
            <div className="row">
              <select
                value={selectedTemplateId}
                onChange={(event) => {
                  if (event.target.value === "__create_template__") {
                    setTemplateEditorOpen(false);
                    handleOpenCreateTemplate();
                    return;
                  }
                  setSelectedTemplateId(event.target.value);
                }}
              >
                <option value="">Select template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
                <option value="__create_template__">Create template...</option>
              </select>
              <button
                className="icon"
                onClick={handleDeleteTemplate}
                disabled={!selectedTemplateId}
              >
                <IconTrash />
              </button>
            </div>
            {selectedTemplateId && (
              <JobDayGrid
                jobList={activeJobDefinitions}
                selections={templateSelections}
                renderCell={({ dayIndex, jobId, isOn }) => (
                  <div className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() =>
                        toggleSelection(setTemplateSelections, dayIndex, jobId)
                      }
                    />
                  </div>
                )}
              />
            )}
            <button className="primary" onClick={handleSaveTemplate}>
              Save Template
            </button>
          </div>
        </div>
      )}

      {jobEditorOpen && editingJobId && (
        <div className="modal">
          <div className="modal-card large">
            <div className="modal-header">
              <h3>Edit Job</h3>
              <button className="icon" onClick={() => setJobEditorOpen(false)}>
                x
              </button>
            </div>
            <label className="field">
              <span>Job name</span>
              <input
                value={editingJobName}
                onChange={(event) => setEditingJobName(event.target.value)}
              />
            </label>
            <div className="row">
              <input
                placeholder="Requirement"
                value={requirementInput}
                onChange={(event) => setRequirementInput(event.target.value)}
              />
              <button
                className="ghost"
                onClick={() => {
                  if (!requirementInput.trim()) return;
                  setEditingRequirements((prev) => [
                    ...prev,
                    { id: crypto.randomUUID(), description: requirementInput.trim() },
                  ]);
                  setRequirementInput("");
                }}
              >
                +
              </button>
            </div>
            <div className="list">
              {editingRequirements.map((req) => (
                <div key={req.id} className="list-row">
                  <span>{req.description}</span>
                  <button
                    className="icon"
                    onClick={() =>
                      setEditingRequirements((prev) =>
                        prev.filter((item) => item.id !== req.id)
                      )
                    }
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
            <button className="primary" onClick={handleSaveJobEditor}>
              Save
            </button>
          </div>
        </div>
      )}

      {detailModal && (
        <div className="modal">
          <div className="modal-card large">
            <div className="modal-header">
              <div>
                <h3>{detailModal.jobName}</h3>
                <p className="muted">{detailModal.dayLabel}</p>
              </div>
              <button className="icon" onClick={() => setDetailModal(null)}>
                x
              </button>
            </div>
            {detailModal.submission ? (
              <div className="stack">
                <div className="row">
                  <span className={`badge ${detailModal.late ? "warning" : ""}`}>
                    {detailModal.submission.users?.username ?? "Submitted"}
                  </span>
                  <span className={`muted ${detailModal.late ? "warning" : ""}`}>
                    {new Date(detailModal.submission.submitted_at).toLocaleString(
                      undefined,
                      {
                        weekday: "long",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      }
                    )}
                  </span>
                </div>
                <div className="photo-list">
                  {detailModal.photos.map((photo, index) => (
                    <button
                      key={`${photo.description}-${index}`}
                      className="photo-card"
                      onClick={() =>
                        setPhotoViewer({ photos: detailModal.photos, index })
                      }
                    >
                      <div className="muted">{photo.description}</div>
                      {photo.url ? (
                        <img src={photo.url} alt={photo.description} />
                      ) : (
                        <div className="muted">No photo uploaded.</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="muted">No submission yet for this job.</div>
            )}
          </div>
        </div>
      )}

      {photoViewer && (
        <div className="modal">
          <div className="modal-card fullscreen">
            <div className="modal-header">
              <h3>Photo</h3>
              <button className="icon" onClick={() => setPhotoViewer(null)}>
                x
              </button>
            </div>
            {photoViewer.photos[photoViewer.index]?.url ? (
              <img
                src={photoViewer.photos[photoViewer.index].url ?? ""}
                alt={photoViewer.photos[photoViewer.index].description}
              />
            ) : (
              <div className="muted">No photo available.</div>
            )}
            <div className="row">
              <button
                className="ghost"
                onClick={() =>
                  setPhotoViewer((prev) =>
                    prev
                      ? {
                          ...prev,
                          index:
                            (prev.index - 1 + prev.photos.length) %
                            prev.photos.length,
                        }
                      : prev
                  )
                }
              >
                {"<"}
              </button>
              <span>{photoViewer.photos[photoViewer.index].description}</span>
              <button
                className="ghost"
                onClick={() =>
                  setPhotoViewer((prev) =>
                    prev
                      ? {
                          ...prev,
                          index: (prev.index + 1) % prev.photos.length,
                        }
                      : prev
                  )
                }
              >
                {">"}
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsPromptOpen && (
        <div className="modal">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Confirm Update</h3>
              <button className="icon" onClick={() => setSettingsPromptOpen(false)}>
                x
              </button>
            </div>
            <label className="field">
              <span>Master password</span>
              <input
                type="password"
                value={settingsMasterPassword}
                onChange={(event) => setSettingsMasterPassword(event.target.value)}
              />
            </label>
            <button className="primary" onClick={handleConfirmSaveSettings}>
              Confirm Update
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DAY_LABELS, FULL_DAY_LABELS } from "@/lib/constants";
import { formatDateInput, getDayIndex, getMonday } from "@/lib/date";

type WeekSummary = {
  id: string;
  start_date: string;
};

type ScheduledJob = {
  id: string;
  day_of_week: number;
  sort_order: number;
  job_definition_id: string;
  job_definitions?: {
    id: string;
    name: string;
    job_requirements?: Array<{ position: number; description: string }>;
  };
};

type Submission = {
  id: string;
  submitted_at: string;
  note: string | null;
  submission_photos?: Array<{
    position: number;
    imgbb_url: string;
    requirement_description_snapshot: string;
  }>;
};

type PhotoSlot = {
  position: number;
  description: string;
  url?: string;
  uploading?: boolean;
};

type PendingPhoto = {
  position: number;
  file: File;
  previewUrl: string;
};

async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

export default function UserLogging() {
  const router = useRouter();
  const [weeks, setWeeks] = useState<WeekSummary[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<number>(getDayIndex(new Date()));
  const [schedule, setSchedule] = useState<ScheduledJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>([]);
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<Submission | null>(
    null
  );

  useEffect(() => {
    const loadWeeks = async () => {
      const response = await fetch("/api/public/weeks");
      if (!response.ok) return;
      const data = await response.json();
      const list: WeekSummary[] = data.weeks ?? [];
      setWeeks(list);

      if (list.length > 0) {
        const today = new Date();
        const monday = getMonday(today);
        const mondayString = formatDateInput(monday);
        const current = list.find((week) => week.start_date === mondayString);
        setSelectedWeekId(current?.id ?? list[0].id);
      }
    };
    loadWeeks();
  }, []);

  useEffect(() => {
    if (!selectedWeekId) return;
    const loadSchedule = async () => {
      const response = await fetch(
        `/api/user/schedule?weekId=${selectedWeekId}&day=${selectedDay}`
      );
      if (!response.ok) return;
      const data = await response.json();
      setSchedule(data.scheduledJobs ?? []);
      setSelectedJobId("");
      setPhotoSlots([]);
      setExistingSubmission(null);
      setSuccess(null);
    };
    loadSchedule();
  }, [selectedWeekId, selectedDay]);

  useEffect(() => {
    const loadSubmission = async () => {
      if (!selectedJobId) {
        setExistingSubmission(null);
        return;
      }
      const response = await fetch(
        `/api/user/submissions?scheduledJobId=${selectedJobId}`
      );
      if (!response.ok) return;
      const data = await response.json();
      setExistingSubmission(data.submission ?? null);
    };
    loadSubmission();
  }, [selectedJobId]);

  useEffect(() => {
    const job = schedule.find((item) => item.id === selectedJobId);
    if (!job) {
      setPhotoSlots([]);
      setNote("");
      return;
    }
    const requirements = (job.job_definitions?.job_requirements ?? []).sort(
      (a, b) => a.position - b.position
    );
    setPhotoSlots(
      requirements.map((requirement) => ({
        position: requirement.position,
        description: requirement.description,
      }))
    );
    setNote("");
  }, [selectedJobId, schedule]);

  const selectedJob = useMemo(
    () => schedule.find((job) => job.id === selectedJobId),
    [schedule, selectedJobId]
  );

  const allUploaded =
    photoSlots.length === 0 ||
    photoSlots.every((slot) => Boolean(slot.url));

  const handleFileChange = (position: number, file: File | null) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPendingPhoto({ position, file, previewUrl });
  };

  const handleUploadConfirm = async () => {
    if (!pendingPhoto) return;
    setError(null);
    const { position, file } = pendingPhoto;
    setPhotoSlots((prev) =>
      prev.map((slot) =>
        slot.position === position ? { ...slot, uploading: true } : slot
      )
    );

    const compressed = await compressImage(file);
    const formData = new FormData();
    formData.append("file", compressed, file.name || "photo.jpg");

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      setError("Upload failed. Please retry.");
      setPhotoSlots((prev) =>
        prev.map((slot) =>
          slot.position === position
            ? { ...slot, uploading: false }
            : slot
        )
      );
      URL.revokeObjectURL(pendingPhoto.previewUrl);
      setPendingPhoto(null);
      return;
    }

    const data = await response.json();
    setPhotoSlots((prev) =>
      prev.map((slot) =>
        slot.position === position
          ? { ...slot, url: data.url, uploading: false }
          : slot
      )
    );
    URL.revokeObjectURL(pendingPhoto.previewUrl);
    setPendingPhoto(null);
  };

  const handleSubmit = async () => {
    if (!selectedJobId) return;
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/user/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduledJobId: selectedJobId,
        note,
        photos: photoSlots.map((slot) => ({
          position: slot.position,
          url: slot.url,
        })),
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Submission failed.");
      return;
    }

    setSuccess("Submission saved.");
    const data = await response.json();
    setExistingSubmission({
      id: data.submissionId,
      submitted_at: new Date().toISOString(),
      note,
    });
  };

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>Log a Job</h1>
          <p className="muted">Submit your completed chores for the week.</p>
        </div>
        <button className="ghost" onClick={handleLogout}>
          Log out
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <section className="card">
        <div className="grid-two">
          <label className="field">
            <span>Week</span>
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
          <label className="field">
            <span>Day</span>
            <select
              value={selectedDay}
              onChange={(event) => setSelectedDay(Number(event.target.value))}
            >
              {FULL_DAY_LABELS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Job</span>
          <select
            value={selectedJobId}
            onChange={(event) => setSelectedJobId(event.target.value)}
          >
            <option value="">Select job</option>
            {schedule.map((job) => (
              <option key={job.id} value={job.id}>
                {job.job_definitions?.name ?? "Job"}
              </option>
            ))}
          </select>
        </label>

        {selectedJob && (
          <div className="stack">
            <h3>Photo Requirements</h3>
            {photoSlots.length === 0 && (
              <p className="muted">No photos required for this job.</p>
            )}
            <div className="list">
              {photoSlots.map((slot) => (
                <div key={slot.position} className="list-row">
                  <span className="pill">{slot.position + 1}</span>
                  <span>{slot.description}</span>
                  {slot.url ? (
                    <a href={slot.url} target="_blank" rel="noreferrer">
                      View
                    </a>
                  ) : (
                    <label className="ghost file-button">
                      {slot.uploading ? "Uploading…" : "Capture"}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(event) =>
                          handleFileChange(slot.position, event.target.files?.[0] ?? null)
                        }
                        disabled={slot.uploading}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>

            <label className="field">
              <span>Optional note</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
              />
            </label>

            <button
              className="primary"
              disabled={!selectedJobId || !allUploaded || Boolean(existingSubmission)}
              onClick={handleSubmit}
            >
              {existingSubmission ? "Already submitted" : "Submit job"}
            </button>

            {existingSubmission && (
              <div className="muted">
                Submitted at {new Date(existingSubmission.submitted_at).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </section>

      {pendingPhoto && (
        <div className="modal">
          <div className="modal-card">
            <h3>Preview Photo</h3>
            <img src={pendingPhoto.previewUrl} alt="Preview" />
            <div className="row">
              <button
                className="ghost"
                onClick={() => {
                  URL.revokeObjectURL(pendingPhoto.previewUrl);
                  setPendingPhoto(null);
                }}
              >
                Retake
              </button>
              <button className="primary" onClick={handleUploadConfirm}>
                Use photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

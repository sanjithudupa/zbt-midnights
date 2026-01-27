"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DAY_LABELS } from "@/lib/constants";
import { formatDateInput, getDayIndex, getMonday } from "@/lib/date";

type WeekSummary = {
  id: string;
  start_date: string;
};

type WeekStatusRow = {
  id: string;
  day_of_week: number;
  job_definition_id: string;
  job_definitions?: {
    id: string;
    name: string;
    sort_order?: number;
    job_requirements?: Array<{ position: number; description: string }>;
  };
  job_submissions?: Array<{
    id: string;
    submitted_at: string;
    user_id: string;
    review_status?: string | null;
    users?: { id: string; username: string };
  }>;
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
  deleteUrl?: string;
  uploading?: boolean;
  progress?: number;
};

type SessionResponse = {
  session: { role: "admin" | "user"; userId?: string } | null;
};

const selectionKey = (day: number, jobId: string) => `${day}:${jobId}`;

async function compressImage(blob: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(blob);
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const result = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
    return result ?? blob;
  } catch {
    return blob;
  }
}

export default function UserLogging() {
  const router = useRouter();
  const [weeks, setWeeks] = useState<WeekSummary[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<number>(getDayIndex(new Date()));
  const [statusRows, setStatusRows] = useState<WeekStatusRow[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>([]);
  const [skipRemaining, setSkipRemaining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState<Submission | null>(
    null
  );
  const [userName, setUserName] = useState<string>("");

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSlot, setCameraSlot] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<{ blob: Blob; preview: string } | null>(
    null
  );
  const [photoViewer, setPhotoViewer] = useState<{
    url: string;
    description: string;
  } | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const [torchSupported, setTorchSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const CameraFlashIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" strokeWidth="2" />
    </svg>
  );

  const CameraFlipIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M3 7h6V3" strokeWidth="2" />
      <path d="M21 17h-6v4" strokeWidth="2" />
      <path d="M20 7a8 8 0 0 0-14-4" strokeWidth="2" />
      <path d="M4 17a8 8 0 0 0 14 4" strokeWidth="2" />
    </svg>
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
    const loadUser = async () => {
      const sessionRes = await fetch("/api/session");
      if (!sessionRes.ok) return;
      const sessionData = (await sessionRes.json()) as SessionResponse;
      const userId = sessionData.session?.userId;
      if (!userId) return;
      const usersRes = await fetch("/api/public/users");
      if (!usersRes.ok) return;
      const usersData = await usersRes.json();
      const match = (usersData.users ?? []).find(
        (user: { id: string }) => user.id === userId
      );
      setUserName(match?.username ?? "");
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!selectedWeekId) return;
    const loadStatus = async () => {
      const response = await fetch(
        `/api/public/week-status?weekId=${selectedWeekId}`
      );
      if (!response.ok) return;
      const data = await response.json();
      setStatusRows(data.scheduledJobs ?? []);
      setSelectedJobId("");
      setPhotoSlots([]);
      setExistingSubmission(null);
      setSuccessOpen(false);
      setSkipRemaining(false);
    };
    loadStatus();
  }, [selectedWeekId]);

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
    const job = statusRows.find((item) => item.id === selectedJobId);
    if (!job) {
      setPhotoSlots([]);
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
  }, [selectedJobId, statusRows]);

  const selectedJob = useMemo(
    () => statusRows.find((job) => job.id === selectedJobId),
    [statusRows, selectedJobId]
  );



  const jobList = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    statusRows.forEach((row) => {
      if (row.job_definitions?.id && !map.has(row.job_definitions.id)) {
        map.set(row.job_definitions.id, {
          id: row.job_definitions.id,
          name: row.job_definitions.name,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      const aOrder =
        statusRows.find((row) => row.job_definitions?.id === a.id)
          ?.job_definitions?.sort_order ?? 0;
      const bOrder =
        statusRows.find((row) => row.job_definitions?.id === b.id)
          ?.job_definitions?.sort_order ?? 0;
      return aOrder - bOrder || a.name.localeCompare(b.name);
    });
  }, [statusRows]);

  const statusMap = useMemo(() => {
    const map = new Map<string, WeekStatusRow[]>();
    statusRows.forEach((row) => {
      const key = `${row.day_of_week}:${row.job_definition_id}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(row);
    });
    return map;
  }, [statusRows]);


  const allUploaded =
    photoSlots.length === 0 ||
    photoSlots.every((slot) => Boolean(slot.url));
  const anyUploaded = photoSlots.some((slot) => Boolean(slot.url));
  const isUploading = photoSlots.some((slot) => slot.uploading);
  const canSubmit =
    !existingSubmission &&
    !isUploading &&
    (skipRemaining ? anyUploaded : allUploaded);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const openCamera = async (position: number) => {
    setCameraSlot(position);
    setCameraError(null);
    setCaptured(null);
    setCameraOpen(true);
    setTorchOn(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera not available.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
      setTorchSupported(Boolean(capabilities?.torch));
    } catch (err) {
      setCameraError("Camera permission denied or unavailable.");
    }
  };

  const closeCamera = () => {
    stopCamera();
    setCameraOpen(false);
    setCaptured(null);
  };

  const toggleTorch = async () => {
    const stream = streamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track?.applyConstraints) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as any],
      } as MediaTrackConstraints);
      setTorchOn((prev) => !prev);
    } catch {
      setTorchSupported(false);
    }
  };

  const flipCamera = async () => {
    stopCamera();
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  useEffect(() => {
    if (cameraOpen && cameraSlot !== null) {
      openCamera(cameraSlot);
    }
    return () => stopCamera();
  }, [facingMode]);

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9)
    );
    if (!blob) return;
    const preview = URL.createObjectURL(blob);
    setCaptured({ blob, preview });
  };

  const uploadBlob = async (position: number, blob: Blob) => {
    setError(null);
    setPhotoSlots((prev) =>
      prev.map((slot) =>
        slot.position === position
          ? { ...slot, uploading: true, progress: 0 }
          : slot
      )
    );

    const compressed = await compressImage(blob);
    const file = new File([compressed], `photo-${position}.jpg`, {
      type: "image/jpeg",
    });
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      setPhotoSlots((prev) =>
        prev.map((slot) =>
          slot.position === position ? { ...slot, progress: percent } : slot
        )
      );
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        setError("Upload failed. Please retry.");
        setPhotoSlots((prev) =>
          prev.map((slot) =>
            slot.position === position
              ? { ...slot, uploading: false, progress: undefined }
              : slot
          )
        );
        return;
      }
      const data = JSON.parse(xhr.responseText);
      setPhotoSlots((prev) =>
        prev.map((slot) =>
          slot.position === position
            ? {
                ...slot,
                url: data.url,
                deleteUrl: data.deleteUrl,
                uploading: false,
                progress: 100,
              }
            : slot
        )
      );
    };
    xhr.onerror = () => {
      setError("Upload failed. Please retry.");
      setPhotoSlots((prev) =>
        prev.map((slot) =>
          slot.position === position
            ? { ...slot, uploading: false, progress: undefined }
            : slot
        )
      );
    };
    xhr.send(formData);
  };

  const handleKeepPhoto = async () => {
    if (!captured || cameraSlot === null) return;
    uploadBlob(cameraSlot, captured.blob);
    URL.revokeObjectURL(captured.preview);
    closeCamera();
  };

  const handleSubmit = async () => {
    if (!selectedJobId) return;
    setError(null);
    setSuccessOpen(false);

    const response = await fetch("/api/user/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduledJobId: selectedJobId,
        photos: photoSlots
          .filter((slot) => Boolean(slot.url))
          .map((slot) => ({
            position: slot.position,
            url: slot.url,
            deleteUrl: slot.deleteUrl,
          })),
        skipRemaining,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Submission failed.");
      return;
    }

    setSuccessOpen(true);
    const data = await response.json();
    setExistingSubmission({
      id: data.submissionId,
      submitted_at: new Date().toISOString(),
      note: null,
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
          <h1>ZBT Midnights Log</h1>
          <p className="muted">logging as {userName || "user"}</p>
        </div>
        <button className="ghost" onClick={handleLogout}>
          Log out
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section className="card">
        <label className="field">
          <span>Week</span>
          <select
            className="flat-select"
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

        <div className="stack">
          <div className="muted" style={{ marginTop: "8px" }}>
            Tap a white box to log that job.
          </div>
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
                    const rows = statusMap.get(key) ?? [];
                    const isOn = rows.length > 0;
                    const submissions = rows.flatMap(
                      (row) => row.job_submissions ?? []
                    );
                    const latestSubmission = submissions
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(b.submitted_at).getTime() -
                          new Date(a.submitted_at).getTime()
                      )[0];
                    const isComplete = Boolean(latestSubmission);
                    const adminEntry = latestSubmission?.review_status === "admin";
                    const label = isComplete
                      ? latestSubmission?.users?.username ?? ""
                      : "";
                    const statusClass = isComplete
                      ? adminEntry
                        ? "complete-admin"
                        : "complete"
                      : isOn
                        ? "scheduled"
                        : "not-scheduled";
                    const text = isComplete ? label : isOn ? "--" : "";
                    const actionable = isOn && !isComplete;
                    const isSelected =
                      actionable &&
                      selectedJobId === rows[0]?.id &&
                      selectedDay === dayIndex;
                    return (
                      <div key={key} className="grid-cell no-pad">
                        <button
                          type="button"
                          className={`status-box ${statusClass} ${
                            isSelected ? "selected-job" : ""
                          }`}
                          style={isSelected ? { background: "#dbeafe" } : undefined}
                          onClick={() => {
                            if (!actionable) return;
                            const scheduled = rows[0];
                            if (!scheduled) return;
                            setSelectedDay(dayIndex);
                            setSelectedJobId(scheduled.id);
                          }}
                          disabled={!actionable}
                        >
                          {text}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {selectedJob && (
        <section className="card">
          <h2>
            Add Photos ({photoSlots.length})
          </h2>
          {photoSlots.length === 0 && (
            <p className="muted">No photos required for this job.</p>
          )}
          <div className="stack">
            {photoSlots.map((slot) => (
              <div key={slot.position} className="stack">
                <div>
                  <strong>{slot.position + 1}.</strong> {slot.description}
                </div>
                <button
                  className="ghost"
                  onClick={() =>
                    slot.url
                      ? setPhotoViewer({ url: slot.url, description: slot.description })
                      : openCamera(slot.position)
                  }
                >
                  <div className="photo-card">
                    {slot.url ? (
                      <img src={slot.url} alt={slot.description} />
                    ) : (
                      <div className="muted photo-placeholder">no photo taken</div>
                    )}
                  </div>
                </button>
                {slot.uploading && (
                  <div className="progress-bar">
                    <span style={{ width: `${slot.progress ?? 0}%` }} />
                  </div>
                )}
                {slot.url && (
                  <button className="ghost" onClick={() => openCamera(slot.position)}>
                    Retake
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            className="primary"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {existingSubmission ? "Already submitted" : "Submit job"}
          </button>

          {anyUploaded && !allUploaded && (
            <label className="inline">
              <input
                type="checkbox"
                checked={skipRemaining}
                onChange={(event) => setSkipRemaining(event.target.checked)}
              />
              Skip remaining photos?
            </label>
          )}
        </section>
      )}

      {cameraOpen && (
        <div className="modal">
          <div className="modal-card fullscreen">
            <div className="modal-header">
              <h3>Camera</h3>
              <button className="icon" onClick={closeCamera}>
                x
              </button>
            </div>
            {cameraError ? (
              <div className="stack">
                <div className="muted">{cameraError}</div>
                <label className="field">
                  <span>Upload file</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file && cameraSlot !== null) {
                        uploadBlob(cameraSlot, file);
                        closeCamera();
                      }
                    }}
                  />
                </label>
              </div>
            ) : captured ? (
              <div className="stack">
                <img src={captured.preview} alt="Preview" />
                <div className="row">
                  <button className="ghost" onClick={() => setCaptured(null)}>
                    Retake
                  </button>
                  <button className="primary" onClick={handleKeepPhoto}>
                    Keep
                  </button>
                </div>
              </div>
            ) : (
              <div className="camera-container">
                <video className="camera-video" ref={videoRef} playsInline muted />
                <div className="camera-controls">
                  <button
                    className="ghost"
                    onClick={toggleTorch}
                    disabled={!torchSupported}
                  >
                    <CameraFlashIcon />
                  </button>
                  <button className="ghost" onClick={flipCamera}>
                    <CameraFlipIcon />
                  </button>
                </div>
                <button className="camera-capture" onClick={capturePhoto}>
                  Capture
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {successOpen && (
        <div className="modal">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Success</h3>
              <button className="icon" onClick={() => setSuccessOpen(false)}>
                x
              </button>
            </div>
            <div className="muted">Successfully uploaded images.</div>
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
            <img src={photoViewer.url} alt={photoViewer.description} />
            <div className="muted">{photoViewer.description}</div>
          </div>
        </div>
      )}
    </div>
  );
}

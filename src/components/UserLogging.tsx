"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DAY_LABELS } from "@/lib/constants";
import { formatDateInput, getDayIndex, getMonday, parseDateInput } from "@/lib/date";

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
    verified_by_admin?: boolean | null;
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

type JobDefinition = {
  id: string;
  name: string;
  sort_order?: number;
  job_requirements?: Array<{ position: number; description: string }>;
};

const selectionKey = (day: number, jobId: string) => `${day}:${jobId}`;

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
  const [selectedJobDefinitionId, setSelectedJobDefinitionId] = useState<string>("");
  const [selectedCellKey, setSelectedCellKey] = useState<string>("");
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>([]);
  const [skipRemaining, setSkipRemaining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState<Submission | null>(
    null
  );
  const [userName, setUserName] = useState<string>("");
  const [sheetWeekData, setSheetWeekData] = useState<string[][] | null>(null);
  const [sheetWeekStatus, setSheetWeekStatus] = useState<string | null>(null);
  const [jobDefinitions, setJobDefinitions] = useState<JobDefinition[]>([]);

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
  const [isStandalone, setIsStandalone] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isSheetMode = true;
  const isBusy = pendingRequests > 0;

  const trackedFetch = useCallback(
    async (...args: Parameters<typeof fetch>) => {
      setPendingRequests((prev) => prev + 1);
      try {
        return await fetch(...args);
      } finally {
        setPendingRequests((prev) => Math.max(0, prev - 1));
      }
    },
    []
  );

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
      const response = await trackedFetch("/api/public/weeks");
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
    const loadJobDefinitions = async () => {
      const response = await trackedFetch("/api/public/job-definitions");
      if (!response.ok) return;
      const data = await response.json();
      setJobDefinitions(data.jobDefinitions ?? []);
    };
    loadJobDefinitions();
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      const sessionRes = await trackedFetch("/api/session");
      if (!sessionRes.ok) return;
      const sessionData = (await sessionRes.json()) as SessionResponse;
      const userId = sessionData.session?.userId;
      if (!userId) return;
      const usersRes = await trackedFetch("/api/public/users");
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
    const standalone =
      (window.navigator as any).standalone ||
      window.matchMedia("(display-mode: standalone)").matches;
    setIsStandalone(Boolean(standalone));
  }, []);

  useEffect(() => {
    if (!selectedWeekId) return;
    const loadStatus = async () => {
      const response = await trackedFetch(
        `/api/public/week-status?weekId=${selectedWeekId}`
      );
      if (!response.ok) return;
      const data = await response.json();
      setStatusRows(data.scheduledJobs ?? []);
      setSelectedJobId("");
      setSelectedJobDefinitionId("");
      setSelectedCellKey("");
      setPhotoSlots([]);
      setExistingSubmission(null);
      setSuccessOpen(false);
      setSkipRemaining(false);
    };
    loadStatus();
  }, [selectedWeekId]);

  useEffect(() => {
    const week = weeks.find((item) => item.id === selectedWeekId);
    if (!week?.start_date) return;
    let cancelled = false;
    setSheetWeekStatus("Loading sheet...");
    trackedFetch(`/api/public/sheets/week?start_date=${week.start_date}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load sheet.");
        }
        if (!cancelled) {
          setSheetWeekData(data.data ?? null);
          setSheetWeekStatus(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSheetWeekData(null);
          setSheetWeekStatus("Failed to load sheet.");
        }
        console.warn("[sheets] Failed to load sheet.", error);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedWeekId, weeks]);

  useEffect(() => {
    const loadSubmission = async () => {
      if (!selectedJobId) {
        setExistingSubmission(null);
        return;
      }
      const response = await trackedFetch(
        `/api/user/submissions?scheduledJobId=${selectedJobId}`
      );
      if (!response.ok) return;
      const data = await response.json();
      setExistingSubmission(data.submission ?? null);
    };
    loadSubmission();
  }, [selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) {
      setPhotoSlots([]);
      return;
    }
    if (selectedJobDefinitionId) {
      const definition = jobDefinitions.find(
        (item) => item.id === selectedJobDefinitionId
      );
      const requirements = (definition?.job_requirements ?? []).sort(
        (a, b) => a.position - b.position
      );
      setPhotoSlots(
        requirements.map((requirement) => ({
          position: requirement.position,
          description: requirement.description,
        }))
      );
      return;
    }
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
  }, [selectedJobId, selectedJobDefinitionId, statusRows, jobDefinitions]);

  const selectedJob = useMemo(() => {
    return selectedJobId ? { id: selectedJobId } : null;
  }, [selectedJobId]);



  const jobList = useMemo<Array<{ id: string; name: string; missing?: boolean }>>(() => {
    if (sheetWeekData) {
      const nameToDefinition = new Map(
        jobDefinitions.map((definition) => [definition.name, definition])
      );
      const jobNames = sheetWeekData[0] ?? [];
      return jobNames.map((name, index) => {
        const definition = nameToDefinition.get(name);
        return {
          id: definition?.id ?? `sheet:${index}`,
          name,
          missing: !definition,
        };
      });
    }
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
  }, [statusRows, sheetWeekData, jobDefinitions]);

  const selectedWeek = useMemo(
    () => weeks.find((week) => week.id === selectedWeekId),
    [weeks, selectedWeekId]
  );

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

  const sheetSelections = useMemo(() => {
    if (!sheetWeekData) {
      return {
        selections: new Map<string, boolean>(),
        assignments: new Map<string, string>(),
        states: new Map<string, string>(),
      };
    }
    const selections = new Map<string, boolean>();
    const assignments = new Map<string, string>();
    const states = new Map<string, string>();
    jobList.forEach((job, jobIndex) => {
      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const nameIndex = 1 + dayIndex * 2;
        const stateIndex = 2 + dayIndex * 2;
        const state = sheetWeekData[stateIndex]?.[jobIndex] ?? "";
        const normalized = state.trim().toUpperCase();
        const isOn = ["O", "R", "P", "V", "RNG"].includes(normalized);
        if (!isOn) continue;
        selections.set(selectionKey(dayIndex, job.id), true);
        states.set(selectionKey(dayIndex, job.id), normalized);
        const assigned = sheetWeekData[nameIndex]?.[jobIndex]?.trim();
        if (assigned) {
          assignments.set(selectionKey(dayIndex, job.id), assigned);
        }
      }
    });
    return { selections, assignments, states };
  }, [sheetWeekData, jobList]);


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

    const response = await trackedFetch("/api/user/submissions", {
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
    await trackedFetch("/api/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>ZBT Midnights Log</h1>
          <p className="muted">
            logging as {userName || "user"}
            {isStandalone && (
              <>
                {" "}
                ·{" "}
                <button className="link" onClick={() => window.location.reload()}>
                  refresh
                </button>
              </>
            )}
          </p>
        </div>
        <div className="row">
          {isBusy && (
            <div className="loading-chip">
              <span className="spinner" />
              <span>Loading...</span>
            </div>
          )}
          <button className="ghost" onClick={handleLogout} disabled={isBusy}>
            {isBusy ? "Working..." : "Log out"}
          </button>
        </div>
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
          {isSheetMode && sheetWeekStatus && (
            <div className="muted" style={{ marginTop: "8px" }}>
              {sheetWeekStatus}
            </div>
          )}
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
                  <div
                    className={`grid-cell job-name${job.missing ? " text-danger" : ""}`}
                  >
                    {job.name}
                  </div>
                  {DAY_LABELS.map((_, dayIndex) => {
                    const key = selectionKey(dayIndex, job.id);
                    const rows = statusMap.get(key) ?? [];
                    const isOn = isSheetMode
                      ? Boolean(sheetSelections?.selections?.get(key))
                      : rows.length > 0;
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
                    const effectiveComplete = isOn ? isComplete : false;
                    const sheetState = isSheetMode
                      ? sheetSelections?.states?.get(key) ?? ""
                      : "";
                    const normalizedState = sheetState.trim().toUpperCase();
                    const assignedName = isSheetMode
                      ? sheetSelections?.assignments?.get(key) ?? ""
                      : "";
                    const isRng =
                      normalizedState === "RNG" ||
                      assignedName.trim().toUpperCase() === "RNG";
                    const isVerified = normalizedState === "V";
                    const label = effectiveComplete
                      ? latestSubmission?.users?.username ?? ""
                      : "";
                    const assignedLabel = isOn && !effectiveComplete
                      ? isRng
                        ? assignedName && assignedName.trim().toUpperCase() !== "RNG"
                          ? `rng: ${assignedName}`
                          : "rng"
                        : assignedName
                          ? `assigned: ${assignedName}`
                          : ""
                      : "";
                    const statusClass = isVerified
                      ? "complete"
                      : effectiveComplete
                        ? "complete-admin"
                        : isOn
                          ? "scheduled"
                          : "not-scheduled";
                    const text = effectiveComplete ? label : assignedLabel;
                    const actionable = isOn && !effectiveComplete && !job.missing;
                    const isSelected = actionable
                      ? isSheetMode
                        ? selectedCellKey === key
                        : selectedJobId === rows[0]?.id && selectedDay === dayIndex
                      : false;
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
                            setSelectedDay(dayIndex);
                            setSelectedJobDefinitionId(
                              job.id.startsWith("sheet:") ? "" : job.id
                            );
                            if (isSheetMode) {
                              setSelectedCellKey(key);
                            }
                            if (!isSheetMode) {
                              const scheduled = rows[0];
                              if (!scheduled) return;
                              setSelectedJobId(scheduled.id);
                              return;
                            }
                            if (rows[0]?.id) {
                              setSelectedJobId(rows[0].id);
                              return;
                            }
                            if (!selectedWeekId || job.id.startsWith("sheet:")) {
                              return;
                            }
                            trackedFetch("/api/public/sheets/scheduled-job", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                weekId: selectedWeekId,
                                dayOfWeek: dayIndex,
                                jobDefinitionId: job.id,
                              }),
                            })
                              .then(async (response) => {
                                const data = await response.json();
                                if (!response.ok) {
                                  throw new Error(data.error ?? "Failed to prepare job.");
                                }
                                setSelectedJobId(data.scheduledJobId);
                              })
                              .catch((err) => {
                                console.warn("[sheets] Failed to prepare job.", err);
                                setError("Failed to prepare job.");
                              });
                          }}
                          disabled={!actionable}
                        >
                          <div className="stack">
                            {text && <div>{text}</div>}
                          </div>
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
            disabled={!canSubmit || isBusy}
            onClick={handleSubmit}
          >
            {isBusy
              ? "Submitting..."
              : existingSubmission
                ? "Already submitted"
                : "Submit job"}
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

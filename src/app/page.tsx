"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PublicUser = {
  id: string;
  username: string;
};

type SessionResponse = {
  session: { role: "admin" | "user"; userId?: string } | null;
};

export default function HomePage() {
  const router = useRouter();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showA2hs, setShowA2hs] = useState(false);
  const [a2hsText, setA2hsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const sessionRes = await fetch("/api/session");
      const sessionData = (await sessionRes.json()) as SessionResponse;
      if (sessionData.session?.role === "admin") {
        router.replace("/admin");
        return;
      }
      if (sessionData.session?.role === "user") {
        router.replace("/user");
        return;
      }

      const response = await fetch("/api/public/users");
      if (!response.ok) return;
      const data = await response.json();
      setUsers(data.users ?? []);
    };
    load();
  }, [router]);

  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    const isStandalone =
      (window.navigator as any).standalone ||
      window.matchMedia("(display-mode: standalone)").matches;

    if (isStandalone) return;

    if (isIOS) {
      setA2hsText('Add to Home Screen: Tap "Share" then "Add to Home Screen".');
      setShowA2hs(true);
      return;
    }

    if (isAndroid) {
      setA2hsText('Add to Home Screen: Tap "Menu" then "Add to Home screen".');
      setShowA2hs(true);
    }
  }, []);

  const handleAdminLogin = async () => {
    setError(null);
    setLoading(true);
    const response = await fetch("/api/login/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: adminPassword }),
    });
    setLoading(false);
    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Admin login failed.");
      return;
    }
    router.push("/admin");
  };

  const handleUserLogin = async () => {
    setError(null);
    if (!selectedUser) {
      setError("Please select a user.");
      return;
    }
    if (selectedUser === "__admin__") {
      setError("Enter the admin password.");
      return;
    }
    setLoading(true);
    const response = await fetch("/api/login/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUser }),
    });
    setLoading(false);
    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "User login failed.");
      return;
    }
    router.push("/user");
  };

  const isAdminSelected = selectedUser === "__admin__";

  return (
    <div className="page">
      <div className="panel">
        <h1>ZBT Midnights Job Tracker</h1>

        {error && <div className="error-banner">{error}</div>}

        <section className="card">
          <h2>Login</h2>
          <label className="field">
            <span>Select user</span>
            <select
              className="flat-select"
              value={selectedUser}
              onChange={(event) => setSelectedUser(event.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">Choose...</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
              <option value="__admin__">Admin</option>
            </select>
          </label>
          {isAdminSelected && (
            <label className="field" style={{ marginTop: "8px" }}>
              <span>Admin password</span>
              <div className="row full nowrap">
                <input
                  className="input-grow"
                  type={showAdminPassword ? "text" : "password"}
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setShowAdminPassword((prev) => !prev)}
                >
                  {showAdminPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
          )}
          <div className="cta-row">
            <button
              className="primary"
              onClick={isAdminSelected ? handleAdminLogin : handleUserLogin}
              disabled={
                loading ||
                !selectedUser ||
                (isAdminSelected && adminPassword.length === 0)
              }
            >
              Continue
            </button>
          </div>
        </section>
        {showA2hs && (
          <div className="a2hs-inline">
            <span>{a2hsText}</span>
          </div>
        )}
      </div>
    </div>
  );
}

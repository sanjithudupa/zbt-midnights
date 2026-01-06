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

  return (
    <div className="page">
      <div className="panel">
        <h1>Midnights Job Tracker</h1>
        <p className="muted">Choose your mode to continue.</p>

        {error && <div className="error-banner">{error}</div>}

        <div className="grid-two">
          <section className="card">
            <h2>Admin Login</h2>
            <label className="field">
              <span>Admin password</span>
              <input
                type="password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
              />
            </label>
            <button
              className="primary"
              onClick={handleAdminLogin}
              disabled={loading || !adminPassword}
            >
              Enter Admin
            </button>
          </section>

          <section className="card">
            <h2>User Login</h2>
            <label className="field">
              <span>Select user</span>
              <select
                value={selectedUser}
                onChange={(event) => setSelectedUser(event.target.value)}
              >
                <option value="">Choose...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primary"
              onClick={handleUserLogin}
              disabled={loading || !selectedUser}
            >
              Continue
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

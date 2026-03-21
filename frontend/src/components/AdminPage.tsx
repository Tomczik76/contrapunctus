import { useState, useEffect } from "react";
import { API_BASE, getAdminToken, setAdminToken, clearAdminToken, adminHeaders } from "../auth";

interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

interface BugReport {
  id: string;
  userId: string;
  description: string;
  stateJson: unknown;
  createdAt: string;
}

interface FeatureRequest {
  id: string;
  userId: string;
  description: string;
  createdAt: string;
}

type Tab = "users" | "bug-reports" | "feature-requests" | "roadmap-votes";

export function AdminPage() {
  const [token, setToken] = useState(getAdminToken() ?? "");
  const [authed, setAuthed] = useState(!!getAdminToken());
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<User[]>([]);
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([]);
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [roadmapVotes, setRoadmapVotes] = useState<Record<string, number>>({});

  function handleLogin() {
    setAdminToken(password);
    setToken(password);
    setAuthed(true);
    setError("");
  }

  function handleLogout() {
    clearAdminToken();
    setToken("");
    setAuthed(false);
  }

  useEffect(() => {
    if (!authed) return;
    fetch(`${API_BASE}/api/admin/users`, { headers: adminHeaders() })
      .then(async (res) => {
        if (!res.ok) {
          setAuthed(false);
          clearAdminToken();
          setError("Invalid admin token");
          return;
        }
        setUsers(await res.json());
      });
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    fetch(`${API_BASE}/api/admin/bug-reports`, { headers: adminHeaders() })
      .then(async (res) => {
        if (res.ok) setBugReports(await res.json());
      });
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    fetch(`${API_BASE}/api/admin/feature-requests`, { headers: adminHeaders() })
      .then(async (res) => {
        if (res.ok) setFeatureRequests(await res.json());
      });
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    fetch(`${API_BASE}/api/admin/roadmap-votes`, { headers: adminHeaders() })
      .then(async (res) => {
        if (res.ok) setRoadmapVotes(await res.json());
      });
  }, [authed]);

  if (!authed) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f5f5f5" }}>
        <div style={{ background: "#fff", padding: 32, borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.1)", width: 320 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Admin Login</h2>
          {error && <div style={{ color: "#c00", fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            style={{ width: "100%", padding: 8, fontSize: 14, border: "1px solid #ccc", borderRadius: 4, marginBottom: 12, boxSizing: "border-box" }}
          />
          <button
            onClick={handleLogin}
            style={{ width: "100%", padding: 8, fontSize: 14, background: "#333", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const tabLabels: Record<Tab, string> = { users: "Users", "bug-reports": "Bug Reports", "feature-requests": "Feature Requests", "roadmap-votes": "Roadmap Votes" };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e0e0e0", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Contrapunctus Admin</h1>
        <button onClick={handleLogout} style={{ padding: "5px 10px", fontSize: 12, background: "none", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer" }}>
          Sign out
        </button>
      </div>

      <div style={{ display: "flex", gap: 0, padding: "24px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginRight: 24 }}>
          {(["users", "bug-reports", "feature-requests", "roadmap-votes"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelectedReport(null); }}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                background: tab === t ? "#333" : "#fff",
                color: tab === t ? "#fff" : "#333",
                border: "1px solid #ccc",
                borderRadius: 4,
                cursor: "pointer",
                textAlign: "left",
                whiteSpace: "nowrap",
              }}
            >
              {tabLabels[t]}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", overflow: "hidden" }}>
          {tab === "users" && <UsersTab users={users} />}
          {tab === "bug-reports" && (
            <BugReportsTab
              reports={bugReports}
              userMap={userMap}
              selectedReport={selectedReport}
              onSelect={setSelectedReport}
            />
          )}
          {tab === "feature-requests" && <FeatureRequestsTab requests={featureRequests} userMap={userMap} />}
          {tab === "roadmap-votes" && <RoadmapVotesTab votes={roadmapVotes} />}
        </div>
      </div>
    </div>
  );
}

function UsersTab({ users }: { users: User[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
          <th style={{ padding: "10px 12px" }}>Email</th>
          <th style={{ padding: "10px 12px" }}>Display Name</th>
          <th style={{ padding: "10px 12px" }}>Created</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
            <td style={{ padding: "8px 12px" }}>{u.email}</td>
            <td style={{ padding: "8px 12px" }}>{u.displayName}</td>
            <td style={{ padding: "8px 12px" }}>{new Date(u.createdAt).toLocaleString()}</td>
          </tr>
        ))}
        {users.length === 0 && (
          <tr><td colSpan={3} style={{ padding: 24, textAlign: "center", color: "#999" }}>No users yet</td></tr>
        )}
      </tbody>
    </table>
  );
}

function BugReportsTab({
  reports,
  userMap,
  selectedReport,
  onSelect,
}: {
  reports: BugReport[];
  userMap: Record<string, User>;
  selectedReport: BugReport | null;
  onSelect: (r: BugReport | null) => void;
}) {
  if (selectedReport) {
    return (
      <div style={{ padding: 16 }}>
        <button
          onClick={() => onSelect(null)}
          style={{ marginBottom: 12, padding: "4px 10px", fontSize: 12, background: "none", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer" }}
        >
          Back
        </button>
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Bug Report</h3>
        <div style={{ fontSize: 13, marginBottom: 8 }}>
          <strong>User:</strong> {userMap[selectedReport.userId]?.email ?? selectedReport.userId}
        </div>
        <div style={{ fontSize: 13, marginBottom: 8 }}>
          <strong>Date:</strong> {new Date(selectedReport.createdAt).toLocaleString()}
        </div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>
          <strong>Description:</strong> {selectedReport.description}
        </div>
        <div style={{ fontSize: 12, fontFamily: "monospace", background: "#f8f8f8", padding: 12, borderRadius: 4, maxHeight: 500, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {JSON.stringify(selectedReport.stateJson, null, 2)}
        </div>
      </div>
    );
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
          <th style={{ padding: "10px 12px" }}>User</th>
          <th style={{ padding: "10px 12px" }}>Description</th>
          <th style={{ padding: "10px 12px" }}>Created</th>
        </tr>
      </thead>
      <tbody>
        {reports.map((r) => (
          <tr
            key={r.id}
            onClick={() => onSelect(r)}
            style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer" }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#f8f8ff")}
            onMouseOut={(e) => (e.currentTarget.style.background = "")}
          >
            <td style={{ padding: "8px 12px" }}>{userMap[r.userId]?.email ?? r.userId}</td>
            <td style={{ padding: "8px 12px", maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</td>
            <td style={{ padding: "8px 12px" }}>{new Date(r.createdAt).toLocaleString()}</td>
          </tr>
        ))}
        {reports.length === 0 && (
          <tr><td colSpan={3} style={{ padding: 24, textAlign: "center", color: "#999" }}>No bug reports yet</td></tr>
        )}
      </tbody>
    </table>
  );
}

function FeatureRequestsTab({
  requests,
  userMap,
}: {
  requests: FeatureRequest[];
  userMap: Record<string, User>;
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
          <th style={{ padding: "10px 12px" }}>User</th>
          <th style={{ padding: "10px 12px" }}>Description</th>
          <th style={{ padding: "10px 12px" }}>Created</th>
        </tr>
      </thead>
      <tbody>
        {requests.map((r) => (
          <tr key={r.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
            <td style={{ padding: "8px 12px" }}>{userMap[r.userId]?.email ?? r.userId}</td>
            <td style={{ padding: "8px 12px" }}>{r.description}</td>
            <td style={{ padding: "8px 12px" }}>{new Date(r.createdAt).toLocaleString()}</td>
          </tr>
        ))}
        {requests.length === 0 && (
          <tr><td colSpan={3} style={{ padding: 24, textAlign: "center", color: "#999" }}>No feature requests yet</td></tr>
        )}
      </tbody>
    </table>
  );
}

function RoadmapVotesTab({ votes }: { votes: Record<string, number> }) {
  const sorted = Object.entries(votes).sort(([, a], [, b]) => b - a);
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
          <th style={{ padding: "10px 12px" }}>Feature</th>
          <th style={{ padding: "10px 12px", textAlign: "right" }}>Votes</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(([key, count]) => (
          <tr key={key} style={{ borderBottom: "1px solid #f0f0f0" }}>
            <td style={{ padding: "8px 12px" }}>{key}</td>
            <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>{count}</td>
          </tr>
        ))}
        {sorted.length === 0 && (
          <tr><td colSpan={2} style={{ padding: 24, textAlign: "center", color: "#999" }}>No votes yet</td></tr>
        )}
      </tbody>
    </table>
  );
}

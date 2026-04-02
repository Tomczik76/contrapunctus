import { useState, useEffect, useCallback } from "react";
import { API_BASE, getAdminToken, setAdminToken, clearAdminToken, adminHeaders } from "../auth";
import { NoteEditor, type PlacedBeat } from "./staff";
import { TONIC_LABELS } from "../constants";

interface User {
  id: string;
  email: string;
  displayName: string;
  isEducator: boolean;
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

interface Correction {
  id: string;
  userId: string;
  category: string;
  measure: number;
  beat: number;
  voice: string | null;
  currentAnalysis: unknown;
  suggestedCorrection: unknown;
  description: string | null;
  stateSnapshot: unknown;
  status: string;
  upvotes: number;
  downvotes: number;
  createdAt: string;
  updatedAt: string;
}

interface AdminLesson {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  template: string;
  tonicIdx: number;
  scaleName: string;
  tsTop: number;
  tsBottom: number;
  sopranoBeats: unknown;
  bassBeats: unknown;
  figuredBass: unknown;
  sortOrder: number;
  createdAt: string;
}

type Tab = "users" | "bug-reports" | "corrections" | "feature-requests" | "roadmap-votes" | "lessons";

export function AdminPage() {
  const [token, setToken] = useState(getAdminToken() ?? "");
  const [authed, setAuthed] = useState(!!getAdminToken());
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<User[]>([]);
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [selectedCorrection, setSelectedCorrection] = useState<Correction | null>(null);
  const [correctionsRefresh, setCorrectionsRefresh] = useState(0);
  const [roadmapVotes, setRoadmapVotes] = useState<Record<string, number>>({});
  const [lessons, setLessons] = useState<AdminLesson[]>([]);
  const [lessonsRefresh, setLessonsRefresh] = useState(0);

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
    fetch(`${API_BASE}/api/admin/corrections`, { headers: adminHeaders() })
      .then(async (res) => {
        if (res.ok) setCorrections(await res.json());
      });
  }, [authed, correctionsRefresh]);

  useEffect(() => {
    if (!authed) return;
    fetch(`${API_BASE}/api/admin/roadmap-votes`, { headers: adminHeaders() })
      .then(async (res) => {
        if (res.ok) setRoadmapVotes(await res.json());
      });
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    fetch(`${API_BASE}/api/admin/lessons`, { headers: adminHeaders() })
      .then(async (res) => {
        if (res.ok) setLessons(await res.json());
      });
  }, [authed, lessonsRefresh]);

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
  const tabLabels: Record<Tab, string> = {
    users: "Users",
    "bug-reports": "Bug Reports",
    corrections: "Corrections",
    "feature-requests": "Feature Requests",
    "roadmap-votes": "Roadmap Votes",
    lessons: "Lessons",
  };

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
          {(["users", "bug-reports", "corrections", "feature-requests", "roadmap-votes", "lessons"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelectedReport(null); setSelectedCorrection(null); }}
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
          {tab === "corrections" && (
            <CorrectionsTab
              corrections={corrections}
              userMap={userMap}
              selectedCorrection={selectedCorrection}
              onSelect={setSelectedCorrection}
              onRefresh={() => setCorrectionsRefresh((n) => n + 1)}
            />
          )}
          {tab === "feature-requests" && <FeatureRequestsTab requests={featureRequests} userMap={userMap} />}
          {tab === "roadmap-votes" && <RoadmapVotesTab votes={roadmapVotes} />}
          {tab === "lessons" && <LessonsTab lessons={lessons} onRefresh={() => setLessonsRefresh((n) => n + 1)} />}
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
          <th style={{ padding: "10px 12px" }}>Role</th>
          <th style={{ padding: "10px 12px" }}>Created</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
            <td style={{ padding: "8px 12px" }}>{u.email}</td>
            <td style={{ padding: "8px 12px" }}>{u.displayName}</td>
            <td style={{ padding: "8px 12px" }}>
              {u.isEducator ? (
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "#eef", color: "#44c" }}>Educator</span>
              ) : (
                <span style={{ fontSize: 11, color: "#999" }}>Student</span>
              )}
            </td>
            <td style={{ padding: "8px 12px" }}>{new Date(u.createdAt).toLocaleString()}</td>
          </tr>
        ))}
        {users.length === 0 && (
          <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#666" }}>No users yet</td></tr>
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
          <tr><td colSpan={3} style={{ padding: 24, textAlign: "center", color: "#666" }}>No bug reports yet</td></tr>
        )}
      </tbody>
    </table>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  chord_label: "Chord Label",
  nct_detection: "NCT Detection",
  part_writing: "Part-Writing Error",
};

const STATUS_OPTIONS = ["pending", "confirmed", "rejected", "fixed"];

function CorrectionsTab({
  corrections,
  userMap,
  selectedCorrection,
  onSelect,
  onRefresh,
}: {
  corrections: Correction[];
  userMap: Record<string, User>;
  selectedCorrection: Correction | null;
  onSelect: (c: Correction | null) => void;
  onRefresh: () => void;
}) {
  const [updatingStatus, setUpdatingStatus] = useState(false);

  async function handleStatusChange(id: string, newStatus: string) {
    setUpdatingStatus(true);
    await fetch(`${API_BASE}/api/admin/corrections/${id}/status`, {
      method: "PUT",
      headers: { ...adminHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setUpdatingStatus(false);
    onRefresh();
    onSelect(null);
  }

  if (selectedCorrection) {
    const statusColor = selectedCorrection.status === "confirmed" ? "#080" : selectedCorrection.status === "fixed" ? "#06a" : selectedCorrection.status === "rejected" ? "#c00" : "#b80";
    return (
      <div style={{ padding: 16 }}>
        <button
          onClick={() => onSelect(null)}
          style={{ marginBottom: 12, padding: "4px 10px", fontSize: 12, background: "none", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer" }}
        >
          Back
        </button>
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Correction Report</h3>
        <div style={{ fontSize: 13, marginBottom: 8 }}>
          <strong>User:</strong> {userMap[selectedCorrection.userId]?.email ?? selectedCorrection.userId}
        </div>
        <div style={{ fontSize: 13, marginBottom: 8 }}>
          <strong>Date:</strong> {new Date(selectedCorrection.createdAt).toLocaleString()}
        </div>
        <div style={{ fontSize: 13, marginBottom: 8 }}>
          <strong>Category:</strong> {CATEGORY_LABELS[selectedCorrection.category] ?? selectedCorrection.category}
        </div>
        <div style={{ fontSize: 13, marginBottom: 8 }}>
          <strong>Location:</strong> Measure {selectedCorrection.measure}, Beat {selectedCorrection.beat}
          {selectedCorrection.voice && ` (${selectedCorrection.voice})`}
        </div>
        <div style={{ fontSize: 13, marginBottom: 8 }}>
          <strong>Votes:</strong> +{selectedCorrection.upvotes} / -{selectedCorrection.downvotes}
        </div>
        {selectedCorrection.description && (
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            <strong>Description:</strong> {selectedCorrection.description}
          </div>
        )}
        <div style={{ fontSize: 13, marginBottom: 8 }}>
          <strong>Current Analysis:</strong>
          <pre style={{ margin: "4px 0", padding: 8, background: "#f8f8f8", borderRadius: 4, fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {JSON.stringify(selectedCorrection.currentAnalysis, null, 2)}
          </pre>
        </div>
        <div style={{ fontSize: 13, marginBottom: 8 }}>
          <strong>Suggested Correction:</strong>
          <pre style={{ margin: "4px 0", padding: 8, background: "#f0f8f0", borderRadius: 4, fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {JSON.stringify(selectedCorrection.suggestedCorrection, null, 2)}
          </pre>
        </div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>
          <strong>Status: </strong>
          <span style={{ color: statusColor, fontWeight: 600 }}>{selectedCorrection.status}</span>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {STATUS_OPTIONS.filter((s) => s !== selectedCorrection.status).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(selectedCorrection.id, s)}
              disabled={updatingStatus}
              style={{
                padding: "6px 14px", fontSize: 12, fontWeight: 600,
                background: s === "confirmed" ? "#080" : s === "fixed" ? "#06a" : s === "rejected" ? "#c00" : "#b80",
                color: "#fff", border: "none", borderRadius: 4, cursor: "pointer",
                opacity: updatingStatus ? 0.6 : 1,
                textTransform: "capitalize",
              }}
            >
              {s === "confirmed" ? "Confirm" : s === "rejected" ? "Reject" : s === "fixed" ? "Mark Fixed" : "Set Pending"}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, fontFamily: "monospace", background: "#f8f8f8", padding: 12, borderRadius: 4, maxHeight: 500, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          <strong style={{ fontFamily: "sans-serif" }}>State Snapshot:</strong>
          <br />
          {JSON.stringify(selectedCorrection.stateSnapshot, null, 2)}
        </div>
      </div>
    );
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
          <th style={{ padding: "10px 12px" }}>User</th>
          <th style={{ padding: "10px 12px" }}>Category</th>
          <th style={{ padding: "10px 12px" }}>Location</th>
          <th style={{ padding: "10px 12px" }}>Status</th>
          <th style={{ padding: "10px 12px" }}>Votes</th>
          <th style={{ padding: "10px 12px" }}>Created</th>
        </tr>
      </thead>
      <tbody>
        {corrections.map((c) => {
          const statusColor = c.status === "confirmed" ? "#080" : c.status === "fixed" ? "#06a" : c.status === "rejected" ? "#c00" : "#b80";
          return (
            <tr
              key={c.id}
              onClick={() => onSelect(c)}
              style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#f8f8ff")}
              onMouseOut={(e) => (e.currentTarget.style.background = "")}
            >
              <td style={{ padding: "8px 12px" }}>{userMap[c.userId]?.email ?? c.userId}</td>
              <td style={{ padding: "8px 12px" }}>{CATEGORY_LABELS[c.category] ?? c.category}</td>
              <td style={{ padding: "8px 12px" }}>m.{c.measure} b.{c.beat}</td>
              <td style={{ padding: "8px 12px", color: statusColor, fontWeight: 600 }}>{c.status}</td>
              <td style={{ padding: "8px 12px" }}>+{c.upvotes} / -{c.downvotes}</td>
              <td style={{ padding: "8px 12px" }}>{new Date(c.createdAt).toLocaleString()}</td>
            </tr>
          );
        })}
        {corrections.length === 0 && (
          <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#666" }}>No correction reports yet</td></tr>
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
          <tr><td colSpan={3} style={{ padding: 24, textAlign: "center", color: "#666" }}>No feature requests yet</td></tr>
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
          <tr><td colSpan={2} style={{ padding: 24, textAlign: "center", color: "#666" }}>No votes yet</td></tr>
        )}
      </tbody>
    </table>
  );
}

function LessonsTab({ lessons, onRefresh }: { lessons: AdminLesson[]; onRefresh: () => void }) {
  const [editing, setEditing] = useState<AdminLesson | "new" | null>(null);

  if (editing) {
    return (
      <LessonForm
        lesson={editing === "new" ? null : editing}
        onDone={() => { setEditing(null); onRefresh(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      <div style={{ padding: "12px 12px 0", display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => setEditing("new")}
          style={{
            padding: "6px 14px", fontSize: 13, fontWeight: 600,
            background: "#333", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer",
          }}
        >
          Create Lesson
        </button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
            <th style={{ padding: "10px 12px" }}>Title</th>
            <th style={{ padding: "10px 12px" }}>Template</th>
            <th style={{ padding: "10px 12px" }}>Key</th>
            <th style={{ padding: "10px 12px" }}>Difficulty</th>
            <th style={{ padding: "10px 12px" }}>Order</th>
            <th style={{ padding: "10px 12px" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {lessons.map((l) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
              <td style={{ padding: "8px 12px", fontWeight: 600 }}>{l.title}</td>
              <td style={{ padding: "8px 12px" }}>{l.template}</td>
              <td style={{ padding: "8px 12px" }}>{TONIC_LABELS[l.tonicIdx] ?? l.tonicIdx} {l.scaleName}</td>
              <td style={{ padding: "8px 12px" }}>{l.difficulty}</td>
              <td style={{ padding: "8px 12px" }}>{l.sortOrder}</td>
              <td style={{ padding: "8px 12px", display: "flex", gap: 6 }}>
                <button
                  onClick={() => setEditing(l)}
                  style={{ padding: "3px 8px", fontSize: 12, background: "none", border: "1px solid #ccc", borderRadius: 3, cursor: "pointer" }}
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("Delete this lesson?")) return;
                    await fetch(`${API_BASE}/api/admin/lessons/${l.id}`, {
                      method: "DELETE",
                      headers: adminHeaders(),
                    });
                    onRefresh();
                  }}
                  style={{ padding: "3px 8px", fontSize: 12, background: "none", border: "1px solid #ccc", borderRadius: 3, cursor: "pointer", color: "#c00" }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {lessons.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#666" }}>No lessons yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LessonForm({
  lesson,
  onDone,
  onCancel,
}: {
  lesson: AdminLesson | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!lesson;
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [description, setDescription] = useState(lesson?.description ?? "");
  const [difficulty, setDifficulty] = useState(lesson?.difficulty ?? "beginner");
  const [template, setTemplate] = useState(lesson?.template ?? "harmonize_melody");
  const [tonicIdx, setTonicIdx] = useState(lesson?.tonicIdx ?? 0);
  const [scaleName, setScaleName] = useState(lesson?.scaleName ?? "major");
  const [tsTop, setTsTop] = useState(lesson?.tsTop ?? 4);
  const [tsBottom, setTsBottom] = useState(lesson?.tsBottom ?? 4);
  const [sopranoBeats, setSopranoBeats] = useState<PlacedBeat[]>(
    lesson ? (lesson.sopranoBeats as PlacedBeat[]) : []
  );
  const [bassBeats, setBassBeats] = useState<PlacedBeat[]>(
    lesson?.bassBeats ? (lesson.bassBeats as PlacedBeat[]) : []
  );
  const [figuredBass, setFiguredBass] = useState<string[][]>(
    lesson?.figuredBass ? (lesson.figuredBass as string[][]) : []
  );
  const [sortOrder, setSortOrder] = useState(lesson?.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [bassEditorKey, setBassEditorKey] = useState(100);

  const isFiguredBass = template === "figured_bass";
  const isRomanNumeral = template === "roman_numeral_analysis";

  const handleTrebleBeatsChanged = useCallback((beats: PlacedBeat[]) => {
    setSopranoBeats(beats);
  }, []);

  const handleBassBeatsChanged = useCallback((beats: PlacedBeat[]) => {
    setBassBeats(beats);
  }, []);

  async function handleSubmit() {
    if (!title.trim()) { setError("Title is required"); return; }
    if (!description.trim()) { setError("Description is required"); return; }

    if (isFiguredBass) {
      const validBass = bassBeats.filter((b) => !b.isRest && b.notes.length > 0);
      if (validBass.length === 0) { setError("Write at least one note for the bass line"); return; }
    } else if (isRomanNumeral) {
      const validTreble = sopranoBeats.filter((b) => !b.isRest && b.notes.length > 0);
      const validBass = bassBeats.filter((b) => !b.isRest && b.notes.length > 0);
      if (validTreble.length === 0 && validBass.length === 0) { setError("Write music on both staves"); return; }
    } else {
      const validBeats = sopranoBeats.filter((b) => !b.isRest && b.notes.length > 0);
      if (validBeats.length === 0) { setError("Write at least one note for the soprano melody"); return; }
    }

    setSaving(true);
    setError("");

    const body: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      difficulty,
      template,
      tonicIdx,
      scaleName,
      tsTop,
      tsBottom,
      sopranoBeats: isFiguredBass ? [] : sopranoBeats,
      sortOrder,
    };

    if (isFiguredBass) {
      body.bassBeats = bassBeats;
      body.figuredBass = figuredBass;
    }

    if (isRomanNumeral) {
      body.bassBeats = bassBeats;
    }

    const url = isEdit
      ? `${API_BASE}/api/admin/lessons/${lesson!.id}`
      : `${API_BASE}/api/admin/lessons`;

    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { ...adminHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save");
      return;
    }

    onDone();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: 8, fontSize: 13,
    border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{isEdit ? "Edit Lesson" : "Create Lesson"}</h3>
        <button onClick={onCancel} style={{ padding: "4px 10px", fontSize: 12, background: "none", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer" }}>
          Cancel
        </button>
      </div>

      {error && <div style={{ color: "#c00", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Template */}
        <div>
          <label style={labelStyle}>Template</label>
          <select value={template} onChange={(e) => setTemplate(e.target.value)} style={inputStyle}>
            <option value="harmonize_melody">Harmonize a Melody</option>
            <option value="figured_bass">Figured Bass</option>
            <option value="roman_numeral_analysis">Roman Numeral Analysis</option>
          </select>
        </div>

        {/* Title + Description */}
        <div>
          <label style={labelStyle}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="e.g. Harmonize a Melody in G Major" />
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} placeholder="Instructions for the student..." />
        </div>

        {/* Key & Scale */}
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Key</label>
            <select value={tonicIdx} onChange={(e) => setTonicIdx(Number(e.target.value))} style={inputStyle}>
              {TONIC_LABELS.map((label, i) => (
                <option key={i} value={i}>{label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Scale</label>
            <select value={scaleName} onChange={(e) => setScaleName(e.target.value)} style={inputStyle}>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </select>
          </div>
        </div>

        {/* Time Signature */}
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Time Sig Top</label>
            <input type="number" value={tsTop} onChange={(e) => setTsTop(Number(e.target.value))} style={inputStyle} min={1} max={12} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Time Sig Bottom</label>
            <select value={tsBottom} onChange={(e) => setTsBottom(Number(e.target.value))} style={inputStyle}>
              <option value={2}>2</option>
              <option value={4}>4</option>
              <option value={8}>8</option>
            </select>
          </div>
        </div>

        {/* Difficulty + Sort Order */}
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={inputStyle}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Sort Order</label>
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} style={inputStyle} min={0} />
          </div>
        </div>

        {/* Soprano Melody Editor (harmonize_melody) */}
        {!isFiguredBass && !isRomanNumeral && (
          <div>
            <label style={labelStyle}>Soprano Melody</label>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
              Write the soprano melody on the treble staff below. Only treble notes will be used.
              {sopranoBeats.filter((b) => !b.isRest && b.notes.length > 0).length > 0 && (
                <span style={{ marginLeft: 8, color: "#333", fontWeight: 600 }}>
                  {sopranoBeats.filter((b) => !b.isRest && b.notes.length > 0).length} beats
                </span>
              )}
            </div>
            <div style={{
              border: "1px solid #ccc", borderRadius: 6, overflow: "hidden",
              height: 700, position: "relative",
            }}>
              <NoteEditor
                key={editorKey}
                onTrebleBeatsChanged={handleTrebleBeatsChanged}
                initialTonicIdx={tonicIdx}
                initialScaleName={scaleName}
                initialTsTop={tsTop}
                initialTsBottom={tsBottom}
                initialTrebleBeats={sopranoBeats.length > 0 ? sopranoBeats : undefined}
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => setShowJson(!showJson)}
                style={{ padding: "3px 8px", fontSize: 11, background: "none", border: "1px solid #ddd", borderRadius: 3, cursor: "pointer", color: "#666" }}
              >
                {showJson ? "Hide" : "Show"} JSON
              </button>
              {showJson && (
                <pre style={{
                  marginTop: 6, padding: 10, background: "#f8f8f8", borderRadius: 4,
                  fontSize: 11, fontFamily: "monospace", maxHeight: 200, overflow: "auto",
                  border: "1px solid #eee",
                }}>
                  {JSON.stringify(sopranoBeats, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* Bass Line + Figured Bass (figured_bass template) */}
        {isFiguredBass && (
          <div>
            <label style={labelStyle}>Bass Line</label>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 8, lineHeight: 1.6 }}>
              Write the bass line on the bass staff below. An input box appears under each note for figured bass numbers.
              Enter numbers separated by commas (e.g. <strong>6,4</strong> for <sup>6</sup><sub>4</sub>).
              Leave empty for root position.
              Students will see the bass line and figures, and must identify the roman numerals.
            </div>
            <div style={{
              border: "1px solid #ccc", borderRadius: 6, overflow: "hidden",
              height: 700, position: "relative",
            }}>
              <NoteEditor
                key={bassEditorKey}
                onBassBeatsChanged={handleBassBeatsChanged}
                figuredBassValues={figuredBass}
                onFiguredBassChanged={setFiguredBass}
                initialTonicIdx={tonicIdx}
                initialScaleName={scaleName}
                initialTsTop={tsTop}
                initialTsBottom={tsBottom}
                initialBassBeats={bassBeats.length > 0 ? bassBeats : undefined}
              />
            </div>

            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => setShowJson(!showJson)}
                style={{ padding: "3px 8px", fontSize: 11, background: "none", border: "1px solid #ddd", borderRadius: 3, cursor: "pointer", color: "#666" }}
              >
                {showJson ? "Hide" : "Show"} JSON
              </button>
              {showJson && (
                <pre style={{
                  marginTop: 6, padding: 10, background: "#f8f8f8", borderRadius: 4,
                  fontSize: 11, fontFamily: "monospace", maxHeight: 200, overflow: "auto",
                  border: "1px solid #eee",
                }}>
                  {JSON.stringify({ bassBeats, figuredBass }, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* SATB Editor (roman_numeral_analysis) */}
        {isRomanNumeral && (
          <div>
            <label style={labelStyle}>Complete SATB Music</label>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 8, lineHeight: 1.6 }}>
              Write soprano + alto on the treble staff, tenor + bass on the bass staff.
              Students will see all music locked and must enter roman numeral analysis only.
            </div>
            <div style={{
              border: "1px solid #ccc", borderRadius: 6, overflow: "hidden",
              height: 700, position: "relative",
            }}>
              <NoteEditor
                key={editorKey}
                onTrebleBeatsChanged={handleTrebleBeatsChanged}
                onBassBeatsChanged={handleBassBeatsChanged}
                initialTonicIdx={tonicIdx}
                initialScaleName={scaleName}
                initialTsTop={tsTop}
                initialTsBottom={tsBottom}
                initialTrebleBeats={sopranoBeats.length > 0 ? sopranoBeats : undefined}
                initialBassBeats={bassBeats.length > 0 ? bassBeats : undefined}
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => setShowJson(!showJson)}
                style={{ padding: "3px 8px", fontSize: 11, background: "none", border: "1px solid #ddd", borderRadius: 3, cursor: "pointer", color: "#666" }}
              >
                {showJson ? "Hide" : "Show"} JSON
              </button>
              {showJson && (
                <pre style={{
                  marginTop: 6, padding: 10, background: "#f8f8f8", borderRadius: 4,
                  fontSize: 11, fontFamily: "monospace", maxHeight: 200, overflow: "auto",
                  border: "1px solid #eee",
                }}>
                  {JSON.stringify({ sopranoBeats, bassBeats }, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* Submit */}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onCancel} style={{ padding: "8px 16px", fontSize: 13, background: "none", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: 600,
              background: "#333", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving..." : isEdit ? "Update Lesson" : "Create Lesson"}
          </button>
        </div>
      </div>
    </div>
  );
}


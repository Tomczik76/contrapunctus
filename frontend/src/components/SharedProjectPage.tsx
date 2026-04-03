import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { NoteEditor } from "./staff";
import type { PlacedBeat } from "./staff/types";
import { API_BASE } from "../auth";

interface SharedProject {
  id: string;
  name: string;
  trebleBeats: PlacedBeat[];
  bassBeats: PlacedBeat[];
  tsTop: number;
  tsBottom: number;
  tonicIdx: number;
  scaleName: string;
}

export function SharedProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<SharedProject | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) { setError(true); setLoading(false); return; }
    fetch(`${API_BASE}/api/projects/${projectId}/public`)
      .then(async (res) => {
        if (res.ok) {
          setProject(await res.json());
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>;
  if (error || !project) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h2>Not Available</h2>
      <p style={{ color: "#666" }}>This composition is not publicly shared or does not exist.</p>
    </div>
  );

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
      <span style={{ fontWeight: 700, fontSize: 15 }}>{project.name}</span>
      <span style={{ fontSize: 12, color: "#888" }}>Shared composition</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", paddingTop: 44 }}>
      <NoteEditor
        header={header}
        embedded={false}
        readOnly
        initialTrebleBeats={project.trebleBeats}
        initialBassBeats={project.bassBeats}
        initialTsTop={project.tsTop}
        initialTsBottom={project.tsBottom}
        initialTonicIdx={project.tonicIdx}
        initialScaleName={project.scaleName}
      />
    </div>
  );
}

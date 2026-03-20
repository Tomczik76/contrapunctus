import { createRoot } from "react-dom/client";
import { NoteEditor } from "./components/Staff";

function App() {
  return (
    <div style={{ padding: 24, color: "#1a1a1a", maxWidth: 900 }}>
      <h1 style={{ fontFamily: "serif" }}>Contrapunctus</h1>
      <NoteEditor />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

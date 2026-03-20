import { createRoot } from "react-dom/client";
import { NoteEditor } from "./components/Staff";

function App() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "32px 16px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 960,
        background: "#fff",
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)",
        padding: "36px 40px 48px",
      }}>
        <h1 style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: -0.5,
          marginBottom: 24,
          borderBottom: "1px solid #e0dcd8",
          paddingBottom: 16,
          color: "#1a1a1a",
        }}>
          Contrapunctus
        </h1>
        <NoteEditor />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

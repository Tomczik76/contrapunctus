import { useState, useRef, useEffect } from "react";
import { useAuth, API_BASE } from "../auth";
import { svgToPngBase64 } from "../utils/svgExport";

interface ShareButtonProps {
  svgElement: SVGSVGElement | null;
  sourceType: "project" | "exercise";
  sourceId: string;
  title: string;
  description?: string;
  style?: React.CSSProperties;
}

// Set to true to always regenerate share images (bypasses cache)
const FORCE_REGENERATE = true;

export function ShareButton({ svgElement, sourceType, sourceId, title, description = "", style }: ShareButtonProps) {
  const { token } = useAuth();
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  // Authenticated upload for projects (original flow)
  const uploadAuth = async (): Promise<string | null> => {
    if (!svgElement || !token) return null;
    setSharing(true);
    try {
      const imageBase64 = await svgToPngBase64(svgElement);
      const res = await fetch(`${API_BASE}/api/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sourceType, sourceId, title, description, imageBase64 }),
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      const url = data.shareUrl || `${API_BASE}/share/${data.id}`;
      setShareUrl(url);
      return url;
    } catch (err) {
      console.error("Share failed:", err);
      return null;
    } finally {
      setSharing(false);
    }
  };

  // Public exercise share: checks for existing share, creates if needed (no auth)
  const shareExercise = async (): Promise<string | null> => {
    if (!svgElement) return null;
    setSharing(true);
    try {
      if (!FORCE_REGENERATE) {
        // Check if a fresh share already exists
        const checkRes = await fetch(`${API_BASE}/api/community/exercises/${sourceId}/share`);
        if (checkRes.ok) {
          const data = await checkRes.json();
          if (data.shareUrl) {
            setShareUrl(data.shareUrl);
            return data.shareUrl;
          }
        }
      }
      // Upload image (force=true bypasses backend cache too)
      const imageBase64 = await svgToPngBase64(svgElement);
      const forceParam = FORCE_REGENERATE ? "?force=true" : "";
      const res = await fetch(`${API_BASE}/api/community/exercises/${sourceId}/share${forceParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      const url = data.shareUrl || `${API_BASE}/share/${data.id}`;
      setShareUrl(url);
      return url;
    } catch (err) {
      console.error("Share failed:", err);
      return null;
    } finally {
      setSharing(false);
    }
  };

  const handleClick = async () => {
    if (shareUrl) {
      setShowMenu(true);
      return;
    }
    const url = sourceType === "exercise"
      ? await shareExercise()
      : await uploadAuth();
    if (url) setShowMenu(true);
  };

  const openShare = (platform: "facebook" | "x" | "copy") => {
    if (!shareUrl) return;
    setShowMenu(false);
    const encoded = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(title);
    switch (platform) {
      case "facebook":
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encoded}`, "fb-share", "width=600,height=400");
        break;
      case "x":
        window.open(`https://x.com/intent/post?url=${encoded}&text=${encodedTitle}`, "x-share", "width=600,height=400");
        break;
      case "copy":
        navigator.clipboard.writeText(shareUrl);
        break;
    }
  };

  // Projects still require auth
  if (sourceType === "project" && !token) return null;

  const menuStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "100%",
    right: 0,
    marginBottom: 4,
    background: "#fff",
    border: "1px solid #ccc",
    borderRadius: 6,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: 9999,
    minWidth: 150,
    overflow: "hidden",
  };

  const itemStyle: React.CSSProperties = {
    padding: "8px 14px",
    fontSize: 13,
    cursor: "pointer",
    display: "block",
    width: "100%",
    background: "none",
    border: "none",
    textAlign: "left",
    fontFamily: "inherit",
  };

  return (
    <div style={{ position: "relative" }} ref={menuRef}>
      <button onClick={handleClick} disabled={sharing || !svgElement} style={style} title="Share">
        {sharing ? "Sharing..." : "Share"}
      </button>
      {showMenu && shareUrl && (
        <div style={menuStyle}>
          <button style={itemStyle} onClick={() => openShare("facebook")}
            onMouseEnter={e => (e.currentTarget.style.background = "#f0ece8")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
            Facebook
          </button>
          <button style={itemStyle} onClick={() => openShare("x")}
            onMouseEnter={e => (e.currentTarget.style.background = "#f0ece8")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
            X (Twitter)
          </button>
          <button style={itemStyle} onClick={() => openShare("copy")}
            onMouseEnter={e => (e.currentTarget.style.background = "#f0ece8")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
            Copy Link
          </button>
        </div>
      )}
    </div>
  );
}

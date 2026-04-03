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

  const upload = async (): Promise<string | null> => {
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

  const handleClick = async () => {
    const url = shareUrl || await upload();
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

  if (!token) return null;

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

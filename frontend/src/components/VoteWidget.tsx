import { useTheme } from "../useTheme";

interface VoteWidgetProps {
  /** Net score (upvotes - downvotes) or upvote count */
  count: number;
  /** Current user's vote state: "up", "down", or null */
  userVote?: string | null;
  /** Called with "up" or "down" when a vote button is clicked */
  onVote?: (vote: string) => void;
  /** If true, only show upvote (no downvote button) */
  upvoteOnly?: boolean;
  /** Compact mode for inline use (e.g. exercise list cards) */
  compact?: boolean;
}

export function VoteWidget({ count, userVote, onVote, upvoteOnly, compact }: VoteWidgetProps) {
  const theme = useTheme();
  const interactive = !!onVote;

  const upColor = userVote === "up" ? "#16a34a" : theme.textMuted;
  const downColor = userVote === "down" ? "#d97706" : theme.textMuted;
  const countColor = userVote === "up" ? "#16a34a" : userVote === "down" ? "#d97706" : "inherit";

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      border: compact ? "none" : `1px solid ${theme.cardBorder}`,
      borderRadius: 8,
      padding: compact ? 0 : "2px 4px",
      minWidth: compact ? 24 : 32,
    }}>
      {interactive ? (
        <button
          onClick={(e) => { e.stopPropagation(); onVote("up"); }}
          style={{
            padding: 0, fontSize: compact ? 10 : 11, lineHeight: 1,
            background: "none", border: "none",
            cursor: "pointer", color: upColor,
          }}
          title="Upvote"
        >&#9650;</button>
      ) : (
        <span style={{
          fontSize: compact ? 10 : 11, lineHeight: 1, color: upColor,
        }}>&#9650;</span>
      )}
      <span style={{
        fontSize: compact ? 11 : 12, fontWeight: 700, lineHeight: 1.2,
        color: countColor,
      }}>
        {count}
      </span>
      {!upvoteOnly && (
        interactive ? (
          <button
            onClick={(e) => { e.stopPropagation(); onVote("down"); }}
            style={{
              padding: 0, fontSize: compact ? 10 : 11, lineHeight: 1,
              background: "none", border: "none",
              cursor: "pointer", color: downColor,
            }}
            title="Downvote"
          >&#9660;</button>
        ) : (
          <span style={{
            fontSize: compact ? 10 : 11, lineHeight: 1, color: downColor,
          }}>&#9660;</span>
        )
      )}
    </div>
  );
}

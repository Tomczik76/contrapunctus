import { useTheme } from "../useTheme";
import { UserControls } from "./UserControls";

export function AppFooter({ maxWidth = 700 }: { maxWidth?: number }) {
  const theme = useTheme();

  return (
    <>
      <div style={{ marginTop: "auto" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: theme.footerBg,
        borderTop: `1px solid ${theme.footerBorder}`,
        padding: "16px 24px", color: theme.text,
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          maxWidth,
          margin: "0 auto",
        }}>
          <UserControls />
        </div>
      </div>
    </>
  );
}

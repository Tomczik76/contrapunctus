export function passwordStrength(password: string) {
  return {
    length:  password.length >= 8,
    number:  /\d/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
  };
}

export function isPasswordValid(password: string): boolean {
  const s = passwordStrength(password);
  return s.length && s.number && s.special;
}

export const reqStyle = (met: boolean): React.CSSProperties => ({
  fontSize: 12,
  color: met ? "#2a7d4f" : "#999",
  display: "flex",
  alignItems: "center",
  gap: 4,
  transition: "color 0.15s ease",
});

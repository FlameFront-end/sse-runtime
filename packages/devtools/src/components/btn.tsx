import { type CSSProperties, useState } from "react";
import { C } from "../theme/tokens";

type BtnProps = {
  readonly children: React.ReactNode;
  readonly onClick?: () => void;
  readonly variant?: "primary" | "secondary";
  readonly style?: CSSProperties;
};

export function Btn({ children, onClick, variant = "secondary", style }: BtnProps) {
  const [hover, setHover] = useState(false);
  const isPrimary = variant === "primary";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: isPrimary ? C.accent : hover ? C.btnHover : C.btnBg,
        border: `1px solid ${isPrimary ? C.accent : C.btnBorder}`,
        borderRadius: 6,
        color: isPrimary ? C.bg : C.text,
        cursor: "pointer",
        fontSize: 11,
        fontWeight: 500,
        height: 28,
        padding: "0 10px",
        transition: "background 0.12s ease, border-color 0.12s ease, color 0.12s ease",
        ...style
      }}
    >
      {children}
    </button>
  );
}

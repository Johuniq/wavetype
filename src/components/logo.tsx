import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export function Logo({ size = "md", showText = true, className }: LogoProps) {
  const sizes = {
    sm: { icon: "h-5 w-5", text: "text-lg", container: "h-7 w-7" },
    md: { icon: "h-6 w-6", text: "text-xl", container: "h-9 w-9" },
    lg: { icon: "h-7 w-7", text: "text-2xl", container: "h-11 w-11" },
  };

  const s = sizes[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          s.container,
          "rounded-lg bg-primary flex items-center justify-center"
        )}
      >
        <svg
          className={cn(s.icon, "text-primary-foreground")}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      </div>
      {showText && (
        <span className={cn(s.text, "font-semibold tracking-tight")}>
          WaveType
        </span>
      )}
    </div>
  );
}

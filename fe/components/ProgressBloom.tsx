"use client";

type ProgressBloomProps = {
  progress?: number | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
};

const SIZE_CLASS = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-32 w-32",
};

function clampProgress(value?: number | null) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.min(100, Math.max(0, Math.round(Number(value))));
}

export default function ProgressBloom({
  progress = 0,
  size = "md",
  showLabel = true,
}: ProgressBloomProps) {
  const pct = clampProgress(progress);
  const stage = pct >= 90 ? 4 : pct >= 65 ? 3 : pct >= 35 ? 2 : pct >= 10 ? 1 : 0;
  const stemHeight = 22 + pct * 0.42;
  const budScale = Math.max(0, Math.min(1, (pct - 55) / 35));
  const bloomScale = Math.max(0, Math.min(1, (pct - 78) / 22));

  return (
    <div className="flex shrink-0 flex-col items-center gap-1" aria-label={`프로젝트 진행률 ${pct}%`}>
      <svg
        viewBox="0 0 120 120"
        className={SIZE_CLASS[size]}
        role="img"
        aria-hidden="true"
      >
        <ellipse cx="60" cy="104" rx="30" ry="6" fill="#92400e" opacity="0.14" />

        <path
          d={`M60 100 C58 ${100 - stemHeight * 0.35}, 62 ${100 - stemHeight * 0.7}, 60 ${100 - stemHeight}`}
          fill="none"
          stroke="#15803d"
          strokeWidth="5"
          strokeLinecap="round"
          style={{ transition: "d 500ms ease" }}
        />

        {stage >= 1 && (
          <g className="origin-center transition-all duration-500">
            <path
              d="M58 82 C40 80, 31 69, 30 56 C46 57, 56 66, 61 81"
              fill="#22c55e"
              opacity={stage >= 1 ? 1 : 0}
            />
            <path
              d="M62 73 C78 70, 89 59, 91 46 C75 46, 64 56, 59 72"
              fill="#16a34a"
              opacity={stage >= 2 ? 1 : 0.35}
            />
          </g>
        )}

        {stage >= 2 && (
          <g style={{ transformOrigin: "60px 52px", transform: `scale(${0.75 + budScale * 0.25})` }}>
            <circle cx="60" cy="49" r="10" fill="#fb7185" opacity={0.45 + budScale * 0.35} />
            <path d="M51 51 C55 39, 64 38, 69 51 C64 47, 56 47, 51 51Z" fill="#f43f5e" />
          </g>
        )}

        {stage >= 3 && (
          <g style={{ transformOrigin: "60px 48px", transform: `scale(${0.72 + bloomScale * 0.42})` }}>
            <path d="M60 32 C72 36, 79 47, 74 59 C67 55, 61 47, 60 32Z" fill="#e11d48" />
            <path d="M60 32 C48 36, 41 47, 46 59 C53 55, 59 47, 60 32Z" fill="#be123c" />
            <path d="M46 48 C54 42, 66 42, 74 48 C72 62, 48 62, 46 48Z" fill="#fb7185" />
            <path d="M53 47 C57 40, 63 40, 67 47 C64 54, 56 54, 53 47Z" fill="#fecdd3" />
          </g>
        )}

        {pct >= 100 && (
          <g className="animate-pulse">
            <circle cx="34" cy="30" r="2" fill="#facc15" />
            <circle cx="86" cy="26" r="2" fill="#facc15" />
            <circle cx="83" cy="70" r="1.8" fill="#fb7185" />
          </g>
        )}
      </svg>

      {showLabel && (
        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600">
          {pct}%
        </span>
      )}
    </div>
  );
}

// Logo TCCheese. El símbolo es la imagen provista por la marca (raster PNG en /public).
// Si el archivo aún no está en su sitio, cae al símbolo SVG para no romper el header.
import { useState } from "react";

const LOGO_SRC = "/tccheese-logo.png";

export function Logo() {
  const [imgOk, setImgOk] = useState(true);
  return (
    <span className="flex items-center gap-2">
      {imgOk ? (
        <img
          src={LOGO_SRC}
          alt="TCCheese"
          width={32}
          height={32}
          onError={() => setImgOk(false)}
          className="h-8 w-8 rounded-md object-contain"
        />
      ) : (
        <TCCheeseMark size={30} compact />
      )}
      <Wordmark className="text-lg" />
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`font-sans font-semibold tracking-tight text-strong ${className ?? ""}`}>
      TC<span className="text-brand">Cheese</span>
    </span>
  );
}

// Símbolo SVG de respaldo (cartas + velas + flecha + cuña de queso). Solo se muestra si falta el PNG.
type MarkProps = { size?: number; compact?: boolean; className?: string };

export function TCCheeseMark({ size = 32, compact = false, className }: MarkProps) {
  const ink = "#14151b";
  const light = "#f4f4f5";
  const cheddar = "#e29a24";
  const cheddarWarm = "#e6a02f";
  const arrow = "#f2b64a";
  const uid = compact ? "cmk" : "fmk";

  if (compact) {
    return (
      <svg width={size} height={size} viewBox="0 0 120 120" className={className} role="img" aria-label="TCCheese">
        <rect x="46" y="18" width="52" height="84" rx="9" fill={ink} stroke={light} strokeWidth="4" />
        <path d="M50 98 L98 98 L98 66 Z" fill={cheddar} />
        <path d="M50 92 L66 76 L74 82 L94 58" fill="none" stroke={arrow} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M99 49 L86 55 L96 65 Z" fill={arrow} />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} role="img" aria-label="TCCheese">
      <defs>
        <clipPath id={uid}>
          <rect x="46" y="18" width="52" height="84" rx="9" />
        </clipPath>
      </defs>
      <rect x="16" y="30" width="46" height="78" rx="10" fill={ink} stroke={light} strokeWidth="2" transform="rotate(-22 39 69)" />
      <rect x="28" y="24" width="48" height="82" rx="10" fill={cheddarWarm} transform="rotate(-12 52 65)" />
      <rect x="46" y="18" width="52" height="84" rx="9" fill={ink} stroke={light} strokeWidth="3.5" />
      <path d="M50 98 L98 98 L98 66 Z" fill={cheddar} clipPath={`url(#${uid})`} />
      <path d="M50 92 L66 76 L74 82 L94 58" fill="none" stroke={arrow} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M99 49 L86 55 L96 65 Z" fill={arrow} />
    </svg>
  );
}

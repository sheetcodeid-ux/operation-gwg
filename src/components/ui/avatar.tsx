import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

const GRADIENTS = [
  "from-brand-500 to-cyan-500",
  "from-cyan-500 to-emerald-500",
  "from-amber-500 to-brand-500",
  "from-pink-500 to-brand-500",
  "from-emerald-500 to-cyan-500",
];

function hashIndex(seed: string, mod: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

export function Avatar({
  name,
  size = 32,
  className,
  src,
}: {
  name: string;
  size?: number;
  className?: string;
  src?: string | null;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={cn("shrink-0 rounded-full object-cover ring-1 ring-border", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  const gradient = GRADIENTS[hashIndex(name, GRADIENTS.length)];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ring-1 ring-border",
        gradient,
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

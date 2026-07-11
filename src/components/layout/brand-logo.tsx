import { cn } from "@/lib/utils";

/**
 * GWG brand mark (public/gwg.svg).
 *
 * Recolors per theme via a CSS mask so we keep a single asset:
 *  - Light: navy box (logo's original colour #0e186c) + white mark.
 *  - Dark:  white box + navy mark (the original colour).
 */
export function BrandLogo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <div className={cn("grid size-8 shrink-0 place-items-center rounded-lg bg-[#0e186c] dark:bg-white", className)}>
      <span
        aria-hidden
        className={cn("size-5 bg-white dark:bg-[#0e186c]", markClassName)}
        style={{
          WebkitMaskImage: "url(/gwg.svg)",
          maskImage: "url(/gwg.svg)",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
    </div>
  );
}

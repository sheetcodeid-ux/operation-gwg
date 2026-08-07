"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { LANGS } from "@/lib/i18n/dict";
import { useI18n } from "@/lib/i18n/provider";
import { Popover } from "@/components/ui/popover";
import { Flag } from "./flag";
import { cn } from "@/lib/utils";

export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  const router = useRouter();

  return (
    <Popover
      contentClassName="w-36"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2 text-sm text-foreground transition-colors hover:bg-muted sm:px-2.5"
        >
          <Flag code={lang} />
          {/* Kode bahasa disembunyikan di ponsel: benderanya sudah cukup, dan
              lebarnya dibutuhkan tombol lain di topbar. */}
          <span className="hidden font-medium sm:inline">{lang.toUpperCase()}</span>
          <ChevronDown
            className={cn("size-3.5 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
          />
        </button>
      )}
    >
      {(close) =>
        LANGS.map((l) => (
          <button
            key={l.value}
            onClick={() => {
              setLang(l.value);
              close();
              // Re-render server components (page titles/stats) with the new language.
              router.refresh();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm",
              lang === l.value ? "bg-accent text-accent-foreground" : "text-foreground/90 hover:bg-muted",
            )}
          >
            <Flag code={l.value} />
            {l.value === "en" ? "English" : "Indonesia"}
          </button>
        ))
      }
    </Popover>
  );
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";
import { MultiCombobox, type MultiOption } from "@/components/ui/multi-combobox";
import { DateRangePicker } from "./date-range-picker";

export function GlobalFilterBar({ scopeOptions }: { scopeOptions: MultiOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const selected = (params.get("scope") ?? "").split(",").filter(Boolean);

  function setScope(tokens: string[]) {
    const next = new URLSearchParams(params.toString());
    if (tokens.length) next.set("scope", tokens.join(","));
    else next.delete("scope");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    // One row that shrinks: the scope picker compresses while the label and
    // date-range trigger keep their size.
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card/60 p-2.5">
      <span className="flex shrink-0 items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
        <Filter className="size-3.5" /> Filter
      </span>
      <div className="min-w-0 max-w-sm flex-1">
        <MultiCombobox
          options={scopeOptions}
          value={selected}
          onChange={setScope}
          placeholder="All wilayah & coordinators"
          searchPlaceholder="Search wilayah or coordinator…"
          allLabel="all"
        />
      </div>
      <div className="ml-auto shrink-0">
        <DateRangePicker />
      </div>
    </div>
  );
}

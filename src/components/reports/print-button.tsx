"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Print / PDF", className }: { label?: string; className?: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={className ?? "no-print"}
      onClick={() => window.print()}
    >
      <Printer /> {label}
    </Button>
  );
}

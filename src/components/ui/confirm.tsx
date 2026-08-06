"use client";

import * as React from "react";
import { Dialog, DialogContent } from "./dialog";
import { Button } from "./button";
import { Field, Input } from "./input";

/**
 * Pengganti `window.confirm` / `window.prompt`.
 *
 * Dialog bawaan browser memblokir main thread (halaman benar-benar berhenti
 * sampai user menjawab), tampil di luar tema aplikasi, dan tidak bisa diberi
 * konteks. Hook ini memberi API yang sama enaknya — `await ask(...)` — tapi
 * dirender memakai komponen Dialog milik web ini.
 *
 *   const { confirm, dialog } = useConfirm();
 *   ...
 *   if (!(await confirm({ title: "Hapus bahan?" }))) return;
 *   return <>{dialog}</>;
 */
export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  /** Isi untuk meminta teks (pengganti window.prompt). */
  prompt?: {
    label: string;
    placeholder?: string;
    defaultValue?: string;
    required?: boolean;
  };
}

type Pending = ConfirmOptions & {
  resolve: (v: string | boolean | null) => void;
};

export function useConfirm() {
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [text, setText] = React.useState("");

  const open = React.useCallback((opts: ConfirmOptions) => {
    setText(opts.prompt?.defaultValue ?? "");
    return new Promise<string | boolean | null>((resolve) =>
      setPending({ ...opts, resolve }),
    );
  }, []);

  /** true bila user menekan tombol konfirmasi, false bila membatalkan. */
  const confirm = React.useCallback(
    async (opts: ConfirmOptions) => (await open(opts)) !== null,
    [open],
  );

  const close = (value: string | boolean | null) => {
    pending?.resolve(value);
    setPending(null);
  };

  const canSubmit = !pending?.prompt?.required || text.trim().length > 0;

  const dialog = (
    <Dialog open={pending !== null} onOpenChange={(v) => !v && close(null)}>
      <DialogContent
        align="center"
        title={pending?.title ?? ""}
        description={pending?.description}
        className="max-w-sm"
      >
        {/* DialogContent merender children tanpa padding — beri di sini. */}
        <div className="p-5">
          {pending?.prompt && (
            <Field label={pending.prompt.label}>
              <Input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={pending.prompt.placeholder}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSubmit) close(text);
                }}
              />
            </Field>
          )}
          <div
            className={
              pending?.prompt
                ? "mt-5 flex justify-end gap-2"
                : "flex justify-end gap-2"
            }
          >
            <Button variant="outline" onClick={() => close(null)}>
              {pending?.cancelLabel ?? "Batal"}
            </Button>
            <Button
              variant={pending?.tone === "danger" ? "destructive" : "default"}
              disabled={!canSubmit}
              onClick={() => close(pending?.prompt ? text : true)}
            >
              {pending?.confirmLabel ?? "Lanjut"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return { open, confirm, dialog };
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { COMPLAINT_CATEGORY_META, COMPLAINT_SOURCE_META, PRIORITY_META } from "@/lib/constants";
import type { ComplaintCategory, ComplaintSource, Priority } from "@/lib/types";
import { createComplaintAction } from "@/lib/actions/complaints";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, useDialogControl } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

const SOURCES = Object.keys(COMPLAINT_SOURCE_META) as ComplaintSource[];
const CATEGORIES = Object.keys(COMPLAINT_CATEGORY_META) as ComplaintCategory[];
const PRIORITIES = Object.keys(PRIORITY_META) as Priority[];

export function NewComplaintButton({ outlets }: { outlets: { id: string; name: string }[] }) {
  return (
    <Dialog>
      <DialogTrigger>
        <Button size="sm">
          <Plus /> Log Complaint
        </Button>
      </DialogTrigger>
      <DialogContent title="Log Complaint" description="Capture a customer complaint from any channel." className="max-w-xl">
        <ComplaintForm outlets={outlets} />
      </DialogContent>
    </Dialog>
  );
}

function ComplaintForm({ outlets }: { outlets: { id: string; name: string }[] }) {
  const router = useRouter();
  const { setOpen } = useDialogControl();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    source: "google_review" as ComplaintSource,
    customerName: "",
    rating: 3,
    content: "",
    outletId: outlets[0]?.id ?? "",
    category: "service" as ComplaintCategory,
    priority: "medium" as Priority,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    if (!form.content.trim()) return void toast.error("Complaint content is required.");
    startTransition(async () => {
      const res = await createComplaintAction({
        source: form.source,
        customerName: form.customerName,
        rating: form.source === "google_review" ? Number(form.rating) : null,
        content: form.content,
        outletId: form.outletId,
        category: form.category,
        priority: form.priority,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Complaint logged");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Source">
          <Select value={form.source} onChange={(e) => set("source", e.target.value as ComplaintSource)}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {COMPLAINT_SOURCE_META[s].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Customer Name">
          <Input value={form.customerName} onChange={(e) => set("customerName", e.target.value)} placeholder="Anonymous" />
        </Field>
        {form.source === "google_review" && (
          <Field label={`Rating · ${form.rating}★`}>
            <input
              type="range"
              min={1}
              max={5}
              value={form.rating}
              onChange={(e) => set("rating", Number(e.target.value) as never)}
              className="w-full accent-amber-500"
            />
          </Field>
        )}
        <Field label="Outlet">
          <Select value={form.outletId} onChange={(e) => set("outletId", e.target.value)}>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => set("category", e.target.value as ComplaintCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {COMPLAINT_CATEGORY_META[c].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={form.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_META[p].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Complaint Content">
        <Textarea value={form.content} onChange={(e) => set("content", e.target.value)} placeholder="What did the customer report?" />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Log Complaint
        </Button>
      </div>
    </div>
  );
}

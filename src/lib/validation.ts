import { z } from "zod";

/**
 * Zod schemas for server-action inputs. Server actions are a public HTTP
 * surface — the typed argument is only a compile-time hint, so every mutation
 * validates its payload here before touching the data layer.
 */

export const roleSchema = z.enum([
  "super_admin",
  "head_operation",
  "area_coordinator",
  "data_operation",
  "pos_operation",
  "admin_operation",
  "supervisor",
  "head_bar_rnd",
  "bar_rnd",
  "kitchen_rnd",
  "coordinator_rnd",
  "legal",
  "member",
]);

export const prioritySchema = z.enum(["critical", "high", "medium", "low"]);
export const taskStatusSchema = z.enum(["open", "ongoing", "pending", "done", "cancelled"]);
export const eventStatusSchema = z.enum(["upcoming", "running", "finished", "cancelled"]);
export const eventMilestoneSchema = z.enum(["planning", "preparation", "execution", "evaluation"]);
export const hygieneRatingSchema = z.enum(["excellent", "good", "fair", "poor"]);
export const complaintSourceSchema = z.enum(["google_review", "customer_service", "grup_kuning", "instagram", "tiktok"]);
export const complaintCategorySchema = z.enum([
  "service",
  "food_quality",
  "cleanliness",
  "staff_characteristics",
  "price",
  "payment_system",
  "ambiance",
  "order_error",
]);
export const complaintStatusSchema = z.enum(["open", "in_progress", "close"]);
export const rootCauseSchema = z.enum(["man", "method", "material", "machine", "environment"]);

const id = z.string().trim().min(1).max(64);
const shortText = z.string().trim().max(200);
const longText = z.string().trim().max(5000);
const isoDate = z.string().trim().max(40);

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.string().trim().email("Enter a valid email.").max(200),
  role: roleSchema,
  password: z.string().min(6, "Password must be at least 6 characters.").max(200),
  outletIds: z.array(id).max(200).default([]),
});

export const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Task title is required.").max(200),
  description: longText.default(""),
  category: shortText.default(""),
  priority: prioritySchema,
  status: taskStatusSchema,
  // Department/division name (Finance, Creative, …), not a role enum.
  division: z.string().trim().min(1, "Divisi wajib dipilih.").max(120),
  outletId: id.nullable(),
  picIds: z.array(id).max(50).default([]),
  startDate: isoDate.default(""),
  dueDate: isoDate.default(""),
  progress: z.number().int().min(0).max(100),
});

export const complaintInputSchema = z.object({
  source: complaintSourceSchema,
  customerName: z.string().trim().max(120).default(""),
  rating: z.number().int().min(1).max(5).nullish(),
  content: z.string().trim().min(1, "Complaint content is required.").max(5000),
  outletId: id,
  category: complaintCategorySchema,
});

export const resolveComplaintSchema = z.object({
  id,
  status: complaintStatusSchema,
  rootCause: rootCauseSchema.optional(),
  actionDescription: z.string().trim().max(5000).optional(),
  followUpDate: isoDate.optional(),
});

export const eventInputSchema = z.object({
  name: z.string().trim().min(1, "Event name is required.").max(200),
  outletId: id,
  picId: id,
  description: longText.default(""),
  budget: z.number().min(0).max(1_000_000_000_000),
  startDate: isoDate,
  endDate: isoDate,
  milestone: eventMilestoneSchema,
  status: eventStatusSchema,
});

export const createAreaSchema = z.object({
  name: z.string().trim().min(1, "Nama wilayah wajib diisi.").max(120),
  code: z.string().trim().min(1, "Kode wilayah wajib diisi.").max(20),
  coordinatorId: z.string().trim().max(64).default(""),
});

export const createOutletSchema = z.object({
  name: z.string().trim().min(1, "Nama outlet wajib diisi.").max(120),
  code: z.string().trim().max(20).default(""),
  city: z.string().trim().max(120).default(""),
  areaId: id,
  picId: z.string().trim().max(64).default(""),
});

export const hygieneInputSchema = z.object({
  outletId: id,
  shift: shortText.default(""),
  inspectorName: z.string().trim().max(120).default(""),
  findings: z.array(z.string().trim().max(1000)).max(100).default([]),
  isClean: z.boolean(),
  // ratings/photos are validated structurally by the mutation layer.
});

/** Uniform result helper: returns typed data or a first friendly error message. */
export function parseInput<T>(schema: z.ZodType<T>, input: unknown): { data: T } | { error: string } {
  const res = schema.safeParse(input);
  if (res.success) return { data: res.data };
  return { error: res.error.issues[0]?.message ?? "Invalid input." };
}

/**
 * Assessment records shown in the Dashboard data-table and rendered into
 * Reports (spec §6, §7). Frontend-only sample data — when the backend lands,
 * this array is replaced by a query returning the same `AssessmentRecord` shape.
 */

export type HasilStatus = "tidak_layak" | "layak" | "ditunda" | "fast_track";
export type ProcessStatus = "Selesai" | "Menunggu Interview" | "Proses Penilaian" | "Draft";

export const HASIL_META: Record<HasilStatus, { label: string; tone: "no" | "wait" | "ok" | "fast" }> = {
  tidak_layak: { label: "Tidak Layak", tone: "no" },
  ditunda: { label: "Ditunda", tone: "wait" },
  layak: { label: "Layak", tone: "ok" },
  fast_track: { label: "Fast Track", tone: "fast" },
};

/** Options for the Dashboard "Status Hasil" filter (spec §6). */
export const HASIL_OPTIONS: { value: HasilStatus; label: string }[] = (
  Object.keys(HASIL_META) as HasilStatus[]
).map((k) => ({ value: k, label: HASIL_META[k].label }));

export interface EvaluatorBreakdown {
  name: string;
  weight: number;
  score: number;
}

export interface AssessmentRecord {
  id: string;
  tanggal: string; // ISO date
  batch: string;
  nik: string;
  name: string;
  departmentId: string;
  departmentName: string;
  jabatan: string;
  golongan: string; // current
  golonganTujuan: string;
  penilai: string;
  status: ProcessStatus;
  hasil: HasilStatus;
  finalScore: number;
  interviewResult: string;
  decision: string;
  /** Per-evaluator score cards for the PDF (Director-only positions carry one). */
  evaluators?: EvaluatorBreakdown[];
  /** Participant's account id — lets the report resolve their Atasan's TTD. */
  participantUserId?: string;
}

export const MOCK_ASSESSMENTS: AssessmentRecord[] = [
  {
    id: "asm_0001",
    tanggal: "2026-06-12",
    batch: "Batch 1",
    nik: "EMP-2019-0123",
    name: "Muhammad Lutfi Rijalul Fikri",
    departmentId: "dep_operations",
    departmentName: "Operations",
    jabatan: "Data Operation",
    golongan: "Staff",
    golonganTujuan: "Senior Staff",
    penilai: "Atasan, HC, Director",
    status: "Selesai",
    hasil: "layak",
    finalScore: 88.4,
    interviewResult: "Layak",
    decision: "Layak Naik Golongan",
  },
  {
    id: "asm_0002",
    tanggal: "2026-06-12",
    batch: "Batch 1",
    nik: "EMP-2020-0210",
    name: "Indah Puspita",
    departmentId: "dep_finance",
    departmentName: "Finance",
    jabatan: "Head Finance",
    golongan: "Manager",
    golonganTujuan: "Senior Manager",
    penilai: "Director, HR",
    status: "Selesai",
    hasil: "fast_track",
    finalScore: 96.1,
    interviewResult: "Sangat Layak",
    decision: "Fast Track — pertimbangan promosi",
  },
  {
    id: "asm_0003",
    tanggal: "2026-06-18",
    batch: "Batch 1",
    nik: "EMP-2021-0455",
    name: "Zia",
    departmentId: "dep_creative",
    departmentName: "Creative",
    jabatan: "Social Media",
    golongan: "Junior Staff",
    golonganTujuan: "Staff",
    penilai: "Atasan, HC, Director",
    status: "Selesai",
    hasil: "ditunda",
    finalScore: 79.2,
    interviewResult: "Perlu Pertimbangan Ulang",
    decision: "Ditunda — review 6 bulan",
  },
  {
    id: "asm_0004",
    tanggal: "2026-06-20",
    batch: "Batch 2",
    nik: "EMP-2022-0612",
    name: "Qintan",
    departmentId: "dep_project-manager",
    departmentName: "Project Manager",
    jabatan: "Project Manager",
    golongan: "Senior Staff",
    golonganTujuan: "Asisten Supervisor",
    penilai: "Atasan, HC, Director",
    status: "Menunggu Interview",
    hasil: "layak",
    finalScore: 87.0,
    interviewResult: "—",
    decision: "Menunggu interview akhir",
  },
  {
    id: "asm_0005",
    tanggal: "2026-06-22",
    batch: "Batch 2",
    nik: "EMP-2018-0087",
    name: "Radika",
    departmentId: "dep_food-dan-beverage",
    departmentName: "Food & Beverage",
    jabatan: "Coordinator Food & Beverage",
    golongan: "Supervisor",
    golonganTujuan: "Junior Manager",
    penilai: "Atasan, HC, Director",
    status: "Proses Penilaian",
    hasil: "tidak_layak",
    finalScore: 64.5,
    interviewResult: "—",
    decision: "Tidak Layak — program pengembangan (IDP)",
  },
  {
    id: "asm_0006",
    tanggal: "2026-06-25",
    batch: "Batch 2",
    nik: "EMP-2020-0333",
    name: "Sonny",
    departmentId: "dep_auditor",
    departmentName: "Auditor",
    jabatan: "Auditor",
    golongan: "Staff",
    golonganTujuan: "Senior Staff",
    penilai: "Atasan, HC, Director",
    status: "Selesai",
    hasil: "layak",
    finalScore: 90.3,
    interviewResult: "Layak",
    decision: "Layak Naik Golongan",
  },
  // ── earlier-period records (drive the per-employee history timeline) ──
  {
    id: "asm_h01",
    tanggal: "2025-12-15",
    batch: "Batch 1",
    nik: "EMP-2019-0123",
    name: "Muhammad Lutfi Rijalul Fikri",
    departmentId: "dep_operations",
    departmentName: "Operations",
    jabatan: "Data Operation",
    golongan: "Junior Staff",
    golonganTujuan: "Staff",
    penilai: "Atasan, HC, Director",
    status: "Selesai",
    hasil: "ditunda",
    finalScore: 77.0,
    interviewResult: "Perlu Pertimbangan Ulang",
    decision: "Ditunda — review 6 bulan",
  },
  {
    id: "asm_h02",
    tanggal: "2025-06-20",
    batch: "Batch 1",
    nik: "EMP-2019-0123",
    name: "Muhammad Lutfi Rijalul Fikri",
    departmentId: "dep_operations",
    departmentName: "Operations",
    jabatan: "Data Operation",
    golongan: "Junior Staff",
    golonganTujuan: "Staff",
    penilai: "Atasan, HC, Director",
    status: "Selesai",
    hasil: "ditunda",
    finalScore: 71.5,
    interviewResult: "Perlu Pertimbangan Ulang",
    decision: "Ditunda",
  },
  {
    id: "asm_h03",
    tanggal: "2025-12-05",
    batch: "Batch 1",
    nik: "EMP-2020-0210",
    name: "Indah Puspita",
    departmentId: "dep_finance",
    departmentName: "Finance",
    jabatan: "Head Finance",
    golongan: "Manager",
    golonganTujuan: "Senior Manager",
    penilai: "Director, HR",
    status: "Selesai",
    hasil: "layak",
    finalScore: 89.0,
    interviewResult: "Layak",
    decision: "Layak Naik Golongan",
  },
  {
    id: "asm_0007",
    tanggal: "2026-06-28",
    batch: "Batch 2",
    nik: "EMP-2017-0041",
    name: "Muhammad Andi Wahyudi",
    departmentId: "dep_operations",
    departmentName: "Operations",
    jabatan: "Head Operation",
    golongan: "Senior Manager",
    golonganTujuan: "Chief",
    penilai: "Director, HR",
    status: "Selesai",
    hasil: "layak",
    finalScore: 92.7,
    interviewResult: "Layak",
    decision: "Layak Naik Golongan",
  },
];

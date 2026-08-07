/**
 * Bentuk data Pesan yang dipakai server MAUPUN browser.
 *
 * Sengaja dipisah dari modul server supaya komponen klien bisa mengimpor
 * tipenya tanpa ikut menarik klien database ke dalam bundle.
 */

export interface ChatAttachment {
  path: string;
  name: string;
  /**
   * Tipe MIME saat diunggah.
   *
   * Disimpan ikut lampiran karena nama berkas tidak selalu berekstensi — foto
   * dari kamera ponsel sering datang tanpa ".jpg" — dan tanpa ini foto akan
   * tampil sebagai kartu berkas, bukan gambar.
   */
  type?: string;
  /** URL bertanda tangan, diisi server saat percakapan dibaca. */
  url?: string;
}

/** Apakah lampiran ini gambar — dari tipe MIME, atau ekstensi sebagai cadangan. */
export function isImageAttachment(a: { name: string; type?: string }): boolean {
  if (a.type) return a.type.startsWith("image/");
  return /\.(png|jpe?g|gif|webp|avif|heic|heif|bmp)$/i.test(a.name);
}

/** Rujukan ke catatan lain di aplikasi yang sedang dibahas di obrolan. */
export interface ChatRef {
  kind: "pengajuan" | "hygiene";
  id: string;
  title: string;
  /** Label jenis ("Pengajuan Design", "Temuan Hygiene", …). */
  kindLabel: string;
  statusLabel: string;
  requesterName: string;
  href: string;
  /** Rujukan yang catatannya sudah dihapus tetap ditampilkan, tapi mati. */
  missing?: boolean;
  /** Temuan hygiene: foto bagian yang kotor + apakah masih menggantung. */
  photoUrl?: string;
  pending?: boolean;
}

/** Satu temuan hygiene yang dikirim untuk ditindaklanjuti. */
export interface HygieneFollowup {
  id: string;
  hygieneId: string;
  outletName: string;
  area: string;
  note: string;
  photoUrl?: string;
  raisedByName: string;
  assignedToName: string;
  assignedTo: string;
  status: "menunggu" | "selesai";
  resolution: string;
  proof: ChatAttachment[];
  resolvedAt: string | null;
  createdAt: string;
  threadId: string | null;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  body: string;
  attachments: ChatAttachment[];
  ref: ChatRef | null;
  createdAt: string;
}

export interface ChatPerson {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  department: string;
  jabatan: string | null;
  avatarUrl: string | null;
  email: string;
  phone: string | null;
}

export interface ChatThread {
  id: string;
  kind: "dm" | "group";
  /** Judul yang tampil: nama lawan bicara untuk japri, judul grup untuk grup. */
  title: string;
  subtitle: string;
  /** Peserta selain diri sendiri. */
  others: ChatPerson[];
  lastMessageText: string;
  lastMessageAt: string;
  lastSenderIsMe: boolean;
  unread: number;
  favorite: boolean;
  archived: boolean;
}

/** Waktu relatif singkat ala aplikasi pesan ("2h", "kemarin", "3 Agu"). */
export function shortTime(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const mins = Math.floor((now - t) / 60_000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}j`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "kemarin";
  if (days < 7) return `${days}h`;
  return new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

/** Pemisah tanggal di dalam percakapan ("Hari ini", "Kemarin", tanggal penuh). */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, now)) return "Hari ini";
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (same(d, yest)) return "Kemarin";
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** Jam pesan (HH.MM) — dipakai di gelembung chat. */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "";
}

/** Ringkasan satu pesan untuk daftar percakapan. */
export function previewOf(m: { body: string; attachments: unknown[]; ref: unknown }): string {
  if (m.body.trim()) return m.body.trim();
  if (m.ref) return "Meneruskan sebuah pengajuan";
  if (m.attachments.length > 0) return `${m.attachments.length} lampiran`;
  return "";
}

/** Satu pengajuan yang siap dipilih untuk diteruskan ke obrolan. */
export interface PickableRequest {
  id: string;
  title: string;
  kindLabel: string;
  statusLabel: string;
  requesterName: string;
  createdAt: string;
}

/** Detail pengajuan yang dibuka dari dalam obrolan. */
export interface RequestDetail {
  id: string;
  kindLabel: string;
  title: string;
  description: string;
  statusLabel: string;
  requesterName: string;
  department: string;
  assigneeName: string | null;
  designType: string | null;
  designSize: string | null;
  plannedDate: string | null;
  position: string | null;
  headcount: number;
  trainingType: string | null;
  participants: number;
  budget: number;
  createdAt: string;
  revisions: { at: string; byName: string; note: string }[];
  attachments: { name: string; url?: string }[];
  href: string;
}

"use client";

import * as React from "react";
import { AlertCircle, Building2, CheckCircle2, ChevronDown, ListFilter, Loader2, PenLine, Search, ShieldCheck, UserCog, Users, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  saveRosterEntryAction,
  removeRosterEntryAction,
  saveAssignmentAction,
  saveSignatureAction,
} from "@/lib/actions/assessment-settings";
import type { RosterRole } from "@/lib/data/assessment-roster";

export type AccountOption = { id: string; name: string; email: string; department: string | null; jabatan: string | null };
export type DeptOption = { value: string; label: string };
type RosterMap = Record<string, { role: RosterRole; scopeDepartmentId: string; alsoHead?: boolean; alsoHeadScope?: string }>;
type AssignMap = Record<string, { atasanUserId: string | null; peerUserIds: string[] }>;
type SigMap = Record<string, { name: string; image: string | null }>;

type RoleChoice = RosterRole | "none";
const ROLE_OPTS: { value: RoleChoice; label: string }[] = [
  { value: "none", label: "Belum terdaftar" },
  { value: "karyawan", label: "Karyawan (Peserta)" },
  { value: "head", label: "Atasan / Head Divisi" },
  { value: "hc", label: "Human Capital" },
  { value: "director", label: "Director" },
];
const ROLE_BADGE: Record<RoleChoice, string> = {
  none: "bg-muted text-muted-foreground ring-border",
  karyawan: "bg-sky-500/12 text-sky-600 ring-sky-500/25 dark:text-sky-400",
  head: "bg-amber-500/12 text-amber-600 ring-amber-500/25 dark:text-amber-400",
  hc: "bg-brand-500/12 text-brand-700 ring-brand-500/25 dark:text-brand-400",
  director: "bg-violet-500/12 text-violet-600 ring-violet-500/25 dark:text-violet-400",
};
const ROLE_SHORT: Record<RoleChoice, string> = { none: "—", karyawan: "Karyawan", head: "Atasan", hc: "HC", director: "Director" };
const ROLE_DOT: Record<RoleChoice, string> = { none: "bg-muted-foreground/40", karyawan: "bg-sky-500", head: "bg-amber-500", hc: "bg-brand-500", director: "bg-violet-500" };
const NO_DEPT = "Tanpa Divisi";

type Filter = "all" | "karyawan" | "head" | "pengurus" | "none";
const FILTER_OPTS: { value: Filter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "karyawan", label: "Peserta" },
  { value: "head", label: "Atasan" },
  { value: "pengurus", label: "HC/Director" },
  { value: "none", label: "Belum terdaftar" },
];

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

export function AssessmentSettings({
  accounts,
  departments,
  initialRoster,
  initialAssignments,
  initialSignatures = {},
}: {
  accounts: AccountOption[];
  departments: DeptOption[];
  initialRoster: RosterMap;
  initialAssignments: AssignMap;
  initialSignatures?: SigMap;
}) {
  const [roster, setRoster] = React.useState<RosterMap>(initialRoster);
  const [assign, setAssign] = React.useState<AssignMap>(initialAssignments);
  const [sigs, setSigs] = React.useState<SigMap>(initialSignatures);
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [openDept, setOpenDept] = React.useState<string | null>(null);

  const roleOf = React.useCallback((id: string): RoleChoice => roster[id]?.role ?? "none", [roster]);
  // A Karyawan is "ready" when both an Atasan and ≥1 Rekan Sejawat are assigned.
  // A Head needs no atasan (Director + HC assess them) — peers are optional.
  const isReady = React.useCallback(
    (id: string): boolean | null => {
      const role = roster[id]?.role;
      if (role === "karyawan") { const cur = assign[id]; return !!cur?.atasanUserId && (cur?.peerUserIds.length ?? 0) > 0; }
      if (role === "head" || role === "hc" || role === "director") return true;
      return null; // not registered / n/a
    },
    [roster, assign],
  );
  const matchesFilter = React.useCallback(
    (id: string) => {
      const r = roleOf(id);
      if (filter === "all") return true;
      if (filter === "pengurus") return r === "hc" || r === "director";
      return r === filter;
    },
    [filter, roleOf],
  );
  const nameById = React.useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a.name])), [accounts]);
  // Selectable Atasan (P1): accounts registered as Head, PLUS HC/Director who
  // merangkap Head — they fill the Atasan column too (mis. MT Adrianto).
  const headOptions = React.useMemo(
    () =>
      accounts
        .filter((a) => roster[a.id]?.role === "head" || roster[a.id]?.alsoHead)
        .map((a) => ({
          value: a.id,
          label: a.name,
          hint: roster[a.id]?.alsoHead ? `${a.department ?? "—"} · rangkap Head` : a.department ?? undefined,
        })),
    [accounts, roster],
  );

  const isHeadAcc = React.useCallback(
    (a: AccountOption) => roleOf(a.id) === "head" || (a.jabatan ?? "").toLowerCase().startsWith("head") || (a.jabatan ?? "") === "Director",
    [roleOf],
  );

  // Group accounts by division; within a division Heads sort first, then by name.
  const grouped = React.useMemo(() => {
    const map = new Map<string, AccountOption[]>();
    for (const a of accounts) {
      const key = a.department?.trim() || NO_DEPT;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    for (const list of map.values()) {
      list.sort((x, y) => (isHeadAcc(y) ? 1 : 0) - (isHeadAcc(x) ? 1 : 0) || x.name.localeCompare(y.name));
    }
    return [...map.entries()].sort((a, b) => (a[0] === NO_DEPT ? 1 : b[0] === NO_DEPT ? -1 : a[0].localeCompare(b[0])));
  }, [accounts, isHeadAcc]);

  const searching = q.trim().length > 0;
  const matchQuery = React.useCallback(
    (a: AccountOption) => {
      const s = q.trim().toLowerCase();
      return a.name.toLowerCase().includes(s) || a.email.toLowerCase().includes(s) || (a.jabatan ?? "").toLowerCase().includes(s);
    },
    [q],
  );

  async function changeRole(id: string, role: RoleChoice) {
    setBusy(id);
    const prev = roster;
    if (role === "none") {
      setRoster((r) => { const n = { ...r }; delete n[id]; return n; });
      const res = await removeRosterEntryAction(id);
      if (res?.error) { setRoster(prev); toast.error(res.error); } else toast.success("Peran diperbarui");
    } else {
      const scope = role === "head" ? roster[id]?.scopeDepartmentId ?? "" : "";
      setRoster((r) => ({ ...r, [id]: { role, scopeDepartmentId: scope } }));
      const res = await saveRosterEntryAction({ userId: id, role, scopeDepartmentId: scope });
      if (res?.error) { setRoster(prev); toast.error(res.error); } else toast.success("Peran diperbarui");
    }
    setBusy(null);
  }

  async function changeScope(id: string, scopeDepartmentId: string) {
    setBusy(id);
    setRoster((r) => ({ ...r, [id]: { ...r[id], role: "head", scopeDepartmentId } }));
    const res = await saveRosterEntryAction({ userId: id, role: "head", scopeDepartmentId });
    if (res?.error) toast.error(res.error); else toast.success("Divisi penilaian disimpan");
    setBusy(null);
  }

  /** HC/Director yang MERANGKAP Head sebuah divisi (mis. MT Adrian = HC + Head
   *  Human Capital) → menilai dua kolom sekaligus untuk divisi tersebut. */
  async function changeAlsoHead(id: string, alsoHead: boolean, alsoHeadScope?: string) {
    const cur = roster[id];
    if (!cur) return;
    setBusy(id);
    const next = { ...cur, alsoHead, alsoHeadScope: alsoHead ? alsoHeadScope ?? cur.alsoHeadScope ?? "" : "" };
    setRoster((r) => ({ ...r, [id]: next }));
    const res = await saveRosterEntryAction({
      userId: id,
      role: cur.role,
      scopeDepartmentId: cur.scopeDepartmentId,
      alsoHead: next.alsoHead,
      alsoHeadScope: next.alsoHeadScope,
    });
    if (res?.error) toast.error(res.error); else toast.success(alsoHead ? "Merangkap Head disimpan" : "Rangkap Head dimatikan");
    setBusy(null);
  }

  async function persistAssign(participantId: string, next: { atasanUserId: string | null; peerUserIds: string[] }) {
    setAssign((a) => ({ ...a, [participantId]: next }));
    const res = await saveAssignmentAction({ participantUserId: participantId, ...next });
    if (res?.error) toast.error(res.error); else toast.success("Penugasan penilai disimpan");
  }
  function setAtasan(participantId: string, atasanUserId: string | null) {
    const cur = assign[participantId] ?? { atasanUserId: null, peerUserIds: [] };
    void persistAssign(participantId, { ...cur, atasanUserId });
  }
  function addPeer(participantId: string, peerId: string) {
    const cur = assign[participantId] ?? { atasanUserId: null, peerUserIds: [] };
    if (cur.peerUserIds.includes(peerId) || cur.peerUserIds.length >= 5) return;
    void persistAssign(participantId, { ...cur, peerUserIds: [...cur.peerUserIds, peerId] });
  }
  function removePeer(participantId: string, peerId: string) {
    const cur = assign[participantId] ?? { atasanUserId: null, peerUserIds: [] };
    void persistAssign(participantId, { ...cur, peerUserIds: cur.peerUserIds.filter((p) => p !== peerId) });
  }

  async function persistSig(userId: string, name: string, image: string | null) {
    setSigs((s) => ({ ...s, [userId]: { name, image } }));
    const res = await saveSignatureAction({ userId, name, image });
    if (res?.error) toast.error(res.error); else toast.success("TTD disimpan");
  }
  function onSigFile(userId: string, name: string, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { void persistSig(userId, name, typeof reader.result === "string" ? reader.result : null); };
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  const registeredCount = accounts.filter((a) => roleOf(a.id) !== "none").length;
  const karyawanCount = accounts.filter((a) => roleOf(a.id) === "karyawan").length;
  const readyKaryawan = accounts.filter((a) => roleOf(a.id) === "karyawan" && isReady(a.id) === true).length;

  function renderAccount(a: AccountOption) {
    const role = roleOf(a.id);
    const cur = assign[a.id] ?? { atasanUserId: null, peerUserIds: [] };
    const peerOptions = accounts.filter((x) => x.id !== a.id && !cur.peerUserIds.includes(x.id)).map((x) => ({ value: x.id, label: x.name, hint: x.department ?? undefined }));
    const ready = isReady(a.id);
    return (
      <div key={a.id} className="p-3 transition-colors hover:bg-muted/15">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white", role === "none" ? "bg-muted-foreground/50" : ROLE_DOT[role])}>{initials(a.name)}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", ROLE_BADGE[role])}>{ROLE_SHORT[role]}</span>
                {ready === true && <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-brand-600 dark:text-brand-400"><CheckCircle2 className="size-3" /> Siap</span>}
                {ready === false && <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"><AlertCircle className="size-3" /> Perlu diatur</span>}
                {busy === a.id && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
              </div>
              <p className="truncate text-[11px] text-muted-foreground">{a.jabatan || a.email}</p>
            </div>
          </div>
          <div className="w-full sm:w-52">
            <Combobox portal matchTriggerWidth searchable={false} value={role} onChange={(v) => changeRole(a.id, v as RoleChoice)} options={ROLE_OPTS.map((r) => ({ value: r.value, label: r.label }))} />
          </div>
        </div>

        {/* Head → division they assess. As a participant they're scored by
            Director + HC, and may ALSO get their own Rekan Sejawat panel. */}
        {role === "head" && (
          <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-28 shrink-0 text-[11px] font-medium text-muted-foreground">Menilai divisi</span>
              <div className="w-full sm:w-64">
                <Combobox portal matchTriggerWidth value={roster[a.id]?.scopeDepartmentId ?? ""} onChange={(v) => changeScope(a.id, v)} options={[{ value: "", label: "Divisinya sendiri (default)" }, ...departments]} searchPlaceholder="Cari divisi…" placeholder="Pilih divisi…" />
              </div>
            </div>
            <p className="rounded-lg bg-violet-500/10 px-2.5 py-1.5 text-[11px] text-violet-700 dark:text-violet-300">
              Sebagai peserta, Head dinilai oleh <strong>Director (60%)</strong> &amp; <strong>HC (40%)</strong>. Rekan sejawat di bawah bersifat opsional — masukannya tampil sebagai data pendukung.
            </p>
          </div>
        )}

        {/* HC / Director yang merangkap Head sebuah divisi (mis. MT Adrian). */}
        {(role === "hc" || role === "director") && (
          <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
            <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-foreground">
              <input
                type="checkbox"
                checked={!!roster[a.id]?.alsoHead}
                onChange={(e) => changeAlsoHead(a.id, e.target.checked)}
                className="size-3.5 accent-brand-500"
              />
              Merangkap sebagai Head divisi (menilai 2 kolom sekaligus)
            </label>
            {roster[a.id]?.alsoHead && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-28 shrink-0 text-[11px] font-medium text-muted-foreground">Head divisi</span>
                <div className="w-full sm:w-64">
                  <Combobox portal matchTriggerWidth value={roster[a.id]?.alsoHeadScope ?? ""} onChange={(v) => changeAlsoHead(a.id, true, v)} options={[{ value: "", label: "Divisinya sendiri (default)" }, ...departments]} searchPlaceholder="Cari divisi…" placeholder="Pilih divisi…" />
                </div>
                <span className="text-[10px] text-muted-foreground">Untuk divisi ini ia mengisi kolom Atasan (P1) <em>dan</em> {role === "hc" ? "HC (P2)" : "Director"}.</span>
              </div>
            )}
          </div>
        )}

        {/* Participant panel — Karyawan gets Atasan (P1) + peers; a Head is scored
            by Director/HC so only the optional Rekan Sejawat panel applies. */}
        {(role === "karyawan" || role === "head") && (
          <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
            {role === "karyawan" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-28 shrink-0 text-[11px] font-medium text-muted-foreground">Atasan (P1)</span>
                <div className="w-full sm:w-64">
                  <Combobox portal matchTriggerWidth value={cur.atasanUserId ?? ""} onChange={(v) => setAtasan(a.id, v || null)} options={[{ value: "", label: "— pilih atasan —" }, ...headOptions]} searchPlaceholder="Cari atasan…" placeholder="Pilih atasan…" />
                </div>
                {headOptions.length === 0 && <span className="text-[10px] text-amber-600 dark:text-amber-400">Tandai dulu akun sebagai Atasan/Head.</span>}
              </div>
            )}
            <div className="flex flex-wrap items-start gap-2">
              <span className="w-28 shrink-0 pt-1.5 text-[11px] font-medium text-muted-foreground">Rekan Sejawat{role === "head" ? " (opsional)" : " (P3)"}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1.5">
                  {cur.peerUserIds.map((pid) => (
                    <span key={pid} className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-500/25 dark:text-amber-300">
                      {nameById[pid] ?? pid}
                      <button type="button" onClick={() => removePeer(a.id, pid)} className="text-amber-700/70 hover:text-amber-800 dark:text-amber-300/70"><X className="size-3" /></button>
                    </span>
                  ))}
                </div>
                {cur.peerUserIds.length < 5 ? (
                  <div className="mt-1.5 w-full sm:w-64">
                    <Combobox portal matchTriggerWidth value="" onChange={(v) => v && addPeer(a.id, v)} options={peerOptions} searchPlaceholder="Cari rekan…" placeholder={`Tambah rekan sejawat (${cur.peerUserIds.length}/5)…`} />
                  </div>
                ) : (
                  <p className="mt-1 text-[10px] text-muted-foreground">Maksimal 5 rekan sejawat.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TTD — untuk penandatangan PDF (Head, HC, Director). */}
        {(role === "head" || role === "hc" || role === "director") && (
          <div className="mt-2 border-t border-border/60 pt-2">
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Tanda Tangan (auto ke PDF)</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                defaultValue={sigs[a.id]?.name ?? a.name}
                onBlur={(e) => persistSig(a.id, e.target.value.trim() || a.name, sigs[a.id]?.image ?? null)}
                placeholder="Nama penandatangan"
                className="h-9 flex-1 sm:max-w-52"
              />
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                {sigs[a.id]?.image ? "Ganti TTD" : "Unggah TTD"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onSigFile(a.id, sigs[a.id]?.name ?? a.name, e)} />
              </label>
            </div>
            {sigs[a.id]?.image && (
              <div className="mt-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sigs[a.id]!.image!} alt="TTD" className="h-10 rounded bg-white object-contain px-1 ring-1 ring-border" />
                <button type="button" onClick={() => persistSig(a.id, sigs[a.id]?.name ?? a.name, null)} className="text-[11px] font-medium text-red-500 hover:text-red-600">Hapus TTD</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="glass flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-border p-4">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><ShieldCheck className="size-4 text-muted-foreground" /> Ringkasan</span>
        <Stat label="Total akun" value={accounts.length} />
        <Stat label="Terdaftar" value={registeredCount} />
        <Stat label="Peserta" value={karyawanCount} />
        <Stat label="Peserta siap" value={readyKaryawan} tone={karyawanCount > 0 && readyKaryawan === karyawanCount ? "good" : readyKaryawan > 0 ? "warn" : undefined} />
        <Stat label="Atasan/Head" value={accounts.filter((a) => roleOf(a.id) === "head").length} />
        <Stat label="HC/Director" value={accounts.filter((a) => roleOf(a.id) === "hc" || roleOf(a.id) === "director").length} />
      </div>

      <div className="glass rounded-2xl border border-border p-4 sm:p-5">
        <div className="mb-1 flex items-center gap-2">
          <UserCog className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Peran Akun per Divisi</p>
        </div>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Data akun dari User Management, dikelompokkan per divisi (Head di atas). Klik divisi untuk membuka — membuka satu divisi menutup yang lain. Peran menentukan tampilan yang dilihat akun; <span className="font-medium">Belum terdaftar</span> = tidak bisa membuka Assessment.
        </p>
        <div className="relative mb-2.5">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, email, jabatan…" className="pl-9" />
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <ListFilter className="size-3.5 text-muted-foreground" />
          {FILTER_OPTS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors",
                filter === f.value ? "bg-foreground text-background ring-transparent" : "bg-muted/40 text-muted-foreground ring-border hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {grouped.map(([dept, list]) => {
            const expand = searching || filter !== "all";
            const matches = (searching ? list.filter(matchQuery) : list).filter((a) => matchesFilter(a.id));
            if (matches.length === 0) return null;
            const open = expand || openDept === dept;
            const registered = list.filter((a) => roleOf(a.id) !== "none").length;
            const karyawan = list.filter((a) => roleOf(a.id) === "karyawan");
            const readyN = karyawan.filter((a) => isReady(a.id) === true).length;
            return (
              <div key={dept} className="overflow-hidden rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => !expand && setOpenDept(open && openDept === dept ? null : dept)}
                  className="flex w-full items-center justify-between gap-2 bg-muted/30 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Building2 className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium text-foreground">{dept}</span>
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{list.length}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
                    {karyawan.length > 0 && (
                      <span className={cn("hidden rounded-full px-1.5 py-0.5 font-semibold sm:inline", readyN === karyawan.length ? "bg-brand-500/12 text-brand-600 dark:text-brand-400" : "bg-amber-500/12 text-amber-600 dark:text-amber-400")}>
                        {readyN}/{karyawan.length} siap
                      </span>
                    )}
                    {registered > 0 && <span className="hidden sm:inline">{registered} terdaftar</span>}
                    <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
                  </span>
                </button>
                {open && <div className="animate-fade-up divide-y divide-border">{matches.map(renderAccount)}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
        <Users className="size-3.5" /> Perubahan tersimpan otomatis. Rekan sejawat & atasan yang ditunjuk otomatis mendapat akses menilai peserta terkait.
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "good" | "warn" }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={cn("text-lg font-bold tabular-nums", tone === "good" ? "text-brand-600 dark:text-brand-400" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </span>
  );
}

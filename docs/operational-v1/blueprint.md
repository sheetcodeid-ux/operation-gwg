# Operational V.1 — Blueprint

Rujukan tunggal untuk seluruh implementasi Operational V.1. Keputusan yang sudah
dikunci ada di [`decisions.md`](./decisions.md); yang di sini adalah rancangannya.

Tidak boleh ada dokumen kedua yang isinya blueprint dengan bentuk berbeda. Kalau
rancangannya berubah, yang diubah berkas ini.

Dikunci: 16 September 2026. Baseline: audit repository & basis data, 16 September 2026.

---

## 1. Ringkasan

Operational V.1 dibangun **di atas** ekosistem GWG, bukan di sampingnya. Dari 34
objek target: **11 dipakai ulang**, **8 diperluas**, **19 dibuat baru**, **0
migrasi merusak**.

Tiga keputusan yang menentukan sisanya:

| # | Keputusan | Pilihan |
|---|---|---|
| 1 | Keamanan | Hybrid — app-level tetap, plus integritas DB pada tabel V.1 |
| 2 | Sales fact | `seasonal_daily`, dengan aturan penyaringan wajib (§3) |
| 3 | Action | Tabel `actions` baru, tampilan digabung dengan `tasks` |

**Simpul kritis:** rantai `DATA → … → IMPACT` putus di KPI Value. Selama KPI cuma
dihitung saat halaman dibuka dan tidak pernah disimpan, Signal tidak punya dasar
pembanding dan Impact tidak bisa diukur. **PHASE 2 adalah gerbangnya.**

---

## 2. Keputusan arsitektur

| ID | Keputusan | Pilihan | Rujukan |
|---|---|---|---|
| AD-01 | Model keamanan | Hybrid | `decisions.md` |
| AD-02 | Sales source of truth | `seasonal_daily` | §3 |
| AD-03 | Action vs tasks | `actions` baru + read-model gabungan | §13 |
| AD-04 | Penyimpanan KPI | `kpi_values` berversi; logic tetap di `src/lib/kpi/*` | §6 |
| AD-05 | Target | `targets` berversi; `targetBulananOutlet()` jadi generator | §7 |
| AD-06 | Rule | `rules` + `rule_versions` + `rule_conditions` | §8 |
| AD-07 | Evidence | Objek generik di atas R2 existing, tanpa storage kedua | §14 |
| AD-08 | Verification | Generalisasi pola `hygiene_followups` | §15 |
| AD-09 | Tabel V.1 tidak masuk SEED | Query langsung, seperti `seasonal_daily` | §5 |
| AD-10 | Sidebar | Perluas bidang `Operational V.1` existing | §25 |
| AD-11 | Periode | Semua objek V.1 memakai `src/lib/ops/periode.ts` | — |
| AD-12 | Waktu | Satu helper WIB tunggal | — |
| AD-13 | Status | `text` + CHECK constraint, konstanta di TS | — |
| AD-14 | AI | Pembaca saja, tanpa hak tulis di luar `ai_*` | §13 |

---

## 3. Source of truth

### 3.1 Sales fact — `seasonal_daily`

| Tabel | Grain | Pembaca | Putusan |
|---|---|---|---|
| `seasonal_daily` | hari × cabang | `daily-outlet`, `performa-outlet`, `analysis`, `kelengkapan-daily`, `kpi`, `marcomm-analysis` | **SOURCE OF TRUTH** |
| `esb_net_bulanan` | bulan × cabang | `esb-bulanan.ts` | singgahan, bukan SoT |
| `esb_net_mingguan` | minggu × cabang | `esb-mingguan.ts` | singgahan, bukan SoT |
| `sales_daily` | hari (korporat) | `fraud-store`, `kpi-manajemen` | konteks Fraud |
| `sales_period` | rentang × cabang | `fraud-store` | konteks Fraud |

Alasannya: grain terhalus sehingga semua agregasi bisa diturunkan; sudah menopang
Performance 5 skala sehingga Impact otomatis rekonsiliasi dengan Daily; punya
`pax` dan `bills`; dan aktif di-backfill (`esb-daily-kejar`, tiap 10 menit).

### 3.2 ATURAN WAJIB — `seasonal_daily` tidak boleh diagregasi mentah

**`seasonal_daily` memuat baris korporat dan baris yatim.** Terbukti pada Agustus
2026:

| Kelompok | Cabang | Jumlah net |
|---|---|---|
| Cocok dengan `esb_net_bulanan` | 48 | Rp 9.621.368.211 |
| Beda tipis (selisih total Rp 25.002) | 10 | Rp 3.623.200.118 |
| **Hanya ada di `seasonal_daily`** | **2** | **Rp 13.406.503.873** |

Dua cabang itu:

- **`branch = ''`** — baris **korporat**, bukan cabang. `syncSeasonalDays()`
  berparameter `branch = ""` (`src/lib/data/seasonal.ts:100`), dan ESB membaca
  string kosong sebagai "seluruh cabang". Seluruh riwayatnya: 348 hari, Desember
  2024 – September 2026, Rp 118.092.066.971.
- **`57-fnb_nord`** — 78 hari, Juni–September 2026, Rp 164.030.635, **tidak cocok
  dengan satu outlet pun**.

**Akibatnya: `SUM(net) FROM seasonal_daily` menghitung ganda, kira-kira dua kali
lipat.** Halaman Daily tidak terkena karena menyaring lewat daftar cabang yang
diturunkan dari outlet (`src/lib/data/daily-outlet.ts:139`).

Maka aturannya, tanpa kecuali:

```
Setiap pembacaan seasonal_daily untuk V.1 WAJIB menyaring lewat
outlets.esb_branch_id. Dilarang mengagregasi tabelnya secara mentah.
```

Ini bukan cacat data yang perlu diperbaiki — baris korporat memang sengaja
disimpan dan dipakai halaman Musiman. Yang perlu dijaga cara membacanya.

### 3.3 Keterbatasan yang diterima

- Berkunci pada `branch`, bukan `outlet_id`. Join lewat `outlets.esb_branch_id`.
- Per 16 September 2026: 58 outlet aktif, **57 punya cabang ESB**, 1 tidak —
  outlet itu tidak akan pernah punya Signal berbasis penjualan. Harus disebut
  terang-terangan di Command Center, jangan dikecualikan diam-diam.
- **5 outlet `gross_manual`** punya jalur sendiri. Lihat AD-04 di `decisions.md`.

### 3.4 Peta SoT

| Objek | SoT | Writer | Reader V.1 |
|---|---|---|---|
| Outlet | `outlets` | `mutations.ts`, `outlet-manajemen.ts` | semua |
| Wilayah | `users.outlet_ids` | `user-mutations.ts` | `scope-v1.ts` |
| User/Role/Permission | `users` + `rbac.ts` + `nav.ts` | — | `scope-v1.ts` |
| Sales | `seasonal_daily` | `seasonal.ts` | KPI, Impact |
| Financial | `op_pnl`, `op_purchases`, `op_expenses` | `unggah-data.ts` | KPI |
| Target | `targets` (baru) | generator + admin | KPI, Signal |
| KPI Value | `kpi_values` (baru) | job | Signal, Impact, Report |
| Rule | `rules`/`rule_versions` (baru) | admin | engine |
| Signal | `signals` (baru) | engine | semua |
| Business Case | `business_cases` (baru) | user | Action |
| Action | `actions` (baru) | user | Verification, Impact |
| Task ad-hoc | `tasks` | `work.ts` | read-model |
| Evidence | `evidence` (baru) di atas R2 | uploader | semua |
| Notifikasi | `notifications` | `notify.ts` | semua |

---

## 4. Domain model

```
MASTER (outlets · users · areas)
   ↓
seasonal_daily · op_pnl/purchases/expenses · hygiene · complaints · tasks
   ↓
kpi_values ← kpi_definitions · targets
   ↓
rules → rule_versions → rule_conditions
   ↓
signals ← evidence
   ↓
diagnoses ← evidence
   ↓
recommendations
   ↓
business_cases ← approvals
   ↓
actions ─┬─ action_supporters
         ├─ action_dependencies
         └─ blockers · sla_policies
   ↓
verifications ← evidence
   ↓
impact_measurements ← external_factors
   ↓
learnings
   ↓
playbooks → playbook_steps → playbook_applications

LINTAS SEMUA: audit_logs · notifications · data_quality_logs
```

Kardinalitas: 1 Signal → 0..1 Diagnosis → 0..n Recommendation · 1 Business Case →
1..n Signal · 1 Business Case → 0..n Action · 1 Action → 0..n Verification ·
1 Action → 0..1 Impact · n Impact → 0..1 Learning · 1 Learning → 0..1 Playbook.

---

## 5. Database blueprint

Aturan wajib seluruh tabel V.1:

1. **Tidak masuk `SEED`/`hydrate.ts`.** Query langsung per permintaan. Alasannya
   tertulis di `src/lib/data/hydrate.ts:50` — TTL 3 detik pernah mematikan
   produksi, dan menambah tabel bervolume ke array memori mengulang risiko itu.
2. **Foreign key wajib** antar tabel V.1. Basis data existing punya 0 FK; utang
   itu tidak perlu diwariskan.
3. **CHECK constraint** untuk setiap kolom status.
4. Index minimal pada `(outlet_id, periode)` dan `(status, created_at)`.
5. Seluruh timestamp `timestamptz`.

| # | Objek | Tabel | Aksi | Keterangan |
|---|---|---|---|---|
| 1 | KPI Definition | `kpi_definitions` | CREATE | katalog KPI |
| 2 | KPI Value | `kpi_values` | CREATE | snapshot berversi |
| 3 | Target | `targets` | CREATE | berversi |
| 4–6 | Rule | `rules`, `rule_versions`, `rule_conditions` | CREATE | berversi |
| 7 | Signal | `signals` | CREATE | persistent |
| 8 | Diagnosis | `diagnoses` | CREATE | FACT vs HYPOTHESIS |
| 9 | Recommendation | `recommendations` | CREATE | saran, bukan komitmen |
| 10–11 | Business Case | `business_cases`, `business_case_signals` | CREATE | container |
| 12–15 | Action | `actions`, `action_supporters`, `action_dependencies`, `blockers` | CREATE | lihat §13 |
| 16 | SLA | `sla_policies` | CREATE | tenggat per severity |
| 17 | Evidence | `evidence` | CREATE | metadata, file tetap di R2 |
| 18 | Verification | `verifications` | CREATE | execution vs business |
| 19–20 | Impact | `impact_measurements`, `external_factors` | CREATE | |
| 21–24 | Learning | `learnings`, `playbooks`, `playbook_steps`, `playbook_applications` | CREATE | |
| 25–26 | Governance | `approvals`, `management_decisions` | CREATE | |
| 27–28 | Platform | `audit_logs`, `data_quality_logs` | CREATE | |
| 29–30 | AI | `ai_analyses`, `ai_feedback` | CREATE | |
| 31 | Task | `tasks` | **REUSE, jangan sentuh** | |
| 32 | Notification | `notifications` | **REUSE** | |
| 33 | Hygiene Follow-up | `hygiene_followups` | **REUSE** | referensi pola |
| 34 | Ops Settings | `op_settings` | **salin ke `rules`** | jangan dipindah |

**30 CREATE · 3 REUSE · 1 salin.** Nol tabel existing dihapus atau diubah.

---

## 6. KPI

Logic tidak diganti — `src/lib/kpi/*` dan `src/lib/ops/*` sudah teruji. V.1
memanggilnya, lalu **menyimpan hasilnya**.

**`kpi_definitions`** — `kode · nama · satuan · arah · skala · sumber ·
fungsi_kalkulasi · aktif`

**`kpi_values`** — `kpi_kode · outlet_id · periode · skala · nilai · target ·
capaian_persen · sumber · calculation_version · dihitung_pada · dasar (jsonb)`,
unik pada `(kpi_kode, outlet_id, periode, skala, calculation_version)`.

`calculation_version` adalah kuncinya. Kalau rumus berubah, nilai lama **tidak**
ditimpa — versi baru ditulis berdampingan. Tanpa itu, laporan yang sudah dicetak
berubah sendiri dan tidak ada yang bisa menjelaskan kenapa.

`dasar` menyimpan input mentah supaya "kenapa angkanya segini" bisa dijawab tanpa
menghitung ulang.

Dihitung oleh job terjadwal setelah ingestion ESB menutup hari, bukan saat halaman
dibuka.

---

## 7. Target

`outlet_id · kpi_kode · periode · skala · nilai · sumber (generated|manual|
negotiated) · growth_assumption · dasar (jsonb) · version · effective_from ·
effective_to · status (draft|active|superseded|archived) · dibuat_oleh ·
disetujui_oleh · disetujui_pada`

`targetBulananOutlet()` (`src/lib/data/kpi.ts:1884`) tidak dibuang — ia jadi
**generator** pengisi `targets`.

Target `active` yang periodenya sudah lewat **tidak boleh diubah**, hanya
di-`superseded`. Target yang bisa diubah surut membuat pencapaian bisa
"diperbaiki" setelah faktanya.

Override manual wajib lewat `approvals` — lihat AD-05.

---

## 8. Rule engine

**`rules`** — `kode · nama · kpi_kode · kategori · pemilik_departemen · aktif`

**`rule_versions`** — `rule_kode · version · effective_from · effective_to ·
severity_default · sla_policy_id · dibuat_oleh · catatan_perubahan`

**`rule_conditions`** — `rule_version_id · urutan · operator (lt|lte|gt|gte|
between|delta_pct|streak) · nilai_ambang · nilai_ambang_2 · skala · window ·
penggabung (AND|OR)`

Contoh:

```
rule: sewa_melebihi_ambang        ← AD-02
  version 1, effective 2026-10-01, severity: medium
  condition: kpi=sewa_persen, operator=gt, ambang=5, skala=bulanan

rule: penjualan_turun_beruntun
  version 1, severity: critical
  condition: kpi=net_sales, operator=delta_pct, ambang=-10, window=3, skala=harian
```

`op_settings` **disalin** sebagai seed versi 1, tidak dipindah. Halaman
`/operation/settings` tetap jalan. Pengalihan ke rule editor menyusul di PHASE 14.

Engine murni di `src/lib/ops/rules.ts` — tanpa DB, bisa diuji seperti
`lib/kpi/manajemen.ts`.

---

## 9. Signal

`id · kpi_kode · outlet_id · periode · skala · detected_at · rule_kode ·
rule_version · severity · nilai · ambang · gap · gap_persen · revenue_gap ·
sumber · status (new|acknowledged|diagnosing|escalated|dismissed|resolved|
expired) · dismissed_reason · resolved_by_case_id · kpi_value_id`,
unik pada `(rule_kode, rule_version, outlet_id, periode, skala)`.

Harus persistent, bukan runtime: supaya "sudah pernah ditangani belum?" bisa
dijawab, supaya `dismissed` diingat, supaya Impact tahu kapan masalahnya pertama
terdeteksi, dan supaya sinyal yang sama tidak lahir berkali-kali.

`AlertItem`/`InsightItem` di `src/lib/data/analysis.ts:51-52` **tetap seperti
sekarang** — itu analitik halaman Analysis, bukan Signal. Jangan digabung.

---

## 10. Diagnosis

`id · signal_id · probable_cause · cause_category · jenis (FACT|HYPOTHESIS) ·
confidence · narasi · owner_id · status · created_at · verified_at · sumber`

Aturan yang ditegakkan sistem:

- **FACT** wajib punya ≥1 evidence. Tanpa bukti, tidak bisa disimpan sebagai FACT.
- **HYPOTHESIS** boleh tanpa bukti, `confidence` wajib diisi dan tidak boleh > 70.
- Hanya Diagnosis `FACT` **dan** `verified` yang boleh mendasari Business Case
  ber-severity `critical`.

Tanpa pemisahan ini, dugaan berubah jadi "penyebabnya sudah ketahuan" di rapat
berikutnya, dan tindakan diambil atas sesuatu yang tidak pernah diperiksa.

`cause_category` memakai kosakata yang sudah dipakai `complaints.root_cause`
(`src/lib/types.ts:179`) — satu kosakata, bukan dua.

---

## 11. Recommendation

`id · signal_id · diagnosis_id · judul · deskripsi · action_type_usulan ·
expected_impact_usulan · effort · prioritas_skor · sumber · playbook_id ·
status (open|accepted|rejected|expired) · rejected_reason · accepted_into_case_id`

| | Recommendation | Action |
|---|---|---|
| Sifat | saran | komitmen |
| Owner | tidak | **wajib** |
| Tenggat | tidak | **wajib** |
| Boleh diabaikan | ya, dengan alasan | tidak — harus dibatalkan dengan persetujuan |
| Masuk SLA | tidak | ya |
| Masuk Impact | tidak | ya |

Yang di-`rejected` **wajib** menyertakan alasan — itulah bahan Learning tentang
saran macam apa yang tidak pernah dipakai.

---

## 12. Business Case

`id (CASE-YYYYMM-NNN) · outlet_id · periode · judul · problem_statement ·
severity · revenue_gap · diagnosis_id · probable_cause · confidence ·
primary_owner_id · expected_recovery · expected_recovery_deadline · status ·
closed_at · closed_reason`

```
DETECTED → DIAGNOSING → ASSIGNED → IN_PROGRESS ⇄ BLOCKED
                                        ↓
                                    SUBMITTED
                                        ↓
                                  VERIFICATION → (gagal) → IN_PROGRESS
                                        ↓ (lulus)
                                   IMPACT_WAIT
                                        ↓
                       SUCCESS / PARTIAL / FAILED / INCONCLUSIVE
                                        ↓
                                     CLOSED
```

**Transisi terlarang, ditegakkan di server:**

- `SUBMITTED → SUCCESS` — wajib lewat VERIFICATION **dan** IMPACT_WAIT
- `IN_PROGRESS → CLOSED`
- `IMPACT_WAIT → SUCCESS` tanpa baris `impact_measurements`
- mundur dari `CLOSED`

Inilah premis V.1. Kalau cuma dijaga di UI, satu tombol yang lupa dijaga
meruntuhkan seluruhnya.

---

## 13. Action

### Keputusan: tabel baru, tampilan tunggal

```
tasks    (existing, tidak disentuh)  = kerja ad-hoc / divisional
actions  (baru)                      = kerja yang lahir dari Business Case
         ↓                    ↓
         └── lib/data/pekerjaan.ts (read-model) ──┘
                          ↓
            "My Actions" / "Team Actions" — SATU daftar,
            berbadge sumber: [Ad-hoc] / [CASE-202609-014]
```

Alasan menolak memperluas `tasks`: `TaskStatus` cuma 5 nilai (`src/lib/types.ts:148`)
sedangkan V.1 butuh 11, dan mencampurnya merusak penyaring Work Tracker; `tasks`
**ikut dihidrasi ke memori**, sehingga menambah volume V.1 mengulang risiko yang
tercatat di `hydrate.ts:50`; dan 3.552 baris existing akan berisi
`business_case_id` kosong selamanya.

Alasan menolak dua papan terpisah: user cuma mau satu daftar pekerjaan.

Keduanya **disjoint by construction**: `actions` selalu punya `business_case_id`,
`tasks` tidak pernah punya. Tidak ada satu pekerjaan tercatat dua kali.

Ongkosnya diakui: satu read-model harus dirawat, dan kedisjointannya harus dijaga.

**`actions`** — `id · business_case_id (NOT NULL) · outlet_id · departemen ·
action_type · judul · deskripsi · primary_owner_id (NOT NULL) · prioritas ·
start_date · deadline (NOT NULL) · sla_policy_id · status · expected_impact_* ·
progress · submitted_at · actual_impact_nilai · result · learning_id ·
playbook_application_id`

UI memakai `KanbanBoard`, `TaskSheet`, `TaskDetail`, `StageFilter`,
`StatusFilter` apa adanya.

---

## 14. Evidence

Objek generik di atas R2 existing. **Tidak ada storage kedua.**

`id · entity_type · entity_id · jenis · storage_key · nama_berkas · mime ·
ukuran_byte · checksum · uploader_id · uploaded_at · metadata (jsonb) ·
retention_until`

- Presign tetap lewat jalur existing (`src/lib/upload-client.ts`,
  `src/app/api/berkas/*`).
- **Cron `bersih-foto` harus diberi tahu tentang kunci yang dipegang `evidence`**,
  persis seperti `src/lib/data/hygiene-bersih.ts:169` menjaga foto hygiene. Kalau
  terlewat, bukti Business Case terhapus diam-diam.
- `hygiene.photos` dan `tasks.attachments` **tidak dimigrasi**.

---

## 15. Verification

Referensi: `hygiene_followups` (`src/lib/data/hygiene-followup.ts`) — satu-satunya
alur verifikasi yang sudah terbukti jalan.

`id · action_id · business_case_id · tipe (execution|business) · verifier_id ·
status (pending|passed|failed|partial|needs_more_evidence) · checklist (jsonb) ·
catatan · evidence_ids · verified_at · attempt`

| | EXECUTION VERIFIED | BUSINESS VERIFIED |
|---|---|---|
| Pertanyaan | pekerjaannya benar dilakukan? | masalahnya benar hilang? |
| Kapan | setelah `SUBMITTED` | setelah `IMPACT_WAIT` |
| Pemeriksa | atasan langsung / QC | pemilik Business Case |
| Dasar | evidence | `impact_measurements` |

`verifier_id != action.primary_owner_id`, ditegakkan di server — lihat AD-06.

---

## 16. Impact

`id · action_id · business_case_id · kpi_kode · metric_satuan · sumber ·
baseline_nilai · baseline_periode_* · expected_nilai · expected_dasar ·
actual_nilai · actual_periode_* · selisih · pencapaian_persen · confidence ·
result · external_factor_ids · diukur_pada · diukur_oleh`

- **Baseline** = `kpi_values` pada jendela **sebelum** `action.start_date`,
  sepanjang jendela pengukuran.
- **Actual** = `kpi_values` setelah action selesai + masa tunggu.
- Sumber wajib `seasonal_daily`/`op_pnl`. Manual butuh persetujuan — lihat AD-04.

```
pencapaian ≥ 100%                    → SUCCESS
50% ≤ pencapaian < 100%              → PARTIAL
pencapaian < 50%                     → FAILED
confidence < 50 ATAU faktor eksternal berdampak tinggi
ATAU baseline tidak tersedia (AD-04) → INCONCLUSIVE
```

`INCONCLUSIVE` adalah hasil yang sah. Outlet yang naik karena ada event besar di
sebelahnya tidak membuktikan action-nya berhasil.

**`external_factors`** — `id · outlet_id · jenis · judul · dari · sampai ·
dampak_perkiraan · arah · sumber_data · dicatat_oleh`. `weather` dan `competitor`
belum ada sumber datanya — lihat keputusan terbuka #9.

---

## 17. Learning

`id · judul · konteks · kondisi_berlaku (jsonb) · tindakan_yang_berhasil ·
kenapa_berhasil · impact_ids (≥1) · tingkat_kepercayaan · jumlah_kasus ·
tingkat_keberhasilan_persen · status · direview_oleh`

- Dari 1 impact: boleh, tapi `tingkat_kepercayaan` maksimum `low` dan **tidak
  boleh** jadi Playbook.
- `medium`: ≥3 impact SUCCESS/PARTIAL berpola sama.
- `high`: ≥5 impact, keberhasilan ≥70%, plus review manusia.
- Impact `INCONCLUSIVE` tidak dihitung.

---

## 18. Playbook

**`playbooks`** — `id · learning_id (NOT NULL) · kode · judul · kapan_dipakai ·
pemilik_departemen · versi · status · tingkat_keberhasilan · jumlah_penerapan`

**`playbook_steps`** — `playbook_id · urutan · judul · instruksi · departemen ·
durasi_perkiraan_hari · evidence_wajib · kriteria_selesai`

**`playbook_applications`** — `playbook_id · playbook_versi · business_case_id ·
diterapkan_oleh · actions_dibuat · hasil · impact_id · catatan_penyimpangan`

Gerbang pembuatan: `tingkat_kepercayaan ∈ {medium, high}` **dan** `jumlah_kasus ≥ 3`
**dan** `status = published` **dan** persetujuan manusia.

Playbook yang turun di bawah 50% setelah ≥5 penerapan otomatis `deprecated`.
Playbook yang dulu benar dan sekarang tidak, kalau dibiarkan aktif, menyesatkan
lebih lama daripada kalau tidak pernah ada.

---

## 19–22. Notification · Approval · Audit Log · Data Quality

**Notification — REUSE.** `notifications` (2.190 baris) + `src/lib/data/notify.ts`
apa adanya. Pemicu V.1: Signal critical, Case ditugaskan, Action mendekati/lewat
SLA, Blocker, verifikasi menunggu, Impact selesai, Playbook di-deprecate.

**`approvals`** — generik: `entity_type · entity_id · tahap · diminta_oleh ·
approver_id · status · catatan · diputuskan_pada`. Wajib untuk: target manual
override, pembatalan Action yang sudah jalan, impact manual, publikasi Playbook,
penutupan Case critical.

**`audit_logs`** — `actor_id · aksi · entity_type · entity_id · before · after ·
perubahan · alasan · request_id · created_at`. **Append-only**, ditegakkan
trigger. Setiap transisi status Case dan Action wajib tercatat. Jangan simpan data
sensitif. IP/user-agent menunggu keputusan terbuka #10.

**`data_quality_logs`** — `sumber · job · dataset · periode_* · row_count ·
valid_count · invalid_count · duplicate_count · missing_count · expected_count ·
kelengkapan_persen · status · error_detail`.

`sinkron_sehat` menjawab "job-nya jalan?"; tabel ini menjawab "datanya benar?".
`src/lib/data/kelengkapan-daily.ts` jadi produsen pertamanya.

**Gerbang:** Signal tidak boleh lahir untuk periode ber-kelengkapan di bawah
ambang. Ambangnya configuration decision — lihat keputusan terbuka #14. Simpan di
`op_settings` (pola existing), **jangan sebar angkanya ke banyak berkas**.

---

## 23–24. RBAC dan RLS

Peta izin ada di `decisions.md` AD-06. Permission baru yang ditambahkan ke union
di `src/lib/rbac.ts`: `view_operational_v1 · manage_signals · create_diagnosis ·
verify_diagnosis · manage_business_case · assign_action · verify_execution ·
verify_business · manage_impact · manage_playbook · manage_rules · view_audit_v1`.

Cakupan lewat satu modul tunggal `src/lib/ops/scope-v1.ts` yang membungkus
`scopeOutlets` + `outletMilikPic` + `bidangOrang`. Setiap query V.1 lewat situ.

Model keamanan: AD-01. Isi konkretnya — existing tidak disentuh; tabel V.1 dapat
FK + CHECK; scope module tunggal; uji scoping wajib per halaman baru (5 peran ×
outlet sendiri/orang lain); deny-all policy sebagai tripwire; jalan ke RLS penuh
tetap terbuka.

---

## 25. Sidebar

```
Operational V.1                        ← bidang existing, DIPERLUAS
├─ Command Center                      ← BARU
├─ Performance                         ← GRUP EXISTING, tidak disentuh
│  └─ Daily · Weekly · Monthly · Quarterly · Yearly
├─ Intelligence                        ← BARU
│  └─ Signals · Diagnoses · Recommendations · Opportunities · Playbooks
├─ Work                                ← BARU
│  └─ My Actions · Team Actions · Business Cases · Blocked · Verification
├─ Impact                              ← BARU
│  └─ Recovery · Action Impact · Hasil
└─ Learning                            ← BARU
   └─ Learnings · Playbooks · Applications
```

Penyesuaian dari usulan awal:

| Usulan | Penyesuaian | Alasan |
|---|---|---|
| Outlet (6 menu) | tidak jadi bidang sendiri | kelimanya sudah ada di `Operation`; Readiness & Incidents jadi tab Command Center |
| Impact: Success/Partial/Failed | digabung jadi "Hasil" + filter | tiga baris sidebar untuk satu halaman |
| Reports (4 menu) | perluas `/reports` existing | menghindari dua cabang Reports |

Hygiene dan Complaints **tidak dipindah** dari `Operation` — ditautkan silang dari
Command Center. Memindahkan menu yang dipakai harian membuat orang mencari-cari.

Yang wajib diubah: `MenuKey` · `NAV_MENUS` · `DIVISION_GROUPS["Operational V.1"]` ·
`DIVISION_MENUS` · `ROLE_MENUS` di `src/lib/nav.ts`, plus kunci `nav.*`/`group.*`
di `src/lib/i18n/dict.ts` — dijaga `src/lib/i18n/dict.test.ts`.

---

## 26–28. UI/UX

**Standar = `/operational/daily`.** Kontrak yang mengikat setiap halaman V.1:

| Aspek | Aturan |
|---|---|
| Struktur | `<div className="w-full"><PageHeader …/>{konten}</div>` |
| Kartu | `rounded-2xl border border-border bg-card/40 p-5` |
| Warna | **hanya token**, dilarang hex mentah |
| Semantik | emerald=naik · rose=turun · amber=perhatian, selalu berpasangan `dark:` |
| Angka | `tabular-nums` wajib |
| Ukuran | judul `text-sm font-semibold tracking-tight` · isi `text-[12.5px]` · keterangan `text-[11px]` · kolom `text-xs uppercase tracking-wide` |
| Dialog | overlay `bg-black/50` + panel `max-w-lg rounded-2xl` + Esc |
| Empty | `px-4 py-10 text-center text-sm text-muted-foreground` |
| Responsif | `overflow-x-auto` + `min-w-[Nrem]` |
| Ikon | wajib didaftarkan di `NAV_ICONS` (`src/components/layout/icons.tsx`) |

**Dipakai ulang, dilarang dibuat ulang:** `PageHeader` · `DataTable` ·
`TabelHarian` · `HalamanPerforma` · `Combobox` · `MultiCombobox` · `Badge` ·
`tone` · `StatTile` · `Progress` · `ScoreRing` · `SegmentedTabs` · `StatusFilter` ·
`StageFilter` · `Sheet` · `BottomSheet` · `Dialog` · `Confirm` · `DatePicker` ·
`DateTimePicker` · `DetailRows` · `CameraCapture` · `KanbanBoard` · `TaskSheet` ·
`TaskDetail` · `KpiIndicatorDonut` · `KpiPerformanceChart` · `NAV_ICONS`

**Komponen baru yang memang belum ada:**

| Komponen | Status | Putusan |
|---|---|---|
| Workflow Timeline | MISSING | CREATE `ui/timeline.tsx` |
| Signal→Diagnosis→Action flow | MISSING | CREATE `ops/alur-kasus.tsx` |
| Baseline/Expected/Actual card | MISSING | CREATE `ops/kartu-impact.tsx` |
| SLA indicator | MISSING | CREATE `ui/sla-bar.tsx` |
| Severity indicator | PARTIAL | EXTEND `ui/tone.ts` — tambah `critical` |
| Evidence gallery | PARTIAL | EXTEND — angkat dari `components/hygiene/` |
| Confidence indicator | PARTIAL | EXTEND — angkat `BarPersen` dari `papan-manajemen.tsx:286` |

Dilarang membuat: gaya tombol baru, gaya kartu baru, sistem spacing baru, sistem
tipografi baru, warna hex baru, sistem modal baru.

---

## 29. Dependency

```
MASTER DATA                              ✅ REUSE
   ↓
SALES / OPERATIONAL DATA                 ✅ REUSE
   ↓
DATA QUALITY (gerbang) ───────────┐      ❌ PHASE 12, gerbangnya PHASE 4
   ↓                              │
KPI VALUE ← TARGET                │      ❌ PHASE 2 ← SIMPUL KRITIS
   ↓                              │
RULE → RULE VERSION → CONDITION   │      ❌ PHASE 3
   ↓                              │
SIGNAL ←──────────────────────────┘      ❌ PHASE 4
   ↓
DIAGNOSIS ← EVIDENCE                     ❌ PHASE 6
   ↓
RECOMMENDATION                           ❌ PHASE 6
   ↓
BUSINESS CASE ← APPROVAL                 ❌ PHASE 7
   ↓
ACTION ← SLA, BLOCKER, NOTIFICATION ✅    ❌ PHASE 8
   ↓
VERIFICATION ← EVIDENCE                  ❌ PHASE 9
   ↓
IMPACT ← EXTERNAL FACTOR, KPI VALUE      ❌ PHASE 10
   ↓
LEARNING → PLAYBOOK                      ❌ PHASE 11

LINTAS: AUDIT LOG (12) · NOTIFICATION (reuse) · APPROVAL (7) · AI (13, read-only)
```

---

## 30. Phase

| Phase | Isi |
|---|---|
| 0 | Keputusan arsitektur — **SELESAI**, lihat `decisions.md` |
| 1 | Fondasi: `scope-v1.ts` · helper WIB · aturan baca `seasonal_daily` · gerbang kelengkapan |
| 2 | **KPI + Target** ← gerbang |
| 3 | Rule Engine |
| 4 | Signal |
| 5 | **Command Center** ← layar V.1 pertama |
| 6 | Diagnosis + Evidence + Recommendation |
| 7 | Business Case + Approval |
| 8 | Action + read-model gabungan |
| 9 | Verification |
| 10 | Impact |
| 11 | Learning + Playbook |
| 12 | Audit Log + Data Quality |
| 13 | AI |
| 14 | Reports + rule editor |
| 15 | QA penuh + production readiness |

Nilai berguna pertama keluar di PHASE 5. Empat phase sebelumnya fondasi yang tidak
terlihat di layar — perlu dikomunikasikan supaya tidak terbaca sebagai "lama sekali
belum ada apa-apa".

---

## 31. Acceptance criteria

Berlaku untuk **setiap** phase, tidak boleh dilewati:

- **FUNCTIONAL** — jalan dengan data produksi nyata, bukan contoh
- **DATA** — tidak ada SoT kedua; angka rekonsiliasi dengan Performance Daily
- **SECURITY** — setiap server action memeriksa izin di server
- **PERMISSION** — matriks 5 peran diuji
- **SCOPE** — outlet orang lain tidak terkirim ke peramban, diuji
- **UI/UX** — lulus UI Consistency Check; dark+light; responsif; empty/loading/error
- **PERFORMANCE** — tanpa N+1; query ber-index; < 3 detik dengan data penuh
- **TEST** — `npm run lint` 0 error · `tsc --noEmit` bersih · `vitest run` lulus · `npm run build` sukses
- **BACKWARD COMPAT** — halaman existing tidak berubah; `daily-utuh.test.ts` hijau

Tambahan per phase ada di README.

---

## 32. Migrasi

Seluruh V.1 aditif. Nol ALTER, nol DROP, nol rename pada tabel existing.

- `op_settings` → `rules`: **salin**, jangan pindah
- `targetBulananOutlet()` jadi generator; fungsinya tetap ada dan tetap diuji
- `tasks` tidak disentuh; `actions` berdampingan, disjoint
- KPI dihitung mundur 12 bulan sekali di PHASE 2 (backfill, bukan migrasi)
- Rollback per phase = nonaktifkan menunya; data existing tidak terpengaruh
- Menu V.1 disembunyikan lewat `ROLE_MENUS` sampai phase-nya lulus acceptance

**Dilarang tanpa instruksi eksplisit:** mengubah `seasonal_daily`, `fraud_orders`,
`op_*`, `outlets`, `users`, `credentials`; menghapus `sales_daily`/`sales_period`;
mengubah `esb-client.ts`; mengubah bawaan `tabel-harian.tsx`.

---

## 33. Risiko

| # | Risiko | Mitigasi |
|---|---|---|
| R1 | Tidak ada jaring pengaman RLS | `scope-v1.ts` tunggal + uji scoping wajib |
| R2 | Cron `bersih-foto` menghapus evidence | Daftarkan kunci `evidence`, wajib PHASE 6 |
| R3 | Tabel V.1 masuk SEED | AD-09 + guard test yang menolak import V.1 di `hydrate.ts` |
| R4 | KPI backfill tidak cocok dengan Daily | Rekonsiliasi jadi acceptance PHASE 2 |
| R5 | Rule tanpa versi terlanjur dipakai | Versi sejak PHASE 3 |
| R6 | "Selesai" ≠ "berhasil" disepelekan | State machine server-side + test per transisi terlarang |
| R7 | **`seasonal_daily` diagregasi mentah → hitung ganda** | Aturan §3.2 + guard test |
| R8 | Outlet tanpa cabang ESB tak terlihat | Tampilkan terang-terangan di Command Center |
| R9 | Dua daftar kerja tetap terasa dua | Uji dengan user nyata di PHASE 8 |
| R10 | Sinyal terlalu berisik | Mulai dari sedikit rule severity tinggi; pantau rasio `dismissed` |
| R11 | Scope creep 15 phase | PHASE 5 sebagai tonggak; evaluasi ulang di situ |
| R12 | AI dipaksa jadi SoT | AI tanpa hak tulis di luar `ai_*`, diuji |

---

## 34. Keputusan terbuka

Enam keputusan pertama sudah dikunci — lihat `decisions.md`. Yang masih terbuka
ada di bagian akhir berkas yang sama.

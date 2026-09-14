/** Tiruan aksi server Problem Solver untuk pratinjau. Angkanya CONTOH. */
export interface BarisProblemSolver {
  outletId: string;
  nama: string;
  kode: string;
  jenis: "Umum" | "KPK";
  jumlah: number | null;
}

export interface HasilSimpanPs {
  tersimpan: number;
  error?: string;
}

const CONTOH: BarisProblemSolver[] = [
  ["Nordu Coffee Putussibau", "NCPU", "KPK", 12],
  ["Nordu Coffee Ketapang", "NCKG", "KPK", 8],
  ["Nordu Coffee Penibung", "NCP", "KPK", null],
  ["Nordu Coffee Palangkaraya", "NCPA", "KPK", 10],
  ["Cattu A. Yani", "CAY", "Umum", 14],
  ["Cattu Sintang", "CST", "Umum", null],
  ["Ayam Goreng Busari Serdam", "ABS", "Umum", 9],
  ["Nordu Coffee Tebas", "NCTB", "Umum", 11],
  ["Lesung Pipi Bogor", "LPB", "Umum", null],
].map(([nama, kode, jenis, jumlah], i) => ({
  outletId: `o${i}`,
  nama: nama as string,
  kode: kode as string,
  jenis: jenis as "Umum" | "KPK",
  jumlah: jumlah as number | null,
}));

export async function daftarProblemSolverAction(): Promise<BarisProblemSolver[]> {
  await new Promise((r) => setTimeout(r, 200));
  return CONTOH;
}

export async function simpanProblemSolverAction(): Promise<HasilSimpanPs> {
  await new Promise((r) => setTimeout(r, 400));
  return { tersimpan: CONTOH.length };
}

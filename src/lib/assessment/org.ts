/**
 * Organizational reference data for the HRD assessment: the
 * Departemen → Jabatan → Karyawan hierarchy plus the Golongan and Batch lists.
 *
 * DESIGN: everything derives from the plain `ORG_RAW` literal below. To onboard
 * a new department, position, or employee you only edit that literal — ids and
 * lookup maps are generated automatically. To add a batch or golongan, append
 * to the arrays. No component code changes needed (spec §9).
 */

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "dan")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Selectable career grades, ordered lowest → highest (spec §1.1). */
export const GOLONGAN: string[] = [
  "Junior Staff",
  "Staff",
  "Senior Staff",
  "Asisten Supervisor",
  "Supervisor",
  "Junior Manager",
  "Manager",
  "Senior Manager",
  "Chief",
];

/** Grades that carry a sub-level 1–5 (Supervisor, Staff, Manager). */
export const LEVELED_GOLONGAN = ["Staff", "Supervisor", "Manager"];
export const GOLONGAN_LEVELS = ["1", "2", "3", "4", "5"];

/** Whether a grade needs a level dropdown. */
export const golonganHasLevel = (g: string): boolean => LEVELED_GOLONGAN.includes(g);

/** Human label, e.g. "Staff Level 3" or plain "Senior Staff". */
export function formatGolongan(golongan: string, level?: string): string {
  if (!golongan) return "";
  return golonganHasLevel(golongan) && level ? `${golongan} Level ${level}` : golongan;
}

/** Assessment batches (spec §1.2). Append "Batch 3", … to extend. */
export const BATCHES: string[] = ["Batch 1", "Batch 2"];

/** Raw hierarchy — the single source of truth. Edit here to grow the org. */
const ORG_RAW: { department: string; positions: { title: string; employees: string[] }[] }[] = [
  {
    department: "Operations",
    positions: [
      { title: "Head Operation", employees: ["Muhammad Andi Wahyudi"] },
      { title: "Data Operation", employees: ["Muhammad Lutfi Rijalul Fikri"] },
      { title: "Data Operation POS", employees: ["Evan", "Adinda"] },
      { title: "Coordinator Area", employees: ["Jayadi", "Wisnu", "Deo", "Poetri"] },
      { title: "Admin Operation", employees: [] },
    ],
  },
  {
    department: "Finance",
    positions: [
      { title: "Head Finance", employees: ["Indah Puspita"] },
      { title: "Finance", employees: ["Fetty", "Jihan", "Nisa", "Sri"] },
      { title: "Pajak", employees: ["Samsul"] },
      { title: "Accounting", employees: ["Bella"] },
    ],
  },
  {
    department: "Creative",
    positions: [
      { title: "Head Creative", employees: ["Dhimas Satria"] },
      { title: "Social Media", employees: ["Zia", "Via", "Dita"] },
      { title: "Design Grafis", employees: ["Ricky", "Seka"] },
      { title: "Marketing Communication", employees: ["Amanda"] },
    ],
  },
  {
    department: "Project Manager",
    positions: [
      { title: "Head Project Manager", employees: ["Putri"] },
      { title: "Project Manager", employees: ["Qintan", "Tiffany"] },
      { title: "Arsitek", employees: ["Arul", "Aan"] },
    ],
  },
  {
    department: "Human Resources Development",
    positions: [
      { title: "Legal", employees: ["MT Adrianto"] },
      { title: "HRD", employees: ["Dini Amalia"] },
    ],
  },
  {
    department: "Auditor",
    positions: [{ title: "Auditor", employees: ["Sonny", "Nita"] }],
  },
  {
    department: "Sekretaris",
    positions: [{ title: "Sekretaris", employees: ["Monica", "Maya"] }],
  },
  {
    department: "Food & Beverage",
    positions: [
      { title: "Head Research and Development", employees: ["Andi"] },
      { title: "Coordinator Food & Beverage", employees: ["Radika"] },
      { title: "Research and Development Bar", employees: ["Abil", "Adam"] },
      { title: "Research and Development Kitchen", employees: ["Mustadi", "Bagas"] },
    ],
  },
  {
    department: "Business Development",
    positions: [{ title: "Business Development", employees: ["Ilfiana"] }],
  },
];

export interface Employee {
  id: string;
  name: string;
  positionId: string;
  departmentId: string;
}

export interface Position {
  id: string;
  title: string;
  /** True for division heads ("Head …") — assessed directly by Director & HR. */
  isHead: boolean;
  departmentId: string;
  employees: Employee[];
}

export interface Department {
  id: string;
  name: string;
  positions: Position[];
}

/** Built, id-stamped base hierarchy derived from ORG_RAW (always present). */
const BASE_DEPARTMENTS: Department[] = ORG_RAW.map((d) => {
  const departmentId = `dep_${slug(d.department)}`;
  return {
    id: departmentId,
    name: d.department,
    positions: d.positions.map((p) => {
      const positionId = `${departmentId}__pos_${slug(p.title)}`;
      return {
        id: positionId,
        title: p.title,
        isHead: p.title.toLowerCase().startsWith("head"),
        departmentId,
        employees: p.employees.map((name) => ({
          id: `${positionId}__emp_${slug(name)}`,
          name,
          positionId,
          departmentId,
        })),
      };
    }),
  };
});

/** DB-added departments + employees, merged on top of the base.
 *  Shape a department id from a name so it matches base ids where possible. */
export interface OrgExtra {
  departments: { id: string; name: string }[];
  employees: { id: string; departmentId: string; jabatan: string; name: string; isHead: boolean }[];
}

export const orgDepartmentId = (name: string) => `dep_${slug(name)}`;

function buildMerged(base: Department[], extra: OrgExtra): Department[] {
  const byId = new Map<string, Department>();
  for (const d of base) byId.set(d.id, { ...d, positions: d.positions.map((p) => ({ ...p, employees: [...p.employees] })) });
  for (const ed of extra.departments) {
    if (!byId.has(ed.id)) byId.set(ed.id, { id: ed.id, name: ed.name, positions: [] });
  }
  for (const e of extra.employees) {
    let dept = byId.get(e.departmentId);
    if (!dept) {
      dept = { id: e.departmentId, name: e.departmentId, positions: [] };
      byId.set(e.departmentId, dept);
    }
    const positionId = `${dept.id}__pos_${slug(e.jabatan)}`;
    let pos = dept.positions.find((p) => p.id === positionId);
    if (!pos) {
      pos = { id: positionId, title: e.jabatan, isHead: e.isHead || e.jabatan.toLowerCase().startsWith("head"), departmentId: dept.id, employees: [] };
      dept.positions.push(pos);
    }
    if (!pos.employees.some((x) => x.id === e.id)) {
      pos.employees.push({ id: e.id, name: e.name, positionId: pos.id, departmentId: dept.id });
    }
  }
  return [...byId.values()];
}

// ── live merged hierarchy (base + DB extras). Empty extras ⇒ identical to base. ──
let DEPARTMENTS: Department[] = BASE_DEPARTMENTS;
let DEPT_BY_ID = new Map<string, Department>();
let POS_BY_ID = new Map<string, Position>();
let EMP_BY_ID = new Map<string, Employee>();

function rebuildIndex() {
  DEPT_BY_ID = new Map(DEPARTMENTS.map((d) => [d.id, d]));
  POS_BY_ID = new Map();
  EMP_BY_ID = new Map();
  for (const d of DEPARTMENTS) {
    for (const p of d.positions) {
      POS_BY_ID.set(p.id, p);
      for (const e of p.employees) EMP_BY_ID.set(e.id, e);
    }
  }
}
rebuildIndex();

/** Inject DB-added org data (called once with data fetched for the page). */
export function setOrgExtras(extra: OrgExtra) {
  DEPARTMENTS = extra.departments.length || extra.employees.length ? buildMerged(BASE_DEPARTMENTS, extra) : BASE_DEPARTMENTS;
  rebuildIndex();
}

/** The full (merged) department list. */
export const allDepartments = () => DEPARTMENTS;

/** The pristine built-in (hardcoded) departments — never mutated. */
export const builtInDepartments = () => BASE_DEPARTMENTS;

export const getDepartment = (id: string | undefined) => (id ? DEPT_BY_ID.get(id) : undefined);
export const getPosition = (id: string | undefined) => (id ? POS_BY_ID.get(id) : undefined);
export const getEmployee = (id: string | undefined) => (id ? EMP_BY_ID.get(id) : undefined);

/** Positions inside a department (for the cascading Jabatan dropdown). */
export const positionsForDepartment = (departmentId: string | undefined): Position[] =>
  getDepartment(departmentId)?.positions ?? [];

/** Employees inside a position (for the cascading Nama dropdown). */
export const employeesForPosition = (positionId: string | undefined): Employee[] =>
  getPosition(positionId)?.employees ?? [];

/** Convenience: dropdown option lists. */
export const departmentOptions = () => DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }));
export const positionOptions = (departmentId: string | undefined) =>
  positionsForDepartment(departmentId).map((p) => ({ value: p.id, label: p.title }));
export const employeeOptions = (positionId: string | undefined) =>
  employeesForPosition(positionId).map((e) => ({ value: e.id, label: e.name }));

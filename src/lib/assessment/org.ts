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

/**
 * Raw hierarchy — the single source of truth (GWG Group HO org chart 2026).
 * Departments → Jabatan. Employee NAMES are intentionally empty: people come
 * from the User Management accounts (department + jabatan), mirrored in on
 * account create/update. Edit here to change the department/jabatan structure.
 */
const ORG_RAW: { department: string; positions: { title: string; employees: string[] }[] }[] = [
  {
    department: "Finance Accounting Tax",
    positions: [
      { title: "Head", employees: [] },
      { title: "Finance", employees: [] },
      { title: "Treasury", employees: [] },
      { title: "Accounting & Verification", employees: [] },
      { title: "AR Staff", employees: [] },
      { title: "AP Staff", employees: [] },
      { title: "Tax", employees: [] },
    ],
  },
  {
    department: "Human Capital",
    positions: [
      { title: "Head", employees: [] },
      { title: "Talent Acquisition", employees: [] },
      { title: "L&D dan Comben", employees: [] },
      { title: "Administration", employees: [] },
    ],
  },
  {
    department: "Operational",
    positions: [
      { title: "Head", employees: [] },
      { title: "Coordinator Area East", employees: [] },
      { title: "Coordinator Area West", employees: [] },
      { title: "System Support", employees: [] },
    ],
  },
  {
    department: "Production",
    positions: [
      { title: "Head", employees: [] },
      { title: "Demand", employees: [] },
      { title: "Quality Assurance & Control", employees: [] },
      { title: "Central Kitchen", employees: [] },
      { title: "Bakery", employees: [] },
    ],
  },
  {
    department: "Product Development & Quality",
    positions: [
      { title: "Head", employees: [] },
      { title: "Beverage Development", employees: [] },
      { title: "Quality Assurance & Control", employees: [] },
      { title: "Food Development", employees: [] },
      { title: "Staff R&D Bar", employees: [] },
      { title: "Staff R&D Kitchen", employees: [] },
      { title: "Trainer R&D Bar", employees: [] },
      { title: "Trainer R&D Kitchen", employees: [] },
    ],
  },
  {
    department: "Marketing Specialist",
    positions: [
      { title: "Head", employees: [] },
      { title: "Community & Customer Relation", employees: [] },
      { title: "Digital Marketing", employees: [] },
      { title: "Brand & Marketing Strategy", employees: [] },
      { title: "Social Media", employees: [] },
    ],
  },
  {
    department: "Creative Director",
    positions: [
      { title: "Head", employees: [] },
      { title: "Graphic Designer", employees: [] },
      { title: "Photo/Video", employees: [] },
    ],
  },
  {
    department: "Supply Chain",
    positions: [
      { title: "Head", employees: [] },
      { title: "Driver", employees: [] },
      { title: "Warehouse Kering", employees: [] },
      { title: "Warehouse Basah", employees: [] },
      { title: "Packing & Helper", employees: [] },
      { title: "Admin Penjualan", employees: [] },
      { title: "Admin Pembelian", employees: [] },
    ],
  },
  {
    department: "Procurement",
    positions: [{ title: "Head", employees: [] }],
  },
  {
    department: "Business Development",
    positions: [
      { title: "Head", employees: [] },
      { title: "Expansion & Partnership", employees: [] },
      { title: "Project & Asset Management", employees: [] },
      { title: "Management Investasi", employees: [] },
    ],
  },
  {
    department: "IT",
    positions: [{ title: "Head", employees: [] }],
  },
  {
    department: "Legal",
    positions: [{ title: "Legal", employees: [] }],
  },
  {
    department: "Internal Audit",
    positions: [{ title: "Internal Audit", employees: [] }],
  },
  {
    department: "Management",
    positions: [
      { title: "Director", employees: [] },
      { title: "Executive Assistant", employees: [] },
    ],
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

/** Built-in department → jabatan map (chart structure), for the User Management
 *  Add User / Kelola Departemen pickers. Names are excluded — those come from
 *  the user accounts. Derived from the base hierarchy so there's one source. */
export const builtInStructure = (): Record<string, string[]> =>
  Object.fromEntries(BASE_DEPARTMENTS.map((d) => [d.name, d.positions.map((p) => p.title)]));

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

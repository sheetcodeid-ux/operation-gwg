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

/** Built, id-stamped hierarchy derived from ORG_RAW. */
export const DEPARTMENTS: Department[] = ORG_RAW.map((d) => {
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

// ─── lookup maps (built once) ───
const DEPT_BY_ID = new Map(DEPARTMENTS.map((d) => [d.id, d]));
const POS_BY_ID = new Map<string, Position>();
const EMP_BY_ID = new Map<string, Employee>();
for (const d of DEPARTMENTS) {
  for (const p of d.positions) {
    POS_BY_ID.set(p.id, p);
    for (const e of p.employees) EMP_BY_ID.set(e.id, e);
  }
}

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

import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import Sidebar from "./components/Sidebar";
import TopNav from "./components/TopNav";
import MyProfilePage from "./components/MyProfilePage";
import AccountSettings from "./components/AccountSettings";
import AttendancePage from "./components/AttendancePage";
import OfficeLocationPage from "./components/OfficeLocationPage";
import ConfirmDeleteModal from "./components/ConfirmDeleteModal";
import DepartmentDeleteModal from "./components/DepartmentDeleteModal";

const API_URL = "http://localhost:8081/api/employees";

const EMPTY_FORM = { id: "", name: "", department: "", role: "", salary: "" };

function formatSalary(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getInitials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "EM"
  );
}

const AVATAR_COLORS = [
  "#3b82f6",
  "#ec4899",
  "#10b981",
  "#f97316",
  "#8b5cf6",
];

function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, accent }) {
  return (
    <div
      className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm flex items-center gap-4"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
        style={{ background: accent + "18" }}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

// ─── Employee Avatar ──────────────────────────────────────────────────────────
function EmployeeAvatar({ name }) {
  const color = avatarColor(name);
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow"
      style={{ background: color }}
    >
      {getInitials(name)}
    </div>
  );
}

// ─── Main authenticated app shell ────────────────────────────────────────────
function AppShell() {
  const { currentUser, can } = useAuth();

  // ── UI view state ──
  const [view, setView] = useState("login"); // "login" | "register" | "app"
  const goToRegister = () => setView("register");
  const goToLogin = () => setView("login");

  // Switch to app view when a user is authenticated
  useEffect(() => {
    if (currentUser) setView("app");
  }, [currentUser]);

 
  // Reset to login only when an authenticated session ends
  useEffect(() => {
    if (!currentUser && view === "app") {
      setView("login");
    }
  }, [currentUser, view]);


  // ── State ──
  const [employees, setEmployees] = useState([]);
  const [savedDepartments, setSavedDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All Departments");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [activePage, setActivePage] = useState("Overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [deletedEmployee, setDeletedEmployee] = useState(null);
  const [undoingDelete, setUndoingDelete] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingDepartmentDelete, setPendingDepartmentDelete] = useState(null);
  const [departmentDeleteError, setDepartmentDeleteError] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [departmentFormError, setDepartmentFormError] = useState("");
  const [deletedDepartment, setDeletedDepartment] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Data loading ──
  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [response, departmentsResponse] = await Promise.all([
        fetch(API_URL),
        fetch("http://localhost:8081/api/departments", {
          headers: {
            Authorization: `****** || ""}`,
          },
        }),
      ]);
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      if (!departmentsResponse.ok) {
        throw new Error(`Department request failed (${departmentsResponse.status})`);
      }
      const [data, departmentData] = await Promise.all([
        response.json(),
        departmentsResponse.json(),
      ]);
      if (!Array.isArray(data) || !Array.isArray(departmentData)) {
        throw new Error("Invalid employee or department API response.");
      }
      setEmployees(data);
      setSavedDepartments(departmentData);
    } catch (loadError) {
      console.error("Unable to load employees and departments:", loadError);
      setError(
        "Unable to load employees or departments. Make sure Spring Boot is running on port 8081."
      );
    } finally {
      setLoading(false);
    }
  }, [currentUser?.sessionToken]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  // Auto-dismiss notice
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  // ── Derived data ──
  const departments = useMemo(
    () => [...new Set([
      ...savedDepartments,
      ...employees.map((employee) => employee.department).filter(Boolean),
    ])].sort((a, b) => a.localeCompare(b)),
    [employees, savedDepartments]
  );
  const filteredDepartments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return departments.filter((department) =>
      department.toLowerCase().includes(query)
    );
  }, [departments, search]);
  const roles = useMemo(
    () => [...new Set(employees.map((e) => e.role).filter(Boolean))],
    [employees]
  );
  const averageSalary = employees.length
    ? employees.reduce((s, e) => s + Number(e.salary || 0), 0) / employees.length
    : 0;
  const canViewCompensation = currentUser?.role !== "EMPLOYEE";
  const managersCount = employees.filter((e) => /manager/i.test(e.role || "")).length;

  // ── Filtered list (role‑aware) ──
  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((e) => {
      const matchesSearch = `${e.name ?? ""} ${e.id ?? ""} ${e.department ?? ""} ${e.role ?? ""}`
        .toLowerCase()
        .includes(query);
      const matchesDept = departmentFilter === "All Departments" || e.department === departmentFilter;
      const matchesRole = roleFilter === "All Roles" || e.role === roleFilter;
      return matchesSearch && matchesDept && matchesRole;
    });
  }, [employees, search, departmentFilter, roleFilter, currentUser]);

  // ── Form handlers ──
  function openAddForm() {
    if (!can("addEmployee")) return;
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setNotice("");
    setModalOpen(true);
  }

  function openEditForm(employee) {
    if (!can("editEmployee")) return;
    setEditingId(employee.id);
    setForm({
      id: employee.id ?? "",
      name: employee.name ?? "",
      department: employee.department ?? "",
      role: employee.role ?? "",
      salary: String(employee.salary ?? ""),
    });
    setFormError("");
    setNotice("");
    setModalOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setModalOpen(false);
    setFormError("");
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((cur) => ({ ...cur, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setNotice("");
    const employeeId = form.id.trim();
    const employeeName = form.name.trim();
    const department = form.department.trim();
    const role = form.role.trim();
    const salary = Number(form.salary);
    if (!employeeId || !employeeName || !department || !role || form.salary === "") {
      setFormError("Please complete all fields.");
      return;
    }
    if (!Number.isFinite(salary) || salary < 0) {
      setFormError("Enter a valid, non‑negative salary.");
      return;
    }
    const payload = { id: employeeId, name: employeeName, department, role, salary };
    try {
      setSaving(true);
      const isEditing = editingId !== null;
      const url = isEditing ? `${API_URL}/${encodeURIComponent(editingId)}` : API_URL;
      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser?.sessionToken || ""}`,
        },
        body: JSON.stringify(payload),
      });
      if (response.status === 409) throw new Error("That employee ID already exists.");
      if (response.status === 404 && isEditing) throw new Error("Employee not found. Refresh and try again.");
      if (!response.ok) {
        const details = await response.text().catch(() => "");
        throw new Error(details || `Could not save employee (${response.status}).`);
      }
      setModalOpen(false);
      setDeletedEmployee(null);
      setNotice(isEditing ? "Employee updated successfully." : "Employee added successfully.");
      await loadEmployees();
    } catch (err) {
      setFormError(err.message || "Unexpected error.");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete handling ──
  function requestDelete(employee) {
    if (!can("deleteEmployee")) return;
    setPendingDelete(employee);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      setSaving(true);
      const response = await fetch(`${API_URL}/${encodeURIComponent(pendingDelete.id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${currentUser?.sessionToken || ""}`,
        },
      });
      if (!response.ok) throw new Error("Failed to delete employee.");
      setDeletedEmployee(pendingDelete);
      setNotice("Employee deleted. You can undo.");
      await loadEmployees();
    } catch (err) {
      setNotice(err.message || "Delete failed.");
    } finally {
      setSaving(false);
      setPendingDelete(null);
    }
  }

  async function confirmDepartmentDelete() {
    if (!pendingDepartmentDelete || !can("manageDepartments")) return;
    const { department, moveTo } = pendingDepartmentDelete;
    setSaving(true);
    setDepartmentDeleteError("");
    try {
      const response = await fetch(
        `http://localhost:8081/api/departments/${encodeURIComponent(department)}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `****** || ""}`,
          },
          body: JSON.stringify({ moveTo: moveTo || null }),
        }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `Could not remove department (${response.status}).`);
      }
      const deletion = await response.json();
      if (departmentFilter === department) setDepartmentFilter("All Departments");
      setDeletedDepartment(deletion);
      setDeletedEmployee(null);
      setPendingDepartmentDelete(null);
      setNotice(
        moveTo
          ? `${department} removed. Employees moved to ${moveTo}.`
          : `${department} removed.`
      );
      await loadEmployees();
    } catch (deleteError) {
      setDepartmentDeleteError(deleteError.message || "Unable to remove department.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUndoDepartment() {
    if (!deletedDepartment || saving) return;
    setSaving(true);
    setDepartmentDeleteError("");
    try {
      const response = await fetch(
        "http://localhost:8081/api/departments/undo-removal",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `****** || ""}`,
          },
          body: JSON.stringify(deletedDepartment),
        }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `Could not restore department (${response.status}).`);
      }
      setNotice(`${deletedDepartment.name} restored.`);
      setDeletedDepartment(null);
      await loadEmployees();
    } catch (undoError) {
      setDepartmentDeleteError(undoError.message || "Unable to restore department.");
    } finally {
      setSaving(false);
    }
  }

  async function addDepartment(event) {
    event.preventDefault();
    if (!can("manageDepartments")) return;
    setSaving(true);
    setDepartmentFormError("");
    try {
      const response = await fetch("http://localhost:8081/api/departments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `****** || ""}`,
        },
        body: JSON.stringify({ name: departmentName.trim() }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `Could not add department (${response.status}).`);
      }
      setSavedDepartments(await response.json());
      setDepartmentName("");
      setNotice("Department added.");
    } catch (addError) {
      setDepartmentFormError(addError.message || "Unable to add department.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUndo() {
    if (!deletedEmployee || undoingDelete) return;
    try {
      setUndoingDelete(true);
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser?.sessionToken || ""}`,
        },
        body: JSON.stringify(deletedEmployee),
      });
      if (!response.ok) throw new Error("Undo failed.");
      setDeletedEmployee(null);
      setNotice("Employee restored.");
      await loadEmployees();
    } catch (err) {
      setNotice(err.message || "Could not undo.");
    } finally {
      setUndoingDelete(false);
    }
  }

  // ─── Render: login / register ──────────────────────────────────────────────
  if (view === "login") {
    return <LoginPage onGoToRegister={goToRegister} />;
  }
  if (view === "register") {
    return <RegisterPage onGoToLogin={goToLogin} />;
  }

  // ─── Render: authenticated shell ──────────────────────────────────────────
  const mainMargin = sidebarCollapsed ? "72px" : "250px";

  return (
    <>
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        employeeCount={employees.length}
        onCollapse={setSidebarCollapsed}
      />

      {/* Main content */}
      <div
        id="main-content"
        style={{ marginLeft: mainMargin, transition: "margin-left 0.3s cubic-bezier(0.4,0,0.2,1)", minHeight: "100vh", background: "#f6f8fb" }}
      >
        <TopNav
          search={search}
          onSearchChange={setSearch}
          activePage={activePage}
          onGoToProfile={() => setActivePage("MyProfile")}
          onGoToSettings={() => setActivePage("Settings")}
        />

        {/* Toast notice */}
        {notice && (
          <div
            role="status"
            style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", zIndex: 9999 }}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-xl"
          >
            <span>✅ {notice}</span>
            {deletedEmployee && (
              <button
                type="button"
                onClick={handleUndo}
                disabled={undoingDelete}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {undoingDelete ? "Undoing…" : "Undo"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setNotice("");
              }}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none"
            >
              ×
            </button>
          </div>
        )}

        {/* ── OVERVIEW (Dashboard) ────────────────────────────────── */}
        {activePage === "Overview" && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Dashboard</h2>
              <p className="text-sm text-slate-500 mt-0.5">Welcome back, {currentUser?.name}.</p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total Employees" value={employees.length} icon="👥" accent="#1677f9" />
              <StatCard label="Departments" value={departments.length} icon="🏢" accent="#8b5cf6" />
              <StatCard label="Managers" value={managersCount} icon="🧑‍💼" accent="#f97316" />
              {canViewCompensation && (
                <StatCard label="Avg. Salary" value={formatSalary(averageSalary)} icon="💰" accent="#10b981" />
              )}
            </div>

            {/* Recent employees */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700">Recent Employees</h3>
                <button
                  type="button"
                  onClick={() => setActivePage("Employees")}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 transition"
                >
                  View all →
                </button>
              </div>
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
              ) : error ? (
                <div className="p-6 text-sm text-rose-600 bg-rose-50">{error}</div>
              ) : employees.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No employees yet.</div>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {employees.slice(0, 5).map((emp) => (
                    <li key={emp.id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition">
                      <EmployeeAvatar name={emp.name} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate">{emp.name}</p>
                        <p className="text-xs text-slate-400 truncate">{emp.department} · {emp.role}</p>
                      </div>
                      {canViewCompensation && (
                        <span className="text-xs font-medium text-slate-600 shrink-0">{formatSalary(emp.salary)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ── EMPLOYEES ───────────────────────────────────────────── */}
        {activePage === "Employees" && (
          <div className="p-6 space-y-4">
            {/* Header row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Employees</h2>
                <p className="text-sm text-slate-500 mt-0.5">{filteredEmployees.length} record{filteredEmployees.length !== 1 ? "s" : ""} found</p>
              </div>
              {can("addEmployee") && (
                <button
                  id="add-employee-btn"
                  type="button"
                  onClick={openAddForm}
                  className="flex items-center gap-2 rounded-xl bg-[#1677f9] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition"
                >
                  <span className="text-lg leading-none">+</span> Add Employee
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <select
                id="dept-filter"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-blue-400 transition"
              >
                <option>All Departments</option>
                {departments.map((d) => <option key={d}>{d}</option>)}
              </select>
              <select
                id="role-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-blue-400 transition"
              >
                <option>All Roles</option>
                {roles.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-semibold">Backend unavailable</p>
                  <p className="mt-0.5 text-xs text-rose-500">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={loadEmployees}
                  className="ml-auto rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Table */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                  <svg className="h-8 w-8 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span className="text-sm">Loading employees…</span>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="text-sm font-medium">No employees found</p>
                  <p className="text-xs mt-1">Try adjusting your search or filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-[#f8fafc]">
                        <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Employee</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">ID</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Department</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Role</th>
                        {canViewCompensation && (
                          <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">Salary</th>
                        )}
                        {(can("editEmployee") || can("deleteEmployee")) && (
                          <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredEmployees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-50 transition group">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <EmployeeAvatar name={emp.name} />
                              <span className="font-medium text-slate-800">{emp.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 font-mono text-xs text-slate-500">{emp.id}</td>
                          <td className="px-5 py-3">
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{emp.department}</span>
                          </td>
                          <td className="px-5 py-3 text-slate-600">{emp.role}</td>
                          {canViewCompensation && (
                            <td className="px-5 py-3 text-right font-medium text-slate-700">{formatSalary(emp.salary)}</td>
                          )}
                          {(can("editEmployee") || can("deleteEmployee")) && (
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                                {can("editEmployee") && (
                                  <button
                                    id={`edit-btn-${emp.id}`}
                                    type="button"
                                    onClick={() => openEditForm(emp)}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-300 hover:text-blue-600 shadow-sm transition"
                                  >
                                    Edit
                                  </button>
                                )}
                                {can("deleteEmployee") && (
                                  <button
                                    id={`delete-btn-${emp.id}`}
                                    type="button"
                                    onClick={() => requestDelete(emp)}
                                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100 shadow-sm transition"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activePage === "Attendance" && <AttendancePage search={search} />}
        {activePage === "OfficeLocation" && can("manageDepartments") && (
          <OfficeLocationPage />
        )}

        {/* ── DEPARTMENTS ─────────────────────────────────────────── */}
        {activePage === "Departments" && (
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Departments</h2>
              <p className="text-sm text-slate-500 mt-0.5">{departments.length} department{departments.length !== 1 ? "s" : ""} in the organisation</p>
            </div>

            {can("manageDepartments") && (
              <form
                className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                onSubmit={addDepartment}
              >
                <label className="min-w-56 flex-1 text-xs font-medium text-slate-600">
                  New department
                  <input
                    value={departmentName}
                    onChange={(event) => setDepartmentName(event.target.value)}
                    maxLength={100}
                    required
                    placeholder="e.g. Engineering"
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Add department"}
                </button>
                {departmentFormError && (
                  <p role="alert" className="w-full text-sm text-rose-700">
                    {departmentFormError}
                  </p>
                )}
              </form>
            )}

            {deletedDepartment && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <span>
                  {deletedDepartment.name} was removed.
                  {deletedDepartment.moveTo
                    ? ` Employees moved to ${deletedDepartment.moveTo}.`
                    : ""}
                </span>
                <button
                  type="button"
                  onClick={handleUndoDepartment}
                  disabled={saving}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                >
                  {saving ? "Restoring…" : "Undo removal"}
                </button>
              </div>
            )}

            {departmentDeleteError && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {departmentDeleteError}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading…</div>
            ) : departments.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-400">
                <div className="text-4xl mb-3">🏢</div>
                <p className="text-sm font-medium">No departments yet.</p>
                <p className="text-xs mt-1">Add a department or create an employee record.</p>
              </div>
            ) : filteredDepartments.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
                No departments match “{search}”.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredDepartments.map((dept, i) => {
                  const deptEmployees = employees.filter((e) => e.department === dept);
                  const avgSal = deptEmployees.length
                    ? deptEmployees.reduce((s, e) => s + Number(e.salary || 0), 0) / deptEmployees.length
                    : 0;
                  const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  return (
                    <div
                      key={dept}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition"
                      style={{ borderTop: `3px solid ${color}` }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
                          style={{ background: color }}
                        >
                          {dept[0]}
                        </div>
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                          <h3 className="truncate font-bold text-slate-800">{dept}</h3>
                          {can("manageDepartments") && (
                            <button
                              type="button"
                              onClick={() => {
                                const targets = departments.filter(
                                  (name) => name.toLowerCase() !== dept.toLowerCase()
                                );
                                setDepartmentDeleteError("");
                                setPendingDepartmentDelete({
                                  department: dept,
                                  moveTo: targets[0] || "",
                                  employeeCount: deptEmployees.length,
                                });
                              }}
                              className="shrink-0 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-slate-400 font-semibold uppercase tracking-wide text-[10px]">Employees</p>
                          <p className="text-slate-800 font-bold text-lg mt-0.5">{deptEmployees.length}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-slate-400 font-semibold uppercase tracking-wide text-[10px]">Avg Salary</p>
                          <p className="text-slate-800 font-bold text-sm mt-0.5">{formatSalary(avgSal)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activePage === "Reports" && (
          <div className="space-y-5 p-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800">HR Reports</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                A summary of employee headcount and department distribution.
              </p>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Total Employees" value={employees.length} icon="♟" accent="#1677f9" />
              <StatCard label="Departments" value={departments.length} icon="▦" accent="#8b5cf6" />
              <StatCard label="Managers" value={managersCount} icon="🧑‍💼" accent="#f97316" />
            </div>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="text-sm font-bold text-slate-800">
                  Headcount by department
                </h3>
              </div>
              {loading ? (
                <p className="p-6 text-sm text-slate-400">Loading report…</p>
              ) : departments.length === 0 ? (
                <p className="p-6 text-sm text-slate-400">
                  No department data is available yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Department</th>
                        <th className="px-5 py-3 text-right">Employees</th>
                        <th className="px-5 py-3 text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {departments.map((department) => {
                        const count = employees.filter(
                          (employee) => employee.department === department
                        ).length;
                        const share = employees.length
                          ? Math.round((count / employees.length) * 100)
                          : 0;
                        return (
                          <tr key={department}>
                            <td className="px-5 py-3 font-medium text-slate-800">
                              {department}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-600">
                              {count}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-600">
                              {share}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── MY PROFILE ──────────────────────────────────────────── */}
        {activePage === "MyProfile" && (
          <div className="p-6">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-800">My Profile</h2>
              <p className="text-sm text-slate-500 mt-0.5">Your account information.</p>
            </div>
            <MyProfilePage employees={employees} />
          </div>
        )}

        {activePage === "Settings" && (
          <div className="p-6">
            <AccountSettings />
          </div>
        )}
      </div>

      {/* ── Add / Edit form modal ──────────────────────────────────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-bold text-slate-800">
                {editingId ? "Edit Employee" : "Add Employee"}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4" noValidate>
              {[
                { label: "Employee ID", name: "id", type: "text", placeholder: "e.g. E001", disabled: editingId !== null },
                { label: "Full Name",   name: "name", type: "text", placeholder: "e.g. Arun Kumar" },
                { label: "Department",  name: "department", type: "text", placeholder: "e.g. Engineering" },
                { label: "Role / Title",name: "role", type: "text", placeholder: "e.g. Software Engineer" },
                { label: "Salary (INR)",name: "salary", type: "number", placeholder: "e.g. 750000" },
              ].map((f) => (
                <div key={f.name}>
                  <label
                    htmlFor={`form-${f.name}`}
                    className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide"
                  >
                    {f.label}
                  </label>
                  <input
                    id={`form-${f.name}`}
                    name={f.name}
                    type={f.type}
                    value={form[f.name]}
                    onChange={handleFormChange}
                    placeholder={f.placeholder}
                    disabled={f.disabled || saving}
                    className="w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 disabled:opacity-50 transition"
                  />
                </div>
              ))}

              {formError && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
                >
                  Cancel
                </button>
                <button
                  id="form-save-btn"
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-[#1677f9] py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60 transition"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Saving…
                    </span>
                  ) : editingId ? "Save Changes" : "Add Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm delete modal ─────────────────────────────────────────── */}
      <ConfirmDeleteModal
        isOpen={!!pendingDelete}
        employee={pendingDelete}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <DepartmentDeleteModal
        department={pendingDepartmentDelete?.department}
        departments={departments}
        moveTo={pendingDepartmentDelete?.moveTo || ""}
        employeeCount={pendingDepartmentDelete?.employeeCount || 0}
        error={departmentDeleteError}
        saving={saving}
        onMoveToChange={(moveTo) =>
          setPendingDepartmentDelete((current) => current
            ? { ...current, moveTo }
            : current)
        }
        onConfirm={confirmDepartmentDelete}
        onCancel={() => {
          setPendingDepartmentDelete(null);
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = "http://localhost:8081/api/employees";

const EMPTY_FORM = {
  id: "",
  name: "",
  department: "",
  role: "",
  salary: "",
};

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
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "EM";
}

function App() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All Departments");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [activePage, setActivePage] = useState("Employees");
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

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error("The API response was not an employee list.");
      }

      setEmployees(data);
    } catch (err) {
      setError(
        "Unable to load employees. Make sure Spring Boot is running on port 8081 and the API is available."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesSearch = `${employee.name ?? ""} ${employee.id ?? ""} ${employee.department ?? ""} ${employee.role ?? ""}`
        .toLowerCase()
        .includes(query);
      const matchesDepartment = departmentFilter === "All Departments" || employee.department === departmentFilter;
      const matchesRole = roleFilter === "All Roles" || employee.role === roleFilter;
      return matchesSearch && matchesDepartment && matchesRole;
    });
  }, [employees, search, departmentFilter, roleFilter]);

  const departments = useMemo(
    () => [...new Set(employees.map((employee) => employee.department).filter(Boolean))],
    [employees]
  );

  const averageSalary = employees.length
    ? employees.reduce((sum, employee) => sum + Number(employee.salary || 0), 0) /
      employees.length
    : 0;

  function openAddForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setNotice("");
    setModalOpen(true);
  }

  function openEditForm(employee) {
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

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
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
      setFormError("Enter a valid, non-negative salary.");
      return;
    }

    const payload = {
      id: employeeId,
      name: employeeName,
      department,
      role,
      salary,
    };

    try {
      setSaving(true);
      const isEditing = editingId !== null;
      const url = isEditing
        ? `${API_URL}/${encodeURIComponent(editingId)}`
        : API_URL;

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 409) {
        throw new Error("That employee ID already exists. Choose a different ID.");
      }
      if (response.status === 404 && isEditing) {
        throw new Error("This employee was not found. Refresh the employee list and try again.");
      }
      if (!response.ok) {
        const details = await response.text().catch(() => "");
        throw new Error(details || `Could not save employee (${response.status}).`);
      }

      setModalOpen(false);
      setDeletedEmployee(null);
      setNotice(isEditing ? "Employee updated successfully." : "Employee added successfully.");
      await loadEmployees();
    } catch (err) {
      setFormError(
        err.message ||
          "Could not save the employee. Check the backend and try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(employee) {
    const confirmed = window.confirm(
      `Delete ${employee.name} (${employee.id})? You can use Undo after deletion to restore this record.`
    );
    if (!confirmed) return;

    setNotice("");
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(employee.id)}`,
        { method: "DELETE" }
      );

      if (response.status === 404) {
        throw new Error("Employee not found. Refresh the list and try again.");
      }
      if (!response.ok) {
        throw new Error(`Could not delete employee (${response.status}).`);
      }

      setDeletedEmployee(employee);
      setNotice(`${employee.name} was deleted.`);
      await loadEmployees();
    } catch (err) {
      setError(err.message || "Could not delete the employee.");
    }
  }

  async function handleUndoDelete() {
    if (!deletedEmployee || undoingDelete) return;

    setUndoingDelete(true);
    setError("");
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deletedEmployee),
      });

      if (response.status === 409) {
        throw new Error("That employee ID is already in use, so the record could not be restored.");
      }
      if (!response.ok) {
        const details = await response.text().catch(() => "");
        throw new Error(details || `Could not restore employee (${response.status}).`);
      }

      const restoredName = deletedEmployee.name;
      setDeletedEmployee(null);
      setNotice(`${restoredName} was restored successfully.`);
      await loadEmployees();
    } catch (err) {
      setError(err.message || "Could not restore the employee. Please try again.");
    } finally {
      setUndoingDelete(false);
    }
  }

  const roles = useMemo(
    () => [...new Set(employees.map((employee) => employee.role).filter(Boolean))],
    [employees]
  );
  const managersCount = employees.filter((employee) => /manager/i.test(employee.role || "")).length;

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[178px] flex-col bg-[#0b2038] text-white md:flex">
        <div className="flex h-[62px] items-center gap-2 px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1677f9] text-sm font-extrabold">B</div>
          <div className="text-[17px] font-bold tracking-tight">Beeta<span className="text-sky-400">Logic</span></div>
        </div>
        <nav className="mt-5 space-y-1 px-2">
          {[
            { name: "Overview", label: "Dashboard", icon: "⌂" },
            { name: "Employees", label: "Employees", icon: "♟" },
            { name: "Departments", label: "Departments", icon: "▦" },
          ].map((item) => (
            <button key={item.name} type="button" onClick={() => setActivePage(item.name)}
              className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[12px] transition ${activePage === item.name ? "bg-[#1478f8] font-semibold text-white shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
              <span className="w-5 text-center text-lg">{item.icon}</span><span>{item.label}</span>
              {item.name === "Employees" && <span className="ml-auto rounded bg-white/15 px-1.5 py-0.5 text-[10px]">{employees.length}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6096ff] text-[11px] font-bold">AU</div>
            <div className="min-w-0"><p className="truncate text-[11px] font-semibold">Admin User</p><p className="text-[10px] text-slate-400">HR Administrator</p></div>
          </div>
        </div>
      </aside>

      <div className="md:ml-[178px]">
        <header className="sticky top-0 z-20 flex h-[54px] items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur md:px-6">
          <label className="flex h-8 w-full max-w-[430px] items-center gap-2 rounded-md bg-[#f0f4f9] px-3 text-slate-400">
            <span className="text-base">⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search anything..." aria-label="Search anything" className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400" />
          </label>
          <div className="ml-4 flex items-center gap-4">
            <button type="button" aria-label="Notifications" title="Notifications" className="relative text-lg text-slate-500">♧<span className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-rose-500" /></button>
            <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7da8ff] text-[10px] font-semibold text-white">AU</div><span className="hidden text-[11px] font-medium text-slate-700 sm:inline">Admin User</span><span className="text-xs text-slate-500">⌄</span></div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-7">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-[25px] font-bold leading-tight tracking-tight text-[#101a35] sm:text-[28px]">Employee Management</h1>
              <p className="mt-1 text-[13px] text-slate-500">Manage your people, roles, and team information.</p>
            </div>
            <button type="button" onClick={openAddForm} className="inline-flex h-[38px] items-center justify-center gap-2 self-start rounded-lg bg-[#1478f8] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"><span className="text-lg leading-none">＋</span> Add Employee</button>
          </div>

          {notice && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><span>{notice}</span><div className="flex items-center gap-3">{deletedEmployee && <button type="button" onClick={handleUndoDelete} disabled={undoingDelete} className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60">{undoingDelete ? "Restoring…" : "↶ Undo delete"}</button>}<button type="button" onClick={() => { setNotice(""); setDeletedEmployee(null); }} aria-label="Dismiss">×</button></div></div>}
          {error && <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{error}</span><button type="button" onClick={loadEmployees} className="font-semibold underline">Retry</button></div>}

          {activePage !== "Departments" && <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { title: "Total Employees", value: employees.length, icon: "♟", iconBg: "bg-blue-100 text-blue-600", note: "Current employee records" },
              { title: "Departments", value: departments.length, icon: "▦", iconBg: "bg-emerald-100 text-emerald-600", note: "Across the organization" },
              { title: "Managers", value: managersCount, icon: "♙", iconBg: "bg-orange-100 text-orange-600", note: employees.length ? `${Math.round((managersCount / employees.length) * 100)}% of total employees` : "No employee records yet" },
              { title: "Average Salary", value: formatSalary(averageSalary), icon: "▤", iconBg: "bg-violet-100 text-violet-600", note: "Based on current records" },
            ].map((card) => <article key={card.title} className="min-h-[98px] rounded-lg border border-slate-200/80 bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.03)]">
              <div className="flex items-center gap-3"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${card.iconBg}`}>{card.icon}</div><div className="min-w-0"><p className="text-[11px] text-slate-500">{card.title}</p><p className="mt-1 text-[21px] font-bold leading-none tracking-tight text-[#101a35]">{card.value}</p><p className="mt-2 text-[10px] text-slate-400">{card.note}</p></div></div>
            </article>)}
          </section>}

          {activePage === "Departments" ? <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-[#101a35]">Departments</h2><p className="mt-1 text-xs text-slate-500">A summary of the teams in your organization.</p>
            {departments.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No departments found. Add an employee to get started.</p> : <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{departments.map((department) => { const count = employees.filter((employee) => employee.department === department).length; return <div key={department} className="rounded-lg border border-slate-200 p-5"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-lg text-blue-600">▦</div><h3 className="mt-3 font-semibold">{department}</h3><p className="mt-1 text-sm text-slate-500">{count} {count === 1 ? "employee" : "employees"}</p><button type="button" onClick={() => { setDepartmentFilter(department); setActivePage("Employees"); }} className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-800">View employees →</button></div>; })}</div>}
          </section> : <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_5px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:px-5"><div><h2 className="text-[17px] font-bold tracking-tight text-[#101a35]">All Employees</h2><p className="mt-1 text-xs text-slate-500">A complete list of your organization's employees.</p></div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(200px,1fr)_180px_170px]">
                <label className="flex h-[35px] items-center gap-2 rounded-md border border-slate-200 px-3 text-slate-400"><span className="text-base">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees..." aria-label="Search employees" className="w-full text-xs outline-none placeholder:text-slate-400" /></label>
                <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label="Filter by department" className="h-[35px] rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-400"><option>All Departments</option>{departments.map((department) => <option key={department}>{department}</option>)}</select>
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by role" className="h-[35px] rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-400"><option>All Roles</option>{roles.map((role) => <option key={role}>{role}</option>)}</select>
              </div>
            </div>
            <div className="overflow-x-auto px-4 pb-1 sm:px-5"><table className="w-full min-w-[760px] border-collapse text-left text-xs"><thead><tr className="bg-[#f1f4f8] text-[9px] font-bold uppercase tracking-wide text-slate-500"><th className="rounded-l-md px-4 py-3">Employee</th><th className="px-3 py-3">Employee ID</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Role</th><th className="px-3 py-3 text-right">Salary</th><th className="rounded-r-md px-3 py-3 text-center">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{loading && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Loading employees…</td></tr>}
                {!loading && !error && filteredEmployees.map((employee, index) => <tr key={employee.id} className="transition hover:bg-blue-50/40"><td className="px-4 py-2"><div className="flex items-center gap-3"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${["bg-blue-100 text-blue-700", "bg-pink-100 text-pink-700", "bg-emerald-100 text-emerald-700", "bg-orange-100 text-orange-700", "bg-violet-100 text-violet-700"][index % 5]}`}>{getInitials(employee.name)}</div><div><p className="font-semibold text-slate-800">{employee.name}</p><p className="mt-0.5 text-[10px] text-slate-400">{`${String(employee.name || "").toLowerCase().replace(/\s+/g, ".")}@beetalogic.com`}</p></div></div></td><td className="px-3 py-3 font-medium text-slate-700">{employee.id}</td><td className="px-3 py-3 text-slate-700">{employee.department}</td><td className="px-3 py-3 text-slate-700">{employee.role}</td><td className="px-3 py-3 text-right font-medium text-slate-800">{formatSalary(employee.salary)}</td><td className="px-3 py-2"><div className="flex justify-center gap-1.5"><button type="button" onClick={() => openEditForm(employee)} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">Edit</button><button type="button" onClick={() => handleDelete(employee)} className="rounded-md border border-rose-200 px-2.5 py-1.5 text-[10px] font-semibold text-rose-600 hover:bg-rose-50">Delete</button></div></td></tr>)}
                {!loading && !error && filteredEmployees.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center"><p className="font-semibold text-slate-700">No employees found</p><p className="mt-1 text-xs text-slate-500">Try another search or change the filters.</p></td></tr>}
              </tbody></table></div>
            <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-3 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between"><span>Showing {loading ? "…" : filteredEmployees.length} of {employees.length} employees</span><button type="button" onClick={() => { setSearch(""); setDepartmentFilter("All Departments"); setRoleFilter("All Roles"); }} className="self-start font-semibold text-blue-600 hover:text-blue-800">Clear filters</button></div>
          </section>}
          <p className="mt-5 text-center text-[10px] text-slate-400">BeetaLogic · Employee Management System</p>
        </main>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-form-title"
            className="my-8 w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 id="employee-form-title" className="text-xl font-bold text-slate-900">
                  {editingId !== null ? "Update employee" : "Add employee"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {editingId !== null ? "Edit the employee details below." : "Enter the new employee details."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg px-3 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                aria-label="Close form"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Employee ID
                  <input
                    name="id"
                    value={form.id}
                    onChange={handleFormChange}
                    disabled={editingId !== null || saving}
                    required
                    maxLength={30}
                    placeholder="e.g. D04"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Full name
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleFormChange}
                    disabled={saving}
                    required
                    maxLength={100}
                    placeholder="e.g. Arun Kumar"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Department
                  <input
                    name="department"
                    value={form.department}
                    onChange={handleFormChange}
                    disabled={saving}
                    required
                    maxLength={80}
                    placeholder="e.g. IT"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Role
                  <input
                    name="role"
                    value={form.role}
                    onChange={handleFormChange}
                    disabled={saving}
                    required
                    maxLength={100}
                    placeholder="e.g. Developer"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                  Monthly salary (₹)
                  <input
                    name="salary"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.salary}
                    onChange={handleFormChange}
                    disabled={saving}
                    required
                    placeholder="e.g. 35000"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
              </div>

              {formError && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {formError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving…" : editingId !== null ? "Save changes" : "Add employee"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;

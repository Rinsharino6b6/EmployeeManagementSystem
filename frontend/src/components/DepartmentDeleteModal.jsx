export default function DepartmentDeleteModal({
  department,
  departments,
  moveTo,
  employeeCount,
  error,
  saving,
  onMoveToChange,
  onConfirm,
  onCancel,
}) {
  if (!department) return null;

  const targets = departments.filter(
    (name) => name.toLowerCase() !== department.toLowerCase()
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-department-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h3
          id="delete-department-title"
          className="text-lg font-bold text-slate-900"
        >
          Remove {department} department?
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Employees will stay in the system and be moved to the department you choose.
        </p>

        {targets.length > 0 ? (
          <label className="mt-4 block text-xs font-semibold text-slate-600">
            Move employees to
            <select
              value={moveTo}
              onChange={(event) => onMoveToChange(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-700"
            >
              {targets.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        ) : employeeCount > 0 ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Add another department before removing this one so employees can be moved safely.
          </p>
        ) : null}

        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving || (employeeCount > 0 && (targets.length === 0 || !moveTo))}
            className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Removing…" : "Remove department"}
          </button>
        </div>
      </div>
    </div>
  );
}

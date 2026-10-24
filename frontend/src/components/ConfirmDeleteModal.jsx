export default function ConfirmDeleteModal({ employee, onConfirm, onCancel }) {
  if (!employee) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
      >
        {/* Icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-2xl mb-4">
          🗑️
        </div>
        <h3 id="delete-dialog-title" className="text-center text-lg font-bold text-slate-900">
          Delete Employee?
        </h3>
        <p className="mt-2 text-center text-sm text-slate-500">
          You are about to delete <span className="font-semibold text-slate-800">{employee.name}</span>{" "}
          <span className="text-slate-400">({employee.id})</span>. This action can be undone immediately after.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            id="delete-cancel-btn"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            id="delete-confirm-btn"
            onClick={() => onConfirm(employee)}
            className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition shadow-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

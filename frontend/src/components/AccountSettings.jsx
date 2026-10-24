import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function AccountSettings() {
  const { currentUser, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 8) {
      setError("Your new password must contain at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new password and confirmation do not match.");
      return;
    }

    setSaving(true);
    try {
      const result = await changePassword({ currentPassword, newPassword });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(result.message || "Password updated successfully.");
    } catch (saveError) {
      console.error("Unable to update account password:", saveError);
      setError("Unable to update your password. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function togglePasswordVisibility(field) {
    setVisiblePasswords((previous) => ({
      ...previous,
      [field]: !previous[field],
    }));
  }

  function passwordInput({
    id,
    field,
    label,
    value,
    onChange,
    autoComplete,
    minLength,
    maxLength,
  }) {
    const visible = visiblePasswords[field];
    const toggleLabel = `${visible ? "Hide" : "Show"} ${label.toLowerCase()}`;

    return (
      <div>
        <label
          htmlFor={id}
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
        <div className="relative">
          <input
            id={id}
            type={visible ? "text" : "password"}
            autoComplete={autoComplete}
            value={value}
            onChange={onChange}
            minLength={minLength}
            maxLength={maxLength}
            required
            className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={() => togglePasswordVisibility(field)}
            aria-label={toggleLabel}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-500 transition hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Account Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your sign-in details and account security.
        </p>
      </header>

      {message && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {message}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-slate-900">Account</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Username
            </dt>
            <dd className="mt-1 break-all text-sm text-slate-800">
              {currentUser?.username || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Email
            </dt>
            <dd className="mt-1 break-all text-sm text-slate-800">
              {currentUser?.email || "—"}
            </dd>
          </div>
        </dl>
      </section>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div>
          <h2 className="text-lg font-bold text-slate-900">Change password</h2>
          <p className="mt-1 text-sm text-slate-500">
            Your password is verified and stored by the backend as a secure
            one-way hash; it is never saved in browser storage.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            {passwordInput({
              id: "settings-current-password",
              field: "current",
              label: "Current password",
              value: currentPassword,
              onChange: (event) => setCurrentPassword(event.target.value),
              autoComplete: "current-password",
            })}
          </div>
          <div>
            {passwordInput({
              id: "settings-new-password",
              field: "new",
              label: "New password",
              value: newPassword,
              onChange: (event) => setNewPassword(event.target.value),
              autoComplete: "new-password",
              minLength: 8,
              maxLength: 72,
            })}
          </div>
          <div>
            {passwordInput({
              id: "settings-confirm-password",
              field: "confirm",
              label: "Confirm new password",
              value: confirmPassword,
              onChange: (event) => setConfirmPassword(event.target.value),
              autoComplete: "new-password",
              minLength: 8,
              maxLength: 72,
            })}
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-5">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Update Password"}
          </button>
        </div>
      </form>
    </div>
  );
}
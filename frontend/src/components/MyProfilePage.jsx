import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

function formatSalary(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const ROLE_BADGE = {
  ADMIN: {
    label: "Administrator",
    cls: "bg-violet-100 text-violet-700 border-violet-200",
  },
  HR_MANAGER: {
    label: "HR Manager",
    cls: "bg-sky-100 text-sky-700 border-sky-200",
  },
  EMPLOYEE: {
    label: "Employee",
    cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
};

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

export default function MyProfilePage({ employees = [] }) {
  const { currentUser, updateProfile, linkEmployeeRecord, getRoleLabel } = useAuth();

  const fileInputRef = useRef(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(
    currentUser?.employeeId ?? ""
  );
  const [selectedAccountId, setSelectedAccountId] = useState(
    currentUser?.databaseId ?? ""
  );
  const [accounts, setAccounts] = useState([]);
  const [linking, setLinking] = useState(false);

  const [form, setForm] = useState(() => ({
    name: currentUser?.name ?? "",
    email: currentUser?.email ?? "",
    department: currentUser?.department ?? "",
    profilePicture: currentUser?.profilePicture ?? "",
  }));

  const canLinkEmployee = ["ADMIN", "HR_MANAGER"].includes(currentUser?.role);

  useEffect(() => {
    if (!canLinkEmployee || !currentUser?.sessionToken) return;

    fetch("http://localhost:8081/api/users", {
      headers: { Authorization: `Bearer ${currentUser.sessionToken}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || data.detail || "Unable to load accounts.");
        }
        setAccounts(data);
      })
      .catch((loadError) => {
        console.error("Unable to load login accounts:", loadError);
        setError("Unable to load login accounts for employee linking.");
      });
  }, [canLinkEmployee, currentUser?.sessionToken]);

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        Please sign in to view your profile.
      </div>
    );
  }

  const record = currentUser.employeeId
    ? employees.find(
        (employee) =>
          String(employee.id) === String(currentUser.employeeId)
      )
    : null;

  const badge = ROLE_BADGE[currentUser.role];

  function handleAccountChange(event) {
    const accountId = event.target.value;
    setSelectedAccountId(accountId);
    const selectedAccount = accounts.find(
      (account) => String(account.id) === accountId
    );
    setSelectedEmployeeId(selectedAccount?.employeeId ?? "");
  }

  async function handleEmployeeLink(event) {
    event.preventDefault();
    setLinking(true);
    setError("");
    setMessage("");

    try {
      const result = await linkEmployeeRecord(
        selectedAccountId,
        selectedEmployeeId || null
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAccounts((previous) =>
        previous.map((account) =>
          String(account.id) === String(selectedAccountId)
            ? { ...account, employeeId: selectedEmployeeId || null }
            : account
        )
      );

      setMessage(
        selectedEmployeeId
          ? "Employee record linked successfully."
          : "Employee record unlinked successfully."
      );
    } catch (linkError) {
      console.error("Unable to link employee record:", linkError);
      setError("Unable to update the employee link. Please try again.");
    } finally {
      setLinking(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setMessage("");
    setError("");
  }

  function handleCancel() {
    setForm({
      name: currentUser.name ?? "",
      email: currentUser.email ?? "",
      department: currentUser.department ?? "",
      profilePicture: currentUser.profilePicture ?? "",
    });

    setEditing(false);
    setError("");
    setMessage("");
  }

  // Resize the photo before sending it to the profile API.
  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError("Please choose an image smaller than 2 MB.");
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Unable to read image."));

        reader.readAsDataURL(file);
      });

      const image = await new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Unable to process image."));

        img.src = dataUrl;
      });

      const canvas = document.createElement("canvas");
      const maxDimension = 400;

      const scale = Math.min(
        1,
        maxDimension / Math.max(image.width, image.height)
      );

      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Unable to process the selected image.");
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const compressedPhoto = canvas.toDataURL("image/jpeg", 0.8);

      setForm((previous) => ({
        ...previous,
        profilePicture: compressedPhoto,
      }));

      setMessage("");
      setError("");
    } catch {
      setError("Could not process this photo. Please try another image.");
    }

    event.target.value = "";
  }

  function handleRemovePhoto() {
    setForm((previous) => ({
      ...previous,
      profilePicture: "",
    }));
    setMessage("");
    setError("");
  }

  async function handleSave(event) {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim()) {
      setError("Full name and email are required.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await updateProfile({
        name: form.name.trim(),
        email: form.email.trim(),
        department: form.department.trim(),
        profilePicture: form.profilePicture,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setEditing(false);
      setMessage("Your profile has been updated successfully.");
    } catch (saveError) {
      console.error("Unable to save profile changes:", saveError);
      setError("Unable to save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const displayedName = editing ? form.name : currentUser.name;
  const displayedPhoto = editing
    ? form.profilePicture
    : currentUser.profilePicture;

  const infoFields = [
    {
      label: "Full Name",
      value: record?.name ?? currentUser.name ?? "—",
    },
    {
      label: "Employee ID",
      value: record?.id ?? currentUser.employeeId ?? "Not linked",
    },
    {
      label: "Department",
      value: record?.department ?? currentUser.department ?? "—",
    },
    {
      label: "Job Title",
      value: record?.role ?? "Not assigned",
    },
    {
      label: "Email Address",
      value: currentUser.email ?? "—",
    },
    {
      label: "Salary",
      value: record ? formatSalary(record.salary) : "Confidential",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Profile heading */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            My Profile
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your personal information and profile photo.
          </p>
        </div>

        {!editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setMessage("");
              setError("");
            }}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Edit Profile
          </button>
        )}
      </div>

      {/* Success and error messages */}
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

      {/* Profile header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative mx-auto sm:mx-0">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-blue-500 to-blue-700 text-3xl font-bold text-white shadow-lg ring-1 ring-slate-200">
              {displayedPhoto ? (
                <img
                  src={displayedPhoto}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                currentUser.avatar || "?"
              )}
            </div>

            {editing && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Change profile photo"
                aria-label="Change profile photo"
                className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-lg text-white shadow-md transition hover:bg-blue-700"
              >
                <span aria-hidden="true">📷</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h2 className="break-words text-xl font-bold text-slate-900">
              {displayedName || currentUser.username}
            </h2>

            <p className="mt-1 break-all text-sm text-slate-500">
              {currentUser.email}
            </p>

            {badge && (
              <span
                className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badge.cls}`}
              >
                {badge.label}
              </span>
            )}

            {editing && (
              <div className="mt-3 flex flex-wrap justify-center gap-3 sm:justify-start">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                >
                  Change photo
                </button>

                {form.profilePicture && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-sm font-semibold text-rose-600 hover:text-rose-800"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            )}

            <p className="mt-3 text-xs text-slate-400">
              Username: {currentUser.username}
            </p>
          </div>
        </div>
      </section>

      {/* Edit form */}
      {editing ? (
        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <h3 className="mb-1 text-lg font-bold text-slate-900">
            Edit personal information
          </h3>

          <p className="mb-6 text-sm text-slate-500">
            Update your details and save your changes.
          </p>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="profile-name"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Full Name *
              </label>

              <input
                id="profile-name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                maxLength={100}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="profile-email"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Email Address *
              </label>

              <input
                id="profile-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                maxLength={150}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="profile-department"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Department
              </label>

              <input
                id="profile-department"
                name="department"
                value={form.department}
                onChange={handleChange}
                maxLength={100}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <p className="mt-2 text-xs text-slate-400">
                This updates your account profile. Your official employee
                record may still be managed by HR.
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      ) : (
        /* Read-only profile information */
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h3 className="mb-1 text-lg font-bold text-slate-900">
            Profile Information
          </h3>

          <p className="mb-6 text-sm text-slate-500">
            Your account and employee details.
          </p>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {infoFields.map((field) => (
              <div
                key={field.label}
                className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {field.label}
                </dt>

                <dd className="mt-2 break-words text-sm font-semibold text-slate-800">
                  {field.value}
                </dd>
              </div>
            ))}

            <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Account Role
              </dt>

              <dd className="mt-2 text-sm font-semibold text-slate-800">
                {getRoleLabel
                  ? getRoleLabel(currentUser.role)
                  : currentUser.role}
              </dd>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Member Since
              </dt>

              <dd className="mt-2 text-sm font-semibold text-slate-800">
                {currentUser.createdAt
                  ? new Date(currentUser.createdAt).toLocaleDateString(
                      "en-IN",
                      {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }
                    )
                  : "—"}
              </dd>
            </div>
          </dl>

          {!record && currentUser.role === "EMPLOYEE" && (
            <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Your account is not linked to an official employee record.
              Contact HR to complete your employee profile setup.
            </p>
          )}

          {canLinkEmployee && (
            <form
              onSubmit={handleEmployeeLink}
              className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4"
            >
              <label
                htmlFor="employee-account-link"
                className="block text-sm font-semibold text-slate-800"
              >
                Manage login account and employee-record links
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Select a login account and its official employee record. Each
                employee record can be linked to only one login account.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  aria-label="Login account"
                  value={selectedAccountId}
                  onChange={handleAccountChange}
                  disabled={linking}
                  className="min-w-60 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.fullName} — {account.email} ({account.role})
                    </option>
                  ))}
                </select>
                <select
                  id="employee-account-link"
                  value={selectedEmployeeId}
                  onChange={(event) => setSelectedEmployeeId(event.target.value)}
                  disabled={linking || !selectedAccountId}
                  className="min-w-60 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Not linked</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.id} — {employee.name} ({employee.department})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={
                    linking ||
                    !selectedAccountId ||
                    selectedEmployeeId ===
                      (accounts.find(
                        (account) => String(account.id) === String(selectedAccountId)
                      )?.employeeId ?? "")
                  }
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {linking ? "Saving..." : "Save link"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
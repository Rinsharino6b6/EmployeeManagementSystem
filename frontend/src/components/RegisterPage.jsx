import { useState } from "react";
import { useAuth, ROLES } from "../context/AuthContext";

const ROLE_OPTIONS = [
  {
    value: ROLES.EMPLOYEE,
    label: "Employee",
    desc: "Standard access — view your own profile and record.",
    needsPasscode: false,
    icon: "👤",
    color: "border-emerald-500/40 bg-emerald-500/5 text-emerald-300",
    selectedColor: "border-emerald-400 bg-emerald-500/15",
  },
  {
    value: ROLES.HR_MANAGER,
    label: "HR Manager",
    desc: "HR access — manage employees and departments.",
    needsPasscode: true,
    passcodePlaceholder: "e.g. HR100001",
    passcodeHint: "Format: HR followed by 6 digits (provided by Admin)",
    icon: "🧑‍💼",
    color: "border-sky-500/40 bg-sky-500/5 text-sky-300",
    selectedColor: "border-sky-400 bg-sky-500/15",
  },
  {
    value: ROLES.ADMIN,
    label: "Administrator",
    desc: "Full access — manage users, roles, and all data.",
    needsPasscode: true,
    passcodePlaceholder: "e.g. ADMIN0001",
    passcodeHint: "Format: ADMIN followed by 4 digits (provisioned by IT)",
    icon: "🔐",
    color: "border-violet-500/40 bg-violet-500/5 text-violet-300",
    selectedColor: "border-violet-400 bg-violet-500/15",
  },
];

function PasswordStrength({ password }) {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8)           score++;
  if (/[A-Z]/.test(password))         score++;
  if (/[0-9]/.test(password))         score++;
  if (/[^A-Za-z0-9]/.test(password))  score++;

  const bars   = [1, 2, 3, 4];
  const colors = ["bg-rose-500", "bg-orange-400", "bg-yellow-400", "bg-emerald-400"];
  const labels = ["Weak", "Fair", "Good", "Strong"];

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="flex gap-1 flex-1">
        {bars.map(b => (
          <div
            key={b}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              b <= score ? colors[score - 1] : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <span className={`text-[10px] font-semibold ${colors[score - 1]?.replace("bg-", "text-") ?? "text-slate-500"}`}>
        {labels[score - 1] ?? ""}
      </span>
    </div>
  );
}

export default function RegisterPage({ onGoToLogin }) {
  const { register, regError, setRegError } = useAuth();
  const [step, setStep] = useState(1); // 1 = basic info, 2 = role + passcode
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [showPwd, setShowPwd]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Form fields
  const [fullName,    setFullName]    = useState("");
  const [username,    setUsername]    = useState("");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [confirmPwd,  setConfirmPwd]  = useState("");
  const [department,  setDepartment]  = useState("");
  const [role,        setRole]        = useState(ROLES.EMPLOYEE);
  const [passcode,    setPasscode]    = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  function clearFieldError(field) {
    setFieldErrors(e => { const n = {...e}; delete n[field]; return n; });
    setRegError("");
  }

  // Validate step 1
  function validateStep1() {
    const errors = {};
    if (!fullName.trim())         errors.fullName   = "Full name is required.";
    else if (fullName.trim().length > 100) errors.fullName = "Full name must be 100 characters or fewer.";
    if (!username.trim())         errors.username   = "Username is required.";
    else if (username.trim().length < 3) errors.username = "Username must be at least 3 characters.";
    else if (username.trim().length > 50) errors.username = "Username must be 50 characters or fewer.";
    else if (/\s/.test(username)) errors.username   = "Username cannot contain spaces.";
    if (!email.trim())            errors.email      = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
    else if (email.trim().length > 150) errors.email = "Email must be 150 characters or fewer.";
    if (!password)                errors.password   = "Password is required.";
    else if (password.length < 8) errors.password   = "Password must be at least 8 characters.";
    else if (password.length > 72) errors.password = "Password must be 72 characters or fewer.";
    if (!confirmPwd)              errors.confirmPwd = "Please confirm your password.";
    else if (confirmPwd !== password) errors.confirmPwd = "Passwords do not match.";
    if (!department.trim())       errors.department = "Department is required.";
    else if (department.trim().length > 100) errors.department = "Department must be 100 characters or fewer.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleNextStep(e) {
    e.preventDefault();
    if (validateStep1()) setStep(2);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const selectedOpt = ROLE_OPTIONS.find(o => o.value === role);
    if (selectedOpt?.needsPasscode && !passcode.trim()) {
      setFieldErrors({ passcode: "Passcode is required for this role." });
      return;
    }
    setLoading(true);
    try {
      const result = await register({
        fullName,
        username,
        email,
        password,
        department,
        role,
        passcode,
      });
      if (result.ok) {
        setSuccess(true);
      }
    } finally {
      setLoading(false);
    }
  }

  const selectedOpt = ROLE_OPTIONS.find(o => o.value === role);

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#071628] via-[#0b2038] to-[#0e305a] p-4">
        <div className="relative w-full max-w-[420px] text-center">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-10 shadow-2xl backdrop-blur-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-3xl">
              ✅
            </div>
            <h2 className="text-xl font-bold text-white">Account Created!</h2>
            <p className="mt-2 text-sm text-slate-400">
              Welcome, <span className="font-semibold text-white">{fullName}</span>. Your account has been registered
              {role !== ROLES.EMPLOYEE ? ` as ${selectedOpt?.label}` : ""}.
            </p>
            <button
              type="button"
              onClick={onGoToLogin}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#1677f9] to-[#0554cc] py-2.5 text-sm font-semibold text-white hover:from-blue-500 hover:to-blue-700 transition"
            >
              Sign In Now →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main registration page ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#071628] via-[#0b2038] to-[#0e305a] p-4 py-10">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-700/10 blur-[100px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-sky-500/10 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-[480px]">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1677f9] to-[#0554cc] text-xl font-extrabold text-white shadow-xl shadow-blue-900/50">
            B
          </div>
          <h1 className="text-[22px] font-bold text-white tracking-tight">
            Beeta<span className="text-sky-400">Logic</span>
          </h1>
        </div>

        {/* Step indicator */}
        <div className="mb-5 flex items-center gap-3 px-1">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                step >= s ? "bg-[#1677f9] text-white" : "bg-white/10 text-slate-500"
              }`}>{s}</div>
              <span className={`text-xs font-medium transition ${step >= s ? "text-slate-300" : "text-slate-600"}`}>
                {s === 1 ? "Personal Info" : "Role & Access"}
              </span>
              {s < 2 && <div className={`h-px flex-1 transition ${step > s ? "bg-[#1677f9]/60" : "bg-white/10"}`} />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl backdrop-blur-2xl">
          <h2 className="mb-1 text-lg font-bold text-white">
            {step === 1 ? "Create your account" : "Choose your access level"}
          </h2>
          <p className="mb-5 text-sm text-slate-400">
            {step === 1
              ? "Fill in your details to get started."
              : "Select your role. HR and Admin roles require a company passcode."}
          </p>

          {/* ── STEP 1: Personal info ── */}
          {step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-4" noValidate>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="reg-fullname" className="mb-1 block text-xs font-semibold text-slate-300">
                    Full Name
                  </label>
                  <input
                    id="reg-fullname"
                    type="text"
                    value={fullName}
                    onChange={e => { setFullName(e.target.value); clearFieldError("fullName"); }}
                    maxLength={100}
                    placeholder="e.g. Arun Kumar"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none bg-white/5 transition ${
                      fieldErrors.fullName ? "border-rose-500/60 focus:border-rose-500" : "border-white/10 focus:border-[#1677f9] focus:ring-2 focus:ring-[#1677f9]/20"
                    }`}
                  />
                  {fieldErrors.fullName && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.fullName}</p>}
                </div>

                <div>
                  <label htmlFor="reg-username" className="mb-1 block text-xs font-semibold text-slate-300">
                    Username
                  </label>
                  <input
                    id="reg-username"
                    type="text"
                    value={username}
                    onChange={e => { setUsername(e.target.value.replace(/\s/g, "")); clearFieldError("username"); }}
                    maxLength={50}
                    placeholder="e.g. arun.kumar"
                    autoComplete="username"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none bg-white/5 transition ${
                      fieldErrors.username ? "border-rose-500/60 focus:border-rose-500" : "border-white/10 focus:border-[#1677f9] focus:ring-2 focus:ring-[#1677f9]/20"
                    }`}
                  />
                  {fieldErrors.username && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.username}</p>}
                </div>

                <div>
                  <label htmlFor="reg-dept" className="mb-1 block text-xs font-semibold text-slate-300">
                    Department
                  </label>
                  <input
                    id="reg-dept"
                    type="text"
                    value={department}
                    onChange={e => { setDepartment(e.target.value); clearFieldError("department"); }}
                    maxLength={100}
                    placeholder="e.g. Engineering"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none bg-white/5 transition ${
                      fieldErrors.department ? "border-rose-500/60 focus:border-rose-500" : "border-white/10 focus:border-[#1677f9] focus:ring-2 focus:ring-[#1677f9]/20"
                    }`}
                  />
                  {fieldErrors.department && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.department}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="reg-email" className="mb-1 block text-xs font-semibold text-slate-300">
                    Work Email
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); clearFieldError("email"); }}
                    maxLength={150}
                    placeholder="e.g. arun@beetalogic.com"
                    autoComplete="email"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none bg-white/5 transition ${
                      fieldErrors.email ? "border-rose-500/60 focus:border-rose-500" : "border-white/10 focus:border-[#1677f9] focus:ring-2 focus:ring-[#1677f9]/20"
                    }`}
                  />
                  {fieldErrors.email && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.email}</p>}
                </div>

                <div>
                  <label htmlFor="reg-password" className="mb-1 block text-xs font-semibold text-slate-300">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={e => { setPassword(e.target.value); clearFieldError("password"); }}
                      minLength={8}
                      maxLength={72}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className={`w-full rounded-xl border px-4 py-2.5 pr-11 text-sm text-white placeholder:text-slate-500 outline-none bg-white/5 transition ${
                        fieldErrors.password ? "border-rose-500/60" : "border-white/10 focus:border-[#1677f9] focus:ring-2 focus:ring-[#1677f9]/20"
                      }`}
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-[14px]">
                      {showPwd ? "🙈" : "👁️"}
                    </button>
                  </div>
                  <PasswordStrength password={password} />
                  {fieldErrors.password && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.password}</p>}
                </div>

                <div>
                  <label htmlFor="reg-confirm" className="mb-1 block text-xs font-semibold text-slate-300">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="reg-confirm"
                      type={showConfirm ? "text" : "password"}
                      value={confirmPwd}
                      onChange={e => { setConfirmPwd(e.target.value); clearFieldError("confirmPwd"); }}
                      placeholder="Repeat password"
                      autoComplete="new-password"
                      className={`w-full rounded-xl border px-4 py-2.5 pr-11 text-sm placeholder:text-slate-500 outline-none bg-white/5 transition ${
                        fieldErrors.confirmPwd
                          ? "border-rose-500/60 text-rose-400"
                          : confirmPwd && confirmPwd === password
                            ? "border-emerald-500/40 text-white"
                            : "border-white/10 text-white focus:border-[#1677f9] focus:ring-2 focus:ring-[#1677f9]/20"
                      }`}
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-[14px]">
                      {showConfirm ? "🙈" : "👁️"}
                    </button>
                  </div>
                  {fieldErrors.confirmPwd && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.confirmPwd}</p>}
                  {confirmPwd && confirmPwd === password && !fieldErrors.confirmPwd && (
                    <p className="mt-1 text-[11px] text-emerald-400">✓ Passwords match</p>
                  )}
                </div>
              </div>

              <button
                id="reg-next-btn"
                type="submit"
                className="mt-2 w-full rounded-xl bg-gradient-to-r from-[#1677f9] to-[#0554cc] py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 hover:from-blue-500 hover:to-blue-700 transition"
              >
                Continue →
              </button>
            </form>
          )}

          {/* ── STEP 2: Role + passcode ── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Role selector cards */}
              <div className="space-y-2.5">
                {ROLE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    id={`role-${opt.value}`}
                    onClick={() => { setRole(opt.value); setPasscode(""); setFieldErrors({}); setRegError(""); }}
                    className={`w-full flex items-start gap-3.5 rounded-xl border-2 p-4 text-left transition ${
                      role === opt.value
                        ? opt.selectedColor + " border-2"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="text-2xl shrink-0 mt-0.5">{opt.icon}</span>
                    <div>
                      <p className={`text-sm font-semibold ${role === opt.value ? "text-white" : "text-slate-300"}`}>
                        {opt.label}
                        {opt.needsPasscode && (
                          <span className="ml-2 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                            Passcode required
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{opt.desc}</p>
                    </div>
                    {role === opt.value && (
                      <span className="ml-auto shrink-0 text-base text-emerald-400">✓</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Passcode field — only for HR / Admin */}
              {selectedOpt?.needsPasscode && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <label htmlFor="reg-passcode" className="mb-1.5 block text-xs font-semibold text-amber-300">
                    🔑 {selectedOpt.label} Passcode
                  </label>
                  <input
                    id="reg-passcode"
                    type="text"
                    value={passcode}
                    onChange={e => { setPasscode(e.target.value.toUpperCase()); clearFieldError("passcode"); }}
                    maxLength={10}
                    placeholder={selectedOpt.passcodePlaceholder}
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none bg-white/5 tracking-widest font-mono transition ${
                      fieldErrors.passcode ? "border-rose-500/60" : "border-white/10 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                    }`}
                  />
                  <p className="mt-1.5 text-[11px] text-amber-400/70">{selectedOpt.passcodeHint}</p>
                  {fieldErrors.passcode && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.passcode}</p>}
                </div>
              )}

              {regError && (
                <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
                  {regError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setStep(1); setRegError(""); setFieldErrors({}); }}
                  className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5 transition"
                >
                  ← Back
                </button>
                <button
                  id="reg-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#1677f9] to-[#0554cc] py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 hover:from-blue-500 hover:to-blue-700 disabled:opacity-60 transition"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Creating…
                    </span>
                  ) : "Create Account"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Login link */}
        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <button
            type="button"
            id="go-to-login-btn"
            onClick={onGoToLogin}
            className="font-semibold text-sky-400 hover:text-sky-300 transition"
          >
            Sign in
          </button>
        </p>

        <p className="mt-4 text-center text-[10px] text-slate-700">
          BeetaLogic · Employee Management System · v2.0
        </p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage({ onGoToRegister }) {
  const {
    login,
    authError,
    setAuthError,
    requestPasswordReset,
    resetPassword,
  } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [mode, setMode] = useState(() =>
    new URLSearchParams(window.location.hash.slice(1)).has("resetToken")
      ? "reset"
      : "login"
  );
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");

  const resetToken = new URLSearchParams(window.location.hash.slice(1)).get("resetToken");

  function showLogin() {
    setMode("login");
    setResetError("");
    setResetMessage("");
    setAuthError("");
    window.history.replaceState({}, "", window.location.pathname);
  }

  async function handleForgotSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setResetError("");
    setResetMessage("");
    try {
      const result = await requestPasswordReset(resetEmail.trim());
      if (!result.ok) {
        setResetError(result.error);
        return;
      }
      setResetMessage(result.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSubmit(event) {
    event.preventDefault();
    setResetError("");
    setResetMessage("");

    if (!resetToken) {
      setResetError("This password reset link is missing or invalid.");
      return;
    }
    if (newPassword.length < 8) {
      setResetError("Your password must contain at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("The password confirmation does not match.");
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(resetToken, newPassword);
      if (!result.ok) {
        setResetError(result.error);
        return;
      }
      setResetMessage(result.message);
      setNewPassword("");
      setConfirmPassword("");
      window.history.replaceState({}, "", window.location.pathname);
      setMode("login");
    } finally {
      setLoading(false);
    }
  }

async function handleSubmit(e) {
  e.preventDefault();

  if (!username.trim() || !password) {
    setAuthError("Please enter your username and password.");
    return;
  }

  setLoading(true);
  setAuthError("");

  try {
    const result = await login(username, password);

    if (!result.ok) {
      setAuthError(
        result.error || result.message || "Invalid username or password."
      );
    }
    // Keep your existing app navigation/auth flow.
    // Successful login updates currentUser in AuthContext.
  } catch (error) {
    console.error("Login failed:", error);
    setAuthError("Unable to sign in. Please try again.");
  } finally {
    setLoading(false);
  }
}
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#071628] via-[#0b2038] to-[#0e305a] p-4">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-700/10 blur-[100px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-sky-500/10 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-[420px]">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1677f9] to-[#0554cc] text-2xl font-extrabold text-white shadow-xl shadow-blue-900/50">
            B
          </div>
          <div className="text-center">
            <h1 className="text-[26px] font-bold text-white tracking-tight">
              Beeta<span className="text-sky-400">Logic</span>
            </h1>
            <p className="mt-1 text-sm text-slate-400">Employee Management System</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl backdrop-blur-2xl">
          {mode !== "login" ? (
            <>
              <button
                type="button"
                onClick={showLogin}
                className="mb-5 text-sm font-medium text-sky-400 hover:text-sky-300"
              >
                ← Back to sign in
              </button>
              <h2 className="mb-1 text-xl font-bold text-white">
                {mode === "forgot" ? "Reset your password" : "Choose a new password"}
              </h2>
              <p className="mb-6 text-sm text-slate-400">
                {mode === "forgot"
                  ? "Enter the email address associated with your account. We’ll send a secure, time-limited reset link if it matches an account."
                  : "Choose a new password for your account. Reset links expire after 30 minutes and can only be used once."}
              </p>
              <form
                onSubmit={mode === "forgot" ? handleForgotSubmit : handleResetSubmit}
                className="space-y-4"
              >
                {mode === "forgot" ? (
                  <div>
                    <label htmlFor="reset-email" className="mb-1.5 block text-xs font-semibold text-slate-300">
                      Account email
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={150}
                      value={resetEmail}
                      onChange={(event) => setResetEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-[#1677f9] focus:ring-2 focus:ring-[#1677f9]/20"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label htmlFor="reset-new-password" className="mb-1.5 block text-xs font-semibold text-slate-300">
                        New password
                      </label>
                      <input
                        id="reset-new-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={72}
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-[#1677f9] focus:ring-2 focus:ring-[#1677f9]/20"
                      />
                    </div>
                    <div>
                      <label htmlFor="reset-confirm-password" className="mb-1.5 block text-xs font-semibold text-slate-300">
                        Confirm new password
                      </label>
                      <input
                        id="reset-confirm-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={72}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-[#1677f9] focus:ring-2 focus:ring-[#1677f9]/20"
                      />
                    </div>
                  </>
                )}
                {resetError && (
                  <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
                    {resetError}
                  </div>
                )}
                {resetMessage && (
                  <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                    {resetMessage}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-[#1677f9] to-[#0554cc] py-2.5 text-sm font-semibold text-white hover:from-blue-500 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? "Please wait…"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Reset password"}
                </button>
              </form>
            </>
          ) : (
            <>
          <h2 className="mb-1 text-xl font-bold text-white">Welcome back</h2>
          <p className="mb-6 text-sm text-slate-400">Sign in to your account to continue.</p>
          {resetMessage && (
            <div role="status" className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {resetMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="login-username" className="mb-1.5 block text-xs font-semibold text-slate-300">
                Username
              </label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={e => { setUsername(e.target.value); setAuthError(""); }}
                placeholder="Your username"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-[#1677f9] focus:ring-2 focus:ring-[#1677f9]/20 transition"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-xs font-semibold text-slate-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setAuthError(""); }}
                  placeholder="Your password"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pr-11 text-sm text-white placeholder:text-slate-500 outline-none focus:border-[#1677f9] focus:ring-2 focus:ring-[#1677f9]/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-[15px]"
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div className="text-right">
              <button
                type="button"
                id="forgot-password-btn"
                onClick={() => {
                  setMode("forgot");
                  setResetError("");
                  setResetMessage("");
                  setAuthError("");
                }}
                className="text-xs font-semibold text-sky-400 hover:text-sky-300"
              >
                Forgot password?
              </button>
            </div>

            {authError && (
              <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
                {authError}
              </div>
            )}

            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-xl bg-gradient-to-r from-[#1677f9] to-[#0554cc] py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 hover:from-blue-500 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60 transition"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Signing in…
                </span>
              ) : "Sign In"}
            </button>
          </form>
            </>
          )}
        </div>

        {/* Register link */}
        <p className="mt-5 text-center text-sm text-slate-500">
          Don't have an account?{" "}
          <button
            type="button"
            id="go-to-register-btn"
            onClick={onGoToRegister}
            className="font-semibold text-sky-400 hover:text-sky-300 transition"
          >
            Create one
          </button>
        </p>

        <p className="mt-4 text-center text-[10px] text-slate-700">
          BeetaLogic · Employee Management System · v2.0
        </p>
      </div>
    </div>
  );
}

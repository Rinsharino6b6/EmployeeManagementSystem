import { createContext, useContext, useState, useCallback, useEffect } from "react";

// ─── Role definitions ─────────────────────────────────────────────────────────
export const ROLES = {
  ADMIN: "ADMIN",
  HR_MANAGER: "HR_MANAGER",
  EMPLOYEE: "EMPLOYEE",
};

// ─── Role passcode rules ──────────────────────────────────────────────────────
const SESSION_KEY = "bl_session";

function removeLegacyCredentialStorage() {
  try {
    localStorage.removeItem("bl_users");
    localStorage.removeItem("bl_passcodes");
  } catch (error) {
    console.error("Unable to remove legacy browser-stored credentials:", error);
  }
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const user = JSON.parse(raw);
      const containedCredential =
        Object.hasOwn(user, "password") || Object.hasOwn(user, "passcode");

      if (containedCredential) {
        delete user.password;
        delete user.passcode;
        saveSession(user);
      }

      return user;
    }
  } catch (error) {
    console.error("Unable to load the current browser session:", error);
  }
  return null;
}

function saveSession(user) {
  try {
    if (user) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch (error) {
    console.error("Unable to update the current browser session:", error);
  }
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
      .toUpperCase() || "??"
  );
}

function getRegistrationError(data, status) {
  const candidates = [data.message, data.detail, data.error, data.title];
  const message = candidates.find(
    (value) =>
      typeof value === "string" &&
      value.trim() &&
      !/^(400\s*)?bad request$/i.test(value.trim())
  );

  if (message) return message;

  if (data.errors && typeof data.errors === "object") {
    const fieldErrors = Object.values(data.errors)
      .flat()
      .filter((value) => typeof value === "string" && value.trim());
    if (fieldErrors.length) return fieldErrors.join(" ");
  }

  if (status === 400) {
    return "Registration was rejected. Check that the username and email are not already registered, the password is 8–72 characters, and the selected role/passcode is valid.";
  }

  return `Registration failed (${status}). Please try again.`;
}

// ─── Permission matrix ────────────────────────────────────────────────────────
const PERMISSIONS = {
  viewAllEmployees: [ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.EMPLOYEE],
  addEmployee: [ROLES.ADMIN, ROLES.HR_MANAGER],
  editEmployee: [ROLES.ADMIN, ROLES.HR_MANAGER],
  deleteEmployee: [ROLES.ADMIN, ROLES.HR_MANAGER],
  manageDepartments: [ROLES.ADMIN, ROLES.HR_MANAGER],
  manageUserRoles: [ROLES.ADMIN],
  viewDashboard: [ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.EMPLOYEE],
  viewOwnProfile: [ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.EMPLOYEE],
  viewHRReports: [ROLES.ADMIN, ROLES.HR_MANAGER],
};

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  useEffect(() => {
    removeLegacyCredentialStorage();
  }, []);
  const [currentUser, setCurrentUser] = useState(() => loadSession());
  const [authError, setAuthError] = useState("");
  const [regError, setRegError] = useState("");

  // ── Login ───────────────────────────────────────────────────────────────────
 
  const login = useCallback(async (username, password) => {
    setAuthError("");

    try {
      const response = await fetch(
        "http://localhost:8081/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const message =
          data.message || "Invalid username or password.";
        setAuthError(message);
        return { ok: false, error: message, message };
      }

      const account = data.user;

      const user = {
        id: `USR${account.id}`,
        databaseId: account.id,
        username: account.username,
        email: account.email,
        name: account.fullName,
        department: account.department || "",
        role: account.role,
        avatar: getInitials(account.fullName),
        profilePicture: account.profilePicture || "",
        sessionToken: data.accessToken,
        employeeId: account.employeeId || null,
        createdAt: account.createdAt,
      };

      setCurrentUser(user);
      saveSession(user);

      return { ok: true, user };
    } catch (error) {
      console.error("Backend login failed:", error);

      const message =
        "Cannot connect to the backend. Make sure Spring Boot is running on port 8081.";

      setAuthError(message);
      return { ok: false, error: message, message };
    }
  }, []);


  // ── Logout ──────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    if (currentUser?.sessionToken) {
      fetch("http://localhost:8081/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentUser.sessionToken}`,
        },
      }).catch((error) => {
        console.error("Unable to revoke the current session:", error);
      });
    }
    setCurrentUser(null);
    saveSession(null);
  }, [currentUser]);

  // ── Register ────────────────────────────────────────────────────────────────
  
  const register = useCallback(
    async ({
      fullName,
      username,
      email,
      password,
      department,
      role,
      passcode,
    }) => {
      setRegError("");

      try {
        const response = await fetch(
          "http://localhost:8081/api/auth/register",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${currentUser.sessionToken || ""}`,
            },
            body: JSON.stringify({
              fullName: fullName.trim(),
              username: username.trim(),
              email: email.trim().toLowerCase(),
              password,
              department: (department || "").trim(),
              role: role || ROLES.EMPLOYEE,
              passcode: passcode || "",
            }),
          }
        );

        const responseBody = await response.text();
        let data = {};
        try {
          data = responseBody ? JSON.parse(responseBody) : {};
        } catch {
          data = { detail: responseBody };
        }

        if (!response.ok) {
          const message = getRegistrationError(data, response.status);
          console.error("Registration rejected:", response.status, message);
          setRegError(message);
          return { ok: false, error: message, message };
        }

        // Do not automatically log in here.
        // Let the existing registration page navigate to login.
        return { ok: true, message: data.message };
      } catch (error) {
        console.error("Backend registration failed:", error);

        const message =
          "Cannot connect to the backend. Make sure Spring Boot is running.";

        setRegError(message);
        return { ok: false, error: message, message };
      }
    },
    []
  );

  // ── NEW: Update the logged-in user's profile ────────────────────────────────
  
const updateProfile = useCallback(
  async (updates) => {
    if (!currentUser) {
      return { ok: false, error: "Please sign in first." };
    }

    const databaseId = currentUser.databaseId;

    if (!databaseId) {
      return {
        ok: false,
        error: "Please sign out and sign in again to refresh your account.",
      };
    }

    try {
      const response = await fetch(
        `http://localhost:8081/api/users/${databaseId}/profile`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentUser.sessionToken || ""}`,
          },
          body: JSON.stringify({
            name: updates.name,
            email: updates.email,
            department: updates.department,
            profilePicture: updates.profilePicture,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          ok: false,
          error: data.message || "Unable to update your profile.",
        };
      }

      const updatedUser = {
        ...currentUser,
        id: `USR${data.id}`,
        databaseId: data.id,
        name: data.fullName,
        email: data.email,
        department: data.department || "",
        employeeId: data.employeeId || null,
        role: data.role,
        avatar: getInitials(data.fullName),
        profilePicture: data.profilePicture || "",
        createdAt: data.createdAt,
      };

      setCurrentUser(updatedUser);
      saveSession(updatedUser);

      return { ok: true, user: updatedUser };
    } catch (error) {
      console.error("Profile update failed:", error);

      return {
        ok: false,
        error: "Cannot connect to the backend. Please try again.",
      };
    }
  },
  [currentUser]
);

  const linkEmployeeRecord = useCallback(
    async (accountId, employeeId) => {
      if (!currentUser?.databaseId || !currentUser.sessionToken) {
        return { ok: false, error: "Please sign in again to link an employee record." };
      }
      if (!accountId) {
        return { ok: false, error: "Select a login account to link." };
      }

      try {
        const response = await fetch(
          `http://localhost:8081/api/users/${accountId}/employee-link`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${currentUser.sessionToken}`,
            },
            body: JSON.stringify({ employeeId: employeeId || null }),
          }
        );
        const data = await response.json();

        if (!response.ok) {
          return {
            ok: false,
            error: data.message || data.detail || "Unable to link the employee record.",
          };
        }

        if (Number(accountId) === Number(currentUser.databaseId)) {
          const updatedUser = { ...currentUser, employeeId: data.employeeId || null };
          setCurrentUser(updatedUser);
          saveSession(updatedUser);
          return { ok: true, user: updatedUser };
        }
        return { ok: true };
      } catch (error) {
        console.error("Employee record linking failed:", error);
        return {
          ok: false,
          error: "Cannot connect to the backend. Please try again.",
        };
      }
    },
    [currentUser]
  );

  const changePassword = useCallback(
    async ({ currentPassword, newPassword }) => {
      if (!currentUser?.databaseId) {
        return { ok: false, error: "Please sign in again to update your password." };
      }

      try {
        const response = await fetch(
          `http://localhost:8081/api/users/${currentUser.databaseId}/password`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${currentUser.sessionToken || ""}`,
            },
            body: JSON.stringify({ currentPassword, newPassword }),
          }
        );
        const data = await response.json();

        if (!response.ok) {
          const message =
            data.message || data.detail || "Unable to update your password.";
          return { ok: false, error: message };
        }

        return { ok: true, message: data.message };
      } catch (error) {
        console.error("Password update failed:", error);
        return {
          ok: false,
          error: "Cannot connect to the backend. Please try again.",
        };
      }
    },
    [currentUser]
  );

  const requestPasswordReset = useCallback(async (email) => {
    try {
      const response = await fetch(
        "http://localhost:8081/api/auth/password-reset/request",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        return {
          ok: false,
          error: data.message || "Unable to request a password reset.",
        };
      }

      return { ok: true, message: data.message };
    } catch (error) {
      console.error("Password reset request failed:", error);
      return {
        ok: false,
        error: "Cannot connect to the backend. Please try again.",
      };
    }
  }, []);

  const resetPassword = useCallback(async (token, newPassword) => {
    try {
      const response = await fetch(
        "http://localhost:8081/api/auth/password-reset/confirm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, newPassword }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        return {
          ok: false,
          error: data.message || "Unable to reset your password.",
        };
      }

      return { ok: true, message: data.message };
    } catch (error) {
      console.error("Password reset confirmation failed:", error);
      return {
        ok: false,
        error: "Cannot connect to the backend. Please try again.",
      };
    }
  }, []);

  // ── Permission helper ───────────────────────────────────────────────────────
  const can = useCallback(
    (permission) => {
      if (!currentUser) return false;

      const allowed = PERMISSIONS[permission];
      if (!allowed) return false;

      return allowed.includes(currentUser.role);
    },
    [currentUser]
  );

  const getRoleLabel = (role) => {
    switch (role) {
      case ROLES.ADMIN:
        return "Administrator";
      case ROLES.HR_MANAGER:
        return "HR Manager";
      case ROLES.EMPLOYEE:
        return "Employee";
      default:
        return role;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        login,
        logout,
        register,
        updateProfile,
        linkEmployeeRecord,
        changePassword,
        requestPasswordReset,
        resetPassword,
        can,
        authError,
        setAuthError,
        regError,
        setRegError,
        getRoleLabel,
        ROLES,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return ctx;
}
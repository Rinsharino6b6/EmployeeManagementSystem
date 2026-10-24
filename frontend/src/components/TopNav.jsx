import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

const ROLE_BADGE = {
  ADMIN: { label: "Admin", cls: "bg-violet-100 text-violet-700" },
  HR_MANAGER: { label: "HR Manager", cls: "bg-sky-100 text-sky-700" },
  EMPLOYEE: { label: "Employee", cls: "bg-emerald-100 text-emerald-700" },
};

function timeAgo(timestamp) {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  );
  if (elapsedSeconds < 60) return "Just now";
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

export default function TopNav({ search, onSearchChange, activePage, onGoToProfile, onGoToSettings, onLogout }) {
  const { currentUser, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const profileRef = useRef(null);
  const notifRef = useRef(null);
  const activityTimerRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    if (!currentUser?.databaseId || !currentUser?.sessionToken) return;
    try {
      const params = new URLSearchParams({
        requesterId: String(currentUser.databaseId),
      });
      const response = await fetch(
        `http://localhost:8081/api/activities?${params}`,
        {
          headers: {
            Authorization: `Bearer ${currentUser.sessionToken}`,
          },
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to load recent activity.");
      }
      setNotifications(Array.isArray(data.activities) ? data.activities : []);
      setUnreadCount(Number(data.unreadCount) || 0);
      setNotificationError("");
    } catch (error) {
      console.error("Unable to load recent activity:", error);
      setNotificationError(
        error.message || "Unable to load recent activity. Please try again."
      );
    } finally {
      setNotificationLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (notifOpen) return undefined;
    window.clearInterval(activityTimerRef.current);
    activityTimerRef.current = null;
    return undefined;
  }, [notifOpen]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.clearInterval(activityTimerRef.current);
    };
  }, []);

  const markAllRead = async () => {
    if (!currentUser?.databaseId || !currentUser?.sessionToken || unreadCount === 0) {
      return;
    }
    try {
      const params = new URLSearchParams({
        requesterId: String(currentUser.databaseId),
      });
      const response = await fetch(
        `http://localhost:8081/api/activities/read?${params}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentUser.sessionToken}`,
          },
        }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Unable to mark activity as read.");
      }
      setNotifications((previous) =>
        previous.map((activity) => ({ ...activity, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Unable to mark recent activity as read:", error);
      setNotificationError(
        error.message || "Unable to mark recent activity as read."
      );
    }
  };

  const badge = currentUser ? ROLE_BADGE[currentUser.role] : null;
  const pageTitles = {
    Overview: "Dashboard",
    Employees: "Employees",
    Attendance: "Attendance",
    Departments: "Departments",
    MyProfile: "My Profile",
    Settings: "Account Settings",
  };
  const searchPlaceholders = {
    Employees: "Search employees…",
    Departments: "Search departments…",
    Attendance: "Search attendance records…",
  };

  const trigger = (cb) => {
    setProfileOpen(false);
    cb?.();
  };

  return (
    <header className="sticky top-0 z-20 flex h-[54px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
      {/* Left side – breadcrumb + search */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <span className="hidden text-xs font-semibold text-slate-400 md:block shrink-0">
          {pageTitles[activePage] ?? activePage}
        </span>
        <label htmlFor="topnav-search" className="flex h-8 w-full max-w-[380px] items-center gap-2 rounded-md bg-[#f0f4f9] px-3 text-slate-400 cursor-text">
          <span className="text-base shrink-0">⌕</span>
          <input
            id="topnav-search"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={searchPlaceholders[activePage] || "Search anything…"}
            aria-label={searchPlaceholders[activePage] || "Search anything"}
            className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
          />
          {search && (
            <button type="button" onClick={() => onSearchChange("")}
              className="text-slate-300 hover:text-slate-500 text-sm leading-none" aria-label="Clear search">×</button>
          )}
        </label>
      </div>

      {/* Right side – notifications + profile */}
      <div className="ml-4 flex items-center gap-2 shrink-0">
        {/* Notification bell */}
        <div className="relative" ref={notifRef}>
          <button type="button" id="notifications-btn"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
            onClick={() => {
              const opening = !notifOpen;
              setNotifOpen(opening);
              setProfileOpen(false);
              if (opening) {
                setNotificationLoading(true);
                setNotificationError("");
                loadNotifications();
                window.clearInterval(activityTimerRef.current);
                activityTimerRef.current = window.setInterval(
                  loadNotifications,
                  30000
                );
              } else {
                window.clearInterval(activityTimerRef.current);
                activityTimerRef.current = null;
              }
            }}
            className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <span className="text-sm font-semibold text-slate-800">
                  Recent activity
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              {notificationError ? (
                <div className="px-4 py-4">
                  <p role="alert" className="text-xs text-rose-600">
                    {notificationError}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setNotificationLoading(true);
                      loadNotifications();
                    }}
                    className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    Try again
                  </button>
                </div>
              ) : notificationLoading && notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-slate-500">
                  Loading recent activity…
                </p>
              ) : notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-slate-500">
                  No recent activity yet.
                </p>
              ) : (
                <ul className="max-h-72 divide-y divide-slate-50 overflow-y-auto">
                  {notifications.map((activity) => (
                    <li
                      key={activity.id}
                      className={`px-4 py-3 ${
                        activity.read ? "bg-white" : "bg-blue-50/60"
                      }`}
                    >
                      <p
                        className={`text-xs ${
                          activity.read
                            ? "text-slate-600"
                            : "font-medium text-slate-800"
                        }`}
                      >
                        {activity.actorName
                          ? `${activity.actorName}: ${activity.message}`
                          : activity.message}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {timeAgo(activity.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Profile avatar + dropdown */}
        <div className="relative" ref={profileRef}>
          <button type="button" id="profile-avatar-btn"
            onClick={() => { setProfileOpen(v => !v); setNotifOpen(false); }}
            aria-label="Profile menu" aria-expanded={profileOpen}
            className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-slate-100 transition"
          >
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#4a90e2] to-[#1677f9] text-[10px] font-semibold text-white shadow">
              {currentUser?.profilePicture ? (
                <img
                  src={currentUser.profilePicture}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                currentUser?.avatar ?? "?"
              )}
            </div>
            <span className="hidden text-[11px] font-medium text-slate-700 sm:block">{currentUser?.name}</span>
            <svg style={{ transform: profileOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
              width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-slate-400">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-10 z-50 w-64 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
              {/* Header with user info */}
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 bg-slate-50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#4a90e2] to-[#1677f9] text-sm font-bold text-white">
                  {currentUser?.profilePicture ? (
                    <img
                      src={currentUser.profilePicture}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    currentUser?.avatar ?? "?"
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{currentUser?.name}</p>
                  <p className="truncate text-[10px] text-slate-500">{currentUser?.email}</p>
                  {badge && (
                    <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
              </div>

              <ul className="py-1.5">

                <li>
                  <button
                    type="button"
                    id="profile-my-profile"
                    onClick={() => {
                      console.log("My Profile clicked");
                      setProfileOpen(false);
                      setNotifOpen(false);

                      if (onGoToProfile) {
                        onGoToProfile();
                      } else {
                        console.error("onGoToProfile callback is missing.");
                      }
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    <span className="text-base">👤</span>
                    My Profile
                  </button>
                </li>

                <li>
                  <button type="button" id="profile-account-settings"
                    onClick={() => trigger(onGoToSettings)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition">
                    <span className="text-base">⚙️</span> Account Settings
                  </button>
                </li>
              </ul>

              <div className="border-t border-slate-100 py-1.5">
                <button type="button" id="topnav-logout-btn" onClick={() => { logout(); if (onLogout) onLogout(); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 transition">
                  <span className="text-base">⏻</span> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

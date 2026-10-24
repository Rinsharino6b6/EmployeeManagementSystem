import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { name: "Overview",    label: "Dashboard",   icon: "⌂", permission: "viewDashboard" },
  { name: "Employees",   label: "Employees",   icon: "♟", permission: "viewAllEmployees" },
  { name: "Attendance",  label: "Attendance",  icon: "◷", permission: "viewDashboard" },
  { name: "OfficeLocation", label: "Office Location", icon: "⌖", permission: "manageDepartments" },
  { name: "Departments", label: "Departments", icon: "▦", permission: "manageDepartments" },
];

const ROLE_BADGE = {
  ADMIN:      { label: "Administrator", cls: "bg-violet-600/20 text-violet-300 border-violet-500/20" },
  HR_MANAGER: { label: "HR Manager",    cls: "bg-sky-600/20 text-sky-300 border-sky-500/20" },
  EMPLOYEE:   { label: "Employee",      cls: "bg-emerald-600/20 text-emerald-300 border-emerald-500/20" },
};

export default function Sidebar({ activePage, setActivePage, employeeCount, onCollapse }) {
  const { currentUser, logout, can } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  function toggleCollapse() {
    setCollapsed((v) => {
      const next = !v;
      onCollapse?.(next);
      return next;
    });
  }
  const [hoveredItem, setHoveredItem] = useState(null);
  const tooltipRef = useRef(null);

  // Filter nav items based on RBAC
const visibleItems = useMemo(
  () => NAV_ITEMS.filter((item) => can(item.permission)),
  [can]
);

const canAccessActivePage =
  activePage === "MyProfile" ||
  activePage === "Settings" ||
  (activePage === "OfficeLocation" && can("manageDepartments")) ||
  visibleItems.some((item) => item.name === activePage);

useEffect(() => {
  if (!canAccessActivePage && visibleItems.length > 0) {
    setActivePage(visibleItems[0].name);
  }
}, [
  canAccessActivePage,
  setActivePage,
  visibleItems,
]);

  const badge = currentUser ? ROLE_BADGE[currentUser.role] : null;

  return (
    <aside
      id="sidebar"
      style={{ width: collapsed ? "72px" : "250px", transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)" }}
      className="fixed inset-y-0 left-0 z-30 hidden flex-col bg-[#0b2038] text-white shadow-2xl md:flex overflow-hidden"
    >
      {/* Logo + Collapse button */}
      <div className="flex h-[62px] items-center justify-between px-4 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1677f9] text-sm font-extrabold shadow-md shadow-blue-900/40">
            B
          </div>
          <div
            style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : "auto", transition: "opacity 0.2s, width 0.3s", overflow: "hidden", whiteSpace: "nowrap" }}
            className="text-[16px] font-bold tracking-tight"
          >
            Beeta<span className="text-sky-400">Logic</span>
          </div>
        </div>

        <button
          type="button"
          id="sidebar-collapse-btn"
          onClick={toggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white transition"
          style={{ marginLeft: collapsed ? "auto" : "4px" }}
        >
          <svg
            style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s" }}
            width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="mt-4 flex flex-col gap-0.5 px-2 flex-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = activePage === item.name;
          return (
            <div key={item.name} className="relative">
              <button
                type="button"
                id={`nav-${item.name.toLowerCase()}`}
                onClick={() => setActivePage(item.name)}
                onMouseEnter={() => collapsed && setHoveredItem(item.name)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[12px] transition-all duration-150 ${
                  isActive
                    ? "bg-[#1478f8] font-semibold text-white shadow-md shadow-blue-900/30"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span
                  className="shrink-0 w-5 text-center"
                  style={{ fontSize: "17px" }}
                >
                  {item.icon}
                </span>
                <span
                  style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : "auto", transition: "opacity 0.2s", overflow: "hidden", whiteSpace: "nowrap", display: "block" }}
                >
                  {item.label}
                </span>
                {!collapsed && item.name === "Employees" && (
                  <span className="ml-auto rounded bg-white/15 px-1.5 py-0.5 text-[10px]">
                    {employeeCount}
                  </span>
                )}
              </button>

              {/* Tooltip when collapsed */}
              {collapsed && hoveredItem === item.name && (
                <div
                  ref={tooltipRef}
                  className="pointer-events-none absolute left-[60px] top-1/2 -translate-y-1/2 z-50 rounded-md bg-[#1c3a5c] border border-white/10 px-3 py-1.5 text-xs font-medium text-white shadow-xl whitespace-nowrap"
                >
                  {item.label}
                  {item.name === "Employees" && (
                    <span className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-[9px]">{employeeCount}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User section at bottom */}
      <div className="border-t border-white/10 px-3 py-4 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#4a90e2] to-[#1677f9] text-[11px] font-bold shadow-md">
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
          <div
            style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : "auto", transition: "opacity 0.2s, width 0.3s", overflow: "hidden" }}
            className="min-w-0"
          >
            <p className="truncate text-[11px] font-semibold text-white">{currentUser?.name}</p>
            {badge && (
              <span className={`mt-0.5 inline-block rounded border px-1.5 py-0.5 text-[9px] font-semibold ${badge.cls}`}>
                {badge.label}
              </span>
            )}
          </div>
        </div>

        {/* Logout */}
        <button
          type="button"
          id="sidebar-logout-btn"
          onClick={logout}
          onMouseEnter={() => collapsed && setHoveredItem("__logout")}
          onMouseLeave={() => setHoveredItem(null)}
          style={{ marginTop: "10px", justifyContent: collapsed ? "center" : "flex-start" }}
          className="relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition"
        >
          <span className="shrink-0 text-base">⏻</span>
          <span
            style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : "auto", transition: "opacity 0.2s", overflow: "hidden", whiteSpace: "nowrap" }}
          >
            Sign Out
          </span>
          {collapsed && hoveredItem === "__logout" && (
            <div className="pointer-events-none absolute left-[60px] top-1/2 -translate-y-1/2 z-50 rounded-md bg-[#1c3a5c] border border-white/10 px-3 py-1.5 text-xs font-medium text-white shadow-xl whitespace-nowrap">
              Sign Out
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}

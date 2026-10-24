import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import AttendanceOperationsPanel from "./AttendanceOperationsPanel";

const API_URL = "http://localhost:8081/api/attendance";
const OFFICE_LOCATION_URL = `${API_URL}/office-location`;

function localDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRange(period) {
  const today = new Date();
  if (period === "MONTH") {
    return {
      from: localDateValue(new Date(today.getFullYear(), today.getMonth(), 1)),
      through: localDateValue(today),
    };
  }
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);
  return { from: localDateValue(monday), through: localDateValue(today) };
}

function formatTime(value, timeZone) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDuration(minutes) {
  if (minutes == null) return "—";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function statusLabel(status) {
  if (status === "REVIEW") return "Needs review";
  if (status === "HOLIDAY") return "Holiday";
  if (status === "LEAVE") return "Approved leave";
  if (status === "IN_PROGRESS") return "In progress";
  if (status === "NOT_STARTED") return "Not started";
  if (status === "INCOMPLETE") return "Incomplete — review";
  if (status === "PARTIAL") return "Partial";
  if (status === "ABSENT") return "Absent";
  return "Present";
}

function statusStyle(status) {
  if (status === "ABSENT" || status === "INCOMPLETE") {
    return "bg-rose-50 text-rose-700";
  }
  if (status === "PARTIAL") return "bg-orange-50 text-orange-700";
  if (status === "REVIEW") return "bg-purple-50 text-purple-700";
  if (status === "HOLIDAY" || status === "LEAVE") return "bg-sky-50 text-sky-700";
  if (status === "IN_PROGRESS" || status === "NOT_STARTED") {
    return "bg-amber-50 text-amber-700";
  }
  return "bg-emerald-50 text-emerald-700";
}

async function readResponse(response) {
  if (response.status === 204) return {};
  const body = await response.text();
  let data;
  try {
    data = body ? JSON.parse(body) : {};
  } catch {
    throw new Error(body || `Attendance request failed (${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(data.message || `Attendance request failed (${response.status}).`);
  }
  return data;
}

function getDeviceLocation() {
  if (!navigator.geolocation) {
    return Promise.reject(
      new Error("This browser does not support location checks for attendance.")
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyMeters: coords.accuracy,
      }),
      (locationError) => {
        const message = locationError.code === locationError.PERMISSION_DENIED
          ? "Allow location access in your browser to mark attendance."
          : locationError.code === locationError.TIMEOUT
            ? "Could not verify your location in time. Please try again."
            : "Unable to verify your location. Make sure location services are enabled.";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  });
}

export default function AttendancePage({ search = "" }) {
  const { currentUser } = useAuth();
  const accountId = currentUser?.databaseId;
  const canViewCompany = ["ADMIN", "HR_MANAGER"].includes(currentUser?.role);
  const initialRange = getRange("WEEK");
  const [today, setToday] = useState(null);
  const [officeLocation, setOfficeLocation] = useState(null);
  const [report, setReport] = useState(null);
  const [period, setPeriod] = useState("WEEK");
  const [selectedEmployee, setSelectedEmployee] = useState(
    canViewCompany ? "" : String(accountId || "")
  );
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [throughDate, setThroughDate] = useState(initialRange.through);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchAttendance = useCallback(async () => {
    if (!accountId) throw new Error("Sign in again to load attendance.");
    const headers = {
      Authorization: `Bearer ${currentUser?.sessionToken || ""}`,
    };
    const ownResponse = await fetch(`${API_URL}/${accountId}/today`, { headers });
    const ownRecord = await readResponse(ownResponse);
    const officeResponse = await fetch(OFFICE_LOCATION_URL, { headers });
    const configuredOffice = await readResponse(officeResponse);

    const params = new URLSearchParams({ from: fromDate, through: throughDate });
    const reportEmployeeId = canViewCompany ? selectedEmployee : String(accountId);
    if (reportEmployeeId) params.set("employeeAccountId", reportEmployeeId);
    const reportResponse = await fetch(`${API_URL}/report?${params}`, { headers });
    const attendanceReport = await readResponse(reportResponse);

    return {
      today: ownRecord?.id ? ownRecord : null,
      officeLocation: configuredOffice,
      report: attendanceReport,
    };
  }, [
    accountId,
    canViewCompany,
    currentUser?.sessionToken,
    fromDate,
    selectedEmployee,
    throughDate,
  ]);

  useEffect(() => {
    let active = true;
    const refresh = () => fetchAttendance()
      .then(({ today: attendanceToday, officeLocation: configuredOffice, report: attendanceReport }) => {
        if (!active) return;
        setError("");
        setToday(attendanceToday);
        setOfficeLocation(configuredOffice);
        setReport(attendanceReport);
      })
      .catch((loadError) => {
        if (!active) return;
        console.error("Unable to load attendance report:", loadError);
        setError(loadError.message || "Unable to load attendance. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    refresh();
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [fetchAttendance]);

  function updatePeriod(nextPeriod) {
    setPeriod(nextPeriod);
    const range = getRange(nextPeriod);
    setFromDate(range.from);
    setThroughDate(range.through);
    setLoading(true);
  }

  function updateDateRange(setter, value) {
    setter(value);
    setPeriod("CUSTOM");
    setLoading(true);
  }

  async function refreshAttendanceData() {
    try {
      const {
        today: attendanceToday,
        officeLocation: configuredOffice,
        report: attendanceReport,
      } = await fetchAttendance();
      setToday(attendanceToday);
      setOfficeLocation(configuredOffice);
      setReport(attendanceReport);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Unable to refresh attendance.");
    }
  }

  async function updateAttendance(action) {
    if (!accountId || working) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const location = await getDeviceLocation();
      const response = await fetch(`${API_URL}/${accountId}/${action}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentUser?.sessionToken || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(location),
      });
      await readResponse(response);
      setNotice(action === "clock-in" ? "Clock-in recorded." : "Clock-out recorded.");
      await refreshAttendanceData();
    } catch (actionError) {
      console.error("Unable to update attendance:", actionError);
      setError(actionError.message || "Unable to update attendance. Please try again.");
    } finally {
      setWorking(false);
    }
  }

  const clockedIn = Boolean(today?.id);
  const clockedOut = Boolean(today?.clockOut);
  const days = report?.days || [];
  const query = search.trim().toLowerCase();
  const filteredDays = query
    ? days.filter((day) =>
        `${day.fullName ?? ""} ${day.username ?? ""} ${day.workDate ?? ""} ${statusLabel(day.status)} ${day.detail ?? ""}`
          .toLowerCase()
          .includes(query)
      )
    : days;
  const timeZone = report?.timeZone || officeLocation?.timeZone;

  function downloadReportCsv() {
    if (!report) return;
    const columns = [
      "Employee",
      "Username",
      "Work date",
      "Clock in",
      "Clock out",
      "Worked minutes",
      "Status",
      "Details",
    ];
    const rows = days.map((day) => [
      day.fullName,
      day.username,
      day.workDate,
      day.clockIn || "",
      day.clockOut || "",
      day.workedMinutes ?? "",
      statusLabel(day.status),
      day.detail || "",
    ]);
    const csv = [columns, ...rows]
      .map((row) => row.map((value) => {
        const text = String(value);
        const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
        return `"${safeText.replaceAll('"', '""')}"`;
      }).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${report.fromDate}-to-${report.throughDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="space-y-5 p-6">
      <header>
        <h1 className="text-xl font-bold text-slate-800">Attendance</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {canViewCompany
            ? "Review company timecards and scheduled-day absences."
            : "Record your daily start and finish times and review your timecard."}
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Today
            </p>
            <p className="mt-1 text-lg font-bold text-slate-800">
              {loading
                ? "Loading attendance…"
                : clockedOut
                  ? "Shift completed"
                  : clockedIn
                    ? "Currently clocked in"
                    : "Not clocked in yet"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Clock in: {formatTime(today?.clockIn, timeZone)}
              <span className="mx-2 text-slate-300">|</span>
              Clock out: {formatTime(today?.clockOut, timeZone)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {officeLocation?.configured
                ? `Office: ${officeLocation.address} · within ${officeLocation.radiusMeters} m.`
                : "The office location is not set up yet. Contact HR or Admin before marking attendance."}
              {" "}Location is checked when you clock in or out. Precise GPS must report accuracy within 100 m; move closer to the office if the accuracy area crosses the geofence boundary.
            </p>
            {officeLocation?.configured && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${officeLocation.latitude},${officeLocation.longitude}`)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs font-medium text-blue-700 underline"
              >
                View configured office pin on map
              </a>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => updateAttendance("clock-in")}
              disabled={loading || working || clockedIn || !officeLocation?.configured}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {working && !clockedIn ? "Checking location…" : "Clock In"}
            </button>
            <button
              type="button"
              onClick={() => updateAttendance("clock-out")}
              disabled={loading || working || !clockedIn || clockedOut || !officeLocation?.configured}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {working && clockedIn && !clockedOut ? "Checking location…" : "Clock Out"}
            </button>
          </div>
        </div>
      </section>

      {canViewCompany && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-sm font-bold text-slate-800">Attendance report</h2>
              <button
                type="button"
                onClick={downloadReportCsv}
                disabled={!report}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Export CSV
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-medium text-slate-500">
              Report period
              <select
                value={period === "CUSTOM" ? "CUSTOM" : period}
                onChange={(event) => event.target.value !== "CUSTOM" && updatePeriod(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400"
              >
                <option value="WEEK">This week</option>
                <option value="MONTH">This month</option>
                <option value="CUSTOM">Custom range</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-500">
              Employee
              <select
                value={selectedEmployee}
                onChange={(event) => {
                  setSelectedEmployee(event.target.value);
                  setLoading(true);
                }}
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400"
              >
                <option value="">All employees</option>
                {(report?.employees || []).map((employee) => (
                  <option key={employee.accountId} value={employee.accountId}>
                    {employee.fullName} ({employee.username})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-500">
              From
              <input
                type="date"
                value={fromDate}
                max={throughDate}
                onChange={(event) => updateDateRange(setFromDate, event.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400"
              />
            </label>
            <label className="text-xs font-medium text-slate-500">
              Through
              <input
                type="date"
                value={throughDate}
                min={fromDate}
                max={localDateValue(new Date())}
                onChange={(event) => updateDateRange(setThroughDate, event.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400"
              />
            </label>
          </div>
        </section>
      )}

      {!canViewCompany && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div>
            <h2 className="text-sm font-bold text-slate-800">My attendance period</h2>
            <p className="mt-1 text-xs text-slate-500">
              Review your scheduled shifts and attendance for this week or month.
            </p>
          </div>
          <div
            className="inline-flex rounded-xl bg-slate-100 p-1"
            role="group"
            aria-label="Filter my attendance by period"
          >
            {[
              { value: "WEEK", label: "This week" },
              { value: "MONTH", label: "This month" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updatePeriod(option.value)}
                aria-pressed={period === option.value}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  period === option.value
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Scheduled workdays" value={report?.scheduledDays ?? "—"} />
        <SummaryCard label="Present" value={report?.presentDays ?? "—"} />
        <SummaryCard label="Partial attendance" value={report?.partialDays ?? "—"} />
        <SummaryCard label="Absences" value={report?.absentDays ?? "—"} />
        <SummaryCard label="Holidays" value={report?.holidayDays ?? "—"} />
        <SummaryCard label="Approved leave" value={report?.leaveDays ?? "—"} />
        <SummaryCard label="Needs review" value={report?.reviewDays ?? "—"} />
        <SummaryCard
          label="Worked hours"
          value={report ? formatDuration(report.workedMinutes) : "—"}
          detail={`${report?.inProgressDays || 0} shift${report?.inProgressDays === 1 ? "" : "s"} in progress`}
        />
      </div>

      <AttendanceOperationsPanel onUpdated={refreshAttendanceData} />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-800">
            {canViewCompany
              ? selectedEmployee
                ? "Employee timecard"
                : "Company timecards"
              : "My timecard"}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {report
              ? `${formatDate(report.fromDate)} – ${formatDate(report.throughDate)}`
              : "Attendance by scheduled workday"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Shift: {report?.shiftStart || "9:30"}–{report?.shiftEnd || "17:00"} ({timeZone || "office time"}) · {report?.graceMinutes ?? 15} minute grace period.
          </p>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-slate-400">Loading attendance report…</p>
        ) : days.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No scheduled workdays or employee accounts were found for this range.
          </p>
        ) : filteredDays.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No attendance records match “{search}”.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {canViewCompany && !selectedEmployee && (
                    <th className="px-5 py-3">Employee</th>
                  )}
                  <th className="px-5 py-3">Work date</th>
                  <th className="px-5 py-3">Clock in</th>
                  <th className="px-5 py-3">Clock out</th>
                  <th className="px-5 py-3">Worked</th>
                  <th className="px-5 py-3">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDays.map((day) => (
                  <tr key={`${day.accountId}-${day.workDate}`}>
                    {canViewCompany && !selectedEmployee && (
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">{day.fullName}</p>
                        <p className="text-xs text-slate-500">{day.username}</p>
                      </td>
                    )}
                    <td className="px-5 py-3 text-slate-600">{formatDate(day.workDate)}</td>
                    <td className="px-5 py-3 text-slate-600">{formatTime(day.clockIn, timeZone)}</td>
                    <td className="px-5 py-3 text-slate-600">{formatTime(day.clockOut, timeZone)}</td>
                    <td className="px-5 py-3 text-slate-600">{formatDuration(day.workedMinutes)}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle(day.status)}`}>
                        {statusLabel(day.status)}
                      </span>
                      {day.detail && (
                        <p className="mt-1 max-w-64 text-xs text-slate-500">{day.detail}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value, detail }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </section>
  );
}

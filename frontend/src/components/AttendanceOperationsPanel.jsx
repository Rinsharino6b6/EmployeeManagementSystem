import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

const API_URL = "http://localhost:8081/api/attendance";

function todayString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

async function readResponse(response) {
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

function Panel({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

export default function AttendanceOperationsPanel({ onUpdated }) {
  const { currentUser } = useAuth();
  const accountId = currentUser?.databaseId;
  const token = currentUser?.sessionToken;
  const isHr = ["ADMIN", "HR_MANAGER"].includes(currentUser?.role);
  const isAdmin = currentUser?.role === "ADMIN";
  const [leave, setLeave] = useState({
    startDate: todayString(),
    endDate: todayString(),
    reason: "",
  });
  const [correction, setCorrection] = useState({
    workDate: todayString(),
    requestedClockIn: "",
    requestedClockOut: "",
    reason: "",
  });
  const [holiday, setHoliday] = useState({ date: todayString(), name: "" });
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [correctionRequests, setCorrectionRequests] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadRequests = useCallback(async () => {
    if (!accountId) return;
    const headers = { Authorization: `Bearer ${token || ""}` };
    const requester = `requesterId=${encodeURIComponent(accountId)}`;
    const holidayFrom = todayString();
    const holidayThroughDate = new Date();
    holidayThroughDate.setFullYear(holidayThroughDate.getFullYear() + 1);
    const holidayThrough = `${holidayThroughDate.getFullYear()}-${String(holidayThroughDate.getMonth() + 1).padStart(2, "0")}-${String(holidayThroughDate.getDate()).padStart(2, "0")}`;
    const [leaveData, correctionData, holidayData] = await Promise.all([
      readResponse(await fetch(`${API_URL}/leave-requests?${requester}`, { headers })),
      readResponse(await fetch(`${API_URL}/correction-requests?${requester}`, { headers })),
      readResponse(await fetch(
        `${API_URL}/holidays?from=${holidayFrom}&through=${holidayThrough}`,
        { headers }
      )),
    ]);
    setLeaveRequests(leaveData);
    setCorrectionRequests(correctionData);
    setHolidays(holidayData);
  }, [accountId, token]);

  useEffect(() => {
    let active = true;
    const refreshRequests = () => loadRequests()
      .catch((loadError) => {
        if (active) setError(loadError.message || "Unable to load attendance requests.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    refreshRequests();
    return () => {
      active = false;
    };
  }, [loadRequests]);

  async function submitRequest(path, payload, successMessage, reset) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await readResponse(await fetch(path, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }));
      setNotice(successMessage);
      reset();
      await loadRequests();
      await onUpdated?.();
    } catch (requestError) {
      setError(requestError.message || "Unable to submit the request.");
    } finally {
      setSaving(false);
    }
  }

  async function decide(path, decision, description) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await readResponse(await fetch(
        `${path}?requesterId=${encodeURIComponent(accountId)}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token || ""}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ decision }),
        }
      ));
      setNotice(description);
      await loadRequests();
      await onUpdated?.();
    } catch (requestError) {
      setError(requestError.message || "Unable to review the request.");
    } finally {
      setSaving(false);
    }
  }

  async function addHoliday(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await readResponse(await fetch(
        `${API_URL}/holidays?requesterId=${encodeURIComponent(accountId)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token || ""}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(holiday),
        }
      ));
      setHoliday((current) => ({ ...current, name: "" }));
      setNotice("Company holiday added.");
      await loadRequests();
      await onUpdated?.();
    } catch (requestError) {
      setError(requestError.message || "Unable to add holiday.");
    } finally {
      setSaving(false);
    }
  }

  async function removeHoliday(holidayId) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await readResponse(await fetch(
        `${API_URL}/holidays/${holidayId}?requesterId=${encodeURIComponent(accountId)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token || ""}` } }
      ));
      setNotice("Company holiday removed.");
      await loadRequests();
      await onUpdated?.();
    } catch (requestError) {
      setError(requestError.message || "Unable to remove holiday.");
    } finally {
      setSaving(false);
    }
  }

  const pendingLeave = leaveRequests.filter((request) => request.status === "PENDING");
  const pendingCorrections = correctionRequests.filter(
    (request) => request.status === "PENDING"
  );

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
      )}

      {!isAdmin && (
        <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Request leave">
          <p className="mt-1 text-xs text-slate-500">
            {isAdmin
              ? "Admin leave is approved immediately and reflected in attendance reports."
              : "HR/Admin approval is required before leave is reflected in attendance reports."}
          </p>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              submitRequest(
                `${API_URL}/${accountId}/leave-requests`,
                leave,
                isAdmin
                  ? "Leave approved and recorded."
                  : "Leave request submitted for review.",
                () => setLeave({
                  startDate: todayString(), endDate: todayString(), reason: "",
                })
              );
            }}
          >
            <label className="text-xs font-medium text-slate-600">
              From
              <input type="date" required value={leave.startDate} onChange={(event) => setLeave({ ...leave, startDate: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Through
              <input type="date" min={leave.startDate} required value={leave.endDate} onChange={(event) => setLeave({ ...leave, endDate: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-medium text-slate-600 sm:col-span-2">
              Reason
              <textarea maxLength={500} required value={leave.reason} onChange={(event) => setLeave({ ...leave, reason: event.target.value })} rows={2} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <button disabled={saving} className="w-fit rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Submit leave request</button>
          </form>
        </Panel>

        <Panel title="Request attendance correction">
          <p className="mt-1 text-xs text-slate-500">
            {isAdmin
              ? "Admin corrections are applied immediately to the timecard."
              : "For a missed/incorrect punch. An HR/Admin reviewer must approve changes to a timecard."}
          </p>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              submitRequest(
                `${API_URL}/${accountId}/correction-requests`,
                {
                  ...correction,
                  requestedClockIn: correction.requestedClockIn
                    ? `${correction.workDate}T${correction.requestedClockIn}:00`
                    : null,
                  requestedClockOut: correction.requestedClockOut
                    ? `${correction.workDate}T${correction.requestedClockOut}:00`
                    : null,
                },
                isAdmin
                  ? "Correction approved and applied to your timecard."
                  : "Correction request submitted for review.",
                () => setCorrection({
                  workDate: todayString(),
                  requestedClockIn: "",
                  requestedClockOut: "",
                  reason: "",
                })
              );
            }}
          >
            <label className="text-xs font-medium text-slate-600">
              Work date
              <input type="date" max={todayString()} required value={correction.workDate} onChange={(event) => setCorrection({ ...correction, workDate: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <span />
            <label className="text-xs font-medium text-slate-600">
              Correct clock-in
              <input type="time" required value={correction.requestedClockIn} onChange={(event) => setCorrection({ ...correction, requestedClockIn: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Correct clock-out (optional)
              <input type="time" value={correction.requestedClockOut} onChange={(event) => setCorrection({ ...correction, requestedClockOut: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-medium text-slate-600 sm:col-span-2">
              Reason
              <textarea maxLength={500} required value={correction.reason} onChange={(event) => setCorrection({ ...correction, reason: event.target.value })} rows={2} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <button disabled={saving} className="w-fit rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Submit correction request</button>
          </form>
        </Panel>
        </div>
      )}

      <Panel title={isHr ? "Manage company holidays" : "Upcoming company holidays"}>
        {isHr && (
          <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={addHoliday}>
            <label className="text-xs font-medium text-slate-600">
              Date
              <input type="date" required value={holiday.date} onChange={(event) => setHoliday({ ...holiday, date: event.target.value })} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="min-w-52 flex-1 text-xs font-medium text-slate-600">
              Holiday name
              <input maxLength={120} required value={holiday.name} onChange={(event) => setHoliday({ ...holiday, name: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Add holiday</button>
          </form>
        )}
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : holidays.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No upcoming holidays have been added.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {holidays.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-slate-700">{item.date} · {item.name}</span>
                {isHr && <button type="button" disabled={saving} onClick={() => removeHoliday(item.id)} className="text-xs font-medium text-rose-600 disabled:opacity-50">Remove</button>}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {isHr ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <ReviewList
            title="Pending leave requests"
            empty="No leave requests need review."
            items={pendingLeave}
            saving={saving}
            onDecision={(item, decision) => decide(
              `${API_URL}/leave-requests/${item.id}/decision`,
              decision,
              `Leave request ${decision.toLowerCase()}.`
            )}
            render={(item) => (
              <>
                <strong>{item.employeeName}</strong> · {item.startDate} to {item.endDate}
                <p className="text-xs text-slate-500">{item.reason}</p>
              </>
            )}
          />
          <ReviewList
            title="Pending attendance corrections"
            empty="No attendance corrections need review."
            items={pendingCorrections}
            saving={saving}
            onDecision={(item, decision) => decide(
              `${API_URL}/correction-requests/${item.id}/decision`,
              decision,
              `Attendance correction ${decision.toLowerCase()}.`
            )}
            render={(item) => (
              <>
                <strong>{item.employeeName}</strong> · {item.workDate}: {item.requestedClockIn.slice(11, 16)}
                {item.requestedClockOut ? `–${item.requestedClockOut.slice(11, 16)}` : ""}
                <p className="text-xs text-slate-500">{item.reason}</p>
              </>
            )}
          />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <RequestHistory title="My leave requests" items={leaveRequests} getPeriod={(item) => `${item.startDate} to ${item.endDate}`} />
          <RequestHistory title="My attendance correction requests" items={correctionRequests} getPeriod={(item) => item.workDate} />
        </div>
      )}
    </div>
  );
}

function ReviewList({ title, empty, items, saving, onDecision, render }) {
  return (
    <Panel title={title}>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-700">{render(item)}</div>
              <div className="flex shrink-0 gap-2">
                <button type="button" disabled={saving} onClick={() => onDecision(item, "APPROVED")} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Approve</button>
                <button type="button" disabled={saving} onClick={() => onDecision(item, "REJECTED")} className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Reject</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function RequestHistory({ title, items, getPeriod }) {
  return (
    <Panel title={title}>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No requests yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-slate-700">{getPeriod(item)}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                item.status === "APPROVED"
                  ? "bg-emerald-50 text-emerald-700"
                  : item.status === "REJECTED"
                    ? "bg-rose-50 text-rose-700"
                    : "bg-amber-50 text-amber-700"
              }`}>{item.status}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

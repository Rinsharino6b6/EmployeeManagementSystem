import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

const API_URL = "http://localhost:8081/api/attendance/office-location";

const DEFAULT_LOCATION = {
  officeName: "BeetaLogic Office",
  address: "No. 1059-1063, 2nd Floor, PN Palayam, Lakshmi Mills Jn, Coimbatore - 641037",
  latitude: "",
  longitude: "",
  radiusMeters: "150",
  configured: false,
  timeZone: "Asia/Kolkata",
  shiftStart: "09:30",
  shiftEnd: "17:00",
  graceMinutes: "15",
  workDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
};

const WEEKDAYS = [
  ["MONDAY", "Monday"],
  ["TUESDAY", "Tuesday"],
  ["WEDNESDAY", "Wednesday"],
  ["THURSDAY", "Thursday"],
  ["FRIDAY", "Friday"],
  ["SATURDAY", "Saturday"],
  ["SUNDAY", "Sunday"],
];

async function readResponse(response) {
  const body = await response.text();
  let data;
  try {
    data = body ? JSON.parse(body) : {};
  } catch {
    throw new Error(body || `Office location request failed (${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(data.message || `Office location request failed (${response.status}).`);
  }
  return data;
}

function requestCurrentLocation() {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("This browser does not support location access."));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        latitude: coords.latitude,
        longitude: coords.longitude,
      }),
      (locationError) => {
        const message = locationError.code === locationError.PERMISSION_DENIED
          ? "Allow location access in your browser to capture the office coordinates."
          : "Unable to read this device's location. Check location services and try again.";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  });
}

export default function OfficeLocationPage() {
  const { currentUser } = useAuth();
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch(API_URL, {
      headers: { Authorization: `Bearer ${currentUser?.sessionToken || ""}` },
    })
      .then(readResponse)
      .then((data) => {
        if (!active) return;
        setLocation({
          officeName: data.officeName || DEFAULT_LOCATION.officeName,
          address: data.address || DEFAULT_LOCATION.address,
          latitude: data.latitude ?? "",
          longitude: data.longitude ?? "",
          radiusMeters: data.radiusMeters ?? DEFAULT_LOCATION.radiusMeters,
          configured: Boolean(data.configured),
          timeZone: data.timeZone || DEFAULT_LOCATION.timeZone,
          shiftStart: data.shiftStart?.slice(0, 5) || DEFAULT_LOCATION.shiftStart,
          shiftEnd: data.shiftEnd?.slice(0, 5) || DEFAULT_LOCATION.shiftEnd,
          graceMinutes: data.graceMinutes ?? DEFAULT_LOCATION.graceMinutes,
          workDays: data.workDays
            ? data.workDays.split(",")
            : DEFAULT_LOCATION.workDays,
        });
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Unable to load office location.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentUser?.sessionToken]);

  function updateField(event) {
    const { name, value } = event.target;
    setLocation((current) => ({ ...current, [name]: value }));
  }

  function toggleWorkDay(day) {
    setLocation((current) => ({
      ...current,
      workDays: current.workDays.includes(day)
        ? current.workDays.filter((workDay) => workDay !== day)
        : [...current.workDays, day],
    }));
  }

  async function captureCurrentLocation() {
    setCapturing(true);
    setError("");
    setNotice("");
    try {
      const coordinates = await requestCurrentLocation();
      setLocation((current) => ({
        ...current,
        latitude: coordinates.latitude.toFixed(7),
        longitude: coordinates.longitude.toFixed(7),
      }));
      setNotice("Office coordinates captured. Save the location to apply it.");
    } catch (captureError) {
      setError(captureError.message || "Unable to capture office coordinates.");
    } finally {
      setCapturing(false);
    }
  }

  async function saveLocation(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${API_URL}?requesterId=${encodeURIComponent(currentUser?.databaseId || "")}`,
        {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${currentUser?.sessionToken || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          officeName: location.officeName.trim(),
          address: location.address.trim(),
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          radiusMeters: Number(location.radiusMeters),
          timeZone: location.timeZone.trim(),
          shiftStart: location.shiftStart,
          shiftEnd: location.shiftEnd,
          graceMinutes: Number(location.graceMinutes),
          workDays: location.workDays,
        }),
      });
      const saved = await readResponse(response);
      setLocation({
        officeName: saved.officeName,
        address: saved.address,
        latitude: saved.latitude,
        longitude: saved.longitude,
        radiusMeters: saved.radiusMeters,
        configured: Boolean(saved.configured),
        timeZone: saved.timeZone,
        shiftStart: saved.shiftStart,
        shiftEnd: saved.shiftEnd,
        graceMinutes: saved.graceMinutes,
        workDays: saved.workDays.split(","),
      });
      setNotice("Office attendance location saved.");
    } catch (saveError) {
      setError(saveError.message || "Unable to save office location.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 p-6">
      <header>
        <h1 className="text-xl font-bold text-slate-800">Office attendance location</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Configure the office geofence employees must be inside to clock in or out.
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
        {loading ? (
          <p className="text-sm text-slate-500">Loading office location…</p>
        ) : (
          <form className="space-y-5" onSubmit={saveLocation}>
            <div className={`rounded-xl border px-4 py-3 text-sm ${
              location.configured
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}>
              {location.configured
                ? "Office geofence is active. Employees can mark attendance from within the configured radius."
                : "Office coordinates are not set yet. Attendance marking stays disabled until you save them."}
            </div>

            <label className="block text-sm font-medium text-slate-700">
              Office name
              <input
                name="officeName"
                value={location.officeName}
                onChange={updateField}
                maxLength={100}
                required
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Company address
              <textarea
                name="address"
                value={location.address}
                onChange={updateField}
                maxLength={300}
                rows={2}
                required
                className="mt-1 block w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
              />
            </label>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <h2 className="text-sm font-semibold text-slate-800">Set the office coordinates</h2>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                For the simplest setup, use a phone or laptop while physically at the office and capture its current location. You can also enter coordinates from a trusted map. The address is shown to employees; the coordinates power the distance check.
              </p>
              <button
                type="button"
                onClick={captureCurrentLocation}
                disabled={capturing}
                className="mt-3 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {capturing ? "Getting device location…" : "Use this device’s current location"}
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Latitude
                <input
                  name="latitude"
                  type="number"
                  min="-90"
                  max="90"
                  step="any"
                  value={location.latitude}
                  onChange={updateField}
                  required
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Longitude
                <input
                  name="longitude"
                  type="number"
                  min="-180"
                  max="180"
                  step="any"
                  value={location.longitude}
                  onChange={updateField}
                  required
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                />
              </label>
            </div>

            <label className="block max-w-xs text-sm font-medium text-slate-700">
              Allowed radius (meters)
              <input
                name="radiusMeters"
                type="number"
                min="1"
                max="5000"
                step="1"
                value={location.radiusMeters}
                onChange={updateField}
                required
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                GPS accuracy varies; start with 150 m and adjust after testing at the office.
              </span>
            </label>

            <div className="border-t border-slate-100 pt-5">
              <h2 className="text-sm font-semibold text-slate-800">Work schedule</h2>
              <p className="mt-1 text-xs text-slate-500">
                These settings determine scheduled days and how attendance is classified.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-medium text-slate-700">
                  Shift starts
                  <input
                    name="shiftStart"
                    type="time"
                    value={location.shiftStart}
                    onChange={updateField}
                    required
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Shift ends
                  <input
                    name="shiftEnd"
                    type="time"
                    value={location.shiftEnd}
                    onChange={updateField}
                    required
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Grace period (minutes)
                  <input
                    name="graceMinutes"
                    type="number"
                    min="0"
                    max="120"
                    value={location.graceMinutes}
                    onChange={updateField}
                    required
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>
              </div>
              <label className="mt-4 block max-w-md text-sm font-medium text-slate-700">
                Office time zone (IANA name)
                <input
                  name="timeZone"
                  value={location.timeZone}
                  onChange={updateField}
                  placeholder="Asia/Kolkata"
                  required
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
              <fieldset className="mt-4">
                <legend className="text-sm font-medium text-slate-700">Working days</legend>
                <div className="mt-2 flex flex-wrap gap-3">
                  {WEEKDAYS.map(([day, label]) => (
                    <label key={day} className="inline-flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={location.workDays.includes(day)}
                        onChange={() => toggleWorkDay(day)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <button
              type="submit"
              disabled={saving || capturing || loading}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save office location"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

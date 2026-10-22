import React, { useEffect, useState } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  Check,
  Clock,
  Download,
  FileText,
  LogOut,
  RefreshCw,
  Send,
} from "lucide-react";
import { AppointmentFields, Field, WorkspaceSkeleton } from "./Interactions";
import "./patient-portal.css";

const day = () => new Date().toLocaleDateString("en-CA");
const stamp = (value) =>
  new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
const visitLabel = (a) =>
  `${a.date} at ${a.time} · ${a.doctor?.name || "Hospital doctor"}`;
const statusOf = (a) =>
  a ? (a.archived ? "Cancelled" : a.status) : "Pending review";

function usePortalData(api, url) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  async function refresh() {
    try {
      const value = await api(url);
      setData(value);
      setError("");
      return value;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const value = await api(url);
        if (active) {
          setData(value);
          setError("");
        }
      } catch (e) {
        if (active) setError(e.message);
      }
    };
    load();
    const timer = setInterval(load, 15000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [url, api]);
  return { data, error, refresh };
}

export function PatientRegistration({ api, onBack }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  return (
    <div className="patient-registration">
      <div className="portal-card">
        <span className="logo">
          <Activity />
        </span>
        <h1>Your care starts here.</h1>
        <p>
          Create a patient account to request a visit and receive appointment
          updates.
        </p>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {done ? (
          <div role="status">
            <h2>Account created</h2>
            <p>
              Sign in with your new email and password to request an
              appointment.
            </p>
            <button className="primary" onClick={onBack}>
              Go to sign in
            </button>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const values = Object.fromEntries(new FormData(e.currentTarget));
              if (values.password !== values.confirmPassword) {
                setError("Passwords do not match.");
                return;
              }
              setBusy(true);
              setError("");
              try {
                await api("/register", values);
                setDone(true);
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-grid">
              <label>
                Full name
                <Field
                  required
                  name="name"
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                />
              </label>
              <label>
                Email address
                <Field
                  required
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                />
              </label>
              <label>
                Phone number
                <Field
                  required
                  name="phone"
                  type="tel"
                  minLength={8}
                  maxLength={25}
                  autoComplete="tel"
                />
              </label>
              <label>
                Date of birth
                <Field required name="dob" type="date" max={day()} />
              </label>
              <label>
                Gender
                <Field as="select" name="gender" required defaultValue="">
                  <option value="">Select gender</option>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                </Field>
              </label>
            </div>
            <label>
              Password
              <Field
                name="password"
                type="password"
                minLength={10}
                maxLength={72}
                autoComplete="new-password"
                required
              />
              <small className="muted">Use at least 10 characters.</small>
            </label>
            <label>
              Confirm password
              <Field
                name="confirmPassword"
                type="password"
                minLength={10}
                maxLength={72}
                autoComplete="new-password"
                required
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Creating your account…" : "Create patient account"}
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={onBack}
            >
              Already have an account? Sign in
            </button>
          </form>
        )}
        <p className="muted">
          College demo · Please use fictional patient details.
        </p>
      </div>
    </div>
  );
}

export function PatientPortal({ api, user, onLogout }) {
  const { data, error, refresh } = usePortalData(api, "/portal");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [formError, setFormError] = useState("");
  const [tab, setTab] = useState("Requests");
  if (!data && !error) return <WorkspaceSkeleton />;
  const unread = (data?.appointments || []).filter(
    (a) => new Date(a.updatedAt) > new Date(data.notificationsReadAt || 0),
  );
  const pending = (data?.requests || []).filter(
    (r) => !data.appointments.some((a) => a.request === r._id),
  );
  return (
    <div className="patient-portal">
      <header className="portal-header">
        <a href="#" className="brand">
          <span className="logo">
            <Activity />
          </span>
          careflow.
        </a>
        <span className="portal-label">Patient portal</span>
        <button className="secondary" onClick={onLogout}>
          <LogOut size={16} /> Sign out
        </button>
      </header>
      <main className="portal-content">
        <div className="portal-welcome">
          <div>
            <span className="eyebrow">EVERGREEN HOSPITAL</span>
            <h1>Hello, {user.name}.</h1>
            <p>Your next step toward care, all in one place.</p>
          </div>
          <button className="secondary" onClick={refresh}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}{" "}
            <button className="text-button" onClick={refresh}>
              Retry
            </button>
          </div>
        )}
        {message && (
          <div className="portal-success" role="status">
            <Check size={18} />
            {message}
          </div>
        )}
        {data && (
          <>
            <div className="portal-metrics">
              <div>
                <Clock />
                <strong>{pending.length}</strong>
                <span>Awaiting review</span>
              </div>
              <div>
                <CalendarDays />
                <strong>
                  {
                    data.appointments.filter(
                      (a) =>
                        !a.archived &&
                        ["Scheduled", "Checked in"].includes(a.status),
                    ).length
                  }
                </strong>
                <span>Active appointments</span>
              </div>
              <div>
                <Bell />
                <strong>{unread.length}</strong>
                <span>New updates</span>
              </div>
            </div>
            <div className="portal-columns">
              <section className="portal-card">
                <span className="eyebrow">01 / REQUEST A VISIT</span>
                <h2>How can we help?</h2>
                <p>
                  Select a department and tell us what’s troubling you. Our team
                  will assign a doctor and confirm your appointment here.
                </p>
                {formError && (
                  <div className="error" role="alert">
                    {formError}
                  </div>
                )}
                {!data.departments.length ? (
                  <p>
                    No departments are currently accepting requests. Please
                    check back later.
                  </p>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const values = Object.fromEntries(new FormData(form));
                      setBusy(true);
                      setFormError("");
                      setMessage("");
                      try {
                        await api("/portal/requests", values);
                        form.reset();
                        setMessage(
                          "Request sent. Your hospital team will review it and confirm your appointment here.",
                        );
                        await refresh();
                      } catch (e) {
                        setFormError(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <label>
                      Department
                      <Field
                        as="select"
                        name="department"
                        required
                        defaultValue=""
                      >
                        <option value="">Choose a department</option>
                        {data.departments.map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                      </Field>
                    </label>
                    <label>
                      Tell us about your issue
                      <Field
                        as="textarea"
                        name="issue"
                        required
                        minLength={3}
                        maxLength={300}
                        rows={5}
                        placeholder="Describe your symptoms or the reason for your visit…"
                      />
                    </label>
                    <small className="muted">
                      Your request is confirmed only after the hospital
                      schedules a visit. All times are in India Standard Time
                      (IST).
                    </small>
                    <button className="primary" disabled={busy}>
                      <Send size={17} />
                      {busy ? "Sending request…" : "Send appointment request"}
                    </button>
                  </form>
                )}
              </section>
              <section className="portal-card">
                <div
                  className="portal-tabs"
                  role="tablist"
                  aria-label="Your care"
                >
                  <button
                    role="tab"
                    aria-selected={tab === "Requests"}
                    onClick={() => setTab("Requests")}
                  >
                    My requests
                  </button>
                  <button
                    role="tab"
                    aria-selected={tab === "Updates"}
                    onClick={() => setTab("Updates")}
                  >
                    Updates{" "}
                    {unread.length > 0 && (
                      <span className="nav-count">{unread.length}</span>
                    )}
                  </button>
                  <button
                    role="tab"
                    aria-selected={tab === "Prescriptions"}
                    onClick={() => setTab("Prescriptions")}
                  >
                    Prescriptions
                  </button>
                </div>
                {tab === "Requests" ? (
                  <>
                    <h2>Your care journey</h2>
                    {!data.requests.length && (
                      <div className="portal-empty">
                        <CalendarDays />
                        <p>
                          No requests yet. Send your first request using the
                          form.
                        </p>
                      </div>
                    )}
                    {data.requests.map((r) => {
                      const a = data.appointments.find(
                        (a) => a.request === r._id,
                      );
                      return (
                        <article className="request-card" key={r._id}>
                          <div className="request-card-title">
                            <h3>{r.department}</h3>
                            <span
                              className={
                                "request-status " + (a ? "booked" : "pending")
                              }
                            >
                              {statusOf(a)}
                            </span>
                          </div>
                          <p className="pre-wrap">{r.issue}</p>
                          <small className="muted">
                            Requested {stamp(r.createdAt)}
                          </small>
                          {a ? (
                            <div className="visit-confirmation">
                              <CalendarDays size={18} />
                              <span>
                                {visitLabel(a)}
                                <small>India Standard Time (IST)</small>
                              </span>
                            </div>
                          ) : (
                            <p className="muted">
                              We’ll notify you here when your appointment is
                              scheduled.
                            </p>
                          )}
                        </article>
                      );
                    })}
                  </>
                ) : tab === "Prescriptions" ? (
                  <PatientPrescriptions
                    prescriptions={data.prescriptions || []}
                  />
                ) : (
                  <>
                    <div className="request-card-title">
                      <h2>Appointment updates</h2>
                      {unread.length > 0 && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            setFormError("");
                            try {
                              await api("/portal/notifications/read", {
                                through: new Date(
                                  Math.max(
                                    ...unread.map((a) =>
                                      new Date(a.updatedAt).getTime(),
                                    ),
                                  ),
                                ).toISOString(),
                              });
                              await refresh();
                            } catch (e) {
                              setFormError(e.message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                    <p className="muted">
                      Updates refresh automatically every 15 seconds while this
                      page is open.
                    </p>
                    {!data.appointments.length && (
                      <div className="portal-empty">
                        <Bell />
                        <p>No appointment updates yet.</p>
                      </div>
                    )}
                    {[...data.appointments]
                      .sort(
                        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
                      )
                      .map((a) => (
                        <article
                          className={
                            "request-card " +
                            (unread.some((n) => n._id === a._id)
                              ? "unread-update"
                              : "")
                          }
                          key={a._id}
                        >
                          <h3>Appointment {statusOf(a).toLowerCase()}</h3>
                          <p>{visitLabel(a)}</p>
                          <small>
                            {stamp(a.updatedAt)} · IST appointment time
                          </small>
                        </article>
                      ))}
                  </>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function PatientPrescriptions({ prescriptions }) {
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState("");
  async function download(prescription) {
    setDownloading(prescription._id);
    setError("");
    try {
      const response = await fetch(
        `/api/portal/prescriptions/${prescription._id}/pdf`,
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw Error(
          result.message ||
            "Could not download this prescription. Please try again.",
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `careflow-prescription-${prescription._id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloading(null);
    }
  }
  return (
    <>
      <h2>My prescriptions</h2>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!prescriptions.length && (
        <div className="portal-empty">
          <FileText />
          <p>
            No prescriptions yet. They will appear here after your doctor adds
            them.
          </p>
        </div>
      )}
      {prescriptions.map((p) => (
        <article className="request-card" key={p._id}>
          <h3>{p.diagnosis}</h3>
          <p>{p.doctor?.name || "Hospital doctor"}</p>
          <small className="muted">Issued {stamp(p.createdAt)}</small>
          <button
            className="secondary"
            disabled={!!downloading}
            aria-label={`Download prescription for ${p.diagnosis}`}
            onClick={() => download(p)}
          >
            <Download size={16} />{" "}
            {downloading === p._id ? "Downloading…" : "Download PDF"}
          </button>
        </article>
      ))}
    </>
  );
}

export function RequestInbox({ api, data: staffData, onBooked }) {
  const [bookingData, setBookingData] = useState(staffData);
  const { data, error, refresh } = usePortalData(api, "/appointment-requests");
  const [filter, setFilter] = useState("Pending"),
    [selected, setSelected] = useState(null),
    [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState(""),
    [message, setMessage] = useState("");
  const rows = (data || []).filter(
    (r) =>
      filter === "All" ||
      (filter === "Pending" ? !r.appointment : !!r.appointment),
  );
  return (
    <section className="request-inbox">
      <div className="portal-tabs">
        {["Pending", "Booked", "All"].map((t) => (
          <button
            key={t}
            aria-pressed={filter === t}
            onClick={() => setFilter(t)}
          >
            {t}
            {t === "Pending" && data
              ? ` (${data.filter((r) => !r.appointment).length})`
              : ""}
          </button>
        ))}
        <button onClick={refresh} aria-label="Refresh requests">
          <RefreshCw size={16} />
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="portal-success" role="status">
          {message}
        </div>
      )}
      {!data && !error && <p role="status">Loading patient requests…</p>}
      {!selected && saveError && (
        <div className="error" role="alert">
          {saveError}
        </div>
      )}
      {data && !rows.length && !selected && (
        <div className="portal-empty">
          <CalendarDays />
          <p>No {filter.toLowerCase()} requests.</p>
        </div>
      )}
      {selected ? (
        <section className="portal-card request-booking">
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              setSelected(null);
              setSaveError("");
            }}
          >
            ← Back to requests
          </button>
          <h2>Schedule {selected.patient?.name}’s visit</h2>
          <p>
            <b>{selected.department}</b> · {selected.issue}
          </p>
          {saveError && (
            <div className="error" role="alert">
              {saveError}
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setSaveError("");
              const values = Object.fromEntries(new FormData(e.currentTarget));
              try {
                await api(`/appointment-requests/${selected._id}/book`, values);
                setSelected(null);
                setMessage(
                  "Appointment confirmed. The patient can now see the confirmation in their portal.",
                );
                await refresh();
                await onBooked();
              } catch (e) {
                setSaveError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <AppointmentFields
              key={selected._id}
              data={{
                ...bookingData,
                patients: [selected.patient],
                doctors: bookingData.doctors.filter(
                  (d) => d.specialty === selected.department,
                ),
              }}
              record={{
                patient: selected.patient?._id,
                reason: selected.issue,
                requestBooking: true,
              }}
              date={day()}
              busy={busy}
            />
          </form>
        </section>
      ) : (
        <div className="request-grid">
          {rows.map((r) => (
            <article className="portal-card" key={r._id}>
              <div className="request-card-title">
                <h3>{r.patient?.name || "Unavailable patient"}</h3>
                <span
                  className={
                    "request-status " + (r.appointment ? "booked" : "pending")
                  }
                >
                  {statusOf(r.appointment)}
                </span>
              </div>
              <b>{r.department}</b>
              <p className="pre-wrap">{r.issue}</p>
              <p className="muted">
                {r.patient?.email}
                <br />
                {r.patient?.phone}
              </p>
              <small className="muted">Requested {stamp(r.createdAt)}</small>
              {r.appointment ? (
                <div className="visit-confirmation">
                  <CalendarDays size={18} />
                  {visitLabel(r.appointment)}
                </div>
              ) : (
                <button
                  className="primary"
                  disabled={busy || !r.patient || r.patient.archived}
                  onClick={async () => {
                    setBusy(true);
                    setSaveError("");
                    setMessage("");
                    try {
                      setBookingData(await api("/data"));
                      setSelected(r);
                    } catch (e) {
                      setSaveError(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Schedule appointment
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

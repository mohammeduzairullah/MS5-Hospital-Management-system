import React, { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Clock,
  Check,
} from "lucide-react";
import {
  TIMES,
  localDate,
  shiftDate,
  weekDates,
  isAvailable,
} from "./scheduling";

export function Field({
  as: Tag = "input",
  children,
  onBlur,
  onChange,
  onInvalid,
  ...props
}) {
  const [error, setError] = useState("");
  const message = (node) =>
    node.validity.valueMissing
      ? "This field is required."
      : node.validity.typeMismatch
        ? "Enter a valid " +
          (node.type === "email" ? "email address." : "value.")
        : node.validationMessage;
  return (
    <span className="field-control">
      <Tag
        {...props}
        aria-invalid={error ? "true" : undefined}
        onBlur={(e) => {
          setError(message(e.target));
          onBlur?.(e);
        }}
        onChange={(e) => {
          if (error) setError(message(e.target));
          onChange?.(e);
        }}
        onInvalid={(e) => {
          setError(message(e.target));
          onInvalid?.(e);
        }}
      >
        {children}
      </Tag>
      {error && (
        <small className="field-error" role="alert">
          {error}
        </small>
      )}
    </span>
  );
}

export function WorkspaceSkeleton() {
  return (
    <div
      className="workspace-skeleton"
      role="status"
      aria-label="Loading workspace"
    >
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-subtitle" />
      <div className="skeleton-cards">
        {[0, 1, 2, 3].map((i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
      <div className="skeleton skeleton-table" />
      <span>Loading your hospital workspace…</span>
    </div>
  );
}

export function AppointmentFields({ data, record, date, busy }) {
  const [doctor, setDoctor] = useState(record?.doctor || ""),
    [day, setDay] = useState(
      record?.date || (date < localDate() ? localDate() : date),
    ),
    [time, setTime] = useState(record?.time || ""),
    [appointments, setAppointments] = useState([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!doctor || !day) return;
    const controller = new AbortController();
    let timer;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/data", {
          signal: controller.signal,
        });
        if (!response.ok)
          throw Error("Could not check availability. Please retry.");
        const result = await response.json();
        if (controller.signal.aborted) return;
        setAppointments(result.appointments);
        setTime((current) =>
          isAvailable(result.appointments, doctor, day, current) ? current : "",
        );
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    timer = setInterval(load, 30000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [doctor, day, retry]);
  const available = TIMES.filter((t) =>
    isAvailable(appointments, doctor, day, t),
  );
  return (
    <>
      <div className="form-grid">
        <label>
          Patient
          <Field
            as="select"
            required
            name="patient"
            defaultValue={record?.patient || ""}
          >
            <option value="">Select patient</option>
            {data.patients.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </Field>
        </label>
        <label>
          Doctor
          <Field
            as="select"
            required
            name="doctor"
            value={doctor}
            onChange={(e) => {
              setDoctor(e.target.value);
              setTime(record?.time || "");
            }}
          >
            <option value="">Select doctor</option>
            {data.doctors.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} · {d.specialty}
              </option>
            ))}
          </Field>
        </label>
      </div>
      <label>
        Date
        <Field
          type="date"
          name="date"
          required
          min={localDate()}
          value={day}
          onChange={(e) => {
            setDay(e.target.value);
            setTime("");
          }}
        />
      </label>
      <fieldset className="time-picker">
        <legend>
          <Clock size={15} /> Available appointment times
        </legend>
        <p className="muted">
          30-minute visits · 09:00–18:00 · Local hospital time
        </p>
        {!doctor ? (
          <div className="slot-hint">
            Choose a doctor to see their available times.
          </div>
        ) : error ? (
          <div className="error" role="alert">
            {error}{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => setRetry((x) => x + 1)}
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div
            className="slot-grid"
            aria-label="Checking availability"
            role="status"
          >
            {TIMES.slice(0, 12).map((t) => (
              <div className="skeleton slot-skeleton" key={t} />
            ))}
          </div>
        ) : (
          <>
            <div className="slot-grid">
              {TIMES.map((t) => {
                const enabled = available.includes(t);
                return (
                  <label
                    key={t}
                    className={`time-slot ${time === t ? "selected" : ""} ${!enabled ? "unavailable" : ""}`}
                  >
                    <input
                      type="radio"
                      name="time"
                      value={t}
                      required
                      disabled={!enabled}
                      checked={time === t}
                      onChange={() => setTime(t)}
                    />
                    <span>
                      {t}
                      {time === t && <Check size={12} />}
                    </span>
                  </label>
                );
              })}
            </div>
            <small>
              {available.length
                ? `${available.length} times available. Unavailable times are disabled.`
                : "No available times. Choose another date or doctor."}
            </small>
            {time && (
              <div className="selection-note">
                <Check size={14} /> Selected: {day} at {time}
              </div>
            )}
          </>
        )}
      </fieldset>
      <label>
        Reason for visit
        <Field
          as="textarea"
          required
          minLength={3}
          maxLength={300}
          name="reason"
          placeholder="What brings the patient in?"
        />
      </label>
      <button
        className="primary appointment-submit"
        disabled={
          busy ||
          !time ||
          loading ||
          !!error ||
          !doctor ||
          !isAvailable(appointments, doctor, day, time)
        }
        type="submit"
      >
        {busy ? "Booking…" : "Book this appointment"}
      </button>
    </>
  );
}

export function AppointmentWorkspace({
  data,
  query,
  date,
  setDate,
  status,
  busy,
  onPatient,
  onBook,
  Table,
}) {
  const [view, setView] = useState("Week"),
    [filter, setFilter] = useState("All"),
    [doctor, setDoctor] = useState("");
  const days = view === "Week" ? weekDates(date) : [date];
  const base = data.appointments.filter(
    (a) =>
      days.includes(a.date) &&
      (!doctor || a.doctor._id === doctor) &&
      JSON.stringify(a).toLowerCase().includes(query.toLowerCase()),
  );
  const visible = base.filter((a) => filter === "All" || a.status === filter);
  const labels = ["All", "Scheduled", "Checked in", "Completed", "Cancelled"];
  return (
    <section className="panel appointment-workspace">
      <div className="calendar-controls">
        <div className="segmented" aria-label="Calendar view">
          {["Day", "Week", "List"].map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              className={view === v ? "selected" : ""}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <select
          aria-label="Filter by doctor"
          value={doctor}
          onChange={(e) => setDoctor(e.target.value)}
        >
          <option value="">All doctors</option>
          {data.doctors.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>
        <div className="calendar-navigation">
          <button
            className="icon-button"
            aria-label="Previous period"
            onClick={() => setDate(shiftDate(date, view === "Week" ? -7 : -1))}
          >
            <ChevronLeft size={17} />
          </button>
          <button className="secondary" onClick={() => setDate(localDate())}>
            Today
          </button>
          <button
            className="icon-button"
            aria-label="Next period"
            onClick={() => setDate(shiftDate(date, view === "Week" ? 7 : 1))}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className="status-tabs" aria-label="Filter visits by status">
        {labels.map((label) => (
          <button
            key={label}
            aria-pressed={filter === label}
            className={filter === label ? "selected" : ""}
            onClick={() => setFilter(label)}
          >
            {label}
            <span>
              {base.filter((a) => label === "All" || a.status === label).length}
            </span>
          </button>
        ))}
      </div>
      <div className="calendar-caption">
        <span>
          <CalendarDays size={15} />
          {new Date(days[0] + "T12:00:00").toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          {view === "Week" &&
            ` – ${new Date(days[6] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
        </span>
        <small>
          {visible.length} visits · Click a visit for the patient record
        </small>
      </div>
      {view === "List" ? (
        <Table
          items={visible}
          status={status}
          busy={busy}
          onPatient={onPatient}
        />
      ) : (
        <div className="calendar-scroll">
          <div
            className={`calendar-grid ${view === "Day" ? "single-day" : ""}`}
            style={{ "--days": days.length }}
          >
            <div className="calendar-corner">TIME</div>
            {days.map((day) => (
              <div
                key={day}
                className={
                  "calendar-day " + (day === localDate() ? "is-today" : "")
                }
              >
                <span>
                  {new Date(day + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "short",
                  })}
                </span>
                <b>{new Date(day + "T12:00:00").getDate()}</b>
              </div>
            ))}
            {TIMES.map((time) => (
              <React.Fragment key={time}>
                <div className="calendar-time">{time}</div>
                {days.map((day) => {
                  const visits = visible.filter(
                    (a) => a.date === day && a.time === time,
                  );
                  const free = data.doctors.filter(
                    (d) =>
                      (!doctor || doctor === d._id) &&
                      isAvailable(data.appointments, d._id, day, time),
                  );
                  return (
                    <div className="calendar-cell" key={day}>
                      {visits.map((a) => (
                        <button
                          key={a._id}
                          className={
                            "calendar-visit " +
                            a.status.toLowerCase().replace(" ", "-")
                          }
                          onClick={() => onPatient(a.patient)}
                          title={`${a.patient.name} · ${a.doctor.name} · ${a.status}`}
                        >
                          <b>{a.patient.name}</b>
                          <span>{a.doctor.name}</span>
                          <small>{a.status}</small>
                        </button>
                      ))}
                      {free.length > 0 ? (
                        <button
                          className="calendar-book"
                          aria-label={`Book ${day} at ${time}${doctor ? " with " + free[0].name : ""}`}
                          onClick={() =>
                            onBook({
                              date: day,
                              time,
                              doctor: doctor || undefined,
                            })
                          }
                        >
                          <Plus size={12} />
                          <span>{visits.length ? "Book" : "Available"}</span>
                        </button>
                      ) : (
                        !visits.length && (
                          <span className="unavailable-cell">—</span>
                        )
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

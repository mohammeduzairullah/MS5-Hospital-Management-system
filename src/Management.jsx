import React, { useState } from "react";
import { Field } from "./Interactions";
import { localDate, shiftDate } from "./scheduling";
import { Plus, Trash2, Upload, Check } from "lucide-react";
export async function request(url, body, method = "POST") {
  const response = await fetch("/api" + url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.message || "Unable to save.");
  return result;
}
function Photo({ value, onChange }) {
  const [error, setError] = useState("");
  return (
    <div className="photo-editor">
      {value ? (
        <img src={value} alt="Profile preview" />
      ) : (
        <div className="photo-placeholder">
          <Upload />
        </div>
      )}
      <div>
        <label className="secondary photo-upload">
          Choose photo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              setError("");
              if (
                !["image/jpeg", "image/png", "image/webp"].includes(
                  file.type,
                ) ||
                file.size > 5 * 1024 * 1024
              ) {
                setError("Choose a JPG, PNG or WebP smaller than 5 MB.");
                return;
              }
              try {
                const bitmap = await createImageBitmap(file);
                const canvas = document.createElement("canvas");
                canvas.width = canvas.height = 256;
                const ctx = canvas.getContext("2d");
                ctx.fillStyle = "#fff";
                ctx.fillRect(0, 0, 256, 256);
                const side = Math.min(bitmap.width, bitmap.height);
                ctx.drawImage(
                  bitmap,
                  (bitmap.width - side) / 2,
                  (bitmap.height - side) / 2,
                  side,
                  side,
                  0,
                  0,
                  256,
                  256,
                );
                bitmap.close();
                onChange(canvas.toDataURL("image/jpeg", 0.85));
              } catch {
                setError("This image could not be read. Try another photo.");
              }
            }}
          />
        </label>
        <small>JPG, PNG or WebP · up to 5 MB</small>
        {value && (
          <button
            type="button"
            className="text-button"
            onClick={() => onChange("")}
          >
            Remove photo
          </button>
        )}
        {error && (
          <small className="field-error" role="alert">
            {error}
          </small>
        )}
      </div>
    </div>
  );
}
export function ManagementForm({
  kind,
  record = {},
  data,
  user,
  onDone,
  onCancel,
}) {
  const [photo, setPhoto] = useState(record.photo || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [createLogin, setCreateLogin] = useState(false),
    [medications, setMedications] = useState(
      record.medications || [
        { name: "", dosage: "", frequency: "", duration: "" },
      ],
    );
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.target));
    try {
      let result;
      if (kind === "manageDoctor")
        result = await request(
          "/doctors" + (record._id ? "/" + record._id : ""),
          { ...f, photo, createLogin },
          record._id ? "PUT" : "POST",
        );
      if (kind === "manageAccount")
        result = await request("/me", { ...f, photo }, "PUT");
      if (kind === "managePrescription")
        result = await request(
          "/prescriptions/" + record._id,
          { ...f, medications },
          "PUT",
        );
      if (kind === "manageAppointment")
        result = await request("/appointments/" + record._id, f, "PUT");
      await onDone(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <form onSubmit={submit}>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <fieldset disabled={busy} className="management-fields">
          {["manageDoctor", "manageAccount"].includes(kind) ? (
            <>
              <Photo value={photo} onChange={setPhoto} />
              <div className="form-grid">
                <label>
                  Full name
                  <Field
                    name="name"
                    required
                    minLength={2}
                    maxLength={100}
                    defaultValue={record.name || ""}
                  />
                </label>
                <label>
                  Email address
                  <Field
                    name="email"
                    type="email"
                    required
                    defaultValue={record.email || ""}
                  />
                </label>
                <label>
                  Phone
                  <Field
                    name="phone"
                    maxLength={25}
                    defaultValue={record.phone || ""}
                  />
                </label>
                {kind === "manageDoctor" && (
                  <label>
                    Specialty
                    <Field
                      name="specialty"
                      required
                      minLength={2}
                      maxLength={100}
                      defaultValue={record.specialty || ""}
                    />
                  </label>
                )}
              </div>
              {kind === "manageDoctor" && (
                <>
                  <label>
                    About this doctor
                    <Field
                      as="textarea"
                      name="bio"
                      maxLength={1500}
                      defaultValue={record.bio || ""}
                    />
                  </label>
                  {record.hasAccount ? (
                    <div className="selection-note">
                      <Check size={15} /> Doctor login enabled. Profile changes
                      also update their account.
                    </div>
                  ) : (
                    <div className="account-setup">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={createLogin}
                          onChange={(e) => setCreateLogin(e.target.checked)}
                        />{" "}
                        Create a doctor login
                      </label>
                      <p className="muted">
                        This doctor can sign in with the email above and see
                        only their assigned patients and appointments.
                      </p>
                      {createLogin && (
                        <label>
                          Initial password
                          <Field
                            name="password"
                            type="password"
                            required
                            minLength={10}
                            maxLength={128}
                            autoComplete="new-password"
                          />
                          <small>
                            At least 10 characters. Share it with the doctor
                            securely.
                          </small>
                        </label>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <div className="form-grid">
                <label>
                  Patient
                  <Field
                    as="select"
                    name="patient"
                    required
                    defaultValue={record.patient?._id}
                  >
                    {data.patients
                      .filter(
                        (p) =>
                          kind !== "manageAppointment" ||
                          user.role !== "Doctor" ||
                          p._id === record.patient?._id,
                      )
                      .map((p) => (
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
                    name="doctor"
                    required
                    defaultValue={record.doctor?._id}
                  >
                    {data.doctors.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </Field>
                </label>
              </div>
              {kind === "managePrescription" ? (
                <>
                  <label>
                    Diagnosis
                    <Field
                      name="diagnosis"
                      required
                      minLength={3}
                      maxLength={500}
                      defaultValue={record.diagnosis}
                    />
                  </label>
                  <h3>Medications</h3>
                  {medications.map((m, i) => (
                    <div className="medicine-row" key={i}>
                      {["name", "dosage", "frequency", "duration"].map(
                        (key) => (
                          <label key={key}>
                            {key}
                            <Field
                              required
                              maxLength={100}
                              value={m[key]}
                              onChange={(e) =>
                                setMedications(
                                  medications.map((old, index) =>
                                    index === i
                                      ? { ...old, [key]: e.target.value }
                                      : old,
                                  ),
                                )
                              }
                            />
                          </label>
                        ),
                      )}
                      {medications.length > 1 && (
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Remove medication"
                          onClick={() =>
                            setMedications(
                              medications.filter((_, index) => index !== i),
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-button"
                    disabled={medications.length >= 20}
                    onClick={() =>
                      setMedications([
                        ...medications,
                        { name: "", dosage: "", frequency: "", duration: "" },
                      ])
                    }
                  >
                    <Plus size={14} /> Add medication
                  </button>
                  <label>
                    Instructions
                    <Field
                      as="textarea"
                      name="notes"
                      maxLength={2000}
                      defaultValue={record.notes}
                    />
                  </label>
                </>
              ) : (
                <>
                  <div className="form-grid">
                    <label>
                      Date
                      <Field
                        type="date"
                        name="date"
                        required
                        min={localDate()}
                        defaultValue={record.date}
                      />
                    </label>
                    <label>
                      Time
                      <Field
                        type="time"
                        name="time"
                        required
                        min="09:00"
                        max="17:30"
                        step="1800"
                        defaultValue={record.time}
                      />
                    </label>
                  </div>
                  <label>
                    Reason
                    <Field
                      as="textarea"
                      name="reason"
                      required
                      minLength={3}
                      maxLength={300}
                      defaultValue={record.reason}
                    />
                  </label>
                  <p className="muted">
                    The doctor’s availability is checked when you save.
                  </p>
                </>
              )}
            </>
          )}
        </fieldset>
        <div className="form-actions">
          <button
            type="button"
            className="secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
      {kind === "manageAccount" && user.role === "Administrator" && (
        <PasswordForm />
      )}
    </>
  );
}
function PasswordForm() {
  const [expanded, setExpanded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  return (
    <section className="password-settings">
      <button
        type="button"
        className="text-button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        Change password
      </button>
      {expanded && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const values = Object.fromEntries(new FormData(form));
            setError("");
            setSuccess("");
            if (values.newPassword !== values.confirmPassword) {
              setError("New passwords do not match.");
              return;
            }
            setBusy(true);
            try {
              const result = await request("/me/password", values, "PUT");
              form.reset();
              setSuccess(result.message);
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="muted">
            Enter your current password. Use at least 10 characters for your new
            password. Changing it signs out your other sessions.
          </p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="selection-note" role="status">
              {success}
            </div>
          )}
          <fieldset disabled={busy} className="management-fields">
            <label>
              Current password
              <Field
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                maxLength={128}
              />
            </label>
            <label>
              New password
              <Field
                name="newPassword"
                type="password"
                required
                minLength={10}
                maxLength={72}
                autoComplete="new-password"
              />
            </label>
            <label>
              Confirm new password
              <Field
                name="confirmPassword"
                type="password"
                required
                minLength={10}
                maxLength={72}
                autoComplete="new-password"
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Changing password…" : "Update password"}
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
export function RemoveRecord({ record, onDone, onCancel }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <p>
        Remove <b>{record.name}</b> from active records?
      </p>
      <p className="muted removal-explanation">
        {record.collection === "patients"
          ? "Their active appointments will be cancelled."
          : record.collection === "doctors"
            ? "Their login will be disabled. Active appointments must be cancelled or completed first."
            : ""}{" "}
        Records are archived in the database to preserve history.
      </p>
      <div className="form-actions">
        <button className="secondary" disabled={busy} onClick={onCancel}>
          Keep record
        </button>
        <button
          className="danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await request(
                "/" + record.collection + "/" + record._id,
                null,
                "DELETE",
              );
              await onDone();
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Removing…" : "Remove record"}
        </button>
      </div>
    </div>
  );
}
export function DoctorStats({ data }) {
  const [start, setStart] = useState(shiftDate(localDate(), -6)),
    [end, setEnd] = useState(localDate());
  const days =
    Math.floor(
      (new Date(end + "T12:00:00") - new Date(start + "T12:00:00")) / 86400000,
    ) + 1;
  const valid = Number.isFinite(days) && days > 0 && days <= 366;
  const colors = {
    Available: "free",
    Scheduled: "booked",
    "Checked in": "waiting",
    Completed: "finished",
  };
  return (
    <section className="panel doctor-stats">
      <div className="panel-heading">
        <div>
          <h2>Doctor workload</h2>
          <p>Appointment capacity and visit progress</p>
        </div>
        <div className="stats-dates">
          <label>
            From
            <input
              aria-label="Statistics start date"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            To
            <input
              aria-label="Statistics end date"
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="chart-legend">
        {Object.entries(colors).map(([label, color]) => (
          <span key={label}>
            <i className={color} />
            {label}
          </span>
        ))}
      </div>
      {!valid ? (
        <p className="error">Choose a date range of 1–366 days.</p>
      ) : (
        data.doctors.map((d) => {
          const visits = data.appointments.filter(
            (a) =>
              a.doctor._id === d._id &&
              a.date >= start &&
              a.date <= end &&
              a.status !== "Cancelled",
          );
          const slots = new Map();
          const priority = { Completed: 1, Scheduled: 2, "Checked in": 3 };
          for (const a of visits) {
            const key = a.date + a.time;
            if (
              !slots.has(key) ||
              priority[a.status] > priority[slots.get(key)]
            )
              slots.set(key, a.status);
          }
          const capacity = days * 18;
          const counts = {
            Available: Math.max(0, capacity - slots.size),
            Scheduled: 0,
            "Checked in": 0,
            Completed: 0,
          };
          for (const status of slots.values()) counts[status]++;
          return (
            <div className="doctor-stat-row" key={d._id}>
              <div className="doctor-stat-title">
                <b>{d.name}</b>
                <small>
                  {d.specialty} ·{" "}
                  {visits.filter((a) => a.status === "Completed").length}{" "}
                  completed visits
                </small>
              </div>
              <div
                className="workload-bar"
                role="img"
                aria-label={
                  d.name +
                  ": " +
                  Object.entries(counts)
                    .map(([key, count]) => `${key} ${count / 2} hours`)
                    .join(", ")
                }
              >
                {Object.entries(counts).map(
                  ([label, count]) =>
                    count > 0 && (
                      <div
                        key={label}
                        className={colors[label]}
                        style={{ width: `${(count / capacity) * 100}%` }}
                        title={`${label}: ${count / 2} hours`}
                      />
                    ),
                )}
              </div>
              <div className="workload-values">
                {Object.entries(counts).map(([label, count]) => (
                  <span key={label}>
                    {label}: <b>{count / 2}h</b>
                  </span>
                ))}
              </div>
            </div>
          );
        })
      )}
      <p className="chart-note">
        Planning estimate: 18 half-hour slots per doctor per day, 09:00–18:00,
        including weekends. Leave and breaks are not tracked. Cancelled visits
        are excluded; each slot is counted once, with active bookings taking
        priority. “Available” means unbooked capacity, including past dates—not
        measured attendance or quality of care.
      </p>
    </section>
  );
}

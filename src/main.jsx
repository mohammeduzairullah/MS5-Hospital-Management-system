import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  LayoutDashboard,
  CalendarDays,
  Users,
  FileText,
  Stethoscope,
  Search,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Clock,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
  Check,
  Heart,
  Printer,
  Trash2,
  Menu,
} from "lucide-react";
import "./styles.css";
import "./management.css";
import { ManagementForm, RemoveRecord, DoctorStats } from "./Management";
import "./interactions.css";
import {
  AppointmentFields,
  AppointmentWorkspace,
  Field,
  WorkspaceSkeleton,
} from "./Interactions";
const today = () => new Date().toLocaleDateString("en-CA");
const initials = (n) =>
  n
    .replace("Dr. ", "")
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
const pretty = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
async function api(url, body, method = "POST") {
  const r = await fetch("/api" + url, {
    method: body ? method : "GET",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r
    .json()
    .catch(() => ({ message: "Unable to connect to the server." }));
  if (!r.ok) throw Error(d.message);
  return d;
}
function Avatar({ name, color = "", photo }) {
  if (photo)
    return <img className={"avatar " + color} src={photo} alt={name} />;
  return <span className={"avatar " + color}>{initials(name)}</span>;
}
function App() {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [data, setData] = useState({
      patients: [],
      doctors: [],
      appointments: [],
      prescriptions: [],
    }),
    [page, setPage] = useState("Overview"),
    [query, setQuery] = useState(""),
    [date, setDate] = useState(today()),
    [modal, setModal] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [refreshing, setRefreshing] = useState(false);
  async function refresh() {
    setRefreshing(true);
    try {
      setData(await api("/data"));
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => {
    api("/me")
      .then(async (u) => {
        setUser(u);
        await refresh();
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 4000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement;
    const dialog = document.querySelector('[role="dialog"]');
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll(
          'button:not(:disabled),input,select,textarea,[tabindex="0"]',
        ),
      );
    focusable()[0]?.focus();
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) setModal(null);
      if (e.key === "Tab") {
        const elements = focusable();
        const first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [modal, busy]);
  const open = (type, record) => {
    setError("");
    if (
      user?.role === "Doctor" &&
      ["appointment", "prescription"].includes(type)
    )
      record = { ...record, doctor: String(user.doctor) };
    setModal({ type, record });
  };
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.target));
    try {
      if (modal.type === "patient")
        await api(
          "/patients" + (modal.record ? "/" + modal.record._id : ""),
          f,
          modal.record ? "PUT" : "POST",
        );
      if (modal.type === "appointment") await api("/appointments", f);
      if (modal.type === "prescription") {
        const medications = Array.from(
          e.target.querySelectorAll(".medicine-row"),
        ).map((row) =>
          Object.fromEntries(
            Array.from(row.querySelectorAll("input")).map((i) => [
              i.dataset.field,
              i.value,
            ]),
          ),
        );
        await api("/prescriptions", {
          patient: f.patient,
          doctor: f.doctor,
          diagnosis: f.diagnosis,
          notes: f.notes,
          medications,
        });
      }
      await refresh();
      setModal(null);
      setNotice("Saved successfully");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function status(a, status) {
    setBusy(true);
    try {
      await api("/appointments/" + a._id, { status }, "PATCH");
      await refresh();
      setNotice("Appointment updated");
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <WorkspaceSkeleton />;
  if (!user)
    return (
      <Login
        onLogin={async (u) => {
          setUser(u);
          await refresh();
        }}
      />
    );
  const filtered = (items) =>
    items.filter((x) =>
      JSON.stringify(x).toLowerCase().includes(query.toLowerCase()),
    );
  const appointments = filtered(
    data.appointments.filter((a) => a.date === date),
  );
  const scheduled = data.appointments.filter((a) => a.date === today());
  return (
    <div className="app">
      <aside className={mobile ? "sidebar visible" : "sidebar"}>
        <a className="brand" href="#" onClick={() => setPage("Overview")}>
          <span className="logo">
            <Activity size={24} />
          </span>
          careflow<span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <span className="hospital-icon">H</span>
          <div>
            Evergreen Hospital
            <small>
              {user.role === "Doctor" ? "Doctor workspace" : "Staff workspace"}
            </small>
          </div>
          <span className="live-dot" />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {[
            [LayoutDashboard, "Overview"],
            [CalendarDays, "Appointments"],
            [Users, "Patients"],
            [FileText, "Prescriptions"],
            [Stethoscope, "Doctors"],
            [Activity, "Statistics"],
          ].map(([Icon, label]) => (
            <button
              key={label}
              className={page === label ? "nav active" : "nav"}
              onClick={() => {
                setPage(label);
                setQuery("");
                setMobile(false);
              }}
            >
              <Icon size={19} />
              {label}
              {label === "Appointments" && (
                <span className="nav-count">{scheduled.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card">
            <span className="demo-tag">PORTFOLIO EDITION</span>
            <h4>Better care starts here.</h4>
            <p>A connected workspace for every step of the patient journey.</p>
            <Heart size={24} />
          </div>
          <button
            className="account"
            onClick={() => open("manageAccount", user)}
          >
            <Avatar name={user.name} photo={user.photo} />
            <span>
              {user.name}
              <small>{user.role}</small>
            </span>
            <ArrowUpRight size={17} />
          </button>
          <button
            className="sign-out text-button"
            onClick={async () => {
              await api("/logout", {});
              setUser(null);
              setPage("Overview");
            }}
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>
      <div className="main">
        <header>
          <button
            className="mobile-menu icon-button"
            aria-label="Open navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span> <b>{page}</b>
          </div>
          <div className="header-right">
            <span className="demo-pill">
              <span /> Demo environment
            </span>
            <span className="header-date">
              {new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <button
              className="icon-button"
              aria-label="My profile"
              onClick={() => open("manageAccount", user)}
            >
              <Avatar name={user.name} photo={user.photo} />
            </button>
          </div>
        </header>
        <main aria-busy={refreshing}>
          {refreshing && (
            <div
              className="refresh-progress"
              role="status"
              aria-label="Updating records"
            />
          )}
          <div className="page-content" key={page}>
            <div className="page-heading">
              <div>
                <div className="eyebrow">EVERGREEN HOSPITAL</div>
                <h1>
                  {page === "Overview"
                    ? "A good day to make a difference."
                    : page}
                </h1>
                <p>
                  {
                    {
                      Overview:
                        "Here’s what’s happening across your hospital today.",
                      Appointments:
                        "Keep every visit organized, from booking to follow-up.",
                      Patients:
                        "A complete picture of every patient, in one place.",
                      Prescriptions:
                        "Clear care plans. Connected patient records.",
                      Doctors: "Meet the people behind exceptional care.",
                      Statistics:
                        "Understand capacity, appointments, and completed visits.",
                    }[page]
                  }
                </p>
              </div>
              {page !== "Statistics" &&
                !(
                  user.role === "Doctor" &&
                  ["Doctors", "Patients"].includes(page)
                ) && (
                  <button
                    className="primary"
                    onClick={() =>
                      open(
                        page === "Doctors"
                          ? "manageDoctor"
                          : page === "Patients"
                            ? "patient"
                            : page === "Prescriptions"
                              ? "prescription"
                              : "appointment",
                      )
                    }
                  >
                    <Plus size={18} />
                    {page === "Doctors"
                      ? "Add doctor"
                      : page === "Patients"
                        ? "Add patient"
                        : page === "Prescriptions"
                          ? "New prescription"
                          : "New appointment"}
                  </button>
                )}
            </div>
            {page === "Overview" && (
              <>
                <div className="stats">
                  {[
                    [
                      CalendarDays,
                      "Today’s appointments",
                      scheduled.length,
                      "Across all departments",
                      "teal",
                    ],
                    [
                      Users,
                      "Registered patients",
                      data.patients.length,
                      "Connected patient records",
                      "blue",
                    ],
                    [
                      Stethoscope,
                      "Care team",
                      data.doctors.length,
                      "Specialists on your team",
                      "purple",
                    ],
                    [
                      Check,
                      "Completed visits",
                      scheduled.filter((a) => a.status === "Completed").length,
                      "Today’s care delivered",
                      "orange",
                    ],
                  ].map(([Icon, label, value, caption, color]) => (
                    <div className="stat" key={label}>
                      <div className="stat-top">
                        <span>{label}</span>
                        <span className={"stat-icon " + color}>
                          <Icon size={19} />
                        </span>
                      </div>
                      <strong>{value.toString().padStart(2, "0")}</strong>
                      <small>{caption}</small>
                    </div>
                  ))}
                </div>
                <div className="overview-grid">
                  <section className="panel schedule">
                    <div className="panel-heading">
                      <div>
                        <h2>Appointment activity</h2>
                        <p>Your daily care schedule at a glance</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => setPage("Appointments")}
                      >
                        View all <ArrowUpRight size={16} />
                      </button>
                    </div>
                    <div className="schedule-toolbar">
                      <div className="date-navigation">
                        <button
                          aria-label="Previous day"
                          onClick={() => {
                            const d = new Date(date + "T12:00:00");
                            d.setDate(d.getDate() - 1);
                            setDate(d.toLocaleDateString("en-CA"));
                          }}
                        >
                          <ChevronLeft size={17} />
                        </button>
                        <Field
                          aria-label="Schedule date"
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                        />
                        <button
                          aria-label="Next day"
                          onClick={() => {
                            const d = new Date(date + "T12:00:00");
                            d.setDate(d.getDate() + 1);
                            setDate(d.toLocaleDateString("en-CA"));
                          }}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </div>
                      <span className="muted">
                        {appointments.length} appointments
                      </span>
                    </div>
                    <AppointmentTable
                      items={appointments}
                      onEdit={(a) => open("manageAppointment", a)}
                      onRemove={(a) =>
                        open("removeRecord", {
                          ...a,
                          name: a.patient.name + " visit",
                          collection: "appointments",
                        })
                      }
                      onPatient={(p) => open("profile", p)}
                      status={status}
                      busy={busy}
                    />
                  </section>
                  <div className="right-column">
                    <section className="welcome-card">
                      <span className="welcome-icon">
                        <Heart size={24} />
                      </span>
                      <div className="eyebrow">CARE, WITHOUT THE CLUTTER</div>
                      <h2>
                        More time for
                        <br />
                        what matters.
                      </h2>
                      <p>
                        Bring your patients, appointments, and care plans
                        together.
                      </p>
                      <button
                        onClick={() =>
                          user.role === "Doctor"
                            ? setPage("Patients")
                            : open("patient")
                        }
                      >
                        {user.role === "Doctor"
                          ? "View my patients"
                          : "Register a patient"}{" "}
                        <ArrowRight size={17} />
                      </button>
                      <div className="orb one" />
                      <div className="orb two" />
                    </section>
                    <section className="panel team">
                      <div className="panel-heading">
                        <h2>Your care team</h2>
                        <span className="count">{data.doctors.length}</span>
                      </div>
                      {data.doctors.slice(0, 3).map((d) => (
                        <div className="doctor-mini" key={d._id}>
                          <Avatar
                            name={d.name}
                            color={d.color}
                            photo={d.photo}
                          />
                          <div>
                            <b>{d.name}</b>
                            <small>{d.specialty}</small>
                          </div>
                          <span className="live-dot" />
                        </div>
                      ))}
                      <button
                        className="team-link"
                        onClick={() => setPage("Doctors")}
                      >
                        Meet the team <ArrowRight size={16} />
                      </button>
                    </section>
                  </div>
                </div>
                <section className="panel recent">
                  <div className="panel-heading">
                    <div>
                      <h2>Recently registered patients</h2>
                      <p>Every record is the start of better care</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setPage("Patients")}
                    >
                      View directory <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <div className="recent-grid">
                    {data.patients.slice(0, 4).map((p) => (
                      <button
                        className="patient-mini"
                        key={p._id}
                        onClick={() => open("profile", p)}
                      >
                        <Avatar name={p.name} />
                        <div>
                          <b>{p.name}</b>
                          <small>
                            {p.gender} · {p.bloodGroup}
                          </small>
                        </div>
                        <ArrowUpRight size={17} />
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
            {page !== "Overview" && (
              <>
                {page === "Statistics" && <DoctorStats data={data} />}
                {page !== "Statistics" && (
                  <div className="list-toolbar">
                    <div className="search">
                      <Search size={18} />
                      <Field
                        aria-label="Search records"
                        placeholder={"Search " + page.toLowerCase() + "…"}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    {page === "Appointments" && (
                      <Field
                        aria-label="Appointment date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    )}
                    <span className="muted">
                      {page === "Appointments"
                        ? pretty(date)
                        : "Your hospital directory"}
                    </span>
                  </div>
                )}
                {page === "Appointments" && (
                  <AppointmentWorkspace
                    data={data}
                    query={query}
                    date={date}
                    setDate={setDate}
                    status={status}
                    busy={busy}
                    onPatient={(p) => open("profile", p)}
                    onBook={(record) => open("appointment", record)}
                    Table={(props) => (
                      <AppointmentTable
                        {...props}
                        onEdit={(a) => open("manageAppointment", a)}
                        onRemove={(a) =>
                          open("removeRecord", {
                            ...a,
                            name: a.patient.name + " visit",
                            collection: "appointments",
                          })
                        }
                      />
                    )}
                  />
                )}
                {page === "Patients" && (
                  <section className="panel table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Patient</th>
                          <th>Contact</th>
                          <th>Date of birth</th>
                          <th>Blood group</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {filtered(data.patients).map((p) => (
                          <tr key={p._id}>
                            <td>
                              <div className="person">
                                <Avatar name={p.name} />
                                <div>
                                  <b>{p.name}</b>
                                  <small>{p.gender}</small>
                                </div>
                              </div>
                            </td>
                            <td>
                              {p.email}
                              <small>{p.phone}</small>
                            </td>
                            <td>{pretty(p.dob)}</td>
                            <td>
                              <span className="blood">{p.bloodGroup}</span>
                            </td>
                            <td>
                              <button
                                className="text-button"
                                onClick={() => open("profile", p)}
                              >
                                View record <ArrowUpRight size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!filtered(data.patients).length && (
                      <Empty text="No patients found" />
                    )}
                  </section>
                )}
                {page === "Doctors" && (
                  <div className="doctor-grid">
                    {filtered(data.doctors).map((d) => (
                      <section className="panel doctor-card" key={d._id}>
                        <Avatar name={d.name} color={d.color} photo={d.photo} />
                        <h2>{d.name}</h2>
                        <p>{d.specialty}</p>
                        <small>{d.email || "No email added"}</small>
                        <small>{d.phone}</small>
                        {d.bio && <p className="doctor-bio">{d.bio}</p>}
                        <span className="account-badge">
                          {d.hasAccount
                            ? "Doctor login enabled"
                            : "Directory only"}
                        </span>
                        {user.role === "Administrator" && (
                          <div className="record-actions">
                            <button
                              className="text-button"
                              onClick={() => open("manageDoctor", d)}
                            >
                              Edit / account
                            </button>
                            <button
                              className="text-button danger-text"
                              onClick={() =>
                                open("removeRecord", {
                                  ...d,
                                  collection: "doctors",
                                })
                              }
                            >
                              Remove
                            </button>
                          </div>
                        )}
                        <div className="doctor-detail">
                          <span>Appointments today</span>
                          <b>
                            {
                              scheduled.filter((a) => a.doctor._id === d._id)
                                .length
                            }
                          </b>
                        </div>
                        <button
                          className="secondary"
                          onClick={() => open("appointment", { doctor: d._id })}
                        >
                          <CalendarDays size={16} /> Book appointment
                        </button>
                      </section>
                    ))}
                  </div>
                )}
                {page === "Prescriptions" && (
                  <div className="prescription-grid">
                    {filtered(data.prescriptions).map((p) => (
                      <section className="panel prescription-card" key={p._id}>
                        <div className="panel-heading">
                          <span className="stat-icon teal">
                            <FileText size={21} />
                          </span>
                          <small>
                            {new Date(p.createdAt).toLocaleDateString()}
                          </small>
                        </div>
                        <h2>{p.patient.name}</h2>
                        <p>{p.diagnosis}</p>
                        <small>
                          {p.doctor.name} · {p.medications.length} medication(s)
                        </small>
                        <button
                          className="secondary"
                          onClick={() => open("viewPrescription", p)}
                        >
                          View / print <ArrowRight size={16} />
                        </button>
                        <div className="record-actions">
                          <button
                            className="text-button"
                            onClick={() => open("managePrescription", p)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-button danger-text"
                            onClick={() =>
                              open("removeRecord", {
                                ...p,
                                name: p.diagnosis,
                                collection: "prescriptions",
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </section>
                    ))}
                    {!filtered(data.prescriptions).length && (
                      <Empty text="No prescriptions yet. Create the first care plan." />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <footer>
            <span>
              <Activity size={14} /> Careflow · Thoughtful care, connected.
            </span>
            <span>Portfolio demo · Fictional patient data</span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {modal && (
        <div
          className={
            "modal-overlay " +
            (modal.type === "profile" ? "drawer-overlay" : "")
          }
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setModal(null);
          }}
        >
          <section
            className={
              "modal " +
              (modal.type === "profile" ? "patient-drawer " : "") +
              (["profile", "viewPrescription"].includes(modal.type)
                ? "wide"
                : "")
            }
            role="dialog"
            aria-modal="true"
            aria-label={modal.type}
          >
            <div className="modal-heading">
              <h2>
                {
                  {
                    patient: modal.record
                      ? "Edit patient"
                      : "Register a patient",
                    appointment: "Book an appointment",
                    prescription: "New prescription",
                    profile: "Patient record",
                    manageDoctor: modal.record
                      ? "Edit doctor / account"
                      : "Add doctor",
                    manageAccount: "My profile",
                    managePrescription: "Edit prescription",
                    manageAppointment: "Edit appointment",
                    removeRecord: "Remove record",
                    viewPrescription: "Prescription",
                  }[modal.type]
                }
              </h2>
              <button
                className="icon-button"
                aria-label="Close dialog"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                <X />
              </button>
            </div>
            {modal.type.startsWith("manage") && (
              <ManagementForm
                key={modal.type + (modal.record?._id || "")}
                kind={modal.type}
                record={modal.record}
                data={data}
                user={user}
                onCancel={() => setModal(null)}
                onDone={async (result) => {
                  if (modal.type === "manageAccount") setUser(result);
                  await refresh();
                  setModal(null);
                  setNotice("Changes saved");
                }}
              />
            )}
            {modal.type === "removeRecord" && (
              <RemoveRecord
                record={modal.record}
                onCancel={() => setModal(null)}
                onDone={async () => {
                  await refresh();
                  setModal(null);
                  setNotice("Record removed");
                }}
              />
            )}
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            {["patient", "appointment", "prescription"].includes(
              modal.type,
            ) && (
              <form onSubmit={save}>
                {modal.type === "patient" ? (
                  <PatientFields record={modal.record} />
                ) : modal.type === "appointment" ? (
                  <AppointmentFields
                    data={data}
                    record={modal.record}
                    date={date}
                    busy={busy}
                  />
                ) : (
                  <>
                    <div className="form-grid">
                      <label>
                        Patient
                        <Field
                          as="select"
                          required
                          name="patient"
                          defaultValue={modal.record?.patient || ""}
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
                          defaultValue={modal.record?.doctor || ""}
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
                    <>
                      <label>
                        Diagnosis
                        <Field
                          required
                          minLength={3}
                          maxLength={500}
                          name="diagnosis"
                        />
                      </label>
                      <Medicines />
                      <label>
                        Instructions / follow-up
                        <Field as="textarea" name="notes" maxLength={2000} />
                      </label>
                    </>
                  </>
                )}
                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  {modal.type !== "appointment" && (
                    <button className="primary" disabled={busy}>
                      {busy
                        ? "Saving…"
                        : "Save " +
                          (modal.type === "patient" ? "patient" : modal.type)}
                    </button>
                  )}
                </div>
              </form>
            )}
            {modal.type === "profile" && (
              <>
                <div className="profile-head">
                  <Avatar name={modal.record.name} />
                  <div>
                    <h2>{modal.record.name}</h2>
                    <p>
                      {modal.record.gender} · Born {pretty(modal.record.dob)} ·{" "}
                      {modal.record.bloodGroup}
                    </p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => open("patient", modal.record)}
                  >
                    Edit record
                  </button>
                </div>
                {user.role === "Administrator" && (
                  <button
                    className="text-button danger-text"
                    onClick={() =>
                      open("removeRecord", {
                        ...modal.record,
                        collection: "patients",
                      })
                    }
                  >
                    Remove patient
                  </button>
                )}
                <div className="profile-details">
                  <div>
                    <small>Email</small>
                    {modal.record.email}
                  </div>
                  <div>
                    <small>Phone</small>
                    {modal.record.phone}
                  </div>
                  <div>
                    <small>Allergies</small>
                    {modal.record.allergies || "Not recorded"}
                  </div>
                  <div>
                    <small>Medical history</small>
                    {modal.record.history || "Not recorded"}
                  </div>
                </div>
                <h3>Visit history</h3>
                {data.appointments
                  .filter((a) => a.patient._id === modal.record._id)
                  .map((a) => (
                    <div className="history-row" key={a._id}>
                      <span>
                        {pretty(a.date)} · {a.time}
                        <small>
                          {a.doctor.name} · {a.reason}
                        </small>
                      </span>
                      <Badge status={a.status} />
                    </div>
                  ))}
                {!data.appointments.some(
                  (a) => a.patient._id === modal.record._id,
                ) && <p className="muted">No visits recorded.</p>}
                <h3>Prescriptions</h3>
                {data.prescriptions
                  .filter((p) => p.patient._id === modal.record._id)
                  .map((p) => (
                    <button
                      className="history-row prescription-link"
                      key={p._id}
                      onClick={() => open("viewPrescription", p)}
                    >
                      {p.diagnosis}
                      <ArrowUpRight size={17} />
                    </button>
                  ))}
                {!data.prescriptions.some(
                  (p) => p.patient._id === modal.record._id,
                ) && <p className="muted">No prescriptions recorded.</p>}
                <div className="form-actions">
                  <button
                    className="primary"
                    onClick={() =>
                      open("appointment", { patient: modal.record._id })
                    }
                  >
                    Book appointment
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      open("prescription", { patient: modal.record._id })
                    }
                  >
                    New prescription
                  </button>
                </div>
              </>
            )}
            {modal.type === "viewPrescription" && (
              <Prescription record={modal.record} />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Badge({ status }) {
  return (
    <span className={"badge " + status.toLowerCase().replace(" ", "-")}>
      <i />
      {status}
    </span>
  );
}
function Empty({ text }) {
  return (
    <div className="empty">
      <FileText size={28} />
      <p>{text}</p>
    </div>
  );
}
function AppointmentTable({
  items,
  status,
  busy,
  onPatient,
  onEdit,
  onRemove,
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Patient</th>
            <th>Doctor / Department</th>
            <th>Time</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a._id}>
              <td>
                <div className="person">
                  <Avatar name={a.patient.name} />
                  <div>
                    <button
                      type="button"
                      className="patient-name-link"
                      onClick={() => onPatient?.(a.patient)}
                    >
                      {a.patient.name}
                    </button>
                    <small>{a.reason}</small>
                  </div>
                </div>
              </td>
              <td>
                <b>{a.doctor.name}</b>
                <small>{a.doctor.specialty}</small>
              </td>
              <td>
                <span className="time">
                  <Clock size={13} />
                  {a.time}
                </span>
              </td>
              <td>
                <Badge status={a.status} />
              </td>
              <td>
                {onEdit && a.status === "Scheduled" && (
                  <button className="text-button" onClick={() => onEdit(a)}>
                    Edit
                  </button>
                )}
                {onRemove && (
                  <button
                    className="text-button danger-text"
                    onClick={() => onRemove(a)}
                  >
                    Remove
                  </button>
                )}
                {["Scheduled", "Checked in"].includes(a.status) && (
                  <Field
                    as="select"
                    className="status-select"
                    aria-label={"Update appointment for " + a.patient.name}
                    disabled={busy}
                    value=""
                    onChange={(e) => status(a, e.target.value)}
                  >
                    <option value="">Update</option>
                    <option>
                      {a.status === "Scheduled" ? "Checked in" : "Completed"}
                    </option>
                    <option>Cancelled</option>
                  </Field>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && (
        <Empty text="No appointments for this day. A little room for more care." />
      )}
    </div>
  );
}
function PatientFields({ record: r = {} }) {
  return (
    <>
      <div className="form-grid">
        {[
          ["Full name", "name", "text"],
          ["Email address", "email", "email"],
          ["Phone number", "phone", "tel"],
          ["Date of birth", "dob", "date"],
        ].map(([label, name, type]) => (
          <label key={name}>
            {label}
            <Field
              required
              name={name}
              type={type}
              defaultValue={r[name]}
              max={type === "date" ? today() : undefined}
              maxLength={name === "name" ? 100 : name === "phone" ? 25 : 254}
            />
          </label>
        ))}
        <label>
          Gender
          <Field as="select" name="gender" defaultValue={r.gender || "Female"}>
            {["Female", "Male", "Other"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </Field>
        </label>
        <label>
          Blood group
          <Field
            as="select"
            name="bloodGroup"
            defaultValue={r.bloodGroup || "Unknown"}
          >
            {["Unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
              (v) => (
                <option key={v}>{v}</option>
              ),
            )}
          </Field>
        </label>
      </div>
      <label>
        Allergies
        <Field
          name="allergies"
          maxLength={500}
          defaultValue={r.allergies}
          placeholder="List known allergies, or none reported"
        />
      </label>
      <label>
        Medical history
        <Field
          as="textarea"
          name="history"
          maxLength={3000}
          defaultValue={r.history}
          placeholder="Relevant conditions and previous care"
        />
      </label>
    </>
  );
}
function Medicines() {
  const [rows, setRows] = useState([0]);
  return (
    <div className="medicines">
      <h3>Medications</h3>
      {rows.map((id) => (
        <div className="medicine-row" key={id}>
          {["name", "dosage", "frequency", "duration"].map((field) => (
            <label key={field}>
              {field === "name" ? "Medicine" : field}
              <Field
                required
                maxLength={100}
                data-field={field}
                placeholder={
                  {
                    name: "Medicine name",
                    dosage: "e.g. 500 mg",
                    frequency: "e.g. Once daily",
                    duration: "e.g. 5 days",
                  }[field]
                }
              />
            </label>
          ))}
          {rows.length > 1 && (
            <button
              type="button"
              className="icon-button"
              aria-label="Remove medication"
              onClick={() => setRows(rows.filter((x) => x !== id))}
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="text-button"
        disabled={rows.length >= 20}
        onClick={() => setRows([...rows, Math.max(...rows) + 1])}
      >
        <Plus size={16} /> Add medication
      </button>
    </div>
  );
}
function Prescription({ record: p }) {
  return (
    <div className="print-record">
      <div className="rx-brand">
        <Activity /> Careflow / Evergreen Hospital{" "}
        <span>DEMO PRESCRIPTION</span>
      </div>
      <h2>{p.patient.name}</h2>
      <p>
        {p.doctor.name} · {p.doctor.specialty}
        <br />
        {new Date(p.createdAt).toLocaleDateString()}
      </p>
      <div className="diagnosis">
        <small>DIAGNOSIS</small>
        <h3>{p.diagnosis}</h3>
      </div>
      <table>
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Dosage</th>
            <th>Frequency</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          {p.medications.map((m, i) => (
            <tr key={i}>
              <td>{m.name}</td>
              <td>{m.dosage}</td>
              <td>{m.frequency}</td>
              <td>{m.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Instructions</h3>
      <p className="pre-wrap">{p.notes || "No additional instructions."}</p>
      <p className="muted">
        Fictional portfolio record. Not valid for dispensing medication.
      </p>
      <button className="primary no-print" onClick={() => window.print()}>
        <Printer size={17} /> Print prescription
      </button>
      <a
        className="secondary no-print pdf-download"
        href={"/api/prescriptions/" + p._id + "/pdf"}
        download
      >
        Download PDF
      </a>
      <small className="no-print print-help">
        No print dialog? Download the PDF and print it from your PDF viewer.
      </small>
    </div>
  );
}
function Login({ onLogin }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="login">
      <div className="login-story">
        <a className="brand">
          <span className="logo">
            <Activity />
          </span>
          careflow.
        </a>
        <div>
          <span className="eyebrow">A HEALTHIER WAY TO WORK</span>
          <h1>
            <span className="login-headline-line">Exceptional care.</span>
            <span className="login-headline-line">Beautifully connected.</span>
          </h1>
          <p>
            Your patients, appointments, and care plans.
            <br />
            One thoughtful workspace.
          </p>
          <div className="login-feature">
            <Check /> Patient records <Check /> Appointments <Check />{" "}
            Prescriptions
          </div>
        </div>
        <small>Built for better days at Evergreen Hospital.</small>
      </div>
      <div className="login-form">
        <div className="login-inner">
          <span className="stat-icon teal">
            <Stethoscope />
          </span>
          <h1>Welcome back.</h1>
          <p>Sign in to your hospital workspace.</p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await onLogin(
                  await api(
                    "/login",
                    Object.fromEntries(new FormData(e.target)),
                  ),
                );
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Email address
              <Field
                name="email"
                type="email"
                autoComplete="username"
                required
                defaultValue={import.meta.env.DEV ? "admin@careflow.demo" : ""}
              />
            </label>
            <label>
              Password
              <Field
                name="password"
                type="password"
                autoComplete="current-password"
                required
                defaultValue={import.meta.env.DEV ? "Careflow@2026" : ""}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in to Careflow"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="login-demo">
            <b>Take a look around</b>
            <p>
              {import.meta.env.DEV
                ? "Demo credentials are filled in for you. "
                : "Sign in with your administrator or doctor account. "}
              All patient data is fictional.
            </p>
          </div>
          <small className="muted">
            MERN portfolio project · MongoDB, Express, React, Node.js
          </small>
        </div>
      </div>
    </div>
  );
}
const appRoot =
  import.meta.hot?.data.root ?? createRoot(document.getElementById("root"));
if (import.meta.hot) import.meta.hot.data.root = appRoot;
appRoot.render(<App />);

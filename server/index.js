import "dotenv/config";
import { checkProductionAccounts } from "./production.js";
import { registerPasswordRoute } from "./password.js";
import { management, publicUser } from "./management.js";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomBytes } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  patientInput,
  appointmentInput,
  prescriptionInput,
} from "./validation.js";

const production = process.env.NODE_ENV === "production";
if (
  production &&
  (!process.env.MONGODB_URI ||
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32)
)
  throw new Error(
    "Production requires MONGODB_URI and JWT_SECRET (at least 32 characters).",
  );
if (!production) mkdirSync(".local/data", { recursive: true });
const secretPath = ".local/session-secret";
if (!process.env.JWT_SECRET && !existsSync(secretPath))
  writeFileSync(secretPath, randomBytes(48).toString("hex"));
const secret = process.env.JWT_SECRET || readFileSync(secretPath, "utf8");
let mongo;
if (!process.env.MONGODB_URI) {
  console.log(
    "Starting persistent local MongoDB (first run downloads MongoDB)…",
  );
  mongo = await MongoMemoryServer.create({
    instance: {
      dbPath: path.resolve(".local/data"),
      storageEngine: "wiredTiger",
    },
    binary: { downloadDir: path.resolve(".local/mongodb") },
  });
}
await mongoose.connect(process.env.MONGODB_URI || mongo.getUri("careflow"));
const schema = (fields) =>
  new mongoose.Schema(
    { archived: { type: Boolean, default: false }, ...fields },
    { timestamps: true },
  );
const User = mongoose.model(
  "User",
  schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: String,
    sessionVersion: { type: Number, default: 0 },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
    photo: String,
    phone: String,
    disabled: Boolean,
  }),
);
const Patient = mongoose.model(
  "Patient",
  schema({
    name: String,
    email: String,
    phone: String,
    dob: String,
    gender: String,
    bloodGroup: String,
    allergies: String,
    history: String,
  }),
);
const Doctor = mongoose.model(
  "Doctor",
  schema({
    name: String,
    specialty: String,
    color: String,
    email: String,
    phone: String,
    bio: String,
    photo: String,
  }),
);
const appointmentSchema = schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
  date: String,
  time: String,
  reason: String,
  status: { type: String, default: "Scheduled" },
});
appointmentSchema.index(
  { doctor: 1, date: 1, time: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["Scheduled", "Checked in"] } },
  },
);
const Appointment = mongoose.model("Appointment", appointmentSchema);
const Prescription = mongoose.model(
  "Prescription",
  schema({
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
    diagnosis: String,
    medications: [
      { name: String, dosage: String, frequency: String, duration: String },
    ],
    notes: String,
  }),
);
await Appointment.init();
if (!production && !(await User.exists({}))) {
  await User.create({
    name: "Alex Morgan",
    email: "admin@careflow.demo",
    password: await bcrypt.hash("Careflow@2026", 12),
    role: "Administrator",
  });
}
if (!production && !(await Doctor.exists({})))
  await Doctor.insertMany([
    {
      name: "Dr. Sarah Mitchell",
      specialty: "General Medicine",
      color: "teal",
    },
    { name: "Dr. James Wilson", specialty: "Cardiology", color: "purple" },
    { name: "Dr. Emily Chen", specialty: "Dermatology", color: "orange" },
    { name: "Dr. Daniel Brooks", specialty: "Orthopedics", color: "blue" },
  ]);
if (!production && !(await Patient.exists({}))) {
  const patients = await Patient.insertMany(
    [
      "Olivia Bennett",
      "Noah Williams",
      "Amelia Davis",
      "Liam Anderson",
      "Sophia Martinez",
      "Ethan Taylor",
      "Isabella Moore",
      "Lucas Thomas",
    ].map((name, i) => ({
      name,
      email: name.toLowerCase().replace(" ", ".") + "@example.com",
      phone: "+1 202 555 01" + String(i).padStart(2, "0"),
      dob: `${1980 + i * 3}-0${i + 1}-12`,
      gender: i % 2 ? "Male" : "Female",
      bloodGroup: ["O+", "A+", "B+", "AB+"][i % 4],
      allergies: i === 0 ? "Penicillin" : "None reported",
      history: "Fictional patient for demonstration.",
    })),
  );
  const doctors = await Doctor.find();
  const date = new Date().toLocaleDateString("en-CA");
  await Appointment.insertMany(
    patients.slice(0, 6).map((p, i) => ({
      patient: p._id,
      doctor: doctors[i % 4]._id,
      date,
      time: `${String(9 + i).padStart(2, "0")}:00`,
      reason: [
        "Routine checkup",
        "Follow-up consultation",
        "Skin consultation",
        "Joint pain assessment",
      ][i % 4],
      status: i === 0 ? "Completed" : i === 1 ? "Checked in" : "Scheduled",
    })),
  );
}
if (production) await checkProductionAccounts(User);
const app = express();
if (process.env.RENDER) app.set("trust proxy", 1);
const allowedOrigins = production
  ? [process.env.APP_ORIGIN, process.env.RENDER_EXTERNAL_URL]
      .filter(Boolean)
      .map((value) => new URL(value).origin)
  : [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4000",
      "http://127.0.0.1:4000",
    ];
if (production && !allowedOrigins.length)
  throw new Error("Production requires APP_ORIGIN or RENDER_EXTERNAL_URL.");
app.use(
  helmet({ contentSecurityPolicy: false }),
  express.json({ limit: "600kb" }),
  cookieParser(),
);
app.use("/api", (req, res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.get("origin") &&
    !allowedOrigins.includes(req.get("origin"))
  )
    return res.status(403).json({ message: "Origin not allowed" });
  next();
});
app.get("/api/health", (_req, res) =>
  res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
    status: mongoose.connection.readyState === 1 ? "ok" : "unavailable",
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  }),
);
app.post(
  "/api/login",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 25 }),
  async (req, res) => {
    const { email, password } = req.body;
    const user =
      typeof email === "string"
        ? await User.findOne({
            email: email.toLowerCase(),
            disabled: { $ne: true },
          })
        : null;
    if (
      !user ||
      typeof password !== "string" ||
      !(await bcrypt.compare(password, user.password))
    )
      return res
        .status(401)
        .json({ message: "Email or password is incorrect." });
    res.cookie(
      "session",
      jwt.sign({ id: user.id, version: user.sessionVersion || 0 }, secret, {
        expiresIn: "8h",
      }),
      {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 28800000,
      },
    );
    res.json(publicUser(user));
  },
);
app.post("/api/logout", (_req, res) =>
  res.clearCookie("session").json({ ok: true }),
);
app.use("/api", async (req, res, next) => {
  try {
    const token = jwt.verify(req.cookies.session, secret);
    const user = await User.findById(token.id);
    if (
      !user ||
      user.disabled ||
      (token.version || 0) !== (user.sessionVersion || 0)
    )
      throw Error();
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Please sign in to continue." });
  }
});
app.get("/api/me", (req, res) => res.json(publicUser(req.user)));
management(app, { User, Doctor, Patient, Appointment, Prescription });
registerPasswordRoute(app, {
  User,
  issueSession: (res, user) =>
    res.cookie(
      "session",
      jwt.sign({ id: user.id, version: user.sessionVersion || 0 }, secret, {
        expiresIn: "8h",
      }),
      {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 28800000,
      },
    ),
});
app.get("/api/data", async (req, res) => {
  const own = req.user.role === "Doctor" ? { doctor: req.user.doctor } : {};
  const active = { archived: { $ne: true } };
  const patientIds =
    req.user.role === "Doctor"
      ? await Appointment.distinct("patient", { ...own, ...active })
      : undefined;
  const patients = await Patient.find({
    ...active,
    ...(patientIds ? { _id: { $in: patientIds } } : {}),
  }).sort({ createdAt: -1 });
  const ids = patients.map((p) => p._id);
  const [doctors, appointments, prescriptions, accounts] = await Promise.all([
    Doctor.find({
      ...active,
      ...(req.user.role === "Doctor" ? { _id: req.user.doctor } : {}),
    }),
    Appointment.find({ ...active, ...own, patient: { $in: ids } })
      .populate("patient doctor")
      .sort({ date: 1, time: 1 }),
    Prescription.find({ ...active, ...own, patient: { $in: ids } })
      .populate("patient doctor")
      .sort({ createdAt: -1 }),
    User.find({ role: "Doctor", disabled: { $ne: true } }).select("doctor"),
  ]);
  res.json({
    patients,
    doctors: doctors.map((d) => ({
      ...d.toObject(),
      hasAccount: accounts.some((u) => String(u.doctor) === d.id),
    })),
    appointments,
    prescriptions,
  });
});
app.use("/api", async (req, res, next) => {
  if (req.user.role !== "Doctor") return next();
  if (req.path === "/patients" && req.method === "POST")
    return res
      .status(403)
      .json({ message: "Patient registration requires an administrator." });
  if (
    req.path.startsWith("/patients/") &&
    req.method === "PUT" &&
    !(await Appointment.exists({
      doctor: req.user.doctor,
      patient: req.path.split("/")[2],
      archived: { $ne: true },
    }))
  )
    return res.status(403).json({ message: "Patient is not assigned to you." });
  if (
    ["/appointments", "/prescriptions"].includes(req.path) &&
    req.method === "POST"
  ) {
    if (
      req.body.doctor !== String(req.user.doctor) ||
      !(await Appointment.exists({
        doctor: req.user.doctor,
        patient: req.body.patient,
        archived: { $ne: true },
      }))
    )
      return res.status(403).json({
        message: "Choose your own assigned patient and doctor account.",
      });
  }
  if (
    req.path.startsWith("/appointments/") &&
    req.method === "PATCH" &&
    !(await Appointment.exists({
      _id: req.path.split("/")[2],
      doctor: req.user.doctor,
      archived: { $ne: true },
    }))
  )
    return res
      .status(403)
      .json({ message: "Appointment is not assigned to you." });
  next();
});
app.post("/api/patients", async (req, res) =>
  res.status(201).json(await Patient.create(patientInput.parse(req.body))),
);
app.put("/api/patients/:id", async (req, res) => {
  const p = await Patient.findByIdAndUpdate(
    req.params.id,
    patientInput.parse(req.body),
    { new: true },
  );
  if (!p) return res.status(404).json({ message: "Patient not found" });
  res.json(p);
});
async function references(data) {
  if (
    !(await Patient.exists({ _id: data.patient, archived: { $ne: true } })) ||
    !(await Doctor.exists({ _id: data.doctor, archived: { $ne: true } }))
  ) {
    const e = Error("Patient or doctor no longer exists.");
    e.status = 404;
    throw e;
  }
}
app.post("/api/appointments", async (req, res) => {
  const data = appointmentInput.parse(req.body);
  await references(data);
  if (new Date(`${data.date}T${data.time}:00`) <= new Date())
    return res
      .status(400)
      .json({ message: "Choose a future appointment time." });
  res.status(201).json(await Appointment.create(data));
});
app.patch("/api/appointments/:id", async (req, res) => {
  const transitions = {
    Scheduled: ["Checked in", "Cancelled"],
    "Checked in": ["Completed", "Cancelled"],
  };
  const a = await Appointment.findOne({
    _id: req.params.id,
    archived: { $ne: true },
  });
  if (!a) return res.status(404).json({ message: "Appointment not found" });
  if (!transitions[a.status]?.includes(req.body.status))
    return res
      .status(400)
      .json({ message: "This status change is not available." });
  a.status = req.body.status;
  await a.save();
  res.json(a);
});
app.post("/api/prescriptions", async (req, res) => {
  const data = prescriptionInput.parse(req.body);
  await references(data);
  res.status(201).json(await Prescription.create(data));
});
app.use("/api", (_req, res) =>
  res.status(404).json({ message: "Endpoint not found" }),
);
if (existsSync("dist")) {
  app.use(express.static("dist"));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.resolve("dist/index.html")),
  );
}
app.use((err, _req, res, _next) => {
  if (err.name === "ZodError")
    return res.status(400).json({
      message: err.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    });
  if (err.code === 11000)
    return res.status(409).json({
      message: "This doctor already has an appointment at that time.",
    });
  if (err.name === "CastError")
    return res.status(400).json({ message: "Invalid record ID." });
  console.error(err);
  res.status(err.status || 500).json({
    message: err.status
      ? err.message
      : "Something went wrong. Please try again.",
  });
});
if (!production) {
  writeFileSync(".local/server.pid", String(process.pid));
  writeFileSync(
    ".local/database-uri",
    process.env.MONGODB_URI || mongo.getUri("careflow"),
  );
}
const server = app.listen(
  process.env.PORT || 4000,
  production ? "0.0.0.0" : "127.0.0.1",
  () => console.log(`Careflow API ready on port ${process.env.PORT || 4000}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    server.close();
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
    process.exit();
  });

// Isolated integration test: never connects to the project's local or Atlas data.
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { randomBytes } from "node:crypto";
import net from "node:net";
import path from "node:path";

const mongo = await MongoMemoryServer.create({
  binary: { downloadDir: path.resolve(".local/test-mongodb") },
});
const probe = net.createServer();
probe.listen(process.argv.includes("--preview") ? 4000 : 0, "127.0.0.1");
await once(probe, "listening");
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = spawn(process.execPath, ["server/index.js"], {
  env: {
    ...process.env,
    NODE_ENV: process.argv.includes("--preview") ? "development" : "production",
    PORT: String(port),
    TZ: "Asia/Kolkata",
    MONGODB_URI: mongo.getUri(),
    JWT_SECRET: randomBytes(40).toString("hex"),
    DEMO_ADMIN_PASSWORD: "PortalTestAdmin2026!",
    APP_ORIGIN: "https://test.example",
    RENDER: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", (b) => (output += b));
server.stderr.on("data", (b) => (output += b));
const base = `http://127.0.0.1:${port}/api`;
async function call(url, cookie = "", method = "GET", body, expected = 200) {
  const r = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", cookie },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  assert.equal(r.status, expected, `${method} ${url}: ${JSON.stringify(data)}`);
  return { data, cookie: r.headers.get("set-cookie")?.split(";")[0] };
}
const password = "PatientTest2026!";
async function signup(name, email) {
  await call(
    "/register",
    "",
    "POST",
    {
      name,
      email,
      password,
      phone: "9999999999",
      dob: "2000-01-01",
      gender: "Other",
      role: "Administrator",
    },
    201,
  );
  const login = await call("/login", "", "POST", { email, password });
  assert.equal(login.data.role, "Patient");
  return login.cookie;
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error(output);
    try {
      ready = (await fetch(base + "/health")).ok;
    } catch {}
    if (ready) break;
    await delay(200);
  }
  assert.ok(ready, output);
  const admin = (
    await call("/login", "", "POST", {
      email: "admin@careflow.demo",
      password: process.argv.includes("--preview")
        ? "Careflow@2026"
        : "PortalTestAdmin2026!",
    })
  ).cookie;
  const alice = await signup("Portal Alice", "portal-alice@example.com");
  const bob = await signup("Portal Bob", "portal-bob@example.com");
  await call(
    "/register",
    "",
    "POST",
    {
      name: "Duplicate",
      email: "portal-alice@example.com",
      password,
      phone: "9999999999",
      dob: "2000-01-01",
      gender: "Other",
    },
    409,
  );
  await call("/portal", "", "GET", undefined, 401);
  await call("/portal", admin, "GET", undefined, 403);
  for (const url of [
    "/data",
    "/appointment-requests",
    "/prescriptions/000000000000000000000000/pdf",
  ])
    await call(url, alice, "GET", undefined, 403);
  for (const url of [
    "/patients",
    "/doctors",
    "/appointments",
    "/prescriptions",
  ])
    await call(url, alice, "POST", {}, 403);
  await call("/me", alice, "PUT", { role: "Administrator" }, 403);
  await call(
    "/portal/requests",
    alice,
    "POST",
    { department: "Nonexistent", issue: "Test issue" },
    400,
  );
  await call(
    "/portal/requests",
    alice,
    "POST",
    { department: "Cardiology", issue: " " },
    400,
  );
  const request = (
    await call(
      "/portal/requests",
      alice,
      "POST",
      {
        department: "Cardiology",
        issue: "Fictional request for a consultation",
        patient: "000000000000000000000000",
      },
      201,
    )
  ).data;
  assert.equal((await call("/portal", bob)).data.requests.length, 0);
  const inbox = (await call("/appointment-requests", admin)).data;
  assert.equal(inbox[0].patient.name, "Portal Alice");
  assert.equal(inbox[0].appointment, null);
  const staff = (await call("/data", admin)).data;
  const doctor = staff.doctors.find((d) => d.specialty === "Cardiology");
  const wrongDoctor = staff.doctors.find((d) => d.specialty !== "Cardiology");
  const future = new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const booking = { doctor: doctor._id, date: future, time: "09:00" };
  await call(
    `/appointment-requests/${request._id}/book`,
    alice,
    "POST",
    booking,
    403,
  );
  await call(
    `/appointment-requests/${request._id}/book`,
    admin,
    "POST",
    { ...booking, doctor: wrongDoctor._id },
    400,
  );
  await call(
    `/appointment-requests/${request._id}/book`,
    admin,
    "POST",
    { ...booking, date: "2020-01-01" },
    400,
  );
  const a = (
    await call(
      `/appointment-requests/${request._id}/book`,
      admin,
      "POST",
      booking,
      201,
    )
  ).data;
  await call(
    `/appointment-requests/${request._id}/book`,
    admin,
    "POST",
    { ...booking, time: "09:30" },
    409,
  );
  const prescription = (
    await call(
      "/prescriptions",
      admin,
      "POST",
      {
        patient: request.patient,
        doctor: doctor._id,
        diagnosis: "Fictional download test",
        medications: [
          {
            name: "Demo medication",
            dosage: "Example only",
            frequency: "Example only",
            duration: "Example only",
          },
        ],
        notes: "Fictional test prescription.",
      },
      201,
    )
  ).data;
  const pdfPath = `/portal/prescriptions/${prescription._id}/pdf`;
  const ownPrescriptions = (await call("/portal", alice)).data.prescriptions;
  assert.deepEqual(
    ownPrescriptions.map((p) => p._id),
    [prescription._id],
  );
  assert.equal(ownPrescriptions[0].doctor.name, doctor.name);
  assert.equal((await call("/portal", bob)).data.prescriptions.length, 0);
  await call(pdfPath, "", "GET", undefined, 401);
  await call(pdfPath, bob, "GET", undefined, 404);
  await call(pdfPath, admin, "GET", undefined, 403);
  await call(
    "/portal/prescriptions/000000000000000000000000/pdf",
    alice,
    "GET",
    undefined,
    404,
  );
  await call("/portal/prescriptions/invalid/pdf", alice, "GET", undefined, 400);
  for (const url of [pdfPath, `/prescriptions/${prescription._id}/pdf`]) {
    const pdf = await fetch(base + url, {
      headers: { cookie: url === pdfPath ? alice : admin },
    });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    assert.match(
      pdf.headers.get("content-disposition"),
      /attachment; filename="careflow-prescription-.*\.pdf"/,
    );
    assert.equal(pdf.headers.get("cache-control"), "no-store");
    assert.equal(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 5)
        .toString(),
      "%PDF-",
    );
  }
  await call(`/prescriptions/${prescription._id}`, admin, "DELETE");
  assert.equal((await call("/portal", alice)).data.prescriptions.length, 0);
  await call(pdfPath, alice, "GET", undefined, 404);
  const r2 = (
    await call(
      "/portal/requests",
      bob,
      "POST",
      { department: "Cardiology", issue: "Fictional follow-up" },
      201,
    )
  ).data;
  await call(
    `/appointment-requests/${r2._id}/book`,
    admin,
    "POST",
    booking,
    409,
  );
  assert.equal((await call("/portal", bob)).data.appointments.length, 0);
  let portal = (await call("/portal", alice)).data;
  assert.equal(portal.appointments.length, 1);
  assert.equal(portal.appointments[0].request, request._id);
  assert.equal(portal.appointments[0].status, "Scheduled");
  assert.equal(portal.appointments[0].doctor.email, undefined);
  await call("/portal/notifications/read", alice, "POST", {
    through: a.updatedAt,
  });
  portal = (await call("/portal", alice)).data;
  assert.equal(portal.notificationsReadAt, a.updatedAt);
  await call(
    `/appointments/${a._id}`,
    admin,
    "PUT",
    {
      ...booking,
      patient:
        staff.patients[0]._id === request.patient
          ? staff.patients[1]._id
          : staff.patients[0]._id,
      reason: "Reassignment attempt",
    },
    400,
  );
  await call(`/appointments/${a._id}`, admin, "PUT", {
    ...booking,
    patient: request.patient,
    reason: request.issue,
    time: "10:00",
  });
  portal = (await call("/portal", alice)).data;
  assert.equal(portal.appointments[0].time, "10:00");
  assert.ok(
    new Date(portal.appointments[0].updatedAt) >
      new Date(portal.notificationsReadAt),
  );
  await call(`/appointments/${a._id}`, admin, "DELETE");
  assert.equal(
    (await call("/portal", alice)).data.appointments[0].status,
    "Cancelled",
  );
  // Two admins submitting the same request must create exactly one visit.
  const race = await Promise.all(
    ["11:00", "11:30"].map((time) =>
      fetch(base + `/appointment-requests/${r2._id}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: admin },
        body: JSON.stringify({ ...booking, time }),
      }),
    ),
  );
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
  await call(`/patients/${request.patient}`, admin, "DELETE");
  await call("/portal", alice, "GET", undefined, 403);
  await call(pdfPath, alice, "GET", undefined, 403);
  console.log(
    "PASS: patient registration, role boundaries, ownership, validation, admin booking, conflict/race protection, notification persistence, prescription PDF downloads and access restrictions, rescheduling, cancellations and inactive accounts.",
  );
  if (process.argv.includes("--preview")) {
    await signup("Preview Patient", "preview@example.com");
    console.log(
      `Isolated UI preview: http://127.0.0.1:${port} (closes automatically in 15 minutes)`,
    );
    await delay(15 * 60 * 1000);
  }
} finally {
  server.kill();
  if (server.exitCode === null) await once(server, "exit");
  await mongo.stop();
}

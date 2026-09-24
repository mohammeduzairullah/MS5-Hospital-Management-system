import assert from "node:assert/strict";
const base = "http://127.0.0.1:4000/api";
let cookie = "";
const stamp = Date.now();
async function call(url, method = "GET", body, expected = 200) {
  const r = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  assert.equal(r.status, expected, JSON.stringify(data));
  return { r, data };
}
async function login(email, password) {
  const { r } = await call("/login", "POST", { email, password });
  cookie = r.headers.get("set-cookie").split(";")[0];
}
await login("admin@careflow.demo", "Careflow@2026");
const adminCookie = cookie;
const { data: before } = await call("/data");
const doctor = {
  name: "Dr. Workflow Test",
  specialty: "Demo Medicine",
  email: `doctor-${stamp}@example.com`,
  phone: "2025550123",
  bio: "Temporary fictional test",
  photo: "",
  createLogin: true,
  password: "DemoDoctor@2026",
};
const { data: d } = await call("/doctors", "POST", doctor, 201);
await call("/doctors/" + d._id, "PUT", {
  ...doctor,
  specialty: "Updated Demo Medicine",
});
const patient = {
  name: "Management Test Patient",
  email: `patient-${stamp}@example.com`,
  phone: "2025550144",
  dob: "1990-01-01",
  gender: "Other",
  bloodGroup: "Unknown",
  allergies: "None",
  history: "Fictional test",
};
const { data: p } = await call("/patients", "POST", patient, 201);
const date = new Date();
date.setDate(date.getDate() + 14);
const appointment = {
  patient: p._id,
  doctor: d._id,
  date: date.toLocaleDateString("en-CA"),
  time: "09:00",
  reason: "Management test",
};
const { data: a } = await call("/appointments", "POST", appointment, 201);
await call("/appointments/" + a._id, "PUT", { ...appointment, time: "09:30" });
await call("/doctors/" + d._id, "DELETE", undefined, 409);
await login(doctor.email, doctor.password);
const doctorCookie = cookie;
const { data: scoped } = await call("/data");
assert.equal(scoped.doctors.length, 1);
assert.equal(scoped.patients.length, 1);
assert.equal(scoped.appointments.length, 1);
assert.equal(scoped.appointments[0]._id, a._id);
await call("/doctors", "POST", doctor, 403);
await call("/patients/" + p._id, "DELETE", undefined, 403);
await call("/patients/" + before.patients[0]._id, "PUT", patient, 403);
if (before.appointments.length) {
  await call(
    "/appointments/" + before.appointments[0]._id,
    "PATCH",
    { status: "Completed" },
    403,
  );
  await call(
    "/appointments/" + before.appointments[0]._id,
    "DELETE",
    undefined,
    404,
  );
}
await call("/patients/" + p._id, "PUT", {
  ...patient,
  history: "Updated by assigned doctor",
});
const rx = {
  patient: p._id,
  doctor: d._id,
  diagnosis: "Fictional test plan",
  medications: [
    {
      name: "Demo only",
      dosage: "Demo only",
      frequency: "Demo only",
      duration: "Demo only",
    },
  ],
  notes: "Not for medical use",
};
const { data: prescription } = await call("/prescriptions", "POST", rx, 201);
const pdfResponse = await fetch(
  base + "/prescriptions/" + prescription._id + "/pdf",
  { headers: { Cookie: cookie } },
);
assert.equal(pdfResponse.status, 200);
assert.equal(pdfResponse.headers.get("content-type"), "application/pdf");
assert.equal(
  Buffer.from(await pdfResponse.arrayBuffer())
    .subarray(0, 5)
    .toString(),
  "%PDF-",
);
if (before.prescriptions.length)
  await call(
    "/prescriptions/" + before.prescriptions[0]._id + "/pdf",
    "GET",
    undefined,
    404,
  );
await call("/prescriptions/" + prescription._id, "PUT", {
  ...rx,
  notes: "Edited prescription",
});
await call(
  "/prescriptions/" + prescription._id,
  "PUT",
  { ...rx, doctor: before.doctors[0]._id },
  403,
);
const tinyPhoto =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII=";
const { data: me } = await call("/me", "PUT", {
  name: "Dr. Updated Test",
  email: doctor.email,
  phone: "2025550123",
  photo: tinyPhoto,
});
assert.equal(me.photo, tinyPhoto);
const { data: newData } = await call("/data");
assert.equal(newData.doctors[0].name, "Dr. Updated Test");
await call(
  "/me",
  "PUT",
  {
    name: "Dr. Updated Test",
    email: doctor.email,
    phone: "",
    photo: "data:text/html;base64,abc",
  },
  400,
);
await call("/prescriptions/" + prescription._id, "DELETE");
await call("/appointments/" + a._id, "DELETE");
cookie = adminCookie;
await call("/patients/" + p._id, "DELETE");
await call("/doctors/" + d._id, "DELETE");
cookie = doctorCookie;
await call("/data", "GET", undefined, 401);
await call(
  "/login",
  "POST",
  { email: doctor.email, password: doctor.password },
  401,
);
cookie = adminCookie;
const { data: after } = await call("/data");
assert.ok(!after.doctors.some((x) => x._id === d._id));
assert.ok(!after.patients.some((x) => x._id === p._id));
assert.ok(!after.prescriptions.some((x) => x._id === prescription._id));
console.log(
  "PASS: doctor CRUD + account login, role isolation, profile/photo update, patient/prescription/appointment edits and archiving, removed account access revoked. Test records archived.",
);

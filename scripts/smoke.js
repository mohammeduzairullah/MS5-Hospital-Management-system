// Runs against a running local demo. Creates clearly labelled fictional records.
import assert from "node:assert/strict";
const base = "http://127.0.0.1:4000/api";
let cookie = "";
async function request(route, method = "GET", body, expected = 200) {
  const response = await fetch(base + route, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return { response, result };
}
await request("/data", "GET", undefined, 401);
await request(
  "/login",
  "POST",
  { email: "admin@careflow.demo", password: "wrong" },
  401,
);
const login = await request("/login", "POST", {
  email: "admin@careflow.demo",
  password: "Careflow@2026",
});
cookie = login.response.headers.get("set-cookie").split(";")[0];
assert.ok(login.response.headers.get("set-cookie").includes("HttpOnly"));
const { result: data } = await request("/data");
const patient = {
  name: "Demo Workflow Patient",
  email: "workflow@example.com",
  phone: "2025550199",
  dob: "1995-05-14",
  gender: "Other",
  bloodGroup: "Unknown",
  allergies: "None reported",
  history: "Fictional integration-test record.",
};
const { result: p } = await request("/patients", "POST", patient, 201);
await request("/patients/" + p._id, "PUT", {
  ...patient,
  history: "Updated fictional history.",
});
const date = new Date();
date.setDate(date.getDate() + 7);
const a = {
  patient: p._id,
  doctor: data.doctors[0]._id,
  date: date.toLocaleDateString("en-CA"),
  time: "17:30",
  reason: "Demo workflow verification",
};
const { result: visit } = await request("/appointments", "POST", a, 201);
await request("/appointments", "POST", a, 409);
await request(
  "/appointments/" + visit._id,
  "PATCH",
  { status: "Completed" },
  400,
);
await request("/appointments/" + visit._id, "PATCH", { status: "Checked in" });
await request("/appointments/" + visit._id, "PATCH", { status: "Completed" });
await request(
  "/appointments/" + visit._id,
  "PATCH",
  { status: "Scheduled" },
  400,
);
await request(
  "/prescriptions",
  "POST",
  {
    patient: p._id,
    doctor: a.doctor,
    diagnosis: "Demonstration care plan",
    medications: [
      {
        name: "Demo medication (not for use)",
        dosage: "Example only",
        frequency: "Example only",
        duration: "Example only",
      },
    ],
    notes:
      "Fictional software test. Not medical advice or a valid prescription.",
  },
  201,
);
const { result: after } = await request("/data");
assert.equal(
  after.patients.find((x) => x._id === p._id).history,
  "Updated fictional history.",
);
assert.ok(after.prescriptions.some((x) => x.patient._id === p._id));
assert.equal(
  after.appointments.find((x) => x._id === visit._id).status,
  "Completed",
);
await request("/logout", "POST", {});
console.log(
  "PASS: authentication, patient creation/editing, booking, duplicate prevention, status transitions, prescription persistence.",
);

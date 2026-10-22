import test from "node:test";
import assert from "node:assert/strict";
import {
  registrationInput,
  requestInput,
  staffOnly,
} from "./patient-portal.js";

test("patient registration normalizes email, strips role injection and rejects unsafe input", () => {
  const input = {
    name: "Demo Patient",
    email: " PATIENT@example.com ",
    phone: "9999999999",
    dob: "2000-01-01",
    gender: "Other",
    password: "PatientDemo2026!",
    role: "Administrator",
    patient: "existing-record",
  };
  const clean = registrationInput.parse(input);
  assert.equal(clean.email, "patient@example.com");
  assert.equal(clean.role, undefined);
  assert.equal(clean.patient, undefined);
  assert.equal(
    registrationInput.safeParse({ ...input, password: "short" }).success,
    false,
  );
  assert.equal(
    registrationInput.safeParse({ ...input, password: "é".repeat(40) }).success,
    false,
  );
  assert.equal(
    registrationInput.safeParse({ ...input, dob: "2999-01-01" }).success,
    false,
  );
});
test("requests validate department and issue and never accept a supplied patient identity", () => {
  assert.deepEqual(
    requestInput.parse({
      department: " Cardiology ",
      issue: " Demo issue ",
      patient: "someone-else",
    }),
    { department: "Cardiology", issue: "Demo issue" },
  );
  assert.equal(
    requestInput.safeParse({ department: "Cardiology", issue: " " }).success,
    false,
  );
  assert.equal(
    requestInput.safeParse({ department: "Cardiology", issue: "x".repeat(301) })
      .success,
    false,
  );
});
test("staff boundary rejects patient and unknown roles before staff data and mutation routes", () => {
  for (const role of ["Patient", "Unknown", "Administrator", "Doctor"]) {
    let status,
      allowed = false;
    staffOnly(
      { user: { role } },
      {
        status(code) {
          status = code;
          return this;
        },
        json() {},
      },
      () => (allowed = true),
    );
    assert.equal(allowed, ["Administrator", "Doctor"].includes(role));
    if (!allowed) assert.equal(status, 403);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  patientInput,
  appointmentInput,
  prescriptionInput,
} from "./validation.js";
test("patient validation rejects future birth dates and invalid emails", () => {
  const patient = {
    name: "Test Patient",
    email: "test@example.com",
    phone: "1234567890",
    dob: "2000-01-01",
    gender: "Female",
    bloodGroup: "O+",
  };
  assert.equal(patientInput.safeParse(patient).success, true);
  assert.equal(
    patientInput.safeParse({ ...patient, dob: "2999-01-01" }).success,
    false,
  );
  assert.equal(
    patientInput.safeParse({ ...patient, email: "invalid" }).success,
    false,
  );
});
test("appointments require valid references and half-hour clinic slots", () => {
  const a = {
    patient: "a".repeat(24),
    doctor: "b".repeat(24),
    date: "2026-10-01",
    time: "09:30",
    reason: "Routine checkup",
  };
  assert.equal(appointmentInput.safeParse(a).success, true);
  for (const time of ["25:00", "09:15", "08:30"])
    assert.equal(appointmentInput.safeParse({ ...a, time }).success, false);
  assert.equal(
    appointmentInput.safeParse({ ...a, patient: "bad" }).success,
    false,
  );
});
test("prescriptions require at least one complete medication", () => {
  const p = {
    patient: "a".repeat(24),
    doctor: "b".repeat(24),
    diagnosis: "Demo diagnosis",
    medications: [],
  };
  assert.equal(prescriptionInput.safeParse(p).success, false);
  assert.equal(
    prescriptionInput.safeParse({
      ...p,
      medications: [
        { name: "Demo", dosage: "1", frequency: "Daily", duration: "3 days" },
      ],
    }).success,
    true,
  );
});

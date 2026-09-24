import test from "node:test";
import assert from "node:assert/strict";
import { isAvailable, weekDates } from "../src/scheduling.js";
test("availability respects active bookings, doctor identity, and elapsed times", () => {
  const now = new Date("2026-09-23T10:00:00");
  const appointment = {
    doctor: { _id: "doctor-a" },
    date: "2026-09-23",
    time: "11:00",
    status: "Scheduled",
  };
  assert.equal(
    isAvailable([appointment], "doctor-a", appointment.date, "11:00", now),
    false,
  );
  assert.equal(
    isAvailable([appointment], "doctor-b", appointment.date, "11:00", now),
    true,
  );
  assert.equal(
    isAvailable(
      [{ ...appointment, status: "Checked in" }],
      "doctor-a",
      appointment.date,
      "11:00",
      now,
    ),
    false,
  );
  assert.equal(
    isAvailable(
      [{ ...appointment, status: "Cancelled" }],
      "doctor-a",
      appointment.date,
      "11:00",
      now,
    ),
    true,
  );
  assert.equal(
    isAvailable([], "doctor-a", appointment.date, "09:30", now),
    false,
  );
  assert.equal(isAvailable([], "", appointment.date, "11:00", now), false);
});
test("week calendar crosses month and year boundaries with Monday first", () => {
  assert.deepEqual(weekDates("2027-01-01"), [
    "2026-12-28",
    "2026-12-29",
    "2026-12-30",
    "2026-12-31",
    "2027-01-01",
    "2027-01-02",
    "2027-01-03",
  ]);
});

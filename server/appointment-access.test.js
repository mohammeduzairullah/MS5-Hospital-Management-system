import test from "node:test";
import assert from "node:assert/strict";
import { requireAppointmentCreator } from "./appointment-access.js";
test("appointment creation is restricted to administrators", () => {
  for (const role of ["Doctor", "Patient", undefined]) {
    let status;
    let nextCalled = false;
    const res = {
      status(code) {
        status = code;
        return this;
      },
      json(body) {
        assert.match(body.message, /administrators/);
      },
    };
    requireAppointmentCreator({ user: { role } }, res, () => {
      nextCalled = true;
    });
    assert.equal(status, 403);
    assert.equal(nextCalled, false);
  }
  let allowed = false;
  requireAppointmentCreator({ user: { role: "Administrator" } }, {}, () => {
    allowed = true;
  });
  assert.equal(allowed, true);
});

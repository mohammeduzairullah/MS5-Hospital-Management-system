import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { passwordChangeHandler } from "./password.js";
test("password change verifies current password, confirms new password, hashes it and rotates the session", async () => {
  const user = {
    _id: "test-admin",
    id: "test-admin",
    role: "Administrator",
    password: await bcrypt.hash("OldPassword!123", 4),
    sessionVersion: 0,
  };
  let writes = 0,
    issued;
  const handler = passwordChangeHandler({
    User: {
      findOneAndUpdate: async (filter, update) => {
        assert.equal(filter.password, user.password);
        writes++;
        Object.assign(user, update.$set);
        user.sessionVersion += update.$inc.sessionVersion;
        return user;
      },
    },
    issueSession: (_res, value) => {
      issued = value.sessionVersion;
    },
  });
  async function run(body, role = "Administrator") {
    let code = 200,
      result;
    await handler(
      { body, user: { ...user, role } },
      {
        status(c) {
          code = c;
          return this;
        },
        json(data) {
          result = data;
          return this;
        },
      },
    );
    return { code, result };
  }
  const valid = {
    currentPassword: "OldPassword!123",
    newPassword: "NewPassword!456",
    confirmPassword: "NewPassword!456",
  };
  assert.equal(
    (await run({ ...valid, currentPassword: "incorrect" })).code,
    400,
  );
  assert.equal(
    (await run({ ...valid, confirmPassword: "Mismatch" })).code,
    400,
  );
  assert.equal(
    (await run({ ...valid, newPassword: "short", confirmPassword: "short" }))
      .code,
    400,
  );
  assert.equal(
    (
      await run({
        ...valid,
        newPassword: "😀".repeat(20),
        confirmPassword: "😀".repeat(20),
      })
    ).code,
    400,
  );
  assert.equal(
    (
      await run({
        ...valid,
        newPassword: valid.currentPassword,
        confirmPassword: valid.currentPassword,
      })
    ).code,
    400,
  );
  assert.equal((await run(valid, "Doctor")).code, 403);
  assert.equal(writes, 0);
  assert.equal((await run(valid)).code, 200);
  assert.equal(writes, 1);
  assert.equal(issued, 1);
  assert.equal(await bcrypt.compare(valid.newPassword, user.password), true);
  assert.equal(
    await bcrypt.compare(valid.currentPassword, user.password),
    false,
  );
});

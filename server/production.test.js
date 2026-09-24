import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { checkProductionAccounts } from "./production.js";
test("production refuses missing admins or the known demo password", async () => {
  await assert.rejects(
    checkProductionAccounts({ find: async () => [] }),
    /Import your existing accounts/,
  );
  const initial = await bcrypt.hash("Careflow@2026", 4);
  await assert.rejects(
    checkProductionAccounts({ find: async () => [{ password: initial }] }),
    /demo password/,
  );
  const changed = await bcrypt.hash("Changed-for-test-9482!", 4);
  await checkProductionAccounts({
    find: async (filter) => {
      assert.equal(filter.role, "Administrator");
      return [{ password: changed }];
    },
  });
});

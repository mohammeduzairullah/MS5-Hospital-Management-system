import bcrypt from "bcryptjs";

export async function checkProductionAccounts(User) {
  const admins = await User.find({
    role: "Administrator",
    disabled: { $ne: true },
  });
  if (!admins.length)
    throw new Error(
      "Import your existing accounts before starting production.",
    );
  for (const admin of admins) {
    if (await bcrypt.compare("Careflow@2026", admin.password))
      throw new Error(
        "Change the local administrator demo password, then migrate the updated account before public deployment.",
      );
  }
}

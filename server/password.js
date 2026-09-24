import bcrypt from "bcryptjs";
import { z } from "zod";
import rateLimit from "express-rate-limit";

const passwordInput = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z
      .string()
      .min(10, "Use at least 10 characters.")
      .refine(
        (v) => Buffer.byteLength(v, "utf8") <= 72,
        "Use at most 72 bytes for the new password.",
      ),
    confirmPassword: z.string(),
  })
  .refine(
    (v) => v.newPassword === v.confirmPassword,
    "New passwords do not match.",
  )
  .refine(
    (v) => v.newPassword !== v.currentPassword,
    "Choose a different password.",
  );

export function passwordChangeHandler({ User, issueSession }) {
  return async (req, res) => {
    if (req.user.role !== "Administrator")
      return res
        .status(403)
        .json({ message: "Administrator access required." });
    const parsed = passwordInput.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ message: parsed.error.issues.map((i) => i.message).join(" ") });
    const { currentPassword, newPassword } = parsed.data;
    if (!(await bcrypt.compare(currentPassword, req.user.password)))
      return res
        .status(400)
        .json({ message: "Your current password is incorrect." });
    const password = await bcrypt.hash(newPassword, 12);
    const user = await User.findOneAndUpdate(
      {
        _id: req.user._id,
        password: req.user.password,
        disabled: { $ne: true },
      },
      { $set: { password }, $inc: { sessionVersion: 1 } },
      { new: true },
    );
    if (!user)
      return res
        .status(409)
        .json({ message: "Your account changed. Sign in again and retry." });
    issueSession(res, user);
    res.json({
      message: "Password changed. Other sessions have been signed out.",
    });
  };
}
export function registerPasswordRoute(app, dependencies) {
  app.put(
    "/api/me/password",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      message: {
        message: "Too many password attempts. Try again in 15 minutes.",
      },
    }),
    passwordChangeHandler(dependencies),
  );
}

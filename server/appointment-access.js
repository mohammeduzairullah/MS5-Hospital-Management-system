export function requireAppointmentCreator(req, res, next) {
  if (req.user?.role !== "Administrator") {
    return res
      .status(403)
      .json({ message: "Only administrators can create appointments." });
  }
  next();
}

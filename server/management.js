import { z } from "zod";
import bcrypt from "bcryptjs";
import { prescriptionPDF } from "./prescription-pdf.js";
import { prescriptionInput, appointmentInput } from "./validation.js";
const photo = z
  .string()
  .max(450000)
  .refine(
    (v) => !v || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
    "Choose a JPEG, PNG or WebP photo",
  );
const doctorInput = z.object({
  name: z.string().trim().min(2).max(100),
  specialty: z.string().trim().min(2).max(100),
  email: z.email().transform((v) => v.toLowerCase()),
  phone: z.string().max(25).default(""),
  bio: z.string().max(1500).default(""),
  photo: photo.default(""),
  createLogin: z.boolean().default(false),
  password: z.string().max(128).default(""),
});
export const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  doctor: u.doctor,
  phone: u.phone || "",
  photo: u.photo || "",
});
export function management(
  app,
  { User, Doctor, Patient, Appointment, Prescription },
) {
  const admin = (req, res, next) =>
    req.user.role === "Administrator"
      ? next()
      : res.status(403).json({ message: "Administrator access required." });
  app.put("/api/me", async (req, res) => {
    const input = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.email().transform((v) => v.toLowerCase()),
        phone: z.string().max(25).default(""),
        photo: photo.default(""),
      })
      .parse(req.body);
    if (await User.exists({ email: input.email, _id: { $ne: req.user._id } }))
      return res
        .status(409)
        .json({ message: "That email is already used by another account." });
    Object.assign(req.user, input);
    await req.user.save();
    if (req.user.doctor) await Doctor.findByIdAndUpdate(req.user.doctor, input);
    res.json(publicUser(req.user));
  });
  for (const method of ["post", "put"])
    app[method](
      "/api/doctors" + (method === "put" ? "/:id" : ""),
      admin,
      async (req, res) => {
        const input = doctorInput.parse(req.body);
        let doctor =
          method === "put"
            ? await Doctor.findOne({
                _id: req.params.id,
                archived: { $ne: true },
              })
            : new Doctor({ color: "teal" });
        if (!doctor)
          return res.status(404).json({ message: "Doctor not found." });
        const account = await User.findOne({ doctor: doctor._id });
        if (
          await Doctor.exists({
            email: input.email,
            _id: { $ne: doctor._id },
            archived: { $ne: true },
          })
        )
          return res
            .status(409)
            .json({ message: "Another doctor uses this email." });
        if (
          await User.exists({
            email: input.email,
            ...(account ? { _id: { $ne: account._id } } : {}),
          })
        )
          return res
            .status(409)
            .json({ message: "This email is already registered." });
        if (input.createLogin && !account && input.password.length < 10)
          return res.status(400).json({
            message:
              "A new doctor account needs a password of at least 10 characters.",
          });
        const { createLogin, password, ...details } = input;
        Object.assign(doctor, details);
        await doctor.save();
        if (account) {
          Object.assign(account, {
            name: doctor.name,
            email: doctor.email,
            phone: doctor.phone,
            photo: doctor.photo,
          });
          await account.save();
        } else if (createLogin)
          await User.create({
            name: doctor.name,
            email: doctor.email,
            phone: doctor.phone,
            photo: doctor.photo,
            password: await bcrypt.hash(password, 12),
            role: "Doctor",
            doctor: doctor._id,
          });
        res.status(method === "post" ? 201 : 200).json(doctor);
      },
    );
  app.delete("/api/doctors/:id", admin, async (req, res) => {
    if (
      await Appointment.exists({
        doctor: req.params.id,
        archived: { $ne: true },
        status: { $in: ["Scheduled", "Checked in"] },
      })
    )
      return res.status(409).json({
        message:
          "Cancel or complete this doctor’s active appointments before removing them.",
      });
    const d = await Doctor.findByIdAndUpdate(req.params.id, { archived: true });
    if (!d) return res.status(404).json({ message: "Doctor not found." });
    await User.updateMany({ doctor: d._id }, { disabled: true });
    res.json({ ok: true });
  });
  app.delete("/api/patients/:id", admin, async (req, res) => {
    const p = await Patient.findByIdAndUpdate(req.params.id, {
      archived: true,
    });
    if (!p) return res.status(404).json({ message: "Patient not found." });
    await Appointment.updateMany(
      { patient: p._id, status: { $in: ["Scheduled", "Checked in"] } },
      { status: "Cancelled" },
    );
    res.json({ ok: true });
  });
  const own = (req) =>
    req.user.role === "Doctor" ? { doctor: req.user.doctor } : {};
  app.get("/api/prescriptions/:id/pdf", async (req, res) => {
    const record = await Prescription.findOne({
      _id: req.params.id,
      archived: { $ne: true },
      ...own(req),
    }).populate("patient doctor");
    if (!record || record.patient.archived)
      return res.status(404).json({ message: "Prescription not found." });
    const pdf = await prescriptionPDF(record);
    res
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="careflow-prescription-${record.id}.pdf"`,
        "Cache-Control": "no-store",
      })
      .send(pdf);
  });
  app.put("/api/prescriptions/:id", async (req, res) => {
    const data = prescriptionInput.parse(req.body);
    if (req.user.role === "Doctor" && data.doctor !== String(req.user.doctor))
      return res
        .status(403)
        .json({ message: "You can only edit your own prescriptions." });
    if (
      !(await Patient.exists({ _id: data.patient, archived: { $ne: true } })) ||
      !(await Doctor.exists({ _id: data.doctor, archived: { $ne: true } }))
    )
      return res
        .status(400)
        .json({ message: "Choose an active patient and doctor." });
    if (
      req.user.role === "Doctor" &&
      !(await Appointment.exists({
        patient: data.patient,
        doctor: req.user.doctor,
        archived: { $ne: true },
      }))
    )
      return res
        .status(403)
        .json({ message: "This patient is not assigned to you." });
    const p = await Prescription.findOneAndUpdate(
      { _id: req.params.id, archived: { $ne: true }, ...own(req) },
      data,
      { new: true },
    );
    if (!p) return res.status(404).json({ message: "Prescription not found." });
    res.json(p);
  });
  app.delete("/api/prescriptions/:id", async (req, res) => {
    const p = await Prescription.findOneAndUpdate(
      { _id: req.params.id, ...own(req) },
      { archived: true },
    );
    if (!p) return res.status(404).json({ message: "Prescription not found." });
    res.json({ ok: true });
  });
  app.put("/api/appointments/:id", async (req, res) => {
    const data = appointmentInput.parse(req.body);
    if (req.user.role === "Doctor" && data.doctor !== String(req.user.doctor))
      return res
        .status(403)
        .json({ message: "You can only manage your own appointments." });
    if (
      !(await Patient.exists({ _id: data.patient, archived: { $ne: true } })) ||
      !(await Doctor.exists({ _id: data.doctor, archived: { $ne: true } }))
    )
      return res
        .status(400)
        .json({ message: "Choose an active patient and doctor." });
    const a = await Appointment.findOne({
      _id: req.params.id,
      ...own(req),
      archived: { $ne: true },
    });
    if (!a) return res.status(404).json({ message: "Appointment not found." });
    if (a.status !== "Scheduled")
      return res
        .status(400)
        .json({ message: "Only scheduled visits can be rescheduled." });
    if (new Date(`${data.date}T${data.time}:00`) <= new Date())
      return res
        .status(400)
        .json({ message: "Choose a future appointment time." });
    if (req.user.role === "Doctor" && String(a.patient) !== data.patient)
      return res.status(403).json({
        message: "You cannot reassign this visit to another patient.",
      });
    Object.assign(a, data);
    await a.save();
    res.json(a);
  });
  app.delete("/api/appointments/:id", async (req, res) => {
    const a = await Appointment.findOneAndUpdate(
      { _id: req.params.id, ...own(req) },
      { archived: true, status: "Cancelled" },
    );
    if (!a) return res.status(404).json({ message: "Appointment not found." });
    res.json({ ok: true });
  });
}

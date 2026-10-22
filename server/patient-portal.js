import { z } from "zod";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { patientInput, appointmentInput } from "./validation.js";
import { prescriptionPDF } from "./prescription-pdf.js";

export const registrationInput = patientInput
  .pick({ name: true, email: true, phone: true, dob: true, gender: true })
  .extend({
    email: z
      .string()
      .trim()
      .email()
      .transform((v) => v.toLowerCase()),
    password: z
      .string()
      .min(10)
      .refine(
        (v) => Buffer.byteLength(v, "utf8") <= 72,
        "Use at most 72 bytes for your password.",
      ),
  });
export const requestInput = z.object({
  department: z.string().trim().min(2).max(100),
  issue: z.string().trim().min(3).max(300),
});
export const staffOnly = (req, res, next) =>
  ["Administrator", "Doctor"].includes(req.user.role)
    ? next()
    : res.status(403).json({ message: "Staff access required." });
const role = (expected) => (req, res, next) =>
  req.user.role === expected
    ? next()
    : res.status(403).json({ message: `${expected} access required.` });

export function registerPatientSignup(app, { User, Patient }) {
  app.post(
    "/api/register",
    rateLimit({ windowMs: 60 * 60 * 1000, limit: 20 }),
    async (req, res) => {
      const { password, ...details } = registrationInput.parse(req.body);
      if (await User.exists({ email: details.email }))
        return res
          .status(409)
          .json({
            message: "This email already has an account. Please sign in.",
          });
      // Never attach a new public account to an existing medical record by email alone.
      const patient = await Patient.create({
        ...details,
        bloodGroup: "Unknown",
      });
      try {
        await User.create({
          ...details,
          password: await bcrypt.hash(password, 12),
          role: "Patient",
          patient: patient._id,
        });
      } catch (error) {
        await Patient.deleteOne({ _id: patient._id });
        if (error.code === 11000)
          return res
            .status(409)
            .json({
              message: "This email already has an account. Please sign in.",
            });
        throw error;
      }
      res
        .status(201)
        .json({
          message:
            "Your patient account is ready. Sign in to request an appointment.",
        });
    },
  );
}

export function patientPortal(
  app,
  { User, Patient, Doctor, Appointment, AppointmentRequest, Prescription },
) {
  const patientOnly = role("Patient"),
    adminOnly = role("Administrator");
  app.use("/api/portal", patientOnly, async (req, res, next) => {
    if (
      !req.user.patient ||
      !(await Patient.exists({
        _id: req.user.patient,
        archived: { $ne: true },
      }))
    )
      return res
        .status(403)
        .json({
          message:
            "Your patient record is inactive. Please contact the hospital.",
        });
    next();
  });
  app.get("/api/portal", async (req, res) => {
    const [requests, appointments, departments, prescriptions] =
      await Promise.all([
        AppointmentRequest.find({ patient: req.user.patient })
          .sort({ createdAt: -1 })
          .lean(),
        Appointment.find({ patient: req.user.patient })
          .populate("doctor", "name specialty")
          .sort({ date: -1, time: -1 })
          .lean(),
        Doctor.distinct("specialty", { archived: { $ne: true } }),
        Prescription.find({
          patient: req.user.patient,
          archived: { $ne: true },
        })
          .select("diagnosis doctor createdAt")
          .populate("doctor", "name specialty")
          .sort({ createdAt: -1 })
          .lean(),
      ]);
    // Appointment updates are the durable notifications, including cancellations.
    res.json({
      requests,
      appointments,
      departments: departments.sort(),
      prescriptions,
      notificationsReadAt: req.user.notificationsReadAt || null,
    });
  });
  app.get("/api/portal/prescriptions/:id/pdf", async (req, res) => {
    const record = await Prescription.findOne({
      _id: req.params.id,
      patient: req.user.patient,
      archived: { $ne: true },
    }).populate("patient doctor");
    if (!record || !record.patient || !record.doctor)
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
  app.post(
    "/api/portal/requests",
    rateLimit({ windowMs: 60 * 60 * 1000, limit: 20 }),
    async (req, res) => {
      const data = requestInput.parse(req.body);
      if (
        !(await Doctor.exists({
          specialty: data.department,
          archived: { $ne: true },
        }))
      )
        return res
          .status(400)
          .json({
            message:
              "This department is not available. Choose another department.",
          });
      res
        .status(201)
        .json(
          await AppointmentRequest.create({
            ...data,
            patient: req.user.patient,
          }),
        );
    },
  );
  app.post("/api/portal/notifications/read", async (req, res) => {
    const { through } = z.object({ through: z.iso.datetime() }).parse(req.body);
    const date = new Date(through);
    if (date > new Date())
      return res.status(400).json({ message: "Invalid notification date." });
    await User.updateOne(
      { _id: req.user._id },
      { $max: { notificationsReadAt: date } },
    );
    res.json({ ok: true });
  });
  app.get("/api/appointment-requests", adminOnly, async (_req, res) => {
    const [requests, appointments] = await Promise.all([
      AppointmentRequest.find()
        .populate("patient", "name email phone archived")
        .sort({ createdAt: -1 })
        .lean(),
      Appointment.find({ request: { $exists: true } })
        .populate("doctor", "name specialty")
        .lean(),
    ]);
    res.json(
      requests.map((r) => ({
        ...r,
        appointment:
          appointments.find((a) => String(a.request) === String(r._id)) || null,
      })),
    );
  });
  app.post(
    "/api/appointment-requests/:id/book",
    adminOnly,
    async (req, res) => {
      const request = await AppointmentRequest.findById(req.params.id);
      if (!request)
        return res.status(404).json({ message: "Request not found." });
      const data = appointmentInput.parse({
        ...req.body,
        patient: String(request.patient),
        reason: request.issue,
      });
      if (
        !(await Patient.exists({
          _id: request.patient,
          archived: { $ne: true },
        }))
      )
        return res
          .status(409)
          .json({ message: "This patient record is inactive." });
      if (
        !(await Doctor.exists({
          _id: data.doctor,
          specialty: request.department,
          archived: { $ne: true },
        }))
      )
        return res
          .status(400)
          .json({
            message: "Choose an active doctor from the requested department.",
          });
      if (new Date(`${data.date}T${data.time}:00`) <= new Date())
        return res
          .status(400)
          .json({ message: "Choose a future appointment time." });
      // One atomic insert and a unique request index prevent duplicate bookings.
      // The inbox derives booked status from this record, so no partial two-write state exists.
      try {
        const appointment = await Appointment.create({
          ...data,
          request: request._id,
        });
        res.status(201).json(appointment);
      } catch (error) {
        if (error.code === 11000)
          return res
            .status(409)
            .json({
              message:
                "This request is already booked or the time was just taken. Refresh and try again.",
            });
        throw error;
      }
    },
  );
}

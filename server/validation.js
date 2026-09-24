import { z } from "zod";
export const patientInput = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  phone: z.string().trim().min(8).max(25),
  dob: z.iso
    .date()
    .refine(
      (v) => v <= new Date().toISOString().slice(0, 10),
      "Birth date cannot be in the future",
    ),
  gender: z.enum(["Female", "Male", "Other"]),
  bloodGroup: z.enum([
    "A+",
    "A-",
    "B+",
    "B-",
    "AB+",
    "AB-",
    "O+",
    "O-",
    "Unknown",
  ]),
  allergies: z.string().max(500).default(""),
  history: z.string().max(3000).default(""),
});
export const appointmentInput = z.object({
  patient: z.string().regex(/^[a-f\d]{24}$/i),
  doctor: z.string().regex(/^[a-f\d]{24}$/i),
  date: z.iso.date(),
  time: z.string().regex(/^(09|10|11|12|13|14|15|16|17):[03]0$/),
  reason: z.string().trim().min(3).max(300),
});
export const prescriptionInput = z.object({
  patient: z.string().regex(/^[a-f\d]{24}$/i),
  doctor: z.string().regex(/^[a-f\d]{24}$/i),
  diagnosis: z.string().trim().min(3).max(500),
  medications: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        dosage: z.string().trim().min(1).max(100),
        frequency: z.string().trim().min(1).max(100),
        duration: z.string().trim().min(1).max(100),
      }),
    )
    .min(1)
    .max(20),
  notes: z.string().max(2000).default(""),
});

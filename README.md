# Careflow — Hospital Management System

A MERN portfolio application for appointments, prescriptions, and patient records. React powers the interface, Express runs on Node.js, and Mongoose persists records in a real MongoDB database.

## Start on Windows

Node.js is already installed on this laptop.

```powershell
npm.cmd install
npm.cmd run dev
```

Open http://127.0.0.1:5173. On the first server start, the application downloads MongoDB automatically into `.local/mongodb`. Its WiredTiger database persists in `.local/data` across restarts. The `mongodb-memory-server` package manages the real MongoDB process; the application does not use a mock or an in-memory JavaScript database. Keep `.local` to retain your records. Do not run multiple server instances against the same data directory.

For a shortcut, double-click `Start-Careflow.cmd` in this folder. Keep its window open while using the app. If the app is already running, use its existing browser tab instead of starting a second instance.

Demo login: **admin@careflow.demo** / **Careflow@2026**

The database is seeded with fictional patients, four doctors, and appointments for the first launch date. Sample prescriptions are intentionally not seeded. Create them through the prescription form.

## Features

- Staff sign-in with hashed password, HTTP-only session cookie, and login rate limiting.
- Dashboard with live statistics, date navigation, and care team directory.
- Patient registration, editing, search, medical history, allergies, and linked visits/prescriptions.
- Appointment booking, doctor double-booking prevention, check-in, completion, and cancellation.
- Multiple medications per prescription, linked patient records, and printable prescriptions.
- Responsive interface, empty states, validation, and save feedback.
- Day/week calendars and a daily list with doctor filters and visit-status counts.
- Click-to-book slots, fresh doctor availability checks, and unavailable-time indicators.
- Patient side panels that preserve the current schedule and search context.
- Inline field errors, loading skeletons, and subtle animations with reduced-motion support.

The demo supports administrators and doctors. Administrators manage the directory and create doctor logins under **Doctors → Add doctor / Edit account → Create a doctor login**. Doctors see only their own appointments, assigned patients, prescriptions, and workload. Patient registration and doctor administration are restricted to administrators.

Click your name in the sidebar to edit your profile and upload a photo. Doctor profile changes synchronize with their directory entry. Photos are resized to a 256×256 JPEG and stored in MongoDB. No external image service is used.

Administrators can open **My profile → Change password** and enter their current password, a new password of at least 10 characters (at most 72 UTF-8 bytes), and confirmation. The password is hashed, the current session stays signed in, and other sessions are invalidated. Use your new password at the next login instead of the prefilled demo password. Changing a password does not modify patient, appointment, or doctor records.

Patients, doctors, appointments, and prescriptions have create, view, edit, and remove controls. Removal archives records; it does not erase history from MongoDB. Removing patients cancels their active visits. Removing doctors requires resolving active visits first and disables their login. Only scheduled visits can be rescheduled. There is currently no archive-restore interface.

Use **Prescriptions → View / print → Print prescription** for browser printing, or **Download PDF** to save a printable A4 document. The in-app browser may not provide a native print dialog; use the PDF in your preferred viewer in that case.

**Statistics** compares available, scheduled, checked-in, and completed time within a selected date range. It assumes 18 half-hour slots every day per doctor, including weekends; it does not track leave or breaks. It measures planned workload, not clinical quality.

It does not implement patient self-service, billing, or laboratory workflows.

## Commands

```powershell
npm.cmd run dev    # API on 4000, React on 5173
npm.cmd test       # Input validation tests
npm.cmd run test:smoke # End-to-end API checks; requires a running server and adds fictional demo records
npm.cmd run test:management # CRUD, profile photos, doctor account isolation, PDF export; archives its test records
npm.cmd run build # Compile React to dist
npm.cmd start     # Serve the built app and API on http://127.0.0.1:4000
```

To use your own MongoDB server or Atlas cluster, copy `.env.example` to `.env` and set `MONGODB_URI`. The automatic local MongoDB download is then skipped. Set `JWT_SECRET` for a deployed environment. Local mode generates a persistent secret in `.local/session-secret`.

## Structure

- `src/main.jsx`: React screens, forms, and interactions.
- `src/styles.css`: responsive design and prescription print styles.
- `src/Interactions.jsx`: calendar, availability picker, and shared field feedback.
- `src/scheduling.js`: calendar dates and availability rules.
- `src/interactions.css`: calendar, side panel, and motion styles.
- `server/index.js`: Express API, MongoDB models, seed data, authentication.
- `server/validation.js`: request validation rules.
- `server/management.js`: record management and role-restricted account operations.
- `server/prescription-pdf.js`: printable PDF generation.
- `src/Management.jsx`: doctor/profile forms, archive confirmation, and workload charts.
- `scripts/dev.js`: runs the frontend and backend together.

## API

Public: `GET /api/health`, `POST /api/login`, `POST /api/logout`.

Authenticated: `GET /api/me`, `GET /api/data`, `POST /api/patients`, `PUT /api/patients/:id`, `POST /api/appointments`, `PATCH /api/appointments/:id`, `POST /api/prescriptions`.

Management: `PUT /api/me`; `POST /api/doctors`; `PUT /api/doctors/:id`; `PUT /api/appointments/:id`; `PUT /api/prescriptions/:id`; `DELETE /api/{doctors,patients,appointments,prescriptions}/:id`; `GET /api/prescriptions/:id/pdf`. Each endpoint enforces the authenticated role and record scope.

Appointment transitions: Scheduled → Checked in → Completed; Scheduled or Checked in → Cancelled. Active doctor/date/time slots are unique at the database level. Completed and cancelled records remain in patient history.

## Scope

This is a local college/portfolio demo, not a clinical deployment. Use fictional information only. Before real hospital use, it needs audit logs, account recovery/password management, clinical review, backup/restore procedures, deployment security, and privacy/compliance assessment. Local development binds to localhost. Production uses the hosted origin allowlist, HTTPS cookies and Atlas. See DEPLOYMENT.md for Render setup and data migration.


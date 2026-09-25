# MS5 - Hospital Management system

A MERN portfolio application for appointments, prescriptions, and patient records. React powers the interface, Express runs on Node.js, and Mongoose persists records in a real MongoDB database.

## Start on Windows

Double-click **Start-Careflow.cmd**. On a fresh 64-bit Windows 10/11 laptop, the launcher:

1. Uses Node.js 24 if installed with npm, otherwise downloads the official Windows runtime into `.local/runtime`. No system-wide installation or administrator rights are needed.
2. Verifies the downloaded ZIP against Node.js's official SHA-256 checksum.
3. Installs the locked project dependencies on first setup, after dependencies change, or when the installed packages are incompatible with the destination computer.
4. Starts the React frontend and Express backend. MongoDB downloads automatically when its local binary is missing.

First-time setup needs internet access and enough disk space for Node.js, project packages and MongoDB. Later launches normally use the installed files. Open http://127.0.0.1:5173 when the servers are ready, and keep the launcher window open. If setup fails, it displays an error; fix the connection or reported issue and run it again. Managed school/work laptops may block downloads or scripts and require their administrator's help.

### Copy to another laptop

Close Careflow cleanly before copying the `hospital` folder. Include the hidden `.local` folder: `.local/data` contains your records and accounts, and `.local/mongodb` contains MongoDB. Do not copy the database while the app is running. You may omit `node_modules` and `dist`; setup rebuilds dependencies as needed. Then double-click `Start-Careflow.cmd` on the destination laptop. Existing account passwords remain unchanged. This launcher targets Windows; macOS and Linux need different setup.

The application uses a real persistent MongoDB database, managed by `mongodb-memory-server`, not an in-memory JavaScript mock. Never run two copies against the same database folder. Express and React are installed as project packages; MongoDB Compass and VS Code are not required to use the app.

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

This is a local college/portfolio demo, not a clinical deployment. Use fictional information only. Before real hospital use, it needs audit logs, account recovery/password management, clinical review, backup/restore procedures, deployment security, and privacy/compliance assessment. The app runs locally on your laptop. Double-click Start-Careflow.cmd and open http://127.0.0.1:5173. Your MongoDB records are stored in .local/data; keep this folder to preserve your accounts and records.



## Permanently remove Careflow

`Delete-Careflow.cmd` requests Windows administrator permission and then requires typing `DELETE CAREFLOW AND DATA`. It permanently deletes this entire project folder, including records, accounts, photos, backups and downloaded packages/runtimes. Copy any backup you want to keep OUTSIDE the project first, and stop Careflow with Ctrl+C before running it.

It also uninstalls detected system-wide MSI installations of Node.js/npm and MongoDB Server. These may be shared with other projects. Unsupported installers require manual removal in Windows Installed apps; the script stops before deleting the project in that case. External MongoDB data folders, global npm packages outside this project, MongoDB Compass, Git, VS Code, cloud accounts and GitHub repositories are not erased.

For a read-only preview: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/delete-careflow.ps1 -Preview`.


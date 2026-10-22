# Patient appointment requests

## Patient

1. Open Careflow and choose **New patient? Create an account**.
2. Register with fictional demo details, then sign in.
3. Select a department and describe the issue (up to 300 characters).
4. Submit the request. It remains **Pending review** until an administrator books it.
5. Check **My requests** for the assigned doctor, date, time and status. **Updates** shows appointment confirmations and subsequent changes with an unread count.

Notifications are stored in MongoDB and refresh every 15 seconds while the portal is open, and when the window regains focus. They remain available after signing out. This release uses in-app notifications, not email, SMS or browser push. Appointment times are in India Standard Time for the hosted demo.

## Administrator

Open **Patient requests** in the sidebar. Use Pending, Booked or All to review requests. Select **Schedule appointment**, choose a doctor from the requested department, and select an available date and half-hour slot. Booking creates a normal appointment in the existing schedule and makes the confirmation visible to the patient. The original patient and issue are retained.

Manage subsequent rescheduling, check-in, completion and cancellation through the existing appointment screen. Patient-requested appointments cannot be reassigned to another patient. Removing a visit displays it as cancelled in the patient's portal.

## Existing records and permissions

- No database reset or reseeding is needed. Existing staff accounts and records stay intact.
- A public signup creates a separate patient record. It never takes ownership of an existing record merely because the email matches.
- Patient accounts cannot access staff data, prescriptions, other patients' requests, or staff mutation endpoints. Only administrators can turn requests into appointments.
- A unique appointment-request index prevents duplicate booking, including simultaneous submissions. The existing doctor/date/time index prevents slot conflicts.
- Departments come from active doctors' specialties. If all doctors in a department are removed, that department stops accepting new requests.
- Archiving a patient record blocks that patient's portal access.

## Validation

Run `npm test`, `npm run build`, and `npm run test:patient-portal`.

The integration test launches a temporary MongoDB and API server. It does not use the project's local database or Atlas URI. Its first run downloads MongoDB into the ignored `.local/test-mongodb` folder. Tests cover role and ownership boundaries, registration, department validation, booking, time conflicts, concurrent double submissions, notification read state, rescheduling, cancellation and archived patients.

For an isolated browser preview, run `node scripts/patient-portal-smoke.js --preview`. It uses port 4000 and shuts down automatically after 15 minutes. The temporary patient is `preview@example.com` with password `PatientTest2026!`; the temporary admin uses the standard local demo credentials. These accounts are never created in the live database.

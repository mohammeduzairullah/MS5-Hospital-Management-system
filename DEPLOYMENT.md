# Live college demo — Render + Atlas

Local Start-Careflow usage still works. Hosting uses a separate Atlas database named `careflow_live_demo`, regardless of the database path in the connection URI. No local database is uploaded.

1. In Atlas, create a database user with `readWrite` on `careflow_live_demo`. The older user restricted to `careflow` cannot access this new database. Save the password privately.
2. In Render choose New → Blueprint and select this private GitHub repository, branch main. The root `render.yaml` selects a free Node web service in Singapore, builds React and serves it with Express.
3. Supply MONGODB_URI using the Atlas connection string and the new database user. Encode password URL characters if necessary. Do not commit this value or send it in chat.
4. Allow the Render service's outbound IP ranges in Atlas Network Access. Startup cannot connect until these are allowed. Do not enable unrestricted network access merely to bypass this step.
5. Wait for the deployment health check. Open the assigned Render URL. Login email is `admin@careflow.demo`; the initial password is the generated `DEMO_ADMIN_PASSWORD` shown in Render Environment. JWT_SECRET is generated separately and is not a login password.

First successful startup creates fictional doctors, patients and appointments once. A setup marker prevents reseeding or password resets on later restarts. Changing DEMO_ADMIN_PASSWORD later does not change an existing account's password; use My profile → Change password. A nonempty database without the setup marker is rejected rather than overwritten; inspect it before retrying.

The free hosting instance can sleep when idle, so open it ahead of a presentation. This demo stores fictional information only. Keep the administrator password private unless deliberately granting someone full demo management access.

Deployment is not confirmed until the Render service is healthy and the public URL has been tested. The repository configuration alone does not create a live site.

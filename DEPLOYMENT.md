# Render and Atlas deployment

The React build and Express API share one Render Node web service. Atlas stores all records, account password hashes and profile pictures. Private data must never be committed to GitHub.

Use the free Singapore service with build command `npm ci --include=dev && npm run build`, start command `npm start`, and health check `/api/health`. Set NODE_ENV=production, MONGOMS_DISABLE_POSTINSTALL=1, TZ=Asia/Kolkata, a random JWT_SECRET of at least 32 characters, and MONGODB_URI pointing to the Atlas /careflow database. Render supplies RENDER_EXTERNAL_URL for the allowed origin. APP_ORIGIN can specify a custom domain. See render.yaml for Blueprint configuration.

Production never creates demo accounts or sample records. Use the migrated administrator account. Change any default demo password before sharing the app publicly.

Atlas account: readWrite on careflow only. Allow Render's outbound IP ranges and temporarily allow your laptop IP for migration.

## Backup and migration

Start the local app. Run `node scripts/transfer-data.js backup` to save .local/careflow-backup.ejson. IDs, dates, archived records, password hashes and indexes are preserved. Existing backups are never overwritten. SOURCE_MONGODB_URI can select an already-running local database.

Save ATLAS_MONGODB_URI in a private .env file, then run `node scripts/transfer-data.js restore`. The target database must be entirely empty. Collection counts are verified after import. If interrupted, inspect the partial target rather than rerunning; use a fresh empty database for another restore.

Keep .env and .local private. Do not run sample-data smoke scripts on migrated records. Verify login, record counts, doctor access and PDF downloads without changing records.

This is a college/portfolio demonstration for fictional patient information.

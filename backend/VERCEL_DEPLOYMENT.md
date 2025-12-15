# Vercel Serverless Deployment Guide

This backend has been refactored to support Vercel Serverless Functions.

## Changes Made
1. **Entry Point**: A new `api/index.js` file is the entry point for Vercel. It exports the Express app.
2. **Server Listen**: `server.js` now only calls `app.listen()` when running locally or if `VERCEL` env var is not set.
3. **Cron Jobs**: The `node-cron` library is replaced by Vercel Cron Jobs (configured in `vercel.json`) because serverless functions cannot keep long-running processes alive.
   - The cron logic is now exposed at `GET /api/cron/reminders`.
   - `vercel.json` schedules this endpoint.

## Configuration
Ensure the following Environment Variables are set in your Vercel Project Settings:
- `MONGO_URI`: Your MongoDB connection string.
- `JWT_SECRET`: Secret for tokens.
- `ADMIN_EMAIL`: Email for sending notifications.
- `ADMIN_EMAIL_PASSWORD`: App password for the email service.
- `FRONTEND_URL`: URL of your frontend (for CORS).
- `CRON_SECRET`: (Optional) To secure your cron endpoint.

## Known Limitations
### File Uploads
**Important**: The current file upload implementation uses the local filesystem (`multer.diskStorage` saving to `../frontend/uploads`).
**This will NOT work on Vercel** because:
1. Serverless file systems are read-only (except `/tmp`).
2. Files saved to `/tmp` disappear after the function finishes execution.

**Solution**: You must refactor `utils/fileUpload.js` and `clientRoutes.js` to upload files to a cloud storage service like **Cloudinary**, **AWS S3**, or **Firebase Storage**.

### Static Files
Serving static files via `app.use('/uploads', ...)` will also not work for the same reasons. Store and serve these assets from the cloud.

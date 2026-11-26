# RedPen 2.0

A clean React + TypeScript application for organising examination marking and student assessment. The original application is retained only as a visual reference; this branch is a fresh implementation.

## Supabase project

- Project: `RedPen 2.0`
- Project ref: `kckljigwklpezqvaorao`
- Region: `eu-west-1` (Ireland)
- API URL: `https://kckljigwklpezqvaorao.supabase.co`

The browser client uses the Supabase publishable key. It is safe for browser use because database and storage access is restricted by Row Level Security. Never put a service-role or secret key in frontend code.

## Connected services

- **Supabase Auth:** email/password sign-up, sign-in, session persistence and password reset.
- **Postgres:** profiles, institutions and memberships, workbooks, courses, students, assessments, grading results, batch jobs, user preferences and workspace snapshots.
- **Storage:** private buckets for assessment uploads and generated reports. Files are stored under the authenticated user's ID.
- **Row Level Security:** ownership policies protect workspace rows and uploaded files.
- **Realtime:** grading results and batch progress tables are enabled for Realtime subscriptions.
- **Database triggers:** new Auth users receive a profile, workspace snapshot and preferences record.

## Current app behaviour

- Workbooks and courses are saved to Supabase Postgres.
- Manual grading results are saved to structured assessment and grading tables.
- Marking schemes and answer papers are uploaded to private Supabase Storage.
- Batch paper files are stored privately and tracked in batch job tables.
- A per-user workspace snapshot keeps the current interface state synchronised across devices.
- The interface continues to identify AI grading as not connected. No automatic marks are generated.
- Payment processing is not included.

## Environment

The project has safe public defaults for the RedPen Supabase URL and publishable key. For deployment, set these Vite variables if you want to manage configuration outside the source:

```env
VITE_SUPABASE_URL=https://kckljigwklpezqvaorao.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

See `.env.example` for the template. Never add a Supabase service-role or secret key to Vite variables.\n\nBefore production sign-up and password recovery, add the deployed RedPen domain to **Supabase Dashboard → Authentication → URL Configuration** as the Site URL and an allowed Redirect URL. The app returns confirmation and password-reset links to the active site origin.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Database migration: `supabase/migrations/20261126122605_redpen_core_workspace_auth_storage.sql`.

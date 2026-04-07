# Termination Dashboard

Production-ready public dashboard for Nao Medical offboarding and turnover reporting.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- Supabase Postgres
- Supabase Storage
- Recharts
- GitHub-ready project structure
- Vercel-ready deployment structure

## What this app does

- Public dashboard with no login required
- Imports real offboarding and turnover files only
- Saves normalized data into Supabase
- Shows empty states until data is uploaded
- Compares 2025 and 2026 turnover metrics
- Shows employee-level offboarding drilldowns with:
  - employee name
  - manager
  - voluntary vs involuntary
  - reason for termination
  - termination date
- Includes searchable filters, charts, manager drilldowns, and CSV export

## Expected files

### Offboarding workbook

Mapped from a file like:

- `Name of Employee`
- `CO CODE`
- `Name of Manager`
- `Is the employment termination voluntary or involuntary?`
- `When is the last date of employment/work?`
- `Reason of Termination`

### Turnover reports

The turnover workbook parser expects the report format with:

- a `Date Range`
- employee detail rows beginning with `Employee Id`
- summary rows including:
  - `Terminated`
  - `Average Active Headcount Per Day`
  - `Turnover Rate (Terminated/Average Active Headcount Per Day)`

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `IMPORT_UPLOAD_PASSWORD`

`IMPORT_UPLOAD_PASSWORD` is optional. If you leave it blank, uploads are not password-protected.

## Supabase setup

1. Create a new Supabase project.
2. Run the SQL migration in [202604070001_initial_schema.sql](/Users/shie/Documents/Termination%20Dashboard/supabase/migrations/202604070001_initial_schema.sql).
3. Confirm the `termination-imports` storage bucket exists.
4. Add your local and deployed app URLs.

## Local development

1. Install Node.js 20+.
2. Install dependencies:

```bash
npm install
```

3. Start the app:

```bash
npm run dev
```

4. Run checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## Deployment

### GitHub

1. Create a new GitHub repository.
2. Initialize git in this project if needed.
3. Push the code to GitHub.

### Vercel

1. Import the GitHub repo into Vercel.
2. Add the environment variables from `.env.local`.
3. Deploy.

### Supabase

1. Keep the migration in source control.
2. Run migrations against the production project before or during deployment.

## Import flow

Page:

- `/imports`

Flow:

1. Upload the offboarding workbook.
2. Confirm the detected column mapping.
3. Upload turnover reports for 2025 and 2026.
4. Enter the upload password if enabled.
5. Confirm import.

The app will:

- upload originals to Supabase Storage
- normalize offboarding rows
- rebuild manager and employee references from the offboarding source
- insert termination events
- upsert turnover summaries by year
- insert turnover report detail rows
- log import history

## Troubleshooting

- If the dashboard is empty, confirm the import finished successfully and the Supabase tables contain rows.
- If uploads fail with a storage error, confirm the `termination-imports` bucket exists and the service role key is configured.
- If turnover import fails, confirm the workbook matches the report layout with the `Date Range`, `Employee Id`, and summary rows.
- If offboarding mapping is blocked, review the column mapping section on `/imports`.

# Gunderson & Partners CRM

DM Outreach & Deal Tracker — PWA built with Next.js + Supabase

## Setup

### 1. Run the Supabase schema

In your Supabase project → SQL Editor, paste and run the contents of `schema.sql`.

### 2. Install dependencies

```bash
npm install
```

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:3000

### 4. Deploy to Vercel

**Option A — CLI:**
```bash
npx vercel --prod
```
When prompted, add these environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Option B — GitHub + Vercel Dashboard:**
1. Push this repo to GitHub
2. Import in vercel.com/new
3. Add the two env vars above in project settings
4. Deploy

### 5. Install on iPhone as PWA

1. Open the deployed URL in Safari on your iPhone
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. Name it "G&P CRM" → tap Add

It will appear on your home screen like a native app.

## Features

- **Data tab** — daily/weekly/monthly trend charts, goal progress bars
- **Input tab** — log DMs sent, calls booked, calls completed
- **CRM tab** — kanban board with customizable stages
- **Archive tab** — archived deals with drop-off stage and reason
- **Goals tab** — set targets for DMs, bookings, and booking rate
- **Settings tab** — add/edit/delete pipeline stages and deal tags

## Supabase credentials

URL: https://gyhwaqxeoutfzpknzhwb.supabase.co

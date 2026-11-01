# Petoskémon

A privacy-first local Pokémon marketplace starter built with React, Vite, TypeScript, and Supabase.

## Included in this starter

- Responsive desktop and mobile marketplace interface
- Sample listings in preview mode
- Live listing search, category filters, and price sorting
- Email magic-link authentication
- Public collector aliases and editable general location
- Create listings with image uploads
- Public listing details
- Saved listings
- Private buyer-to-seller messages
- Supabase Row Level Security policies
- Supabase Storage bucket and upload policies

This is an early MVP foundation, not a finished production marketplace. It does not yet include payment processing, transaction confirmation/reputation, card catalog lookup, AI recognition, distance-based geospatial filtering, moderation dashboard, or automated listing expiry.

## 1. Create your Supabase project

1. Create a project at https://supabase.com/
2. Open **Project Settings → API** (or **API Keys**).
3. Copy the Project URL and the publishable key (or legacy `anon` key).
4. In Supabase, open **SQL Editor → New query**.
5. Paste the contents of `supabase/schema.sql` and run it.

The SQL creates the database tables, indexes, profile-creation trigger, Row Level Security policies, and the public listing image bucket.

## 2. Configure authentication

In Supabase, open **Authentication → URL Configuration**.

- Set the Site URL to your local development URL while testing, such as `http://localhost:5173`.
- Add `http://localhost:5173/**` to Redirect URLs.
- Later, add your deployed domain and its callback pattern, for example `https://your-domain.com/**`.

Under **Authentication → Providers → Email**, enable email sign-in. Configure email templates and SMTP before launch if you need reliable production delivery. Supabase's default email service has sending limits.

The app uses email magic links. The alias is collected before the first sign-in and supplied as auth user metadata. The database trigger creates the public profile.

## 3. Run locally

Install Node.js 20 or newer.

```bash
npm install
```

Copy `.env.example` to `.env.local`, then fill in your Supabase values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Then:

```bash
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

Without environment variables, the app runs in preview mode with illustrative sample listings. Accounts, messaging, saving, and publishing require Supabase.

## 4. Push to GitHub

Create a new empty GitHub repository. From this project folder:

```bash
git init
git add .
git commit -m "Initial Petoskémon marketplace"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Do not commit `.env.local`. It is excluded by `.gitignore`.

## 5. Deploy with Vercel

1. Visit https://vercel.com/ and import your GitHub repository.
2. Framework preset: **Vite**.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Add these Environment Variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Deploy.

Vercel will rebuild automatically whenever you push changes to GitHub.

After deployment, return to Supabase **Authentication → URL Configuration** and set the Site URL to your deployed domain. Add the deployed domain to Redirect URLs too.

You can also deploy the static `dist` folder to Netlify or another static host.

## 6. Security notes before public launch

- Only use the Supabase publishable key / legacy `anon` key in the browser. Never use the `service_role` key in frontend code, GitHub, or client environment variables.
- Keep Row Level Security enabled. The supplied SQL enables it on the app tables.
- Configure rate limits and CAPTCHA / bot protection for authentication and messaging before opening signups broadly.
- Configure production SMTP and test magic links on desktop and mobile.
- Add moderation, blocking, reporting, listing expiry, and account deletion workflows before a public launch.
- Review privacy disclosures and applicable legal requirements.
- Public listing images are intentionally public. Do not upload private documents or personal photos to this bucket.
- Public profile rows contain aliases and general city only, not email addresses.
- Direct transactions happen between users. This starter does not collect payments or provide escrow.

## Current MVP limitations

- Location is a general city/area field, not exact distance search.
- Saved listings are stored in Supabase for signed-in users, but the starter does not load saved IDs into the UI on a fresh browser session yet.
- The messages screen lists recent messages. A full threaded conversation view and realtime updates are a subsequent implementation.
- Demo listings use illustrative external Pokémon card images and are not real offers. They disappear when Supabase is connected; only actual database listings are then shown.
- Pokémon catalog metadata and market pricing are not yet integrated.
- A seller can currently edit their profile alias and city; a full listing-management editor is a subsequent milestone.

## Brand / trademark note

Petoskémon is a working product name. Pokémon and related names, artwork, and marks belong to their respective owners. This independent marketplace is not affiliated with or endorsed by The Pokémon Company, Nintendo, Creatures Inc., or GAME FREAK. Obtain appropriate legal advice and brand clearance before commercial launch. Use appropriately licensed images and catalog data.

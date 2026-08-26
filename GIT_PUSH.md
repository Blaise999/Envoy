# Pushing to github.com/Blaise999/Envoy

## Before you commit — two checks

**1. Passwords must not be in the repo.**
`supabase/migrations/20260825000400_seed_admins.sql` in this folder has both
passwords replaced with `SET_BEFORE_RUNNING`. Run `RUN_ONCE_seed_admins.sql`
in the SQL Editor instead — it has the real values and is gitignored.

Change a password later without touching any file:

    select public.reset_admin_password('valadmin@envoy.com', 'NewPassword');

**2. Secrets must not be committed.**
After `git add .`, run `git status` and confirm these do NOT appear:

    .env
    supabase/.secrets.env
    RUN_ONCE_seed_admins.sql

All three are in `.gitignore`. If any shows up, stop and fix it.

## Push

    cd C:\Users\user\Desktop\envoy\Envoy-main
    git init
    git add .
    git status
    git commit -m "Migrate to Supabase, remove Express backend, strip injected payload"
    git remote add origin https://github.com/Blaise999/Envoy.git
    git branch -M main
    git push -u origin main --force

## About --force and the malware

Force-pushing replaces the current files but does NOT remove history. The
infected `postcss.config.js` and `tailwind.config.js` remain reachable at every
earlier commit, so anyone cloning an old commit still gets the payload.

If nothing in that history matters, the clean fix is to delete the repo on
GitHub and create it fresh, then push. That is the only way to be sure the
payload is gone.

Also check whether a backend `.env` was ever committed to either repo — it held
your Mongo URI, JWT_SECRET and Gmail app password. Those stay readable in
history too. Rotate them regardless.

## If the repo is public

Anyone can read it. Before making it public again, confirm:

- no passwords in any `.sql` file
- no `.env` committed, in the current tree or in history
- the Supabase service-role key appears nowhere (it should only ever live in
  `supabase secrets`)

The anon key is safe to expose by design — RLS is what protects your data, and
that is enforced in Postgres.

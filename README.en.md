# 📚 Knigotrek

[Русский](README.md) · **English**

**A free desktop writing-progress tracker for authors.** Track what you've written, set goals, analyze your habits, generate PDF reports, and work in focus mode — all locally on your computer.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> Knigotrek is open-source software. All features are free, with no subscriptions or limits. If you find it useful, you can support its development if you'd like — see [below](#-support-the-project).

## 🔒 Privacy

Knigotrek **never sends your data anywhere** — everything is stored locally on your device (SQLite on desktop, localStorage in the browser). The app tracks only **metadata** (numbers, time, tags) and **never asks for or stores the text of your book**. No accounts, no tracking, no cloud by default. If you want, you can enable cross-device sync via your own Supabase project (see below).

## Features

- **Progress tracking** — characters, days, streaks, charts, activity calendar
- **Projects** — books, genres, deadlines, statuses, unlimited number
- **Goals and challenges** — daily/project goals with progress
- **Focus mode** — a timer for productive writing that counts what you write
- **Notes and ideas**
- **PDF reports** — daily, weekly, monthly, per-project, year in review, and more
- **Smart assistant** — tips, deadline forecasts, analytics by tags and time
- **Achievements and records**
- **Social export** — images and PDFs for sharing
- **Dark theme**, local notifications, database backups
- **Optional cloud sync** across devices (see below)
- **Bilingual interface** (Russian / English) and “?” hints next to sections

## 📸 How it looks

| Dashboard — progress, day streak, finish forecast | Projects — deadlines, chapters, pace |
|:---:|:---:|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Projects](docs/screenshots/projects.png) |
| **Focus mode** — timer and session history | **Reports** — PDF and images |
| ![Focus mode](docs/screenshots/focus.png) | ![Reports](docs/screenshots/reports.png) |

## 📦 Installation (recommended)

> ⚠️ **Download Knigotrek only from the official repository** — from this project's [Releases](https://github.com/litsos629/knigotrek/releases) page on GitHub. We are not responsible for the safety of copies posted on third-party sites.

No command line needed. Download the prebuilt package for your system from the
**[Releases](https://github.com/litsos629/knigotrek/releases)** page and install it like a regular app:

| System | File | What to do |
|---|---|---|
| **Windows** | `knigotrek-…-win-x64.exe` | Run the installer — desktop and Start-menu shortcuts will appear |
| **macOS** | `knigotrek-…-mac.dmg` | Open it and drag Knigotrek into Applications |
| **Linux** | `knigotrek-…-linux-x64.AppImage` | Make the file executable and run it (or `.deb` for Ubuntu/Debian) |

> 💡 **On first launch your system may warn about an “unknown publisher”.** The app isn't signed with a paid certificate — this is normal for free open-source software (the code is open and can be inspected):
> - **Windows:** “Windows protected your PC” → **More info** → **Run anyway**.
> - **macOS:** right-click the app → **Open** → **Open**.

## Running from source (for developers)

```bash
# Install dependencies
npm install

# Desktop app (Electron) — the main mode
npm run electron:dev

# Web version in the browser (data in localStorage)
npm run dev

# Tests
npm test
```

Requirements: **Node.js 18+**, **npm 9+**.

## Building the desktop app

```bash
npm run dist:win    # Windows (.exe / portable)
npm run dist:mac    # macOS (.dmg)
npm run dist:linux  # Linux (.AppImage / .deb)
```

The built packages will appear in the `release/` directory.

## Cloud sync (optional)

By default, all data is stored **locally** (SQLite on desktop, localStorage in the browser) and is never sent anywhere.

If you need cross-device sync, you can connect your own free [Supabase](https://supabase.com) project:

1. Copy `.env.example` to `.env`
2. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project
3. Create the tables in Supabase (SQL Editor → paste the schema below → Run)
4. Restart the app — the “Data & sync” tab will become active

Without these variables, sync is simply inactive and everything else works as usual. The feature is marked **beta**.

<details>
<summary><b>SQL schema for Supabase (expand)</b></summary>

```sql
create table if not exists sync_entries (
  user_id uuid references auth.users not null,
  sync_id uuid not null,
  date text not null,
  symbols integer not null default 0,
  deleted integer not null default 0,
  project_id text,
  created_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, sync_id)
);

create table if not exists sync_projects (
  user_id uuid references auth.users not null,
  id text not null,
  title text not null,
  genre text,
  target_symbols integer default 0,
  deadline text,
  status text,
  phase text default 'draft',
  start_date text,
  completed_date text,
  description text,
  unfreeze_count integer default 0,
  is_hidden boolean default false,
  created_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists sync_chapters (
  user_id uuid references auth.users not null,
  id text not null,
  project_id text,
  title text not null,
  status text default 'planned',
  position integer default 0,
  created_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists sync_sessions (
  user_id uuid references auth.users not null,
  id text not null,
  date text not null,
  duration integer default 0,
  planned_duration integer default 0,
  symbols integer default 0,
  speed integer default 0,
  mood text,
  tags text,
  note text,
  project_id text,
  created_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists sync_notes (
  user_id uuid references auth.users not null,
  id text not null,
  title text not null,
  content text,
  date text,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists sync_settings (
  user_id uuid references auth.users not null,
  key text not null,
  value text,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Access limited to your own rows
alter table sync_entries enable row level security;
alter table sync_projects enable row level security;
alter table sync_chapters enable row level security;
alter table sync_sessions enable row level security;
alter table sync_notes enable row level security;
alter table sync_settings enable row level security;

create policy "own rows" on sync_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on sync_projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on sync_chapters for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on sync_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on sync_notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on sync_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

</details>

## Tech stack

- **React 19** + **TypeScript**
- **Vite** — build
- **Tailwind CSS** — styling
- **Electron** — desktop shell
- **SQLite** (better-sqlite3) — local database
- **Vitest** — tests
- **Supabase** — optional sync

## ❤️ Support the project

Knigotrek is free and developed in spare time. If it's been useful to you:

- ⭐ [**Star the repository**](https://github.com/litsos629/knigotrek) — this is the best and completely free way to support it

## 💬 Feedback

Found a bug, something not working right, have an idea, or just want to say it clicked (or didn't)? Open an **[Issue](https://github.com/litsos629/knigotrek/issues)** — it's the best way to help the project. Any feedback is valuable: what to fix, what's missing, what you liked.

## Contributing

Bug reports, ideas, and pull requests are welcome. For larger changes, please open an issue first to discuss.

```bash
npm install        # install
npm test           # tests should pass
npm run type-check # type checking
```

## License

[MIT](./LICENSE) © litsos629

# Property Cleaning Checklists

Mobile-ready cleaning checklists for Azzurro Hotels properties.

## Access

- Reception Team: full checklist access, Reception notes, additional tasks, reset controls, and complete copy options.
- Cleaning Team: task completion, Cleaner notes, reports, and shift checklists. Cleaning users enter their name after signing in.

The shared Cleaning Team account can be used on more than one device at the same time. Each browser session records its own cleaner name. Cleaner names are shown once at the top of copied reports.

## Supabase setup

The Supabase database and 14-day retention schedule are managed separately from this GitHub repository.

The database keeps daily checklist records for the latest 14 Sydney calendar days. Older checklist status, notes, additional tasks, and cleaner names are permanently deleted from the active Supabase tables by a scheduled daily cleanup job.

## GitHub Pages

Upload all files and folders to the repository root, then enable GitHub Pages for the repository.

Created and Maintained by Alvin Rustia.

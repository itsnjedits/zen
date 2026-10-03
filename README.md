# Chronicle — Thoughts in Time

A polished vanilla HTML/CSS/JS PWA for recording thoughts, plans and everyday notes with a timestamp attached to each new thought.

## Product / UX structure

- **Sidebar:** notebook switcher, create notebook, search, export/import backup, settings.
- **Top bar:** current notebook + date context + live clock toggle + settings shortcut.
- **Timeline:** every entry has an immutable creation timestamp and editable text.
- **Writing rule:** `Enter` finishes the current thought and creates a new timestamped entry. `Shift + Enter` creates a normal line break inside the current thought.
- **Auto-save:** debounced localStorage writes plus an immediate write after structural actions and before unload.
- **Notebooks:** create, rename, duplicate and delete (one notebook is always retained).
- **Search:** searches across all notebooks and jumps directly to the matching entry.
- **Themes:** Mystic, Midnight, Forest, Ocean, Sunset, Minimal.
- **Backups:** JSON export/import, so localStorage is convenient but not the only copy.
- **PWA:** manifest + service worker for installable/offline use when served from HTTPS/localhost.
- **Responsive:** desktop sidebar + mobile drawer; writing area is touch-friendly.

## Feature architecture

```text
UI Layer
  ├─ Sidebar / notebooks
  ├─ Timeline / editable entry cards
  ├─ Clock / topbar
  ├─ Search modal
  ├─ Settings modal
  └─ Context menu / toasts

State Layer
  └─ data
      ├─ activeNotebookId
      ├─ notebooks[]
      │   ├─ id
      │   ├─ name
      │   └─ entries[]
      │       ├─ id
      │       ├─ timestamp
      │       └─ text
      └─ settings
          ├─ theme
          ├─ clock
          ├─ hour24
          └─ prompt

Persistence
  └─ localStorage (chronicle.v1.data)
      ├─ debounced writes for typing
      └─ immediate writes for structural changes

Offline / App shell
  ├─ manifest.json
  └─ sw.js
```

## Run locally

Because service workers require a secure context, use a tiny local server instead of opening `index.html` via `file://`.

Examples:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

No build step. No framework. No backend.

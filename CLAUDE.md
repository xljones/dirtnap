# Dirt Nap — Claude Context

> A web app for cataloguing sediment samples. *The samples are at rest.*

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Python 3.14, Flask, SQLite (built-in `sqlite3`) |
| Frontend | React 18, Vite, React Router |
| Auth | Flask-Login + `werkzeug.security` password hashing |
| Lint / typecheck / test | ruff, mypy, pytest (backend); eslint, vitest (frontend) |
| Dev environment | Docker Compose (two services: `backend`, `frontend`) |
| Deployment | PythonAnywhere (Flask serves built React `dist/`) |

## Architecture

### Backend (`backend-src/`)

DDD-inspired layering — routes never write SQL directly.

```
dirtnap/
  __init__.py        create_app() factory; Flask-Login setup, before_request auth guard
  db.py              get_db(), run_migrations() — migration runner reads migrations/*.sql
  migrations/        Numbered SQL files (001_initial.sql, …)
  domain/            Plain dataclasses: Box, Core, Tube, User, Location
  repositories/      BoxRepository, CoreRepository, TubeRepository, UserRepository, LocationRepository — own all SQL
  routes/            Flask Blueprints: admin, auth, boxes, cores, tubes, scan, export, locations, users
                     (export/ is a package: boxes, cores, tubes — CSV/TSV/JSON/GeoJSON)
```

- **Adding a schema change:** drop a new `NNN_description.sql` in `migrations/`. It runs automatically on next startup and is recorded in `schema_migrations`.
- **Adding an endpoint:** add a method to the relevant repository, call it from the relevant blueprint.
- **Auth:** Flask-Login guards all routes via `@login_required`; an additional `before_request` hook in `__init__.py` enforces account expiry (logs the user out) and read-only mode (blocks non-GET writes except password change / logout).
- **Admin-only:** `routes/admin.py` exposes `/api/admin/pythonanywhere` (CPU, web app, scheduled task info) — gated on `current_user.is_admin`. Requires `PA_API_TOKEN` and `PA_USERNAME` env vars.

### Frontend (`frontend-src/`)

```
App.jsx              Shell: checks auth state, renders LoginPage or the main layout (sidebar + bottom nav)
AuthContext.jsx      Provides user, login(), logout() via React context
api.js               Thin fetch wrapper; all calls use credentials: 'include'
constants.js         Shared frontend constants (e.g. FormMode)
styles/              Per-concern CSS modules (base, buttons, cards, forms, layout, tables, …)
components/          Pages: Dashboard, BoxList, BoxDetail, TubeList, TubeDetail, TubeForm,
                     CoreList, CoreDetail, CoreForm, ScanPage, LoginPage,
                     LocationList, LocationDetail, AccountPage, UserList (admin panel)
                     Shared: BarcodeInput, CameraScanner, ComboInput, CoordCard, ExportDropdown,
                     LeafletMap, MapExportMenu, MapPicker, PythonAnywhereStats, RelativeTime,
                     Skeleton, BuildInfo, Toast
```

- **BarcodeInput** — composes manual text input + camera toggle; USB scanners work natively as keyboard wedge.
- **CameraScanner** — lazy-loaded; starts camera immediately on mount (triggers browser permission), enumerates devices after permission granted, auto-detects front/rear for mirror correction.
- **UserList** — admin-only page mounted at `/admin`; manages users and embeds `PythonAnywhereStats`.

## Running locally

```bash
make run            # start both services
make stop           # stop
make logs           # tail logs (make logs service=backend for one service)
make build          # rebuild images (needed after requirements.txt or Dockerfile changes)
make build-frontend # compile React into dist/ (for local production preview)
```

### Database & users

```bash
make migrate                                       # apply any pending migrations
make seed                                          # populate sample data (~15 boxes, 4 cores, ~55 tubes)
make reset-db                                      # drop all tables (interactive confirm) — including users
make db-backup                                     # write data/db-backup-<timestamp>.sql
make db-restore file=db-backup-<timestamp>.sql     # restore from backup (interactive confirm)

make create-user  username=x password=y            # normal user
make create-admin username=x password=y            # admin user
make rename-user  username=x new_username=y
make delete-user  username=x                       # interactive confirm
make list-users
```

### Dev tooling

```bash
make format            # ruff format the backend
make lint-backend      # ruff check + mypy
make lint-frontend     # eslint
make test-backend      # pytest with 100% coverage gate (see pyproject.toml)
make test-frontend     # vitest
make test              # all of the above (mirrors CI)
```

The database is at `data/samples.db` (bind-mounted into the backend container).

## PythonAnywhere deployment

```bash
make deploy-pa    # checkout deploy branch, reset to origin/deploy, create venv if needed, install deps
```

All `make` commands listed under **Database & users** above auto-detect the environment: on PythonAnywhere they run via `venv/bin/python backend-src/manage.py` directly; locally they go through Docker. Detection uses `PYTHONANYWHERE_SITE`, an env var PythonAnywhere injects automatically into every console and web process (set to the site's domain, e.g. `username.pythonanywhere.com`).

See [DEPLOYMENT.md](DEPLOYMENT.md) for first-time setup.

## Key conventions

- Commit format: `feat/fix/chore(component): one-line description`
- Small, focused commits — never bulk everything together
- Never commit or push without explicit instruction
- Backend changes that don't touch `requirements.txt` or `Dockerfile.backend` hot-reload via the bind mount — no rebuild needed
- Frontend changes hot-reload via Vite — no rebuild needed

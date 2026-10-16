#!/usr/bin/env python3
"""Management CLI. Usage: python manage.py <command> [args]"""
import sys
from collections.abc import Callable
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))


def cmd_create_user(args: list[str]) -> None:
    is_admin = "--admin" in args
    args = [a for a in args if a != "--admin"]
    if len(args) != 2:
        print("Usage: python manage.py create-user <username> <password> [--admin]")
        sys.exit(1)
    username, password = args
    from dirtnap.db import get_db
    from dirtnap.repositories.user_repository import UserRepository
    with get_db() as db:
        repo = UserRepository(db)
        if repo.get_by_username(username):
            print(f"Error: user '{username}' already exists")
            sys.exit(1)
        repo.create(username, password, is_admin=is_admin)
    kind = "admin" if is_admin else "normal"
    print(f"{kind.capitalize()} user '{username}' created.")


def cmd_list_users(_: list[str]) -> None:
    from dirtnap.db import get_db
    with get_db() as db:
        users = db.execute(
            "SELECT id, username, is_readonly, is_admin, expires_at, created_at FROM users ORDER BY id"
        ).fetchall()
    if not users:
        print("No users.")
    for u in users:
        kind = "admin" if u[3] else ("read-only" if u[2] else "normal")
        expiry = f"  expires {u[4]}" if u[4] else ""
        print(f"  [{u[0]}] {u[1]}  ({kind}{expiry})  created {u[5]}")


def cmd_seed(_: list[str]) -> None:
    from dirtnap.db import get_db, run_migrations
    from dirtnap.repositories.box_repository import BoxRepository
    from dirtnap.repositories.core_repository import CoreRepository
    from dirtnap.repositories.tube_repository import TubeRepository

    run_migrations()

    DEFAULT_LOCATIONS = [
        "Tromsø – Lab",
        "Southampton - Lab A",
        "Southampton - Lab B",
        "In transit",
    ]

    BOXES = [
        # (barcode, name, location_name, notes)
        ("BX-001", "North Sea Set A",      "Southampton - Lab A", None),
        ("BX-002", "North Sea Set B",      "Southampton - Lab A", None),
        ("BX-003", "North Sea Set C",      "Southampton - Lab A", None),
        ("BX-004", "Thames Est. Set 1",    "Southampton - Lab B", None),
        ("BX-005", "Thames Est. Set 2",    "Southampton - Lab B", None),
        ("BX-006", "Thames Est. Set 3",    "Southampton - Lab B", None),
        ("BX-007", "Thames Est. Set 4",    "Southampton - Lab B", None),
        ("BX-008", "Norfolk Broads Set 1", "Southampton - Lab A", None),
        ("BX-009", "Norfolk Broads Set 2", "Southampton - Lab A", None),
        ("BX-010", "Norfolk Broads Set 3", "Southampton - Lab A", None),
        ("BX-011", "Norfolk Broads Set 4", "Southampton - Lab A", None),
        ("BX-012", "Loch Etive Set 1",     "Tromsø – Lab",       None),
        ("BX-013", "Loch Etive Set 2",     "Tromsø – Lab",       None),
        ("BX-014", "Loch Etive Set 3",     "Tromsø – Lab",       None),
        ("BX-015", "Loch Etive Set 4",     "Tromsø – Lab",       None),
    ]

    CORES = [
        # (barcode, name, loc_name, site_name, lat, lon, date,
        #  sample_type, depth_cm, collector, owner, notes)
        (
            "CR-001", "North Sea Core NS-1", "Southampton - Lab A",
            "North Sea Block 49/5", 56.82, 2.41, "2023-07-14",
            "Piston core", 105, "J. Harrison", "NOC Southampton",
            "Long piston core, 2023 cruise",
        ),
        (
            "CR-002", "Thames Est. Core TE-1", "Southampton - Lab B",
            "Thames Estuary, Canvey Island", 51.52, 0.60, "2022-09-03",
            "Gouge core", 75, "A. Phillips", "BGS",
            "Intertidal flat, spring tide",
        ),
        (
            "CR-003", "Norfolk Broads NB-1", "Southampton - Lab A",
            "Hickling Broad, Norfolk", 52.76, 1.56, "2021-04-20",
            "Russian corer", 80, "S. Weston", "UEA",
            "Hickling Broad, 4m water depth",
        ),
        (
            "CR-004", "Loch Etive LE-1", "Tromsø – Lab",
            "Loch Etive, Argyll", 56.47, -5.23, "2020-08-05",
            "Gravity core", 105, "T. Andersen", "SAMS",
            "Fjordic basin, 145m depth",
        ),
    ]

    # (barcode, box_bc, core_bc, sample_date, sample_type, description, vol_ml, wt_g, depth_cm)
    # site/lat/lon inherited from core. sample_date is the lab sub-sampling date.
    # A few tubes carry explicit coords to demonstrate the override feature.
    TUBES = [
        # CR-001: North Sea Block 49/5, Piston core 105 cm, collected 2023-07-14
        # BX-001 — sub-sampled 2023-07-21
        ("T-0001", "BX-001", "CR-001", "2023-07-21", "Sediment", "Olive-grey silty clay",            45.0,  98.2,   5.0),
        ("T-0002", "BX-001", "CR-001", "2023-07-21", "Sediment", "Olive-grey silty clay",            45.0,  97.1,  15.0),
        ("T-0003", "BX-001", "CR-001", "2023-07-22", "Sediment", "Sandy layer, possible turbidite",  40.0, 102.5,  25.0),
        ("T-0004", "BX-001", "CR-001", "2023-07-22", "Sediment", "Dark organic-rich layer",          38.0,  89.3,  40.0),
        ("T-0005", "BX-001", "CR-001", "2023-07-23", "Sediment", "Foram-rich foraminiferal ooze",    50.0, 110.0,  55.0),
        # BX-002 — sub-sampled 2023-08-01
        ("T-0006", "BX-002", "CR-001", "2023-08-01", "Sediment", "Foram-rich foraminiferal ooze",    50.0, 108.4,  65.0),
        ("T-0007", "BX-002", "CR-001", "2023-08-01", "Sand",     "Coarse sand, IRD present",         42.0,  95.0,  70.0),
        ("T-0008", "BX-002", "CR-001", "2023-08-02", "Sediment", "Dark laminated clay",              44.0,  96.1,  75.0),
        ("T-0009", "BX-002", "CR-001", "2023-08-02", "Sediment", "Bioturbated silty clay",           43.0,  93.8,  80.0),
        ("T-0010", "BX-002", "CR-001", "2023-08-03", "Sediment", "Stiff grey clay",                  41.0,  99.0,  85.0),
        # BX-003 — sub-sampled 2023-08-07
        ("T-0011", "BX-003", "CR-001", "2023-08-07", "Sediment", "Stiff grey clay",                  41.0,  98.5,  90.0),
        ("T-0012", "BX-003", "CR-001", "2023-08-07", "Sand",     "Coarse basal sand",                40.0, 103.5,  95.0),
        ("T-0013", "BX-003", "CR-001", "2023-08-08", "Sediment", "Coarse gravelly unit",             38.0, 108.0, 100.0),
        ("T-0014", "BX-003", "CR-001", "2023-08-08", "Sediment", "Basal diamicton",                  35.0, 115.2, 103.0),
        # CR-002: Thames Estuary, Gouge core 75 cm, collected 2022-09-03
        # BX-004 — sub-sampled 2022-09-16
        ("T-0015", "BX-004", "CR-002", "2022-09-16", "Organic",  "Peat layer, dark brown fibrous",   30.0,  52.4,   8.0),
        ("T-0016", "BX-004", "CR-002", "2022-09-16", "Sediment", "Blue-grey estuarine clay",         48.0, 103.2,  18.0),
        ("T-0017", "BX-004", "CR-002", "2022-09-17", "Sediment", "Blue-grey estuarine clay",         47.0, 101.5,  28.0),
        ("T-0018", "BX-004", "CR-002", "2022-09-17", "Sand",     "Tidal flat sand, shell fragments", 35.0,  88.9,  40.0),
        # BX-005 — sub-sampled 2022-09-23
        ("T-0019", "BX-005", "CR-002", "2022-09-23", "Sediment", "Silty clay with organic flecks",   46.0,  99.0,  48.0),
        ("T-0020", "BX-005", "CR-002", "2022-09-23", "Sediment", "Silty clay with organic flecks",   45.0,  97.3,  55.0),
        ("T-0021", "BX-005", "CR-002", "2022-09-24", "Organic",  "Buried saltmarsh peat",            28.0,  48.1,  60.0),
        ("T-0022", "BX-005", "CR-002", "2022-09-24", "Sediment", "Dark grey organic clay",           44.0,  94.5,  65.0),
        # BX-006 — sub-sampled 2022-09-30
        ("T-0023", "BX-006", "CR-002", "2022-09-30", "Sediment", "Laminated estuarine clay",         46.0, 100.0,  68.0),
        ("T-0024", "BX-006", "CR-002", "2022-09-30", "Sand",     "Sandy fluvial unit",               35.0,  85.0,  71.0),
        ("T-0025", "BX-006", "CR-002", "2022-10-01", "Sediment", "Basal grey clay",                  44.0, 101.5,  74.0),
        # BX-007 — sub-sampled 2022-10-07 (cross-section re-samples)
        ("T-0026", "BX-007", "CR-002", "2022-10-07", "Organic",  "Rootlet bed, reworked peat",       26.0,  43.5,  35.0),
        ("T-0027", "BX-007", "CR-002", "2022-10-07", "Sediment", "Blue-grey silty clay",             47.0, 103.0,  50.0),
        # CR-003: Hickling Broad, Russian corer 80 cm, collected 2021-04-20
        # BX-008 — sub-sampled 2021-05-05
        ("T-0028", "BX-008", "CR-003", "2021-05-05", "Sediment", "Lake marl, white calcareous",      40.0,  72.3,   5.0),
        ("T-0029", "BX-008", "CR-003", "2021-05-05", "Sediment", "Lake marl, white calcareous",      40.0,  71.0,  15.0),
        ("T-0030", "BX-008", "CR-003", "2021-05-06", "Organic",  "Gyttja, dark organic lake mud",    38.0,  68.5,  25.0),
        ("T-0031", "BX-008", "CR-003", "2021-05-06", "Organic",  "Gyttja, dark organic lake mud",    37.0,  67.1,  35.0),
        # BX-009 — sub-sampled 2021-05-13
        ("T-0032", "BX-009", "CR-003", "2021-05-13", "Peat",     "Reed peat, brown fibrous",         32.0,  55.8,  45.0),
        ("T-0033", "BX-009", "CR-003", "2021-05-13", "Sediment", "Grey silty clay with diatoms",     41.0,  80.2,  55.0),
        ("T-0034", "BX-009", "CR-003", "2021-05-14", "Organic",  "Dark gyttja",                      39.0,  71.4,  62.0),
        # BX-010 — sub-sampled 2021-05-19
        ("T-0035", "BX-010", "CR-003", "2021-05-19", "Peat",     "Fen peat",                         31.0,  53.2,  65.0),
        ("T-0036", "BX-010", "CR-003", "2021-05-19", "Sediment", "Calcareous mud",                   40.0,  78.9,  70.0),
        ("T-0037", "BX-010", "CR-003", "2021-05-20", "Organic",  "Organic-rich clay",                39.0,  73.6,  75.0),
        # BX-011 — sub-sampled 2021-05-26 (additional cross-section)
        ("T-0038", "BX-011", "CR-003", "2021-05-26", "Organic",  "Gyttja, transition zone",          38.0,  69.5,  20.0),
        ("T-0039", "BX-011", "CR-003", "2021-05-26", "Sediment", "Sandy clay, possible storm layer", 42.0,  83.5,  40.0),
        ("T-0040", "BX-011", "CR-003", "2021-05-27", "Peat",     "Basal peat, woody fragments",      30.0,  51.0,  58.0),
        # CR-004: Loch Etive, Gravity core 105 cm, collected 2020-08-05
        # BX-012 — sub-sampled 2020-08-21
        ("T-0041", "BX-012", "CR-004", "2020-08-21", "Sediment", "Dark laminated fjord sediment",    46.0, 100.7,   3.0),
        ("T-0042", "BX-012", "CR-004", "2020-08-21", "Sediment", "Varved clay, annual laminae",      45.0,  98.9,  15.0),
        ("T-0043", "BX-012", "CR-004", "2020-08-22", "Sediment", "Varved clay, annual laminae",      44.0,  97.4,  30.0),
        # BX-013 — sub-sampled 2020-09-04
        ("T-0044", "BX-013", "CR-004", "2020-09-04", "Sediment", "Olive-grey silty clay",            45.0,  99.2,  45.0),
        ("T-0045", "BX-013", "CR-004", "2020-09-04", "Sediment", "Olive-grey silty clay",            44.0,  97.8,  55.0),
        ("T-0046", "BX-013", "CR-004", "2020-09-05", "Organic",  "Organic-rich layer",               36.0,  68.3,  65.0),
        ("T-0047", "BX-013", "CR-004", "2020-09-05", "Sand",     "Event layer, coarse sand",         38.0,  92.0,  75.0),
        # BX-014 — sub-sampled 2020-09-15
        ("T-0048", "BX-014", "CR-004", "2020-09-15", "Sediment", "Stiff grey clay",                  43.0,  99.5,  85.0),
        ("T-0049", "BX-014", "CR-004", "2020-09-15", "Sediment", "Sandy silt, possible turbidite",   42.0,  98.3,  90.0),
        ("T-0050", "BX-014", "CR-004", "2020-09-16", "Sediment", "Dark grey clay",                   44.0, 100.1,  95.0),
        # BX-015 — sub-sampled 2020-09-20
        ("T-0051", "BX-015", "CR-004", "2020-09-20", "Sediment", "Pale grey silty clay",             44.0,  96.5,  98.0),
        ("T-0052", "BX-015", "CR-004", "2020-09-20", "Sand",     "Shelly coarse sand",               37.0,  87.2, 100.0),
        ("T-0053", "BX-015", "CR-004", "2020-09-21", "Sediment", "Grey silty clay",                  45.0,  98.1, 103.0),
        # Alpine surface samples — no core, no box (standalone field tubes)
        ("T-0054", None, None, "2024-06-12", "Sediment", "Glacier forefield till, Mer de Glace", 30.0, 62.1, 10.0),
        ("T-0055", None, None, "2024-07-03", "Sediment", "Proglacial outwash, Ötztal",            28.0, 58.4,  8.0),
    ]

    # Tubes that carry their own coordinates (overriding core inheritance)
    TUBE_COORD_OVERRIDES: dict[str, tuple[float, float]] = {
        "T-0007": (56.835, 2.447),   # IRD sand — slightly offset sample position
        "T-0021": (51.548, 0.598),   # Buried saltmarsh peat — precise peat outcrop
        "T-0047": (56.472, -5.231),  # Event sand layer — deeper basin sample point
        "T-0054": (45.897,  6.937),  # Mer de Glace, Mont Blanc massif, France
        "T-0055": (46.869, 10.847),  # Ötztal Alps, Austria/Italy border
    }

    with get_db() as db:
        box_repo = BoxRepository(db)
        core_repo = CoreRepository(db)
        tube_repo = TubeRepository(db)
        box_ids = {}
        core_ids = {}

        for loc_name in DEFAULT_LOCATIONS:
            exists = db.execute(
                "SELECT 1 FROM locations WHERE name=?", (loc_name,)
            ).fetchone()
            if not exists:
                db.execute("INSERT INTO locations (name) VALUES (?)", (loc_name,))
                print(f"  location: {loc_name}")

        locs = {
            r["name"]: r["id"]
            for r in db.execute("SELECT id, name FROM locations").fetchall()
        }

        for barcode, name, loc_name, notes in BOXES:
            if box_repo.get_by_barcode(barcode):
                print(f"  skip box {barcode} (already exists)")
                continue
            box = box_repo.create(barcode, name, locs.get(loc_name), notes)
            box_ids[barcode] = box["id"]
            print(f"  box {barcode} — {name}")

        for (bc, name, loc_name, site, lat, lon, date,
             stype, depth, collector, owner, notes) in CORES:
            if core_repo.get_by_barcode(bc):
                print(f"  skip core {bc} (already exists)")
                continue
            core = core_repo.create(
                bc, name=name, location_id=locs.get(loc_name),
                site_name=site, latitude=lat, longitude=lon,
                collection_date=date, sample_type=stype,
                depth_cm=depth, collector=collector, owner=owner, notes=notes,
            )
            core_ids[bc] = core["id"]
            print(f"  core {bc} — {name}")

        for (barcode, box_bc, core_bc, sample_date, stype, desc, vol, wt, depth) in TUBES:
            if tube_repo.get_by_barcode(barcode):
                print(f"  skip tube {barcode} (already exists)")
                continue
            box_id = (box_ids.get(box_bc) or (box_repo.get_by_barcode(box_bc) or {}).get("id")) if box_bc else None
            core_id = (core_ids.get(core_bc) or (core_repo.get_by_barcode(core_bc) or {}).get("id")) if core_bc else None
            lat, lon = TUBE_COORD_OVERRIDES.get(barcode, (None, None))
            tube_repo.create(
                barcode, box_id=box_id, core_id=core_id,
                sample_date=sample_date, sample_type=stype, description=desc,
                latitude=lat, longitude=lon,
                volume_ml=vol, weight_g=wt, depth_cm=depth,
            )
            core_ref = f"core {core_bc}" if core_bc else "no core"
            print(f"  tube {barcode} — {core_ref} @ {depth}cm")

    print(f"\nDone. {len(BOXES)} boxes, {len(CORES)} cores, {len(TUBES)} tubes.")


def cmd_rename_user(args: list[str]) -> None:
    if len(args) != 2:
        print("Usage: python manage.py rename-user <username> <new-username>")
        sys.exit(1)
    username, new_username = args
    from dirtnap.db import get_db
    from dirtnap.repositories.user_repository import UserRepository
    with get_db() as db:
        repo = UserRepository(db)
        user = repo.get_by_username(username)
        if not user:
            print(f"Error: user '{username}' not found")
            sys.exit(1)
        if repo.get_by_username(new_username):
            print(f"Error: user '{new_username}' already exists")
            sys.exit(1)
        repo.rename(user["id"], new_username)
    print(f"User '{username}' renamed to '{new_username}'.")


def cmd_delete_user(args: list[str]) -> None:
    if len(args) != 1:
        print("Usage: python manage.py delete-user <username>")
        sys.exit(1)
    username = args[0]
    from dirtnap.db import get_db
    from dirtnap.repositories.user_repository import UserRepository
    with get_db() as db:
        repo = UserRepository(db)
        if not repo.get_by_username(username):
            print(f"Error: user '{username}' not found")
            sys.exit(1)
    confirm = input(f"Delete user '{username}'? Type YES to confirm: ")
    if confirm.strip() != "YES":
        print("Aborted.")
        sys.exit(0)
    with get_db() as db:
        repo = UserRepository(db)
        user = repo.get_by_username(username)
        repo.delete(user["id"])
    print(f"User '{username}' deleted.")


def cmd_db_restore(args: list[str]) -> None:
    import os
    import sqlite3 as _sqlite3

    if len(args) != 1:
        print("Usage: python manage.py db-restore <backup-file>")
        sys.exit(1)

    db_path = os.environ.get("DB_PATH", "data/samples.db")
    backup_path = Path(args[0])
    if not backup_path.is_absolute():
        backup_path = Path(db_path).parent / args[0]

    if not backup_path.exists():
        print(f"Error: backup file not found: {backup_path}")
        sys.exit(1)

    confirm = input(f"Restore from '{backup_path}'? This will overwrite the current database. Type YES to confirm: ")
    if confirm.strip() != "YES":
        print("Aborted.")
        sys.exit(0)

    sql = backup_path.read_text()
    Path(db_path).unlink(missing_ok=True)
    con = _sqlite3.connect(db_path)
    con.executescript(sql)
    con.close()
    print(f"Database restored from {backup_path}")


def cmd_db_backup(_: list[str]) -> None:
    from dirtnap.backups import backup_dir, create_backup
    backup = create_backup()
    print(f"Backup written to {backup_dir() / backup.name}")


def cmd_migrate(_: list[str]) -> None:
    from dirtnap.db import run_migrations
    run_migrations()
    print("Migrations complete.")


def cmd_reset_db(args: list[str]) -> None:
    msg = "This will drop ALL tables including users. Type YES to confirm: "
    confirm = input(msg)
    if confirm.strip() != "YES":
        print("Aborted.")
        sys.exit(0)
    from dirtnap.db import get_db
    with get_db() as db:
        tables = [
            "tube_history", "box_history", "core_history",
            "tubes", "boxes", "cores", "locations",
            "schema_migrations", "users"
        ]
        for table in tables:
            db.execute(f"DROP TABLE IF EXISTS {table}")
    print(f"All tables dropped. Run seed to repopulate.")


COMMANDS: dict[str, Callable[[list[str]], None]] = {
    "create-user": cmd_create_user,
    "list-users":  cmd_list_users,
    "rename-user": cmd_rename_user,
    "delete-user": cmd_delete_user,
    "migrate":     cmd_migrate,
    "seed":        cmd_seed,
    "reset-db":    cmd_reset_db,
    "db-backup":   cmd_db_backup,
    "db-restore":  cmd_db_restore,
}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(f"Available commands: {', '.join(COMMANDS)}")
        sys.exit(1)
    COMMANDS[sys.argv[1]](sys.argv[2:])

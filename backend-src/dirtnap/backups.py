import os
import sqlite3
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from dirtnap.db import db_path


@dataclass
class Backup:
    name: str
    size_bytes: int
    created_at: str

    @classmethod
    def from_path(cls, path: Path) -> "Backup":
        stat = path.stat()
        created = datetime.fromtimestamp(stat.st_mtime, timezone.utc)
        return cls(
            name=path.name,
            size_bytes=stat.st_size,
            created_at=created.strftime("%Y-%m-%dT%H:%M:%SZ"),
        )


def backup_dir() -> Path:
    """Backups live alongside the database (data/ locally and on PythonAnywhere)."""
    return Path(db_path()).parent


def list_backups() -> list[Backup]:
    backups = [Backup.from_path(p) for p in backup_dir().glob("*.sql") if p.is_file()]
    return sorted(backups, key=lambda b: (b.created_at, b.name), reverse=True)


def get_backup_path(name: str) -> Path | None:
    """Resolve a backup by file name, only if it is one that list_backups() would show."""
    path = backup_dir() / name
    if path.name != name or path.suffix != ".sql" or not path.is_file():
        return None
    return path


def create_backup() -> Backup:
    """Dump the database to data/db-backup-<timestamp>.sql as a plain SQL script."""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = backup_dir() / f"db-backup-{ts}.sql"
    # Write to a temp file and rename so a half-written dump never shows up in the list.
    tmp = path.with_suffix(".sql.tmp")
    with closing(sqlite3.connect(db_path())) as con, open(tmp, "w") as f:
        for line in con.iterdump():
            f.write(line + "\n")
    os.replace(tmp, path)
    return Backup.from_path(path)

from collections import defaultdict
from typing import Any

from dirtnap.repositories.base import BaseRepository


class BoxRepository(BaseRepository):
    FLAT_FIELDS: list[str] = [
        "barcode",
        "name",
        "location",
        "notes",
        "tube_count",
        "created_at",
    ]
    WITH_TUBES_FIELDS: list[str] = [
        "row_type",
        "box_barcode",
        "box_name",
        "box_location",
        "box_notes",
        "box_tube_count",
        "box_created_at",
        "tube_barcode",
        "tube_sample_date",
        "tube_site_name",
        "tube_latitude",
        "tube_longitude",
        "tube_sample_type",
        "tube_description",
        "tube_volume_ml",
        "tube_weight_g",
        "tube_depth_cm",
        "tube_created_at",
        "tube_updated_at",
    ]

    def list_all(self) -> list[dict[str, Any]]:
        """Return all boxes with location name and tube count, newest first."""
        return self._rows(
            self.db.execute("""
            SELECT b.*, l.name AS location_name, COUNT(t.id) AS tube_count
            FROM boxes b
            LEFT JOIN locations l ON l.id = b.location_id
            LEFT JOIN tubes t ON t.box_id = b.id
            GROUP BY b.id ORDER BY b.created_at DESC
        """).fetchall()
        )

    def get_by_id(self, box_id: int) -> dict[str, Any] | None:
        """Return a single box by its primary key, including location name, or None if not found."""
        return self._row(
            self.db.execute(
                """
            SELECT b.*, l.name AS location_name
            FROM boxes b LEFT JOIN locations l ON l.id = b.location_id
            WHERE b.id=?
        """,
                (box_id,),
            ).fetchone()
        )

    def get_with_tubes(self, box_id: int) -> dict[str, Any] | None:
        """Return a box with its depth-ordered tubes list, or None if not found."""
        box = self.get_by_id(box_id)
        if not box:
            return None
        box["tubes"] = self._rows(
            self.db.execute(
                """
                SELECT t.*, c.barcode AS core_barcode, c.name AS core_name,
                       c.site_name AS core_site_name, c.sample_type AS core_sample_type,
                       c.latitude AS core_latitude, c.longitude AS core_longitude
                FROM tubes t
                LEFT JOIN cores c ON c.id = t.core_id
                WHERE t.box_id=? ORDER BY t.depth_cm ASC, t.created_at ASC
                """,
                (box_id,),
            ).fetchall()
        )
        return box

    def get_by_barcode(self, barcode: str) -> dict[str, Any] | None:
        """Return a box by its barcode, including location name, or None if not found."""
        return self._row(
            self.db.execute(
                """
            SELECT b.*, l.name AS location_name
            FROM boxes b LEFT JOIN locations l ON l.id = b.location_id
            WHERE b.barcode=?
        """,
                (barcode,),
            ).fetchone()
        )

    def create(
        self,
        barcode: str,
        name: str | None = None,
        location_id: int | None = None,
        notes: str | None = None,
        changed_by: int | None = None,
    ) -> dict[str, Any]:
        """Insert a new box and record its initial history snapshot; return the created box."""
        cur = self.db.execute(
            "INSERT INTO boxes (barcode, name, location_id, notes) VALUES (?,?,?,?)",
            (barcode, name, location_id, notes),
        )
        row_id = cur.lastrowid
        if row_id is None:  # pragma: no cover
            raise RuntimeError("INSERT returned no row ID")
        box = self.get_by_id(row_id)
        if box is None:  # pragma: no cover
            raise RuntimeError(f"Row {row_id} not found after INSERT")
        self._record_history(box, changed_by)
        return box

    def update(
        self,
        box_id: int,
        barcode: str,
        name: str | None = None,
        location_id: int | None = None,
        notes: str | None = None,
        changed_by: int | None = None,
    ) -> dict[str, Any] | None:
        """Update box fields, record a history snapshot, and return the updated box."""
        self.db.execute(
            "UPDATE boxes SET barcode=?, name=?, location_id=?, notes=?,"
            " updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (barcode, name, location_id, notes, box_id),
        )
        box = self.get_by_id(box_id)
        if box is not None:
            self._record_history(box, changed_by)
        return box

    def get_history(self, box_id: int) -> list[dict[str, Any]]:
        """Return full audit history for a box, newest first, with username and location."""
        return self._rows(
            self.db.execute(
                """
            SELECT bh.*, u.username AS changed_by_username, l.name AS location_name
            FROM box_history bh
            LEFT JOIN users u ON u.id = bh.changed_by
            LEFT JOIN locations l ON l.id = bh.location_id
            WHERE bh.box_id = ?
            ORDER BY bh.changed_at DESC, bh.id DESC
        """,
                (box_id,),
            ).fetchall()
        )

    def revert(
        self,
        box_id: int,
        version_id: int,
        changed_by: int | None = None,
    ) -> dict[str, Any] | None:
        """Restore a box from a history record; return None if the record doesn't exist."""
        h = self._row(
            self.db.execute(
                "SELECT * FROM box_history WHERE id=? AND box_id=?", (version_id, box_id)
            ).fetchone()
        )
        if not h:
            return None
        return self.update(
            box_id,
            h["barcode"],
            name=h["name"],
            location_id=h["location_id"],
            notes=h["notes"],
            changed_by=changed_by,
        )

    def _record_history(self, box: dict[str, Any], changed_by: int | None) -> None:
        """Write a snapshot of the box's current field values to box_history."""
        self.db.execute(
            """
            INSERT INTO box_history (box_id, changed_by, barcode, name, location_id, notes)
            VALUES (?,?,?,?,?,?)
        """,
            (
                box["id"],
                changed_by,
                box["barcode"],
                box.get("name"),
                box.get("location_id"),
                box.get("notes"),
            ),
        )

    def empty(self, box_id: int) -> None:
        """Unassign all tubes from a box by setting their box_id to NULL."""
        self.db.execute("UPDATE tubes SET box_id=NULL WHERE box_id=?", (box_id,))

    def delete(self, box_id: int) -> bool:
        """Delete a box by its primary key; return True if a row was removed."""
        return self.db.execute("DELETE FROM boxes WHERE id=?", (box_id,)).rowcount > 0

    def search(self, query: str) -> list[dict[str, Any]]:
        """Return up to 10 boxes matching the query against barcode, name, or location."""
        q = f"%{query}%"
        return self._rows(
            self.db.execute(
                """
            SELECT b.*, l.name AS location_name, 'box' AS type
            FROM boxes b LEFT JOIN locations l ON l.id = b.location_id
            WHERE b.barcode LIKE ? OR b.name LIKE ? OR l.name LIKE ?
            LIMIT 10
        """,
                (q, q, q),
            ).fetchall()
        )

    def export_flat(
        self, box_id: int | None = None, ids: list[int] | None = None
    ) -> list[dict[str, Any]]:
        """Return flat export rows for boxes, optionally filtered by box_id or id list."""
        where: str
        params: tuple
        if box_id is not None:
            where, params = "WHERE b.id = ?", (box_id,)
        elif ids is not None:
            if not ids:
                return []
            where, params = f"WHERE b.id IN ({','.join('?' * len(ids))})", tuple(ids)
        else:
            where, params = "", ()
        return self._rows(
            self.db.execute(
                f"""
            SELECT b.id, b.barcode, b.name, l.name AS location, b.notes,
                   COUNT(t.id) AS tube_count, b.created_at
            FROM boxes b
            LEFT JOIN locations l ON l.id = b.location_id
            LEFT JOIN tubes t ON t.box_id = b.id
            {where}
            GROUP BY b.id ORDER BY b.created_at DESC
        """,
                params,
            ).fetchall()
        )

    def export_flat_for_cores(self, core_ids: list[int]) -> list[dict[str, Any]]:
        """Return flat box rows for boxes that contain tubes from the given core IDs."""
        if not core_ids:  # pragma: no cover
            return []
        placeholders = ",".join("?" * len(core_ids))
        return self._rows(
            self.db.execute(
                f"""
            SELECT b.id, b.barcode, b.name, l.name AS location, b.notes,
                   (SELECT COUNT(*) FROM tubes WHERE box_id = b.id) AS tube_count,
                   b.created_at
            FROM boxes b
            LEFT JOIN locations l ON l.id = b.location_id
            WHERE b.id IN (
                SELECT DISTINCT box_id FROM tubes
                WHERE core_id IN ({placeholders}) AND box_id IS NOT NULL
            )
            ORDER BY b.created_at DESC
        """,
                tuple(core_ids),
            ).fetchall()
        )

    def export_tubes_for_boxes(self, box_ids: list[int]) -> list[dict[str, Any]]:
        """Return all tubes belonging to the given box IDs, ordered by depth then creation date."""
        if not box_ids:  # pragma: no cover
            return []
        placeholders = ",".join("?" * len(box_ids))
        return self._rows(
            self.db.execute(
                f"""
            SELECT box_id, barcode, sample_date, site_name, latitude, longitude,
                   sample_type, description, volume_ml, weight_g, depth_cm,
                   created_at, updated_at
            FROM tubes WHERE box_id IN ({placeholders})
            ORDER BY depth_cm ASC, created_at ASC
        """,
                tuple(box_ids),
            ).fetchall()
        )

    def build_with_tubes_rows(
        self, box_id: int | None = None, ids: list[int] | None = None
    ) -> list[dict[str, Any]]:
        """Return hierarchical export rows (one box header row + one row per tube) for CSV/TSV."""
        boxes = self.export_flat(box_id=box_id, ids=ids)
        if not boxes:
            return []
        tubes = self.export_tubes_for_boxes([b["id"] for b in boxes])
        tubes_by_box: dict[int, list] = defaultdict(list)
        for t in tubes:
            tubes_by_box[t["box_id"]].append(t)
        _null: dict[str, Any] = {f: None for f in self.WITH_TUBES_FIELDS}
        result = []
        for box in boxes:
            row = dict(_null)
            row.update(
                row_type="box",
                box_barcode=box["barcode"],
                box_name=box["name"],
                box_location=box["location"],
                box_notes=box["notes"],
                box_tube_count=box["tube_count"],
                box_created_at=box["created_at"],
            )
            result.append(row)
            for t in tubes_by_box[box["id"]]:
                row = dict(_null)
                row.update(
                    row_type="tube",
                    box_barcode=box["barcode"],
                    tube_barcode=t["barcode"],
                    tube_sample_date=t["sample_date"],
                    tube_site_name=t["site_name"],
                    tube_latitude=t["latitude"],
                    tube_longitude=t["longitude"],
                    tube_sample_type=t["sample_type"],
                    tube_description=t["description"],
                    tube_volume_ml=t["volume_ml"],
                    tube_weight_g=t["weight_g"],
                    tube_depth_cm=t["depth_cm"],
                    tube_created_at=t["created_at"],
                    tube_updated_at=t["updated_at"],
                )
                result.append(row)
        return result

    def build_json(
        self, box_id: int | None = None, ids: list[int] | None = None
    ) -> list[dict[str, Any]]:
        """Return nested JSON export structure: each box with its tubes list."""
        boxes = self.export_flat(box_id=box_id, ids=ids)
        if not boxes:
            return []
        tubes = self.export_tubes_for_boxes([b["id"] for b in boxes])
        tubes_by_box: dict[int, list] = defaultdict(list)
        for t in tubes:
            tubes_by_box[t["box_id"]].append({k: v for k, v in t.items() if k != "box_id"})
        return [
            {
                "barcode": b["barcode"],
                "name": b["name"],
                "location": b["location"],
                "notes": b["notes"],
                "tube_count": b["tube_count"],
                "created_at": b["created_at"],
                "tubes": tubes_by_box[b["id"]],
            }
            for b in boxes
        ]

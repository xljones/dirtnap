import io
import json
import os
import urllib.error
from unittest.mock import MagicMock, patch

from flask.testing import FlaskClient


def test_pythonanywhere_stats_requires_auth(client: FlaskClient) -> None:
    assert client.get("/api/admin/pythonanywhere").status_code == 401


def test_pythonanywhere_stats_requires_admin(auth_client: FlaskClient) -> None:
    assert auth_client.get("/api/admin/pythonanywhere").status_code == 403


def test_pythonanywhere_stats_not_configured(admin_client: FlaskClient, monkeypatch) -> None:
    monkeypatch.delenv("PA_API_TOKEN", raising=False)
    monkeypatch.delenv("PA_USERNAME", raising=False)
    r = admin_client.get("/api/admin/pythonanywhere")
    assert r.status_code == 200
    assert r.json["configured"] is False


def _mock_urlopen(responses: list[dict]):
    responses_iter = iter(responses)

    def urlopen(req, timeout=None):
        data = json.dumps(next(responses_iter)).encode()
        cm = MagicMock()
        cm.__enter__ = lambda s: MagicMock(read=lambda: data)
        cm.__exit__ = MagicMock(return_value=False)
        return cm

    return urlopen


def test_pythonanywhere_stats_success(admin_client: FlaskClient, monkeypatch) -> None:
    monkeypatch.setenv("PA_API_TOKEN", "tok")
    monkeypatch.setenv("PA_USERNAME", "user")

    cpu = {"daily_cpu_limit_seconds": 100, "daily_cpu_total_usage_seconds": 42.0, "next_reset_time": "2026-06-02T00:00:00"}
    webapps = [{"id": 1, "domain_name": "user.pythonanywhere.com", "enabled": True, "python_version": "3.12"}]
    schedule = [{"id": 1, "enabled": True, "interval": "daily", "hour": 2, "minute": 0, "command": "python foo.py", "description": "Nightly job"}]

    with patch("dirtnap.routes.admin.urllib.request.urlopen", side_effect=_mock_urlopen([cpu, webapps, schedule])):
        r = admin_client.get("/api/admin/pythonanywhere")

    assert r.status_code == 200
    assert r.json["configured"] is True
    assert r.json["cpu"]["daily_cpu_limit_seconds"] == 100
    assert r.json["webapps"][0]["domain_name"] == "user.pythonanywhere.com"
    assert r.json["schedule"][0]["command"] == "python foo.py"


def test_pythonanywhere_stats_http_error(admin_client: FlaskClient, monkeypatch) -> None:
    monkeypatch.setenv("PA_API_TOKEN", "tok")
    monkeypatch.setenv("PA_USERNAME", "user")

    exc = urllib.error.HTTPError(url="", code=401, msg="Unauthorized", hdrs=None, fp=None)
    with patch("dirtnap.routes.admin.urllib.request.urlopen", side_effect=exc):
        r = admin_client.get("/api/admin/pythonanywhere")

    assert r.status_code == 502
    assert r.json["configured"] is True
    assert "401" in r.json["error"]


def test_pythonanywhere_stats_connection_error(admin_client: FlaskClient, monkeypatch) -> None:
    monkeypatch.setenv("PA_API_TOKEN", "tok")
    monkeypatch.setenv("PA_USERNAME", "user")

    with patch("dirtnap.routes.admin.urllib.request.urlopen", side_effect=OSError("timeout")):
        r = admin_client.get("/api/admin/pythonanywhere")

    assert r.status_code == 502
    assert r.json["configured"] is True
    assert "timeout" in r.json["error"]


# ── Backups ──────────────────────────────────────────────────────────────────


def test_backups_require_auth(client: FlaskClient) -> None:
    assert client.get("/api/admin/backups").status_code == 401
    assert client.post("/api/admin/backups").status_code == 401
    assert client.get("/api/admin/backups/db-backup-x.sql").status_code == 401


def test_backups_require_admin(auth_client: FlaskClient) -> None:
    assert auth_client.get("/api/admin/backups").status_code == 403
    assert auth_client.post("/api/admin/backups").status_code == 403
    assert auth_client.get("/api/admin/backups/db-backup-x.sql").status_code == 403


def test_backups_list_empty(admin_client: FlaskClient) -> None:
    r = admin_client.get("/api/admin/backups")
    assert r.status_code == 200
    assert r.json == []


def test_backups_create_and_download(admin_client: FlaskClient) -> None:
    r = admin_client.post("/api/admin/backups")
    assert r.status_code == 201
    name = r.json["name"]
    assert name.startswith("db-backup-") and name.endswith(".sql")
    assert r.json["size_bytes"] > 0
    assert r.json["created_at"].endswith("Z")

    listed = admin_client.get("/api/admin/backups").json
    assert [b["name"] for b in listed] == [name]

    r = admin_client.get(f"/api/admin/backups/{name}")
    assert r.status_code == 200
    assert r.headers["Content-Disposition"] == f"attachment; filename={name}"
    body = r.data.decode()
    assert "CREATE TABLE users" in body
    assert "adminuser" in body


def test_backups_list_only_sql_files_newest_first(admin_client: FlaskClient) -> None:
    from dirtnap.backups import backup_dir

    d = backup_dir()
    (d / "old.sql").write_text("-- old")
    os.utime(d / "old.sql", (1_000_000_000, 1_000_000_000))
    (d / "new.sql").write_text("-- new")
    (d / "notes.txt").write_text("not a backup")
    (d / "partial.sql.tmp").write_text("in progress")
    (d / "dir.sql").mkdir()

    names = [b["name"] for b in admin_client.get("/api/admin/backups").json]
    assert names == ["new.sql", "old.sql"]


def test_backups_download_rejects_unknown_files(admin_client: FlaskClient) -> None:
    from dirtnap.backups import backup_dir

    (backup_dir() / "notes.txt").write_text("not a backup")
    assert admin_client.get("/api/admin/backups/missing.sql").status_code == 404
    assert admin_client.get("/api/admin/backups/notes.txt").status_code == 404
    assert admin_client.get("/api/admin/backups/samples.db").status_code == 404
    assert admin_client.get("/api/admin/backups/..%2Fsamples.db").status_code == 404

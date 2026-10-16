import json
import os
import urllib.error
import urllib.request
from dataclasses import asdict

from flask import Blueprint, abort, jsonify, send_file
from flask.typing import ResponseReturnValue
from flask_login import current_user, login_required

from dirtnap.backups import create_backup, get_backup_path, list_backups

bp = Blueprint("admin", __name__)

_PA_BASE = "https://www.pythonanywhere.com"


def _pa_get(username: str, token: str, path: str) -> dict | list:
    url = f"{_PA_BASE}/api/v0/user/{username}{path}"
    req = urllib.request.Request(url, headers={"Authorization": f"Token {token}"})
    with urllib.request.urlopen(req, timeout=8) as resp:
        return json.loads(resp.read().decode())


@bp.get("/api/admin/pythonanywhere")
@login_required
def pythonanywhere_stats() -> ResponseReturnValue:
    if not current_user.is_admin:
        return jsonify(error="Admin access required"), 403

    token = os.environ.get("PA_API_TOKEN", "").strip()
    username = os.environ.get("PA_USERNAME", "").strip()
    if not token or not username:
        return jsonify(configured=False), 200

    try:
        cpu = _pa_get(username, token, "/cpu/")
        webapps = _pa_get(username, token, "/webapps/")
        schedule = _pa_get(username, token, "/schedule/")
    except urllib.error.HTTPError as e:
        return jsonify(configured=True, error=f"PythonAnywhere API error: {e.code} {e.reason}"), 502
    except Exception as e:
        return jsonify(configured=True, error=f"Could not reach PythonAnywhere API: {e}"), 502

    return jsonify(
        configured=True,
        cpu=cpu,
        webapps=webapps,
        schedule=schedule,
    ), 200


@bp.get("/api/admin/backups")
@login_required
def backups_list() -> ResponseReturnValue:
    if not current_user.is_admin:
        return jsonify(error="Admin access required"), 403
    return jsonify([asdict(b) for b in list_backups()]), 200


@bp.post("/api/admin/backups")
@login_required
def backups_create() -> ResponseReturnValue:
    if not current_user.is_admin:
        return jsonify(error="Admin access required"), 403
    return jsonify(asdict(create_backup())), 201


@bp.get("/api/admin/backups/<name>")
@login_required
def backups_download(name: str) -> ResponseReturnValue:
    if not current_user.is_admin:
        return jsonify(error="Admin access required"), 403
    path = get_backup_path(name)
    if path is None:
        abort(404)
    return send_file(path, mimetype="application/sql", as_attachment=True, download_name=name)

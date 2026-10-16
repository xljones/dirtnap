import os
import shutil
import tempfile
from collections.abc import Generator

import pytest
from flask import Flask
from flask.testing import FlaskClient


@pytest.fixture
def app() -> Generator[Flask, None, None]:
    # Own directory per test so backups written next to the db don't leak between tests.
    db_dir = tempfile.mkdtemp()
    os.environ["DB_PATH"] = os.path.join(db_dir, "samples.db")

    # Import after setting DB_PATH so the app picks up the temp database.
    from dirtnap import create_app

    application = create_app()
    application.config["TESTING"] = True
    application.config["WTF_CSRF_ENABLED"] = False

    yield application

    shutil.rmtree(db_dir)


@pytest.fixture
def client(app: Flask) -> FlaskClient:
    return app.test_client()


@pytest.fixture
def auth_client(client: FlaskClient) -> FlaskClient:
    from dirtnap.db import get_db
    from dirtnap.repositories.user_repository import UserRepository

    with get_db() as db:
        UserRepository(db).create("testuser", "testpass")

    client.post("/api/auth/login", json={"username": "testuser", "password": "testpass"})
    return client


@pytest.fixture
def readonly_client(client: FlaskClient) -> FlaskClient:
    from dirtnap.db import get_db
    from dirtnap.repositories.user_repository import UserRepository

    with get_db() as db:
        UserRepository(db).create("readonlyuser", "testpass", is_readonly=True)

    client.post("/api/auth/login", json={"username": "readonlyuser", "password": "testpass"})
    return client


@pytest.fixture
def admin_client(client: FlaskClient) -> FlaskClient:
    from dirtnap.db import get_db
    from dirtnap.repositories.user_repository import UserRepository

    with get_db() as db:
        UserRepository(db).create("adminuser", "testpass", is_admin=True)

    client.post("/api/auth/login", json={"username": "adminuser", "password": "testpass"})
    return client

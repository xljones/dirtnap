from flask.testing import FlaskClient


def test_list_boxes_requires_auth(client: FlaskClient) -> None:
    assert client.get("/api/boxes").status_code == 401


def test_create_box(auth_client: FlaskClient) -> None:
    r = auth_client.post("/api/boxes", json={"barcode": "BOX001", "name": "Shelf A"})
    assert r.status_code == 201
    assert r.json["barcode"] == "BOX001"
    assert r.json["name"] == "Shelf A"


def test_create_box_missing_barcode(auth_client: FlaskClient) -> None:
    assert auth_client.post("/api/boxes", json={"name": "No barcode"}).status_code == 400


def test_create_box_duplicate_barcode(auth_client: FlaskClient) -> None:
    auth_client.post("/api/boxes", json={"barcode": "BOX001"})
    assert auth_client.post("/api/boxes", json={"barcode": "BOX001"}).status_code == 409


def test_create_box_with_location(auth_client: FlaskClient) -> None:
    loc = auth_client.post("/api/locations", json={"name": "Freezer 1"}).json
    r = auth_client.post("/api/boxes", json={"barcode": "BOX001", "location_id": loc["id"]})
    assert r.status_code == 201
    assert r.json["location_name"] == "Freezer 1"


def test_list_boxes(auth_client: FlaskClient) -> None:
    auth_client.post("/api/boxes", json={"barcode": "BOX001"})
    auth_client.post("/api/boxes", json={"barcode": "BOX002"})
    r = auth_client.get("/api/boxes")
    assert r.status_code == 200
    assert len(r.json) == 2


def test_get_box(auth_client: FlaskClient) -> None:
    box = auth_client.post("/api/boxes", json={"barcode": "BOX001", "name": "Top shelf"}).json
    r = auth_client.get(f"/api/boxes/{box['id']}")
    assert r.status_code == 200
    assert r.json["barcode"] == "BOX001"
    assert r.json["name"] == "Top shelf"
    assert isinstance(r.json["tubes"], list)


def test_get_box_not_found(auth_client: FlaskClient) -> None:
    assert auth_client.get("/api/boxes/9999").status_code == 404


def test_update_box(auth_client: FlaskClient) -> None:
    box = auth_client.post("/api/boxes", json={"barcode": "BOX001"}).json
    r = auth_client.put(f"/api/boxes/{box['id']}", json={"barcode": "BOX001", "name": "Updated"})
    assert r.status_code == 200
    assert r.json["name"] == "Updated"


def test_update_box_missing_barcode(auth_client: FlaskClient) -> None:
    box = auth_client.post("/api/boxes", json={"barcode": "BOX001"}).json
    assert auth_client.put(f"/api/boxes/{box['id']}", json={"name": "No barcode"}).status_code == 400


def test_update_box_not_found(auth_client: FlaskClient) -> None:
    assert auth_client.put("/api/boxes/9999", json={"barcode": "BOX001"}).status_code == 404


def test_update_box_duplicate_barcode(auth_client: FlaskClient) -> None:
    auth_client.post("/api/boxes", json={"barcode": "BOX001"})
    box2 = auth_client.post("/api/boxes", json={"barcode": "BOX002"}).json
    assert auth_client.put(f"/api/boxes/{box2['id']}", json={"barcode": "BOX001"}).status_code == 409


def test_empty_box(auth_client: FlaskClient) -> None:
    box = auth_client.post("/api/boxes", json={"barcode": "BOX001"}).json
    auth_client.post("/api/tubes", json={"barcode": "TUBE001", "box_id": box["id"]})
    r = auth_client.post(f"/api/boxes/{box['id']}/empty")
    assert r.status_code == 204
    box_data = auth_client.get(f"/api/boxes/{box['id']}").json
    assert box_data["tubes"] == []


def test_empty_box_not_found(auth_client: FlaskClient) -> None:
    assert auth_client.post("/api/boxes/9999/empty").status_code == 404


def test_delete_box(auth_client: FlaskClient) -> None:
    box = auth_client.post("/api/boxes", json={"barcode": "BOX001"}).json
    assert auth_client.delete(f"/api/boxes/{box['id']}").status_code == 204
    assert auth_client.get(f"/api/boxes/{box['id']}").status_code == 404


def test_delete_box_not_found(auth_client: FlaskClient) -> None:
    assert auth_client.delete("/api/boxes/9999").status_code == 404


def test_box_history(auth_client: FlaskClient) -> None:
    box = auth_client.post("/api/boxes", json={"barcode": "BOX001"}).json
    r = auth_client.get(f"/api/boxes/{box['id']}/history")
    assert r.status_code == 200
    assert isinstance(r.json, list)
    assert len(r.json) >= 1


def test_revert_box(auth_client: FlaskClient) -> None:
    box = auth_client.post("/api/boxes", json={"barcode": "BOX001", "name": "Original"}).json
    auth_client.put(f"/api/boxes/{box['id']}", json={"barcode": "BOX001", "name": "Changed"})
    history = auth_client.get(f"/api/boxes/{box['id']}/history").json
    first_version = history[-1]
    r = auth_client.post(f"/api/boxes/{box['id']}/revert/{first_version['id']}")
    assert r.status_code == 200
    assert r.json["name"] == "Original"


def test_revert_box_not_found(auth_client: FlaskClient) -> None:
    box = auth_client.post("/api/boxes", json={"barcode": "BOX001"}).json
    assert auth_client.post(f"/api/boxes/{box['id']}/revert/9999").status_code == 404


def test_box_tube_count_updates(auth_client: FlaskClient) -> None:
    box = auth_client.post("/api/boxes", json={"barcode": "BOX001"}).json
    auth_client.post("/api/tubes", json={"barcode": "TUBE001", "box_id": box["id"]})
    auth_client.post("/api/tubes", json={"barcode": "TUBE002", "box_id": box["id"]})
    r = auth_client.get(f"/api/boxes/{box['id']}")
    assert len(r.json["tubes"]) == 2


def test_get_box_tubes_include_core_values(auth_client: FlaskClient) -> None:
    box = auth_client.post("/api/boxes", json={"barcode": "BOX001"}).json
    core = auth_client.post(
        "/api/cores",
        json={"barcode": "CORE001", "name": "Core A", "site_name": "North Sea", "sample_type": "Piston"},
    ).json
    auth_client.post("/api/tubes", json={"barcode": "TUBE001", "box_id": box["id"], "core_id": core["id"]})
    tube = auth_client.get(f"/api/boxes/{box['id']}").json["tubes"][0]
    assert tube["site_name"] is None
    assert tube["core_barcode"] == "CORE001"
    assert tube["core_name"] == "Core A"
    assert tube["core_site_name"] == "North Sea"
    assert tube["core_sample_type"] == "Piston"

URL = "/api/v1/engines"


def engine_body(client_id: str, **overrides) -> dict:
    return {
        "serial_number": "KOM-0001",
        "manufacturer": "Komatsu",
        "model": "SAA16V159",
        "engine_type": "Diesel",
        "power": "3500 HP",
        "client_id": client_id,
        **overrides,
    }


def test_create_engine(http, operator_headers, create_client):
    client = create_client(name="Owner Co")
    response = http.post(URL, json=engine_body(client["id"]), headers=operator_headers)
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["serial_number"] == "KOM-0001"
    assert data["client"]["name"] == "Owner Co"
    assert data["registered_at"]
    assert data["is_active"] is True


def test_duplicate_serial_number_returns_409(http, operator_headers, create_client):
    client = create_client()
    assert http.post(URL, json=engine_body(client["id"]), headers=operator_headers).status_code == 201

    # Serial numbers are normalized to upper case, so this is a duplicate.
    duplicate = engine_body(client["id"], serial_number="kom-0001")
    response = http.post(URL, json=duplicate, headers=operator_headers)
    assert response.status_code == 409


def test_unknown_client_returns_404(http, operator_headers):
    response = http.post(
        URL, json=engine_body("00000000-0000-0000-0000-000000000000"), headers=operator_headers
    )
    assert response.status_code == 404


def test_inactive_client_cannot_receive_engines(http, operator_headers, admin_headers, create_client):
    client = create_client()
    http.delete(f"/api/v1/clients/{client['id']}", headers=admin_headers)

    response = http.post(URL, json=engine_body(client["id"]), headers=operator_headers)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "BUSINESS_RULE_VIOLATION"


def test_filter_engines_by_client(http, operator_headers, create_client, create_engine):
    owner = create_client()
    mine = create_engine(client_id=owner["id"])
    create_engine()

    response = http.get(URL, params={"client_id": owner["id"]}, headers=operator_headers)
    assert [e["id"] for e in response.json()["data"]] == [mine["id"]]


def test_update_and_deactivate_engine(http, operator_headers, admin_headers, create_engine):
    engine = create_engine()

    updated = http.patch(f"{URL}/{engine['id']}", json={"power": "3000 kW"}, headers=operator_headers)
    assert updated.status_code == 200
    assert updated.json()["data"]["power"] == "3000 kW"

    deactivated = http.delete(f"{URL}/{engine['id']}", headers=admin_headers)
    assert deactivated.json()["data"]["is_active"] is False

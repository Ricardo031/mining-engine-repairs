URL = "/api/v1/clients"


def test_create_client(http, operator_headers):
    response = http.post(
        URL,
        json={
            "name": "  Minera Andina  ",
            "identification_type": "NIT",
            "identification_number": "900123456-7",
            "email": "info@andina.co",
        },
        headers=operator_headers,
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["name"] == "Minera Andina"
    assert data["is_active"] is True
    assert data["id"]


def test_duplicate_identification_number_returns_409(http, operator_headers, create_client):
    create_client(identification_number="800555111")
    response = http.post(
        URL,
        json={
            "name": "Copy",
            "identification_type": "CC",
            "identification_number": "800555111",
            "email": "copy@x.co",
        },
        headers=operator_headers,
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"


def test_identification_number_is_case_insensitive(http, operator_headers, create_client):
    create_client(identification_type="PASSPORT", identification_number="ab12345")
    response = http.post(
        URL,
        json={
            "name": "Copy",
            "identification_type": "PASSPORT",
            "identification_number": "AB12345",
            "email": "copy@x.co",
        },
        headers=operator_headers,
    )
    assert response.status_code == 409


def test_invalid_payload_returns_400_with_details(http, operator_headers):
    response = http.post(
        URL,
        json={"name": "X", "identification_type": "RUT", "email": "nope", "extra": 1},
        headers=operator_headers,
    )
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    paths = {detail["path"] for detail in error["details"]}
    assert {"body.name", "body.identification_type", "body.email", "body.extra"} <= paths


def test_list_search_and_pagination(http, operator_headers, create_client):
    create_client(name="Alpha Mining")
    create_client(name="Beta Coal")
    create_client(name="Gamma Mining")

    response = http.get(URL, params={"search": "mining", "limit": 1}, headers=operator_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["meta"] == {"page": 1, "limit": 1, "total": 2, "total_pages": 2}
    assert body["data"][0]["name"] == "Alpha Mining"


def test_get_unknown_client_returns_404(http, operator_headers):
    response = http.get(f"{URL}/00000000-0000-0000-0000-000000000000", headers=operator_headers)
    assert response.status_code == 404


def test_update_client(http, operator_headers, create_client):
    client = create_client()
    response = http.patch(f"{URL}/{client['id']}", json={"email": "new@mail.co"}, headers=operator_headers)
    assert response.status_code == 200
    assert response.json()["data"]["email"] == "new@mail.co"


def test_update_requires_at_least_one_field(http, operator_headers, create_client):
    client = create_client()
    response = http.patch(f"{URL}/{client['id']}", json={}, headers=operator_headers)
    assert response.status_code == 400


def test_only_admin_can_deactivate(http, operator_headers, admin_headers, create_client):
    client = create_client()

    forbidden = http.delete(f"{URL}/{client['id']}", headers=operator_headers)
    assert forbidden.status_code == 403

    response = http.delete(f"{URL}/{client['id']}", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["data"]["is_active"] is False

    inactive = http.get(URL, params={"is_active": "false"}, headers=operator_headers)
    assert [c["id"] for c in inactive.json()["data"]] == [client["id"]]

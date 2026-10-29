import re

URL = "/api/v1/orders"

LIFECYCLE = [
    "IN_DIAGNOSIS",
    "AWAITING_APPROVAL",
    "IN_REPAIR",
    "IN_TESTING",
    "COMPLETED",
    "DELIVERED",
]


def change_status(http, headers, order_id: str, status: str, **extra):
    return http.patch(f"{URL}/{order_id}/status", json={"status": status, **extra}, headers=headers)


def test_create_order(http, operator_headers, create_engine):
    engine = create_engine()
    response = http.post(
        URL,
        json={
            "engine_id": engine["id"],
            "received_at": "2026-10-01",
            "reported_problem": "Overheating",
            "technician": "Ana Gómez",
            "estimated_delivery_date": "2026-10-15",
            "observations": "Customer needs it urgently",
        },
        headers=operator_headers,
    )
    assert response.status_code == 201
    order = response.json()["data"]

    assert re.fullmatch(r"OR-\d{4}-\d{6}", order["order_number"])
    assert order["status"] == "RECEIVED"
    # The owner is taken from the engine, not from the request.
    assert order["client"]["id"] == engine["client"]["id"]
    assert order["created_by_email"] == "operator@mining-repairs.local"
    assert order["actual_delivery_date"] is None
    assert order["allowed_next_statuses"] == ["IN_DIAGNOSIS"]
    assert [h["to_status"] for h in order["status_history"]] == ["RECEIVED"]


def test_order_numbers_are_unique_and_sequential(create_order):
    first = create_order()["order_number"]
    second = create_order()["order_number"]
    assert first != second
    assert int(second[-6:]) == int(first[-6:]) + 1


def test_estimated_date_before_reception_is_rejected(http, operator_headers, create_engine):
    response = http.post(
        URL,
        json={
            "engine_id": create_engine()["id"],
            "received_at": "2026-10-10",
            "reported_problem": "Noise",
            "technician": "Ana Gómez",
            "estimated_delivery_date": "2026-10-01",
        },
        headers=operator_headers,
    )
    assert response.status_code == 400


def test_engine_cannot_have_two_open_orders(http, operator_headers, create_engine, create_order):
    engine = create_engine()
    create_order(engine_id=engine["id"])

    response = http.post(
        URL,
        json={
            "engine_id": engine["id"],
            "reported_problem": "Again",
            "technician": "Ana Gómez",
            "estimated_delivery_date": "2099-01-01",
        },
        headers=operator_headers,
    )
    assert response.status_code == 422
    assert "open repair order" in response.json()["error"]["message"]


def test_inactive_engine_cannot_get_orders(http, operator_headers, admin_headers, create_engine):
    engine = create_engine()
    http.delete(f"/api/v1/engines/{engine['id']}", headers=admin_headers)

    response = http.post(
        URL,
        json={
            "engine_id": engine["id"],
            "reported_problem": "x",
            "technician": "Ana Gómez",
            "estimated_delivery_date": "2099-01-01",
        },
        headers=operator_headers,
    )
    assert response.status_code == 422


def test_full_lifecycle_until_delivered(http, operator_headers, create_order):
    order = create_order()

    for status in LIFECYCLE[:-1]:
        response = change_status(http, operator_headers, order["id"], status, note=f"to {status}")
        assert response.status_code == 200, response.text
        assert response.json()["data"]["status"] == status

    delivered = change_status(
        http, operator_headers, order["id"], "DELIVERED", actual_delivery_date="2026-10-18"
    )
    assert delivered.status_code == 200
    data = delivered.json()["data"]
    assert data["actual_delivery_date"] == "2026-10-18"
    assert data["allowed_next_statuses"] == []

    history = data["status_history"]
    assert [h["to_status"] for h in history] == ["RECEIVED", *LIFECYCLE]
    assert history[1]["from_status"] == "RECEIVED"
    assert history[1]["note"] == "to IN_DIAGNOSIS"


def test_skipping_steps_is_rejected(http, operator_headers, create_order):
    order = create_order()
    response = change_status(http, operator_headers, order["id"], "COMPLETED")
    assert response.status_code == 422
    assert "Allowed: IN_DIAGNOSIS" in response.json()["error"]["message"]


def test_failed_test_returns_to_repair(http, operator_headers, create_order):
    order = create_order()
    for status in ["IN_DIAGNOSIS", "AWAITING_APPROVAL", "IN_REPAIR", "IN_TESTING", "IN_REPAIR"]:
        assert change_status(http, operator_headers, order["id"], status).status_code == 200


def test_delivery_date_only_allowed_when_delivering(http, operator_headers, create_order):
    order = create_order()
    response = change_status(
        http, operator_headers, order["id"], "IN_DIAGNOSIS", actual_delivery_date="2026-10-05"
    )
    assert response.status_code == 422


def test_delivered_engine_can_get_a_new_order(http, operator_headers, create_engine, create_order):
    engine = create_engine()
    order = create_order(engine_id=engine["id"])
    for status in LIFECYCLE:
        change_status(http, operator_headers, order["id"], status)

    assert create_order(engine_id=engine["id"])["status"] == "RECEIVED"


def test_list_filters(http, operator_headers, create_client, create_engine, create_order):
    owner = create_client(name="Filter Mining")
    engine = create_engine(client_id=owner["id"], serial_number="FLT-777")
    target = create_order(engine_id=engine["id"])
    other = create_order()
    change_status(http, operator_headers, other["id"], "IN_DIAGNOSIS")

    def ids(**params):
        response = http.get(URL, params=params, headers=operator_headers)
        assert response.status_code == 200
        return [o["id"] for o in response.json()["data"]]

    assert ids(status="RECEIVED") == [target["id"]]
    assert ids(status="IN_DIAGNOSIS") == [other["id"]]
    assert ids(client_id=owner["id"]) == [target["id"]]
    assert ids(engine_id=engine["id"]) == [target["id"]]
    assert ids(search="flt-777") == [target["id"]]
    assert ids(search="Filter Mining") == [target["id"]]
    assert ids(search=target["order_number"]) == [target["id"]]
    assert set(ids()) == {target["id"], other["id"]}


def test_invalid_status_filter_returns_400(http, operator_headers):
    assert http.get(URL, params={"status": "LOST"}, headers=operator_headers).status_code == 400


def test_get_order_by_id_and_number(http, operator_headers, create_order):
    order = create_order()

    by_id = http.get(f"{URL}/{order['id']}", headers=operator_headers)
    assert by_id.status_code == 200
    assert by_id.json()["data"]["reported_problem"] == order["reported_problem"]

    by_number = http.get(f"{URL}/by-number/{order['order_number']}", headers=operator_headers)
    assert by_number.json()["data"]["id"] == order["id"]

    missing = http.get(f"{URL}/by-number/OR-1999-000001", headers=operator_headers)
    assert missing.status_code == 404


def test_summary_counts_every_status(http, operator_headers, create_order):
    create_order()
    second = create_order()
    change_status(http, operator_headers, second["id"], "IN_DIAGNOSIS")

    response = http.get(f"{URL}/summary", headers=operator_headers)
    assert response.status_code == 200
    summary = response.json()["data"]
    counts = {row["status"]: row["count"] for row in summary["by_status"]}

    assert summary["total"] == 2
    assert counts["RECEIVED"] == 1
    assert counts["IN_DIAGNOSIS"] == 1
    assert counts["DELIVERED"] == 0
    assert len(counts) == 7


def test_status_change_records_progress_details(http, operator_headers, create_order):
    order = create_order(observations="Initial note")

    diagnosed = change_status(
        http,
        operator_headers,
        order["id"],
        "IN_DIAGNOSIS",
        diagnosis="Worn injectors in cylinders 3 and 7",
    )
    assert diagnosed.status_code == 200
    data = diagnosed.json()["data"]
    assert data["diagnosis"] == "Worn injectors in cylinders 3 and 7"
    assert data["observations"] == "Initial note"  # omitted fields keep their value

    approved = change_status(
        http,
        operator_headers,
        order["id"],
        "AWAITING_APPROVAL",
        work_performed="Replace 16 injectors",
        observations="Budget sent to client",
    )
    data = approved.json()["data"]
    assert data["diagnosis"] == "Worn injectors in cylinders 3 and 7"
    assert data["work_performed"] == "Replace 16 injectors"
    assert data["observations"] == "Budget sent to client"


def test_invalid_transition_does_not_save_details(http, operator_headers, create_order):
    order = create_order()
    response = change_status(http, operator_headers, order["id"], "DELIVERED", diagnosis="x")
    assert response.status_code == 422

    current = http.get(f"{URL}/{order['id']}", headers=operator_headers).json()["data"]
    assert current["diagnosis"] is None


def deliver(http, headers, order_id: str, delivered_on: str) -> None:
    for status in LIFECYCLE[:-1]:
        assert change_status(http, headers, order_id, status).status_code == 200
    response = change_status(http, headers, order_id, "DELIVERED", actual_delivery_date=delivered_on)
    assert response.status_code == 200


def test_summary_dashboard_metrics(http, operator_headers, create_order):
    # Reference day: 2026-10-15
    create_order(received_at="2026-10-10", estimated_delivery_date="2026-10-18")  # due soon
    create_order(received_at="2026-10-01", estimated_delivery_date="2026-10-05")  # overdue
    this_month = create_order(received_at="2026-10-03", estimated_delivery_date="2026-10-30")
    last_month = create_order(received_at="2026-09-02", estimated_delivery_date="2026-09-20")
    deliver(http, operator_headers, this_month["id"], "2026-10-12")
    deliver(http, operator_headers, last_month["id"], "2026-09-25")

    response = http.get(f"{URL}/summary", params={"today": "2026-10-15"}, headers=operator_headers)
    assert response.status_code == 200
    summary = response.json()["data"]

    assert summary["today"] == "2026-10-15"
    assert summary["total"] == 4
    assert summary["active"] == 2
    assert summary["overdue"] == 1
    assert summary["due_soon"] == 1
    assert summary["delivered_this_month"] == 1
    assert summary["delivered_last_month"] == 1
    assert summary["received_last_7_days"] == 1  # 2026-10-09 .. 2026-10-15
    assert summary["received_previous_7_days"] == 1  # 2026-10-02 .. 2026-10-08
    by_day = summary["received_by_day"]
    assert [d["date"] for d in by_day][0] == "2026-10-09"
    assert [d["date"] for d in by_day][-1] == "2026-10-15"
    assert {d["date"]: d["count"] for d in by_day}["2026-10-10"] == 1


def test_received_at_defaults_to_workshop_today(http, operator_headers, create_engine):
    """Without received_at the order uses today in the workshop time zone, not the UTC date."""
    from app.core.clock import business_today

    response = http.post(
        URL,
        json={
            "engine_id": create_engine()["id"],
            "reported_problem": "No arranca",
            "technician": "Ana Gómez",
            "estimated_delivery_date": "2099-01-01",
        },
        headers=operator_headers,
    )
    assert response.status_code == 201
    order = response.json()["data"]
    today = business_today()
    assert order["received_at"] == today.isoformat()
    assert order["order_number"].startswith(f"OR-{today.year}-")

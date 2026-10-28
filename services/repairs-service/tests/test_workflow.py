"""Unit tests of the status workflow (no database involved)."""

from app.core.workflow import ALLOWED_TRANSITIONS, can_transition
from app.models import OrderStatus


def test_every_status_has_rules():
    assert set(ALLOWED_TRANSITIONS) == set(OrderStatus)


def test_delivered_is_final():
    assert ALLOWED_TRANSITIONS[OrderStatus.DELIVERED] == ()


def test_every_status_is_reachable_from_received():
    reached = {OrderStatus.RECEIVED}
    pending = [OrderStatus.RECEIVED]
    while pending:
        for nxt in ALLOWED_TRANSITIONS[pending.pop()]:
            if nxt not in reached:
                reached.add(nxt)
                pending.append(nxt)
    assert reached == set(OrderStatus)


def test_cannot_skip_steps():
    assert not can_transition(OrderStatus.RECEIVED, OrderStatus.COMPLETED)
    assert not can_transition(OrderStatus.IN_REPAIR, OrderStatus.DELIVERED)
    assert can_transition(OrderStatus.IN_TESTING, OrderStatus.IN_REPAIR)

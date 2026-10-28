"""Repair order workflow: which status can follow which."""

from app.models.repair_order import OrderStatus

S = OrderStatus

# Some steps can go back (rejected budget returns to diagnosis, a failed test
# returns to repair). DELIVERED is final.
ALLOWED_TRANSITIONS: dict[OrderStatus, tuple[OrderStatus, ...]] = {
    S.RECEIVED: (S.IN_DIAGNOSIS,),
    S.IN_DIAGNOSIS: (S.AWAITING_APPROVAL,),
    S.AWAITING_APPROVAL: (S.IN_REPAIR, S.IN_DIAGNOSIS),
    S.IN_REPAIR: (S.IN_TESTING,),
    S.IN_TESTING: (S.COMPLETED, S.IN_REPAIR),
    S.COMPLETED: (S.DELIVERED,),
    S.DELIVERED: (),
}


def allowed_next_statuses(status: OrderStatus) -> list[OrderStatus]:
    return list(ALLOWED_TRANSITIONS[status])


def can_transition(current: OrderStatus, target: OrderStatus) -> bool:
    return target in ALLOWED_TRANSITIONS[current]

"""Initial schema: clients, engines, repair orders and status history.

Revision ID: 0001
Revises:
Create Date: 2026-10-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ORDER_STATUSES = (
    "RECEIVED",
    "IN_DIAGNOSIS",
    "AWAITING_APPROVAL",
    "IN_REPAIR",
    "IN_TESTING",
    "COMPLETED",
    "DELIVERED",
)

identification_type = postgresql.ENUM(
    "NIT", "CC", "CE", "PASSPORT", name="identification_type", create_type=False
)
order_status = postgresql.ENUM(*ORDER_STATUSES, name="order_status", create_type=False)


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    bind = op.get_bind()
    identification_type.create(bind, checkfirst=True)
    order_status.create(bind, checkfirst=True)
    op.execute("CREATE SEQUENCE repair_order_number_seq")

    op.create_table(
        "clients",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("identification_type", identification_type, nullable=False),
        sa.Column("identification_number", sa.String(30), nullable=False),
        sa.Column("email", sa.String(160), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        *timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_clients"),
        sa.UniqueConstraint("identification_number", name="uq_clients_identification_number"),
    )
    op.create_index("ix_clients_is_active", "clients", ["is_active"])

    op.create_table(
        "engines",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("serial_number", sa.String(60), nullable=False),
        sa.Column("manufacturer", sa.String(120), nullable=False),
        sa.Column("model", sa.String(120), nullable=False),
        sa.Column("engine_type", sa.String(120), nullable=False),
        sa.Column("power", sa.String(60), nullable=False),
        sa.Column("client_id", sa.UUID(), nullable=False),
        sa.Column("registered_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        *timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_engines"),
        sa.UniqueConstraint("serial_number", name="uq_engines_serial_number"),
        sa.ForeignKeyConstraint(
            ["client_id"], ["clients.id"], name="fk_engines_client_id_clients", ondelete="RESTRICT"
        ),
    )
    op.create_index("ix_engines_client_id", "engines", ["client_id"])
    op.create_index("ix_engines_is_active", "engines", ["is_active"])

    op.create_table(
        "repair_orders",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("order_number", sa.String(20), nullable=False),
        sa.Column("engine_id", sa.UUID(), nullable=False),
        sa.Column("client_id", sa.UUID(), nullable=False),
        sa.Column("received_at", sa.Date(), nullable=False),
        sa.Column("reported_problem", sa.Text(), nullable=False),
        sa.Column("diagnosis", sa.Text(), nullable=True),
        sa.Column("work_performed", sa.Text(), nullable=True),
        sa.Column("technician", sa.String(120), nullable=False),
        sa.Column("estimated_delivery_date", sa.Date(), nullable=False),
        sa.Column("actual_delivery_date", sa.Date(), nullable=True),
        sa.Column("status", order_status, nullable=False),
        sa.Column("observations", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(64), nullable=False),
        sa.Column("created_by_email", sa.String(160), nullable=False),
        *timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_repair_orders"),
        sa.UniqueConstraint("order_number", name="uq_repair_orders_order_number"),
        sa.ForeignKeyConstraint(
            ["engine_id"], ["engines.id"], name="fk_repair_orders_engine_id_engines", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["client_id"], ["clients.id"], name="fk_repair_orders_client_id_clients", ondelete="RESTRICT"
        ),
        sa.CheckConstraint(
            "estimated_delivery_date >= received_at", name="ck_repair_orders_estimated_after_received"
        ),
        sa.CheckConstraint(
            "actual_delivery_date IS NULL OR actual_delivery_date >= received_at",
            name="ck_repair_orders_delivered_after_received",
        ),
    )
    op.create_index("ix_repair_orders_engine_id", "repair_orders", ["engine_id"])
    op.create_index("ix_repair_orders_client_id", "repair_orders", ["client_id"])
    op.create_index("ix_repair_orders_status", "repair_orders", ["status"])

    op.create_table(
        "order_status_history",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("order_id", sa.UUID(), nullable=False),
        sa.Column("from_status", order_status, nullable=True),
        sa.Column("to_status", order_status, nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("changed_by", sa.String(64), nullable=False),
        sa.Column("changed_by_email", sa.String(160), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_order_status_history"),
        sa.ForeignKeyConstraint(
            ["order_id"],
            ["repair_orders.id"],
            name="fk_order_status_history_order_id_repair_orders",
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_order_status_history_order_id", "order_status_history", ["order_id"])


def downgrade() -> None:
    op.drop_table("order_status_history")
    op.drop_table("repair_orders")
    op.drop_table("engines")
    op.drop_table("clients")
    op.execute("DROP SEQUENCE IF EXISTS repair_order_number_seq")
    order_status.drop(op.get_bind(), checkfirst=True)
    identification_type.drop(op.get_bind(), checkfirst=True)

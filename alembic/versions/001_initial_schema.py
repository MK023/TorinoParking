"""Initial schema: parkings and parking_snapshots

Revision ID: 001
Revises:
Create Date: 2026-02-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geography

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "parkings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("total_spots", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("location", Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=True),
    )
    op.create_index("idx_parkings_location", "parkings", ["location"], postgresql_using="gist")

    op.create_table(
        "parking_snapshots",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("parking_id", sa.Integer(), sa.ForeignKey("parkings.id"), nullable=False),
        sa.Column("free_spots", sa.Integer(), nullable=True),
        sa.Column("total_spots", sa.Integer(), nullable=False),
        sa.Column("status", sa.Integer(), nullable=False),
        sa.Column("tendence", sa.Integer(), nullable=True),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "idx_snapshot_parking_time",
        "parking_snapshots",
        ["parking_id", sa.text("recorded_at DESC")],
    )
    op.create_index(
        "idx_snapshot_recorded_at",
        "parking_snapshots",
        [sa.text("recorded_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("idx_snapshot_recorded_at", table_name="parking_snapshots")
    op.drop_index("idx_snapshot_parking_time", table_name="parking_snapshots")
    op.drop_table("parking_snapshots")
    op.drop_index("idx_parkings_location", table_name="parkings")
    op.drop_table("parkings")

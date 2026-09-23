"""add_user_goals

Revision ID: 7d2b91f0e4a3
Revises: c5ec4553e462
Create Date: 2026-09-23 10:05:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7d2b91f0e4a3'
down_revision: str | None = 'c5ec4553e462'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # New table only — one row per user, created on first save of the goals.
    op.create_table(
        'user_goals',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('calories', sa.Float(), nullable=True),
        sa.Column('proteins_g', sa.Float(), nullable=True),
        sa.Column('carbs_g', sa.Float(), nullable=True),
        sa.Column('fats_g', sa.Float(), nullable=True),
        sa.Column('meals_per_day', sa.Integer(), server_default='3', nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id'),
    )


def downgrade() -> None:
    op.drop_table('user_goals')

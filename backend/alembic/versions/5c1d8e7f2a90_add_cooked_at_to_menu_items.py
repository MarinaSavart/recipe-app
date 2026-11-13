"""add_cooked_at_to_menu_items

Revision ID: 5c1d8e7f2a90
Revises: 9b3f6e2a7c14
Create Date: 2026-11-13 18:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5c1d8e7f2a90'
down_revision: str | None = '9b3f6e2a7c14'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Nullable column: existing menu items are simply "not cooked yet".
    op.add_column('menu_items', sa.Column('cooked_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('menu_items', 'cooked_at')

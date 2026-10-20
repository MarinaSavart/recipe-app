"""add_menu_sharing

Revision ID: 9b3f6e2a7c14
Revises: b7e4d19a3c52
Create Date: 2026-10-20 10:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b3f6e2a7c14'
down_revision: str | None = 'b7e4d19a3c52'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Nullable column + new table — no impact on existing menus (none is shared yet).
    op.add_column('menus', sa.Column('share_token', sa.String(length=64), nullable=True))
    op.create_unique_constraint('uq_menus_share_token', 'menus', ['share_token'])

    op.create_table(
        'menu_shares',
        sa.Column('menu_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        # Deleting the menu or the guest's account removes the share
        sa.ForeignKeyConstraint(['menu_id'], ['menus.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('menu_id', 'user_id'),
    )
    op.create_index(op.f('ix_menu_shares_user_id'), 'menu_shares', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_menu_shares_user_id'), table_name='menu_shares')
    op.drop_table('menu_shares')
    op.drop_constraint('uq_menus_share_token', 'menus', type_='unique')
    op.drop_column('menus', 'share_token')

"""add_menus_and_menu_items

Revision ID: c5ec4553e462
Revises: a5a483e66883
Create Date: 2026-09-23 10:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5ec4553e462'
down_revision: str | None = 'a5a483e66883'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # New tables only — no impact on existing data.
    op.create_table(
        'menus',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('meals_count', sa.Integer(), nullable=False),  # number of meals asked for
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_menus_id'), 'menus', ['id'], unique=False)
    op.create_index(op.f('ix_menus_user_id'), 'menus', ['user_id'], unique=False)

    op.create_table(
        'menu_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('menu_id', sa.Integer(), nullable=False),
        sa.Column('recipe_id', sa.Integer(), nullable=True),
        # Meals covered by the recipe (one portion per meal)
        sa.Column('portions', sa.Integer(), server_default='1', nullable=False),
        sa.Column('position', sa.Integer(), server_default='0', nullable=False),
        # Deleting a menu deletes its items
        sa.ForeignKeyConstraint(['menu_id'], ['menus.id'], ondelete='CASCADE'),
        # Deleting a recipe keeps the line (without recipe) instead of failing
        sa.ForeignKeyConstraint(['recipe_id'], ['recipes.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_menu_items_id'), 'menu_items', ['id'], unique=False)
    op.create_index(op.f('ix_menu_items_menu_id'), 'menu_items', ['menu_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_menu_items_menu_id'), table_name='menu_items')
    op.drop_index(op.f('ix_menu_items_id'), table_name='menu_items')
    op.drop_table('menu_items')
    op.drop_index(op.f('ix_menus_user_id'), table_name='menus')
    op.drop_index(op.f('ix_menus_id'), table_name='menus')
    op.drop_table('menus')

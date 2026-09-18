"""add_recipe_likes

Revision ID: 533e5a254cb3
Revises: ce7383b65a2b
Create Date: 2026-09-18 14:45:13.994169

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '533e5a254cb3'
down_revision: str | None = 'ce7383b65a2b'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'recipe_likes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('recipe_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['recipe_id'], ['recipes.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'recipe_id', name='uq_recipe_likes_user_id_recipe_id'),
    )
    op.create_index(op.f('ix_recipe_likes_id'), 'recipe_likes', ['id'], unique=False)
    op.create_index(op.f('ix_recipe_likes_recipe_id'), 'recipe_likes', ['recipe_id'], unique=False)
    op.create_index(op.f('ix_recipe_likes_user_id'), 'recipe_likes', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_recipe_likes_user_id'), table_name='recipe_likes')
    op.drop_index(op.f('ix_recipe_likes_recipe_id'), table_name='recipe_likes')
    op.drop_index(op.f('ix_recipe_likes_id'), table_name='recipe_likes')
    op.drop_table('recipe_likes')

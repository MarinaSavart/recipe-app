"""drop_tags

Tags are no longer used by the app: drop the table and its data.

Revision ID: b7e4d19a3c52
Revises: f3a8c21d6b90
Create Date: 2026-09-26 12:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7e4d19a3c52'
down_revision: str | None = 'f3a8c21d6b90'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index('ix_tags_id', table_name='tags', if_exists=True)
    op.drop_table('tags')


def downgrade() -> None:
    # Recreates the empty table: the dropped tags are not restored
    op.create_table(
        'tags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('recipe_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.ForeignKeyConstraint(['recipe_id'], ['recipes.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_tags_id', 'tags', ['id'], unique=False)

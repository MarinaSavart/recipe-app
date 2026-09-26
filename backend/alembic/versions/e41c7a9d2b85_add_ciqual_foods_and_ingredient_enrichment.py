"""add_ciqual_foods_and_ingredient_enrichment

Revision ID: e41c7a9d2b85
Revises: 7d2b91f0e4a3
Create Date: 2026-09-25 10:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e41c7a9d2b85'
down_revision: str | None = '7d2b91f0e4a3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Reference table, empty after the migration: filled by `python -m app.scripts.import_ciqual`
    op.create_table(
        'ciqual_foods',
        sa.Column('code', sa.Integer(), nullable=False),
        sa.Column('name_fr', sa.String(length=255), nullable=False),
        sa.Column('subgroup_code', sa.String(length=4), nullable=False),
        sa.Column('subgroup_name', sa.String(length=255), nullable=False),
        sa.Column('aisle', sa.String(length=20), nullable=False),
        sa.Column('calories', sa.Float(), nullable=True),
        sa.Column('proteins_g', sa.Float(), nullable=True),
        sa.Column('carbs_g', sa.Float(), nullable=True),
        sa.Column('fats_g', sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint('code'),
    )

    # New nullable columns: existing ingredients stay as they are (null until enriched
    # by `python -m app.scripts.enrich_ingredients`)
    op.add_column('ingredients', sa.Column('canonical_name', sa.String(length=255), nullable=True))
    op.add_column('ingredients', sa.Column('aisle', sa.String(length=20), nullable=True))
    op.add_column('ingredients', sa.Column('weight_g', sa.Float(), nullable=True))
    op.add_column('ingredients', sa.Column('ciqual_code', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'ingredients_ciqual_code_fkey', 'ingredients', 'ciqual_foods',
        ['ciqual_code'], ['code'], ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('ingredients_ciqual_code_fkey', 'ingredients', type_='foreignkey')
    op.drop_column('ingredients', 'ciqual_code')
    op.drop_column('ingredients', 'weight_g')
    op.drop_column('ingredients', 'aisle')
    op.drop_column('ingredients', 'canonical_name')
    op.drop_table('ciqual_foods')

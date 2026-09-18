"""add_user_id_to_recipes

Revision ID: ce7383b65a2b
Revises: 0e6179441f7f
Create Date: 2026-09-18 13:41:45.942882

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ce7383b65a2b'
down_revision: str | None = '0e6179441f7f'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Ajoutée nullable dans un premier temps : les recettes existantes n'ont pas
    # encore de propriétaire, donc un NOT NULL direct casserait la migration.
    op.add_column('recipes', sa.Column('user_id', sa.Integer(), nullable=True))

    # Backfill : les recettes déjà en base sont rattachées au premier compte
    # utilisateur créé. À ajuster manuellement si ce n'est pas le bon propriétaire.
    op.execute(
        "UPDATE recipes SET user_id = (SELECT MIN(id) FROM users) WHERE user_id IS NULL"
    )

    op.alter_column('recipes', 'user_id', nullable=False)
    op.create_index(op.f('ix_recipes_user_id'), 'recipes', ['user_id'], unique=False)
    op.create_foreign_key(
        'fk_recipes_user_id_users', 'recipes', 'users', ['user_id'], ['id']
    )


def downgrade() -> None:
    op.drop_constraint('fk_recipes_user_id_users', 'recipes', type_='foreignkey')
    op.drop_index(op.f('ix_recipes_user_id'), table_name='recipes')
    op.drop_column('recipes', 'user_id')

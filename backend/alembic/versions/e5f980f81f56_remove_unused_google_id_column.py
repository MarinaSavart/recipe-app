"""remove_unused_google_id_column

Revision ID: e5f980f81f56
Revises: 533e5a254cb3
Create Date: 2026-09-18 15:50:50.705205

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f980f81f56'
down_revision: str | None = '533e5a254cb3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # La contrainte unique sur google_id est portée par la colonne elle-même
    # (créée via Base.metadata.create_all, pas via une migration) ; PostgreSQL
    # la supprime automatiquement avec la colonne.
    op.drop_column('users', 'google_id')


def downgrade() -> None:
    op.add_column('users', sa.Column('google_id', sa.String(length=255), nullable=True))
    op.create_unique_constraint('users_google_id_key', 'users', ['google_id'])

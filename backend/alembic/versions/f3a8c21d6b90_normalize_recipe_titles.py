"""normalize_recipe_titles

Data migration: existing recipe titles become "First letter uppercase, rest lowercase"
(same rule as app.schemas.recipe.normalize_title). No schema change.

Revision ID: f3a8c21d6b90
Revises: e41c7a9d2b85
Create Date: 2026-09-26 10:00:00.000000

"""
from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f3a8c21d6b90'
down_revision: str | None = 'e41c7a9d2b85'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE recipes
        SET title = upper(left(btrim(title), 1)) || lower(substr(btrim(title), 2))
        """
    )


def downgrade() -> None:
    # Irreversible: the original casing is not kept
    pass

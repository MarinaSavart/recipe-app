"""
Enriches the ingredients of existing recipes (canonical name, aisle, weight,
Ciqual link). Run `python -m app.scripts.import_ciqual` first.

    python -m app.scripts.enrich_ingredients                  # ingredients not enriched yet
    python -m app.scripts.enrich_ingredients --recipe-id 16   # a single recipe
    python -m app.scripts.enrich_ingredients --force          # redo every ingredient
    python -m app.scripts.enrich_ingredients --update-macros  # also replace macros by the Ciqual computation

Macros are left untouched unless --update-macros is given, since they may have been
edited by hand; the before/after values are printed either way.
"""
import argparse
import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal, engine
from app.models.recipe import Recipe
from app.services import ingredient_enrichment as enrichment_service

logger = logging.getLogger(__name__)


async def run(recipe_id: int | None, force: bool, update_macros: bool) -> None:
    async with AsyncSessionLocal() as db:
        query = select(Recipe.id).order_by(Recipe.id)
        if recipe_id is not None:
            query = query.where(Recipe.id == recipe_id)
        recipe_ids = list((await db.execute(query)).scalars())

    for current_id in recipe_ids:
        # One session and commit per recipe: a failure doesn't lose the others' work
        async with AsyncSessionLocal() as db:
            recipe = (await db.execute(
                select(Recipe).options(selectinload(Recipe.ingredients)).where(Recipe.id == current_id)
            )).scalar_one()

            if force:
                for ingredient in recipe.ingredients:
                    enrichment_service.reset_enrichment(ingredient)

            before = {field: getattr(recipe, field) for field in enrichment_service.MACRO_FIELDS}
            await enrichment_service.enrich_recipe(recipe, db, update_macros=update_macros)
            computed = enrichment_service.compute_macros(recipe, await enrichment_service.get_ciqual_index(db))
            await db.commit()

            matched = sum(1 for i in recipe.ingredients if i.ciqual_code)
            logger.info("#%s %s — %d/%d ingrédients liés à Ciqual", recipe.id, recipe.title, matched, len(recipe.ingredients))
            if computed:
                status = "remplacées" if update_macros else "non appliquées (--update-macros)"
                logger.info("    macros actuelles %s → Ciqual %s [%s]", before, computed, status)
            else:
                logger.info("    macros Ciqual incomplètes : macros actuelles conservées")

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich existing recipes' ingredients (Mistral + Ciqual).")
    parser.add_argument("--recipe-id", type=int, help="only this recipe")
    parser.add_argument("--force", action="store_true", help="re-enrich ingredients already enriched")
    parser.add_argument("--update-macros", action="store_true", help="replace macros by the Ciqual computation when complete")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    engine.echo = False  # the app engine logs every statement

    asyncio.run(run(args.recipe_id, args.force, args.update_macros))


if __name__ == "__main__":
    main()

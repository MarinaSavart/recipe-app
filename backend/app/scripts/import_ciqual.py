"""
Loads the ANSES-Ciqual food composition table into `ciqual_foods`.

    python -m app.scripts.import_ciqual            # downloads the XML files if needed
    python -m app.scripts.import_ciqual --dir PATH # uses already downloaded files

Source: Anses. 2025. Table de composition nutritionnelle des aliments Ciqual.
https://doi.org/10.57745/RDMHWY — Etalab Open Licence 2.0.
Re-running it updates the rows in place (upsert), so links from ingredients are kept.
"""
import argparse
import asyncio
import logging
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert

from app.database import AsyncSessionLocal, engine
from app.models.ciqual import CiqualFood
from app.services.aisles import aisle_for_ciqual_subgroup

logger = logging.getLogger(__name__)

DEFAULT_DIR = Path(__file__).resolve().parents[2] / "data" / "ciqual"
DOWNLOAD_URL = "https://entrepot.recherche.data.gouv.fr/api/access/datafile/:persistentId?persistentId=doi:10.57745/{}"
# File → DOI suffix of the Ciqual 2025 dataset
FILES = {"alim": "OH8KXC", "alim_grp": "FMNIUZ", "compo": "O73GDX"}

# Ciqual constituent code → column (all per 100 g)
CONSTITUENTS = {
    "328": "calories",      # Énergie, Règlement UE N° 1169/2011 (kcal/100 g)
    "25000": "proteins_g",  # Protéines, N x facteur de Jones
    "31000": "carbs_g",     # Glucides
    "40000": "fats_g",      # Lipides
}
BATCH_SIZE = 500


def _text(element: ET.Element, tag: str) -> str:
    return (element.findtext(tag) or "").strip()


def _parse_value(raw: str) -> float | None:
    """Ciqual values: "12,5", "-" (missing), "traces" or "< 0,5" (below detection → 0)."""
    value = raw.strip().lower()
    if not value or value == "-":
        return None
    if value == "traces" or value.startswith("<"):
        return 0.0
    try:
        return float(value.replace(",", "."))
    except ValueError:
        return None


def ensure_files(directory: Path) -> dict[str, Path]:
    """Returns the XML files, downloading the missing ones (compo.xml is ~70 MB)."""
    directory.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    for name, doi in FILES.items():
        path = directory / f"{name}.xml"
        if not path.exists():
            logger.info("Downloading %s…", path.name)
            urllib.request.urlretrieve(DOWNLOAD_URL.format(doi), path)
        paths[name] = path
    return paths


def parse_foods(paths: dict[str, Path]) -> list[dict]:
    """Reads foods, their sub-group and their macros per 100 g."""
    subgroup_names: dict[str, str] = {}
    for group in ET.parse(paths["alim_grp"]).getroot():
        subgroup_names.setdefault(_text(group, "alim_grp_code"), _text(group, "alim_grp_nom_fr"))
        subgroup_names.setdefault(_text(group, "alim_ssgrp_code"), _text(group, "alim_ssgrp_nom_fr"))

    foods: dict[str, dict] = {}
    for alim in ET.parse(paths["alim"]).getroot():
        code = _text(alim, "alim_code")
        subgroup = _text(alim, "alim_ssgrp_code")
        if not subgroup or subgroup.strip("0") == "":
            subgroup = _text(alim, "alim_grp_code")  # food only classified at group level
        foods[code] = {
            "code": int(code),
            "name_fr": _text(alim, "alim_nom_fr")[:255],
            "subgroup_code": subgroup,
            "subgroup_name": subgroup_names.get(subgroup, "")[:255],
            "aisle": aisle_for_ciqual_subgroup(subgroup),
            **{column: None for column in CONSTITUENTS.values()},
        }

    # compo.xml is big: stream it and only keep the 4 constituents we use
    for _, element in ET.iterparse(paths["compo"]):
        if element.tag != "COMPO":
            continue
        column = CONSTITUENTS.get(_text(element, "const_code"))
        food = foods.get(_text(element, "alim_code"))
        if column and food:
            food[column] = _parse_value(_text(element, "teneur"))
        element.clear()

    return list(foods.values())


async def save_foods(foods: list[dict]) -> None:
    async with AsyncSessionLocal() as db:
        for start in range(0, len(foods), BATCH_SIZE):
            statement = insert(CiqualFood).values(foods[start:start + BATCH_SIZE])
            await db.execute(statement.on_conflict_do_update(
                index_elements=[CiqualFood.code],
                set_={column: statement.excluded[column] for column in foods[0] if column != "code"},
            ))
        await db.commit()
    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import the Ciqual table into ciqual_foods.")
    parser.add_argument("--dir", type=Path, default=DEFAULT_DIR, help="folder holding (or receiving) the XML files")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    engine.echo = False  # the app engine logs every statement

    foods = parse_foods(ensure_files(args.dir))
    asyncio.run(save_foods(foods))
    logger.info("%d Ciqual foods imported.", len(foods))


if __name__ == "__main__":
    main()

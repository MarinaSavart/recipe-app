"""
Extracts a recipe from a website page (Marmiton, 750g, blogs...).

Most recipe sites embed the recipe as schema.org/Recipe JSON-LD (for Google's
rich results): when present, it's turned into a clean text listing. Otherwise the
page's visible text is used. Either way, the text then goes through the usual
LLM parsing, so a website recipe gets the same shape as a social-media one.
"""
import html
import json
import logging
import re
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

from app.services import safe_http

logger = logging.getLogger(__name__)

MAX_PAGE_BYTES = 5 * 1024 * 1024
# Visible-text fallback: enough for a recipe, without flooding the LLM prompt
MAX_TEXT_CHARS = 12_000
MIN_TEXT_CHARS = 200
# Tags whose text isn't page content
SKIPPED_TAGS = {"script", "style", "noscript", "svg", "template", "nav", "header", "footer", "form", "button"}
TAG_RE = re.compile(r"<[^>]+>")
SPACES_RE = re.compile(r"[ \t\r\f\v]+")


class _PageParser(HTMLParser):
    """Collects a page's JSON-LD blocks, <meta> tags, <title> and visible text."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.json_ld: list[str] = []
        self.meta: dict[str, str] = {}
        self.title = ""
        self.text: list[str] = []
        self._skip_depth = 0
        self._in_json_ld = False
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {name: value or "" for name, value in attrs}
        if tag == "script" and attributes.get("type", "").lower() == "application/ld+json":
            self._in_json_ld = True
            self.json_ld.append("")
        elif tag == "meta":
            key = attributes.get("property") or attributes.get("name")
            if key and "content" in attributes:
                self.meta.setdefault(key.lower(), attributes["content"])
        elif tag == "title":
            self._in_title = True
        if tag in SKIPPED_TAGS:
            self._skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag == "script":
            self._in_json_ld = False
        elif tag == "title":
            self._in_title = False
        if tag in SKIPPED_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._in_json_ld:
            self.json_ld[-1] += data
        elif self._in_title:
            self.title += data
        elif self._skip_depth == 0 and data.strip():
            self.text.append(data.strip())


def _clean(value: object) -> str:
    """Plain text from a JSON-LD value: HTML tags and entities removed, spaces collapsed."""
    if value is None:
        return ""
    text = html.unescape(TAG_RE.sub(" ", str(value)))
    return SPACES_RE.sub(" ", text).strip()


def _is_recipe(node: dict) -> bool:
    types = node.get("@type")
    return "Recipe" in (types if isinstance(types, list) else [types])


def _find_recipe(node: object, depth: int = 0) -> dict | None:
    """The first schema.org Recipe in a JSON-LD tree (top level, @graph, mainEntity...)."""
    if depth > 6:
        return None
    if isinstance(node, dict):
        if _is_recipe(node):
            return node
        children = node.values()
    elif isinstance(node, list):
        children = node
    else:
        return None
    for child in children:
        if found := _find_recipe(child, depth + 1):
            return found
    return None


def _first_text(value: object) -> str:
    """A name / URL out of the shapes schema.org allows: string, list, or object with name / url."""
    if isinstance(value, list):
        return _first_text(value[0]) if value else ""
    if isinstance(value, dict):
        return _clean(value.get("name") or value.get("url") or value.get("@id"))
    return _clean(value)


def _instructions(value: object) -> list[str]:
    """Flattens recipeInstructions: text, HowToStep, HowToSection (titled) or lists of them."""
    if isinstance(value, str):
        # Some sites put every step in one string, one per line
        return [line for line in (_clean(part) for part in value.split("\n")) if line]
    if isinstance(value, list):
        return [line for item in value for line in _instructions(item)]
    if isinstance(value, dict):
        if "itemListElement" in value:
            section = _clean(value.get("name"))
            steps = _instructions(value["itemListElement"])
            return [f"{section} :", *steps] if section else steps
        text = _clean(value.get("text") or value.get("name"))
        return [text] if text else []
    return []


def _recipe_to_text(recipe: dict) -> str:
    """A schema.org Recipe as a readable listing, in the shape of a video description."""
    lines = [_clean(recipe.get("name"))]
    if description := _clean(recipe.get("description")):
        lines.append(description)

    if servings := _first_text(recipe.get("recipeYield")):
        lines.append(f"Portions : {servings}")
    for key, label in (("prepTime", "Préparation"), ("cookTime", "Cuisson"), ("totalTime", "Temps total")):
        if duration := _clean(recipe.get(key)):
            lines.append(f"{label} : {duration} (durée ISO 8601)")

    ingredients = recipe.get("recipeIngredient") or recipe.get("ingredients") or []
    if isinstance(ingredients, str):
        ingredients = [ingredients]
    lines.append("\nIngrédients :")
    lines += [f"- {_clean(ingredient)}" for ingredient in ingredients if _clean(ingredient)]

    lines.append("\nÉtapes :")
    lines += [f"- {step}" for step in _instructions(recipe.get("recipeInstructions"))]

    nutrition = recipe.get("nutrition")
    if isinstance(nutrition, dict):
        values = {
            "Calories": nutrition.get("calories"),
            "Protéines": nutrition.get("proteinContent"),
            "Glucides": nutrition.get("carbohydrateContent"),
            "Lipides": nutrition.get("fatContent"),
        }
        listed = [f"{label} : {_clean(value)}" for label, value in values.items() if value]
        if listed:
            lines.append("\nValeurs nutritionnelles (par portion) : " + ", ".join(listed))

    return "\n".join(line for line in lines if line is not None)


def _json_ld_recipe(blocks: list[str]) -> dict | None:
    for block in blocks:
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue  # some sites ship invalid JSON-LD: just skip that block
        if recipe := _find_recipe(data):
            return recipe
    return None


async def extract_from_website(url: str) -> dict:
    """
    Fetches a recipe page and returns {description, title, author, thumbnail_url}.
    Raises ValueError (message shown to the user) when the page can't be used.
    """
    try:
        page = await safe_http.fetch(url, MAX_PAGE_BYTES)
    except safe_http.UnsafeUrlError:
        raise
    except ValueError as exc:
        raise ValueError("Cette page est trop lourde pour être importée.") from exc

    if page.content_type not in ("text/html", "application/xhtml+xml"):
        raise ValueError("Ce lien ne mène pas à une page web. Essaie l'import manuel.")

    parser = _PageParser()
    parser.feed(page.body.decode("utf-8", errors="replace"))
    parser.close()

    site_name = parser.meta.get("og:site_name") or urlparse(page.url).hostname or ""
    recipe = _json_ld_recipe(parser.json_ld)

    if recipe:
        description = _recipe_to_text(recipe)
        title = _clean(recipe.get("name")) or None
        author = _first_text(recipe.get("author")) or site_name
        image = _first_text(recipe.get("image")) or parser.meta.get("og:image", "")
    else:
        logger.info("No schema.org Recipe on %s, falling back to the page text", page.url)
        description = "\n".join(parser.text)[:MAX_TEXT_CHARS]
        title = _clean(parser.meta.get("og:title") or parser.title) or None
        author = site_name
        image = parser.meta.get("og:image", "")

    if len(description) < MIN_TEXT_CHARS and not recipe:
        raise ValueError("Aucune recette trouvée sur cette page. Essaie l'import manuel.")

    return {
        "description": description,
        "title": title,
        "author": author or None,
        # Relative image URLs are resolved against the page
        "thumbnail_url": urljoin(page.url, image) if image else None,
    }

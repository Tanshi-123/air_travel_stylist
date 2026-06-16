from __future__ import annotations

from urllib.parse import quote_plus


MERCHANTS = [
    ("Amazon", "https://www.amazon.in/s?k={query}"),
    ("Myntra", "https://www.myntra.com/{query}"),
    ("Ajio", "https://www.ajio.com/search/?text={query}"),
    ("Flipkart", "https://www.flipkart.com/search?q={query}"),
    ("Zara", "https://www.zara.com/in/en/search?searchTerm={query}"),
    ("H&M", "https://www2.hm.com/en_in/search-results.html?q={query}"),
]


def recommend_products(missing_items: list[str], gender: str = "women") -> list[dict[str, object]]:
    """Return shopping search suggestions for wardrobe gaps.

    These are neutral search links for the MVP. Production should replace this
    with official affiliate/product APIs so prices and ratings are verified.
    """
    recommendations = []
    selected_gender = _normal_gender(gender)
    for index, item in enumerate(missing_items):
        query = quote_plus(_shopping_query(item, selected_gender))
        recommendations.append(
            {
                "item": item,
                "note": _styling_note(item),
                "products": [
                    {
                        "merchant": merchant,
                        "name": item.title(),
                        "priceRange": _price_range(index),
                        "ratingEstimate": round(4.1 + (index % 4) * 0.2, 1),
                        "url": template.format(query=query),
                    }
                    for merchant, template in MERCHANTS
                ],
            }
        )
    return recommendations


def _price_range(index: int) -> str:
    ranges = ["Rs 699 - Rs 1,499", "Rs 1,299 - Rs 2,799", "Rs 2,499 - Rs 6,999", "Rs 899 - Rs 1,999"]
    return ranges[index % len(ranges)]


def _shopping_query(item: str, gender: str) -> str:
    audience = "women" if gender == "women" else "men"
    category_terms = {
        "trench coat": f"{audience} trench coat",
        "insulated jacket": f"{audience} winter insulated jacket",
        "water-resistant jacket": f"{audience} water resistant travel jacket",
        "weatherproof boots": f"{audience} weatherproof travel boots",
        "weatherproof shoes": f"{audience} weatherproof walking shoes",
        "straight trousers": f"{audience} straight fit trousers",
        "cotton trousers": f"{audience} cotton linen trousers",
        "tailored evening layer": f"{audience} tailored blazer evening",
        "statement accessory": f"{audience} minimal statement accessory",
        "cotton kurti": "women cotton kurti",
        "breathable dress": "women breathable summer dress",
        "comfortable flats": "women comfortable flats",
        "light scarf": "women light scarf",
    }
    query = category_terms.get(item.lower(), item)
    if audience not in query.lower() and "unisex" not in query.lower():
        query = f"{audience} {query}"
    return query


def _normal_gender(gender: str) -> str:
    value = str(gender or "").strip().lower()
    if value in {"men", "man", "male", "boys", "boy"}:
        return "men"
    return "women"


def _styling_note(item: str) -> str:
    text = item.lower()
    if "jacket" in text or "coat" in text or "layer" in text:
        return "Outerwear gap. Pick a layer that upgrades simple daywear into a dinner-ready look."
    if "shoe" in text or "boot" in text or "sandal" in text:
        return "Footwear gap. Prioritize comfort first, then choose a finish that suits restaurants and nightlife."
    if "trouser" in text or "pants" in text:
        return "Bottomwear gap. A clean straight fit works across sightseeing, cafes, and evening plans."
    if "umbrella" in text or "weatherproof" in text:
        return "Weather gap. This keeps the outfit usable when rain or wind changes the day."
    if "scarf" in text:
        return "Accessory gap. Useful for styling, sun or cold protection, and respectful coverage."
    return "Style gap. This rounds out the destination outfit without overpacking."

from __future__ import annotations

from itertools import combinations, product
from typing import Any

from backend.services.destination_intelligence import analyze_destination
from backend.services.shopping_service import recommend_products
from backend.services.wardrobe_service import list_wardrobe


SLOT_KEYWORDS = {
    "top": {"Shirt", "T-shirt", "Topwear", "Blazer", "Jacket"},
    "onepiece": {"Dress"},
    "bottom": {"Shorts", "Jeans", "Trousers", "Skirt"},
    "footwear": {"Sandals", "Sneakers", "Loafers"},
    "accessory": {"Hat", "Scarf", "Sunglasses"},
}

NEUTRAL_COLORS = {
    "Black",
    "White",
    "Cream",
    "Beige",
    "Ivory",
    "Grey",
    "Gray",
    "Charcoal",
    "Navy",
    "Denim Blue",
    "Brown",
    "Tan",
    "Neutral",
}

SLOT_COMPLEMENTS = {
    frozenset(("top", "bottom")),
    frozenset(("top", "footwear")),
    frozenset(("bottom", "footwear")),
    frozenset(("onepiece", "footwear")),
    frozenset(("onepiece", "accessory")),
    frozenset(("top", "accessory")),
    frozenset(("bottom", "accessory")),
    frozenset(("footwear", "accessory")),
}


def generate_outfits(
    destination: str,
    trip_days: int = 4,
    start_date: str | None = None,
    end_date: str | None = None,
    gender: str = "women",
) -> dict[str, Any]:
    profile = analyze_destination(destination, trip_days, start_date, end_date)
    wardrobe = list_wardrobe()

    selected_gender = _normal_gender(gender)
    missing = _missing_items(wardrobe, profile, selected_gender)

    return {
        "destination": profile["destination"],
        "gender": selected_gender,
        "weather": profile["weather"],
        "fashionProfile": profile["fashionProfile"],
        "ownedItemCount": len(wardrobe),
        "outfits": _build_mix_match_outfits(wardrobe, profile),
        "missingItems": missing,
        "shoppingRecommendations": recommend_products(missing[:4], selected_gender),
    }


def _pick_outfit(wardrobe: list[dict[str, Any]], profile: dict[str, Any], mode: str) -> list[dict[str, Any]]:
    selected = []
    for slot in ("top", "bottom", "footwear", "accessory"):
        candidates = [item for item in wardrobe if item["category"] in SLOT_KEYWORDS[slot]]
        if not candidates and slot == "accessory":
            continue
        if candidates:
            ranked = sorted(candidates, key=lambda item: _score_item(item, profile, mode), reverse=True)
            selected.append({**ranked[0], "slot": slot, "matchScore": _score_item(ranked[0], profile, mode)})
    return selected


def _build_mix_match_outfits(wardrobe: list[dict[str, Any]], profile: dict[str, Any]) -> list[dict[str, Any]]:
    if not wardrobe:
        return []

    annotated = [_annotated_item(item, profile) for item in wardrobe]
    by_slot: dict[str, list[dict[str, Any]]] = {slot: [] for slot in ("top", "onepiece", "bottom", "footwear", "accessory", "piece")}
    for item in annotated:
        by_slot.setdefault(item["slot"], []).append(item)

    candidates: list[dict[str, Any]] = []
    tops = by_slot.get("top", [])
    onepieces = by_slot.get("onepiece", [])
    bottoms = by_slot.get("bottom", [])
    footwear = by_slot.get("footwear", [])
    accessories = by_slot.get("accessory", [])

    if tops and bottoms:
        shoe_options = footwear or [None]
        accessory_options = accessories or [None]
        for top, bottom, shoe, accessory in product(tops, bottoms, shoe_options, accessory_options):
            items = [top, bottom]
            if shoe:
                items.append(shoe)
            if accessory:
                items.append(accessory)
            if _can_mix_items(items):
                candidates.append(_mix_candidate(items, profile))

    if onepieces:
        shoe_options = footwear or [None]
        accessory_options = accessories or [None]
        for onepiece, shoe, accessory in product(onepieces, shoe_options, accessory_options):
            items = [onepiece]
            if shoe:
                items.append(shoe)
            if accessory:
                items.append(accessory)
            if _can_mix_items(items):
                candidates.append(_mix_candidate(items, profile))

    if not candidates and tops:
        support_items = bottoms + footwear + accessories + by_slot.get("piece", [])
        if support_items:
            for top, support in product(tops, support_items):
                if top["id"] != support["id"] and _can_mix_items([top, support]):
                    candidates.append(_mix_candidate([top, support], profile))

    if not candidates and len(annotated) >= 2:
        for first, second in combinations(annotated, 2):
            if _can_mix_items([first, second]):
                candidates.append(_mix_candidate([first, second], profile))

    if not candidates:
        return []

    selected = _select_covering_candidates(candidates, {item["id"] for item in annotated})
    return [
        _mix_outfit_payload(f"Mix {index:02d}", candidate["items"], candidate["score"], profile, len(annotated))
        for index, candidate in enumerate(selected, start=1)
    ]


def _annotated_item(item: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
    slot = _slot_for(item)
    score = round((_score_item(item, profile, "day") + _score_item(item, profile, "night")) / 2)
    return {**item, "slot": slot, "matchScore": score}


def _slot_for(item: dict[str, Any]) -> str:
    category = item.get("category")
    for slot, categories in SLOT_KEYWORDS.items():
        if category in categories:
            return slot
    return "piece"


def _mix_candidate(items: list[dict[str, Any]], profile: dict[str, Any]) -> dict[str, Any]:
    unique_items = _unique_items(items)
    return {
        "items": unique_items,
        "score": _candidate_score(unique_items, profile),
        "ids": {item["id"] for item in unique_items},
    }


def _can_mix_items(items: list[dict[str, Any]]) -> bool:
    primary_slots = [item.get("slot") for item in _unique_items(items) if item.get("slot") in {"top", "onepiece", "bottom", "footwear"}]
    if len(primary_slots) != len(set(primary_slots)):
        return False
    if "top" in primary_slots and "onepiece" in primary_slots:
        return False
    return True


def _select_covering_candidates(candidates: list[dict[str, Any]], target_ids: set[int]) -> list[dict[str, Any]]:
    ranked = sorted(candidates, key=lambda item: item["score"], reverse=True)
    selected: list[dict[str, Any]] = []
    covered: set[int] = set()
    max_results = max(3, min(6, len(ranked)))

    while len(selected) < max_results and target_ids - covered:
        remaining = [candidate for candidate in ranked if candidate not in selected]
        if not remaining:
            break
        best = max(
            remaining,
            key=lambda candidate: (len(candidate["ids"] - covered), candidate["score"], len(candidate["ids"])),
        )
        selected.append(best)
        covered.update(best["ids"])

    for candidate in ranked:
        if len(selected) >= max_results:
            break
        if candidate not in selected:
            selected.append(candidate)

    return selected


def _candidate_score(items: list[dict[str, Any]], profile: dict[str, Any]) -> int:
    if not items:
        return 0
    item_score = sum(item["matchScore"] for item in items) / len(items)
    if len(items) == 1:
        return min(99, round(item_score))
    pair_scores = [_pair_compatibility_score(first, second, profile) for first, second in combinations(items, 2)]
    pair_score = sum(pair_scores) / len(pair_scores)
    return max(1, min(99, round(item_score * 0.68 + pair_score * 0.32)))


def _mix_outfit_payload(
    name: str,
    items: list[dict[str, Any]],
    score: int,
    profile: dict[str, Any],
    wardrobe_count: int,
) -> dict[str, Any]:
    if not items:
        return {
            "name": name,
            "items": [],
            "matchScore": 0,
            "whyItWorks": "Add wardrobe items to generate a styled outfit.",
        }

    return {
        "name": name,
        "items": items,
        "matchScore": score,
        "whyItWorks": _mix_reason(items, profile, wardrobe_count),
        "styleNotes": _style_notes(items, profile, "trip"),
        "pairings": _pairings(items, profile),
    }


def _mix_reason(items: list[dict[str, Any]], profile: dict[str, Any], wardrobe_count: int) -> str:
    weather = profile["weather"]
    reasons = [f"Uses {len(items)} of your {wardrobe_count} uploaded pieces"]
    if weather["temperatureC"] >= 30 and any(item["breathable"] for item in items):
        reasons.append("keeps the look breathable")
    if weather["rainProbability"] >= 35 and any(item["category"] in {"Jacket", "Sneakers", "Loafers"} for item in items):
        reasons.append("handles possible rain better")
    if any(item["color"] in set(profile["popularColors"]) for item in items):
        reasons.append("matches the local color palette")
    return ", ".join(reasons).capitalize() + "."


def _unique_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique: list[dict[str, Any]] = []
    seen: set[int] = set()
    for item in items:
        item_id = item["id"]
        if item_id in seen:
            continue
        unique.append(item)
        seen.add(item_id)
    return unique


def _outfit_payload(name: str, items: list[dict[str, Any]], profile: dict[str, Any], mode: str) -> dict[str, Any]:
    if not items:
        return {
            "name": name,
            "items": [],
            "matchScore": 0,
            "whyItWorks": "Add wardrobe items to generate a styled outfit.",
        }

    score = round(sum(item["matchScore"] for item in items) / len(items))
    reasons = []
    weather = profile["weather"]
    if weather["temperatureC"] >= 30:
        reasons.append("breathable choices for heat")
    if weather["rainProbability"] >= 25:
        reasons.append("rain-aware layering")
    if mode == "night":
        reasons.append("cleaner evening styling")
    else:
        reasons.append("comfortable daytime movement")

    return {
        "name": name,
        "items": items,
        "matchScore": min(99, score),
        "whyItWorks": ", ".join(reasons).capitalize() + ".",
        "styleNotes": _style_notes(items, profile, mode),
        "pairings": _pairings(items, profile),
    }


def _style_notes(items: list[dict[str, Any]], profile: dict[str, Any], mode: str) -> list[str]:
    weather = profile["weather"]
    popular_colors = set(profile["popularColors"])
    notes: list[str] = []
    matched_colors = [item["color"] for item in items if item["color"] in popular_colors]
    if matched_colors:
        notes.append(f"{', '.join(_dedupe(matched_colors))} already sits inside the destination color palette.")
    if any(item["breathable"] for item in items) and weather["temperatureC"] >= 28:
        notes.append("The breathable pieces keep the outfit comfortable for warm weather.")
    if weather["temperatureC"] <= 18 and any(item["category"] in {"Jacket", "Blazer", "Scarf"} for item in items):
        notes.append("The layer gives warmth without making the look feel bulky.")
    if weather["rainProbability"] >= 35 and any(item["category"] in {"Jacket", "Sneakers"} for item in items):
        notes.append("The outerwear or closed footwear makes the combination more rain-aware.")
    if mode == "night" and any(item["formality"] == "Smart" for item in items):
        notes.append("The smarter piece upgrades the look for dinner, lounges, or evening plans.")
    if mode == "trip" and any(item["formality"] == "Smart" for item in items):
        notes.append("The smarter piece keeps the combination polished for cafes, photos, and evening plans.")
    if not notes:
        notes.append("The selected pieces balance color, comfort, and destination etiquette.")
    return notes[:2]


def _pairings(items: list[dict[str, Any]], profile: dict[str, Any]) -> list[dict[str, str]]:
    ranked_pairs = sorted(
        combinations(items, 2),
        key=lambda pair: _pair_compatibility_score(pair[0], pair[1], profile),
        reverse=True,
    )
    return [
        {
            "itemA": first["name"],
            "itemB": second["name"],
            "reason": _pairing_reason(first, second, profile),
        }
        for first, second in ranked_pairs[:4]
    ]


def _pair_compatibility_score(first: dict[str, Any], second: dict[str, Any], profile: dict[str, Any]) -> int:
    score = 52
    popular_colors = set(profile["popularColors"])
    first_color = first["color"]
    second_color = second["color"]
    slot_pair = frozenset((first.get("slot", "piece"), second.get("slot", "piece")))

    if first_color == second_color:
        score += 12
    if first_color in popular_colors and second_color in popular_colors:
        score += 18
    elif first_color in popular_colors or second_color in popular_colors:
        score += 9
    if first_color in NEUTRAL_COLORS or second_color in NEUTRAL_COLORS:
        score += 8
    if slot_pair in SLOT_COMPLEMENTS:
        score += 12
    if first.get("slot") != second.get("slot"):
        score += 6
    if first["material"] == second["material"]:
        score += 4
    if first["breathable"] and second["breathable"] and profile["weather"]["temperatureC"] >= 28:
        score += 8
    if "Smart" in {first["formality"], second["formality"]}:
        score += 6
    if first.get("slot") == second.get("slot") and first.get("slot") not in {"accessory", "piece"}:
        score -= 10
    return max(1, min(99, score))


def _pairing_reason(first: dict[str, Any], second: dict[str, Any], profile: dict[str, Any]) -> str:
    popular_colors = set(profile["popularColors"])
    first_color = first["color"]
    second_color = second["color"]
    if first_color == second_color:
        return f"Same-color styling keeps the look clean and intentional in {profile['destination']}."
    if first_color in popular_colors and second_color in popular_colors:
        return "Both colors match the destination palette, so the combination feels locally tuned."
    if first["breathable"] and second["breathable"] and profile["weather"]["temperatureC"] >= 28:
        return "Both pieces are breathable, which is useful for the destination weather."
    if "Smart" in {first["formality"], second["formality"]}:
        return "One smarter piece sharpens the outfit without making it too formal."
    return "The silhouettes balance each other for a wearable travel look."


def _score_item(item: dict[str, Any], profile: dict[str, Any], mode: str) -> int:
    score = 54
    weather = profile["weather"]
    popular_colors = set(profile["popularColors"])
    recommended = " ".join(profile["recommendedItems"]).lower()
    avoid = " ".join(profile["avoidItems"]).lower()
    category = item["category"].lower()
    style = item["style"].lower()

    if item["color"] in popular_colors:
        score += 14
    if item["breathable"] and weather["temperatureC"] >= 28:
        score += 16
    if category in recommended:
        score += 14
    if category in avoid:
        score -= 35
    if "night" in style and mode == "night":
        score += 12
    if item["formality"] == "Smart" and mode == "night":
        score += 10
    if item["category"] in {"Shorts", "Sandals"} and "modest" in " ".join(profile["culturalNotes"]).lower():
        score -= 18
    if item["category"] in {"Shorts", "Sandals"} and weather["temperatureC"] <= 20:
        score -= 24
    if item["category"] in {"Shorts", "Sandals"} and weather["temperatureC"] <= 12:
        score -= 42
    if item["category"] == "Jeans" and weather["temperatureC"] >= 32:
        score -= 15
    if item["category"] == "Jeans" and weather["rainProbability"] >= 50:
        score -= 8

    return max(1, min(99, score))


def _missing_items(wardrobe: list[dict[str, Any]], profile: dict[str, Any], gender: str) -> list[str]:
    owned_text = " ".join(
        f"{item['color']} {item['material']} {item['category']} {item['style']}" for item in wardrobe
    ).lower()
    weather = profile["weather"]
    temperature = float(weather.get("temperatureC", 26))
    rain = int(weather.get("rainProbability", 0))
    nightlife = bool(profile.get("nightlife"))
    profile_text = " ".join(profile.get("recommendedItems", []) + profile.get("culturalNotes", [])).lower()

    planned_items = list(profile["recommendedItems"])
    is_india = str(weather.get("countryCode") or "").upper() == "IN" or profile["destination"].lower() in {
        "goa",
        "rajasthan",
        "mumbai",
        "lucknow",
        "kanpur",
        "kashmir",
    }

    if temperature <= 8:
        planned_items.extend(["Insulated jacket", "Knit sweater", "Thermal base layer", "Weatherproof boots", "Wool scarf"])
    elif temperature <= 18:
        planned_items.extend(["Trench coat", "Light jacket", "Knit top", "Straight trousers", "Closed-toe shoes"])
    elif temperature >= 30:
        if is_india:
            if gender == "men":
                planned_items.extend(["Cotton kurta", "Linen shirt", "Cotton trousers", "Clean sneakers", "Sunglasses"])
            else:
                planned_items.extend(["Cotton kurti", "Linen shirt", "Cotton trousers", "Comfortable flats", "Sunglasses"])
        else:
            if gender == "men":
                planned_items.extend(["Linen shirt", "Cotton trousers", "Breathable polo", "Comfortable sandals", "Sunglasses"])
            else:
                planned_items.extend(["Linen shirt", "Cotton trousers", "Breathable dress", "Comfortable sandals", "Sunglasses"])
    else:
        planned_items.extend(["Overshirt", "Straight trousers", "Clean sneakers", "Evening shirt", "Light scarf"])

    if rain >= 35:
        planned_items.extend(["Water-resistant jacket", "Compact umbrella", "Weatherproof shoes"])
    if nightlife:
        planned_items.extend(["Tailored evening layer", "Dress shoes", "Statement accessory"])
    if "modest" in profile_text:
        planned_items.extend(["Light scarf", "Relaxed trousers", "Longline overshirt"])

    missing: list[str] = []
    for item in _dedupe(planned_items):
        if not _is_owned(item, owned_text):
            missing.append(item)
    return missing[:8]


def _normal_gender(gender: str) -> str:
    value = str(gender or "").strip().lower()
    if value in {"men", "man", "male", "boys", "boy"}:
        return "men"
    return "women"


def _dedupe(items: list[str]) -> list[str]:
    unique: list[str] = []
    seen: set[str] = set()
    for item in items:
        key = item.lower()
        if key in seen:
            continue
        unique.append(item)
        seen.add(key)
    return unique


def _is_owned(item: str, owned_text: str) -> bool:
    synonyms = {
        "insulated jacket": ["jacket", "coat", "puffer"],
        "trench coat": ["trench", "coat", "jacket"],
        "light jacket": ["jacket", "overshirt", "blazer"],
        "tailored evening layer": ["blazer", "jacket", "overshirt"],
        "straight trousers": ["trousers", "pants", "jeans"],
        "cotton trousers": ["trousers", "pants"],
        "relaxed trousers": ["trousers", "pants", "jeans"],
        "closed-toe shoes": ["sneakers", "loafers", "boots", "shoes"],
        "weatherproof shoes": ["boots", "sneakers", "shoes"],
        "weatherproof boots": ["boots"],
        "comfortable sandals": ["sandals"],
        "dress shoes": ["loafers", "boots", "shoes"],
        "clean sneakers": ["sneakers"],
        "light scarf": ["scarf", "dupatta", "shawl"],
        "wool scarf": ["scarf", "shawl"],
        "linen shirt": ["linen shirt", "shirt"],
        "evening shirt": ["black shirt", "shirt", "blouse"],
        "breathable dress": ["dress"],
        "compact umbrella": ["umbrella"],
        "sunglasses": ["sunglasses"],
        "statement accessory": ["accessory", "bag", "jewelry", "watch"],
    }
    candidates = synonyms.get(item.lower(), item.lower().split())
    return any(candidate in owned_text for candidate in candidates)

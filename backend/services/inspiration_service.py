from __future__ import annotations

import html
import os
import re
from typing import Any
from urllib.parse import quote_plus

import requests

from backend.services.destination_intelligence import analyze_destination


PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search"
PINTEREST_SEARCH_URL = "https://in.pinterest.com/search/pins/"

CATEGORY_DEFS = [
    {
        "id": "similar",
        "title": "Destination outfit ideas",
        "subtitle": "Place-aware outfit references for the selected destination and gender.",
        "query": "fashion outfit ideas travel pinterest style",
        "limit": 8,
    },
    {
        "id": "places",
        "title": "Local life and popular places",
        "subtitle": "Landmarks, streets, markets, waterfronts, and the real mood of the place.",
        "query": "popular places local life street market landmark",
        "limit": 8,
    },
]

INDIAN_DESTINATION_KEYS = {"goa", "rajasthan", "mumbai", "lucknow", "kanpur", "kashmir"}

LOCAL_IMAGES = {
    "goa": "/images/inspiration-goa.png",
    "paris": "/images/inspiration-paris.png",
    "kashmir": "/images/inspiration-kashmir.png",
    "lucknow": "/images/inspiration-lucknow.png",
}

LOCAL_OUTFIT_IMAGES = {
    "lucknow": [
        "/images/inspiration-lucknow.png",
        "/images/inspiration-lucknow-day.png",
        "/images/inspiration-lucknow-evening.png",
    ],
}

PLACE_IMAGE_FALLBACKS = {
    "korea": [
        {
            "imageUrl": "https://images.unsplash.com/photo-1687778055088-8cebf164f012?auto=format&fit=crop&w=900&q=80",
            "title": "Seoul alley local life",
            "photographer": "Red Shuheart / Unsplash",
            "sourceUrl": "https://unsplash.com/photos/a-narrow-alley-way-with-a-sign-on-the-side-of-it-ST1mRdFhzpg",
            "tags": ["Korea", "Seoul", "local life"],
        },
        {
            "imageUrl": "https://images.unsplash.com/photo-1691965335688-5e5b6966806b?auto=format&fit=crop&w=900&q=80",
            "title": "Seoul neon nightlife street",
            "photographer": "Andrea De Santis / Unsplash",
            "sourceUrl": "https://unsplash.com/photos/yCVLNvXSK6A",
            "tags": ["Korea", "Seoul", "nightlife"],
        },
    ],
    "south korea": [
        {
            "imageUrl": "https://images.unsplash.com/photo-1687778055088-8cebf164f012?auto=format&fit=crop&w=900&q=80",
            "title": "Seoul alley local life",
            "photographer": "Red Shuheart / Unsplash",
            "sourceUrl": "https://unsplash.com/photos/a-narrow-alley-way-with-a-sign-on-the-side-of-it-ST1mRdFhzpg",
            "tags": ["South Korea", "Seoul", "local life"],
        },
        {
            "imageUrl": "https://images.unsplash.com/photo-1691965335688-5e5b6966806b?auto=format&fit=crop&w=900&q=80",
            "title": "Seoul neon nightlife street",
            "photographer": "Andrea De Santis / Unsplash",
            "sourceUrl": "https://unsplash.com/photos/yCVLNvXSK6A",
            "tags": ["South Korea", "Seoul", "nightlife"],
        },
    ],
    "portugal": [
        {
            "imageUrl": "https://images.unsplash.com/photo-1681908393857-0ef26cfe47f0?auto=format&fit=crop&w=900&q=80",
            "title": "Lisbon tram street",
            "photographer": "Joao Reguengos / Unsplash",
            "sourceUrl": "https://unsplash.com/photos/a-city-street-filled-with-lots-of-traffic-next-to-tall-buildings-Yqm1ONQR4F4",
            "tags": ["Portugal", "Lisbon", "street"],
        },
        {
            "imageUrl": "https://images.unsplash.com/photo-1755524317710-ea777c80d8f7?auto=format&fit=crop&w=900&q=80",
            "title": "Lisbon steep street",
            "photographer": "Maria Lupan / Unsplash",
            "sourceUrl": "https://unsplash.com/photos/people-walk-down-a-steep-cobblestone-street-in-lisbon-HX5BatMBPeg",
            "tags": ["Portugal", "Lisbon", "travel"],
        },
    ],
    "portuguese": [
        {
            "imageUrl": "https://images.unsplash.com/photo-1681908393857-0ef26cfe47f0?auto=format&fit=crop&w=900&q=80",
            "title": "Lisbon tram street",
            "photographer": "Joao Reguengos / Unsplash",
            "sourceUrl": "https://unsplash.com/photos/a-city-street-filled-with-lots-of-traffic-next-to-tall-buildings-Yqm1ONQR4F4",
            "tags": ["Portugal", "Lisbon", "street"],
        },
    ],
}

GLOBAL_OUTFIT_IMAGES = {
    "women_day": "/images/inspiration-global-day.png",
    "women_night": "/images/inspiration-global-night.png",
    "women_weather": "/images/inspiration-global-rain.png",
    "women_kurti": "/images/inspiration-style-kurti.png",
    "women_trench": "/images/inspiration-style-trench.png",
    "women_streetwear": "/images/inspiration-style-streetwear.png",
    "women_resort": "/images/inspiration-style-resort.png",
    "men_kurta": "/images/inspiration-men-kurta.png",
    "men_trench": "/images/inspiration-men-trench.png",
    "men_streetwear": "/images/inspiration-men-streetwear.png",
    "men_resort": "/images/inspiration-men-resort.png",
}

IGNORED_COMMONS_TITLE_WORDS = {
    "animal",
    "atlas",
    "bird",
    "butterfly",
    "coin",
    "diagram",
    "emblem",
    "flag",
    "gull",
    "illustrated",
    "poster",
    "logo",
    "map",
    "moth",
    "plan",
    "portrait",
    "prince",
    "queen",
    "seal",
    "stamp",
    "zoo",
}

COMMONS_PLACE_WORDS = {
    "architecture",
    "bridge",
    "bridges",
    "castle",
    "cathedral",
    "city",
    "cityscape",
    "harbour",
    "harbor",
    "landmark",
    "market",
    "monument",
    "palace",
    "river",
    "skyline",
    "square",
    "station",
    "street",
    "tower",
}


def get_destination_inspiration(destination: str, limit: int = 24, gender: str = "women") -> dict[str, Any]:
    profile = analyze_destination(destination)
    api_key = os.getenv("PEXELS_API_KEY", "").strip()
    selected_gender = _normal_gender(gender)
    categories = [_category_payload(profile, definition, api_key, selected_gender) for definition in CATEGORY_DEFS]
    items = _dedupe_items([item for category in categories for item in category["items"]])[:limit]
    source = "Pexels + Wikimedia Commons + Pinterest search links" if api_key else "Wikimedia Commons + Pinterest search links"

    return {
        "destination": profile["destination"],
        "gender": selected_gender,
        "query": _search_query(profile),
        "source": source,
        "items": items,
        "categories": categories,
        "pinterestBoards": _pinterest_boards(profile, selected_gender),
        "socialPolicy": "Pinterest is linked through exact destination searches. Pins are not scraped; public/place images use licensed/open sources.",
    }


def _category_payload(profile: dict[str, Any], definition: dict[str, Any], api_key: str, gender: str) -> dict[str, Any]:
    limit = int(definition.get("limit", 6))
    query = _category_query(profile, definition, gender)
    pexels_items = _fetch_pexels(query, api_key, limit) if api_key else []
    editorial_items = _editorial_items_for_category(profile, definition["id"], gender)

    if definition["id"] == "places":
        items = _dedupe_items(_place_fallback_items(profile) + _fetch_wikimedia(profile, limit) + pexels_items + editorial_items)
    else:
        items = _dedupe_items(editorial_items + pexels_items)

    return {
        "id": definition["id"],
        "title": definition["title"],
        "subtitle": definition["subtitle"],
        "query": query,
        "pinterestUrl": _pinterest_url(query),
        "items": items[:limit],
    }


def _pinterest_boards(profile: dict[str, Any], gender: str) -> list[dict[str, str]]:
    destination = profile["destination"]
    gender_phrase = "menswear men" if gender == "men" else "womenswear women"
    place_query = f"{destination} popular places travel aesthetic local life landmarks streets"
    boards = [
        {
            "title": f"{destination} {gender} outfit board",
            "subtitle": "Pinterest outfit pins for the selected destination and profile.",
            "query": f"{destination} {gender_phrase} outfit ideas smart casual travel street style outfit",
        },
        {
            "title": f"{destination} street style",
            "subtitle": "Current travel styling references without splitting by day or night.",
            "query": f"{destination} {gender_phrase} travel street style outfit ideas",
        },
        {
            "title": f"{destination} places",
            "subtitle": "Exact local life, landmarks, streets, and travel mood.",
            "query": place_query,
        },
    ]
    return [{**board, "url": _pinterest_url(board["query"])} for board in boards]


def _pinterest_url(query: str) -> str:
    return f"{PINTEREST_SEARCH_URL}?q={quote_plus(query)}"


def _place_fallback_items(profile: dict[str, Any]) -> list[dict[str, Any]]:
    destination = profile["destination"].lower()
    country = str((profile.get("weather") or {}).get("country") or "").lower()
    raw_items = PLACE_IMAGE_FALLBACKS.get(destination) or PLACE_IMAGE_FALLBACKS.get(country) or []
    return [
        {
            "id": f"place-fallback-{destination}-{index}",
            **item,
        }
        for index, item in enumerate(raw_items)
    ]


def _category_query(profile: dict[str, Any], definition: dict[str, Any], gender: str) -> str:
    destination = profile["destination"]
    weather = profile.get("weather", {})
    temperature = float(weather.get("temperatureC", 26))
    country_code = str(weather.get("countryCode") or "").upper()
    key = destination.lower()
    is_india = country_code == "IN" or key in INDIAN_DESTINATION_KEYS
    gender_phrase = "menswear men" if gender == "men" else "womenswear women"

    if definition["id"] == "places":
        return f"{destination} local life popular places landmarks streets markets"

    if is_india and temperature >= 26:
        if gender == "men":
            outfit_phrase = "summer kurta cotton shirt trousers Indian street style"
        else:
            outfit_phrase = "summer kurti cotton co ord Indian street style"
    elif temperature <= 12:
        outfit_phrase = "winter coat boots layered outfit"
    elif temperature <= 20:
        outfit_phrase = "light jacket trench smart casual outfit"
    elif temperature >= 30:
        outfit_phrase = "linen breathable resort casual outfit"
    else:
        outfit_phrase = "smart casual travel street style outfit"

    if definition["id"] == "night":
        return f"{destination} {gender_phrase} evening nightlife outfit {outfit_phrase}"
    if definition["id"] == "similar":
        return f"{destination} {gender_phrase} outfit ideas {outfit_phrase}"
    return f"{destination} {gender_phrase} day outfit {outfit_phrase}"


def _editorial_items_for_category(profile: dict[str, Any], category_id: str, gender: str) -> list[dict[str, Any]]:
    destination_key = profile["destination"].lower()
    outfit_images = LOCAL_OUTFIT_IMAGES.get(destination_key, [])
    local_image = LOCAL_IMAGES.get(destination_key)
    library = _outfit_library_for_profile(profile, gender)

    if category_id == "day":
        images = outfit_images[:2] or []
        images += library["day"]
        if local_image:
            images.append(local_image)
        return [
            _editorial_item(profile, image_url, index, "Day outfit direction")
            for index, image_url in enumerate(_unique_strings(images))
        ]

    if category_id == "night":
        images = outfit_images[2:] or []
        images += library["night"]
        if local_image:
            images.append(local_image)
        return [
            _editorial_item(profile, image_url, index, "Night outfit direction")
            for index, image_url in enumerate(_unique_strings(images))
        ]

    if category_id == "similar":
        images = library["similar"]
        return [
            _editorial_item(profile, image_url, index, "Similar outfit idea")
            for index, image_url in enumerate(_unique_strings(images))
        ]

    images = ([local_image] if local_image else []) + library["local"]
    return [
        _editorial_item(profile, image_url, index, "Local life reference")
        for index, image_url in enumerate(images)
        if image_url
    ]


def _outfit_library_for_profile(profile: dict[str, Any], gender: str) -> dict[str, list[str]]:
    weather = profile.get("weather", {})
    temperature = float(weather.get("temperatureC", 26))
    rain = int(weather.get("rainProbability", 0))
    country_code = str(weather.get("countryCode") or "").upper()
    destination = profile["destination"].lower()
    is_india = country_code == "IN" or destination in INDIAN_DESTINATION_KEYS
    is_hot = temperature >= 28
    is_cool = temperature <= 20
    is_cold = temperature <= 12

    if gender == "men":
        hot_india = [GLOBAL_OUTFIT_IMAGES["men_kurta"], GLOBAL_OUTFIT_IMAGES["men_streetwear"]]
        hot_global = [GLOBAL_OUTFIT_IMAGES["men_resort"], GLOBAL_OUTFIT_IMAGES["men_streetwear"]]
        cool_global = [GLOBAL_OUTFIT_IMAGES["men_streetwear"], GLOBAL_OUTFIT_IMAGES["men_trench"]]
        cold_global = [GLOBAL_OUTFIT_IMAGES["men_trench"], GLOBAL_OUTFIT_IMAGES["men_streetwear"]]
        evening = [GLOBAL_OUTFIT_IMAGES["men_streetwear"], GLOBAL_OUTFIT_IMAGES["men_kurta"] if is_india else GLOBAL_OUTFIT_IMAGES["men_trench"]]
    else:
        hot_india = [GLOBAL_OUTFIT_IMAGES["women_kurti"], GLOBAL_OUTFIT_IMAGES["women_streetwear"]]
        hot_global = [GLOBAL_OUTFIT_IMAGES["women_resort"], GLOBAL_OUTFIT_IMAGES["women_streetwear"]]
        cool_global = [GLOBAL_OUTFIT_IMAGES["women_streetwear"], GLOBAL_OUTFIT_IMAGES["women_trench"]]
        cold_global = [GLOBAL_OUTFIT_IMAGES["women_trench"], GLOBAL_OUTFIT_IMAGES["women_weather"]]
        evening = [GLOBAL_OUTFIT_IMAGES["women_night"], GLOBAL_OUTFIT_IMAGES["women_kurti"] if is_india else GLOBAL_OUTFIT_IMAGES["women_trench"]]

    if is_hot and is_india:
        day = hot_india
    elif is_hot:
        day = hot_global
    elif is_cold:
        day = cold_global
    elif is_cool:
        day = cool_global
    else:
        day = [GLOBAL_OUTFIT_IMAGES[f"{gender}_streetwear"], GLOBAL_OUTFIT_IMAGES[f"{gender}_day"] if gender == "women" else GLOBAL_OUTFIT_IMAGES["men_streetwear"]]

    if rain >= 45 and not is_hot:
        rain_image = GLOBAL_OUTFIT_IMAGES["women_weather"] if gender == "women" else GLOBAL_OUTFIT_IMAGES["men_trench"]
        day = [rain_image] + day

    similar = _unique_strings(day + evening + hot_india + hot_global)
    local = day[:1]
    return {
        "day": _unique_strings(day)[:6],
        "night": _unique_strings(evening + day)[:6],
        "similar": similar[:6],
        "local": local,
    }


def _fetch_wikimedia(profile: dict[str, Any], limit: int) -> list[dict[str, Any]]:
    destination = profile["destination"]
    destination_key = destination.lower()
    place_aliases = {
        "korea": "South Korea",
        "south korea": "South Korea",
        "portuguese": "Portugal",
    }
    place = place_aliases.get(destination_key, destination)
    signals = " ".join(profile.get("socialSignals", [])[:2])
    queries = [
        f"{place} cityscape architecture landmark travel filetype:bitmap",
        f"{place} street market local life popular places filetype:bitmap",
        f"{destination} {signals} travel filetype:bitmap",
    ]
    items: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    for query in queries:
        try:
            response = requests.get(
                "https://commons.wikimedia.org/w/api.php",
                params={
                    "action": "query",
                    "generator": "search",
                    "gsrsearch": query,
                    "gsrnamespace": 6,
                    "gsrlimit": min(max(limit, 3), 10),
                    "prop": "imageinfo",
                    "iiprop": "url|extmetadata",
                    "iiurlwidth": 900,
                    "format": "json",
                    "origin": "*",
                },
                headers={"User-Agent": "AITravelStylist/0.1 (local development)"},
                timeout=10,
            )
            response.raise_for_status()
            pages = (response.json().get("query") or {}).get("pages") or {}
            for page in pages.values():
                info_list = page.get("imageinfo") or []
                if not info_list:
                    continue
                info = info_list[0]
                image_url = info.get("thumburl") or info.get("url")
                title = str(page.get("title", "")).removeprefix("File:")
                normalized_title = title.lower()
                if (
                    not image_url
                    or image_url in seen_urls
                    or title.lower().endswith((".pdf", ".djvu", ".svg", ".tif", ".tiff", ".webm", ".ogv"))
                    or any(word in normalized_title for word in IGNORED_COMMONS_TITLE_WORDS)
                    or not _is_useful_commons_title(normalized_title, destination)
                ):
                    continue
                metadata = info.get("extmetadata") or {}
                items.append(
                    {
                        "id": f"commons-{page.get('pageid')}",
                        "imageUrl": image_url,
                        "title": title,
                        "photographer": _metadata_value(metadata, "Artist") or "Wikimedia Commons contributor",
                        "sourceUrl": info.get("descriptionurl"),
                        "tags": [destination, next(iter(profile["fashionProfile"]))],
                    }
                )
                seen_urls.add(image_url)
                if len(items) >= limit:
                    return items
        except (requests.RequestException, ValueError, TypeError):
            continue
    return items


def _fetch_pexels(query: str, api_key: str, limit: int) -> list[dict[str, Any]]:
    try:
        response = requests.get(
            PEXELS_SEARCH_URL,
            params={"query": query, "per_page": min(max(limit, 1), 15), "orientation": "portrait"},
            headers={"Authorization": api_key},
            timeout=10,
        )
        response.raise_for_status()
        photos = response.json().get("photos") or []
        return [
            {
                "id": f"pexels-{photo.get('id')}",
                "imageUrl": (photo.get("src") or {}).get("large2x") or (photo.get("src") or {}).get("large"),
                "title": f"{query.title()} inspiration",
                "photographer": photo.get("photographer"),
                "sourceUrl": photo.get("url"),
                "tags": [],
            }
            for photo in photos
            if (photo.get("src") or {}).get("large")
        ]
    except (requests.RequestException, ValueError, TypeError):
        return []


def _is_useful_commons_title(normalized_title: str, destination: str) -> bool:
    if destination.lower() in normalized_title:
        return True
    return any(word in normalized_title for word in COMMONS_PLACE_WORDS)


def _fallback_items(profile: dict[str, Any], limit: int) -> list[dict[str, Any]]:
    destination = profile["destination"]
    key = destination.lower()
    images = LOCAL_OUTFIT_IMAGES.get(key)
    if not images:
        main_image = LOCAL_IMAGES.get(key, "/images/travel-planner-hero.png")
        images = [main_image, "/images/welcome-ocean-hero.png", "/images/travel-planner-hero.png"]
    style_labels = list(profile["fashionProfile"].keys())
    colors = profile["popularColors"]

    return [
        {
            "id": f"editorial-{index + 1}",
            "imageUrl": images[index % len(images)],
            "title": f"{destination} {style_labels[index % len(style_labels)]}",
            "photographer": "Travel Stylist editorial",
            "sourceUrl": None,
            "tags": [style_labels[index % len(style_labels)], colors[index % len(colors)]],
        }
        for index in range(min(limit, len(images)))
    ]


def _editorial_item(
    profile: dict[str, Any],
    image_url: str,
    index: int = 0,
    label: str | None = None,
) -> dict[str, Any]:
    destination = profile["destination"]
    style = next(iter(profile["fashionProfile"]))
    labels = ["Style overview", "Daytime edit", "Evening edit"]
    item_label = label or labels[index % len(labels)]
    return {
        "id": f"editorial-{destination.lower()}-{item_label.lower().replace(' ', '-')}-{index + 1}",
        "imageUrl": image_url,
        "title": f"{destination} {item_label}",
        "photographer": "Travel Stylist editorial",
        "sourceUrl": None,
        "tags": [style, profile["popularColors"][0]],
    }


def _search_query(profile: dict[str, Any]) -> str:
    top_style = next(iter(profile["fashionProfile"]))
    return f"{profile['destination']} {top_style} travel street style outfit"


def _normal_gender(gender: str) -> str:
    value = gender.strip().lower()
    if value in {"men", "man", "male", "boys", "boy"}:
        return "men"
    return "women"


def _metadata_value(metadata: dict[str, Any], key: str) -> str | None:
    value = (metadata.get(key) or {}).get("value")
    if not value:
        return None
    # Commons metadata can contain basic HTML; keep attribution concise.
    plain_text = re.sub(r"<[^>]+>", "", str(value).replace("<br>", " ").replace("<br/>", " "))
    return html.unescape(plain_text).strip()[:120]


def _dedupe_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for item in items:
        image_url = item.get("imageUrl")
        if not image_url or image_url in seen_urls:
            continue
        unique.append(item)
        seen_urls.add(image_url)
    return unique


def _unique_strings(values: list[str]) -> list[str]:
    unique: list[str] = []
    seen: set[str] = set()
    for value in values:
        if value in seen:
            continue
        unique.append(value)
        seen.add(value)
    return unique

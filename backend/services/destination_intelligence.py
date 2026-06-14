from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from typing import Any

from backend.services.weather_service import get_live_weather


DESTINATION_PROFILES: dict[str, dict[str, Any]] = {
    "goa": {
        "displayName": "Goa",
        "seasonalClimate": "Warm coastal weather with high humidity and a casual beach-to-nightlife rhythm.",
        "weather": {
            "temperatureC": 34,
            "humidity": "High",
            "rainProbability": 18,
            "windKph": 16,
            "condition": "Hot and humid",
        },
        "fashionProfile": {
            "Beachwear": 45,
            "Boho Style": 30,
            "Casual Streetwear": 15,
            "Partywear": 10,
        },
        "popularColors": ["White", "Beige", "Sky Blue", "Coral"],
        "recommendedItems": ["Linen shirt", "Cotton shorts", "Sandals", "Sunglasses", "Straw hat"],
        "avoidItems": ["Heavy denim", "Leather jacket", "Thick sneakers"],
        "culturalNotes": [
            "Beachwear is normal near beaches, but keep a cover-up for markets and churches.",
            "Breathable fabrics matter more than formal styling during the day.",
        ],
        "activities": ["Beach parties", "Salsa nights", "EDM festivals", "Sunset cruises"],
        "nightlife": ["Open-air clubs", "Beach shacks", "Live DJ nights"],
        "socialSignals": ["linen co-ords", "white beach shirts", "shell accessories", "sunset reels"],
        "danceCulture": True,
    },
    "rajasthan": {
        "displayName": "Rajasthan",
        "seasonalClimate": "Dry heat by day, cooler evenings, strong sun exposure, and heritage-heavy venues.",
        "weather": {
            "temperatureC": 36,
            "humidity": "Low",
            "rainProbability": 8,
            "windKph": 20,
            "condition": "Dry and sunny",
        },
        "fashionProfile": {
            "Modest Casual": 35,
            "Ethnic Inspired": 30,
            "Resort Linen": 20,
            "Evening Smart": 15,
        },
        "popularColors": ["Ivory", "Marigold", "Indigo", "Terracotta"],
        "recommendedItems": ["Breathable kurta", "Linen trousers", "Scarf", "Sunglasses", "Closed sandals"],
        "avoidItems": ["Overly revealing outfits", "Heavy black layers", "Uncomfortable heels"],
        "culturalNotes": [
            "Choose modest silhouettes around temples, forts, and rural areas.",
            "A scarf or light overshirt helps with sun protection and respectful coverage.",
        ],
        "activities": ["Fort walks", "Desert safaris", "Heritage cafes", "Folk music nights"],
        "nightlife": ["Rooftop lounges", "Cultural performances", "Palace hotel dinners"],
        "socialSignals": ["mirror-work accents", "block print shirts", "desert neutrals", "heritage reels"],
        "danceCulture": False,
    },
    "mumbai": {
        "displayName": "Mumbai",
        "seasonalClimate": "Humid urban weather with fast transitions between streetwear, workwear, and nightlife.",
        "weather": {
            "temperatureC": 31,
            "humidity": "High",
            "rainProbability": 32,
            "windKph": 14,
            "condition": "Warm and humid",
        },
        "fashionProfile": {
            "Streetwear": 35,
            "Smart Casual": 30,
            "Nightlife": 25,
            "Athleisure": 10,
        },
        "popularColors": ["Black", "White", "Denim Blue", "Chrome"],
        "recommendedItems": ["Breathable tee", "Light overshirt", "Sneakers", "Slim jeans", "Rain layer"],
        "avoidItems": ["Thick wool", "Fragile footwear", "Heavy backpacks"],
        "culturalNotes": [
            "Mumbai is style-flexible, but clubs and hotel bars may expect polished footwear.",
            "Carry a light rain layer in monsoon months.",
        ],
        "activities": ["Cafe hopping", "Bollywood nights", "Sea-face walks", "Comedy shows"],
        "nightlife": ["Bandstand bars", "Lower Parel clubs", "Rooftop lounges"],
        "socialSignals": ["black shirts", "clean sneakers", "denim fits", "Bollywood hooks"],
        "danceCulture": True,
    },
    "tokyo": {
        "displayName": "Tokyo",
        "seasonalClimate": "Seasonal city weather with precise styling, comfortable walking, and polished layering.",
        "weather": {
            "temperatureC": 22,
            "humidity": "Medium",
            "rainProbability": 24,
            "windKph": 12,
            "condition": "Mild and changeable",
        },
        "fashionProfile": {
            "Minimal Streetwear": 35,
            "Layered Casual": 30,
            "Techwear": 20,
            "Smart Neutral": 15,
        },
        "popularColors": ["Black", "Charcoal", "White", "Olive"],
        "recommendedItems": ["Layered overshirt", "Relaxed trousers", "Clean sneakers", "Compact umbrella"],
        "avoidItems": ["Loud oversized tourist graphics", "Uncomfortable shoes"],
        "culturalNotes": [
            "Clean, intentional outfits work well across cafes, transit, and nightlife.",
            "Comfortable walking shoes are essential.",
        ],
        "activities": ["Record bars", "Vintage shopping", "Arcades", "Night photography"],
        "nightlife": ["Shibuya clubs", "Listening bars", "Karaoke rooms"],
        "socialSignals": ["wide trousers", "monochrome layers", "mini bags", "city night edits"],
        "danceCulture": True,
    },
    "paris": {
        "displayName": "Paris",
        "seasonalClimate": "Mild urban climate with refined basics, walkable days, and smart evening styling.",
        "weather": {
            "temperatureC": 18,
            "humidity": "Medium",
            "rainProbability": 28,
            "windKph": 15,
            "condition": "Cool and breezy",
        },
        "fashionProfile": {
            "Chic Basics": 40,
            "Tailored Casual": 25,
            "Minimal Evening": 20,
            "Vintage": 15,
        },
        "popularColors": ["Black", "Cream", "Navy", "Red"],
        "recommendedItems": ["Tailored jacket", "Straight trousers", "Loafers", "Light scarf"],
        "avoidItems": ["Flip-flops outside pools", "Bulky athletic wear for dinner"],
        "culturalNotes": [
            "Simple, well-fitted pieces feel natural in restaurants and museums.",
            "Bring a layer for evenings and rain.",
        ],
        "activities": ["Museum walks", "Wine bars", "Vintage markets", "Seine strolls"],
        "nightlife": ["Cocktail bars", "Jazz clubs", "Late bistros"],
        "socialSignals": ["red accent pieces", "trench coats", "loafers", "museum outfit reels"],
        "danceCulture": False,
    },
    "dubai": {
        "displayName": "Dubai",
        "seasonalClimate": "Hot desert climate with modest public styling and elevated eveningwear.",
        "weather": {
            "temperatureC": 38,
            "humidity": "Medium",
            "rainProbability": 3,
            "windKph": 18,
            "condition": "Very hot and dry",
        },
        "fashionProfile": {
            "Luxury Casual": 35,
            "Modest Smart": 30,
            "Resort Wear": 20,
            "Evening Glam": 15,
        },
        "popularColors": ["White", "Gold", "Black", "Sand"],
        "recommendedItems": ["Loose linen shirt", "Wide trousers", "Dress shoes", "Evening blazer"],
        "avoidItems": ["Revealing public outfits", "Heavy daytime layers"],
        "culturalNotes": [
            "Use respectful coverage in malls, public spaces, and cultural sites.",
            "Nightlife styling is more elevated than beach styling.",
        ],
        "activities": ["Desert dinners", "Beach clubs", "Luxury malls", "Skyline lounges"],
        "nightlife": ["Hotel clubs", "Rooftop lounges", "Fine-dining bars"],
        "socialSignals": ["white linen sets", "gold accents", "tailored resort looks", "luxury reels"],
        "danceCulture": True,
    },
    "kashmir": {
        "displayName": "Kashmir",
        "seasonalClimate": "Mountain weather can shift quickly between warm sun, cool shade, rain, and cold evenings.",
        "weather": {
            "temperatureC": 16,
            "humidity": "Medium",
            "rainProbability": 28,
            "windKph": 9,
            "condition": "Cool and changeable",
        },
        "fashionProfile": {
            "Mountain Layers": 40,
            "Modest Casual": 25,
            "Heritage Texture": 20,
            "Outdoor Comfort": 15,
        },
        "popularColors": ["Forest Green", "Cream", "Charcoal", "Burgundy"],
        "recommendedItems": ["Warm knit", "Layered coat", "Comfortable trousers", "Weatherproof shoes", "Scarf"],
        "avoidItems": ["Single thin layer", "Open sandals", "Unprotected evening outfit"],
        "culturalNotes": [
            "Choose comfortable, modest layers for markets, shrines, gardens, and family-run spaces.",
            "Keep one warm outer layer available even when the afternoon feels mild.",
        ],
        "activities": ["Dal Lake rides", "Mountain viewpoints", "Old-city walks", "Garden visits"],
        "nightlife": ["Hotel lounges", "Evening cafes", "Houseboat dinners"],
        "socialSignals": ["layered wool", "earth-tone knits", "embroidered accents", "mountain travel edits"],
        "danceCulture": False,
    },
    "lucknow": {
        "displayName": "Lucknow",
        "seasonalClimate": "Warm plains weather with elegant Awadhi style, breathable fabrics, and modest polished silhouettes.",
        "weather": {
            "temperatureC": 32,
            "humidity": "Medium",
            "rainProbability": 20,
            "windKph": 9,
            "condition": "Warm",
        },
        "fashionProfile": {
            "Chikankari Modern": 40,
            "Modest Smart": 25,
            "Pastel Casual": 20,
            "Evening Ethnic": 15,
        },
        "popularColors": ["Ivory", "Sage", "Dusty Rose", "Pale Blue"],
        "recommendedItems": ["Chikankari top", "Breathable trousers", "Light scarf", "Comfortable flats", "Evening layer"],
        "avoidItems": ["Heavy synthetic layers", "Uncomfortable heels for old-city walks", "Very dark daytime layering"],
        "culturalNotes": [
            "Elegant modest dressing works naturally across Imambara visits, markets, cafes, and family spaces.",
            "Chikankari-inspired pieces and soft pastels connect strongly with Lucknow's visual identity.",
        ],
        "activities": ["Bara Imambara", "Hazratganj walks", "Chowk markets", "Awadhi food trails"],
        "nightlife": ["Rooftop cafes", "Hotel lounges", "Live music evenings"],
        "socialSignals": ["white chikankari", "pastel kurtas", "juttis and flats", "Awadhi architecture edits"],
        "danceCulture": False,
    },
    "kanpur": {
        "displayName": "Kanpur",
        "seasonalClimate": "Warm north Indian city weather with practical streetwear, breathable fabrics, market-friendly shoes, and modest day styling.",
        "weather": {
            "temperatureC": 33,
            "humidity": "Medium",
            "rainProbability": 18,
            "windKph": 10,
            "condition": "Warm",
        },
        "fashionProfile": {
            "Airy Smart Casual": 34,
            "Indian Streetwear": 28,
            "Modest Everyday": 22,
            "Evening Casual": 16,
        },
        "popularColors": ["White", "Sage", "Denim Blue", "Sand"],
        "recommendedItems": ["Cotton kurta", "Linen shirt", "Straight trousers", "Clean sneakers", "Light scarf"],
        "avoidItems": ["Heavy winter coats", "Leather jackets", "Very tight synthetic layers", "Suede shoes in rain"],
        "culturalNotes": [
            "Keep daytime outfits breathable and practical for markets, food spots, campuses, and local travel.",
            "Modest silhouettes, cotton kurtas, shirts, straight trousers, and clean footwear fit naturally across most public spaces.",
        ],
        "activities": ["Z Square area", "Local food trails", "Moti Jheel walks", "Market visits"],
        "nightlife": ["Cafes", "Lounges", "Family restaurants"],
        "socialSignals": ["cotton kurtas", "clean sneakers", "market day outfits", "north India city reels"],
        "danceCulture": False,
    },
}


def analyze_destination(
    destination: str,
    trip_days: int = 4,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict[str, Any]:
    """Return a destination intelligence bundle for the requested city or region."""
    key = destination.strip().lower()
    is_known_destination = key in DESTINATION_PROFILES
    profile = deepcopy(DESTINATION_PROFILES.get(key, _fallback_profile(destination)))
    live_weather = get_live_weather(destination, start_date, end_date)
    if live_weather:
        profile["weather"].update(live_weather)
        if not is_known_destination:
            _adapt_profile_to_weather(profile, live_weather)
    weather = profile["weather"]

    profile["destination"] = profile.pop("displayName")
    profile["tripDays"] = max(1, min(int(trip_days or 4), 21))
    profile["generatedAt"] = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    profile["clothingSuitability"] = _clothing_suitability(weather)
    profile["trendConfidence"] = _trend_confidence(profile)
    profile["heroImage"] = _hero_image(key)
    return profile


def _fallback_profile(destination: str) -> dict[str, Any]:
    cleaned = destination.strip().title() or "Your Destination"
    return {
        "displayName": cleaned,
        "seasonalClimate": "Live weather-led city profile with adaptable layers, comfortable movement, and polished evening options.",
        "weather": {
            "temperatureC": 26,
            "humidity": "Medium",
            "rainProbability": 20,
            "windKph": 10,
            "condition": "Mild",
        },
        "fashionProfile": {
            "Smart Casual": 30,
            "Local Streetwear": 25,
            "Comfort Travel": 25,
            "Evening Wear": 20,
        },
        "popularColors": ["White", "Black", "Blue", "Neutral"],
        "recommendedItems": ["Light jacket", "Straight trousers", "Walking shoes", "Evening shirt", "Compact umbrella"],
        "avoidItems": ["Overpacked luggage", "Uncomfortable footwear", "Weather-blind outfits"],
        "culturalNotes": [
            "Use the weather profile for fabric and layering decisions, then keep silhouettes respectful around religious or formal spaces.",
            "For restaurants and nightlife, carry one sharper layer so daytime comfort can become evening polish.",
        ],
        "activities": ["Local cafes", "Walking tours", "Markets", "Evening food spots"],
        "nightlife": ["Popular bars", "Live music venues"],
        "socialSignals": ["streetwear", "local cafes", "walking outfit", "night market"],
        "danceCulture": False,
    }


def _adapt_profile_to_weather(profile: dict[str, Any], weather: dict[str, Any]) -> None:
    temperature = float(weather.get("temperatureC", 26))
    rain = int(weather.get("rainProbability", 0))
    humidity = str(weather.get("humidity", "Medium"))
    place = weather.get("locationName") or profile["displayName"]
    country = weather.get("country")
    place_label = f"{place}, {country}" if country else str(place)

    if temperature <= 8:
        profile["seasonalClimate"] = f"{place_label} is reading cold right now, so prioritize insulation, weatherproof footwear, and elegant outerwear."
        profile["fashionProfile"] = {
            "Warm Layers": 35,
            "Tailored Outerwear": 25,
            "Weatherproof Casual": 25,
            "Evening Knitwear": 15,
        }
        profile["popularColors"] = ["Charcoal", "Cream", "Navy", "Burgundy"]
        profile["recommendedItems"] = ["Insulated jacket", "Knit sweater", "Thermal base layer", "Weatherproof boots", "Wool scarf"]
        profile["avoidItems"] = ["Open sandals", "Thin linen", "Single-layer evening outfits"]
    elif temperature <= 18:
        profile["seasonalClimate"] = f"{place_label} is cool to mild, so build around smart layers that can move from walking routes to dinner."
        profile["fashionProfile"] = {
            "Light Layers": 34,
            "Tailored Casual": 26,
            "Comfort Travel": 20,
            "Evening Smart": 20,
        }
        profile["popularColors"] = ["Black", "Cream", "Navy", "Olive"]
        profile["recommendedItems"] = ["Trench coat", "Light jacket", "Knit top", "Straight trousers", "Closed-toe shoes"]
        profile["avoidItems"] = ["Beach sandals", "Single thin layer", "Bulky tourist backpacks"]
    elif temperature >= 30:
        profile["seasonalClimate"] = f"{place_label} is warm, with comfort depending on breathable fabrics, sun-aware accessories, and easy evening upgrades."
        profile["fashionProfile"] = {
            "Airy Smart Casual": 32,
            "Resort Linen": 25,
            "Local Streetwear": 23,
            "Light Eveningwear": 20,
        }
        profile["popularColors"] = ["White", "Sage", "Sky Blue", "Sand"]
        profile["recommendedItems"] = ["Linen shirt", "Cotton trousers", "Breathable dress", "Comfortable sandals", "Sunglasses"]
        profile["avoidItems"] = ["Heavy denim", "Leather jackets", "Thick synthetic layers"]
    else:
        profile["seasonalClimate"] = f"{place_label} is mild, so balanced daywear, comfortable shoes, and one polished evening layer will cover most plans."
        profile["fashionProfile"] = {
            "Smart Casual": 32,
            "Local Streetwear": 26,
            "Comfort Travel": 22,
            "Evening Wear": 20,
        }
        profile["popularColors"] = ["White", "Black", "Denim Blue", "Olive"]
        profile["recommendedItems"] = ["Overshirt", "Straight trousers", "Clean sneakers", "Evening shirt", "Light scarf"]
        profile["avoidItems"] = ["Uncomfortable footwear", "Overpacked layers", "Very delicate fabrics"]

    if rain >= 35:
        _prepend_unique(profile["recommendedItems"], ["Water-resistant jacket", "Compact umbrella", "Weatherproof shoes"])
        _prepend_unique(profile["avoidItems"], ["Suede shoes", "Floor-skimming hems"])

    if humidity == "High" and temperature >= 26:
        _prepend_unique(profile["recommendedItems"], ["Moisture-wicking innerwear", "Loose cotton top"])
        _prepend_unique(profile["avoidItems"], ["Tight synthetic tops"])

    profile["socialSignals"] = [
        f"{place} street style",
        f"{place} weather outfit",
        "day to night outfit",
        "local cafe look",
    ]


def _prepend_unique(target: list[str], values: list[str]) -> None:
    for value in reversed(values):
        if value not in target:
            target.insert(0, value)


def _clothing_suitability(weather: dict[str, Any]) -> list[dict[str, Any]]:
    temperature = float(weather["temperatureC"])
    humidity = str(weather["humidity"]).lower()
    rain = int(weather["rainProbability"])

    scores = [
        {
            "label": "Breathable cotton",
            "score": 95 if temperature >= 28 else 75,
            "reason": "Keeps the outfit comfortable in warm weather.",
        },
        {
            "label": "Linen",
            "score": 96 if temperature >= 30 or humidity == "high" else 78,
            "reason": "Strong pick for heat and humidity.",
        },
        {
            "label": "Heavy denim",
            "score": 32 if temperature >= 30 else 70,
            "reason": "Can feel restrictive in heat.",
        },
        {
            "label": "Rain layer",
            "score": 88 if rain >= 25 else 45,
            "reason": "Useful when rain probability is meaningful.",
        },
        {
            "label": "Leather jacket",
            "score": 20 if temperature >= 28 else 80,
            "reason": "Better for cool evenings than hot daytime travel.",
        },
    ]
    return scores


def _trend_confidence(profile: dict[str, Any]) -> int:
    signal_count = len(profile.get("socialSignals", []))
    activity_count = len(profile.get("activities", []))
    return min(95, 55 + signal_count * 6 + activity_count * 4)


def _hero_image(key: str) -> str:
    if key in {"goa", "paris", "kashmir", "lucknow"}:
        return f"/images/inspiration-{key}.png"
    return "/images/travel-planner-hero.png"

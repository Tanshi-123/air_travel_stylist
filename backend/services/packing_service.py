from __future__ import annotations

from typing import Any

from backend.services.destination_intelligence import analyze_destination


def generate_packing_list(
    destination: str,
    trip_days: int = 4,
    start_date: str | None = None,
    end_date: str | None = None,
    gender: str = "women",
) -> dict[str, Any]:
    profile = analyze_destination(destination, trip_days, start_date, end_date)
    days = profile["tripDays"]
    selected_gender = _normal_gender(gender)
    hot = profile["weather"]["temperatureC"] >= 30
    rainy = profile["weather"]["rainProbability"] >= 25
    cold = profile["weather"]["temperatureC"] <= 12
    cool = profile["weather"]["temperatureC"] <= 20
    humid = str(profile["weather"].get("humidity", "")).lower() == "high"
    dance = bool(profile["danceCulture"])
    destination_key = profile["destination"].lower()
    is_india = str(profile["weather"].get("countryCode") or "").upper() == "IN" or destination_key in {
        "goa",
        "rajasthan",
        "mumbai",
        "lucknow",
        "kanpur",
        "kashmir",
    }
    is_resort_or_beach = destination_key in {"goa", "dubai"} or "beach" in " ".join(profile["activities"]).lower()

    clothing = [
        f"{min(days, 5)} day tops",
        f"{max(2, days // 2)} bottoms",
        "1 evening outfit",
        "Sleepwear",
        "Undergarments",
    ]
    if hot:
        if is_india:
            clothing.extend([
                "Breathable cotton or linen set",
                "Extra cotton kurta/shirt",
                "Light overshirt or scarf",
            ])
            if selected_gender == "women":
                clothing.append("Cotton kurti or easy day dress")
            else:
                clothing.append("Cotton kurta or linen shirt")
        else:
            clothing.extend(["Breathable cotton or linen set", "Light overshirt"])
        if is_resort_or_beach:
            clothing.append("Swimwear or resort layer")
    if cool:
        clothing.extend(["Knit or mid-layer", "Light jacket"])
    if cold:
        clothing.extend(["Thermal base layer", "Warm coat"])
    if rainy:
        clothing.append("Rain-safe outfit option")

    accessories = ["Sunglasses", "Reusable water bottle", "Crossbody/day bag", "Watch or simple jewelry"]
    if hot:
        accessories.extend(["Sunscreen", "Hat"])
    if humid:
        accessories.extend(["Anti-frizz hair tie/clip", "Blotting tissues"])
    if dance:
        accessories.append("Comfortable dance-friendly shoes")

    weather_ready = []
    if rainy:
        weather_ready.extend(["Compact umbrella", "Water-resistant jacket", "Weatherproof shoes", "Zip pouch for phone"])
    if hot:
        weather_ready.extend(["SPF 50 sunscreen", "After-sun or aloe gel", "Electrolyte sachets"])
    if cool:
        weather_ready.extend(["Light scarf", "Layering socks"])
    if cold:
        weather_ready.extend(["Gloves", "Warm socks"])
    if not weather_ready:
        weather_ready.extend(["Small umbrella", "Light layer", "Comfortable walking shoes"])

    toiletries = [
        "Toothbrush and toothpaste",
        "Skincare basics",
        "Deodorant",
        "Mini perfume/body mist",
        "Prescription medicines",
    ]
    if hot or humid:
        toiletries.extend(["Face wipes", "Sweat-proof sunscreen"])

    tech = ["Phone charger", "Power bank", "Universal adapter", "Earphones", "Offline maps downloaded"]

    return {
        "destination": profile["destination"],
        "gender": selected_gender,
        "tripDays": days,
        "clothing": clothing,
        "accessories": accessories,
        "weatherReady": _dedupe(weather_ready),
        "toiletries": _dedupe(toiletries),
        "tech": tech,
        "documents": ["ID proof", "Tickets", "Hotel booking", "Payment cards", "Emergency contact", "Travel insurance if needed"],
        "localPrep": profile["activities"][:4] + profile["nightlife"][:2],
    }


def _dedupe(items: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for item in items:
        key = item.lower()
        if key in seen:
            continue
        result.append(item)
        seen.add(key)
    return result


def _normal_gender(gender: str) -> str:
    value = str(gender or "").strip().lower()
    if value in {"men", "man", "male", "boys", "boy"}:
        return "men"
    return "women"

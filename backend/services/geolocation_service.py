from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

import requests


NOMINATIM_REVERSE_URL = os.getenv(
    "NOMINATIM_REVERSE_URL",
    "https://nominatim.openstreetmap.org/reverse",
)
GEOCODING_USER_AGENT = os.getenv(
    "GEOCODING_USER_AGENT",
    "AITravelStylist/0.1 (local development)",
)


def reverse_geocode(latitude: float, longitude: float) -> dict[str, Any]:
    lat = _bounded_coordinate(latitude, -90, 90, "latitude")
    lon = _bounded_coordinate(longitude, -180, 180, "longitude")
    return _reverse_geocode_cached(round(lat, 4), round(lon, 4))


@lru_cache(maxsize=256)
def _reverse_geocode_cached(latitude: float, longitude: float) -> dict[str, Any]:
    fallback = _coordinate_fallback(latitude, longitude)
    try:
        response = requests.get(
            NOMINATIM_REVERSE_URL,
            params={
                "format": "jsonv2",
                "lat": latitude,
                "lon": longitude,
                "zoom": 13,
                "addressdetails": 1,
                "layer": "address",
            },
            headers={
                "User-Agent": GEOCODING_USER_AGENT,
                "Accept-Language": "en",
            },
            timeout=8,
        )
        response.raise_for_status()
        payload = response.json()
        address = payload.get("address") or {}

        city = _first_value(
            address,
            "city",
            "town",
            "village",
            "municipality",
            "county",
        )
        district = _first_value(
            address,
            "suburb",
            "neighbourhood",
            "city_district",
            "state_district",
        )
        state = _first_value(address, "state", "region", "province")
        country = address.get("country")
        label_parts = _unique_nonempty([district, city, state, country])
        short_parts = _unique_nonempty([city, state, country])

        return {
            "resolved": True,
            "latitude": latitude,
            "longitude": longitude,
            "label": ", ".join(label_parts) or payload.get("display_name") or fallback["label"],
            "shortLabel": ", ".join(short_parts) or fallback["shortLabel"],
            "city": city,
            "district": district,
            "state": state,
            "country": country,
            "countryCode": str(address.get("country_code", "")).upper(),
            "postcode": address.get("postcode"),
            "areaParts": _unique_nonempty([district, city, state, country]),
            "mapUrl": f"https://www.openstreetmap.org/?mlat={latitude}&mlon={longitude}#map=13/{latitude}/{longitude}",
            "provider": "OpenStreetMap Nominatim",
            "attribution": "Data (c) OpenStreetMap contributors",
        }
    except (requests.RequestException, ValueError, TypeError):
        return fallback


def _coordinate_fallback(latitude: float, longitude: float) -> dict[str, Any]:
    coordinates = f"{latitude:.4f}, {longitude:.4f}"
    return {
        "resolved": False,
        "latitude": latitude,
        "longitude": longitude,
        "label": coordinates,
        "shortLabel": coordinates,
        "city": None,
        "district": None,
        "state": None,
        "country": None,
        "countryCode": "",
        "postcode": None,
        "areaParts": [],
        "mapUrl": f"https://www.openstreetmap.org/?mlat={latitude}&mlon={longitude}#map=13/{latitude}/{longitude}",
        "provider": "Browser GPS",
        "attribution": "Coordinates detected on this device",
    }


def _bounded_coordinate(value: Any, minimum: float, maximum: float, label: str) -> float:
    try:
        coordinate = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid {label}.") from exc
    if not minimum <= coordinate <= maximum:
        raise ValueError(f"{label.title()} is outside its valid range.")
    return coordinate


def _first_value(address: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = address.get(key)
        if value:
            return str(value)
    return None


def _unique_nonempty(values: list[str | None]) -> list[str]:
    result = []
    for value in values:
        if value and value not in result:
            result.append(value)
    return result

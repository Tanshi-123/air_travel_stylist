from __future__ import annotations

import time
from datetime import date
from typing import Any
from urllib.parse import quote

import requests


GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
WTTR_URL = "https://wttr.in/{query}"
WEATHER_CACHE_TTL_SECONDS = 15 * 60
_WEATHER_CACHE: dict[str, tuple[float, dict[str, Any] | None]] = {}

# These are only corrections for broad region names that geocoders often resolve poorly.
# Every other user input still goes through live geocoding and weather lookup.
DESTINATION_ALIASES = {
    "kashmir": "Srinagar",
    "rajasthan": "Jaipur",
    "goa": "Panaji",
    "ladakh": "Leh",
    "leh ladakh": "Leh",
    "meghalaya": "Shillong",
    "korea": "Seoul",
    "south korea": "Seoul",
}

DESTINATION_COORDINATES: dict[str, dict[str, Any]] = {
    "ladakh": {
        "name": "Leh",
        "admin1": "Ladakh",
        "country": "India",
        "country_code": "IN",
        "latitude": 34.1526,
        "longitude": 77.5771,
    },
    "leh": {
        "name": "Leh",
        "admin1": "Ladakh",
        "country": "India",
        "country_code": "IN",
        "latitude": 34.1526,
        "longitude": 77.5771,
    },
    "leh ladakh": {
        "name": "Leh",
        "admin1": "Ladakh",
        "country": "India",
        "country_code": "IN",
        "latitude": 34.1526,
        "longitude": 77.5771,
    },
    "meghalaya": {
        "name": "Shillong",
        "admin1": "Meghalaya",
        "country": "India",
        "country_code": "IN",
        "latitude": 25.5788,
        "longitude": 91.8933,
    },
    "cherrapunji": {
        "name": "Cherrapunji",
        "admin1": "Meghalaya",
        "country": "India",
        "country_code": "IN",
        "latitude": 25.2841,
        "longitude": 91.7257,
    },
}


def get_live_weather(destination: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any] | None:
    raw_query = destination.strip()
    query = DESTINATION_ALIASES.get(raw_query.lower(), raw_query)
    if not query:
        return None
    start_date, end_date = _validated_dates(start_date, end_date)
    cache_key = f"{raw_query.lower()}|{query.lower()}|{start_date or ''}|{end_date or ''}"
    cached = _WEATHER_CACHE.get(cache_key)
    now = time.time()
    if cached and now - cached[0] < WEATHER_CACHE_TTL_SECONDS:
        return cached[1]
    result = _fetch_live_weather(query.lower(), start_date, end_date, raw_query.lower())
    if result is None:
        result = _fetch_wttr_weather(query.lower(), raw_query.lower())
    _WEATHER_CACHE[cache_key] = (now, result)
    return result


def _fetch_live_weather(query: str, start_date: str | None, end_date: str | None, raw_query: str = "") -> dict[str, Any] | None:
    try:
        place = DESTINATION_COORDINATES.get(raw_query) or DESTINATION_COORDINATES.get(query)
        if not place:
            place_response = requests.get(
                GEOCODING_URL,
                params={"name": query, "count": 8, "language": "en", "format": "json"},
                timeout=8,
            )
            place_response.raise_for_status()
            results = place_response.json().get("results") or []
            if not results:
                return None
            place = _best_place_match(results, query)

        weather_params = {
                "latitude": place["latitude"],
                "longitude": place["longitude"],
                "current": ",".join(
                    [
                        "temperature_2m",
                        "relative_humidity_2m",
                        "apparent_temperature",
                        "precipitation",
                        "weather_code",
                        "cloud_cover",
                        "wind_speed_10m",
                    ]
                ),
                "daily": ",".join(
                    [
                        "weather_code",
                        "temperature_2m_max",
                        "temperature_2m_min",
                        "precipitation_probability_max",
                        "uv_index_max",
                        "sunrise",
                        "sunset",
                    ]
                ),
                "timezone": "auto",
        }
        if start_date and end_date:
            weather_params["start_date"] = start_date
            weather_params["end_date"] = end_date
        else:
            weather_params["forecast_days"] = 7

        weather_response = requests.get(
            FORECAST_URL,
            params=weather_params,
            timeout=10,
        )
        weather_response.raise_for_status()
        payload = weather_response.json()
        current = payload.get("current") or {}
        daily = payload.get("daily") or {}
        humidity_percent = int(round(float(current.get("relative_humidity_2m", 0))))
        weather_code = int(current.get("weather_code", 0))

        forecast = _daily_forecast(daily)
        forecast_highs = [day["highC"] for day in forecast if day["highC"] is not None]
        forecast_lows = [day["lowC"] for day in forecast if day["lowC"] is not None]
        forecast_rains = [day["rainProbability"] for day in forecast if day["rainProbability"] is not None]
        selected_forecast = bool(start_date and end_date and forecast)
        summary_high = round(max(forecast_highs), 1) if forecast_highs else _first_number(daily.get("temperature_2m_max"))
        summary_low = round(min(forecast_lows), 1) if forecast_lows else _first_number(daily.get("temperature_2m_min"))
        current_temp = _rounded(current.get("temperature_2m"))
        summary_rain = int(max(forecast_rains)) if forecast_rains else _first_int(daily.get("precipitation_probability_max"))
        summary_code = int(_first_number(daily.get("weather_code"))) if selected_forecast else weather_code

        return {
            "locationName": place.get("name"),
            "adminArea": place.get("admin1"),
            "country": place.get("country"),
            "countryCode": place.get("country_code"),
            "latitude": place.get("latitude"),
            "longitude": place.get("longitude"),
            "timezone": payload.get("timezone"),
            "temperatureC": current_temp,
            "feelsLikeC": _rounded(current.get("apparent_temperature")),
            "humidity": _humidity_label(humidity_percent),
            "humidityPercent": humidity_percent,
            "rainProbability": summary_rain,
            "precipitationMm": _rounded(current.get("precipitation")),
            "windKph": _rounded(current.get("wind_speed_10m")),
            "cloudCoverPercent": int(round(float(current.get("cloud_cover", 0)))),
            "condition": _weather_condition(summary_code),
            "weatherCode": summary_code,
            "highC": summary_high,
            "lowC": summary_low,
            "uvIndex": _first_number(daily.get("uv_index_max")),
            "sunrise": _first_value(daily.get("sunrise")),
            "sunset": _first_value(daily.get("sunset")),
            "forecast": forecast,
            "forecastStartDate": start_date,
            "forecastEndDate": end_date,
            "source": "Open-Meteo",
            "isLive": True,
            "temperatureBasis": "Current live temperature at resolved destination coordinates",
        }
    except (requests.RequestException, ValueError, TypeError, KeyError):
        return None


def _fetch_wttr_weather(query: str, raw_query: str = "") -> dict[str, Any] | None:
    try:
        place = DESTINATION_COORDINATES.get(raw_query) or DESTINATION_COORDINATES.get(query)
        wttr_query = f"{place['latitude']},{place['longitude']}" if place else query
        response = requests.get(
            WTTR_URL.format(query=quote(str(wttr_query), safe=",")),
            params={"format": "j1"},
            timeout=10,
            headers={"User-Agent": "ai-travel-stylist-weather/1.0"},
        )
        response.raise_for_status()
        payload = response.json()
        current = (payload.get("current_condition") or [{}])[0]
        nearest = (payload.get("nearest_area") or [{}])[0]
        weather = (payload.get("weather") or [{}])[0]
        hourly = (weather.get("hourly") or [{}])[0]
        resolved_name = place.get("name") if place else _wttr_value(nearest.get("areaName")) or query.title()
        country = place.get("country") if place else _wttr_value(nearest.get("country"))
        admin = place.get("admin1") if place else _wttr_value(nearest.get("region"))
        condition = _wttr_value(current.get("weatherDesc")) or "Live weather"

        return {
            "locationName": resolved_name,
            "adminArea": admin,
            "country": country,
            "countryCode": place.get("country_code") if place else None,
            "latitude": place.get("latitude") if place else _optional_rounded(_wttr_value(nearest.get("latitude"))),
            "longitude": place.get("longitude") if place else _optional_rounded(_wttr_value(nearest.get("longitude"))),
            "timezone": None,
            "temperatureC": _rounded(current.get("temp_C")),
            "feelsLikeC": _rounded(current.get("FeelsLikeC")),
            "humidity": _humidity_label(int(float(current.get("humidity") or 0))),
            "humidityPercent": int(float(current.get("humidity") or 0)),
            "rainProbability": int(float(hourly.get("chanceofrain") or 0)),
            "precipitationMm": _rounded(current.get("precipMM")),
            "windKph": _rounded(current.get("windspeedKmph")),
            "cloudCoverPercent": int(float(current.get("cloudcover") or 0)),
            "condition": condition,
            "weatherCode": None,
            "highC": _rounded(weather.get("maxtempC")),
            "lowC": _rounded(weather.get("mintempC")),
            "uvIndex": _optional_rounded(current.get("uvIndex")),
            "sunrise": _wttr_value((weather.get("astronomy") or [{}])[0].get("sunrise")),
            "sunset": _wttr_value((weather.get("astronomy") or [{}])[0].get("sunset")),
            "forecast": _wttr_forecast(payload.get("weather") or []),
            "forecastStartDate": None,
            "forecastEndDate": None,
            "source": "wttr.in",
            "isLive": True,
            "temperatureBasis": "Current live temperature at resolved destination coordinates",
        }
    except (requests.RequestException, ValueError, TypeError, KeyError, IndexError):
        return None


def _wttr_value(value: Any) -> str | None:
    if isinstance(value, list) and value:
        first = value[0]
        if isinstance(first, dict):
            return str(first.get("value") or "") or None
        return str(first)
    if value is None:
        return None
    return str(value)


def _wttr_forecast(days: list[dict[str, Any]]) -> list[dict[str, Any]]:
    forecast = []
    for day in days:
        hourly = (day.get("hourly") or [{}])[0]
        condition = _wttr_value(hourly.get("weatherDesc")) or "Live weather"
        forecast.append(
            {
                "date": day.get("date"),
                "highC": _optional_rounded(day.get("maxtempC")),
                "lowC": _optional_rounded(day.get("mintempC")),
                "rainProbability": _optional_int(hourly.get("chanceofrain")),
                "uvIndex": _optional_rounded(day.get("uvIndex")),
                "condition": condition,
            }
        )
    return forecast


def _best_place_match(results: list[dict[str, Any]], query: str) -> dict[str, Any]:
    normalized_query = query.lower().strip()
    india_bias = {
        "ladakh",
        "leh",
        "meghalaya",
        "shimla",
        "jaipur",
        "lucknow",
        "goa",
        "kashmir",
    }

    def score(place: dict[str, Any]) -> int:
        name = str(place.get("name") or "").lower()
        admin = str(place.get("admin1") or "").lower()
        country_code = str(place.get("country_code") or "").upper()
        country = str(place.get("country") or "").lower()
        value = 0
        if name == normalized_query:
            value += 80
        if normalized_query in name:
            value += 35
        if normalized_query in admin:
            value += 30
        if country_code == "IN" and normalized_query in india_bias:
            value += 25
        if country == "india" and normalized_query in india_bias:
            value += 20
        value += min(int(place.get("population") or 0) // 100000, 20)
        return value

    return max(results, key=score)


def _rounded(value: Any) -> float:
    return round(float(value or 0), 1)


def _first_number(values: Any) -> float:
    if isinstance(values, list) and values:
        return _rounded(values[0])
    return 0.0


def _first_int(values: Any) -> int:
    return int(round(_first_number(values)))


def _first_value(values: Any) -> str | None:
    if isinstance(values, list) and values:
        return str(values[0])
    return None


def _daily_forecast(daily: dict[str, Any]) -> list[dict[str, Any]]:
    dates = daily.get("time") or []
    highs = daily.get("temperature_2m_max") or []
    lows = daily.get("temperature_2m_min") or []
    rains = daily.get("precipitation_probability_max") or []
    uvs = daily.get("uv_index_max") or []
    codes = daily.get("weather_code") or []
    result = []
    for index, day in enumerate(dates):
        code = _index_value(codes, index)
        result.append(
            {
                "date": day,
                "highC": _optional_rounded(_index_value(highs, index)),
                "lowC": _optional_rounded(_index_value(lows, index)),
                "rainProbability": _optional_int(_index_value(rains, index)),
                "uvIndex": _optional_rounded(_index_value(uvs, index)),
                "condition": _weather_condition(int(code or 0)),
            }
        )
    return result


def _index_value(values: Any, index: int) -> Any:
    if isinstance(values, list) and index < len(values):
        return values[index]
    return None


def _optional_rounded(value: Any) -> float | None:
    if value is None:
        return None
    return _rounded(value)


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None
    return int(round(float(value)))


def _validated_dates(start_date: str | None, end_date: str | None) -> tuple[str | None, str | None]:
    if not start_date or not end_date:
        return None, None
    try:
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)
    except ValueError:
        return None, None
    if end < start or (end - start).days > 6:
        return None, None
    return start.isoformat(), end.isoformat()


def _humidity_label(percent: int) -> str:
    if percent >= 70:
        return "High"
    if percent <= 40:
        return "Low"
    return "Medium"


def _weather_condition(code: int) -> str:
    if code == 0:
        return "Clear sky"
    if code in {1, 2}:
        return "Partly cloudy"
    if code == 3:
        return "Overcast"
    if code in {45, 48}:
        return "Foggy"
    if code in {51, 53, 55, 56, 57}:
        return "Drizzle"
    if code in {61, 63, 65, 66, 67, 80, 81, 82}:
        return "Rain"
    if code in {71, 73, 75, 77, 85, 86}:
        return "Snow"
    if code in {95, 96, 99}:
        return "Thunderstorms"
    return "Mixed conditions"

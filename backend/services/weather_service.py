from __future__ import annotations

import time
from datetime import date
from typing import Any

import requests


GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
WEATHER_CACHE_TTL_SECONDS = 15 * 60
_WEATHER_CACHE: dict[str, tuple[float, dict[str, Any] | None]] = {}

DESTINATION_ALIASES = {
    "kashmir": "Srinagar",
    "rajasthan": "Jaipur",
    "goa": "Panaji",
    "korea": "Seoul",
    "south korea": "Seoul",
}


def get_live_weather(destination: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any] | None:
    query = DESTINATION_ALIASES.get(destination.strip().lower(), destination.strip())
    if not query:
        return None
    start_date, end_date = _validated_dates(start_date, end_date)
    cache_key = f"{query.lower()}|{start_date or ''}|{end_date or ''}"
    cached = _WEATHER_CACHE.get(cache_key)
    now = time.time()
    if cached and now - cached[0] < WEATHER_CACHE_TTL_SECONDS:
        return cached[1]
    result = _fetch_live_weather(query.lower(), start_date, end_date)
    _WEATHER_CACHE[cache_key] = (now, result)
    return result


def _fetch_live_weather(query: str, start_date: str | None, end_date: str | None) -> dict[str, Any] | None:
    try:
        place_response = requests.get(
            GEOCODING_URL,
            params={"name": query, "count": 1, "language": "en", "format": "json"},
            timeout=8,
        )
        place_response.raise_for_status()
        results = place_response.json().get("results") or []
        if not results:
            return None
        place = results[0]

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
        summary_temp = round((summary_high + summary_low) / 2, 1) if selected_forecast else _rounded(current.get("temperature_2m"))
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
            "temperatureC": summary_temp,
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
        }
    except (requests.RequestException, ValueError, TypeError, KeyError):
        return None


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

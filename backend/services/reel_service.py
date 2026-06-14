from __future__ import annotations

from typing import Any
from urllib.parse import quote_plus

from backend.services.destination_intelligence import analyze_destination


def get_reel_studio(destination: str, gender: str = "women") -> dict[str, Any]:
    profile = analyze_destination(destination)
    place = profile["destination"]
    signals = profile.get("socialSignals", [])
    activities = profile.get("activities", [])
    nightlife = profile.get("nightlife", [])
    dance_enabled = bool(profile.get("danceCulture"))

    hashtags = _hashtags(place, profile, gender)
    audio_ideas = _audio_ideas(place, signals, dance_enabled, hashtags)
    content_ideas = _content_ideas(place, activities, nightlife, signals)

    return {
        "destination": place,
        "sourcePolicy": (
            "Uses destination hashtag pages and platform searches for current public reels. "
            "Direct private-platform scraping is not used."
        ),
        "hashtags": hashtags,
        "platforms": _platforms(place, hashtags),
        "audioIdeas": audio_ideas,
        "contentIdeas": content_ideas,
    }


def _audio_ideas(place: str, signals: list[str], dance_enabled: bool, hashtags: list[str]) -> list[dict[str, Any]]:
    signal_text = " ".join(signals[:2]) or "travel outfit"
    primary_tag = hashtags[0] if hashtags else place.replace(" ", "")
    base_queries = [
        {
            "title": f"#{primary_tag} outfit transition",
            "mood": "Before-after wardrobe reveal",
            "query": f"#{primary_tag} outfit transition reel audio {signal_text}",
        },
        {
            "title": f"#{primary_tag} local-life montage",
            "mood": "Walking shots, cafes, markets, landmarks",
            "query": f"#{primary_tag} travel montage trending sound",
        },
        {
            "title": f"#{primary_tag} GRWM travel",
            "mood": "Packing, skincare, outfit, door-exit shot",
            "query": f"GRWM travel #{primary_tag} trending reel song",
        },
        {
            "title": f"#{primary_tag} night-out transition",
            "mood": "Day look to dinner or nightlife outfit",
            "query": f"#{primary_tag} nightlife transition reel audio",
        },
    ]
    if dance_enabled:
        base_queries.insert(
            1,
            {
                "title": f"#{primary_tag} hook-step sound",
                "mood": "Dance challenge or nightlife reel",
                "query": f"#{primary_tag} dance hook step trending sound",
            },
        )

    return [
        {
            **idea,
            "links": _platform_links(idea["query"]),
        }
        for idea in base_queries
    ]


def _content_ideas(place: str, activities: list[str], nightlife: list[str], signals: list[str]) -> list[dict[str, Any]]:
    first_activity = activities[0] if activities else "local street"
    second_activity = activities[1] if len(activities) > 1 else "cafe"
    night_plan = nightlife[0] if nightlife else "evening walk"
    signal = signals[0] if signals else "local outfit"

    return [
        {
            "title": "Outfit check in motion",
            "prompt": f"Start with shoes, pan upward to the full outfit, then cut to {first_activity}.",
            "caption": f"{place} fit check: styled for {signal}.",
        },
        {
            "title": "Local life mini-vlog",
            "prompt": f"Three quick clips: street detail, {second_activity}, food/drink close-up.",
            "caption": f"A little {place} rhythm before the main plan.",
        },
        {
            "title": "Day to night switch",
            "prompt": f"Snap transition from daytime walking look to {night_plan} outfit.",
            "caption": f"{place} day-to-night, but make it wearable.",
        },
        {
            "title": "Packing reveal",
            "prompt": "Flat-lay three key pieces, then wear the final look in a mirror or doorway shot.",
            "caption": f"What I packed for {place}.",
        },
    ]


def _platforms(place: str, hashtags: list[str]) -> list[dict[str, str]]:
    primary_tag = hashtags[0] if hashtags else _tagify(place)
    query = quote_plus(f"#{primary_tag} travel outfit reel")
    return [
        {"name": "Instagram hashtag", "url": f"https://www.instagram.com/explore/tags/{primary_tag}/"},
        {"name": "TikTok hashtag", "url": f"https://www.tiktok.com/tag/{primary_tag}"},
        {"name": "YouTube Shorts", "url": f"https://www.youtube.com/results?search_query={query}+shorts"},
        {"name": "Snapchat Spotlight", "url": "https://www.snapchat.com/spotlight"},
        {"name": "Pinterest outfit ideas", "url": f"https://www.pinterest.com/search/pins/?q={query}"},
    ]


def _platform_links(query: str) -> list[dict[str, str]]:
    tag = _first_hashtag(query)
    encoded = quote_plus(query)
    return [
        {"platform": "Instagram", "url": f"https://www.instagram.com/explore/tags/{tag}/" if tag else f"https://www.instagram.com/explore/search/keyword/?q={encoded}"},
        {"platform": "TikTok", "url": f"https://www.tiktok.com/tag/{tag}" if tag else f"https://www.tiktok.com/search?q={encoded}"},
        {"platform": "YouTube Shorts", "url": f"https://www.youtube.com/results?search_query={encoded}+shorts"},
        {"platform": "Snapchat", "url": "https://www.snapchat.com/spotlight"},
    ]


def _hashtags(place: str, profile: dict[str, Any], gender: str) -> list[str]:
    base = _tagify(place)
    country = _tagify(str((profile.get("weather") or {}).get("country") or ""))
    activity_tags = [_tagify(item) for item in profile.get("activities", [])[:2]]
    nightlife_tags = [_tagify(item) for item in profile.get("nightlife", [])[:2]]
    gender_tag = "mensfashion" if gender.lower() in {"men", "male", "boys"} else "womensfashion"
    tags = [
        base,
        f"{base}diaries",
        f"{base}reels",
        f"{base}travel",
        f"{base}nightlife",
        f"{base}outfit",
        f"{country}travel" if country and country != base else "",
        gender_tag,
        *activity_tags,
        *nightlife_tags,
    ]
    return _unique_tags(tags)


def _tagify(value: str) -> str:
    return "".join(character.lower() for character in value if character.isalnum())


def _first_hashtag(query: str) -> str:
    for part in query.split():
        if part.startswith("#"):
            return _tagify(part[1:])
    return ""


def _unique_tags(tags: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        if not tag or tag in seen:
            continue
        result.append(tag)
        seen.add(tag)
    return result[:10]

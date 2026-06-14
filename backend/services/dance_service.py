from __future__ import annotations

from typing import Any

from backend.services.destination_intelligence import analyze_destination


def get_dance_plan(destination: str) -> dict[str, Any]:
    profile = analyze_destination(destination)
    if not profile["danceCulture"]:
        return {
            "destination": profile["destination"],
            "enabled": False,
            "message": "Dance coaching is optional here. Focus on local etiquette, food, and cultural activities.",
            "tutorial": [],
            "recommendedModel": "MediaPipe Pose or MoveNet when you add camera training.",
        }

    hooks = {
        "Goa": ["Basic side step", "Shoulder roll", "Beach salsa turn", "Freestyle finish"],
        "Mumbai": ["Bollywood hand frame", "Hip step", "Shoulder pop", "Hook-step repeat"],
        "Tokyo": ["K-pop/J-pop count step", "Arm sweep", "Foot tap", "Pose hold"],
        "Dubai": ["Club two-step", "Arm wave", "Turn prep", "Beat drop pose"],
    }
    steps = hooks.get(profile["destination"], ["Two-step base", "Arm sweep", "Foot switch", "Pose hold"])
    return {
        "destination": profile["destination"],
        "enabled": True,
        "message": "Nightlife and short-video culture are strong enough to unlock practice mode.",
        "tutorial": [
            {"count": index + 1, "name": step, "feedbackCue": _feedback_for_step(step)}
            for index, step in enumerate(steps)
        ],
        "recommendedModel": "MediaPipe Pose for web/mobile MVP, MoveNet Thunder for higher accuracy.",
    }


def evaluate_pose(reference: dict[str, float], observed: dict[str, float]) -> dict[str, Any]:
    """Compare normalized pose angles from a client-side pose model."""
    if not reference or not observed:
        return {"accuracy": 0, "feedback": ["Send reference and observed joint angles."]}

    total_error = 0.0
    feedback = []
    compared = 0
    for joint, target_angle in reference.items():
        if joint not in observed:
            feedback.append(f"{joint}: not visible")
            continue
        error = abs(float(observed[joint]) - float(target_angle))
        total_error += min(error, 90)
        compared += 1
        if error <= 12:
            feedback.append(f"{joint}: correct")
        elif observed[joint] < target_angle:
            feedback.append(f"{joint}: open the angle more")
        else:
            feedback.append(f"{joint}: bend the angle more")

    if compared == 0:
        return {"accuracy": 0, "feedback": feedback}

    average_error = total_error / compared
    accuracy = round(max(0, 100 - average_error))
    return {"accuracy": accuracy, "feedback": feedback}


def _feedback_for_step(step: str) -> str:
    lowered = step.lower()
    if "arm" in lowered or "hand" in lowered:
        return "Keep wrists visible and elbows soft."
    if "foot" in lowered or "step" in lowered:
        return "Place feet on the beat before adding upper-body movement."
    if "turn" in lowered:
        return "Spot your head first, then rotate shoulders."
    return "Hold the final shape for one beat."

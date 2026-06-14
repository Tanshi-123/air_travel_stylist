from __future__ import annotations

import sys
import os
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request, send_from_directory

try:
    from flask_cors import CORS
except ImportError:  # pragma: no cover - keeps the app importable before deps are installed
    CORS = None


if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parents[1]))

from backend.services.dance_service import evaluate_pose, get_dance_plan
from backend.services.destination_intelligence import analyze_destination
from backend.services.geolocation_service import reverse_geocode
from backend.services.inspiration_service import get_destination_inspiration
from backend.services.outfit_service import generate_outfits
from backend.services.packing_service import generate_packing_list
from backend.services.reel_service import get_reel_studio
from backend.services.wardrobe_service import UPLOAD_DIR, clear_wardrobe, delete_wardrobe_item, init_schema, list_wardrobe, save_uploaded_item, seed_demo_wardrobe, update_wardrobe_item


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024
    if CORS:
        CORS(app, resources={r"/api/*": {"origins": "*"}})

    init_schema()

    @app.get("/api/health")
    def health() -> Any:
        return jsonify({"status": "ok", "service": "ai-travel-stylist"})

    @app.post("/api/destination/analyze")
    def destination_analyze() -> Any:
        payload = request.get_json(silent=True) or {}
        destination = payload.get("destination", "Goa")
        days = payload.get("tripDays", 4)
        return jsonify(analyze_destination(destination, days, payload.get("startDate"), payload.get("endDate")))

    @app.get("/api/wardrobe")
    def wardrobe_index() -> Any:
        include_demo = request.args.get("seed", "true").lower() == "true"
        items = list_wardrobe() or (seed_demo_wardrobe() if include_demo else [])
        return jsonify({"items": items})

    @app.delete("/api/wardrobe")
    def wardrobe_clear() -> Any:
        clear_wardrobe()
        return jsonify({"items": []})

    @app.post("/api/location/reverse")
    def location_reverse() -> Any:
        payload = request.get_json(silent=True) or {}
        try:
            result = reverse_geocode(payload.get("latitude"), payload.get("longitude"))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        return jsonify(result)

    @app.post("/api/wardrobe/upload")
    def wardrobe_upload() -> Any:
        if "image" not in request.files:
            return jsonify({"error": "Upload an image file using form field 'image'."}), 400
        item = save_uploaded_item(request.files["image"])
        return jsonify({"item": item}), 201

    @app.patch("/api/wardrobe/<int:item_id>")
    def wardrobe_update(item_id: int) -> Any:
        payload = request.get_json(silent=True) or {}
        try:
            item = update_wardrobe_item(item_id, payload)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        if not item:
            return jsonify({"error": "Wardrobe item not found."}), 404
        return jsonify({"item": item})

    @app.delete("/api/wardrobe/<int:item_id>")
    def wardrobe_delete(item_id: int) -> Any:
        deleted = delete_wardrobe_item(item_id)
        if not deleted:
            return jsonify({"error": "Wardrobe item not found."}), 404
        return jsonify({"items": list_wardrobe()})

    @app.get("/api/wardrobe/image/<path:filename>")
    def wardrobe_image(filename: str) -> Any:
        return send_from_directory(UPLOAD_DIR, filename)

    @app.post("/api/outfits")
    def outfits() -> Any:
        payload = request.get_json(silent=True) or {}
        return jsonify(
            generate_outfits(
                payload.get("destination", "Goa"),
                payload.get("tripDays", 4),
                payload.get("startDate"),
                payload.get("endDate"),
                payload.get("gender", "women"),
            )
        )

    @app.post("/api/packing-list")
    def packing_list() -> Any:
        payload = request.get_json(silent=True) or {}
        return jsonify(
            generate_packing_list(
                payload.get("destination", "Goa"),
                payload.get("tripDays", 4),
                payload.get("startDate"),
                payload.get("endDate"),
                payload.get("gender", "women"),
            )
        )

    @app.get("/api/local-experiences")
    def local_experiences() -> Any:
        destination = request.args.get("destination", "Goa")
        profile = analyze_destination(destination)
        return jsonify(
            {
                "destination": profile["destination"],
                "activities": profile["activities"],
                "nightlife": profile["nightlife"],
                "socialSignals": profile["socialSignals"],
            }
        )

    @app.get("/api/dance-plan")
    def dance_plan() -> Any:
        destination = request.args.get("destination", "Goa")
        return jsonify(get_dance_plan(destination))

    @app.get("/api/inspiration")
    def inspiration() -> Any:
        destination = request.args.get("destination", "Goa")
        gender = request.args.get("gender", "women")
        return jsonify(get_destination_inspiration(destination, gender=gender))

    @app.get("/api/reel-studio")
    def reel_studio() -> Any:
        destination = request.args.get("destination", "Goa")
        gender = request.args.get("gender", "women")
        return jsonify(get_reel_studio(destination, gender=gender))

    @app.post("/api/dance/evaluate")
    def dance_evaluate() -> Any:
        payload = request.get_json(silent=True) or {}
        return jsonify(evaluate_pose(payload.get("reference", {}), payload.get("observed", {})))

    return app


app = create_app()


if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG") == "1"
    app.run(host="127.0.0.1", port=5000, debug=debug, use_reloader=debug)

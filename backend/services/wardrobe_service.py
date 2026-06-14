from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime
import os
from pathlib import Path
from typing import Any

from PIL import Image


ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = Path("/tmp/ai_travel_stylist") if os.getenv("VERCEL") else ROOT_DIR / "data"
UPLOAD_DIR = DATA_DIR / "wardrobe" / "uploads"
DB_PATH = DATA_DIR / "travel_stylist.db"

COLOR_PALETTE: dict[str, tuple[int, int, int]] = {
    "Black": (20, 20, 24),
    "White": (240, 240, 235),
    "Beige": (209, 190, 154),
    "Sky Blue": (135, 190, 230),
    "Denim Blue": (58, 96, 140),
    "Coral": (232, 112, 91),
    "Olive": (106, 126, 76),
    "Terracotta": (188, 100, 66),
    "Marigold": (235, 162, 38),
    "Red": (190, 40, 45),
    "Pink": (214, 119, 150),
    "Yellow": (232, 205, 72),
    "Navy": (25, 45, 85),
    "Brown": (117, 76, 49),
    "Cream": (238, 228, 205),
    "Charcoal": (62, 64, 64),
}

GENERIC_UPLOAD_PREFIXES = ("wardrobe camera", "whatsapp image", "image", "img ", "photo", "screenshot")
ALLOWED_CATEGORIES = {
    "Shirt",
    "T-shirt",
    "Topwear",
    "Shorts",
    "Jeans",
    "Trousers",
    "Skirt",
    "Dress",
    "Sneakers",
    "Sandals",
    "Hat",
    "Scarf",
    "Jewelry",
    "Bag",
    "Belt",
    "Watch",
    "Sunglasses",
    "Jacket",
    "Blazer",
    "Loafers",
}


def init_schema() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS wardrobe_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_path TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                category TEXT NOT NULL,
                color TEXT NOT NULL,
                color_hex TEXT NOT NULL,
                material TEXT NOT NULL,
                pattern TEXT NOT NULL,
                style TEXT NOT NULL,
                season TEXT NOT NULL,
                breathable INTEGER NOT NULL,
                formality TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        _repair_generic_uploads(conn)
        conn.commit()


def save_uploaded_item(file_storage: Any) -> dict[str, Any]:
    init_schema()
    original_name = file_storage.filename or "wardrobe-item.jpg"
    extension = Path(original_name).suffix.lower() or ".jpg"
    safe_name = f"{uuid.uuid4().hex}{extension}"
    target_path = UPLOAD_DIR / safe_name
    file_storage.save(target_path)

    tags = analyze_image(target_path, original_name)
    created_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            """
            INSERT INTO wardrobe_items (
                image_path, original_filename, category, color, color_hex,
                material, pattern, style, season, breathable, formality, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(target_path.relative_to(ROOT_DIR)),
                original_name,
                tags["category"],
                tags["color"],
                tags["colorHex"],
                tags["material"],
                tags["pattern"],
                tags["style"],
                tags["season"],
                int(tags["breathable"]),
                tags["formality"],
                created_at,
            ),
        )
        item_id = cursor.lastrowid
        conn.commit()

    display_name = _display_name(original_name, tags)
    return {
        **tags,
        "id": item_id,
        "imagePath": str(target_path.relative_to(ROOT_DIR)),
        "imageUrl": f"/api/wardrobe/image/{target_path.name}",
        "name": display_name,
        "createdAt": created_at,
    }


def analyze_image(image_path: Path, filename: str = "") -> dict[str, Any]:
    rgb = _dominant_rgb(image_path)
    color = _closest_color_name(rgb)
    category = _category_from_name(filename, image_path)
    material = _material_from_category(category, color)
    breathable = material in {"Linen", "Cotton", "Canvas"}
    style = _style_from_category(category)
    season = "Summer" if breathable else "All-season"
    formality = "Smart" if category in {"Shirt", "Dress", "Blazer", "Loafers"} else "Casual"

    return {
        "category": category,
        "color": color,
        "colorHex": _rgb_to_hex(rgb),
        "material": material,
        "pattern": "Solid",
        "style": style,
        "season": season,
        "breathable": breathable,
        "formality": formality,
    }


def list_wardrobe() -> list[dict[str, Any]]:
    init_schema()
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM wardrobe_items ORDER BY created_at DESC").fetchall()
    return [_serialize_row(row) for row in rows]


def clear_wardrobe() -> None:
    init_schema()
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT image_path FROM wardrobe_items WHERE image_path != ''").fetchall()
        conn.execute("DELETE FROM wardrobe_items")
        conn.commit()

    for row in rows:
        path = (ROOT_DIR / row["image_path"]).resolve()
        try:
            if path.is_file() and UPLOAD_DIR.resolve() in path.parents:
                path.unlink()
        except OSError:
            continue


def delete_wardrobe_item(item_id: int) -> bool:
    init_schema()
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT image_path FROM wardrobe_items WHERE id = ?", (item_id,)).fetchone()
        if not row:
            return False
        conn.execute("DELETE FROM wardrobe_items WHERE id = ?", (item_id,))
        conn.commit()

    image_path = str(row["image_path"] or "")
    if image_path:
        path = (ROOT_DIR / image_path).resolve()
        try:
            if path.is_file() and UPLOAD_DIR.resolve() in path.parents:
                path.unlink()
        except OSError:
            pass
    return True


def update_wardrobe_item(item_id: int, updates: dict[str, Any]) -> dict[str, Any] | None:
    init_schema()
    category = str(updates.get("category") or "").strip()
    if category not in ALLOWED_CATEGORIES:
        raise ValueError("Choose a valid wardrobe category.")

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM wardrobe_items WHERE id = ?", (item_id,)).fetchone()
        if not row:
            return None

        color = row["color"]
        material = _material_from_category(category, color)
        breathable = material in {"Linen", "Cotton", "Canvas"}
        style = _style_from_category(category)
        season = "Summer" if breathable else "All-season"
        formality = "Smart" if category in {"Shirt", "Dress", "Blazer", "Loafers", "Topwear", "Jewelry", "Watch", "Bag", "Belt"} else "Casual"
        conn.execute(
            """
            UPDATE wardrobe_items
            SET category = ?, material = ?, style = ?, season = ?, breathable = ?, formality = ?
            WHERE id = ?
            """,
            (category, material, style, season, int(breathable), formality, item_id),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM wardrobe_items WHERE id = ?", (item_id,)).fetchone()
    return _serialize_row(updated)


def seed_demo_wardrobe() -> list[dict[str, Any]]:
    init_schema()
    if list_wardrobe():
        return list_wardrobe()

    demo_items = [
        ("White Linen Shirt", "Shirt", "White", "#f2f0e8", "Linen", "Solid", "Beachwear", "Summer", 1, "Smart"),
        ("Beige Shorts", "Shorts", "Beige", "#d1be9a", "Cotton", "Solid", "Beachwear", "Summer", 1, "Casual"),
        ("Brown Sandals", "Sandals", "Brown", "#754c31", "Leather", "Solid", "Resort", "Summer", 0, "Casual"),
        ("Black Shirt", "Shirt", "Black", "#141418", "Cotton", "Solid", "Nightlife", "All-season", 1, "Smart"),
        ("Slim Fit Jeans", "Jeans", "Denim Blue", "#3a608c", "Denim", "Solid", "Streetwear", "All-season", 0, "Casual"),
        ("White Sneakers", "Sneakers", "White", "#f0f0eb", "Canvas", "Solid", "Streetwear", "All-season", 1, "Casual"),
    ]
    created_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    with sqlite3.connect(DB_PATH) as conn:
        conn.executemany(
            """
            INSERT INTO wardrobe_items (
                image_path, original_filename, category, color, color_hex,
                material, pattern, style, season, breathable, formality, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    "",
                    name,
                    category,
                    color,
                    color_hex,
                    material,
                    pattern,
                    style,
                    season,
                    breathable,
                    formality,
                    created_at,
                )
                for name, category, color, color_hex, material, pattern, style, season, breathable, formality in demo_items
            ],
        )
        conn.commit()
    return list_wardrobe()


def _serialize_row(row: sqlite3.Row) -> dict[str, Any]:
    tags = {
        "category": row["category"],
        "color": row["color"],
        "material": row["material"],
    }
    return {
        "id": row["id"],
        "imagePath": row["image_path"],
        "imageUrl": f"/api/wardrobe/image/{Path(row['image_path']).name}" if row["image_path"] else None,
        "name": _display_name(row["original_filename"], tags),
        "category": row["category"],
        "color": row["color"],
        "colorHex": row["color_hex"],
        "material": row["material"],
        "pattern": row["pattern"],
        "style": row["style"],
        "season": row["season"],
        "breathable": bool(row["breathable"]),
        "formality": row["formality"],
        "createdAt": row["created_at"],
    }


def _display_name(original_name: str, tags: dict[str, Any]) -> str:
    stem = Path(original_name).stem.strip().replace("_", " ").replace("-", " ")
    generic = _is_generic_upload_name(stem)
    if generic:
        return f"{tags['color']} {tags['material']} {tags['category']}"
    return stem.title()


def _repair_generic_uploads(conn: sqlite3.Connection) -> None:
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT id, image_path, original_filename, category
        FROM wardrobe_items
        WHERE image_path != ''
        """
    ).fetchall()
    for row in rows:
        original_name = str(row["original_filename"] or "")
        if not _is_generic_upload_name(Path(original_name).stem) and not (
            row["category"] == "Hat" and "whatsapp" in original_name.lower()
        ):
            continue
        image_path = ROOT_DIR / row["image_path"]
        if not image_path.exists():
            continue
        tags = analyze_image(image_path, original_name)
        conn.execute(
            """
            UPDATE wardrobe_items
            SET category = ?, color = ?, color_hex = ?, material = ?,
                pattern = ?, style = ?, season = ?, breathable = ?, formality = ?
            WHERE id = ?
            """,
            (
                tags["category"],
                tags["color"],
                tags["colorHex"],
                tags["material"],
                tags["pattern"],
                tags["style"],
                tags["season"],
                int(tags["breathable"]),
                tags["formality"],
                row["id"],
            ),
        )


def _is_generic_upload_name(value: str) -> bool:
    normalized = value.strip().lower()
    return not normalized or normalized.startswith(GENERIC_UPLOAD_PREFIXES)


def _dominant_rgb(image_path: Path) -> tuple[int, int, int]:
    with Image.open(image_path).convert("RGB") as image:
        image = _product_crop(image)
        image.thumbnail((180, 180))
        pixels = [pixel for pixel in image.getdata() if _looks_like_garment_pixel(pixel)]
        if not pixels:
            pixels = [
                pixel
                for pixel in image.getdata()
                if not _is_near_black(pixel) and not _is_near_white(pixel)
            ]
        if not pixels:
            pixels = list(image.getdata())
    if not pixels:
        return (240, 240, 235)

    # Quantize channels so small shadows do not dominate the color label.
    buckets: dict[tuple[int, int, int], int] = {}
    for red, green, blue in pixels:
        bucket = (round(red / 16) * 16, round(green / 16) * 16, round(blue / 16) * 16)
        buckets[bucket] = buckets.get(bucket, 0) + 1
    return max(buckets.items(), key=lambda item: item[1])[0]


def _looks_like_garment_pixel(pixel: tuple[int, int, int]) -> bool:
    red, green, blue = pixel
    brightness = (red + green + blue) / 3
    saturation = max(pixel) - min(pixel)
    if _is_near_black(pixel) or _is_near_white(pixel):
        return False
    return saturation >= 24 or brightness <= 212


def _is_near_black(pixel: tuple[int, int, int]) -> bool:
    return max(pixel) < 35


def _is_near_white(pixel: tuple[int, int, int]) -> bool:
    return min(pixel) > 232 and max(pixel) - min(pixel) < 32


def _closest_color_name(rgb: tuple[int, int, int]) -> str:
    def distance(target: tuple[int, int, int]) -> int:
        return sum((rgb[index] - target[index]) ** 2 for index in range(3))

    return min(COLOR_PALETTE, key=lambda name: distance(COLOR_PALETTE[name]))


def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    red, green, blue = [max(0, min(255, value)) for value in rgb]
    return f"#{red:02x}{green:02x}{blue:02x}"


def _category_from_name(filename: str, image_path: Path | None = None) -> str:
    lowered = Path(filename).stem.lower().replace("_", " ").replace("-", " ")
    if _is_generic_upload_name(lowered):
        return _category_from_image(image_path) if image_path else "Topwear"
    words = set(lowered.split())
    checks = [
        ("shirt", "Shirt"),
        ("blouse", "Shirt"),
        ("top", "Topwear"),
        ("kurti", "Topwear"),
        ("kurta", "Shirt"),
        ("tee", "T-shirt"),
        ("tshirt", "T-shirt"),
        ("short", "Shorts"),
        ("jean", "Jeans"),
        ("skirt", "Skirt"),
        ("pant", "Trousers"),
        ("trouser", "Trousers"),
        ("dress", "Dress"),
        ("shoe", "Sneakers"),
        ("sneaker", "Sneakers"),
        ("sandal", "Sandals"),
        ("hat", "Hat"),
        ("scarf", "Scarf"),
        ("jacket", "Jacket"),
        ("blazer", "Blazer"),
        ("loafer", "Loafers"),
    ]
    for token, category in checks:
        if token in words or any(word.startswith(token) for word in words):
            return category
    return _category_from_image(image_path) if image_path else "Topwear"


def _category_from_image(image_path: Path | None) -> str:
    if not image_path:
        return "Topwear"
    try:
        with Image.open(image_path).convert("RGB") as image:
            crop = _product_crop(image)
            crop = crop.crop((int(crop.width * 0.04), int(crop.height * 0.08), int(crop.width * 0.96), int(crop.height * 0.94)))
            foreground = _main_garment_points(crop)
            if len(foreground) < 40:
                return "Topwear"
            xs = [point[0] for point in foreground]
            ys = [point[1] for point in foreground]
            box_width = max(xs) - min(xs) + 1
            box_height = max(ys) - min(ys) + 1
            aspect = box_width / max(box_height, 1)
            height_ratio = box_height / crop.height

            if aspect > 1.25 and height_ratio < 0.62:
                return "Skirt"
            if _has_two_leg_gap(crop, foreground) and aspect < 0.45 and height_ratio > 0.58:
                return "Jeans" if _closest_color_name(_dominant_rgb(image_path)) in {"Denim Blue", "Charcoal", "Black"} else "Trousers"
            if aspect < 0.45 and height_ratio > 0.55:
                return "Jeans" if _closest_color_name(_dominant_rgb(image_path)) in {"Denim Blue", "Charcoal", "Black"} else "Trousers"
            if aspect > 1.15 and height_ratio > 0.46:
                return "Shirt"
            return "Topwear"
    except (OSError, ValueError):
        return "Topwear"


def _product_crop(image: Image.Image) -> Image.Image:
    """Crop phone/browser screenshots down to the bright product card when possible."""
    width, height = image.size
    bright_rows: list[int] = []
    for y in range(height):
        bright = 0
        for x in range(0, width, max(1, width // 90)):
            pixel = image.getpixel((x, y))
            if _is_product_background(pixel):
                bright += 1
        if bright >= 18:
            bright_rows.append(y)

    if not bright_rows:
        return image

    start_y, end_y = _longest_contiguous_range(bright_rows)
    if end_y - start_y < height * 0.22:
        return image

    sample = image.crop((0, start_y, width, end_y + 1))
    bright_cols: list[int] = []
    for x in range(width):
        bright = 0
        for y in range(0, sample.height, max(1, sample.height // 80)):
            if _is_product_background(sample.getpixel((x, y))):
                bright += 1
        if bright >= 12:
            bright_cols.append(x)

    if bright_cols:
        start_x, end_x = _longest_contiguous_range(bright_cols)
    else:
        start_x, end_x = 0, width - 1

    pad_x = int(width * 0.015)
    pad_y = int(height * 0.015)
    return image.crop(
        (
            max(0, start_x - pad_x),
            max(0, start_y - pad_y),
            min(width, end_x + pad_x + 1),
            min(height, end_y + pad_y + 1),
        )
    )


def _foreground_points(image: Image.Image) -> list[tuple[int, int]]:
    points: list[tuple[int, int]] = []
    step = 3
    for y in range(0, image.height, step):
        for x in range(0, image.width, step):
            pixel = image.getpixel((x, y))
            if _looks_like_garment_pixel(pixel):
                points.append((x, y))
    return points


def _main_garment_points(image: Image.Image) -> list[tuple[int, int]]:
    points = _foreground_points(image)
    if not points:
        return []

    point_set = set(points)
    seen: set[tuple[int, int]] = set()
    components: list[list[tuple[int, int]]] = []
    step = 3
    neighbors = [
        (-step, -step),
        (0, -step),
        (step, -step),
        (-step, 0),
        (step, 0),
        (-step, step),
        (0, step),
        (step, step),
    ]

    for point in points:
        if point in seen:
            continue
        stack = [point]
        seen.add(point)
        component: list[tuple[int, int]] = []
        while stack:
            current = stack.pop()
            component.append(current)
            x, y = current
            for dx, dy in neighbors:
                next_point = (x + dx, y + dy)
                if next_point in point_set and next_point not in seen:
                    seen.add(next_point)
                    stack.append(next_point)
        if len(component) >= 24:
            components.append(component)

    if not components:
        return points

    center_x = image.width / 2

    def component_score(component: list[tuple[int, int]]) -> float:
        xs = [point[0] for point in component]
        ys = [point[1] for point in component]
        component_center = (min(xs) + max(xs)) / 2
        edge_touch = min(xs) <= step or max(xs) >= image.width - step or min(ys) <= step or max(ys) >= image.height - step
        centrality = 1 - min(abs(component_center - center_x) / max(center_x, 1), 1)
        edge_penalty = 0.55 if edge_touch and len(component) < len(points) * 0.70 else 1
        return len(component) * (0.75 + centrality * 0.35) * edge_penalty

    return max(components, key=component_score)


def _has_two_leg_gap(image: Image.Image, foreground: list[tuple[int, int]]) -> bool:
    if not foreground:
        return False
    ys = [point[1] for point in foreground]
    xs = [point[0] for point in foreground]
    min_y, max_y = min(ys), max(ys)
    min_x, max_x = min(xs), max(xs)
    lower_start = min_y + int((max_y - min_y) * 0.36)
    lower_points = [(x, y) for x, y in foreground if y >= lower_start]
    if not lower_points:
        return False

    center_x = (min_x + max_x) / 2
    center_band = max(8, int((max_x - min_x) * 0.10))
    center_count = sum(1 for x, _ in lower_points if abs(x - center_x) <= center_band)
    side_count = len(lower_points) - center_count
    if side_count <= 0:
        return False
    center_ratio = center_count / len(lower_points)
    height_ratio = (max_y - min_y + 1) / max(image.height, 1)
    width_ratio = (max_x - min_x + 1) / max(image.width, 1)
    return height_ratio > 0.58 and width_ratio > 0.28 and center_ratio < 0.22


def _is_product_background(pixel: tuple[int, int, int]) -> bool:
    return min(pixel) > 214 and max(pixel) - min(pixel) < 42


def _longest_contiguous_range(values: list[int]) -> tuple[int, int]:
    best_start = current_start = values[0]
    best_end = current_end = values[0]
    for value in values[1:]:
        if value == current_end + 1:
            current_end = value
        else:
            if current_end - current_start > best_end - best_start:
                best_start, best_end = current_start, current_end
            current_start = current_end = value
    if current_end - current_start > best_end - best_start:
        best_start, best_end = current_start, current_end
    return best_start, best_end


def _material_from_category(category: str, color: str) -> str:
    if category in {"Shirt", "T-shirt", "Shorts", "Topwear", "Dress"}:
        return "Linen" if color in {"White", "Beige", "Sky Blue", "Cream"} else "Cotton"
    if category in {"Jeans", "Skirt"} and color in {"Denim Blue", "Charcoal", "Black"}:
        return "Denim"
    if category in {"Sneakers"}:
        return "Canvas"
    if category in {"Sandals", "Loafers"}:
        return "Leather"
    if category in {"Jewelry", "Watch"}:
        return "Metal"
    if category in {"Bag", "Belt"}:
        return "Leather"
    if category == "Sunglasses":
        return "Acetate"
    return "Mixed"


def _style_from_category(category: str) -> str:
    if category in {"Sandals", "Shorts", "Hat", "Sunglasses"}:
        return "Beachwear"
    if category in {"Shirt", "Dress", "Blazer", "Loafers", "Topwear", "Jewelry", "Watch", "Bag", "Belt"}:
        return "Smart Casual"
    if category in {"Sneakers", "Jeans", "T-shirt", "Skirt"}:
        return "Streetwear"
    return "Casual"

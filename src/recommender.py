import sqlite3
import numpy as np

class OutfitRecommender:
    def __init__(self, target_weather, target_vibe, cultural_restrictions=None):
        """
        Initializes the context for the recommendation engine matrix.
        
        target_weather: dict -> {"temperature": float, "humidity": str} ('High' or 'Low')
        target_vibe: str -> The trending aesthetic (e.g., 'Beachwear/Casual', 'Traditional', 'Nightlife')
        cultural_restrictions: list -> List of categories to avoid due to custom cultural norms
        """
        self.target_weather = target_weather
        self.target_vibe = target_vibe
        self.cultural_restrictions = cultural_restrictions if cultural_restrictions else []

    def calculate_match_score(self, item):
        """
        Applies a heuristic scoring function based on environmental vectors.
        item tuple index matching SQLite schema: 
        (id, image_path, category, color, style_vibe, is_breathable)
        """
        category = item[2]
        style_vibe = item[4]
        is_breathable = item[5]
        
        score = 100.0
        
        # 1. Cultural Guardrail (Hard Drop)
        if category in self.cultural_restrictions:
            return 0.0

        # 2. Weather Compliance Scoring Rule
        if self.target_weather["temperature"] > 30.0:  # Hot Destination (e.g., Goa, Rajasthan Summer)
            if is_breathable == 0:
                score -= 30.0  # Heavy penalty for non-breathable items
        elif self.target_weather["temperature"] < 15.0:  # Cold Destination
            if is_breathable == 1:
                score -= 25.0  # Penalty for too thin layers

        # 3. Style Vibe Congruence Match
        if style_vibe == self.target_vibe:
            score += 15.0  # Bonus for matching local trend data
        else:
            score -= 15.0  # Detraction for clashing aesthetics

        # Bound score between 0 and 100
        return max(0.0, min(100.0, score))

    def generate_recommendations(self):
        """Fetches items and groups them into optimal recommendations ranked by match score."""
        conn = sqlite3.connect("data/travel_stylist.db")
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM wardrobe")
        wardrobe_items = cursor.fetchall()
        conn.close()

        scored_items = []
        for item in wardrobe_items:
            score = self.calculate_match_score(item)
            if score > 0: # Filter out culturally restricted items entirely
                scored_items.append({
                    "id": item[0],
                    "path": item[1],
                    "category": item[2],
                    "score": score
                })

        # Sort items based on descending matching algorithm accuracy scores
        scored_items.sort(key=lambda x: x["score"], reverse=True)
        return scored_items

# Localized testing setup for the matching algorithm
if __name__ == "__main__":
    # Mock Database items injection for logical validation
    conn = sqlite3.connect("data/travel_stylist.db")
    cursor = conn.cursor()
    cursor.execute("DELETE FROM wardrobe") # Clear history
    
    # Injecting test configurations: 1 perfect beachwear item, 1 winter item
    cursor.executemany('''
        INSERT INTO wardrobe (image_path, category, color, style_vibe, is_breathable)
        VALUES (?, ?, ?, ?, ?)
    ''', [
        ("data/wardrobe/shirt1.jpg", "Jersey/T-shirt", "White", "Beachwear/Casual", 1),
        ("data/wardrobe/jacket1.jpg", "Sweater", "Black", "Formal/Nightlife", 0)
    ])
    conn.commit()
    conn.close()

    # Emulate traveling to Goa in December (Hot Day, Beachwear vibe)
    goa_weather = {"temperature": 32.5, "humidity": "High"}
    engine = OutfitRecommender(target_weather=goa_weather, target_vibe="Beachwear/Casual")
    
    recommendations = engine.generate_recommendations()
    print("--- Optimized Fit Recommendations for Destination Profile ---")
    for rec in recommendations:
        print(f"Item Category: {rec['category']} | Structural Suitability Score: {rec['score']}%")
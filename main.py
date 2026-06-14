import os
import cv2
import numpy as np
from src.database import init_db, insert_clothing_item, fetch_all_wardrobe
from src.vision_tagger import WardrobeVisionTagger
from src.recommender import OutfitRecommender
from src.dance_coach import DanceCoachAI

def run_app():
    print("==================================================")
    print("   AI-POWERED TRAVEL STYLIST & CULTURAL ENGINE   ")
    print("==================================================\n")
    
    # Initialize the local structured database files
    init_db()
    tagger = WardrobeVisionTagger()

    # Step 1: Simulated Wardrobe Digitization
    print("\n--- [Step 1: Wardrobe Digitization Pipeline] ---")
    test_image_path = "data/wardrobe/test_item.jpg"
    
    # Generate an explicit white image block if testing files are missing
    if not os.path.exists(test_image_path):
        os.makedirs(os.path.dirname(test_image_path), exist_ok=True)
        dummy_img = np.ones((400, 400, 3), dtype=np.uint8) * 255
        cv2.imwrite(test_image_path, dummy_img)
        print("Generated a temporary test clothing item image.")

    print(f"Processing image asset: '{test_image_path}' using deep feature extraction...")
    tags = tagger.pipeline(test_image_path)
    
    # Save the parsed features straight to our local structured DB tables
    insert_clothing_item(
        image_path=test_image_path,
        category=tags["category"],
        color=f"RGB{tuple(tags['dominant_color_rgb'])}",
        style_vibe=tags["style_vibe"],
        is_breathable=tags["is_breathable"]
    )
    print(f"✔ Item successfully classified as [{tags['category']}] and committed to SQLite tracking.")

    # Step 2: Trip Definition & Destination Profiling
    print("\n--- [Step 2: Destination Trend Analysis Engine] ---")
    print("Trip Config: Destination = Goa | Month = December")
    
    # Mocking real-time trend/weather state profiles for Goa data configurations
    goa_weather_profile = {"temperature": 31.8, "humidity": "High"}
    goa_trend_vibe = "Beachwear/Casual"
    goa_cultural_restrictions = ["Winter Heavy Coats"] # Hard restrictions schema testing

    print(f"Analyzing environmental vectors: Temp={goa_weather_profile['temperature']}°C, Target Trend Style={goa_trend_vibe}")
    
    # Step 3: Compute Recommendations via Matrix Scoring
    recommender = OutfitRecommender(
        target_weather=goa_weather_profile, 
        target_vibe=goa_trend_vibe,
        cultural_restrictions=goa_cultural_restrictions
    )
    matches = recommender.generate_recommendations()

    print("\nMatched Wardrobe Options Optimized for Destination:")
    for match in matches:
        print(f" ➔ Wardrobe Item ID: {match['id']} | Category: {match['category']} | Match Compatibility Score: {match['score']}%")

    # Step 4: Spatial Dance Coach Module Activation
    print("\n--- [Step 4: Launching Viral Dance Sync Coach AI] ---")
    print("Destination Goa detected with high active nightlife trend matrix.")
    launch_dance = input("Would you like to open your camera to practice the trending Goa dance frame? (y/n): ")
    
    if launch_dance.lower() == 'y':
        coach = DanceCoachAI()
        # Launching live video feed expecting a 90-degree arm freeze frame stance
        coach.evaluate_live_feed(target_elbow_angle=90.0)
    else:
        print("\nExiting application. Run again whenever you are ready to prepare for your trip!")

if __name__ == "__main__":
    run_app()
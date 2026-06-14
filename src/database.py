import sqlite3
import os

DB_PATH = "data/travel_stylist.db"

def init_db():
    """Initializes the local database storage for wardrobe and trips."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create Wardrobe table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS wardrobe (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_path TEXT NOT NULL,
            category TEXT NOT NULL,
            color TEXT NOT NULL,
            style_vibe TEXT NOT NULL,
            is_breathable INTEGER DEFAULT 1
        )
    ''')
    
    conn.commit()
    conn.close()
    print("✔ Local ML Database Initialized Successfully.")

def insert_clothing_item(image_path, category, color, style_vibe, is_breathable):
    """Inserts a computer-vision tagged clothing item into local inventory."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO wardrobe (image_path, category, color, style_vibe, is_breathable)
        VALUES (?, ?, ?, ?, ?)
    ''', (image_path, category, color, style_vibe, is_breathable))
    conn.commit()
    conn.close()

def fetch_all_wardrobe():
    """Retrieves all wardrobe profiles for vector tracking."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM wardrobe")
    items = cursor.fetchall()
    conn.close()
    return items

if __name__ == "__main__":
    init_db()
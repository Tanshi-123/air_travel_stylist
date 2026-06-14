import cv2
import numpy as np
import torch
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image

class WardrobeVisionTagger:
    def __init__(self):
        # Using a pre-trained ResNet model to extract deep clothing structural tags
        self.model = models.resnet50(pretrained=True)
        self.model.eval()
        
        # Image transformation configurations for Deep Learning input tensors
        self.transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        
        # Simplistic mapping framework for standard ImageNet indexes to generalized clothing types
        # In production, you'd fine-tune this on a dataset like DeepFashion
        self.clothing_classes = {
            610: "Jersey/T-shirt",
            834: "Suit/Formal",
            841: "Sweater",
            608: "Jean/Pants",
            430: "Gown/Dress",
            770: "Running Shoe"
        }

    def extract_dominant_color(self, image_path):
        """Uses OpenCV K-Means Clustering to extract the dominant color profile of a garment."""
        img = cv2.imread(image_path)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = cv2.resize(img, (100, 100)) # Downscale for performance efficiency
        
        # Reshape the image data into a flat list of pixels
        pixels = img.reshape((-1, 3))
        pixels = np.float32(pixels)
        
        # Define criteria and apply K-Means
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
        flags = cv2.KMEANS_RANDOM_CENTERS
        _, labels, centers = cv2.kmeans(pixels, 3, None, criteria, 10, flags)
        
        # Get the dominant cluster center color
        dominant_color_rgb = centers[np.argmax(np.bincount(labels.flatten()))]
        return [int(c) for c in dominant_color_rgb]

    def classify_category(self, image_path):
        """Passes the garment image through ResNet to extract structural design classes."""
        image = Image.open(image_path).convert("RGB")
        tensor = self.transform(image).unsqueeze(0)
        
        with torch.no_grad():
            outputs = self.model(tensor)
            _, predicted_idx = torch.max(outputs, 1)
            idx = predicted_idx.item()
            
        return self.clothing_classes.get(idx, "Casual Topwear") # Fallback mapping

    def pipeline(self, image_path):
        """Executes the dual-layer processing framework for complete extraction."""
        category = self.classify_category(image_path)
        color_rgb = self.extract_dominant_color(image_path)
        
        # Intelligently assume attributes based on categories (can be expanded to individual neural branches)
        style_vibe = "Beachwear/Casual" if category in ["Jersey/T-shirt", "Jean/Pants"] else "Formal/Nightlife"
        is_breathable = 1 if category in ["Jersey/T-shirt"] else 0
        
        return {
            "category": category,
            "dominant_color_rgb": color_rgb,
            "style_vibe": style_vibe,
            "is_breathable": is_breathable
        }

# Execution Test block
if __name__ == "__main__":
    # Create a dummy blank image to ensure execution without file missing errors
    dummy_img = np.ones((400,400,3), dtype=np.uint8) * 255
    cv2.imwrite("data/wardrobe/test_item.jpg", dummy_img)
    
    tagger = WardrobeVisionTagger()
    tags = tagger.pipeline("data/wardrobe/test_item.jpg")
    print("Extracted Attributes Matrix:", tags)
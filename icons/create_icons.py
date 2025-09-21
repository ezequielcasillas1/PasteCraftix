#!/usr/bin/env python3
"""
PasteCraft Icon Generator
Creates extension icons programmatically
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size):
    """Create a single icon of specified size"""
    # Create image with gradient-like background
    img = Image.new('RGBA', (size, size), (59, 130, 246, 255))  # Blue background
    draw = ImageDraw.Draw(img)
    
    # Add darker blue overlay for gradient effect
    overlay = Image.new('RGBA', (size, size), (29, 78, 216, 128))
    img = Image.alpha_composite(img, overlay)
    
    # Add "PC" text
    draw = ImageDraw.Draw(img)
    font_size = int(size * 0.4)
    
    try:
        # Try to use a system font
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        font = ImageFont.load_default()
    
    text = "PC"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (size - text_width) // 2
    y = (size - text_height) // 2
    
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)
    
    return img

def main():
    """Generate all required icon sizes"""
    sizes = [16, 32, 48, 128]
    
    for size in sizes:
        icon = create_icon(size)
        filename = f"icon{size}.png"
        icon.save(filename)
        print(f"Created {filename}")

if __name__ == "__main__":
    main()

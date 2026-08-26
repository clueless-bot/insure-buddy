import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps
from rembg import new_session, remove
BACKGROUND_REMOVAL_MODEL = "u2net_human_seg"


DPI = 96
CM_PER_INCH = 2.54
POINTS_PER_INCH = 72


def cm_to_px(value):
    """Convert Canva's centimetre measurements to pixels at 96 DPI."""
    return round(value * DPI / CM_PER_INCH)


def points_to_px(value):
    """Convert a typographic point size to Pillow's pixel font size."""
    return round(value * DPI / POINTS_PER_INCH)


def load_dm_sans(size):
    """Load DM Sans Regular from the project or a common system location."""
    font_candidates = (
        Path(__file__).with_name("dm.ttf"),
        Path(__file__).with_name("dm.ttf"),
        Path("/usr/share/fonts/truetype/dm-sans/DMSans-Regular.ttf"),
        Path.home() / ".local/share/fonts/DM Sans/DMSans-Regular.ttf",
    )

    for font_path in font_candidates:
        if font_path.is_file():
            return ImageFont.truetype(str(font_path), size)

    raise FileNotFoundError(
        "DM Sans Regular was not found. Add DMSans-Regular.ttf next to "
        "template_1.py."
    )


def draw_text_box(template, position, size, text, font, color):
    """Draw text inside a fixed-size box, clipping anything outside it."""
    text_layer = Image.new("RGBA", size, (0, 0, 0, 0))
    text_draw = ImageDraw.Draw(text_layer)
    text_draw.text((0, 0), text, font=font, fill=color, anchor="lt")
    template.alpha_composite(text_layer, dest=position)


def mask_to_oval(image):
    """Clip an RGBA image to a smooth oval without losing its alpha channel."""
    scale = 4
    mask = Image.new("L", (image.width * scale, image.height * scale), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse((0, 0, mask.width - 1, mask.height - 1), fill=255)
    mask = mask.resize(image.size, Image.Resampling.LANCZOS)

    image.putalpha(ImageChops.multiply(image.getchannel("A"), mask))
    return image


def generate_image(
    template_path,
    profile_image_path,
    phone_number,
    email,
    output_path,
):
    # Load the template.
    template = Image.open(template_path).convert("RGBA")

    # Sub-image: 20.41 cm x 28.06 cm at (23.43 cm, 9.1 cm).
    photo_size = (cm_to_px(20.41), cm_to_px(28.06))
    photo_position = (cm_to_px(23.43), cm_to_px(9.1))
    profile = Image.open(profile_image_path).convert("RGBA")
    background_removal_session = new_session(BACKGROUND_REMOVAL_MODEL)
    profile = remove(
        profile,
        session=background_removal_session,
    ).convert("RGBA")
    # Preserve the portrait's aspect ratio, fill the oval, and crop only the
    # overflow that falls outside the requested photo area.
    profile = ImageOps.fit(
        profile,
        photo_size,
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )
    profile = mask_to_oval(profile)
    template.alpha_composite(profile, dest=photo_position)


    # DM Sans, 34.1 pt, white.
    font = load_dm_sans(points_to_px(34.1))
    text_color = (255, 255, 255, 255)

    # Email: 19.25 cm x 1.43 cm at (22.3 cm, 38.28 cm).
    draw_text_box(
        template,
        (cm_to_px(22.3), cm_to_px(38.28)),
        (cm_to_px(19.25), cm_to_px(1.43)),
        email,
        font,
        text_color,
    )

    # Phone number: 18.23 cm x 1.43 cm at (22.25 cm, 40.39 cm).
    draw_text_box(
        template,
        (cm_to_px(22.25), cm_to_px(40.39)),
        (cm_to_px(18.23), cm_to_px(1.43)),
        phone_number,
        font,
        text_color,
    )

    template.convert("RGB").save(output_path, quality=95, dpi=(DPI, DPI))


def parse_arguments():
    parser = argparse.ArgumentParser(description="Generate an InsureBuddy poster.")
    parser.add_argument("--template", default="Template.png")
    parser.add_argument("--profile", default="semil-profile.png")
    parser.add_argument("--phone-number", default="9825571289")
    parser.add_argument("--email", default="semil.shah@jainam.in")
    parser.add_argument("--output", default="semil.png")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_arguments()
    generate_image(
        template_path=args.template,
        profile_image_path=args.profile,
        phone_number=args.phone_number,
        email=args.email,
        output_path=args.output,
    )

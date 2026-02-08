from math import cos, pi, sin
from PIL import Image, ImageDraw

BASE_FRAME = 32
SCALE = 8
FRAME = BASE_FRAME * SCALE

STATES = [
    "idle1",
    "idle2",
    "run1",
    "run2",
    "run3",
    "run4",
    "jump",
    "fall",
    "attack1",
    "attack2",
    "ability1",
    "ability2",
]
FORMS = ["yellow", "blue", "red", "green"]
PALETTE = {
    "yellow": {
        "main": (245, 154, 32, 255),
        "dark": (214, 118, 18, 255),
        "light": (255, 196, 90, 255),
    },
    "blue": {
        "main": (62, 151, 231, 255),
        "dark": (38, 105, 176, 255),
        "light": (146, 210, 255, 255),
    },
    "red": {
        "main": (226, 88, 78, 255),
        "dark": (174, 54, 48, 255),
        "light": (250, 166, 138, 255),
    },
    "green": {
        "main": (94, 188, 96, 255),
        "dark": (57, 140, 62, 255),
        "light": (174, 229, 161, 255),
    },
    "enemy": {
        "main": (109, 206, 92, 255),
        "dark": (64, 142, 58, 255),
        "light": (186, 238, 166, 255),
    },
}

OUTLINE = (28, 21, 20, 255)
EYE_WHITE = (245, 245, 245, 255)
EYE_PUPIL = (30, 30, 35, 255)
FEET = (232, 170, 88, 255)

ATLAS_W = FRAME * len(STATES)
ATLAS_H = FRAME * (len(FORMS) + 1)
atlas = Image.new("RGBA", (ATLAS_W, ATLAS_H), (0, 0, 0, 0))


def pset(img, x, y, color):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), color)


def draw_fuzzy_body(img, cx, cy, radius, colors, state):
    draw = ImageDraw.Draw(img)

    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=colors["main"])
    draw.ellipse((cx - radius + 2, cy + 2, cx + radius - 2, cy + radius), fill=colors["dark"])
    draw.ellipse((cx - radius + 3, cy - radius + 2, cx - 1, cy - 1), fill=colors["light"])

    spike_boost = 0
    if state.startswith("run"):
        spike_boost = 1
    if state in ("jump", "fall"):
        spike_boost = 2

    for i in range(64):
        a = i * (2 * pi / 64)
        jitter = ((i * 13) % 5) - 2
        if i % 3 == 0:
            jitter += spike_boost
        r = radius + 1 + jitter * 0.35
        ox = int(round(cx + cos(a) * r))
        oy = int(round(cy + sin(a) * r))
        pset(img, ox, oy, OUTLINE)
        if i % 2 == 0:
            pset(img, int(round(cx + cos(a) * (r - 1))), int(round(cy + sin(a) * (r - 1))), colors["main"])

    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=OUTLINE)


def draw_eyes_and_mouth(img, cx, cy, state, facing):
    draw = ImageDraw.Draw(img)

    eye_y = cy - 2
    blink = state == "idle2"
    squint = state in ("fall", "attack2")

    if blink:
        draw.line((cx - 5, eye_y + 2, cx - 2, eye_y + 2), fill=EYE_WHITE)
        draw.line((cx + 2, eye_y + 2, cx + 5, eye_y + 2), fill=EYE_WHITE)
    else:
        draw.ellipse((cx - 6, eye_y - 2, cx - 1, eye_y + 3), fill=EYE_WHITE, outline=OUTLINE)
        draw.ellipse((cx + 1, eye_y - 2, cx + 6, eye_y + 3), fill=EYE_WHITE, outline=OUTLINE)
        px = 1 if facing > 0 else -1
        py = 1 if squint else 0
        pset(img, cx - 3 + px, eye_y + py, EYE_PUPIL)
        pset(img, cx + 3 + px, eye_y + py, EYE_PUPIL)

    mouth_y = cy + 5
    if state == "jump":
        draw.ellipse((cx - 2, mouth_y - 1, cx + 2, mouth_y + 3), fill=(52, 28, 22, 255), outline=OUTLINE)
    elif state == "fall":
        draw.arc((cx - 4, mouth_y - 2, cx + 4, mouth_y + 4), 20, 160, fill=OUTLINE)
    elif state in ("attack1", "attack2"):
        draw.line((cx - 2, mouth_y, cx + 4, mouth_y + 1), fill=OUTLINE)
    else:
        draw.line((cx - 3, mouth_y, cx + 3, mouth_y), fill=OUTLINE)


def draw_legs(img, cx, cy, state):
    draw = ImageDraw.Draw(img)
    if state == "run1":
        legs = [(-10, 7, -3, 11), (2, 9, 9, 13)]
    elif state == "run2":
        legs = [(-10, 9, -2, 13), (3, 7, 9, 11)]
    elif state == "run3":
        legs = [(-10, 7, -2, 11), (3, 9, 9, 13)]
    elif state == "run4":
        legs = [(-10, 9, -3, 13), (2, 7, 9, 11)]
    elif state == "jump":
        legs = [(-6, 10, -1, 13), (1, 10, 6, 13)]
    elif state == "fall":
        legs = [(-8, 11, -2, 14), (2, 11, 8, 14)]
    elif state in ("attack1", "attack2", "ability1", "ability2"):
        legs = [(-9, 8, -2, 12), (1, 8, 9, 12)]
    else:
        legs = [(-9, 8, -2, 12), (2, 8, 9, 12)]

    for x1, y1, x2, y2 in legs:
        draw.rounded_rectangle((cx + x1, cy + y1, cx + x2, cy + y2), radius=1, fill=FEET, outline=OUTLINE)


def draw_state_effects(img, cx, cy, form, state, facing):
    draw = ImageDraw.Draw(img)

    if state in ("attack1", "attack2"):
        arm_x = cx + (7 if facing > 0 else -9)
        draw.rounded_rectangle((arm_x, cy + 1, arm_x + 4, cy + 5), radius=1, fill=FEET, outline=OUTLINE)
        if form == "yellow":
            r = 4 if state == "attack1" else 6
            ox = cx + (12 if facing > 0 else -12)
            draw.ellipse((ox - r, cy - r + 1, ox + r, cy + r + 1), fill=(255, 196, 100, 220), outline=(255, 130, 35, 255))
            draw.ellipse((ox - r + 2, cy - r + 3, ox + r - 2, cy + r - 1), fill=(255, 235, 196, 210))

    if state in ("ability1", "ability2"):
        if form == "blue":
            ox = cx + (9 if facing > 0 else -9)
            draw.rounded_rectangle((cx + 6, cy + 1, cx + 10, cy + 5), radius=1, fill=FEET, outline=OUTLINE)
            draw.ellipse((ox - 3, cy - 8, ox + 3, cy - 2), fill=(156, 233, 255, 170), outline=(223, 250, 255, 255))
            draw.ellipse((ox + 3, cy - 11, ox + 7, cy - 7), fill=(156, 233, 255, 170), outline=(223, 250, 255, 255))
        elif form == "red":
            ox = cx + (9 if facing > 0 else -9)
            draw.rounded_rectangle((cx + 6, cy + 1, cx + 10, cy + 5), radius=1, fill=FEET, outline=OUTLINE)
            draw.rectangle((ox - 2, cy - 1, ox + 3, cy + 5), fill=(124, 54, 40, 255), outline=OUTLINE)
            draw.polygon([(ox - 1, cy), (ox + 2, cy + 2), (ox - 1, cy + 4)], fill=(255, 234, 205, 255))
        elif form == "green":
            ox = cx + (7 if facing > 0 else -7)
            tx = cx + (15 if facing > 0 else -15)
            draw.rounded_rectangle((cx + 5, cy, cx + 9, cy + 4), radius=1, fill=FEET, outline=OUTLINE)
            draw.line((ox, cy - 2, tx, cy - 9), fill=(210, 252, 255, 255), width=2)
            draw.ellipse((tx - 2, cy - 11, tx + 3, cy - 6), fill=(117, 232, 237, 255), outline=(230, 255, 255, 255))


def draw_blob(frame_img, form, state):
    colors = PALETTE[form]
    cx = 16
    cy = 17
    radius = 9
    facing = 1

    if state.startswith("run"):
        i = int(state[-1])
        cx += [-1, 1, 1, -1][i - 1]
        cy += [0, 1, 0, -1][i - 1]
    elif state == "jump":
        cy -= 2
    elif state == "fall":
        cy += 1

    draw_fuzzy_body(frame_img, cx, cy, radius, colors, state)
    draw_legs(frame_img, cx, cy, state)
    draw_eyes_and_mouth(frame_img, cx, cy, state, facing)
    draw_state_effects(frame_img, cx, cy, form, state, facing)


def draw_enemy(frame_img, state):
    colors = PALETTE["enemy"]
    cx = 16
    cy = 17
    if state.startswith("run"):
        i = int(state[-1])
        cx += [-1, 1, 1, -1][i - 1]
        cy += [0, 1, 0, -1][i - 1]
    draw_fuzzy_body(frame_img, cx, cy, 9, colors, state)
    draw_legs(frame_img, cx, cy, state)
    draw_eyes_and_mouth(frame_img, cx, cy, state, 1)


def upscale(base_frame):
    if SCALE == 1:
        return base_frame
    return base_frame.resize((FRAME, FRAME), resample=Image.NEAREST)


for row, form in enumerate(FORMS):
    for col, state in enumerate(STATES):
        base = Image.new("RGBA", (BASE_FRAME, BASE_FRAME), (0, 0, 0, 0))
        draw_blob(base, form, state)
        frame = upscale(base)
        atlas.alpha_composite(frame, (col * FRAME, row * FRAME))

for col, state in enumerate(STATES):
    base = Image.new("RGBA", (BASE_FRAME, BASE_FRAME), (0, 0, 0, 0))
    draw_enemy(base, state)
    frame = upscale(base)
    atlas.alpha_composite(frame, (col * FRAME, len(FORMS) * FRAME))

atlas.save("assets/tiny_spritesheet.png")
print("Gerado: assets/tiny_spritesheet.png", atlas.size, "frame", FRAME)

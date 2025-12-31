#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image


@dataclass(frozen=True)
class SplashSpec:
    width: int
    height: int
    filename: str


SPLASH_SPECS = [
    # iPhone 14 Pro Max / 15 Pro Max
    SplashSpec(1290, 2796, "1290x2796.png"),
    # iPhone 14 Pro / 15 Pro
    SplashSpec(1179, 2556, "1179x2556.png"),
    # iPhone 13 / 14 / 15
    SplashSpec(1170, 2532, "1170x2532.png"),
]


def hex_to_rgb(color: str) -> tuple[int, int, int]:
    color = color.lstrip("#")
    if len(color) != 6:
        raise ValueError(f"Expected 6-digit hex color, got: {color!r}")
    return tuple(int(color[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    icons_dir = root / "icons" / "ios"
    desired_1024 = icons_dir / "1024.png"
    icon_candidates = [
        desired_1024,
        icons_dir / "512.png",
        icons_dir / "192.png",
    ]
    icon_path = next((p for p in icon_candidates if p.exists()), None)
    out_dir = root / "splash"
    out_dir.mkdir(parents=True, exist_ok=True)

    if not icon_path:
        raise SystemExit(
            f"Missing source icon. Tried: {', '.join(str(p) for p in icon_candidates)}"
        )

    icon = Image.open(icon_path).convert("RGBA")

    # Ensure the manifest-referenced 1024 icon exists.
    if not desired_1024.exists():
        upscaled = icon.resize((1024, 1024), Image.LANCZOS)
        upscaled.convert("RGB").save(desired_1024, "PNG", optimize=True)
        print(f"Wrote {desired_1024.relative_to(root)}")
    bg = hex_to_rgb("#FDFBF7")

    for spec in SPLASH_SPECS:
        canvas = Image.new("RGBA", (spec.width, spec.height), (*bg, 255))

        # Keep the icon comfortably sized across devices.
        icon_size = int(min(spec.width, spec.height) * 0.22)
        scaled = icon.resize((icon_size, icon_size), Image.LANCZOS)

        x = (spec.width - icon_size) // 2
        y = (spec.height - icon_size) // 2
        canvas.alpha_composite(scaled, (x, y))

        out_path = out_dir / spec.filename
        canvas.convert("RGB").save(out_path, "PNG", optimize=True)
        print(f"Wrote {out_path.relative_to(root)}")


if __name__ == "__main__":
    main()

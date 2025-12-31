#!/usr/bin/env python3

from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
TARGET_DIRS = [
    ROOT / "icons" / "ios",
    ROOT / "splash",
]


def iter_pngs(dirs: Iterable[Path]) -> Iterable[Path]:
    for base in dirs:
        if not base.exists():
            continue
        for path in base.rglob("*.png"):
            if path.is_file():
                yield path


def optimize_png(path: Path) -> tuple[int, int]:
    before = path.stat().st_size

    # Pillow re-encodes PNG losslessly; `optimize=True` + max compression often reduces size.
    with Image.open(path) as img:
        img.load()
        img.save(path, format="PNG", optimize=True, compress_level=9)

    after = path.stat().st_size
    return before, after


def main() -> int:
    total_before = 0
    total_after = 0
    touched = 0

    for png in iter_pngs(TARGET_DIRS):
        before, after = optimize_png(png)
        total_before += before
        total_after += after
        touched += 1

    delta = total_before - total_after
    pct = (delta / total_before * 100.0) if total_before else 0.0
    print(
        f"Optimized {touched} PNGs: {total_before} -> {total_after} bytes "
        f"(-{delta} bytes, {pct:.2f}%)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


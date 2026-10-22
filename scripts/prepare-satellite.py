#!/usr/bin/env python3
"""Build the offline Trentino orthophoto pyramid (Python 3 + Pillow).

Source: Provincia autonoma di Trento, Ortofoto Digitale 2015, CC BY 3.0 IT.
One 1024 px tile at URL zoom 12 has the resolution of standard zoom 14.
Run with --estimate to inspect the bounded download before requesting imagery.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from io import BytesIO
import json
import math
from pathlib import Path
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from PIL import Image, ImageDraw, ImageStat


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/maps/satellite"
BOUNDARY = ROOT / "public/maps/trentino.geojson"
CACHE = Path("/tmp/trentino-ortofoto-mosaics")
WMS = "https://siat.provincia.tn.it/geoserver/stem/ecw-rgb-2015/wms"
SOURCE_PAGE = "https://www.provincia.tn.it/News/Approfondimenti/Ortofoto-digitale-2015"
LICENSE = "https://siatservices.provincia.tn.it/idt/raster/ortofoto_2015_pat/licenza.pdf"
TILE_SIZE = 1024
MIN_ZOOM = 6
MAX_ZOOM = 12
MERCATOR_LIMIT = 20037508.342789244


def projected(lng, lat, zoom):
    scale = (2 ** zoom) * TILE_SIZE
    return ((lng + 180) / 360 * scale,
            (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * scale)


def tile_ranges(bounds, zoom):
    west, south, east, north = bounds
    left, top = projected(west, north, zoom)
    right, bottom = projected(east, south, zoom)
    return (range(math.floor(left / TILE_SIZE), math.floor(right / TILE_SIZE) + 1),
            range(math.floor(top / TILE_SIZE), math.floor(bottom / TILE_SIZE) + 1))


def polygon_mask(polygons, x, y, size=TILE_SIZE):
    mask = Image.new("L", (size, size))
    draw = ImageDraw.Draw(mask)
    for rings in polygons:
        for index, ring in enumerate(rings):
            draw.polygon([(px - x * TILE_SIZE, py - y * TILE_SIZE) for px, py in ring],
                         fill=255 if index == 0 else 0)
    return mask


def download_mosaic(x, y):
    """Fetch one 2048 px image covering two native tiles per side."""
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / f"{MAX_ZOOM}-{x}-{y}.jpg"
    if cached.exists():
        return cached.read_bytes()
    span = MERCATOR_LIMIT * 2 / (2 ** MAX_ZOOM)
    bbox = (x * span - MERCATOR_LIMIT, MERCATOR_LIMIT - (y + 2) * span,
            (x + 2) * span - MERCATOR_LIMIT, MERCATOR_LIMIT - y * span)
    query = urlencode({
        "service": "WMS", "version": "1.1.1", "request": "GetMap",
        "layers": "ecw-rgb-2015", "styles": "", "srs": "EPSG:3857",
        "bbox": ",".join(str(value) for value in bbox),
        "width": TILE_SIZE * 2, "height": TILE_SIZE * 2, "format": "image/jpeg",
    })
    request = Request(f"{WMS}?{query}", headers={
        "User-Agent": "TrentinoFaunaOfflineMap/1.0 (open-data orthophoto preparation)",
    })
    for attempt in range(3):
        try:
            with urlopen(request, timeout=45) as response:
                payload = response.read()
            with Image.open(BytesIO(payload)) as image:
                if image.size != (TILE_SIZE * 2, TILE_SIZE * 2):
                    raise ValueError(f"Unexpected WMS image size: {image.size}")
                image.verify()
            cached.write_bytes(payload)
            return payload
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 ** (attempt + 1))


def save_tile(image, zoom, x, y, quality):
    destination = OUTPUT / str(zoom) / str(x) / f"{y}.webp"
    destination.parent.mkdir(parents=True, exist_ok=True)
    if image.getchannel("A").getbbox() is None:
        # Transparent tiles inside the rectangular extent prevent offline 404s.
        image.save(destination, "WEBP", lossless=True, method=4)
    else:
        image.save(destination, "WEBP", quality=quality, method=4)
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--estimate", action="store_true")
    parser.add_argument("--workers", type=int, choices=range(1, 5), default=2)
    parser.add_argument("--quality", type=int, choices=range(1, 101), default=68)
    args = parser.parse_args()
    data = json.loads(BOUNDARY.read_text())
    boundary = next(feature["geometry"] for feature in data["features"]
                    if feature["properties"]["kind"] == "boundary")
    coordinates = boundary["coordinates"]
    if boundary["type"] == "Polygon":
        coordinates = [coordinates]
    elif boundary["type"] != "MultiPolygon":
        raise ValueError("Province boundary must be a polygon")
    polygons = [[[projected(lng, lat, MAX_ZOOM) for lng, lat in ring]
                 for ring in polygon] for polygon in coordinates]
    bounds = data["bbox"]
    xs, ys = tile_ranges(bounds, MAX_ZOOM)
    native = []
    mosaics = set()
    covered_pixels = 0
    for x in xs:
        for y in ys:
            native.append((x, y))
            mask = polygon_mask(polygons, x, y)
            if mask.getbbox():
                mosaics.add((x // 2 * 2, y // 2 * 2))
                covered_pixels += mask.histogram()[255]
    all_tile_count = sum(len(xr) * len(yr) for xr, yr in
                         (tile_ranges(bounds, zoom) for zoom in range(MIN_ZOOM, MAX_ZOOM + 1)))
    print(json.dumps({
        "nativeTilesInRectangle": len(native), "totalTiles": all_tile_count,
        "remoteMosaicRequests": len(mosaics), "concurrentRequests": args.workers,
        "nativeCoveredPixels": covered_pixels,
        "estimatedPackageMB": round(covered_pixels * 0.30 * 4 / 3 / 1_000_000, 1),
        "nativeGroundResolutionMeters": 6.6,
    }), flush=True)
    if args.estimate:
        return
    OUTPUT.mkdir(parents=True, exist_ok=True)
    valid_tiles = set(native)
    # Blank tiles need no remote request and reveal no imagery outside Trentino.
    for x, y in native:
        if not polygon_mask(polygons, x, y).getbbox():
            save_tile(Image.new("RGBA", (TILE_SIZE, TILE_SIZE)), MAX_ZOOM, x, y, args.quality)
    completed = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(download_mosaic, x, y): (x, y) for x, y in sorted(mosaics)}
        for future in as_completed(futures):
            x, y = futures[future]
            mosaic = Image.open(BytesIO(future.result())).convert("RGBA")
            for dx in range(2):
                for dy in range(2):
                    tx, ty = x + dx, y + dy
                    if (tx, ty) not in valid_tiles:
                        continue
                    mask = polygon_mask(polygons, tx, ty)
                    if not mask.getbbox():
                        continue
                    tile = mosaic.crop((dx * TILE_SIZE, dy * TILE_SIZE,
                                        (dx + 1) * TILE_SIZE, (dy + 1) * TILE_SIZE))
                    tile.putalpha(mask)
                    save_tile(tile, MAX_ZOOM, tx, ty, args.quality)
            completed += 1
            print(f"Mosaics: {completed}/{len(mosaics)}", flush=True)
    for zoom in range(MAX_ZOOM - 1, MIN_ZOOM - 1, -1):
        xr, yr = tile_ranges(bounds, zoom)
        for x in xr:
            for y in yr:
                parent = Image.new("RGBA", (TILE_SIZE * 2, TILE_SIZE * 2))
                for dx in range(2):
                    for dy in range(2):
                        path = OUTPUT / str(zoom + 1) / str(x * 2 + dx) / f"{y * 2 + dy}.webp"
                        if path.exists():
                            with Image.open(path) as child:
                                parent.paste(child.convert("RGBA"), (dx * TILE_SIZE, dy * TILE_SIZE))
                save_tile(parent.resize((TILE_SIZE, TILE_SIZE), Image.Resampling.LANCZOS),
                          zoom, x, y, args.quality)
        print(f"Overview zoom {zoom} complete", flush=True)
    for name in ("Trento", "Rovereto", "Riva del Garda", "Cavalese"):
        location = next(feature["geometry"]["coordinates"] for feature in data["features"]
                        if feature["properties"].get("kind") == "place"
                        and feature["properties"].get("name") == name)
        px, py = projected(*location, MAX_ZOOM)
        sample = OUTPUT / str(MAX_ZOOM) / str(math.floor(px / TILE_SIZE)) / f"{math.floor(py / TILE_SIZE)}.webp"
        with Image.open(sample) as image:
            assert image.size == (TILE_SIZE, TILE_SIZE)
            assert image.convert("RGBA").getpixel((int(px % TILE_SIZE), int(py % TILE_SIZE)))[3] > 0, f"Missing imagery at {name}"
            assert max(ImageStat.Stat(image.convert("RGB")).stddev) > 10, f"{name} must contain real photographic detail"
    paths = sorted(OUTPUT.glob("*/*/*.webp"))
    assert len(paths) == all_tile_count, "Incomplete offline tile pyramid"
    total_bytes = sum(path.stat().st_size for path in paths)
    if total_bytes > 80_000_000:
        raise ValueError(f"Package exceeds the agreed 80 MB limit: {total_bytes} bytes")
    manifest = {
        "source": WMS, "sourcePage": SOURCE_PAGE, "year": 2015,
        "license": "CC BY 3.0 IT", "licenseUrl": LICENSE,
        "attribution": "Ortofoto Digitale 2015, Servizio Geologico – Provincia autonoma di Trento; ritaglio e riduzione di risoluzione",
        "tileSize": TILE_SIZE, "minUrlZoom": MIN_ZOOM, "maxUrlZoom": MAX_ZOOM,
        "bounds": [[bounds[1], bounds[0]], [bounds[3], bounds[2]]],
        "totalBytes": total_bytes, "quality": args.quality,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "tiles": ["/" + str(path.relative_to(ROOT / "public")) for path in paths],
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"Verified {len(paths)} tiles, {total_bytes / 1_000_000:.1f} MB; four photographic samples valid", flush=True)


if __name__ == "__main__":
    main()

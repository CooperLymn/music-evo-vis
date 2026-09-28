"""Prepare the RYM album snapshot for interactive visualizations.

Run from anywhere with: python scripts/preprocess.py
Uses only the Python standard library.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "data" / "rym_most_rated_5k_albums.csv"
DEFAULT_OUTPUT = ROOT / "data" / "processed"
MOOD_FILE = ROOT / "config" / "mood_descriptors.txt"
MISSING = {"", "NA"}
UNCLASSIFIED = "Unclassified"
REQUIRED_COLUMNS = {
    "position",
    "release_name",
    "artist_name",
    "release_date",
    "release_type",
    "primary_genres",
    "secondary_genres",
    "descriptors",
    "avg_rating",
    "rating_count",
    "review_count",
}


def read_mood_labels(path: Path) -> list[str]:
    labels = [
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    if not labels or len(labels) != len(set(labels)):
        raise ValueError("Mood list must contain unique, nonempty labels")
    return labels


def split_tags(value: str) -> tuple[list[str], bool, list[str]]:
    """Remove CSV missing markers, detect ellipses, and deduplicate in source order."""
    if value.strip() in MISSING:
        return [], False, []
    tags: list[str] = []
    duplicates: list[str] = []
    seen: set[str] = set()
    truncated = False
    for part in value.split(","):
        tag = part.strip()
        if tag == "...":
            truncated = True
        elif tag and tag != "NA":
            if tag in seen:
                duplicates.append(tag)
            else:
                tags.append(tag)
                seen.add(tag)
    return tags, truncated, duplicates


def read_albums(input_path: Path, mood_labels: list[str]) -> tuple[list[dict], dict]:
    albums: list[dict] = []
    duplicate_tags: list[dict] = []
    seen_positions: set[int] = set()
    album_keys: Counter = Counter()
    mood_set = set(mood_labels)
    missing = Counter()

    with input_path.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        absent = REQUIRED_COLUMNS - set(reader.fieldnames or [])
        if absent:
            raise ValueError(f"Missing CSV columns: {', '.join(sorted(absent))}")

        for row_number, row in enumerate(reader, start=2):
            try:
                position = int(row["position"])
                released = date.fromisoformat(row["release_date"])
                rating = float(row["avg_rating"])
                rating_count = int(row["rating_count"])
                review_count = int(row["review_count"])
            except (TypeError, ValueError) as error:
                raise ValueError(f"Invalid numeric field or date on CSV row {row_number}") from error

            if position in seen_positions:
                raise ValueError(f"Duplicate position {position} on CSV row {row_number}")
            if not (0 <= rating <= 5) or rating_count < 0 or review_count < 0:
                raise ValueError(f"Invalid rating/count on CSV row {row_number}")
            seen_positions.add(position)

            primary, primary_truncated, primary_duplicates = split_tags(row["primary_genres"])
            secondary, secondary_truncated, secondary_duplicates = split_tags(row["secondary_genres"])
            descriptors, descriptor_truncated, descriptor_duplicates = split_tags(row["descriptors"])
            for field, tags in (
                ("primary_genres", primary_duplicates),
                ("secondary_genres", secondary_duplicates),
                ("descriptors", descriptor_duplicates),
            ):
                if tags:
                    duplicate_tags.append({"position": position, "field": field, "tags": tags})
            if primary_truncated or secondary_truncated:
                raise ValueError(f"Unexpected ellipsis in genre tags on CSV row {row_number}")

            if not primary:
                missing["primary_genres"] += 1
            if not secondary:
                missing["secondary_genres"] += 1
            if not descriptors:
                missing["descriptors"] += 1

            title = row["release_name"].strip()
            artist = row["artist_name"].strip()
            if not title or not artist:
                raise ValueError(f"Missing title or artist on CSV row {row_number}")
            album_keys[(title, artist, released.isoformat())] += 1
            albums.append(
                {
                    "id": position,
                    "title": title,
                    "artist": artist,
                    "release_date": released.isoformat(),
                    "year": released.year,
                    "decade": released.year // 10 * 10,
                    "release_type": row["release_type"].strip(),
                    "primary_genres": primary,
                    "secondary_genres": secondary,
                    "descriptors": descriptors,
                    "mood_descriptors": [tag for tag in descriptors if tag in mood_set],
                    "descriptor_list_truncated": descriptor_truncated,
                    "avg_rating": rating,
                    "rating_count": rating_count,
                    "review_count": review_count,
                }
            )

    if not albums:
        raise ValueError("Input CSV contains no albums")
    albums.sort(key=lambda album: album["id"])
    observed_descriptors = {tag for album in albums for tag in album["descriptors"]}
    unused_moods = sorted(mood_set - observed_descriptors)
    if unused_moods:
        raise ValueError(f"Mood labels absent from the CSV: {', '.join(unused_moods)}")

    audit = {
        "source_file": input_path.name,
        "album_count": len(albums),
        "artist_count": len({album["artist"] for album in albums}),
        "earliest_release_date": min(album["release_date"] for album in albums),
        "latest_release_date": max(album["release_date"] for album in albums),
        "albums_by_decade": dict(sorted(Counter(album["decade"] for album in albums).items())),
        "missing_tag_fields": dict(missing),
        "descriptor_ellipsis_album_ids": [
            album["id"] for album in albums if album["descriptor_list_truncated"]
        ],
        "duplicate_tags_within_rows": duplicate_tags,
        "duplicate_album_artist_date": [
            {"title": title, "artist": artist, "release_date": released, "count": count}
            for (title, artist, released), count in album_keys.items()
            if count > 1
        ],
        "position_order_matches_rating_count_order": all(
            left["rating_count"] >= right["rating_count"]
            for left, right in zip(albums, albums[1:])
        ),
        "mood_descriptors": mood_labels,
    }
    return albums, audit


def write_csv(path: Path, fields: list[str], rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def prepare_summaries(albums: list[dict], mood_labels: list[str], output_dir: Path) -> None:
    decade_counts = Counter(album["decade"] for album in albums)
    genre_counts = Counter()
    genre_fractional = defaultdict(float)
    genre_mood_counts = Counter()
    mood_counts = Counter()
    genre_years = defaultdict(list)
    descriptor_counts = Counter()

    for album in albums:
        decade = album["decade"]
        genres = album["primary_genres"] or [UNCLASSIFIED]
        moods = album["mood_descriptors"]
        for genre in genres:
            genre_counts[(decade, genre)] += 1
            genre_fractional[(decade, genre)] += 1 / len(genres)
            genre_years[genre].append(album["year"])
            for mood in moods:
                genre_mood_counts[(decade, genre, mood)] += 1
        for mood in moods:
            mood_counts[(decade, mood)] += 1
        descriptor_counts.update(album["descriptors"])

    decades = sorted(decade_counts)
    write_csv(
        output_dir / "decades.csv",
        ["decade", "album_count", "default_view", "coverage_note"],
        [
            {
                "decade": decade,
                "album_count": decade_counts[decade],
                "default_view": 1960 <= decade <= 2010,
                "coverage_note": (
                    "sparse sample" if decade == 1950 else "incomplete decade" if decade == 2020 else ""
                ),
            }
            for decade in decades
        ],
    )

    write_csv(
        output_dir / "genre_decade.csv",
        ["decade", "genre", "decade_album_count", "album_count", "album_prevalence", "fractional_album_count", "composition_share"],
        [
            {
                "decade": decade,
                "genre": genre,
                "decade_album_count": decade_counts[decade],
                "album_count": count,
                "album_prevalence": f"{count / decade_counts[decade]:.6f}",
                "fractional_album_count": f"{genre_fractional[(decade, genre)]:.6f}",
                "composition_share": f"{genre_fractional[(decade, genre)] / decade_counts[decade]:.6f}",
            }
            for (decade, genre), count in sorted(genre_counts.items())
        ],
    )

    write_csv(
        output_dir / "mood_decade.csv",
        ["decade", "mood", "decade_album_count", "album_count", "album_share"],
        [
            {
                "decade": decade,
                "mood": mood,
                "decade_album_count": decade_counts[decade],
                "album_count": mood_counts[(decade, mood)],
                "album_share": f"{mood_counts[(decade, mood)] / decade_counts[decade]:.6f}",
            }
            for decade in decades
            for mood in mood_labels
        ],
    )

    write_csv(
        output_dir / "genre_mood_decade.csv",
        ["decade", "genre", "mood", "genre_album_count", "album_count", "album_share"],
        [
            {
                "decade": decade,
                "genre": genre,
                "mood": mood,
                "genre_album_count": genre_count,
                "album_count": genre_mood_counts[(decade, genre, mood)],
                "album_share": f"{genre_mood_counts[(decade, genre, mood)] / genre_count:.6f}",
            }
            for (decade, genre), genre_count in sorted(genre_counts.items())
            for mood in mood_labels
        ],
    )

    write_csv(
        output_dir / "genre_inventory.csv",
        ["genre", "album_count", "first_year", "last_year"],
        [
            {
                "genre": genre,
                "album_count": len(years),
                "first_year": min(years),
                "last_year": max(years),
            }
            for genre, years in sorted(genre_years.items(), key=lambda item: (-len(item[1]), item[0]))
        ],
    )
    write_csv(
        output_dir / "descriptor_inventory.csv",
        ["descriptor", "album_count", "selected_mood"],
        [
            {"descriptor": tag, "album_count": count, "selected_mood": tag in mood_labels}
            for tag, count in sorted(descriptor_counts.items(), key=lambda item: (-item[1], item[0]))
        ],
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    mood_labels = read_mood_labels(MOOD_FILE)
    albums, audit = read_albums(args.input, mood_labels)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "albums.json").write_text(
        json.dumps(albums, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    prepare_summaries(albums, mood_labels, args.output_dir)
    (args.output_dir / "quality_report.json").write_text(
        json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Processed {len(albums)} albums into {args.output_dir}")
    print(
        f"Found {len(audit['descriptor_ellipsis_album_ids'])} truncated descriptor lists "
        f"and {audit['missing_tag_fields'].get('primary_genres', 0)} albums without primary genres"
    )


if __name__ == "__main__":
    main()

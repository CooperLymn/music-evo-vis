# Music evolution visualization

An interactive data visualization project about genres and mood descriptors in RateYourMusic's 5,000 most rated albums. See the [project plan](PROJECT_PLAN.md) for the research questions and proposed views.

## View the first prototype

From the project root, run:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000/web/](http://localhost:8000/web/) in a browser. The page reads the processed files directly, so run the preprocessing step below first if `data/processed/` is missing or the source CSV changes. The prototype has no JavaScript package dependencies.

Select a decade, choose a comparison decade, click a specific primary genre in the matrix, and select a mood to update the trend and album list. Click **All moods** above the mood bars to clear the mood selection and see every matching album. The genre selector includes all specific primary genres observed in 1960–2019. The album cards show the most rated matching records, not a representative sample. This first prototype uses the original genre labels; a reviewed broad genre-family mapping is still future work.

## Prepare the data

The preprocessing script uses only Python's standard library:

```bash
python3 scripts/preprocess.py
```

It reads [`data/rym_most_rated_5k_albums.csv`](data/rym_most_rated_5k_albums.csv) and regenerates `data/processed/`. You can pass `--input` and `--output-dir` to use different paths. Edit [`config/mood_descriptors.txt`](config/mood_descriptors.txt) to change the curated mood set, then rerun the script. Every original descriptor except missing markers and the literal `...` remains available in the album-level data.

| Output | Purpose |
| --- | --- |
| `albums.json` | One record per album, with numeric ratings, parsed dates, genre and descriptor arrays, selected mood tags, and a flag for truncated descriptor lists. Suitable for linked album details and filtering. |
| `decades.csv` | Album count and coverage note for each release decade. |
| `genre_decade.csv` | Primary-genre counts and shares by decade. |
| `mood_decade.csv` | Selected mood counts and shares by decade, including zero-count combinations. |
| `genre_mood_decade.csv` | Mood prevalence within each primary genre and decade, including zero-count combinations. |
| `genre_inventory.csv` | All observed primary genres, their album counts, and year ranges; a starting point for a reviewed genre-family mapping. |
| `descriptor_inventory.csv` | All observed descriptors, their album counts, and whether each is in the curated mood set. |
| `quality_report.json` | Data coverage and detected anomalies. |

Shares are fractions from 0 to 1. `album_prevalence` in `genre_decade.csv` is the share of albums carrying a primary genre; these values can sum above 1 because albums can have several primary genres. `composition_share` divides each album's weight equally across its distinct primary genres, so it sums to approximately 1 per decade and can drive a normalized stacked chart. An album without a primary genre appears as `Unclassified` in genre summaries. `album_share` in `mood_decade.csv` uses all albums in that decade as its denominator; in `genre_mood_decade.csv`, it uses albums carrying the primary genre in that decade.

The script removes duplicate tags within a row before counting them. It treats the literal `...` in 11 descriptor lists as a truncation marker, records those album IDs in `quality_report.json`, and excludes the marker from descriptor counts. One album has no primary genre. The raw CSV remains unchanged.

These summaries use the CSV's **specific primary-genre labels**. The broader genre-family mapping proposed in the project plan is an editorial step still to be reviewed; it should not be inferred automatically from genre names. The default comparison range is 1960–2019 because the 1950s have few sampled albums and the 2020s are incomplete in this snapshot.

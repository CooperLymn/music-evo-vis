# The Sound of a Decade

## Project idea

Build an interactive visual story about how genres and mood descriptors vary across release decades in RateYourMusic's 5,000 most rated albums. The experience should invite exploration: select a decade, genre, or mood, then inspect the albums behind the pattern.

**Central question:** How did the genre mix and mood tags of albums popular with RateYourMusic users change across release decades?

**Follow-up questions:**

1. Which genre families became more or less prominent in this collection?
2. Which moods became more or less common, and when?
3. Do mood trends remain when we compare albums within the same genre, or are they partly explained by changes in the genre mix?
4. Which albums illustrate a selected pattern, and which challenge an easy generalization?

The intended claim is about this **RateYourMusic snapshot**, not about all music released in each era or what listeners felt at the time of release.

## Data and early observations

**Source:** [`data/rym_most_rated_5k_albums.csv`](data/rym_most_rated_5k_albums.csv), supplied as a snapshot of RateYourMusic's 5,000 most rated albums. Its `position` column follows `rating_count`, rather than `review_count`.

Each row is an album with a release date, artist, primary and secondary genres, descriptors, average rating, rating count, and review count. The current file has 5,000 rows, release years from 1954 to 2022, 494 distinct primary-genre labels, and 182 distinct descriptor labels. Genres and descriptors are multi-label fields.

An initial lead worth investigating: `melancholic` appears on 9.6% of the sampled 1970s albums, 35.5% of the 2000s albums, and 27.1% of the 2010s albums. This is an observation about tagging within this sample, **not** a conclusion that music as a whole became sadder. The interactive views should help test possible explanations, especially genre composition.

## Audience and experience

The primary audience is classmates who enjoy music but may not know RateYourMusic's genre system. A viewer should be able to move from an overview to a specific, checkable finding in a few interactions:

> "Melancholic became more common in the sampled albums. Does that also happen within Art Rock? Which albums account for the comparison?"

Use a visual style inspired by music culture—album-like typography, restrained colour, and subtle motion—while keeping labels, denominators, and comparisons easy to read. The chart should lead the design, rather than decorative elements.

## Proposed visualization

| View | Encoding and interaction | Question it answers |
| --- | --- | --- |
| Genre timeline | A normalized stacked area chart across decades, with a readable legend and hover values. Select a genre family or decade to filter the other views. | How did the composition of this collection change? |
| Mood map | A genre-family × mood-descriptor heatmap for the selected decade. Compare two decades with side-by-side values or a percentage-point difference mode. Show the album count for every cell. | Which moods characterize a genre in an era, and what changed? |
| Album evidence | A list or grid of albums matching the current selection, with year, artist, original genres, descriptors, and rating details. Allow sorting by release date or rating count. | What actual records lie behind the aggregate pattern? |

If time permits, add a focused trend line for one selected mood within one selected genre. This is more useful than a broad "sentiment score" because the original descriptors remain interpretable.

### Core interactions

- Select a decade in the timeline; all views update together.
- Select a genre family and a mood descriptor; show its percentage and denominator over time.
- Choose two decades to compare; keep colour scales and denominators consistent.
- Click a heatmap cell or trend point to see its contributing albums.
- Offer a one-click reset and explain the current filters in plain language.

## Data preparation and measurement

1. **Audit the CSV.** Check dates, duplicates, missing genre values, tag spelling, and unusual descriptor values. Record any corrections in a short data dictionary.
2. **Split multi-label fields.** Preserve the original labels for album details. Keep primary and secondary genres distinct; use primary genres for the main timeline, with secondary genres available in details or an optional exploration mode.
3. **Create a documented genre-family map.** Group primary genres into a small set of broad families suitable for an overview, plus `Other / unmapped`. Review ambiguous labels manually. An album with primary genres in several families contributes a total weight of one to the timeline, divided equally among its distinct mapped families; an album with several labels in one family contributes once to that family.
4. **Curate mood descriptors.** Start with about 10–15 labels that clearly describe mood or affect, such as `melancholic`, `anxious`, `playful`, and `uplifting`. Do not combine moods with themes (`love`), instrumentation, or production traits (`lo-fi`) in a single sentiment scale. Document the inclusion rule and allow individual descriptor exploration.
5. **Use a clear denominator.** Mood prevalence is `albums carrying the descriptor / albums in the selected decade and genre`. One album counts once per descriptor, even if it has multiple genres. Show `n` alongside percentages and mark low-count cells rather than implying precision.
6. **Handle uneven time coverage.** Use 1960–2019 as the default complete-decade range. The 1950s contain only 37 albums in the sample; the 2020s are incomplete (the latest release in the file is dated 2022-02-18). Show either period only as a clearly marked option.
7. **Keep ratings in context.** `avg_rating`, `rating_count`, and `review_count` can enrich album details. Do not weight the main genre or mood trends by rating, because that would answer a different question and further favor already prominent albums.

## Work plan

| Phase | Output | Completion check |
| --- | --- | --- |
| 1. Data audit and question refinement | Data dictionary, genre-family map, mood list, and several exploratory plots | The group agrees on exact definitions, denominators, and the main story. |
| 2. Visual prototype | Static mockup of the three linked views | A classmate can identify what a colour, percentage, and selected state mean. |
| 3. Interactive build | Data-processing script and working visualization | Filters propagate correctly, counts match the CSV, and album examples match the selected cell. |
| 4. Evaluation and polish | Revised design, brief methods/limitations note, and presentation | Test viewers can answer the three follow-up questions without verbal guidance. |

Python can preprocess the CSV into compact tables or JSON; a browser-based charting tool such as Observable Plot can render the charts, with custom code for coordinated selection. Choose the front-end stack after the static prototype establishes the needed interactions.

## Evaluation and deliverables

**Minimum viable project:** the genre timeline, mood map, linked album evidence, and one decade comparison, all with labelled metrics and a short methodology section. A polished opening animation or extra chart is optional.

Test the prototype with a few classmates using tasks such as:

1. Find a mood descriptor that became more common between two decades.
2. Check whether that change also appears within a selected genre family.
3. Name two albums supporting the observation and state how many albums were in the comparison.

Record where people misread a chart or lose track of filters, then revise those parts. The final hand-in should include the interactive visualization, source code, data-processing instructions, a short account of design choices, and limitations. Adjust these deliverables to the course syllabus once its exact requirements are available.

## Interpretation limits

- The 5,000 most rated albums are a selected, popularity-skewed subset of RateYourMusic, not a representative sample of all released music.
- The tags are community descriptions in the dataset snapshot. They may reflect later interpretations of older albums, and genre labels can change meaning over time.
- Descriptor presence says that a tag was assigned, not how strongly listeners felt that mood or whether the whole album has it.
- Albums may belong to multiple genres and carry multiple moods. The genre-family mapping and any weighting choices must be visible in the methods.
- Associations across decades and genres are descriptive; the visualization should not claim that one genre *caused* a mood trend.

## Design references

- [Byron and Wattenberg, *Stacked Graphs—Geometry & Aesthetics*](https://leebyron.com/streamgraph/): inspiration for a compelling temporal overview, with attention to legibility.
- [Observable Plot area mark documentation](https://observablehq.com/@observablehq/plot-area): an implementation reference for stacked area charts.
- [Lewis, Negro, and Guler, *Accounting for Retrospective Bias in Classification Systems of Cultural Products*](https://journals.aom.org/doi/10.5465/amd.2024.0261): a general caution about using later category labels to interpret earlier cultural products.

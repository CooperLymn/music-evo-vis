"use strict";

const DECADES = [1960, 1970, 1980, 1990, 2000, 2010];
const PALETTE = [
  ["#596e64", "#d9f27a"],
  ["#596a91", "#b5c8ff"],
  ["#866c61", "#e5ac83"],
  ["#696c7e", "#b9c7cb"],
  ["#677950", "#d2e791"],
  ["#856b82", "#edb9da"],
  ["#647b7b", "#a9d9d0"],
  ["#86795c", "#ecdfae"],
];

const state = {
  decade: 2000,
  compare: 1970,
  genre: "",
  mood: "melancholic",
  requireMood: true,
};

let albums = [];
let moodLabels = [];
let allGenres = [];
let topGenres = [];
const groupCache = new Map();

const $ = (selector) => document.querySelector(selector);
const decadeLabel = (decade) => `${decade}s`;
const percent = (fraction) => `${(fraction * 100).toFixed(1)}%`;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

function group(decade, genre = "") {
  const key = `${decade}\u0000${genre}`;
  if (!groupCache.has(key)) {
    groupCache.set(key, albums.filter((album) =>
      album.decade === decade && (!genre || album.primary_genres.includes(genre))
    ));
  }
  return groupCache.get(key);
}

function moodStats(decade, genre, mood) {
  const selected = group(decade, genre);
  const count = selected.reduce((total, album) => total + Number(album.mood_descriptors.includes(mood)), 0);
  return { count, total: selected.length, share: selected.length ? count / selected.length : null };
}

function genreStats(decade, genre) {
  const selected = group(decade);
  const count = selected.reduce((total, album) => total + Number(album.primary_genres.includes(genre)), 0);
  return { count, total: selected.length, share: count / selected.length };
}

function setDecade(decade) {
  state.decade = decade;
  if (state.compare === decade) state.compare = decade === 1970 ? 1960 : 1970;
  render();
}

function renderDecadeControls() {
  $("#decadeButtons").innerHTML = DECADES.map((decade) => {
    const count = group(decade).length;
    return `<button class="decade-button ${state.decade === decade ? "is-active" : ""} ${state.compare === decade ? "is-compare" : ""}" type="button" data-decade="${decade}" aria-pressed="${state.decade === decade}"><strong>${decadeLabel(decade)}</strong><small>${count.toLocaleString()} ALBUMS</small></button>`;
  }).join("");
  $("#decadeButtons").querySelectorAll("[data-decade]").forEach((button) => {
    button.addEventListener("click", () => setDecade(Number(button.dataset.decade)));
  });
  $("#compareDecade").value = String(state.compare);
  $("#genreSelect").value = state.genre;
  $("#requireMood").checked = Boolean(state.mood && state.requireMood);
  $("#moodFilterLabel").hidden = !state.mood;
}

function renderStat() {
  $("#statContext").textContent = decadeLabel(state.decade);
  $("#compareLabel").textContent = decadeLabel(state.compare);
  if (!state.mood) {
    const current = group(state.decade, state.genre);
    const comparison = group(state.compare, state.genre);
    $("#statPercent").textContent = current.length.toLocaleString();
    $("#statDescription").textContent = `albums in ${state.genre || "all genres"}, regardless of mood`;
    $("#statCountHeading").textContent = "COMPARE DECADE";
    $("#statCount").textContent = comparison.length.toLocaleString();
    $("#statCountLabel").textContent = `matching albums in the ${decadeLabel(state.compare)}`;
    if (state.genre) {
      const currentShare = current.length / group(state.decade).length;
      const comparisonShare = comparison.length / group(state.compare).length;
      const difference = (currentShare - comparisonShare) * 100;
      $("#statDelta").textContent = `${difference >= 0 ? "+" : ""}${difference.toFixed(1)} pp`;
      $("#statDeltaLabel").textContent = "change in genre prevalence";
    } else {
      $("#statDelta").textContent = "—";
      $("#statDeltaLabel").textContent = "choose a mood or genre to compare rates";
    }
    return;
  }
  const current = moodStats(state.decade, state.genre, state.mood);
  const comparison = moodStats(state.compare, state.genre, state.mood);
  $("#statPercent").textContent = current.share === null ? "—" : percent(current.share);
  $("#statDescription").textContent = `of ${state.genre || "all"} albums tagged ${state.mood}`;
  $("#statCountHeading").textContent = "THE COUNT";
  $("#statCount").textContent = `${current.count} / ${current.total}`;
  $("#statCountLabel").textContent = "tagged albums / selected albums";
  $("#statDelta").textContent = current.share === null || comparison.share === null
    ? "—"
    : `${(current.share * 100 - comparison.share * 100) >= 0 ? "+" : ""}${(current.share * 100 - comparison.share * 100).toFixed(1)} pp`;
  $("#statDeltaLabel").textContent = "percentage-point difference";
}

function renderGenreMatrix() {
  const visible = state.genre && !topGenres.includes(state.genre)
    ? [...topGenres, state.genre]
    : topGenres;
  const headers = `<div class="matrix-head">GENRE / DECADE</div>${DECADES.map((decade) => `<div class="matrix-head ${state.decade === decade ? "is-active" : ""}">${decadeLabel(decade)}</div>`).join("")}`;
  const rows = visible.map((genre) => {
    const label = `<button class="matrix-label ${state.genre === genre ? "is-selected" : ""}" type="button" data-genre="${escapeHtml(genre)}" aria-pressed="${state.genre === genre}" title="Filter by ${escapeHtml(genre)}">${escapeHtml(genre)}</button>`;
    const cells = DECADES.map((decade) => {
      const stats = genreStats(decade, genre);
      const strength = Math.min(92, Math.round(stats.share * 330));
      return `<button type="button" class="matrix-cell ${state.decade === decade ? "is-active" : ""} ${state.compare === decade ? "is-compare" : ""} ${state.genre === genre ? "is-selected-row" : ""}" style="--strength:${strength}" data-genre="${escapeHtml(genre)}" data-decade="${decade}" aria-label="${escapeHtml(genre)}, ${decadeLabel(decade)}: ${percent(stats.share)}, ${stats.count} of ${stats.total} albums" title="${escapeHtml(genre)} · ${decadeLabel(decade)} · ${stats.count} of ${stats.total} albums">${stats.count ? percent(stats.share) : "—"}</button>`;
    }).join("");
    return label + cells;
  }).join("");
  $("#genreMatrix").innerHTML = headers + rows;
  $("#genreMatrix").querySelectorAll("[data-genre]").forEach((button) => {
    button.addEventListener("click", () => {
      const genre = button.dataset.genre;
      state.genre = state.genre === genre && !button.dataset.decade ? "" : genre;
      if (button.dataset.decade) setDecade(Number(button.dataset.decade));
      else render();
    });
  });
}

function renderMoodBars() {
  const entries = moodLabels.map((mood) => ({
    mood,
    current: moodStats(state.decade, state.genre, mood),
    comparison: moodStats(state.compare, state.genre, mood),
  })).sort((a, b) => (b.current.share ?? -1) - (a.current.share ?? -1));
  const maxObserved = Math.max(...entries.flatMap((entry) => [entry.current.share ?? 0, entry.comparison.share ?? 0]));
  const scale = Math.min(100, Math.max(40, Math.ceil(maxObserved * 10) * 10));
  $("#moodScaleMax").textContent = `${scale}%`;
  $("#moodBarsTitle").textContent = `MOODS IN THE ${decadeLabel(state.decade).toUpperCase()}${state.genre ? ` · ${state.genre.toUpperCase()}` : ""}`;
  $("#allMoods").classList.toggle("is-active", !state.mood);
  $("#allMoods").setAttribute("aria-pressed", String(!state.mood));
  $("#allMoods span").textContent = state.mood ? "×" : "✓";
  $("#moodChoiceHelp").textContent = state.mood
    ? "Clear the mood filter to see every album."
    : "Every album matching the decade and genre is shown below.";
  $("#selectedMoodLegend").hidden = !state.mood;
  $("#moodBars").innerHTML = entries.map(({ mood, current, comparison }) => {
    const currentWidth = current.share === null ? 0 : Math.min(100, current.share * 10000 / scale);
    const comparisonLeft = comparison.share === null ? null : Math.min(100, comparison.share * 10000 / scale);
    return `<button class="mood-row ${state.mood === mood ? "is-selected" : ""}" type="button" data-mood="${escapeHtml(mood)}" aria-pressed="${state.mood === mood}" title="${escapeHtml(mood)}: ${current.count} of ${current.total} albums in the ${decadeLabel(state.decade)}; ${comparison.count} of ${comparison.total} in the ${decadeLabel(state.compare)}"><span class="mood-name">${escapeHtml(mood)}</span><span class="mood-track"><span class="mood-bar" style="width:${currentWidth}%"></span>${comparisonLeft === null ? "" : `<span class="mood-compare" style="left:${comparisonLeft}%"></span>`}</span><span class="mood-value">${current.share === null ? "—" : percent(current.share)}</span></button>`;
  }).join("");
  $("#moodBars").querySelectorAll("[data-mood]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.mood) state.requireMood = true;
      state.mood = button.dataset.mood;
      render();
    });
  });
}

function pointsToPaths(points, cssClass, x, y) {
  const paths = [];
  let segment = [];
  const flush = () => {
    if (segment.length > 1) paths.push(`<path class="${cssClass}" d="${segment.map((point, index) => `${index ? "L" : "M"}${x(point.decade).toFixed(1)},${y(point.share).toFixed(1)}`).join(" ")}"/>`);
    segment = [];
  };
  for (const point of points) {
    if (point.share === null) flush();
    else segment.push(point);
  }
  flush();
  return paths.join("");
}

function renderTrend() {
  if (!state.mood) {
    $("#trendChart").innerHTML = `<circle cx="310" cy="151" r="94" fill="none" stroke="#38433d" stroke-width="1"/><circle cx="310" cy="151" r="69" fill="none" stroke="#38433d" stroke-width="1"/><circle cx="310" cy="151" r="44" fill="none" stroke="#38433d" stroke-width="1"/><text class="axis-label" x="310" y="155" text-anchor="middle">ALL MOODS</text><text class="axis-label" x="310" y="295" text-anchor="middle">SELECT A MOOD BAR TO DRAW ITS TREND</text>`;
    $("#trendChart").setAttribute("aria-label", "All moods are included. Select a mood to see its trend over time.");
    $("#trendTitle").textContent = "ALL MOODS IN VIEW";
    $("#trendLegend").innerHTML = "";
    $("#trendNote").textContent = "The album results include every mood. Select a mood from the bars to trace its share across decades.";
    $("#moodIntro").textContent = "All albums are in view, regardless of mood. The bars still show how common each descriptor is in the selected decade.";
    return;
  }
  const overall = DECADES.map((decade) => ({ decade, ...moodStats(decade, "", state.mood) }));
  const selected = state.genre ? DECADES.map((decade) => {
    const stats = moodStats(decade, state.genre, state.mood);
    return { decade, ...stats, share: stats.total < 10 ? null : stats.share };
  }) : [];
  const maxObserved = Math.max(...[...overall, ...selected].map((point) => point.share ?? 0));
  const maxY = Math.min(1, Math.max(.4, Math.ceil(maxObserved * 10) / 10));
  const left = 52, right = 590, top = 27, bottom = 275;
  const x = (decade) => left + DECADES.indexOf(decade) * (right - left) / (DECADES.length - 1);
  const y = (share) => bottom - share / maxY * (bottom - top);
  const ticks = [0, maxY / 2, maxY];
  const grid = ticks.map((tick) => `<line class="gridline" x1="${left}" x2="${right}" y1="${y(tick).toFixed(1)}" y2="${y(tick).toFixed(1)}"/><text class="axis-label" x="${left - 10}" y="${(y(tick) + 4).toFixed(1)}" text-anchor="end">${Math.round(tick * 100)}%</text>`).join("");
  const labels = DECADES.map((decade) => `<text class="axis-label" x="${x(decade).toFixed(1)}" y="306" text-anchor="middle">${decadeLabel(decade)}</text>`).join("");
  const dots = (points, cssClass, label) => points.filter((point) => point.share !== null).map((point) => `<circle class="${cssClass}" cx="${x(point.decade).toFixed(1)}" cy="${y(point.share).toFixed(1)}" r="5"><title>${escapeHtml(label)} · ${decadeLabel(point.decade)} · ${point.count} of ${point.total} (${percent(point.share)})</title></circle>`).join("");
  $("#trendChart").innerHTML = `<rect class="highlight" x="${(x(state.decade) - 30).toFixed(1)}" y="${top}" width="60" height="${bottom - top}"/>${grid}${labels}${pointsToPaths(overall, "overall-line", x, y)}${pointsToPaths(selected, "genre-line", x, y)}${dots(overall, "overall-dot", "All albums")}${dots(selected, "genre-dot", state.genre)}`;
  $("#trendChart").setAttribute("aria-label", `${state.mood} prevalence by decade${state.genre ? `, comparing ${state.genre} with all albums` : ""}`);
  $("#trendTitle").textContent = `${state.mood.toUpperCase()} THROUGH TIME`;
  $("#trendLegend").innerHTML = `<span><i class="legend-square overall"></i> ALL ALBUMS</span>${state.genre ? `<span><i class="legend-square genre"></i> ${escapeHtml(state.genre.toUpperCase())}</span>` : ""}`;
  $("#trendNote").textContent = "Lines show the share of albums with this exact descriptor. Genre points with fewer than 10 albums are omitted.";
  $("#moodIntro").textContent = state.genre
    ? `Compare ${state.genre} with all albums. A genre point appears only when at least 10 sampled albums exist in that decade.`
    : "Select a descriptor to trace its share across release decades. Choose a primary genre to compare it with all albums.";
}

function renderAlbums() {
  const matches = group(state.decade, state.genre).filter((album) =>
    !state.mood || !state.requireMood || album.mood_descriptors.includes(state.mood)
  );
  const sorted = [...matches].sort((a, b) => b.rating_count - a.rating_count || a.id - b.id);
  $("#albumCount").textContent = `${matches.length.toLocaleString()} MATCHING ALBUMS · SHOWING ${Math.min(8, matches.length)} MOST RATED`;
  if (!sorted.length) {
    $("#albumGrid").innerHTML = `<div class="empty-state">No albums match these filters. Try another decade, genre, or mood.</div>`;
    return;
  }
  $("#albumGrid").innerHTML = sorted.slice(0, 8).map((album, index) => {
    const [background, accent] = PALETTE[index % PALETTE.length];
    const visibleMoods = album.mood_descriptors.includes(state.mood)
      ? [state.mood, ...album.mood_descriptors.filter((tag) => tag !== state.mood)].slice(0, 2)
      : album.mood_descriptors.slice(0, 2);
    const tags = [
      ...album.primary_genres.slice(0, 2).map((tag) => `<span>${escapeHtml(tag)}</span>`),
      ...visibleMoods.map((tag) => `<span class="${tag === state.mood ? "is-mood" : ""}">${escapeHtml(tag)}</span>`),
    ].join("");
    return `<article class="album-card"><div class="album-art" style="--art-color:${background};--art-accent:${accent}"><span class="album-art-index">NO. ${String(index + 1).padStart(2, "0")}</span><div class="mini-record" aria-hidden="true"></div><span class="album-art-year">${album.year}</span></div><div class="album-info"><h3>${escapeHtml(album.title)}</h3><p class="album-artist">${escapeHtml(album.artist)}</p><div class="album-tags">${tags}</div><div class="album-rating"><span>RYM RATING <strong>${album.avg_rating.toFixed(2)} / 5</strong></span><span>${album.rating_count.toLocaleString()} ratings</span></div></div></article>`;
  }).join("");
}

function render() {
  renderDecadeControls();
  renderStat();
  renderGenreMatrix();
  renderMoodBars();
  renderTrend();
  renderAlbums();
}

async function init() {
  try {
    const [albumResponse, reportResponse] = await Promise.all([
      fetch("../data/processed/albums.json"),
      fetch("../data/processed/quality_report.json"),
    ]);
    if (!albumResponse.ok || !reportResponse.ok) throw new Error("Processed data files could not be loaded.");
    [albums, { mood_descriptors: moodLabels }] = await Promise.all([
      albumResponse.json(), reportResponse.json(),
    ]);
    if (!Array.isArray(albums) || !albums.length || !Array.isArray(moodLabels)) throw new Error("Processed data has an unexpected format.");

    const genreCounts = new Map();
    for (const album of albums) {
      if (!DECADES.includes(album.decade)) continue;
      for (const genre of album.primary_genres) genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
    allGenres = [...genreCounts.keys()].sort((a, b) => (genreCounts.get(b) - genreCounts.get(a)) || a.localeCompare(b));
    topGenres = allGenres.slice(0, 12);
    $("#genreSelect").innerHTML = `<option value="">All genres</option>${allGenres.map((genre) => `<option value="${escapeHtml(genre)}">${escapeHtml(genre)}</option>`).join("")}`;
    $("#compareDecade").innerHTML = DECADES.map((decade) => `<option value="${decade}">${decadeLabel(decade)}</option>`).join("");

    $("#compareDecade").addEventListener("change", (event) => { state.compare = Number(event.target.value); render(); });
    $("#genreSelect").addEventListener("change", (event) => { state.genre = event.target.value; render(); });
    $("#requireMood").addEventListener("change", (event) => { state.requireMood = event.target.checked; renderAlbums(); });
    $("#allMoods").addEventListener("click", () => {
      state.mood = "";
      state.requireMood = false;
      render();
    });
    $("#resetFilters").addEventListener("click", () => {
      Object.assign(state, { decade: 2000, compare: 1970, genre: "", mood: "melancholic", requireMood: true });
      render();
    });
    render();
  } catch (error) {
    const message = $("#loadError");
    message.hidden = false;
    message.textContent = `${error.message} Start a local server from the project root with “python3 -m http.server 8000”, then open http://localhost:8000/web/.`;
  }
}

init();

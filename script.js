const OMDB_BASE = 'https://www.omdbapi.com/';
const OMDB_API_KEY = "d23a7494";
const PLACEHOLDER_POSTER = 'https://via.placeholder.com/300x450/1a1f2b/f2f4f8?text=No+Poster';

const state = {
  movies: [],
  layout: localStorage.getItem('watchHavenLayout') || 'list',
  searchTerm: '',
  pendingMovieTitle: null,
  pendingOmdbResults: [],
  recommendations: []
};

const els = {
  movieInput: document.getElementById('movieInput'),
  addMovieBtn: document.getElementById('addMovieBtn'),
  searchInput: document.getElementById('searchInput'),
  movieCounter: document.getElementById('movieCounter'),
  movieList: document.getElementById('movieList'),
  emptyState: document.getElementById('emptyState'),
  clearWatchedBtn: document.getElementById('clearWatchedBtn'),
  layoutToggleBtn: document.getElementById('layoutToggleBtn'),
  shareWatchlistBtn: document.getElementById('shareWatchlistBtn'),
  sharePanel: document.getElementById('sharePanel'),
  closeSharePanel: document.getElementById('closeSharePanel'),
  shareMessage: document.getElementById('shareMessage'),
  shareLinkBtn: document.getElementById('shareLinkBtn'),
  shareImageBtn: document.getElementById('shareImageBtn'),
  sharePdfBtn: document.getElementById('sharePdfBtn'),
  posterSelector: document.getElementById('posterSelector'),
  selectorMovieLabel: document.getElementById('selectorMovieLabel'),
  posterGrid: document.getElementById('posterGrid'),
  customPosterInput: document.getElementById('customPosterInput'),
  closePosterSelector: document.getElementById('closePosterSelector'),
  template: document.getElementById('movieCardTemplate'),
  recommendations: document.getElementById('recommendations'),
  recommendationGrid: document.getElementById('recommendationGrid')
};

function persist() {
  localStorage.setItem('watchHavenMovies', JSON.stringify(state.movies));
  localStorage.setItem('watchHavenLayout', state.layout);
}

function parseRatings(ratingsArr = []) {
  const imdb = ratingsArr.find((r) => r.Source === 'Internet Movie Database')?.Value || 'N/A';
  const rotten = ratingsArr.find((r) => r.Source === 'Rotten Tomatoes')?.Value || 'N/A';
  return { imdb, rotten };
}

function normalizeMovie(movie) {
  return {
    id: movie.id || crypto.randomUUID(),
    title: movie.title || movie.Title || 'Untitled',
    year: movie.year || movie.Year || '',
    poster: movie.poster || movie.Poster || PLACEHOLDER_POSTER,
    imdbID: movie.imdbID || '',
    watched: !!movie.watched,
    ratings: movie.ratings || parseRatings(movie.Ratings || []),
    rated: movie.rated || movie.Rated || ''
  };
}

function safeDecode(encoded) {
  try {
    return JSON.parse(decodeURIComponent(atob(encoded)));
  } catch {
    return null;
  }
}

function encodeSharePayload(data) {
  const base64 = btoa(encodeURIComponent(JSON.stringify(data)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeSharePayload(payload) {
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return safeDecode(padded);
}

function load() {
  const urlData = new URLSearchParams(window.location.search).get('wl');
  if (urlData) {
    const decoded = decodeSharePayload(urlData);
    if (Array.isArray(decoded)) {
      state.movies = decoded.map(normalizeMovie);
      persist();
      return;
    }
  }

  const raw = JSON.parse(localStorage.getItem('watchHavenMovies') || '[]');
  state.movies = Array.isArray(raw) ? raw.map(normalizeMovie) : [];
}

function updateCounter(filteredCount = null) {
  const count = filteredCount ?? state.movies.length;
  els.movieCounter.textContent = `${count} movie${count === 1 ? '' : 's'} in watchlist`;
}

function applyLayout() {
  const listView = state.layout === 'list';
  els.movieList.classList.toggle('list-view', listView);
  els.movieList.classList.toggle('grid-view', !listView);
  els.layoutToggleBtn.textContent = listView ? 'Switch to Grid View' : 'Switch to List View';
}

function getFilteredMovies() {
  const q = state.searchTerm.trim().toLowerCase();
  if (!q) return state.movies;
  return state.movies.filter((m) => `${m.title} ${m.year || ''}`.toLowerCase().includes(q));
}

function ratingsHtml(ratings) {
  return `
    <p class="rating-line">IMDb: ${ratings?.imdb || 'N/A'}</p>
    <p class="rating-line">Rotten Tomatoes: ${ratings?.rotten || 'N/A'}</p>
  `;
}

function createMovieCard(movie) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  const poster = node.querySelector('.movie-poster');
  const title = node.querySelector('.movie-title');
  const meta = node.querySelector('.movie-meta');
  const ratings = node.querySelector('.ratings');
  const watchBtn = node.querySelector('.btn-watch');
  const trailerBtn = node.querySelector('.btn-trailer');
  const deleteBtn = node.querySelector('.btn-delete');

  poster.src = movie.poster || PLACEHOLDER_POSTER;
  poster.alt = `${movie.title} poster`;
  title.textContent = movie.title;
  meta.textContent = [movie.year ? `Year: ${movie.year}` : null, movie.rated ? `Rated: ${movie.rated}` : null].filter(Boolean).join(' • ') || 'Details unavailable';
  ratings.innerHTML = ratingsHtml(movie.ratings);

  node.classList.toggle('watched', movie.watched);
  watchBtn.textContent = movie.watched ? 'Mark as Unwatched' : 'Mark as Watched';

  watchBtn.addEventListener('click', () => {
    movie.watched = !movie.watched;
    persist();
    renderMovies();
  });

  trailerBtn.addEventListener('click', () => {
    const query = encodeURIComponent(`${movie.title} trailer`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank', 'noopener');
  });

  deleteBtn.addEventListener('click', () => {
    node.classList.add('removing');
    setTimeout(() => {
      state.movies = state.movies.filter((m) => m.id !== movie.id);
      persist();
      renderMovies();
      fetchRecommendations();
    }, 230);
  });

  requestAnimationFrame(() => node.classList.remove('entering'));
  return node;
}

function renderMovies() {
  const filtered = getFilteredMovies();
  els.movieList.innerHTML = '';
  filtered.forEach((movie) => els.movieList.appendChild(createMovieCard(movie)));

  els.emptyState.style.display = state.movies.length ? 'none' : 'block';
  updateCounter(filtered.length);
}

async function fetchOmdbSearch(title) {
  const url = `${OMDB_BASE}?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(title)}&type=movie&page=1`;
  const response = await fetch(url);
  const data = await response.json();
  return data.Search ? data.Search.slice(0, 6) : [];
}

async function fetchMovieDetails(imdbID) {
  if (!imdbID) return {};
  const response = await fetch(`${OMDB_BASE}?apikey=${OMDB_API_KEY}&i=${imdbID}&plot=short`);
  const data = await response.json();
  return data && data.Response !== 'False' ? data : {};
}

function showPosterSelector(title, results) {
  state.pendingMovieTitle = title;
  state.pendingOmdbResults = results;
  els.selectorMovieLabel.textContent = `Choose a poster for "${title}"`;
  els.posterGrid.innerHTML = '';

  results.forEach((result) => {
    const option = document.createElement('button');
    option.className = 'poster-option';
    option.innerHTML = `<img src="${result.Poster !== 'N/A' ? result.Poster : PLACEHOLDER_POSTER}" alt="${result.Title} poster" /><p>${result.Title}</p>`;
    option.addEventListener('click', async () => {
      const details = await fetchMovieDetails(result.imdbID);
      finalizeAddMovie(normalizeMovie({
        title: result.Title || title,
        year: result.Year || '',
        rated: details.Rated && details.Rated !== 'N/A' ? details.Rated : '',
        poster: result.Poster !== 'N/A' ? result.Poster : PLACEHOLDER_POSTER,
        imdbID: result.imdbID,
        ratings: parseRatings(details.Ratings || [])
      }));
    });
    els.posterGrid.appendChild(option);
  });

  const skip = document.createElement('button');
  skip.className = 'poster-option';
  skip.innerHTML = `<img src="${PLACEHOLDER_POSTER}" alt="Default poster" /><p>Use Default</p>`;
  skip.addEventListener('click', async () => {
    const searchPick = results[0];
    const details = searchPick ? await fetchMovieDetails(searchPick.imdbID) : {};
    finalizeAddMovie(normalizeMovie({
      title,
      year: searchPick?.Year || '',
      imdbID: searchPick?.imdbID || '',
      ratings: parseRatings(details.Ratings || []),
      rated: details.Rated || '',
      poster: PLACEHOLDER_POSTER
    }));
  });
  els.posterGrid.appendChild(skip);

  els.posterSelector.classList.remove('hidden');
}

function finalizeAddMovie(movie) {
  if (!movie.title.trim()) return;

  const normalized = normalizeMovie(movie);
  const duplicate = state.movies.some((m) =>
    (normalized.imdbID && m.imdbID && normalized.imdbID === m.imdbID) ||
    (m.title.toLowerCase() === normalized.title.toLowerCase() && (m.year || '') === (normalized.year || ''))
  );
  if (duplicate) {
    els.posterSelector.classList.add('hidden');
    els.movieInput.value = '';
    return;
  }

  state.movies.unshift(normalized);
  persist();
  renderMovies();
  fetchRecommendations();
  els.posterSelector.classList.add('hidden');
  els.movieInput.value = '';
}

async function handleAddMovie() {
  const title = els.movieInput.value.trim();
  if (!title) return;
  try {
    const results = await fetchOmdbSearch(title);
    showPosterSelector(title, results);
  } catch {
    showPosterSelector(title, []);
  }
}

function clearWatched() {
  state.movies = state.movies.filter((movie) => !movie.watched);
  persist();
  renderMovies();
  fetchRecommendations();
}

function handleCustomPosterUpload(event) {
  const file = event.target.files[0];
  if (!file || !state.pendingMovieTitle) return;

  const reader = new FileReader();
  reader.onload = async () => {
    const firstResult = state.pendingOmdbResults[0] || {};
    const details = firstResult.imdbID ? await fetchMovieDetails(firstResult.imdbID) : {};
    finalizeAddMovie(normalizeMovie({
      title: firstResult.Title || state.pendingMovieTitle,
      year: firstResult.Year || '',
      rated: details.Rated || '',
      imdbID: firstResult.imdbID || '',
      ratings: parseRatings(details.Ratings || []),
      poster: reader.result
    }));
    els.customPosterInput.value = '';
  };
  reader.readAsDataURL(file);
}

function addRecommendationToWatchlist(rec) {
  const exists = state.movies.some((m) => m.title.toLowerCase() === rec.Title.toLowerCase() && m.year === rec.Year);
  if (exists) return;

  finalizeAddMovie(normalizeMovie({
    title: rec.Title,
    year: rec.Year,
    poster: rec.Poster !== 'N/A' ? rec.Poster : PLACEHOLDER_POSTER,
    imdbID: rec.imdbID,
    rated: rec.Rated || '',
    ratings: rec.parsedRatings || { imdb: 'N/A', rotten: 'N/A' }
  }));
}

async function fetchRecommendations() {
  if (state.movies.length === 0) {
    els.recommendations.classList.add('hidden');
    return;
  }

  const keyword = state.movies[0].title.split(' ')[0];
  if (!keyword) return;

  try {
    const raw = await fetchOmdbSearch(`${keyword} movie`);
    const existing = new Set(state.movies.map((m) => m.title.toLowerCase()));
    const picks = raw.filter((r) => !existing.has(r.Title.toLowerCase())).slice(0, 3);

    const detailed = await Promise.all(
      picks.map(async (pick) => {
        const details = await fetchMovieDetails(pick.imdbID);
        return { ...pick, Rated: details.Rated || '', parsedRatings: parseRatings(details.Ratings || []) };
      })
    );

    state.recommendations = detailed;
    els.recommendationGrid.innerHTML = '';

    detailed.forEach((pick, index) => {
      const card = document.createElement('article');
      card.className = 'rec-card';
      card.style.animation = `rise .35s ease ${index * 80}ms both`;
      card.innerHTML = `
        <img src="${pick.Poster !== 'N/A' ? pick.Poster : PLACEHOLDER_POSTER}" alt="${pick.Title} poster" />
        <p class="rec-title">${pick.Title} (${pick.Year})</p>
        <p class="rating-line">IMDb: ${pick.parsedRatings.imdb}</p>
        <p class="rating-line">Rotten Tomatoes: ${pick.parsedRatings.rotten}</p>
        <div class="rec-actions">
          <button class="btn btn-add">Add to Watchlist</button>
          <button class="btn btn-trailer">Watch Trailer</button>
        </div>
      `;

      card.querySelector('.btn-add').addEventListener('click', () => addRecommendationToWatchlist(pick));
      card.querySelector('.btn-trailer').addEventListener('click', () => {
        const query = encodeURIComponent(`${pick.Title} trailer`);
        window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank', 'noopener');
      });

      els.recommendationGrid.appendChild(card);
    });

    els.recommendations.classList.toggle('hidden', detailed.length === 0);
  } catch {
    els.recommendations.classList.add('hidden');
  }
}

function openSharePanel() {
  els.sharePanel.classList.remove('hidden');
  els.shareMessage.textContent = '';
}

function shareAsLink() {
  if (!state.movies.length) {
    els.shareMessage.textContent = 'Add movies before sharing.';
    return;
  }

  const payload = encodeSharePayload(state.movies);
  const url = `${window.location.origin}${window.location.pathname}?wl=${payload}`;
  navigator.clipboard?.writeText(url)
    .then(() => {
      els.shareMessage.textContent = `Share link copied to clipboard: ${url}`;
    })
    .catch(() => {
      els.shareMessage.textContent = `Copy this share link: ${url}`;
    });
}

function createExportPages() {
  const pageSize = 6;
  const pages = [];
  for (let i = 0; i < state.movies.length; i += pageSize) pages.push(state.movies.slice(i, i + pageSize));
  return pages;
}

function makeExportPageDom(moviesChunk, pageIndex, totalPages) {
  const wrap = document.createElement('section');
  wrap.className = 'export-page';
  wrap.innerHTML = `
    <div class="export-head">
      <h2>WATCH HAVEN</h2>
      <p>Your personal movie sanctuary. • Page ${pageIndex + 1} of ${totalPages}</p>
    </div>
    <div class="export-grid"></div>
  `;
  const grid = wrap.querySelector('.export-grid');

  moviesChunk.forEach((movie) => {
    const item = document.createElement('article');
    item.className = 'export-item';
    item.innerHTML = `
      <img src="${movie.poster || PLACEHOLDER_POSTER}" alt="${movie.title}" />
      <div>
        <strong>${movie.title}</strong><br />
        ${movie.year || 'Year N/A'}<br />
        IMDb: ${movie.ratings?.imdb || 'N/A'}<br />
        Rotten Tomatoes: ${movie.ratings?.rotten || 'N/A'}
      </div>
    `;
    grid.appendChild(item);
  });

  return wrap;
}

async function shareAsImage() {
  if (!state.movies.length) return (els.shareMessage.textContent = 'Add movies before exporting.');

  const pages = createExportPages();
  for (let i = 0; i < pages.length; i += 1) {
    const dom = makeExportPageDom(pages[i], i, pages.length);
    dom.style.position = 'fixed';
    dom.style.left = '-99999px';
    document.body.appendChild(dom);

    const canvas = await html2canvas(dom, { backgroundColor: '#0f1320', scale: 2 });
    dom.remove();

    const link = document.createElement('a');
    link.download = `watch-haven-${i + 1}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  els.shareMessage.textContent = `Generated ${pages.length} image file(s).`;
}

async function shareAsPdf() {
  if (!state.movies.length) return (els.shareMessage.textContent = 'Add movies before exporting.');

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [900, 1600] });
  const pages = createExportPages();

  for (let i = 0; i < pages.length; i += 1) {
    const dom = makeExportPageDom(pages[i], i, pages.length);
    dom.style.position = 'fixed';
    dom.style.left = '-99999px';
    document.body.appendChild(dom);

    const canvas = await html2canvas(dom, { backgroundColor: '#0f1320', scale: 2 });
    dom.remove();

    if (i > 0) pdf.addPage([900, 1600], 'portrait');
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 900, 1600);
  }

  pdf.save('watch-haven-watchlist.pdf');
  els.shareMessage.textContent = `Generated PDF with ${pages.length} page(s).`;
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
  }
}

function bindEvents() {
  els.addMovieBtn.addEventListener('click', handleAddMovie);
  els.movieInput.addEventListener('keydown', (e) => e.key === 'Enter' && handleAddMovie());
  els.searchInput.addEventListener('input', (e) => { state.searchTerm = e.target.value; renderMovies(); });
  els.clearWatchedBtn.addEventListener('click', clearWatched);
  els.layoutToggleBtn.addEventListener('click', () => {
    state.layout = state.layout === 'list' ? 'grid' : 'list';
    persist();
    applyLayout();
  });

  els.shareWatchlistBtn.addEventListener('click', openSharePanel);
  els.closeSharePanel.addEventListener('click', () => els.sharePanel.classList.add('hidden'));
  els.shareLinkBtn.addEventListener('click', shareAsLink);
  els.shareImageBtn.addEventListener('click', shareAsImage);
  els.sharePdfBtn.addEventListener('click', shareAsPdf);

  els.customPosterInput.addEventListener('change', handleCustomPosterUpload);
  els.closePosterSelector.addEventListener('click', () => els.posterSelector.classList.add('hidden'));
}

function init() {
  load();
  bindEvents();
  applyLayout();
  renderMovies();
  fetchRecommendations();
  registerServiceWorker();
}

init();

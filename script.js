const OMDB_BASE = 'https://www.omdbapi.com/';
const PLACEHOLDER_POSTER = 'https://via.placeholder.com/300x450/1a1f2b/f2f4f8?text=No+Poster';

const state = {
  movies: [],
  layout: localStorage.getItem('watchHavenLayout') || 'list',
  searchTerm: '',
  pendingMovieTitle: null,
  pendingOmdbResults: [],
  apiKey: localStorage.getItem('watchHavenOmdbApiKey') || ''
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
  posterSelector: document.getElementById('posterSelector'),
  selectorMovieLabel: document.getElementById('selectorMovieLabel'),
  posterGrid: document.getElementById('posterGrid'),
  customPosterInput: document.getElementById('customPosterInput'),
  closePosterSelector: document.getElementById('closePosterSelector'),
  template: document.getElementById('movieCardTemplate'),
  recommendations: document.getElementById('recommendations'),
  recommendationGrid: document.getElementById('recommendationGrid'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  saveApiKeyBtn: document.getElementById('saveApiKeyBtn')
};

function persist() {
  localStorage.setItem('watchHavenMovies', JSON.stringify(state.movies));
  localStorage.setItem('watchHavenLayout', state.layout);
}

function load() {
  state.movies = JSON.parse(localStorage.getItem('watchHavenMovies') || '[]');
  if (!Array.isArray(state.movies)) state.movies = [];
  els.apiKeyInput.value = state.apiKey;
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

function saveApiKey() {
  state.apiKey = els.apiKeyInput.value.trim();
  localStorage.setItem('watchHavenOmdbApiKey', state.apiKey);
  els.saveApiKeyBtn.textContent = 'Saved';
  setTimeout(() => (els.saveApiKeyBtn.textContent = 'Save Key'), 1200);
}

function createMovieCard(movie) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  const poster = node.querySelector('.movie-poster');
  const title = node.querySelector('.movie-title');
  const meta = node.querySelector('.movie-meta');
  const watchBtn = node.querySelector('.btn-watch');
  const trailerBtn = node.querySelector('.btn-trailer');
  const deleteBtn = node.querySelector('.btn-delete');

  poster.src = movie.poster || PLACEHOLDER_POSTER;
  poster.alt = `${movie.title} poster`;
  title.textContent = movie.title;
  const details = [movie.year ? `Year: ${movie.year}` : null, movie.rating ? `Rated: ${movie.rating}` : null]
    .filter(Boolean)
    .join(' • ');
  meta.textContent = details || 'Details unavailable';

  node.classList.toggle('watched', !!movie.watched);
  watchBtn.textContent = movie.watched ? 'Mark as Unwatched' : 'Mark as Watched';

  watchBtn.addEventListener('click', () => {
    movie.watched = !movie.watched;
    persist();
    renderMovies();
  });

  trailerBtn.addEventListener('click', () => {
    const query = encodeURIComponent(`${movie.title} official trailer`);
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

  return node;
}

function renderMovies() {
  const filtered = getFilteredMovies();
  els.movieList.innerHTML = '';
  filtered.forEach((movie) => {
    els.movieList.appendChild(createMovieCard(movie));
  });

  els.emptyState.style.display = state.movies.length ? 'none' : 'block';
  updateCounter(filtered.length);
}

async function fetchOmdbSearch(title) {
  if (!state.apiKey) return [];
  const url = `${OMDB_BASE}?apikey=${state.apiKey}&s=${encodeURIComponent(title)}&type=movie&page=1`;
  const response = await fetch(url);
  const data = await response.json();
  if (!data.Search) return [];
  return data.Search.slice(0, 6);
}

async function fetchMovieDetails(imdbID) {
  if (!state.apiKey || !imdbID) return {};
  const response = await fetch(`${OMDB_BASE}?apikey=${state.apiKey}&i=${imdbID}&plot=short`);
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
      finalizeAddMovie({
        title: result.Title || title,
        year: result.Year || '',
        rating: details.Rated && details.Rated !== 'N/A' ? details.Rated : '',
        poster: result.Poster !== 'N/A' ? result.Poster : PLACEHOLDER_POSTER
      });
    });
    els.posterGrid.appendChild(option);
  });

  const skip = document.createElement('button');
  skip.className = 'poster-option';
  skip.innerHTML = `<img src="${PLACEHOLDER_POSTER}" alt="Default poster" /><p>Use Default</p>`;
  skip.addEventListener('click', () => {
    finalizeAddMovie({ title, year: '', rating: '', poster: PLACEHOLDER_POSTER });
  });
  els.posterGrid.appendChild(skip);

  els.posterSelector.classList.remove('hidden');
}

function finalizeAddMovie({ title, year, rating, poster }) {
  const normalized = title.trim();
  if (!normalized) return;

  state.movies.unshift({
    id: crypto.randomUUID(),
    title: normalized,
    year: year || '',
    rating: rating || '',
    poster: poster || PLACEHOLDER_POSTER,
    watched: false
  });

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
  } catch (error) {
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
  reader.onload = () => {
    const firstResult = state.pendingOmdbResults[0] || {};
    finalizeAddMovie({
      title: firstResult.Title || state.pendingMovieTitle,
      year: firstResult.Year || '',
      rating: '',
      poster: reader.result
    });
    els.customPosterInput.value = '';
  };
  reader.readAsDataURL(file);
}

async function fetchRecommendations() {
  if (state.movies.length === 0 || !state.apiKey) {
    els.recommendations.classList.add('hidden');
    return;
  }

  const recent = state.movies[0]?.title || '';
  const firstWord = recent.split(' ')[0];
  if (!firstWord) {
    els.recommendations.classList.add('hidden');
    return;
  }

  try {
    const results = await fetchOmdbSearch(`${firstWord} movie`);
    const existingTitles = new Set(state.movies.map((m) => m.title.toLowerCase()));
    const picks = results.filter((r) => !existingTitles.has(r.Title.toLowerCase())).slice(0, 3);

    els.recommendationGrid.innerHTML = '';
    picks.forEach((pick) => {
      const card = document.createElement('article');
      card.className = 'rec-card';
      card.innerHTML = `
        <img src="${pick.Poster !== 'N/A' ? pick.Poster : PLACEHOLDER_POSTER}" alt="${pick.Title} poster" />
        <p>${pick.Title} (${pick.Year})</p>
      `;
      card.addEventListener('click', () => {
        window.open(`https://www.imdb.com/title/${pick.imdbID}/`, '_blank', 'noopener');
      });
      els.recommendationGrid.appendChild(card);
    });

    els.recommendations.classList.toggle('hidden', picks.length === 0);
  } catch (error) {
    els.recommendations.classList.add('hidden');
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
}

function bindEvents() {
  els.addMovieBtn.addEventListener('click', handleAddMovie);
  els.movieInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') handleAddMovie();
  });
  els.searchInput.addEventListener('input', (event) => {
    state.searchTerm = event.target.value;
    renderMovies();
  });
  els.clearWatchedBtn.addEventListener('click', clearWatched);
  els.layoutToggleBtn.addEventListener('click', () => {
    state.layout = state.layout === 'list' ? 'grid' : 'list';
    persist();
    applyLayout();
  });
  els.customPosterInput.addEventListener('change', handleCustomPosterUpload);
  els.closePosterSelector.addEventListener('click', () => {
    els.posterSelector.classList.add('hidden');
  });
  els.saveApiKeyBtn.addEventListener('click', saveApiKey);
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

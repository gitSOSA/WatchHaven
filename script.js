const playlists = {
  chill: [
    { title: "Ocean Drift", artist: "Blue Hour", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", art: "images/chill-1.svg" },
    { title: "Cloudwalk", artist: "Lo Tide", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", art: "images/chill-2.svg" },
    { title: "Quiet Waves", artist: "Hush Theory", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", art: "images/chill-3.svg" }
  ],
  hype: [
    { title: "Ignition", artist: "Volt City", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", art: "images/hype-1.svg" },
    { title: "Pulse Run", artist: "Neon Riot", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3", art: "images/hype-2.svg" },
    { title: "Game Time", artist: "Skyline Bass", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3", art: "images/hype-3.svg" }
  ],
  heartbreak: [
    { title: "Afterglow", artist: "Eira Lane", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3", art: "images/heartbreak-1.svg" },
    { title: "Empty Rooms", artist: "Ivory Rain", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3", art: "images/heartbreak-2.svg" },
    { title: "Faded Letters", artist: "North Bloom", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3", art: "images/heartbreak-3.svg" }
  ],
  focus: [
    { title: "Deep Work", artist: "Mono Frame", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3", art: "images/focus-1.svg" },
    { title: "Clarity", artist: "Axis Point", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3", art: "images/focus-2.svg" },
    { title: "Flow State", artist: "Dawn Circuit", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3", art: "images/focus-3.svg" }
  ],
  latenight: [
    { title: "Moonline", artist: "Night Echo", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3", art: "images/latenight-1.svg" },
    { title: "City Lights", artist: "Velvet Transit", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3", art: "images/latenight-2.svg" },
    { title: "3AM Thoughts", artist: "Noir Signal", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3", art: "images/latenight-3.svg" }
  ]
};

const moodQuotes = {
  chill: "Relax. The music will handle the rest.",
  hype: "Turn it up. Energy is everything.",
  heartbreak: "Some songs understand what words cannot.",
  focus: "Distraction off. Focus mode on.",
  latenight: "The night hears what the day ignores."
};

const ui = {
  body: document.body,
  moodButtons: [...document.querySelectorAll(".mood-btn")],
  moodQuote: document.getElementById("moodQuote"),
  playlistTitle: document.getElementById("playlistTitle"),
  playlist: document.getElementById("playlist"),
  albumArt: document.getElementById("albumArt"),
  songTitle: document.getElementById("songTitle"),
  artistName: document.getElementById("artistName"),
  audio: document.getElementById("audioPlayer"),
  playBtn: document.getElementById("playBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  nextBtn: document.getElementById("nextBtn"),
  prevBtn: document.getElementById("prevBtn"),
  shuffleBtn: document.getElementById("shuffleBtn"),
  repeatBtn: document.getElementById("repeatBtn"),
  progressBar: document.getElementById("progressBar"),
  currentTime: document.getElementById("currentTime"),
  totalDuration: document.getElementById("totalDuration"),
  volumeSlider: document.getElementById("volumeSlider"),
  visualizer: document.getElementById("visualizer"),
  miniArt: document.getElementById("miniArt"),
  miniTitle: document.getElementById("miniTitle"),
  miniPlayPauseBtn: document.getElementById("miniPlayPauseBtn"),
  miniNextBtn: document.getElementById("miniNextBtn")
};

const state = {
  mood: localStorage.getItem("moodsyncMood") || "chill",
  currentIndex: 0,
  currentPlaylist: [],
  isShuffle: false,
  isRepeat: false
};

let audioCtx;
let analyser;
let sourceNode;
let animationFrame;
let idleTick = 0;

function renderIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

function capitalizeMood(mood) {
  return `${mood.charAt(0).toUpperCase()}${mood.slice(1)}`;
}

function syncMiniPlayIcon() {
  const icon = ui.audio.paused ? "play" : "pause";
  ui.miniPlayPauseBtn.innerHTML = `<i data-lucide="${icon}"></i>`;
  renderIcons();
}

function ensureAudioContext() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 128;
  sourceNode = audioCtx.createMediaElementSource(ui.audio);
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);
  drawVisualizer();
}

async function resumeAudioContext() {
  ensureAudioContext();
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }
}

function drawVisualizer() {
  const canvas = ui.visualizer;
  const ctx = canvas.getContext("2d");
  const bufferLength = 64;
  const data = new Uint8Array(bufferLength);

  const paint = () => {
    animationFrame = requestAnimationFrame(paint);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (analyser && !ui.audio.paused) {
      analyser.getByteFrequencyData(data);
    } else {
      idleTick += 0.1;
      for (let i = 0; i < bufferLength; i += 1) {
        data[i] = 30 + Math.max(0, Math.sin(idleTick + i * 0.3) * 45);
      }
    }

    const barWidth = (canvas.width / bufferLength) * 0.72;
    let x = 0;
    for (let i = 0; i < bufferLength; i += 1) {
      const height = (data[i] / 255) * canvas.height;
      const hue = 190 + (i * 140) / bufferLength;
      ctx.fillStyle = `hsla(${hue}, 90%, 68%, 0.9)`;
      ctx.fillRect(x, canvas.height - height, barWidth, height);
      x += barWidth + 4;
    }
  };

  paint();
}

function renderPlaylist() {
  ui.playlist.innerHTML = "";
  state.currentPlaylist.forEach((song, index) => {
    const li = document.createElement("li");
    if (index === state.currentIndex) li.classList.add("active");
    li.innerHTML = `
      <span class="song-left"><i data-lucide="music"></i> <span>${song.title}</span></span>
      <span class="song-meta">${song.artist}</span>
    `;
    li.addEventListener("click", () => {
      state.currentIndex = index;
      loadSong(true);
    });
    ui.playlist.appendChild(li);
  });
  renderIcons();
}

function loadSong(autoplay = false) {
  const song = state.currentPlaylist[state.currentIndex];
  if (!song) return;

  ui.audio.src = song.src;
  ui.albumArt.src = song.art;
  ui.songTitle.textContent = song.title;
  ui.artistName.textContent = song.artist;
  ui.miniArt.src = song.art;
  ui.miniTitle.textContent = song.title;
  renderPlaylist();

  if (autoplay) {
    resumeAudioContext().then(() => ui.audio.play());
  }

  syncMiniPlayIcon();
}

function setMood(mood) {
  state.mood = mood;
  localStorage.setItem("moodsyncMood", mood);
  ui.body.dataset.mood = mood;
  ui.moodQuote.textContent = moodQuotes[mood];
  ui.playlistTitle.innerHTML = `<i data-lucide="music"></i> ${capitalizeMood(mood)} Playlist`;

  ui.moodButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mood === mood);
  });

  state.currentPlaylist = playlists[mood] || [];
  state.currentIndex = 0;
  loadSong(false);
  renderIcons();
}

function playNext() {
  if (!state.currentPlaylist.length) return;

  if (state.isShuffle) {
    let randomIndex = Math.floor(Math.random() * state.currentPlaylist.length);
    if (state.currentPlaylist.length > 1 && randomIndex === state.currentIndex) {
      randomIndex = (randomIndex + 1) % state.currentPlaylist.length;
    }
    state.currentIndex = randomIndex;
  } else {
    state.currentIndex = (state.currentIndex + 1) % state.currentPlaylist.length;
  }

  loadSong(true);
}

function playPrevious() {
  if (!state.currentPlaylist.length) return;
  state.currentIndex = (state.currentIndex - 1 + state.currentPlaylist.length) % state.currentPlaylist.length;
  loadSong(true);
}

async function toggleMiniPlayPause() {
  await resumeAudioContext();
  if (ui.audio.paused) {
    await ui.audio.play();
  } else {
    ui.audio.pause();
  }
}

ui.moodButtons.forEach((button) => {
  button.addEventListener("click", () => setMood(button.dataset.mood));
});

ui.playBtn.addEventListener("click", async () => {
  await resumeAudioContext();
  await ui.audio.play();
});

ui.pauseBtn.addEventListener("click", () => ui.audio.pause());
ui.nextBtn.addEventListener("click", playNext);
ui.prevBtn.addEventListener("click", playPrevious);
ui.miniPlayPauseBtn.addEventListener("click", toggleMiniPlayPause);
ui.miniNextBtn.addEventListener("click", playNext);

ui.shuffleBtn.addEventListener("click", () => {
  state.isShuffle = !state.isShuffle;
  ui.shuffleBtn.classList.toggle("active", state.isShuffle);
});

ui.repeatBtn.addEventListener("click", () => {
  state.isRepeat = !state.isRepeat;
  ui.repeatBtn.classList.toggle("active", state.isRepeat);
  ui.audio.loop = state.isRepeat;
});

ui.audio.addEventListener("play", syncMiniPlayIcon);
ui.audio.addEventListener("pause", syncMiniPlayIcon);

ui.audio.addEventListener("timeupdate", () => {
  const percent = ui.audio.duration ? (ui.audio.currentTime / ui.audio.duration) * 100 : 0;
  ui.progressBar.value = percent;
  ui.currentTime.textContent = formatTime(ui.audio.currentTime);
  ui.totalDuration.textContent = formatTime(ui.audio.duration);
});

ui.progressBar.addEventListener("input", () => {
  if (!ui.audio.duration) return;
  ui.audio.currentTime = (ui.progressBar.value / 100) * ui.audio.duration;
});

ui.audio.addEventListener("ended", () => {
  if (!state.isRepeat) playNext();
});

ui.volumeSlider.addEventListener("input", () => {
  ui.audio.volume = Number(ui.volumeSlider.value);
});

window.addEventListener("beforeunload", () => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
});

ui.audio.volume = Number(ui.volumeSlider.value);
setMood(state.mood);
ensureAudioContext();
renderIcons();
syncMiniPlayIcon();

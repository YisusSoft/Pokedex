// Pokédex Kanto: datos desde PokéAPI, interfaz y estado local.
const API_BASE = "https://pokeapi.co/api/v2";
const KANTO_COUNT = 151;
const PAGE_SIZE = 24;

const searchInput = document.querySelector("#searchInput");
const typeFilter = document.querySelector("#typeFilter");
const pokemonGrid = document.querySelector("#pokemonGrid");
const resultsCount = document.querySelector("#resultsCount");
const statusMessage = document.querySelector("#status");
const loadMoreButton = document.querySelector("#loadMoreButton");
const emptyState = document.querySelector("#emptyState");
const resetButton = document.querySelector("#resetButton");
const modal = document.querySelector("#modal");
const modalContent = document.querySelector("#modalContent");
const caughtProgress = document.querySelector("#caughtProgress");
const progressBar = document.querySelector("#progressBar");

let pokemonList = [];
let visibleCount = PAGE_SIZE;
let activeView = "all";
let selectedPokemon = null;
const favorites = new Set(readSavedList("pokedex-favorites"));
const caught = new Set(readSavedList("pokedex-caught"));

const typeColors = {
  normal: "#a8a77a", fire: "#ee8130", water: "#6390f0", electric: "#f7d02c",
  grass: "#7ac74c", ice: "#96d9d6", fighting: "#c22e28", poison: "#a33ea1",
  ground: "#e2bf65", flying: "#a98ff3", psychic: "#f95587", bug: "#a6b91a",
  rock: "#b6a136", ghost: "#735797", dragon: "#6f35fc", dark: "#705746",
  steel: "#b7b7ce", fairy: "#d685ad"
};
const typeNames = {
  normal: "Normal", fire: "Fuego", water: "Agua", electric: "Eléctrico",
  grass: "Planta", ice: "Hielo", fighting: "Lucha", poison: "Veneno",
  ground: "Tierra", flying: "Volador", psychic: "Psíquico", bug: "Bicho",
  rock: "Roca", ghost: "Fantasma", dragon: "Dragón", dark: "Siniestro",
  steel: "Acero", fairy: "Hada"
};
const statNames = {
  hp: "PS", attack: "Ataque", defense: "Defensa",
  "special-attack": "At. especial", "special-defense": "Def. especial", speed: "Velocidad"
};

function readSavedList(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatNumber(number) {
  return `#${String(number).padStart(3, "0")}`;
}

function getArtwork(pokemon) {
  return pokemon.sprites.other?.["official-artwork"]?.front_default
    || pokemon.sprites.front_default
    || "";
}

function translatedType(type) {
  return typeNames[type] || capitalize(type);
}

function createTypeBadge(type) {
  const badge = document.createElement("span");
  badge.className = "type-badge";
  badge.textContent = translatedType(type);
  badge.style.backgroundColor = typeColors[type] || "#888";
  return badge;
}

async function loadPokemon() {
  setStatus("Cargando los 151 Pokémon de Kanto...");
  try {
    const response = await fetch(`${API_BASE}/pokemon?limit=${KANTO_COUNT}&offset=0`);
    if (!response.ok) throw new Error("La API no respondió correctamente.");
    const data = await response.json();

    // Pedimos los detalles de cada Pokémon para tener tipos, imagen y estadísticas.
    // Promise.all permite cargar varias peticiones a la vez.
    pokemonList = await Promise.all(data.results.map(async (item) => {
      const detailResponse = await fetch(item.url);
      if (!detailResponse.ok) throw new Error(`No se pudo cargar ${item.name}.`);
      return detailResponse.json();
    }));

    pokemonList.sort((a, b) => a.id - b.id);
    populateTypeFilter();
    setStatus("");
    updateProgress();
    renderPokemon();
  } catch (error) {
    console.error(error);
    setStatus("No pudimos cargar los Pokémon. Revisa tu conexión y vuelve a intentarlo.", true);
    const retry = document.createElement("button");
    retry.className = "primary-button";
    retry.textContent = "Intentar de nuevo";
    retry.addEventListener("click", loadPokemon);
    statusMessage.append(" ");
    statusMessage.append(retry);
  }
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
  statusMessage.hidden = !message;
}

function populateTypeFilter() {
  const types = [...new Set(pokemonList.flatMap(p => p.types.map(t => t.type.name)))].sort();
  types.forEach(type => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = translatedType(type);
    typeFilter.append(option);
  });
}

function getFilteredPokemon() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedType = typeFilter.value;

  return pokemonList.filter(pokemon => {
    const matchesSearch = pokemon.name.toLowerCase().includes(query)
      || String(pokemon.id) === query.replace(/^#/, "");
    const matchesType = selectedType === "all"
      || pokemon.types.some(t => t.type.name === selectedType);
    const matchesView = activeView === "all"
      || (activeView === "favorites" && favorites.has(pokemon.id))
      || (activeView === "caught" && caught.has(pokemon.id));
    return matchesSearch && matchesType && matchesView;
  });
}

function renderPokemon() {
  pokemonGrid.replaceChildren();
  emptyState.hidden = true;
  const filtered = getFilteredPokemon();
  const visible = filtered.slice(0, visibleCount);

  resultsCount.textContent = `${filtered.length} Pokémon encontrados`;
  loadMoreButton.hidden = filtered.length <= visibleCount;

  if (!visible.length) {
    emptyState.hidden = false;
    return;
  }

  const fragment = document.createDocumentFragment();
  visible.forEach(pokemon => fragment.append(createPokemonCard(pokemon)));
  pokemonGrid.append(fragment);
}

function createPokemonCard(pokemon) {
  const card = document.createElement("article");
  card.className = "pokemon-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Ver detalles de ${pokemon.name}`);

  const top = document.createElement("div");
  top.className = "card-top";
  const number = document.createElement("span");
  number.textContent = formatNumber(pokemon.id);
  const actions = document.createElement("div");
  actions.className = "card-actions";

  const favoriteButton = document.createElement("button");
  favoriteButton.className = `icon-button ${favorites.has(pokemon.id) ? "favorited" : ""}`;
  favoriteButton.textContent = favorites.has(pokemon.id) ? "♥" : "♡";
  favoriteButton.title = favorites.has(pokemon.id) ? "Quitar de favoritos" : "Añadir a favoritos";
  favoriteButton.setAttribute("aria-label", favoriteButton.title);
  favoriteButton.addEventListener("click", event => {
    event.stopPropagation();
    toggleSet(favorites, pokemon.id, "pokedex-favorites");
    renderPokemon();
  });

  const caughtButton = document.createElement("button");
  caughtButton.className = `icon-button ${caught.has(pokemon.id) ? "captured" : ""}`;
  caughtButton.textContent = caught.has(pokemon.id) ? "✓" : "＋";
  caughtButton.title = caught.has(pokemon.id) ? "Marcar como no capturado" : "Marcar como capturado";
  caughtButton.setAttribute("aria-label", caughtButton.title);
  caughtButton.addEventListener("click", event => {
    event.stopPropagation();
    toggleSet(caught, pokemon.id, "pokedex-caught");
    updateProgress();
    renderPokemon();
  });

  actions.append(favoriteButton, caughtButton);
  top.append(number, actions);

  const art = document.createElement("div");
  art.className = "pokemon-art";
  const image = document.createElement("img");
  image.src = getArtwork(pokemon);
  image.alt = pokemon.name;
  image.loading = "lazy";
  image.onerror = () => { image.src = pokemon.sprites.front_default || ""; };
  art.append(image);

  const name = document.createElement("h3");
  name.textContent = pokemon.name;

  const types = document.createElement("div");
  types.className = "type-list";
  pokemon.types.forEach(item => types.append(createTypeBadge(item.type.name)));

  card.append(top, art, name, types);
  card.addEventListener("click", () => openDetails(pokemon));
  card.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetails(pokemon);
    }
  });
  return card;
}

function toggleSet(set, id, storageKey) {
  if (set.has(id)) set.delete(id);
  else set.add(id);
  saveSet(storageKey, set);
}

function updateProgress() {
  caughtProgress.textContent = `${caught.size} / ${KANTO_COUNT} capturados`;
  progressBar.style.width = `${Math.min(100, (caught.size / KANTO_COUNT) * 100)}%`;
}

function openDetails(pokemon) {
  selectedPokemon = pokemon;
  modalContent.replaceChildren();

  const header = document.createElement("div");
  header.className = "detail-header";
  const image = document.createElement("img");
  image.src = getArtwork(pokemon);
  image.alt = pokemon.name;
  const info = document.createElement("div");
  const number = document.createElement("span");
  number.className = "detail-number";
  number.textContent = formatNumber(pokemon.id);
  const name = document.createElement("h2");
  name.id = "modalName";
  name.textContent = pokemon.name;
  const types = document.createElement("div");
  types.className = "type-list";
  pokemon.types.forEach(item => types.append(createTypeBadge(item.type.name)));
  info.append(number, name, types);
  header.append(image, info);

  const meta = document.createElement("div");
  meta.className = "detail-meta";
  meta.append(
    createMetaBox("Altura", `${(pokemon.height / 10).toFixed(1)} m`),
    createMetaBox("Peso", `${(pokemon.weight / 10).toFixed(1)} kg`)
  );

  const statsTitle = document.createElement("h3");
  statsTitle.className = "stats-title";
  statsTitle.textContent = "Estadísticas base";
  const stats = document.createElement("div");
  pokemon.stats.forEach(item => {
    const row = document.createElement("div");
    row.className = "stat-row";
    const label = document.createElement("span");
    label.textContent = statNames[item.stat.name] || item.stat.name;
    const value = document.createElement("strong");
    value.textContent = item.base_stat;
    const track = document.createElement("div");
    track.className = "stat-track";
    const fill = document.createElement("span");
    fill.style.width = `${Math.min(100, (item.base_stat / 255) * 100)}%`;
    track.append(fill);
    row.append(label, value, track);
    stats.append(row);
  });

  const actions = document.createElement("div");
  actions.className = "detail-actions";
  const favoriteButton = document.createElement("button");
  favoriteButton.className = "primary-button";
  const updateFavoriteText = () => {
    favoriteButton.textContent = favorites.has(pokemon.id) ? "♥ En favoritos" : "♡ Añadir a favoritos";
  };
  updateFavoriteText();
  favoriteButton.addEventListener("click", () => {
    toggleSet(favorites, pokemon.id, "pokedex-favorites");
    updateFavoriteText();
    renderPokemon();
  });

  const caughtButton = document.createElement("button");
  caughtButton.className = `secondary-button ${caught.has(pokemon.id) ? "active" : ""}`;
  const updateCaughtText = () => {
    caughtButton.textContent = caught.has(pokemon.id) ? "✓ Capturado" : "＋ Marcar capturado";
    caughtButton.classList.toggle("active", caught.has(pokemon.id));
  };
  updateCaughtText();
  caughtButton.addEventListener("click", () => {
    toggleSet(caught, pokemon.id, "pokedex-caught");
    updateProgress();
    updateCaughtText();
    renderPokemon();
  });
  actions.append(favoriteButton, caughtButton);
  modalContent.append(header, meta, statsTitle, stats, actions);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  document.querySelector(".modal-close").focus();
}

function createMetaBox(label, value) {
  const box = document.createElement("div");
  box.className = "meta-box";
  const small = document.createElement("small");
  small.textContent = label;
  const strong = document.createElement("strong");
  strong.textContent = value;
  box.append(small, strong);
  return box;
}

function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  selectedPokemon = null;
}

searchInput.addEventListener("input", () => {
  visibleCount = PAGE_SIZE;
  renderPokemon();
});
typeFilter.addEventListener("change", () => {
  visibleCount = PAGE_SIZE;
  renderPokemon();
});
document.querySelectorAll(".view-button").forEach(button => {
  button.addEventListener("click", () => {
    activeView = button.dataset.view;
    document.querySelectorAll(".view-button").forEach(item => item.classList.toggle("active", item === button));
    visibleCount = PAGE_SIZE;
    renderPokemon();
  });
});
loadMoreButton.addEventListener("click", () => {
  visibleCount += PAGE_SIZE;
  renderPokemon();
});
resetButton.addEventListener("click", () => {
  searchInput.value = "";
  typeFilter.value = "all";
  activeView = "all";
  document.querySelectorAll(".view-button").forEach(button => button.classList.toggle("active", button.dataset.view === "all"));
  visibleCount = PAGE_SIZE;
  renderPokemon();
});
modal.addEventListener("click", event => {
  if (event.target.matches("[data-close-modal]")) closeModal();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && modal.classList.contains("open")) closeModal();
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
});

loadPokemon();

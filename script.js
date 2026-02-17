// ---------- Инициализация Telegram ----------
let tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

const initData = tg.initDataUnsafe || {};
const userId = initData.user?.id || 'guest_' + Math.random().toString(36).substr(2, 9);
const startParam = initData.start_param || '';

// ---------- Константы ----------
const MAX_LEVEL = 5;
const GRID_SIZE = 4; // 4x4
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

// ---------- Породы (10 штук) ----------
const breeds = [
  // Стартовые
  { id: 'corgi', emoji: '🐶', name: 'Корги' },
  { id: 'pug', emoji: '🐕', name: 'Мопс' },
  { id: 'dachshund', emoji: '🌭', name: 'Такса' },
  { id: 'husky', emoji: '🐺', name: 'Хаски' },
  { id: 'labrador', emoji: '🦮', name: 'Лабрадор' },
  // Редкие (пока доступны сразу, потом можно добавить условие)
  { id: 'shiba', emoji: '🐕‍🦺', name: 'Шиба-ину' },
  { id: 'dalmatian', emoji: '🐶', name: 'Далматин' }, // эмодзи разные, но ок
  { id: 'doberman', emoji: '🐩', name: 'Доберман' },
  { id: 'samoyed', emoji: '🐕', name: 'Самоед' },
  { id: 'chowchow', emoji: '🐶', name: 'Чау-чау' }
];

// Для удобства сопоставим id с эмодзи
const breedEmoji = Object.fromEntries(breeds.map(b => [b.id, b.emoji]));

// ---------- Состояние игры ----------
let bones = 100;
let gems = 0;
let grid = new Array(TOTAL_CELLS).fill(null);
let selectedIndex = -1;
let discovered = {}; // { 'corgi_1': true, 'corgi_2': true, ... }
let inventory = {
  hammer: 0,
  wand: 0
};

// ---------- Загрузка/сохранение ----------
const STORAGE_KEY = 'doggoMerge_save';

function loadGame() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      bones = data.bones ?? 100;
      gems = data.gems ?? 0;
      grid = data.grid ?? new Array(TOTAL_CELLS).fill(null);
      discovered = data.discovered ?? {};
      inventory = data.inventory ?? { hammer: 0, wand: 0 };
    }
  } catch (e) {
    console.warn('Ошибка загрузки', e);
  }
}

function saveGame() {
  const data = {
    bones,
    gems,
    grid,
    discovered,
    inventory,
    userId
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ---------- Вспомогательные функции ----------
function getRandomBreed() {
  // Пока все породы равновероятны
  const randomIndex = Math.floor(Math.random() * breeds.length);
  return breeds[randomIndex].id;
}

function addToCollection(breed, level) {
  const key = `${breed}_${level}`;
  if (!discovered[key]) {
    discovered[key] = true;
    // Можно добавить бонус за новое открытие
    bones += 5; // маленький бонус
  }
}

// ---------- Рендер сетки ----------
function renderGrid() {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  gridEl.innerHTML = '';
  for (let i = 0; i < grid.length; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    if (grid[i]) {
      const dog = grid[i];
      const emoji = breedEmoji[dog.breed] || '🐶';
      cell.innerHTML = `<span class="dog-emoji">${emoji}</span><span class="level-badge">${dog.level}</span>`;
    } else {
      cell.classList.add('empty');
    }
    cell.dataset.index = i;
    cell.addEventListener('click', () => onCellClick(i));
    if (i === selectedIndex) cell.classList.add('selected');
    gridEl.appendChild(cell);
  }
  updateBalanceUI();
}

function updateBalanceUI() {
  document.getElementById('bone-balance').innerText = bones;
  document.getElementById('gem-balance').innerText = gems;
}

// ---------- Клик по ячейке ----------
function onCellClick(index) {
  if (grid[index] === null) {
    selectedIndex = -1;
    renderGrid();
    return;
  }

  if (selectedIndex === -1) {
    selectedIndex = index;
    renderGrid();
  } else if (selectedIndex === index) {
    selectedIndex = -1;
    renderGrid();
  } else {
    mergeDogs(selectedIndex, index);
  }
}

// ---------- Слияние ----------
function mergeDogs(idx1, idx2) {
  const dog1 = grid[idx1];
  const dog2 = grid[idx2];

  if (!dog1 || !dog2) return;
  if (dog1.breed !== dog2.breed) return;
  if (dog1.level !== dog2.level) return;
  if (dog1.level >= MAX_LEVEL) {
    tg.showAlert('Эти собаки уже максимального уровня и не могут быть объединены!');
    return;
  }

  const newLevel = dog1.level + 1;

  // Удаляем двух
  grid[idx1] = null;
  grid[idx2] = null;

  // Ищем первую свободную ячейку
  const freeIdx = grid.findIndex(cell => cell === null);
  if (freeIdx !== -1) {
    grid[freeIdx] = { breed: dog1.breed, level: newLevel };
    addToCollection(dog1.breed, newLevel);

    // Награда косточками
    bones += 10 * newLevel;
  } else {
    // Если нет места, возвращаем собак обратно? Лучше не допускать такой ситуации,
    // но на всякий случай вернём их на место (можно просто не выполнять слияние)
    grid[idx1] = dog1;
    grid[idx2] = dog2;
    tg.showAlert('Нет свободного места для новой собаки!');
    return;
  }

  selectedIndex = -1;
  renderGrid();
  saveGame();
  renderCollection(); // если открыта панель коллекции
}

// ---------- Покупка яйца ----------
function buyBasicEgg() {
  if (bones < 100) {
    tg.showAlert('Недостаточно косточек!');
    return;
  }

  const freeIdx = grid.findIndex(cell => cell === null);
  if (freeIdx === -1) {
    tg.showAlert('Нет свободного места на поле!');
    return;
  }

  bones -= 100;
  const breedId = getRandomBreed();
  grid[freeIdx] = { breed: breedId, level: 1 };
  addToCollection(breedId, 1);

  renderGrid();
  saveGame();
  renderCollection();
}

// ---------- Покупка молотка (удаление) ----------
function buyHammer() {
  if (bones < 50) {
    tg.showAlert('Недостаточно косточек!');
    return;
  }
  if (selectedIndex === -1 || grid[selectedIndex] === null) {
    tg.showAlert('Сначала выбери собаку для удаления');
    return;
  }
  bones -= 50;
  grid[selectedIndex] = null;
  selectedIndex = -1;
  renderGrid();
  saveGame();
}

// ---------- Коллекция ----------
function renderCollection() {
  const container = document.getElementById('collection-grid');
  if (!container) return;

  let html = '';
  breeds.forEach(breed => {
    for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
      const key = `${breed.id}_${lvl}`;
      const discoveredClass = discovered[key] ? 'discovered' : '';
      html += `<div class="collection-item ${discoveredClass}">
        <span>${breed.emoji}</span>
        <span class="level-label">${lvl} ур.</span>
      </div>`;
    }
  });
  container.innerHTML = html;
}

// ---------- Профиль и рефералы ----------
function updateProfile() {
  document.getElementById('profile-id').innerText = userId;
  let refCount = localStorage.getItem('refCount_' + userId) || 0;
  document.getElementById('profile-refs').innerText = refCount;

  const botUsername = 'DoggoMergeBot'; // замени на username своего бота
  const refLink = `https://t.me/${botUsername}?start=${userId}`;
  document.getElementById('profile-link').innerText = refLink;

  document.getElementById('copy-ref-link').onclick = () => {
    navigator.clipboard.writeText(refLink).then(() => {
      tg.showAlert('Ссылка скопирована!');
    });
  };
}

// ---------- Обработчики событий ----------
document.addEventListener('DOMContentLoaded', () => {
  // Кнопки магазина
  document.querySelectorAll('.buy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const item = e.target.dataset.item;
      if (item === 'basic-egg') buyBasicEgg();
      else if (item === 'hammer') buyHammer();
      else if (item === 'wand') tg.showAlert('Функция в разработке');
    });
  });

  // Кнопка "Купить яйцо" на панели действий
  document.getElementById('buy-egg-btn')?.addEventListener('click', buyBasicEgg);

  // Кнопка "Сбросить выбор"
  document.getElementById('merge-btn')?.addEventListener('click', () => {
    selectedIndex = -1;
    renderGrid();
  });

  // Навигация по вкладкам
  const navBtns = document.querySelectorAll('.nav-btn');
  const panels = {
    grid: null,
    shop: document.getElementById('shop-panel'),
    collection: document.getElementById('collection-panel'),
    profile: document.getElementById('profile-panel')
  };

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      Object.values(panels).forEach(p => { if (p) p.classList.add('hidden'); });
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (tab === 'grid') {
        // ничего
      } else {
        const panel = panels[tab];
        if (panel) {
          panel.classList.remove('hidden');
          if (tab === 'collection') renderCollection();
          if (tab === 'profile') updateProfile();
        }
      }
    });
  });

  // TON Connect заглушка
  document.getElementById('connect-wallet')?.addEventListener('click', () => {
    tg.showAlert('Подключение кошелька будет доступно в следующей версии');
  });

  // Загружаем игру
  loadGame();
  renderGrid();
  renderCollection();
  updateProfile();

  // Автосохранение каждые 10 секунд
  setInterval(saveGame, 10000);
});
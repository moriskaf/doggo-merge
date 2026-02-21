// ---------- Инициализация Telegram ----------
let tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.enableClosingConfirmation?.();
} else {
    console.warn('Telegram WebApp не доступен, используется обычный браузер');
    tg = { showAlert: (msg) => alert(msg) };
}

const initData = tg?.initDataUnsafe || {};
const userId = initData.user?.id || 'guest_' + Math.random().toString(36).substr(2, 9);
const startParam = initData.start_param || '';

// ---------- Константы ----------
const MAX_LEVEL = 5;
const GRID_SIZE = 4;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

// ---------- Параметры спрайт-листа (1705x861, 10 столбцов, 5 строк) ----------
const SPRITE_WIDTH = 1705;
const SPRITE_HEIGHT = 861;
const COLS = 10;
const ROWS = 5;
const CELL_WIDTH = SPRITE_WIDTH / COLS;   // 170.5px
const CELL_HEIGHT = SPRITE_HEIGHT / ROWS; // 172.2px

// ---------- Породы (10 шт.) - порядок должен совпадать со спрайтом! ----------
const breeds = [
    { id: 'corgi', name: 'Корги' },
    { id: 'pug', name: 'Мопс' },
    { id: 'dachshund', name: 'Такса' },
    { id: 'husky', name: 'Хаски' },
    { id: 'labrador', name: 'Лабрадор' },
    { id: 'shiba', name: 'Шиба-ину' },
    { id: 'dalmatian', name: 'Далматин' },
    { id: 'doberman', name: 'Доберман' },
    { id: 'samoyed', name: 'Самоед' },
    { id: 'chowchow', name: 'Чау-чау' }
];

// ---------- Состояние игры ----------
let bones = 100;
let gems = 0;
let grid = new Array(TOTAL_CELLS).fill(null);
let selectedIndex = -1;
let discovered = {}; // { 'corgi_1': true, ... }
let inventory = { hammer: 0, wand: 0 };

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
    const data = { bones, gems, grid, discovered, inventory, userId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ---------- Вспомогательные функции ----------
function getRandomBreed() {
    return breeds[Math.floor(Math.random() * breeds.length)].id;
}

function addToCollection(breed, level) {
    const key = `${breed}_${level}`;
    if (!discovered[key]) {
        discovered[key] = true;
        bones += 5; // бонус за новое открытие
    }
}

// ---------- Рендер сетки со спрайтами ----------
function renderGrid() {
    const gridEl = document.getElementById('grid');
    if (!gridEl) return;
    gridEl.innerHTML = '';
    for (let i = 0; i < grid.length; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        if (grid[i]) {
            const dog = grid[i];
            const breedIndex = breeds.findIndex(b => b.id === dog.breed);
            if (breedIndex !== -1) {
                const spriteDiv = document.createElement('div');
                spriteDiv.className = 'dog-sprite';
                // Позиция: столбец = порода, строка = уровень-1
                const xPos = breedIndex * CELL_WIDTH;
                const yPos = (dog.level - 1) * CELL_HEIGHT;
                spriteDiv.style.backgroundPosition = `-${xPos}px -${yPos}px`;
                cell.appendChild(spriteDiv);
            } else {
                cell.textContent = '🐶'; // fallback
            }
            // Бейдж уровня
            const badge = document.createElement('span');
            badge.className = 'level-badge';
            badge.textContent = dog.level;
            cell.appendChild(badge);
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
    const boneSpan = document.getElementById('bone-balance');
    const gemSpan = document.getElementById('gem-balance');
    if (boneSpan) boneSpan.innerText = bones;
    if (gemSpan) gemSpan.innerText = gems;
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
    grid[idx1] = null;
    grid[idx2] = null;

    const freeIdx = grid.findIndex(cell => cell === null);
    if (freeIdx !== -1) {
        grid[freeIdx] = { breed: dog1.breed, level: newLevel };
        addToCollection(dog1.breed, newLevel);
        bones += 10 * newLevel;
    } else {
        // Нет места – возвращаем
        grid[idx1] = dog1;
        grid[idx2] = dog2;
        tg.showAlert('Нет свободного места для новой собаки!');
        return;
    }

    selectedIndex = -1;
    renderGrid();
    saveGame();
    renderCollection();
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

// ---------- Коллекция со спрайтами ----------
function renderCollection() {
    const container = document.getElementById('collection-grid');
    if (!container) return;

    container.innerHTML = '';
    breeds.forEach((breed, breedIndex) => {
        for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
            const key = `${breed.id}_${lvl}`;
            const discoveredClass = discovered[key] ? 'discovered' : '';
            const item = document.createElement('div');
            item.className = `collection-item ${discoveredClass}`;

            const spriteDiv = document.createElement('div');
            spriteDiv.className = 'dog-sprite';
            const xPos = breedIndex * CELL_WIDTH;
            const yPos = (lvl - 1) * CELL_HEIGHT;
            spriteDiv.style.backgroundPosition = `-${xPos}px -${yPos}px`;
            spriteDiv.style.backgroundSize = `${SPRITE_WIDTH}px ${SPRITE_HEIGHT}px`; // фиксируем размер фона
            spriteDiv.style.width = '100%';
            spriteDiv.style.height = '100%';
            item.appendChild(spriteDiv);

            const label = document.createElement('span');
            label.className = 'level-label';
            label.textContent = `${lvl} ур.`;
            item.appendChild(label);

            container.appendChild(item);
        }
    });
}

// ---------- Профиль и рефералы ----------
function updateProfile() {
    const profileIdEl = document.getElementById('profile-id');
    if (profileIdEl) profileIdEl.innerText = userId;

    let refCount = localStorage.getItem('refCount_' + userId) || 0;
    const profileRefsEl = document.getElementById('profile-refs');
    if (profileRefsEl) profileRefsEl.innerText = refCount;

    const botUsername = 'DoggoMergeBot'; // ⚠️ ЗАМЕНИТЕ НА ИМЯ ВАШЕГО БОТА (без @)
    const refLink = `https://t.me/${botUsername}?start=${userId}`;
    const profileLinkEl = document.getElementById('profile-link');
    if (profileLinkEl) profileLinkEl.innerText = refLink;

    const copyBtn = document.getElementById('copy-ref-link');
    if (copyBtn) {
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(refLink).then(() => {
                tg.showAlert('Ссылка скопирована!');
            }).catch(() => {
                alert('Ссылка скопирована (буфер обмена не доступен)');
            });
        };
    }
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

    // Кнопка "Купить яйцо"
    const buyEggBtn = document.getElementById('buy-egg-btn');
    if (buyEggBtn) buyEggBtn.addEventListener('click', buyBasicEgg);

    // Кнопка "Сбросить выбор"
    const mergeBtn = document.getElementById('merge-btn');
    if (mergeBtn) mergeBtn.addEventListener('click', () => {
        selectedIndex = -1;
        renderGrid();
    });

    // Навигация
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
            // Скрыть все панели
            Object.values(panels).forEach(p => { if (p) p.classList.add('hidden'); });
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (tab !== 'grid') {
                const panel = panels[tab];
                if (panel) {
                    panel.classList.remove('hidden');
                    if (tab === 'collection') renderCollection();
                    if (tab === 'profile') updateProfile();
                }
            }
        });
    });

    // Кнопка подключения кошелька (заглушка)
    const connectBtn = document.getElementById('connect-wallet');
    if (connectBtn) {
        connectBtn.addEventListener('click', () => {
            tg.showAlert('Подключение кошелька будет доступно в следующей версии');
        });
    }

    // Загрузка и старт
    loadGame();
    renderGrid();
    renderCollection();
    updateProfile();

    // Автосохранение каждые 10 секунд
    setInterval(saveGame, 10000);
});
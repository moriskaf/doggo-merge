// ---------- Инициализация Telegram ----------
let tg = window.Telegram.WebApp;
tg.expand(); // Разворачиваем на весь экран
tg.enableClosingConfirmation(); // Подтверждение при закрытии

// Получаем данные пользователя и реферальный параметр
const initData = tg.initDataUnsafe || {};
const userId = initData.user?.id || 'guest_' + Math.random().toString(36).substr(2, 9);
const startParam = initData.start_param || ''; // реферальный параметр

// ---------- Состояние игры ----------
let bones = 100;          // косточки
let gems = 0;             // алмазы
let gridSize = 4;         // 4x4
let grid = new Array(gridSize * gridSize).fill(null);
let selectedIndex = -1;    // индекс выбранной ячейки

// Коллекция: объект, где ключ = "порода_уровень", значение = true (есть)
let discovered = {};

// Инвентарь бустеров (для простоты не реализуем полностью, но можно расширить)
let inventory = {
    hammer: 0,
    wand: 0
};

// Породы и их эмодзи
const breeds = [
    { id: 'corgi', emoji: '🐶', name: 'Корги' },
    { id: 'pug', emoji: '🐕', name: 'Мопс' },
    { id: 'husky', emoji: '🐺', name: 'Хаски' },
    { id: 'labrador', emoji: '🦮', name: 'Лабрадор' },
    { id: 'dachshund', emoji: '🌭', name: 'Такса' }
];

// Максимальный уровень
const MAX_LEVEL = 5;

// ---------- Загрузка и сохранение в localStorage ----------
const STORAGE_KEY = 'doggoMerge_save';

function loadGame() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            bones = data.bones || 100;
            gems = data.gems || 0;
            grid = data.grid || new Array(gridSize * gridSize).fill(null);
            discovered = data.discovered || {};
            inventory = data.inventory || { hammer: 0, wand: 0 };
        }
    } catch (e) {
        console.warn('Не удалось загрузить сохранение');
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

// Обработка реферального параметра
if (startParam) {
    // Например, можно добавить бонус пригласившему, но здесь просто сохраним в localStorage факт
    console.log('Реферальный параметр:', startParam);
    // Можно отправить аналитику или показать уведомление
}

// ---------- Рендер сетки ----------
function renderGrid() {
    const gridEl = document.getElementById('grid');
    gridEl.innerHTML = '';
    for (let i = 0; i < grid.length; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        if (grid[i]) {
            const dog = grid[i];
            const breed = breeds.find(b => b.id === dog.breed) || breeds[0];
            cell.innerHTML = `<span class="dog-emoji">${breed.emoji}</span><span class="level-badge">${dog.level}</span>`;
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

// ---------- Логика клика по ячейке ----------
function onCellClick(index) {
    if (grid[index] === null) {
        // Если кликнули по пустой, сбрасываем выделение
        selectedIndex = -1;
        renderGrid();
        return;
    }

    if (selectedIndex === -1) {
        // Выбираем первую собаку
        selectedIndex = index;
        renderGrid();
    } else if (selectedIndex === index) {
        // Сняли выделение
        selectedIndex = -1;
        renderGrid();
    } else {
        // Пытаемся объединить двух собак
        mergeDogs(selectedIndex, index);
    }
}

// Слияние
function mergeDogs(idx1, idx2) {
    const dog1 = grid[idx1];
    const dog2 = grid[idx2];

    if (!dog1 || !dog2) return;
    if (dog1.breed !== dog2.breed) return;
    if (dog1.level !== dog2.level) return;
    if (dog1.level >= MAX_LEVEL) return; // нельзя объединять максимальных

    const newLevel = dog1.level + 1;
    // Убираем двух собак
    grid[idx1] = null;
    grid[idx2] = null;

    // Ищем первую свободную ячейку
    const freeIdx = grid.findIndex(cell => cell === null);
    if (freeIdx !== -1) {
        grid[freeIdx] = { breed: dog1.breed, level: newLevel };
        // Добавляем в коллекцию
        const key = `${dog1.breed}_${newLevel}`;
        discovered[key] = true;

        // Награда косточками
        bones += 10 * newLevel;
    }

    selectedIndex = -1;
    renderGrid();
    saveGame();
    renderCollection(); // обновляем коллекцию, если она открыта
}

// ---------- Покупка яйца ----------
function buyBasicEgg() {
    if (bones < 100) {
        alert('Недостаточно косточек!');
        return;
    }

    const freeIdx = grid.findIndex(cell => cell === null);
    if (freeIdx === -1) {
        alert('Нет свободного места на поле!');
        return;
    }

    bones -= 100;
    // Случайная порода
    const randomBreed = breeds[Math.floor(Math.random() * breeds.length)].id;
    grid[freeIdx] = { breed: randomBreed, level: 1 };

    // Добавляем в коллекцию
    const key = `${randomBreed}_1`;
    discovered[key] = true;

    renderGrid();
    saveGame();
    renderCollection();
}

// Покупка молотка (удаление собаки)
function buyHammer() {
    if (bones < 50) {
        alert('Недостаточно косточек!');
        return;
    }
    if (selectedIndex === -1 || grid[selectedIndex] === null) {
        alert('Сначала выбери собаку для удаления');
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
    // Для каждой породы и каждого уровня до MAX_LEVEL
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
    // Для рефералов можно использовать localStorage или заглушку
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

// ---------- Обработка покупок из магазина ----------
document.querySelectorAll('.buy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const item = e.target.dataset.item;
        if (item === 'basic-egg') {
            buyBasicEgg();
        } else if (item === 'hammer') {
            buyHammer();
        } else if (item === 'wand') {
            // Заглушка для волшебной палочки
            alert('Функция в разработке');
        }
    });
});

// Кнопка "Сбросить выбор"
document.getElementById('merge-btn').addEventListener('click', () => {
    selectedIndex = -1;
    renderGrid();
});

// Кнопка "Купить яйцо" в action-bar
document.getElementById('buy-egg-btn').addEventListener('click', buyBasicEgg);

// ---------- Навигация по вкладкам ----------
const navBtns = document.querySelectorAll('.nav-btn');
const panels = {
    grid: null, // панели нет, просто игровое поле
    shop: document.getElementById('shop-panel'),
    collection: document.getElementById('collection-panel'),
    profile: document.getElementById('profile-panel')
};

navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        // Скрываем все панели
        Object.values(panels).forEach(p => { if (p) p.classList.add('hidden'); });
        // Убираем активный класс со всех кнопок
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (tab === 'grid') {
            // ничего не показываем, просто возвращаемся к сетке
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

// ---------- TON Connect (заглушка) ----------
document.getElementById('connect-wallet').addEventListener('click', () => {
    tg.showAlert('Подключение кошелька будет доступно в следующей версии');
});

// ---------- Старт игры ----------
loadGame();
renderGrid();
renderCollection();
updateProfile();

// Автосохранение каждые 10 секунд
setInterval(saveGame, 10000);
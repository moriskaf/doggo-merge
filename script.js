// ---------- Инициализация ----------
let tg = window.Telegram?.WebApp;
if (tg) tg.expand();

// ---------- Константы ----------
const GRID_SIZE = 4; // 4x4
const MAX_LEVEL = 10; // теперь до 10 уровня

// 30 пород собак с эмодзи
const BREEDS = [
    { id: 'corgi', emoji: '🐶', name: 'Корги' },
    { id: 'pug', emoji: '🐕', name: 'Мопс' },
    { id: 'husky', emoji: '🐺', name: 'Хаски' },
    { id: 'labrador', emoji: '🦮', name: 'Лабрадор' },
    { id: 'dachshund', emoji: '🌭', name: 'Такса' },
    { id: 'beagle', emoji: '🐾', name: 'Бигль' },
    { id: 'rottweiler', emoji: '🐕‍🦺', name: 'Ротвейлер' },
    { id: 'boxer', emoji: '🐕', name: 'Боксёр' },
    { id: 'shiba', emoji: '🐕', name: 'Шиба-ину' },
    { id: 'akita', emoji: '🐕', name: 'Акита' },
    { id: 'chihuahua', emoji: '🐕', name: 'Чихуахуа' },
    { id: 'pomeranian', emoji: '🐕', name: 'Померанец' },
    { id: 'yorkshire', emoji: '🐕', name: 'Йоркшир' },
    { id: 'bichon', emoji: '🐕', name: 'Бишон' },
    { id: 'maltese', emoji: '🐕', name: 'Мальтезе' },
    { id: 'poodle', emoji: '🐩', name: 'Пудель' },
    { id: 'dalmatian', emoji: '🐕', name: 'Далматин' },
    { id: 'bulldog', emoji: '🐕', name: 'Бульдог' },
    { id: 'french_bulldog', emoji: '🐕', name: 'Французский бульдог' },
    { id: 'great_dane', emoji: '🐕', name: 'Дог' },
    { id: 'bernese', emoji: '🐕', name: 'Бернский зенненхунд' },
    { id: 'australian_shepherd', emoji: '🐕', name: 'Австралийская овчарка' },
    { id: 'border_collie', emoji: '🐕', name: 'Бордер-колли' },
    { id: 'sheltie', emoji: '🐕', name: 'Шелти' },
    { id: 'samoyed', emoji: '🐕', name: 'Самоед' },
    { id: 'malamute', emoji: '🐕', name: 'Маламут' },
    { id: 'siberian_husky', emoji: '🐺', name: 'Сибирский хаски' },
    { id: 'alaskan_husky', emoji: '🐺', name: 'Аляскинский хаски' },
    { id: 'greenland_dog', emoji: '🐺', name: 'Гренландская собака' },
    { id: 'wolfdog', emoji: '🐺', name: 'Волкособ' }
];

// Игровые переменные
let bones = 100;                 // косточки
let gems = 0;                    // алмазы (пока не используются)
let grid = new Array(GRID_SIZE * GRID_SIZE).fill(null);
let selectedIndex = -1;
let discovered = {};

// ---------- Звуковые эффекты через Web Audio API ----------
let audioCtx = null;

// Инициализация аудио контекста при первом взаимодействии
function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playSound(type) {
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'merge') {
        // звук слияния (восходящий)
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    } else if (type === 'buy') {
        // звук покупки (короткий щелчок)
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    } else {
        // стандартный звук
        osc.frequency.setValueAtTime(400, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    }

    osc.start(now);
    osc.stop(now + 0.2);
}

// ---------- Загрузка из localStorage ----------
function loadGame() {
    try {
        const saved = localStorage.getItem('doggo_save_v2');
        if (saved) {
            const data = JSON.parse(saved);
            bones = data.bones ?? 100;
            gems = data.gems ?? 0;
            grid = data.grid ?? new Array(GRID_SIZE * GRID_SIZE).fill(null);
            discovered = data.discovered ?? {};
        }
    } catch (e) {
        console.warn('Ошибка загрузки', e);
    }
}

// ---------- Сохранение ----------
function saveGame() {
    const data = { bones, gems, grid, discovered };
    localStorage.setItem('doggo_save_v2', JSON.stringify(data));
}

// ---------- Обновление интерфейса ----------
function updateUI() {
    document.getElementById('bone-balance').innerText = bones;
    document.getElementById('gem-balance').innerText = gems;
    renderGrid();
    renderCollection();
}

// ---------- Отрисовка сетки ----------
function renderGrid() {
    const gridEl = document.getElementById('grid');
    gridEl.innerHTML = '';
    for (let i = 0; i < grid.length; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        if (grid[i]) {
            const dog = grid[i];
            const breed = BREEDS.find(b => b.id === dog.breed) || BREEDS[0];
            cell.innerHTML = `<span>${breed.emoji}</span><span class="level-badge">${dog.level}</span>`;
        } else {
            cell.classList.add('empty');
        }
        cell.dataset.index = i;
        cell.addEventListener('click', () => onCellClick(i));
        if (i === selectedIndex) {
            cell.classList.add('selected');
        }
        gridEl.appendChild(cell);
    }
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
        return;
    }
    if (selectedIndex === index) {
        selectedIndex = -1;
        renderGrid();
        return;
    }
    attemptMerge(selectedIndex, index);
}

// ---------- Слияние ----------
function attemptMerge(idx1, idx2) {
    const dog1 = grid[idx1];
    const dog2 = grid[idx2];

    if (!dog1 || !dog2) {
        alert('Ошибка: собака не найдена');
        selectedIndex = -1;
        renderGrid();
        return;
    }
    if (dog1.breed !== dog2.breed) {
        alert('Нельзя объединять разные породы');
        selectedIndex = -1;
        renderGrid();
        return;
    }
    if (dog1.level !== dog2.level) {
        alert('Уровни должны быть одинаковыми');
        selectedIndex = -1;
        renderGrid();
        return;
    }
    if (dog1.level >= MAX_LEVEL) {
        alert('Это максимальный уровень, нельзя улучшить');
        selectedIndex = -1;
        renderGrid();
        return;
    }

    const freeIndex = grid.findIndex(cell => cell === null);
    if (freeIndex === -1) {
        alert('Нет свободного места! Освободите ячейку.');
        selectedIndex = -1;
        renderGrid();
        return;
    }

    // Удаляем двух собак
    grid[idx1] = null;
    grid[idx2] = null;

    // Создаём новую
    const newLevel = dog1.level + 1;
    grid[freeIndex] = { breed: dog1.breed, level: newLevel };

    const key = `${dog1.breed}_${newLevel}`;
    discovered[key] = true;

    // Награда за слияние (изменён баланс: 5 * уровень)
    bones += 5 * newLevel;

    // Звук слияния
    playSound('merge');

    selectedIndex = -1;
    updateUI();
    saveGame();
}

// ---------- Покупка яйца (цена 10) ----------
function buyEgg() {
    if (bones < 10) {
        alert('Недостаточно косточек');
        return;
    }
    const freeIndex = grid.findIndex(cell => cell === null);
    if (freeIndex === -1) {
        alert('Нет свободного места на поле');
        return;
    }

    bones -= 10;
    const randomBreed = BREEDS[Math.floor(Math.random() * BREEDS.length)].id;
    grid[freeIndex] = { breed: randomBreed, level: 1 };

    const key = `${randomBreed}_1`;
    discovered[key] = true;

    // Звук покупки
    playSound('buy');

    selectedIndex = -1;
    updateUI();
    saveGame();
}

// ---------- Коллекция ----------
function renderCollection() {
    const container = document.getElementById('collectionGrid');
    if (!container) return;

    let html = '';
    BREEDS.forEach(breed => {
        for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
            const key = `${breed.id}_${lvl}`;
            const discoveredClass = discovered[key] ? 'discovered' : '';
            html += `<div class="collection-item ${discoveredClass}">
                <span>${breed.emoji}</span>
                <span>${lvl} ур.</span>
            </div>`;
        }
    });
    container.innerHTML = html;
}

// ---------- Переключение вкладок ----------
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const panels = {
        game: document.getElementById('gamePanel'),
        shop: document.getElementById('shopPanel'),
        collection: document.getElementById('collectionPanel')
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            selectedIndex = -1;
            renderGrid();

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            Object.values(panels).forEach(p => p.classList.add('hidden'));
            const tabName = tab.dataset.tab;
            if (panels[tabName]) {
                panels[tabName].classList.remove('hidden');
                if (tabName === 'collection') renderCollection();
            }
        });
    });
}

// ---------- Запуск ----------
window.addEventListener('load', () => {
    loadGame();
    updateUI();
    setupTabs();

    document.getElementById('buyEggBtn').addEventListener('click', buyEgg);
    document.getElementById('buyEggInShop').addEventListener('click', buyEgg);
    document.getElementById('resetSelectionBtn').addEventListener('click', () => {
        selectedIndex = -1;
        renderGrid();
    });

    // Инициализируем аудио контекст при первом взаимодействии (по клику)
    document.addEventListener('click', initAudio, { once: true });
});
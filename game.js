const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const SNAKES = {
    99: 2,
    87: 36,
    62: 19,
    54: 34,
    17: 7
};

const LADDERS = {
    4: 14,
    9: 31,
    20: 38,
    28: 84,
    40: 59,
    51: 67,
    63: 81,
    71: 91
};

let state = { players: [], current: 0, active: false, rolling: false };
let selectedCount = 2;

// ── Setup ──────────────────────────────────────────────────────────────────

document.querySelectorAll('.count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCount = parseInt(btn.dataset.count);
        renderNameInputs();
    });
});

function renderNameInputs() {
    const container = document.getElementById('player-names-container');
    container.innerHTML = '';
    for (let i = 0; i < selectedCount; i++) {
        const row = document.createElement('div');
        row.className = 'name-row';
        row.innerHTML = `
            <div class="color-swatch" style="background:${COLORS[i]}"></div>
            <input type="text" class="name-input" id="pname-${i}" placeholder="Player ${i + 1}">
        `;
        container.appendChild(row);
    }
}

renderNameInputs();

document.getElementById('start-btn').addEventListener('click', () => {
    state.players = [];
    for (let i = 0; i < selectedCount; i++) {
        const nameEl = document.getElementById(`pname-${i}`);
        state.players.push({
            id: i,
            name: (nameEl.value.trim()) || `Player ${i + 1}`,
            color: COLORS[i],
            pos: 0
        });
    }
    state.current = 0;
    state.active = true;
    state.rolling = false;

    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    buildBoard();
    drawOverlay();
    renderAll();
    log(`Game started! ${state.players[0].name} goes first.`);
});

// ── Board ──────────────────────────────────────────────────────────────────

// Returns the pixel center of a square (1-100).
// boardRow 0 = bottom (sq 1-10), flipped to CSS grid row 9 (visual bottom).
function squareCenter(sq) {
    const bRow = Math.floor((sq - 1) / 10);
    const col = bRow % 2 === 0 ? (sq - 1) % 10 : 9 - (sq - 1) % 10;
    const gRow = 9 - bRow;
    return { x: col * 50 + 25, y: gRow * 50 + 25 };
}

function buildBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';

    for (let gRow = 0; gRow < 10; gRow++) {
        const bRow = 9 - gRow;
        for (let col = 0; col < 10; col++) {
            const sq = bRow % 2 === 0
                ? bRow * 10 + col + 1
                : bRow * 10 + (9 - col) + 1;

            const cell = document.createElement('div');
            cell.className = 'cell ' + ((gRow + col) % 2 === 0 ? 'light' : 'dark');
            cell.id = `cell-${sq}`;

            if (sq === 100) cell.classList.add('finish');
            else if (SNAKES[sq]) cell.classList.add('special-snake');
            else if (LADDERS[sq]) cell.classList.add('special-ladder');

            const num = document.createElement('span');
            num.textContent = sq;
            cell.appendChild(num);

            const iconMap = { [100]: '🏆' };
            if (SNAKES[sq]) iconMap[sq] = '🐍';
            else if (LADDERS[sq]) iconMap[sq] = '🪜';

            if (iconMap[sq]) {
                const icon = document.createElement('div');
                icon.className = 'cell-icon';
                icon.textContent = iconMap[sq];
                cell.appendChild(icon);
            }

            board.appendChild(cell);
        }
    }
}

// ── SVG Overlay ────────────────────────────────────────────────────────────

function drawOverlay() {
    const svg = document.getElementById('game-svg');
    svg.innerHTML = '';

    // Ladders
    for (const [fromStr, to] of Object.entries(LADDERS)) {
        const from = parseInt(fromStr);
        const p1 = squareCenter(from);
        const p2 = squareCenter(to);
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = (-dy / len) * 6, ny = (dx / len) * 6;

        for (const sign of [1, -1]) {
            const rail = makeLine(p1.x + nx * sign, p1.y + ny * sign, p2.x + nx * sign, p2.y + ny * sign);
            rail.setAttribute('stroke', '#7b4f1a');
            rail.setAttribute('stroke-width', '2.5');
            rail.setAttribute('stroke-linecap', 'round');
            svg.appendChild(rail);
        }

        const steps = Math.floor(len / 18);
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const rx = p1.x + dx * t, ry = p1.y + dy * t;
            const rung = makeLine(rx + nx, ry + ny, rx - nx, ry - ny);
            rung.setAttribute('stroke', '#a0522d');
            rung.setAttribute('stroke-width', '2');
            svg.appendChild(rung);
        }
    }

    // Snakes
    for (const [fromStr, to] of Object.entries(SNAKES)) {
        const from = parseInt(fromStr);
        const head = squareCenter(from);
        const tail = squareCenter(to);
        const dx = tail.x - head.x, dy = tail.y - head.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const wave = Math.min(45, len * 0.28);
        const px = (-dy / len) * wave, py = (dx / len) * wave;
        const mid = { x: (head.x + tail.x) / 2 + px, y: (head.y + tail.y) / 2 + py };

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${head.x} ${head.y} Q ${mid.x} ${mid.y} ${tail.x} ${tail.y}`);
        path.setAttribute('stroke', '#2e7d32');
        path.setAttribute('stroke-width', '7');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('opacity', '0.72');
        svg.appendChild(path);

        const circle = makeCircle(head.x, head.y, 10, '#1b5e20');
        svg.appendChild(circle);
        svg.appendChild(makeCircle(head.x + 3, head.y - 3, 2.5, '#ffeb3b'));

        // Forked tongue
        const tongue = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const tx = head.x + (dx / len) * 14;
        const ty = head.y + (dy / len) * 14;
        tongue.setAttribute('d', `M ${head.x} ${head.y} L ${tx} ${ty} M ${tx} ${ty} L ${tx + 4} ${ty - 4} M ${tx} ${ty} L ${tx + 4} ${ty + 4}`);
        tongue.setAttribute('stroke', '#f44336');
        tongue.setAttribute('stroke-width', '1.5');
        tongue.setAttribute('fill', 'none');
        svg.appendChild(tongue);
    }
}

function makeLine(x1, y1, x2, y2) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    el.setAttribute('x1', x1); el.setAttribute('y1', y1);
    el.setAttribute('x2', x2); el.setAttribute('y2', y2);
    return el;
}

function makeCircle(cx, cy, r, fill) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    el.setAttribute('cx', cx); el.setAttribute('cy', cy);
    el.setAttribute('r', r);  el.setAttribute('fill', fill);
    return el;
}

// ── Rendering ──────────────────────────────────────────────────────────────

function renderAll() {
    renderPlayerCards();
    renderTokens();
    updateTurnDisplay();
}

function renderPlayerCards() {
    const container = document.getElementById('player-cards');
    container.innerHTML = '';
    state.players.forEach((p, i) => {
        const card = document.createElement('div');
        card.className = 'player-card' + (i === state.current && state.active ? ' active-turn' : '');
        let posLabel = p.pos === 0 ? 'Start' : p.pos === 100 ? '★ Winner' : `Sq ${p.pos}`;
        card.innerHTML = `
            <div class="player-chip" style="background:${p.color}"></div>
            <span class="player-label">${p.name}</span>
            <span class="player-pos">${posLabel}</span>
        `;
        container.appendChild(card);
    });
}

function renderTokens() {
    const layer = document.getElementById('token-layer');
    layer.innerHTML = '';

    const posMap = {};
    state.players.forEach(p => {
        if (p.pos > 0) {
            if (!posMap[p.pos]) posMap[p.pos] = [];
            posMap[p.pos].push(p);
        }
    });

    for (const [posStr, group] of Object.entries(posMap)) {
        const center = squareCenter(parseInt(posStr));
        const n = group.length;
        group.forEach((p, i) => {
            const offset = n > 1 ? (i - (n - 1) / 2) * 16 : 0;
            const token = document.createElement('div');
            token.className = 'token';
            token.style.background = p.color;
            token.style.left = (center.x + offset) + 'px';
            token.style.top = center.y + 'px';
            token.textContent = p.name.charAt(0).toUpperCase();
            layer.appendChild(token);
        });
    }
}

function updateTurnDisplay() {
    const el = document.getElementById('turn-display');
    el.textContent = state.active ? `${state.players[state.current].name}'s turn` : '';
}

// ── Dice & Game Logic ──────────────────────────────────────────────────────

document.getElementById('roll-btn').addEventListener('click', () => {
    if (!state.active || state.rolling) return;
    doRoll();
});

function doRoll() {
    state.rolling = true;
    document.getElementById('roll-btn').disabled = true;

    const diceEl = document.getElementById('dice');
    const diceVal = document.getElementById('dice-value');
    diceEl.classList.add('rolling');

    let ticks = 0;
    const interval = setInterval(() => {
        diceVal.textContent = DICE_FACES[Math.floor(Math.random() * 6)];
        ticks++;
        if (ticks >= 14) {
            clearInterval(interval);
            diceEl.classList.remove('rolling');
            const roll = Math.floor(Math.random() * 6) + 1;
            diceVal.textContent = DICE_FACES[roll - 1];
            setTimeout(() => applyMove(roll), 200);
        }
    }, 55);
}

function applyMove(roll) {
    const player = state.players[state.current];
    const from = player.pos;
    const target = from + roll;

    if (target > 100) {
        log(`${player.name} rolled ${roll} — needs exactly ${100 - from} to finish. No move.`);
        endTurn();
        return;
    }

    log(`${player.name} rolled ${roll} — moved from ${from || 'Start'} to ${target}`);
    player.pos = target;
    renderAll();

    setTimeout(() => {
        if (SNAKES[target]) {
            const dest = SNAKES[target];
            log(`🐍 Snake! ${player.name} slides from ${target} down to ${dest}`);
            player.pos = dest;
            setTimeout(() => { renderAll(); endTurn(); }, 650);
        } else if (LADDERS[target]) {
            const dest = LADDERS[target];
            log(`🪜 Ladder! ${player.name} climbs from ${target} up to ${dest}`);
            player.pos = dest;
            setTimeout(() => {
                renderAll();
                if (dest === 100) handleWin(player);
                else endTurn();
            }, 650);
        } else if (target === 100) {
            handleWin(player);
        } else {
            endTurn();
        }
    }, 500);
}

function handleWin(player) {
    state.active = false;
    state.rolling = false;
    document.getElementById('roll-btn').disabled = true;
    log(`🏆 ${player.name} reached 100 and wins the game!`);
    renderAll();
    setTimeout(() => {
        document.getElementById('win-overlay').classList.remove('hidden');
        document.getElementById('win-message').textContent = `${player.name} wins!`;
    }, 700);
}

function endTurn() {
    if (!state.active) return;
    state.rolling = false;
    state.current = (state.current + 1) % state.players.length;
    renderAll();
    document.getElementById('roll-btn').disabled = false;
}

function log(msg) {
    const content = document.getElementById('log-content');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = msg;
    content.insertBefore(entry, content.firstChild);
    while (content.children.length > 30) content.removeChild(content.lastChild);
}

// ── New Game ───────────────────────────────────────────────────────────────

document.getElementById('new-game-btn').addEventListener('click', () => {
    document.getElementById('win-overlay').classList.add('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('hidden');
    state = { players: [], current: 0, active: false, rolling: false };
    document.getElementById('dice-value').textContent = '⚀';
    document.getElementById('log-content').innerHTML = '';
});

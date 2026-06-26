// All SVG coordinates live in a fixed 500×500 space (matches viewBox).
// Tokens use percentage-based left/top so they scale with the board container.

const COLORS = ['#e74c3c', '#2980b9', '#27ae60', '#e67e22', '#8e44ad'];

// Dot patterns: 9 cells numbered 1–9 (top-left → bottom-right, row by row)
const DICE_PATTERNS = {
    1: [5],
    2: [3, 7],
    3: [3, 5, 7],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9]
};

const SNAKES = { 99: 2, 87: 36, 62: 19, 54: 34, 17: 7 };
const LADDERS = { 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91 };

let state = { players: [], current: 0, active: false, rolling: false };
let selectedCount = 2;

// ── Utilities ──────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Returns the center of a square in 500×500 coordinate space.
function squareCenter(sq) {
    const bRow = Math.floor((sq - 1) / 10);
    const col  = bRow % 2 === 0 ? (sq - 1) % 10 : 9 - (sq - 1) % 10;
    return { x: col * 50 + 25, y: (9 - bRow) * 50 + 25 };
}

function makeSVGEl(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

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
        const el = document.getElementById(`pname-${i}`);
        state.players.push({
            id: i,
            name: el.value.trim() || `Player ${i + 1}`,
            color: COLORS[i],
            pos: 0
        });
    }
    state.current = 0;
    state.active  = true;
    state.rolling = false;

    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    buildBoard();
    drawOverlay();
    renderAll();
    log(`Game on! ${state.players[0].name} goes first.`);
});

// ── Board ──────────────────────────────────────────────────────────────────

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

            if (sq === 100)      cell.classList.add('finish');
            else if (SNAKES[sq]) cell.classList.add('special-snake');
            else if (LADDERS[sq])cell.classList.add('special-ladder');

            const num = document.createElement('span');
            num.textContent = sq;
            cell.appendChild(num);

            const iconMap = { 100: '🏆' };
            if (SNAKES[sq])  iconMap[sq] = '🐍';
            if (LADDERS[sq]) iconMap[sq] = '🪜';
            if (iconMap[sq]) {
                const ic = document.createElement('div');
                ic.className = 'cell-icon';
                ic.textContent = iconMap[sq];
                cell.appendChild(ic);
            }

            board.appendChild(cell);
        }
    }
}

// ── SVG Overlay — GSAP animated ───────────────────────────────────────────

function drawOverlay() {
    const svg = document.getElementById('game-svg');
    svg.innerHTML = '';

    // Drop-shadow filter for snakes
    const defs = makeSVGEl('defs');
    defs.innerHTML = `
        <filter id="snake-glow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5"
                         flood-color="#000" flood-opacity="0.45"/>
        </filter>
    `;
    svg.appendChild(defs);

    drawLadders(svg);
    drawSnakes(svg);
}

function animateLine(el, delay) {
    const len = el.getTotalLength();
    gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
    gsap.to(el,  { strokeDashoffset: 0, duration: 0.65, ease: 'power2.inOut', delay });
}

function animatePath(el, delay) {
    const len = el.getTotalLength();
    gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
    gsap.to(el,  { strokeDashoffset: 0, duration: 1.1,  ease: 'power2.inOut', delay });
}

// ── Ladders ────────────────────────────────────────────────────────────────

function drawLadders(svg) {
    Object.entries(LADDERS).forEach(([fromStr, to], i) => {
        const p1  = squareCenter(parseInt(fromStr)); // bottom
        const p2  = squareCenter(to);                // top
        const dx  = p2.x - p1.x, dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        const nx  = (-dy / len) * 7, ny = (dx / len) * 7;
        const d0  = i * 0.12;

        for (const sign of [1, -1]) {
            const rail = makeSVGEl('line');
            rail.setAttribute('x1', p1.x + nx * sign);
            rail.setAttribute('y1', p1.y + ny * sign);
            rail.setAttribute('x2', p2.x + nx * sign);
            rail.setAttribute('y2', p2.y + ny * sign);
            rail.setAttribute('stroke', '#6d4c41');
            rail.setAttribute('stroke-width', '3');
            rail.setAttribute('stroke-linecap', 'round');
            svg.appendChild(rail);
            animateLine(rail, d0);
        }

        const steps = Math.floor(len / 16);
        for (let j = 1; j < steps; j++) {
            const t  = j / steps;
            const rx = p1.x + dx * t, ry = p1.y + dy * t;
            const rung = makeSVGEl('line');
            rung.setAttribute('x1', rx + nx); rung.setAttribute('y1', ry + ny);
            rung.setAttribute('x2', rx - nx); rung.setAttribute('y2', ry - ny);
            rung.setAttribute('stroke', '#8d6e63');
            rung.setAttribute('stroke-width', '2');
            rung.setAttribute('stroke-linecap', 'round');
            svg.appendChild(rung);
            animateLine(rung, d0 + 0.5 + j * 0.035);
        }
    });
}

// ── Snakes ─────────────────────────────────────────────────────────────────

function drawSnakes(svg) {
    Object.entries(SNAKES).forEach(([fromStr, to], i) => {
        const head = squareCenter(parseInt(fromStr)); // high square = head
        const tail = squareCenter(to);               // low square  = tail

        const dx = tail.x - head.x, dy = tail.y - head.y;
        const len = Math.hypot(dx, dy);
        const ux = dx / len, uy = dy / len;
        const px = -uy, py = ux;                     // perpendicular unit vector
        const amp = clamp(len * 0.22, 18, 44);

        // Cubic S-curve: cp1 curves one side, cp2 the other.
        // Clamped to [8, 492] so nothing exits the 500×500 viewBox.
        const cp1 = {
            x: clamp(head.x + ux * len * 0.33 + px * amp, 8, 492),
            y: clamp(head.y + uy * len * 0.33 + py * amp, 8, 492)
        };
        const cp2 = {
            x: clamp(tail.x - ux * len * 0.33 - px * amp, 8, 492),
            y: clamp(tail.y - uy * len * 0.33 - py * amp, 8, 492)
        };
        const pathD = `M ${head.x} ${head.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${tail.x} ${tail.y}`;
        const bodyDelay = 0.4 + i * 0.3;

        // Shadow layer
        const shadow = makeSVGEl('path');
        shadow.setAttribute('d', pathD);
        shadow.setAttribute('stroke', 'rgba(0,0,0,0.35)');
        shadow.setAttribute('stroke-width', '12');
        shadow.setAttribute('fill', 'none');
        shadow.setAttribute('stroke-linecap', 'round');
        svg.appendChild(shadow);

        // Main body
        const body = makeSVGEl('path');
        body.setAttribute('d', pathD);
        body.setAttribute('stroke', '#2e7d32');
        body.setAttribute('stroke-width', '9');
        body.setAttribute('fill', 'none');
        body.setAttribute('stroke-linecap', 'round');
        body.setAttribute('filter', 'url(#snake-glow)');
        svg.appendChild(body);

        // Highlight stripe
        const stripe = makeSVGEl('path');
        stripe.setAttribute('d', pathD);
        stripe.setAttribute('stroke', '#66bb6a');
        stripe.setAttribute('stroke-width', '3.5');
        stripe.setAttribute('fill', 'none');
        stripe.setAttribute('stroke-linecap', 'round');
        svg.appendChild(stripe);

        // Animate all three layers together
        [shadow, body, stripe].forEach(el => animatePath(el, bodyDelay));

        // ── Head ──
        const headDelay = bodyDelay + 0.95;
        // The tangent at the head is the direction toward cp1
        const headAngle = Math.atan2(cp1.y - head.y, cp1.x - head.x);

        const headCircle = makeSVGEl('circle');
        headCircle.setAttribute('cx', head.x);
        headCircle.setAttribute('cy', head.y);
        headCircle.setAttribute('r', '11');
        headCircle.setAttribute('fill', '#1b5e20');
        svg.appendChild(headCircle);
        gsap.from(headCircle, {
            scale: 0,
            transformOrigin: `${head.x}px ${head.y}px`,
            duration: 0.45,
            ease: 'back.out(2)',
            delay: headDelay
        });

        // Eye — offset left of facing direction
        const eyeX = head.x + Math.cos(headAngle + Math.PI / 2) * 4 + Math.cos(headAngle) * 4;
        const eyeY = head.y + Math.sin(headAngle + Math.PI / 2) * 4 + Math.sin(headAngle) * 4;
        const eye = makeSVGEl('circle');
        eye.setAttribute('cx', eyeX); eye.setAttribute('cy', eyeY);
        eye.setAttribute('r', '2.8'); eye.setAttribute('fill', '#ffee58');
        svg.appendChild(eye);
        gsap.from(eye, {
            scale: 0,
            transformOrigin: `${eyeX}px ${eyeY}px`,
            duration: 0.3,
            ease: 'back.out(2)',
            delay: headDelay + 0.12
        });

        // Forked tongue
        const tb = {
            x: head.x + Math.cos(headAngle) * 14,
            y: head.y + Math.sin(headAngle) * 14
        };
        const f1 = {
            x: tb.x + Math.cos(headAngle + 0.48) * 7,
            y: tb.y + Math.sin(headAngle + 0.48) * 7
        };
        const f2 = {
            x: tb.x + Math.cos(headAngle - 0.48) * 7,
            y: tb.y + Math.sin(headAngle - 0.48) * 7
        };
        const tongue = makeSVGEl('path');
        tongue.setAttribute('d',
            `M ${head.x} ${head.y} L ${tb.x} ${tb.y}` +
            ` M ${tb.x} ${tb.y} L ${f1.x} ${f1.y}` +
            ` M ${tb.x} ${tb.y} L ${f2.x} ${f2.y}`
        );
        tongue.setAttribute('stroke', '#e53935');
        tongue.setAttribute('stroke-width', '2');
        tongue.setAttribute('fill', 'none');
        tongue.setAttribute('stroke-linecap', 'round');
        svg.appendChild(tongue);
        gsap.from(tongue, { opacity: 0, duration: 0.25, delay: headDelay + 0.22 });
    });
}

// ── Dice with dots ─────────────────────────────────────────────────────────

function setDiceFace(value) {
    const dice = document.getElementById('dice');
    dice.innerHTML = '';
    const pattern = DICE_PATTERNS[value];
    for (let cell = 1; cell <= 9; cell++) {
        const cellEl = document.createElement('div');
        cellEl.className = 'dice-cell';
        if (pattern.includes(cell)) {
            const dot = document.createElement('div');
            dot.className = 'dice-dot';
            cellEl.appendChild(dot);
        }
        dice.appendChild(cellEl);
    }
}

setDiceFace(1); // initial state

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
        const posLabel = p.pos === 0 ? 'Start' : p.pos === 100 ? '★ Won' : `Sq ${p.pos}`;
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
            (posMap[p.pos] = posMap[p.pos] || []).push(p);
        }
    });

    for (const [posStr, group] of Object.entries(posMap)) {
        const center = squareCenter(parseInt(posStr));
        group.forEach((p, idx) => {
            const offsetX = group.length > 1 ? (idx - (group.length - 1) / 2) * 16 : 0;
            const token = document.createElement('div');
            token.className = 'token';
            token.style.background = p.color;
            // Percentage positioning scales with the container
            token.style.left = ((center.x + offsetX) / 500 * 100) + '%';
            token.style.top  = (center.y / 500 * 100) + '%';
            token.textContent = p.name.charAt(0).toUpperCase();
            layer.appendChild(token);
        });
    }
}

function updateTurnDisplay() {
    const el = document.getElementById('turn-display');
    el.textContent = state.active ? `${state.players[state.current].name}'s turn` : '';
}

// ── Dice roll & game logic ─────────────────────────────────────────────────

document.getElementById('roll-btn').addEventListener('click', () => {
    if (!state.active || state.rolling) return;
    doRoll();
});

function doRoll() {
    state.rolling = true;
    document.getElementById('roll-btn').disabled = true;

    const diceEl = document.getElementById('dice');
    diceEl.classList.add('rolling');

    let ticks = 0;
    const interval = setInterval(() => {
        setDiceFace(Math.floor(Math.random() * 6) + 1);
        ticks++;
        if (ticks >= 14) {
            clearInterval(interval);
            diceEl.classList.remove('rolling');
            const roll = Math.floor(Math.random() * 6) + 1;
            setDiceFace(roll);
            setTimeout(() => applyMove(roll), 220);
        }
    }, 55);
}

function applyMove(roll) {
    const player = state.players[state.current];
    const from   = player.pos;
    const target = from + roll;

    if (target > 100) {
        log(`${player.name} rolled ${roll} — needs exactly ${100 - from} to finish.`);
        endTurn();
        return;
    }

    log(`${player.name} rolled ${roll} — moved ${from || 'Start'} → ${target}`);
    player.pos = target;
    renderAll();

    setTimeout(() => {
        if (SNAKES[target]) {
            const dest = SNAKES[target];
            log(`🐍 Snake! ${player.name} slides ${target} → ${dest}`);
            player.pos = dest;
            setTimeout(() => { renderAll(); endTurn(); }, 650);
        } else if (LADDERS[target]) {
            const dest = LADDERS[target];
            log(`🪜 Ladder! ${player.name} climbs ${target} → ${dest}`);
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
    }, 520);
}

function handleWin(player) {
    state.active  = false;
    state.rolling = false;
    document.getElementById('roll-btn').disabled = true;
    log(`🏆 ${player.name} wins the game!`);
    renderAll();
    setTimeout(() => {
        document.getElementById('win-overlay').classList.remove('hidden');
        document.getElementById('win-message').textContent = `${player.name} wins!`;
    }, 700);
}

function endTurn() {
    if (!state.active) return;
    state.rolling  = false;
    state.current  = (state.current + 1) % state.players.length;
    renderAll();
    document.getElementById('roll-btn').disabled = false;
}

function log(msg) {
    const content = document.getElementById('log-content');
    const entry   = document.createElement('div');
    entry.className   = 'log-entry';
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
    setDiceFace(1);
    document.getElementById('log-content').innerHTML = '';
});

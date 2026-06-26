// All SVG coordinates live in a fixed 500×500 space (matches viewBox).
// Tokens use percentage-based left/top so they scale with the board container.

const COLORS = ['#e74c3c', '#2980b9', '#27ae60', '#e67e22', '#8e44ad'];

const DICE_PATTERNS = {
    1: [5],
    2: [3, 7],
    3: [3, 5, 7],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9]
};

const SNAKES  = { 99: 2, 87: 36, 62: 19, 54: 34, 17: 7 };
const LADDERS = { 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91 };

// Per-snake colour schemes — each snake is visually distinct
const SNAKE_STYLES = [
    { base: '#c62828', band: '#ff8a80', headMid: '#c62828', headDark: '#7f0000', headLight: '#ef9a9a', eye: '#ffee58' },
    { base: '#6a1b9a', band: '#e1bee7', headMid: '#7b1fa2', headDark: '#38006b', headLight: '#ce93d8', eye: '#f0f4c3' },
    { base: '#e65100', band: '#ffe0b2', headMid: '#e64a19', headDark: '#bf360c', headLight: '#ff8a65', eye: '#e8f5e9' },
    { base: '#1565c0', band: '#bbdefb', headMid: '#1976d2', headDark: '#003c8f', headLight: '#90caf9', eye: '#fff9c4' },
    { base: '#2e7d32', band: '#c8e6c9', headMid: '#388e3c', headDark: '#1b5e20', headLight: '#81c784', eye: '#fff176' },
];

let state = { players: [], current: 0, active: false, rolling: false };
let selectedCount = 2;

// ── Utilities ──────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

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
    // Hide any lingering error
    document.getElementById('name-error').classList.add('hidden');
    // Live duplicate highlighting
    container.querySelectorAll('.name-input').forEach(input => {
        input.addEventListener('input', highlightDuplicates);
    });
}

function highlightDuplicates() {
    const inputs = [...document.querySelectorAll('.name-input')];
    const names  = inputs.map(el => el.value.trim().toLowerCase());
    inputs.forEach((el, i) => {
        const val = names[i];
        const isDupe = val !== '' && names.filter(n => n === val).length > 1;
        el.classList.toggle('duplicate', isDupe);
    });
}

renderNameInputs();

document.getElementById('start-btn').addEventListener('click', () => {
    const errorEl = document.getElementById('name-error');

    // Resolve display names
    const resolvedNames = [];
    for (let i = 0; i < selectedCount; i++) {
        const raw = document.getElementById(`pname-${i}`).value.trim();
        resolvedNames.push(raw || `Player ${i + 1}`);
    }

    // Duplicate check
    const lower = resolvedNames.map(n => n.toLowerCase());
    const hasDupe = lower.some((n, i) => lower.indexOf(n) !== i);
    if (hasDupe) {
        errorEl.classList.remove('hidden');
        return;
    }
    errorEl.classList.add('hidden');

    state.players = resolvedNames.map((name, i) => ({
        id: i, name, color: COLORS[i], pos: 0
    }));
    state.current = 0;
    state.active  = true;
    state.rolling = false;

    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    buildBoard();
    drawOverlay();
    setDiceFace(1);
    renderAll();
    log(`Game on! ${state.players[0].name} goes first.`);
});

// ── Exit game ──────────────────────────────────────────────────────────────

document.getElementById('exit-btn').addEventListener('click', () => {
    if (!confirm('Exit the current game and return to setup?')) return;
    resetToSetup();
});

function resetToSetup() {
    document.getElementById('win-overlay').classList.add('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('hidden');
    state = { players: [], current: 0, active: false, rolling: false };
    setDiceFace(1);
    document.getElementById('log-content').innerHTML = '';
}

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

            if (sq === 100)       cell.classList.add('finish');
            else if (SNAKES[sq])  cell.classList.add('special-snake');
            else if (LADDERS[sq]) cell.classList.add('special-ladder');

            const num = document.createElement('span');
            num.textContent = sq;
            cell.appendChild(num);

            const icons = { 100: '🏆' };
            if (SNAKES[sq])  icons[sq] = '🐍';
            if (LADDERS[sq]) icons[sq] = '🪜';
            if (icons[sq]) {
                const ic = document.createElement('div');
                ic.className = 'cell-icon';
                ic.textContent = icons[sq];
                cell.appendChild(ic);
            }
            board.appendChild(cell);
        }
    }
}

// ── SVG overlay ────────────────────────────────────────────────────────────

function drawOverlay() {
    const svg = document.getElementById('game-svg');
    svg.innerHTML = '';

    const defs = makeSVGEl('defs');
    defs.innerHTML = `
        <filter id="snake-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5"
                         flood-color="#000" flood-opacity="0.4"/>
        </filter>`;
    svg.appendChild(defs);

    drawLadders(svg);
    drawSnakes(svg);
}

function animateLine(el, delay) {
    const len = el.getTotalLength();
    gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
    gsap.to(el,  { strokeDashoffset: 0, duration: 0.65, ease: 'power2.inOut', delay });
}

function animatePath(el, delay, duration = 1.05) {
    const len = el.getTotalLength();
    gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
    gsap.to(el,  { strokeDashoffset: 0, duration, ease: 'power2.inOut', delay });
}

// ── Ladders ────────────────────────────────────────────────────────────────

function drawLadders(svg) {
    Object.entries(LADDERS).forEach(([fromStr, to], i) => {
        const p1  = squareCenter(parseInt(fromStr));
        const p2  = squareCenter(to);
        const dx  = p2.x - p1.x, dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        const nx  = (-dy / len) * 7, ny = (dx / len) * 7;
        const d0  = i * 0.12;

        for (const sign of [1, -1]) {
            const rail = makeSVGEl('line');
            rail.setAttribute('x1', p1.x + nx * sign); rail.setAttribute('y1', p1.y + ny * sign);
            rail.setAttribute('x2', p2.x + nx * sign); rail.setAttribute('y2', p2.y + ny * sign);
            rail.setAttribute('stroke', '#6d4c41');
            rail.setAttribute('stroke-width', '3');
            rail.setAttribute('stroke-linecap', 'round');
            svg.appendChild(rail);
            animateLine(rail, d0);
        }

        const steps = Math.floor(len / 16);
        for (let j = 1; j < steps; j++) {
            const t = j / steps;
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
        const style = SNAKE_STYLES[i % SNAKE_STYLES.length];
        const head  = squareCenter(parseInt(fromStr));
        const tail  = squareCenter(to);

        const dx  = tail.x - head.x, dy = tail.y - head.y;
        const len = Math.hypot(dx, dy);
        const ux  = dx / len, uy = dy / len;
        const px  = -uy,  py = ux;
        const amp = clamp(len * 0.22, 18, 44);

        // S-curve control points, clamped inside the 500×500 viewBox
        const cp1 = {
            x: clamp(head.x + ux * len * 0.33 + px * amp, 8, 492),
            y: clamp(head.y + uy * len * 0.33 + py * amp, 8, 492)
        };
        const cp2 = {
            x: clamp(tail.x - ux * len * 0.33 - px * amp, 8, 492),
            y: clamp(tail.y - uy * len * 0.33 - py * amp, 8, 492)
        };
        const pathD = `M ${head.x} ${head.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${tail.x} ${tail.y}`;
        const bodyDelay = 0.4 + i * 0.32;

        // Drop-shadow copy
        const shadow = makeSVGEl('path');
        shadow.setAttribute('d', pathD);
        shadow.setAttribute('stroke', 'rgba(0,0,0,0.3)');
        shadow.setAttribute('stroke-width', '14');
        shadow.setAttribute('fill', 'none');
        shadow.setAttribute('stroke-linecap', 'round');
        svg.appendChild(shadow);
        animatePath(shadow, bodyDelay);

        // Solid base body
        const base = makeSVGEl('path');
        base.setAttribute('d', pathD);
        base.setAttribute('stroke', style.base);
        base.setAttribute('stroke-width', '11');
        base.setAttribute('fill', 'none');
        base.setAttribute('stroke-linecap', 'round');
        svg.appendChild(base);
        animatePath(base, bodyDelay);

        // Lighter band overlay — creates alternating scale segments, fades in after body draws
        const bands = makeSVGEl('path');
        bands.setAttribute('d', pathD);
        bands.setAttribute('stroke', style.band);
        bands.setAttribute('stroke-width', '11');
        bands.setAttribute('fill', 'none');
        bands.setAttribute('stroke-linecap', 'butt');
        bands.setAttribute('stroke-dasharray', '12 18');
        svg.appendChild(bands);

        // Thin centre-spine highlight for depth
        const spine = makeSVGEl('path');
        spine.setAttribute('d', pathD);
        spine.setAttribute('stroke', 'rgba(255,255,255,0.22)');
        spine.setAttribute('stroke-width', '2.5');
        spine.setAttribute('fill', 'none');
        spine.setAttribute('stroke-linecap', 'round');
        svg.appendChild(spine);

        gsap.set([bands, spine], { opacity: 0 });
        gsap.to([bands, spine], { opacity: 1, duration: 0.35, delay: bodyDelay + 0.9 });

        // Pointy tail tip aligned to the curve's exit angle
        const tailAngle = Math.atan2(tail.y - cp2.y, tail.x - cp2.x) * 180 / Math.PI;
        const tailTip   = makeSVGEl('polygon');
        tailTip.setAttribute('points', '0,0 -9,-3.5 -6,0 -9,3.5');
        tailTip.setAttribute('fill', style.base);
        svg.appendChild(tailTip);
        gsap.set(tailTip, { x: tail.x, y: tail.y, rotation: tailAngle, transformOrigin: '0px 0px', opacity: 0 });
        gsap.to(tailTip,  { opacity: 1, duration: 0.2, delay: bodyDelay + 1.05 });

        // Illustrated head
        drawSnakeHead(svg, head, cp1, style, bodyDelay + 0.88);
    });
}

// Draws a top-down cartoon snake head facing away from its body.
function drawSnakeHead(svg, headPos, cp1, style, delay) {
    // The body leaves the head toward cp1, so the face is the opposite direction
    const bodyAngle = Math.atan2(cp1.y - headPos.y, cp1.x - headPos.x);
    const faceDeg   = (bodyAngle + Math.PI) * 180 / Math.PI;

    const g = makeSVGEl('g');
    // Local coords: head faces +x, body comes from −x

    // Neck blob — covers the body/head seam
    const neck = makeSVGEl('ellipse');
    neck.setAttribute('cx', '-7'); neck.setAttribute('cy', '0');
    neck.setAttribute('rx', '9');  neck.setAttribute('ry', '8.5');
    neck.setAttribute('fill', style.base);
    g.appendChild(neck);

    // Main head oval
    const headOval = makeSVGEl('ellipse');
    headOval.setAttribute('cx', '1');  headOval.setAttribute('cy', '0');
    headOval.setAttribute('rx', '15'); headOval.setAttribute('ry', '11.5');
    headOval.setAttribute('fill', style.headMid);
    g.appendChild(headOval);

    // Snout — slightly protruding rounded tip
    const snout = makeSVGEl('ellipse');
    snout.setAttribute('cx', '12'); snout.setAttribute('cy', '0');
    snout.setAttribute('rx', '7'); snout.setAttribute('ry', '8');
    snout.setAttribute('fill', style.headMid);
    g.appendChild(snout);

    // Top-of-head shine patch
    const shine = makeSVGEl('ellipse');
    shine.setAttribute('cx', '0');  shine.setAttribute('cy', '-3.5');
    shine.setAttribute('rx', '10'); shine.setAttribute('ry', '4.5');
    shine.setAttribute('fill', style.headLight);
    shine.setAttribute('opacity', '0.42');
    g.appendChild(shine);

    // Diamond scale mark on crown
    const diamond = makeSVGEl('path');
    diamond.setAttribute('d', 'M -2 0 L 2 -5.5 L 6 0 L 2 5.5 Z');
    diamond.setAttribute('fill', style.headDark);
    diamond.setAttribute('opacity', '0.4');
    g.appendChild(diamond);

    // Eyes — one on each side, with slit pupils like a real snake
    for (const side of [-1, 1]) {
        const ey = side * 6.8;
        const ex = 4;

        const sclera = makeSVGEl('circle');
        sclera.setAttribute('cx', ex); sclera.setAttribute('cy', ey);
        sclera.setAttribute('r', '4.6');
        sclera.setAttribute('fill', '#fff');
        sclera.setAttribute('stroke', style.headDark); sclera.setAttribute('stroke-width', '0.5');
        g.appendChild(sclera);

        const iris = makeSVGEl('circle');
        iris.setAttribute('cx', ex + 0.5); iris.setAttribute('cy', ey);
        iris.setAttribute('r', '3.3');
        iris.setAttribute('fill', style.eye);
        g.appendChild(iris);

        // Vertical slit pupil
        const pupil = makeSVGEl('ellipse');
        pupil.setAttribute('cx', ex + 0.8); pupil.setAttribute('cy', ey);
        pupil.setAttribute('rx', '1.3'); pupil.setAttribute('ry', '2.6');
        pupil.setAttribute('fill', '#111');
        g.appendChild(pupil);

        const gleam = makeSVGEl('circle');
        gleam.setAttribute('cx', ex + 1.8); gleam.setAttribute('cy', ey - 1.6);
        gleam.setAttribute('r', '0.9');
        gleam.setAttribute('fill', 'rgba(255,255,255,0.9)');
        g.appendChild(gleam);
    }

    // Nostrils
    for (const side of [-1, 1]) {
        const n = makeSVGEl('ellipse');
        n.setAttribute('cx', '17'); n.setAttribute('cy', side * 2.8);
        n.setAttribute('rx', '1.6'); n.setAttribute('ry', '1.0');
        n.setAttribute('fill', 'rgba(0,0,0,0.4)');
        g.appendChild(n);
    }

    // Subtle smile line
    const mouth = makeSVGEl('path');
    mouth.setAttribute('d', 'M 7 4.5 Q 12 7.5 18 4.5');
    mouth.setAttribute('stroke', style.headDark);
    mouth.setAttribute('stroke-width', '1.2');
    mouth.setAttribute('fill', 'none');
    mouth.setAttribute('stroke-linecap', 'round');
    g.appendChild(mouth);

    // Forked tongue — prominent bright red
    const tongue = makeSVGEl('path');
    tongue.setAttribute('d', 'M 18 0 L 30 0 M 30 0 L 38 -5.5 M 30 0 L 38 5.5');
    tongue.setAttribute('stroke', '#ff1744');
    tongue.setAttribute('stroke-width', '2.5');
    tongue.setAttribute('fill', 'none');
    tongue.setAttribute('stroke-linecap', 'round');
    g.appendChild(tongue);

    svg.appendChild(g);

    // GSAP positions the group then scales it in
    gsap.set(g, { x: headPos.x, y: headPos.y, rotation: faceDeg, transformOrigin: '0px 0px', scale: 0, opacity: 0 });
    gsap.to(g,  { scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(2)', delay, transformOrigin: '0px 0px' });
}

// ── Dice ───────────────────────────────────────────────────────────────────

function setDiceFace(value) {
    const dice   = document.getElementById('dice');
    const pattern = DICE_PATTERNS[value];
    dice.innerHTML = '';
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
        if (p.pos > 0) (posMap[p.pos] = posMap[p.pos] || []).push(p);
    });
    for (const [posStr, group] of Object.entries(posMap)) {
        const center = squareCenter(parseInt(posStr));
        group.forEach((p, idx) => {
            const offsetX = group.length > 1 ? (idx - (group.length - 1) / 2) * 16 : 0;
            const token   = document.createElement('div');
            token.className  = 'token';
            token.style.background = p.color;
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

// ── Dice roll ──────────────────────────────────────────────────────────────

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

// ── Game logic ─────────────────────────────────────────────────────────────

function applyMove(roll) {
    const player    = state.players[state.current];
    const target    = player.pos + roll;
    const rolledSix = roll === 6;

    if (target > 100) {
        log(`${player.name} rolled ${roll} — needs exactly ${100 - player.pos} to finish.`);
        endTurn();
        return;
    }

    log(`${player.name} rolled ${roll} — moved ${player.pos || 'Start'} → ${target}`);
    player.pos = target;
    renderAll();

    setTimeout(() => {
        if (SNAKES[target]) {
            // Snake: slide down and lose the turn (even if a 6 was rolled)
            const dest = SNAKES[target];
            log(`🐍 Snake! ${player.name} slides ${target} → ${dest}`);
            player.pos = dest;
            setTimeout(() => { renderAll(); endTurn(); }, 650);

        } else if (LADDERS[target]) {
            // Ladder: climb up and earn exactly one extra turn
            const dest = LADDERS[target];
            log(`🪜 Ladder! ${player.name} climbs ${target} → ${dest}`);
            if (rolledSix) log(`(Rolled 6 too — still just one extra turn!)`);
            player.pos = dest;
            setTimeout(() => {
                renderAll();
                if (dest === 100) {
                    handleWin(player);
                } else {
                    log(`🎉 ${player.name} gets an extra turn!`);
                    grantExtraTurn();
                }
            }, 650);

        } else if (target === 100) {
            handleWin(player);

        } else if (rolledSix) {
            // Plain 6, no special square: extra turn
            log(`🎲 Rolled a 6 — extra turn!`);
            grantExtraTurn();

        } else {
            endTurn();
        }
    }, 520);
}

function grantExtraTurn() {
    state.rolling = false;
    renderAll();
    document.getElementById('roll-btn').disabled = false;
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

// ── New game (from win screen) ─────────────────────────────────────────────

document.getElementById('new-game-btn').addEventListener('click', resetToSetup);

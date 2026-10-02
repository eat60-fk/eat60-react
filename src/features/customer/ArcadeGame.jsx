import { useCallback, useEffect, useRef, useState } from 'react';

// Game state, simulation steps, and canvas drawing helpers.
const DIRECTIONS = [{
  x: 0,
  y: -1,
  angle: -Math.PI / 2
}, {
  x: 1,
  y: 0,
  angle: 0
}, {
  x: 0,
  y: 1,
  angle: Math.PI / 2
}, {
  x: -1,
  y: 0,
  angle: Math.PI
}];
const FOOD = ['🍕', '🍔', '🌯', '🍜', '🧀', '🍟', '🌭'];
const BURGER_THEMES = [[[27, 15, 58], [7, 26, 51]], [[67, 18, 15], [26, 10, 5]], [[7, 63, 63], [4, 20, 31]]];
function readBest(key) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}
function randomBetween(min, max) {
  return min + Math.random() * Math.max(0, max - min);
}
function wrappedAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
function createSnakeGame(width, height) {
  const bounds = {
    x: 10,
    y: 62,
    w: width - 20,
    h: Math.max(140, height - 190)
  };
  const head = {
    x: bounds.x + bounds.w * 0.3,
    y: bounds.y + bounds.h / 2
  };
  const trail = [];
  for (let distance = 150; distance >= 0; distance -= 3) trail.push({
    x: head.x - distance,
    y: head.y
  });
  const game = {
    kind: 'snake',
    width,
    height,
    bounds,
    head,
    trail,
    points: [],
    direction: 1,
    angle: 0,
    length: 110,
    speed: 150,
    score: 0,
    food: null,
    chillies: [],
    chilliTimer: 2,
    particles: [],
    pops: [],
    bulges: [],
    flash: 0,
    dead: false,
    deadAt: 0,
    best: readBest('hs_best'),
    startedAt: Date.now(),
    time: 0,
    ambient: Array.from({
      length: 16
    }, () => ({
      x: Math.random(),
      y: Math.random(),
      radius: 8 + Math.random() * 26,
      speed: 0.01 + Math.random() * 0.03
    }))
  };
  sampleSnake(game);
  spawnSnakeFood(game);
  return game;
}
function sampleSnake(game) {
  const sampled = [{
    ...game.head
  }];
  const count = Math.floor(game.length / 4);
  let needed = 4;
  let previous = game.head;
  for (let index = game.trail.length - 1; index >= 0 && sampled.length < count; index--) {
    const point = game.trail[index];
    let distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    while (distance >= needed && sampled.length < count) {
      const fraction = needed / distance;
      const next = {
        x: previous.x + (point.x - previous.x) * fraction,
        y: previous.y + (point.y - previous.y) * fraction
      };
      sampled.push(next);
      previous = next;
      distance = Math.hypot(point.x - previous.x, point.y - previous.y);
      needed = 4;
    }
    needed -= distance;
    previous = point;
  }
  game.points = sampled;
}
function spawnSnakeFood(game) {
  const {
    bounds
  } = game;
  for (let attempt = 0; attempt < 30; attempt++) {
    const x = randomBetween(bounds.x + 28, bounds.x + bounds.w - 28);
    const y = randomBetween(bounds.y + 28, bounds.y + bounds.h - 28);
    if (Math.hypot(x - game.head.x, y - game.head.y) < 80) continue;
    if (game.points.some(point => Math.hypot(point.x - x, point.y - y) < 28)) continue;
    if (game.chillies.some(chilli => Math.hypot(chilli.x - x, chilli.y - y) < 40)) continue;
    game.food = {
      x,
      y,
      emoji: FOOD[Math.floor(Math.random() * FOOD.length)],
      born: game.time
    };
    return;
  }
  game.food = {
    x: bounds.x + bounds.w / 2,
    y: bounds.y + bounds.h / 2,
    emoji: '🍕',
    born: game.time
  };
}
function createBurgerGame(width, height) {
  return {
    kind: 'burger',
    width,
    height,
    birdX: width * 0.27,
    birdY: height * 0.45,
    velocity: 0,
    score: 0,
    lives: 3,
    invulnerable: 0,
    flap: 0,
    obstacles: [],
    chillies: [],
    cheese: [],
    particles: [],
    pops: [],
    shake: 0,
    floorOffset: 0,
    speed: 150,
    theme: 0,
    background: BURGER_THEMES[0].map(color => color.slice()),
    best: readBest('fb_best'),
    toast: null,
    hitBy: '',
    dead: false,
    deadAt: 0,
    started: false,
    startedAt: Date.now(),
    time: 0,
    ambient: Array.from({
      length: 16
    }, () => ({
      x: Math.random(),
      y: Math.random(),
      radius: 8 + Math.random() * 26,
      speed: 0.01 + Math.random() * 0.03
    }))
  };
}
function addParticle(game, x, y, count, colors) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 160;
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color: colors[i % colors.length],
      radius: 2 + Math.random() * 3
    });
  }
}
function flapBurger(game) {
  if (!game || game.dead) return;
  game.started = true;
  game.velocity = -440;
  game.flap = 1;
  for (let index = 0; index < 3; index++) {
    game.particles.push({
      x: game.birdX - 18,
      y: game.birdY + 8,
      vx: -60 - Math.random() * 50,
      vy: 20 + Math.random() * 60,
      life: 0.7,
      color: '#fff',
      radius: 2 + Math.random() * 2
    });
  }
}
function addObstacle(game) {
  const gap = Math.max(150, 205 - game.score * 1.5);
  const center = gap / 2 + 80 + Math.random() * Math.max(0, game.height - 44 - gap - 160);
  const obstacle = {
    x: game.width + 70,
    width: 64,
    center,
    gap,
    passed: false
  };
  game.obstacles.push(obstacle);
  if (game.score >= 3 && Math.random() < 0.45) {
    game.chillies.push({
      x: obstacle.x + 135,
      base: game.height * 0.45,
      amplitude: game.height * (0.2 + Math.random() * 0.08),
      phase: Math.random() * Math.PI * 2,
      y: game.height * 0.45
    });
  }
  if (game.lives < 3 && Math.random() < 0.3) game.cheese.push({
    x: obstacle.x + 32,
    y: center,
    collected: false
  });
}
function circleRectHit(cx, cy, radius, x, y, width, height) {
  const dx = cx - Math.max(x, Math.min(cx, x + width));
  const dy = cy - Math.max(y, Math.min(cy, y + height));
  return dx * dx + dy * dy < radius * radius;
}
function loseBurgerLayer(game, source) {
  if (game.invulnerable > 0) return;
  const layers = {
    3: ['#5fd35f', 9],
    2: ['#5a2d1b', 13],
    1: ['#e8a24a', 24]
  };
  const [color, height] = layers[game.lives];
  game.particles.push({
    x: game.birdX,
    y: game.birdY,
    vx: -80 - Math.random() * 60,
    vy: -220,
    life: 1.4,
    color,
    width: 54,
    height,
    rotation: 0,
    spin: (Math.random() - 0.5) * 14
  });
  game.lives--;
  game.invulnerable = 1.4;
  game.shake = 0.35;
  game.hitBy = source;
  if (game.lives <= 0) {
    game.dead = true;
    game.deadAt = 0;
    game.velocity = -300;
    addParticle(game, game.birdX, game.birdY, 26, ['#ff9a3c', '#e8a24a', '#fff', '#ff4d4d']);
  }
}
function steerSnake(game, next) {
  if (game.dead || game.kind !== 'snake') return;
  if (next === (game.direction + 2) % 4) return;
  game.direction = next;
}
function stepSnake(game, dt) {
  game.time += dt;
  let difference = wrappedAngle(DIRECTIONS[game.direction].angle - game.angle);
  const turn = 12 * dt;
  game.angle += Math.abs(difference) < turn ? difference : Math.sign(difference) * turn;
  game.head.x += Math.cos(game.angle) * game.speed * dt;
  game.head.y += Math.sin(game.angle) * game.speed * dt;
  const last = game.trail[game.trail.length - 1];
  if (Math.hypot(game.head.x - last.x, game.head.y - last.y) >= 2.5) game.trail.push({
    ...game.head
  });
  if (game.trail.length > 2200) game.trail.splice(0, 600);
  sampleSnake(game);
  if (game.food && Math.hypot(game.head.x - game.food.x, game.head.y - game.food.y) < 27) {
    game.score++;
    if (game.score > game.best) {
      game.best = game.score;
      try {
        localStorage.setItem('hs_best', String(game.best));
      } catch {/* Best score storage is optional. */}
    }
    game.length += 24;
    game.speed = Math.min(240, 150 + game.score * 3);
    game.pops.push({
      x: game.food.x,
      y: game.food.y,
      time: 0
    });
    game.bulges.push(0);
    game.flash = 1;
    addParticle(game, game.food.x, game.food.y, 16, ['#ffd25a', '#ff7a3c', '#3dff9a', '#fff']);
    game.food = null;
    game.lastFoodAt = Date.now();
    try {
      navigator.vibrate?.(15);
    } catch {/* Vibration is optional. */}
    spawnSnakeFood(game);
  }
  if (game.score >= 2) {
    game.chilliTimer -= dt;
    if (game.chilliTimer <= 0 && game.chillies.length < Math.min(5, 1 + (game.score / 4 | 0))) {
      const {
        bounds
      } = game;
      for (let attempt = 0; attempt < 30; attempt++) {
        const x = randomBetween(bounds.x + 26, bounds.x + bounds.w - 26);
        const y = randomBetween(bounds.y + 26, bounds.y + bounds.h - 26);
        if (Math.hypot(x - game.head.x, y - game.head.y) < 130) continue;
        if (game.food && Math.hypot(x - game.food.x, y - game.food.y) < 50) continue;
        if (game.points.some(point => Math.hypot(point.x - x, point.y - y) < 30)) continue;
        const moving = game.score >= 8 && Math.random() < 0.5;
        const angle = Math.random() * Math.PI * 2;
        game.chillies.push({
          x,
          y,
          born: game.time,
          warning: 1.1,
          life: 7 + Math.random() * 3,
          vx: moving ? Math.cos(angle) * 28 : 0,
          vy: moving ? Math.sin(angle) * 28 : 0
        });
        break;
      }
      game.chilliTimer = Math.max(1.6, 4.2 - game.score * 0.12);
    }
  }
  const {
    bounds
  } = game;
  for (const chilli of game.chillies) {
    chilli.life -= dt;
    if (chilli.warning > 0) chilli.warning -= dt;else {
      chilli.x += chilli.vx * dt;
      chilli.y += chilli.vy * dt;
      if (chilli.x < bounds.x + 18 || chilli.x > bounds.x + bounds.w - 18) chilli.vx *= -1;
      if (chilli.y < bounds.y + 18 || chilli.y > bounds.y + bounds.h - 18) chilli.vy *= -1;
    }
  }
  game.chillies = game.chillies.filter(chilli => chilli.life > 0);
  if (game.chillies.some(chilli => chilli.warning <= 0 && Math.hypot(game.head.x - chilli.x, game.head.y - chilli.y) < 23)) {
    game.dead = true;
    game.deadAt = 0;
    game.hitBy = 'chilli';
    addParticle(game, game.head.x, game.head.y, 26, ['#ff4d4d', '#ff9a3c', '#fff']);
  }
  if (game.dead) return;
  if (game.head.x < bounds.x + 5.5 || game.head.x > bounds.x + bounds.w - 5.5 || game.head.y < bounds.y + 5.5 || game.head.y > bounds.y + bounds.h - 5.5 || game.points.slice(9).some(point => Math.hypot(game.head.x - point.x, game.head.y - point.y) < 9.9)) {
    game.dead = true;
    game.deadAt = 0;
    addParticle(game, game.head.x, game.head.y, 26, ['#ff4d4d', '#ff9a3c', '#fff']);
  }
}
function stepBurger(game, dt, time) {
  game.time += dt;
  if (!game.started) {
    game.birdY = game.height * 0.45 + Math.sin(time * 4) * 8;
    return;
  }
  game.velocity += 1500 * dt;
  game.birdY += game.velocity * dt;
  const dx = Math.min(240, 150 + game.score * 2.5) * dt;
  game.speed = Math.min(240, 150 + game.score * 2.5);
  game.floorOffset = (game.floorOffset + dx) % 40;
  for (const obstacle of game.obstacles) obstacle.x -= dx;
  for (const chilli of game.chillies) {
    chilli.x -= dx;
    chilli.y = chilli.base + Math.sin(time * 2.2 + chilli.phase) * chilli.amplitude;
  }
  for (const cheese of game.cheese) cheese.x -= dx;
  if (!game.obstacles.length || game.obstacles[game.obstacles.length - 1].x < game.width - 250) addObstacle(game);
  game.obstacles = game.obstacles.filter(obstacle => obstacle.x > -100);
  game.chillies = game.chillies.filter(chilli => chilli.x > -40);
  game.cheese = game.cheese.filter(cheese => cheese.x > -40 && !cheese.collected);
  for (const obstacle of game.obstacles) {
    if (!obstacle.passed && obstacle.x + obstacle.width / 2 < game.birdX) {
      obstacle.passed = true;
      game.score++;
      if (game.score > game.best) {
        game.best = game.score;
        try {
          localStorage.setItem('fb_best', String(game.best));
        } catch {/* Best score storage is optional. */}
      }
      game.pops.push({
        x: game.birdX + 30,
        y: game.birdY - 34,
        time: 0,
        text: '+1'
      });
      if (game.score % 10 === 0) {
        game.theme = (game.theme + 1) % 3;
        game.toast = {
          text: ['Kitchen 🍳', 'Pizza Oven 🍕', 'Wok Street 🥡'][game.theme],
          time: 0
        };
      }
    }
  }
  const floor = game.height - 44;
  if (game.birdY < 18) {
    game.birdY = 18;
    game.velocity = 0;
  }
  if (game.birdY > floor - 18) {
    game.birdY = floor - 18;
    loseBurgerLayer(game, 'floor');
    if (!game.dead) game.velocity = -430;
  }
  if (!game.dead && game.invulnerable <= 0) {
    for (const obstacle of game.obstacles) {
      const centerX = obstacle.x + obstacle.width / 2;
      const top = obstacle.center - obstacle.gap / 2;
      const bottom = obstacle.center + obstacle.gap / 2;
      if (circleRectHit(game.birdX, game.birdY, 17, centerX - 7, 0, 14, top - 10) || circleRectHit(game.birdX, game.birdY, 17, centerX - 29, top - 34, 58, 34) || circleRectHit(game.birdX, game.birdY, 17, obstacle.x - 2, bottom, obstacle.width + 4, game.height)) {
        game.velocity = Math.max(-420, Math.min(420, (obstacle.center - game.birdY) * 4));
        loseBurgerLayer(game, 'obstacle');
        break;
      }
    }
  }
  if (!game.dead && game.invulnerable <= 0) {
    for (const chilli of game.chillies) {
      if (Math.hypot(game.birdX - chilli.x, game.birdY - chilli.y) < 29) {
        const {
          x,
          y
        } = chilli;
        chilli.x = -999;
        addParticle(game, x, y, 8, ['#ff3b30']);
        loseBurgerLayer(game, 'chilli');
        break;
      }
    }
  }
  if (!game.dead) for (const cheese of game.cheese) {
    if (!cheese.collected && Math.hypot(game.birdX - cheese.x, game.birdY - cheese.y) < 33) {
      cheese.collected = true;
      if (game.lives < 3) game.lives++;
      addParticle(game, cheese.x, cheese.y, 16, ['#ffd25a', '#fff', '#ffb300']);
      game.pops.push({
        x: game.birdX + 30,
        y: game.birdY - 34,
        time: 0,
        text: '+layer!'
      });
      try {
        navigator.vibrate?.(15);
      } catch {/* Vibration is optional. */}
    }
  }
  game.invulnerable = Math.max(0, game.invulnerable - dt);
  game.flap = Math.max(0, game.flap - dt * 2.5);
  game.shake = Math.max(0, game.shake - dt);
  if (game.toast) {
    game.toast.time += dt;
    if (game.toast.time > 1.8) game.toast = null;
  }
  for (let row = 0; row < 2; row++) for (let channel = 0; channel < 3; channel++) {
    const target = BURGER_THEMES[game.theme][row][channel];
    game.background[row][channel] += (target - game.background[row][channel]) * Math.min(1, dt * 2);
  }
  if (game.dead) {
    game.deadAt += dt;
    game.velocity += 1500 * dt;
    game.birdY = Math.min(floor - 18, game.birdY + game.velocity * dt);
  }
}
function drawSnake(ctx, game, time) {
  const {
    bounds,
    points
  } = game;
  ctx.save();
  if (game.dead) ctx.globalAlpha = Math.max(0.2, 1 - game.deadAt * 0.8);
  const body = points.map((point, index) => {
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(points.length - 1, index + 1)];
    const magnitude = Math.hypot(after.x - before.x, after.y - before.y) || 1;
    const offset = Math.sin(time * 7 - index * 0.5) * 5 * Math.min(1, index / 8) * (1 - 0.35 * index / points.length);
    const radius = 11 * (1 - 0.5 * Math.pow(index / points.length, 1.6)) + game.bulges.reduce((sum, bulge) => sum + 5 * Math.exp(-((index - bulge) ** 2) / 8), 0);
    return {
      x: point.x - (after.y - before.y) / magnitude * offset,
      y: point.y + (after.x - before.x) / magnitude * offset,
      radius: index < 3 ? 12 : radius
    };
  });
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath();
  body.forEach(part => {
    ctx.moveTo(part.x + 3 + part.radius, part.y + 5);
    ctx.arc(part.x + 3, part.y + 5, part.radius + 1, 0, Math.PI * 2);
  });
  ctx.fill();
  ctx.fillStyle = game.dead ? '#4a0f14' : '#07382a';
  ctx.beginPath();
  body.forEach(part => {
    ctx.moveTo(part.x + part.radius + 2, part.y);
    ctx.arc(part.x, part.y, part.radius + 2, 0, Math.PI * 2);
  });
  ctx.fill();
  body.forEach((part, index) => {
    ctx.fillStyle = game.dead ? `hsl(${index % 2 ? 5 : 15},70%,50%)` : `hsl(${145 + Math.min(index, 60) * 0.6},80%,${51 - Math.min(index, 60) * 0.12}%)`;
    ctx.beginPath();
    ctx.arc(part.x, part.y, part.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  for (let index = body.length - 1; index >= 1; index--) {
    const part = body[index];
    if (index % 4 === 2 && index > 3) {
      ctx.fillStyle = 'rgba(255,210,90,.85)';
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.radius * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath();
    ctx.arc(part.x - part.radius * 0.25, part.y - part.radius * 0.3, part.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const head = game.head;
  const cos = Math.cos(game.angle);
  const sin = Math.sin(game.angle);
  if (!game.dead && Math.sin(time * 4) - 0.55 > 0) {
    const flick = Math.sin(time * 4) - 0.55;
    const length = 19 + 16 * flick;
    const tipX = head.x + cos * length;
    const tipY = head.y + sin * length;
    ctx.strokeStyle = '#ff3b5c';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(head.x + cos * 11, head.y + sin * 11);
    ctx.lineTo(tipX, tipY);
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + cos * 5 - sin * 4, tipY + sin * 5 + cos * 4);
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + cos * 5 + sin * 4, tipY + sin * 5 - cos * 4);
    ctx.stroke();
  }
  ctx.fillStyle = game.dead ? '#ff6a4d' : '#5dffb0';
  ctx.beginPath();
  ctx.arc(head.x, head.y, 13.2, 0, Math.PI * 2);
  ctx.fill();
  const scared = game.chillies.some(chilli => chilli.warning <= 0 && Math.hypot(head.x - chilli.x, head.y - chilli.y) < 85);
  for (const side of [-1, 1]) {
    const eyeX = head.x + cos * 4.5 - sin * 6.2 * side;
    const eyeY = head.y + sin * 4.5 + cos * 6.2 * side;
    if (game.dead) {
      ctx.strokeStyle = '#220';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(eyeX - 2.6, eyeY - 2.6);
      ctx.lineTo(eyeX + 2.6, eyeY + 2.6);
      ctx.moveTo(eyeX + 2.6, eyeY - 2.6);
      ctx.lineTo(eyeX - 2.6, eyeY + 2.6);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, scared ? 5.5 : 4.4, 0, Math.PI * 2);
      ctx.fill();
      let lookX = cos,
        lookY = sin;
      if (game.food) {
        const dx = game.food.x - eyeX;
        const dy = game.food.y - eyeY;
        const magnitude = Math.hypot(dx, dy) || 1;
        lookX = dx / magnitude;
        lookY = dy / magnitude;
      }
      ctx.fillStyle = '#14212b';
      ctx.beginPath();
      ctx.arc(eyeX + lookX * 1.6, eyeY + lookY * 1.6, scared ? 1.1 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
function drawChilli(ctx, chilli, time) {
  const warning = chilli.warning > 0;
  const blink = chilli.life < 1.2 ? 0.4 + 0.6 * Math.abs(Math.sin(time * 14)) : 1;
  const alpha = warning ? 0.35 + 0.35 * Math.sin(time * 20) : blink;
  const progress = Math.min(1, (time - chilli.born) / 0.35);
  const scale = progress < 1 ? 1 + 2.70158 * (progress - 1) ** 3 + 1.70158 * (progress - 1) ** 2 : 1;
  const glow = ctx.createRadialGradient(chilli.x, chilli.y, 0, chilli.x, chilli.y, 32);
  glow.addColorStop(0, `rgba(255,40,30,${0.45 * alpha})`);
  glow.addColorStop(1, 'rgba(255,40,30,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(chilli.x - 36, chilli.y - 36, 72, 72);
  if (warning) {
    ctx.strokeStyle = `rgba(255,80,60,${alpha})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(chilli.x, chilli.y, 18 + Math.sin(time * 10) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(chilli.x, chilli.y);
  ctx.rotate(Math.sin(time * 5 + chilli.born) * 0.25);
  ctx.scale(scale, scale);
  ctx.font = '28px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🌶️', 0, 1);
  ctx.restore();
}
function drawBurger(ctx, game, time) {
  const gradient = ctx.createLinearGradient(0, 0, 0, game.height);
  gradient.addColorStop(0, `rgb(${game.background[0].map(value => value | 0)})`);
  gradient.addColorStop(1, `rgb(${game.background[1].map(value => value | 0)})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, game.width, game.height);
  for (const bubble of game.ambient) {
    bubble.y -= bubble.speed / 60;
    if (bubble.y < -0.1) bubble.y = 1.1;
    const x = bubble.x * game.width + Math.sin(time * 0.6 + bubble.radius) * 14;
    const y = bubble.y * game.height;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, bubble.radius * 2);
    glow.addColorStop(0, 'rgba(255,255,255,.12)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - bubble.radius * 2, y - bubble.radius * 2, bubble.radius * 4, bubble.radius * 4);
  }
  ctx.save();
  if (game.shake > 0) ctx.translate((Math.random() - 0.5) * 10 * game.shake * 2, (Math.random() - 0.5) * 10 * game.shake * 2);
  for (const obstacle of game.obstacles) {
    const x = obstacle.x + obstacle.width / 2;
    const top = obstacle.center - obstacle.gap / 2;
    const bottom = obstacle.center + obstacle.gap / 2;
    const metal = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
    metal.addColorStop(0, '#8996a8');
    metal.addColorStop(0.5, '#e2e9f2');
    metal.addColorStop(1, '#7d8a9a');
    ctx.fillStyle = metal;
    ctx.fillRect(x - 7, 0, 14, top - 20);
    const lip = ctx.createLinearGradient(x - 30, 0, x + 30, 0);
    lip.addColorStop(0, '#7d8a9a');
    lip.addColorStop(0.45, '#e2e9f2');
    lip.addColorStop(1, '#6c7888');
    ctx.fillStyle = lip;
    ctx.beginPath();
    ctx.arc(x, top - 32, 30, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#aab4c2';
    ctx.beginPath();
    ctx.ellipse(x, top - 32, 30, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff9a3c';
    ctx.fillRect(x - 4, 0, 8, 8);
    ctx.fillStyle = '#697686';
    let row = 0;
    for (let y = bottom; y < game.height - 44; y += 28) {
      ctx.fillStyle = row++ % 2 ? '#3a3f4b' : '#4b5262';
      ctx.beginPath();
      ctx.roundRect(obstacle.x - 2, y, obstacle.width + 4, 27, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.fillRect(obstacle.x + 2, y + 3, obstacle.width - 4, 3);
      ctx.fillStyle = '#697686';
      if (y === bottom) {
        ctx.fillStyle = '#7a4a2a';
        ctx.fillRect(obstacle.x + obstacle.width + 2, y + 8, 28, 9);
      }
    }
  }
  const floor = game.height - 44;
  ctx.fillStyle = 'rgba(8,10,24,.9)';
  ctx.fillRect(-10, floor, game.width + 20, 54);
  ctx.fillStyle = 'rgba(255,170,60,.7)';
  ctx.fillRect(0, floor, game.width, 3);
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  for (let x = -game.floorOffset; x < game.width; x += 40) ctx.fillRect(x, floor + 8, 2, 44);
  ctx.font = '28px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const cheese of game.cheese) if (!cheese.collected) {
    const y = cheese.y + Math.sin(time * 4) * 4;
    const glow = ctx.createRadialGradient(cheese.x, y, 0, cheese.x, y, 34);
    glow.addColorStop(0, 'rgba(255,210,90,.45)');
    glow.addColorStop(1, 'rgba(255,210,90,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cheese.x - 34, y - 34, 68, 68);
    ctx.fillStyle = '#fff';
    ctx.fillText('🧀', cheese.x, y);
  }
  for (const chilli of game.chillies) {
    const glow = ctx.createRadialGradient(chilli.x, chilli.y, 0, chilli.x, chilli.y, 32);
    glow.addColorStop(0, 'rgba(255,40,30,.5)');
    glow.addColorStop(1, 'rgba(255,40,30,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(chilli.x - 36, chilli.y - 36, 72, 72);
    ctx.save();
    ctx.translate(chilli.x, chilli.y);
    ctx.rotate(Math.sin(time * 5 + chilli.phase) * 0.3);
    ctx.fillStyle = '#fff';
    ctx.fillText('🌶️', 0, 1);
    ctx.restore();
  }
  const burgerLayers = game.lives >= 3 ? ['bun', 'patty', 'lettuce', 'top'] : game.lives === 2 ? ['bun', 'patty', 'top'] : ['bun', 'top'];
  const heights = {
    bun: 14,
    patty: 13,
    lettuce: 9,
    top: 24
  };
  const total = burgerLayers.reduce((sum, layer) => sum + heights[layer], 0);
  ctx.save();
  ctx.translate(game.birdX, game.birdY);
  ctx.rotate(game.dead ? game.deadAt * 6 : Math.max(-0.4, Math.min(0.6, game.velocity / 800)));
  if (game.invulnerable > 0 && Math.sin(time * 40) < 0) ctx.globalAlpha = 0.35;
  const wingAngle = -0.5 + Math.sin(time * 35) * 0.55 * game.flap + Math.sin(time * 6) * 0.1;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 27, -2);
    ctx.rotate(-wingAngle * side);
    ctx.fillStyle = 'rgba(255,255,255,.88)';
    ctx.beginPath();
    ctx.ellipse(side * 12, -6, 15, 7, side * (-0.5 + wingAngle * 0.8), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  let layerY = total / 2;
  for (const layer of burgerLayers) {
    const layerHeight = heights[layer];
    layerY -= layerHeight;
    if (layer === 'bun' || layer === 'patty') {
      ctx.fillStyle = layer === 'bun' ? '#d9954a' : '#5a2d1b';
      ctx.beginPath();
      ctx.roundRect(-29, layerY, 58, layerHeight, 6);
      ctx.fill();
    } else if (layer === 'lettuce') {
      ctx.fillStyle = '#5fd35f';
      ctx.beginPath();
      ctx.moveTo(-31, layerY + layerHeight);
      for (let index = 0; index <= 12; index++) ctx.lineTo(-31 + index * 5.17, layerY + (index % 2 ? layerHeight : 2));
      ctx.lineTo(31, layerY + layerHeight);
      ctx.fill();
    } else {
      ctx.fillStyle = '#eeab52';
      ctx.beginPath();
      ctx.ellipse(0, layerY + layerHeight, 28, layerHeight, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff3c9';
      for (const [seedX, seedY] of [[-14, -7], [-3, -13], [9, -8], [16, -3], [-20, -2]]) {
        ctx.beginPath();
        ctx.ellipse(seedX, layerY + layerHeight + seedY, 2.4, 1.3, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      const eyeY = layerY + layerHeight - 9;
      for (const eyeX of [-9, 9]) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, game.lives === 1 || game.dead ? 4.6 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#14212b';
        ctx.beginPath();
        ctx.arc(eyeX + 1, eyeY + (game.velocity > 200 ? 1.2 : 0), game.lives === 1 || game.dead ? 1.5 : 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
  ctx.font = '800 20px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd25a';
  for (const pop of game.pops) {
    ctx.globalAlpha = Math.max(0, 1 - pop.time / 0.8);
    ctx.fillText(pop.text || '+1', pop.x, pop.y - pop.time * 50);
  }
  ctx.globalAlpha = 1;
  if (game.toast) {
    const alpha = Math.sin(Math.min(1, game.toast.time / 1.8) * Math.PI);
    ctx.globalAlpha = alpha;
    ctx.font = '800 30px system-ui,sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(game.toast.text, game.width / 2, game.height * 0.28 - (1 - alpha) * 10);
    ctx.globalAlpha = 1;
  }
  if (!game.started && !game.dead) {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 6);
    ctx.font = '800 24px system-ui,sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('TAP TO FLY', game.width / 2, game.height * 0.62);
    ctx.globalAlpha = 1;
  }
  for (const particle of game.particles) {
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    if (particle.width) {
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation || 0);
      ctx.fillRect(-particle.width / 2, -particle.height / 2, particle.width, particle.height);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius * particle.life, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
function resizeRound(round, width, height) {
  if (!round) return;
  const oldWidth = round.width;
  const oldHeight = round.height;
  if (!oldWidth || !oldHeight || oldWidth === width && oldHeight === height) return;
  const scaleX = width / oldWidth;
  const scaleY = height / oldHeight;
  const scale = Math.min(scaleX, scaleY);
  const move = point => {
    point.x *= scaleX;
    point.y *= scaleY;
  };
  if (round.kind === 'snake') {
    round.width = width;
    round.height = height;
    move(round.head);
    round.trail.forEach(move);
    round.points.forEach(move);
    if (round.food) move(round.food);
    round.chillies.forEach(chilli => {
      move(chilli);
      chilli.vx *= scaleX;
      chilli.vy *= scaleY;
    });
    round.particles.forEach(particle => {
      move(particle);
      particle.vx *= scaleX;
      particle.vy *= scaleY;
      particle.radius *= scale;
    });
    round.pops.forEach(move);
    round.length *= scale;
    round.speed *= scale;
    round.bounds = {
      x: 10,
      y: 62,
      w: width - 20,
      h: Math.max(140, height - 190)
    };
  } else {
    round.width = width;
    round.height = height;
    round.birdX *= scaleX;
    round.birdY *= scaleY;
    round.velocity *= scaleY;
    round.obstacles.forEach(obstacle => {
      obstacle.x *= scaleX;
      obstacle.width *= scaleX;
      obstacle.center *= scaleY;
      obstacle.gap *= scaleY;
    });
    round.chillies.forEach(chilli => {
      chilli.x *= scaleX;
      chilli.y *= scaleY;
      chilli.base *= scaleY;
      chilli.amplitude *= scaleY;
    });
    round.cheese.forEach(move);
    round.particles.forEach(particle => {
      move(particle);
      particle.vx *= scaleX;
      particle.vy *= scaleY;
    });
    round.pops.forEach(move);
    round.speed *= scaleX;
    round.floorOffset *= scaleX;
  }
}
export default function ArcadeGame({
  game,
  title,
  onEnd,
  onQuit
}) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const onEndRef = useRef(onEnd);
  const onQuitRef = useRef(onQuit);
  const submittedRef = useRef(false);
  const resultRef = useRef(false);
  const swipeRef = useRef(null);
  const [hud, setHud] = useState({
    score: 0,
    best: 0,
    lives: 3,
    theme: 0
  });
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  onEndRef.current = onEnd;
  onQuitRef.current = onQuit;
  const endRound = useCallback(async round => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSaving(true);
    try {
      const outcome = await onEndRef.current(round.score, Math.max(1000, Date.now() - round.startedAt));
      setResult({
        score: round.score,
        xp: outcome?.data?.xp,
        coins: outcome?.data?.coins,
        error: outcome?.error?.message || ''
      });
    } catch (error) {
      setResult({
        score: round.score,
        error: error.message || 'Your score could not be saved.'
      });
    } finally {
      resultRef.current = true;
      setSaving(false);
    }
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return undefined;
    submittedRef.current = false;
    resultRef.current = false;
    setResult(null);
    setSaving(false);
    let width = 0;
    let height = 0;
    let raf = 0;
    let lastTime = 0;
    let elapsed = 0;
    let lastHud = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (gameRef.current) resizeRound(gameRef.current, width, height);else gameRef.current = game === 'snake' ? createSnakeGame(width, height) : createBurgerGame(width, height);
    };
    const drawSnakeFrame = (round, time) => {
      const gradient = context.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#1b0f3a');
      gradient.addColorStop(1, '#071a33');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      for (const bubble of round.ambient) {
        bubble.y -= bubble.speed / 60;
        if (bubble.y < -0.1) bubble.y = 1.1;
        const x = bubble.x * width + Math.sin(time * 0.6 + bubble.radius) * 14;
        const y = bubble.y * height;
        const glow = context.createRadialGradient(x, y, 0, x, y, bubble.radius * 2);
        glow.addColorStop(0, 'rgba(120,160,255,.16)');
        glow.addColorStop(1, 'rgba(120,160,255,0)');
        context.fillStyle = glow;
        context.fillRect(x - bubble.radius * 2, y - bubble.radius * 2, bubble.radius * 4, bubble.radius * 4);
      }
      context.save();
      if (round.dead && round.deadAt < 0.5) {
        const shake = 8 * (1 - round.deadAt * 2);
        context.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      }
      const bounds = round.bounds;
      context.beginPath();
      context.roundRect(bounds.x, bounds.y, bounds.w, bounds.h, 22);
      context.fillStyle = 'rgba(10,16,40,.72)';
      context.fill();
      context.save();
      context.beginPath();
      context.roundRect(bounds.x, bounds.y, bounds.w, bounds.h, 22);
      context.clip();
      for (let x = bounds.x + 10; x < bounds.x + bounds.w; x += 22) for (let y = bounds.y + 10; y < bounds.y + bounds.h; y += 22) {
        context.fillStyle = `rgba(120,200,255,${0.1 + 0.14 * Math.max(0, Math.sin(x * 0.025 + y * 0.02 - time * 2.2))})`;
        context.fillRect(x, y, 2.4, 2.4);
      }
      context.restore();
      context.lineWidth = 2.5;
      context.shadowBlur = round.flash * 12;
      context.shadowColor = round.flash ? '#ffa23f' : '#3dff9a';
      context.strokeStyle = round.flash ? 'rgba(255,170,60,.8)' : 'rgba(80,255,170,.5)';
      context.beginPath();
      context.roundRect(bounds.x, bounds.y, bounds.w, bounds.h, 22);
      context.stroke();
      context.shadowBlur = 0;
      if (round.food) {
        const progress = Math.min(1, (time - round.food.born) / 0.4);
        const scale = progress < 1 ? 1 + 2.70158 * (progress - 1) ** 3 + 1.70158 * (progress - 1) ** 2 : 1;
        const bob = round.food.y + Math.sin(time * 3) * 3;
        const pulse = 1 + 0.08 * Math.sin(time * 6);
        const glow = context.createRadialGradient(round.food.x, bob, 0, round.food.x, bob, 36);
        glow.addColorStop(0, `rgba(255,190,80,${0.35 * pulse})`);
        glow.addColorStop(1, 'rgba(255,190,80,0)');
        context.fillStyle = glow;
        context.fillRect(round.food.x - 36, bob - 36, 72, 72);
        context.save();
        context.translate(round.food.x, bob);
        context.scale(scale * pulse, scale * pulse);
        context.font = '28px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(round.food.emoji, 0, 1);
        context.restore();
      }
      for (const chilli of round.chillies) drawChilli(context, chilli, time);
      drawSnake(context, round, time);
      for (const particle of round.particles) {
        context.globalAlpha = Math.max(0, particle.life);
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius * particle.life + 0.5, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      context.font = '800 20px system-ui,sans-serif';
      context.textAlign = 'center';
      for (const pop of round.pops) {
        context.globalAlpha = Math.max(0, 1 - pop.time / 0.8);
        context.fillStyle = '#ffd25a';
        context.fillText('+1', pop.x, pop.y - 14 - pop.time * 50);
      }
      context.globalAlpha = 1;
      context.restore();
    };
    const loop = timestamp => {
      const dt = lastTime ? Math.min(0.033, (timestamp - lastTime) / 1000) : 0;
      lastTime = timestamp;
      elapsed += dt;
      const round = gameRef.current;
      if (!round) return;
      if (!round.dead) {
        if (round.kind === 'snake') stepSnake(round, dt);else stepBurger(round, dt, elapsed);
      } else {
        round.deadAt += dt;
        if (round.kind === 'burger') {
          round.velocity += 1500 * dt;
          round.birdY = Math.min(round.height - 44 - 18, round.birdY + round.velocity * dt);
        }
      }
      round.flash = Math.max(0, (round.flash || 0) - dt * 3);
      round.bulges = (round.bulges || []).map(bulge => bulge + dt * 45).filter(bulge => bulge < round.points.length + 6);
      for (const particle of round.particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += (round.kind === 'snake' ? 220 : 260) * dt;
        particle.life -= dt * (round.kind === 'snake' ? 1.8 : 1.5);
        if (particle.width) particle.rotation = (particle.rotation || 0) + (particle.spin || 0) * dt;
      }
      round.particles = round.particles.filter(particle => particle.life > 0);
      for (const pop of round.pops) pop.time += dt;
      round.pops = round.pops.filter(pop => pop.time < 0.8);
      if (round.kind === 'snake') drawSnakeFrame(round, elapsed);else drawBurger(context, round, elapsed);
      if (timestamp - lastHud > 100) {
        setHud({
          score: round.score,
          best: round.best,
          lives: round.lives ?? 3,
          theme: round.theme || 0
        });
        lastHud = timestamp;
      }
      if (round.dead) {
        if (!submittedRef.current) endRound(round);
      }
      if (!resultRef.current && (!round.dead || round.deadAt < 1.2)) raf = requestAnimationFrame(loop);
    };
    resize();
    raf = requestAnimationFrame(loop);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const keydown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onQuitRef.current();
        return;
      }
      if (game === 'snake') {
        const direction = {
          ArrowUp: 0,
          w: 0,
          ArrowRight: 1,
          d: 1,
          ArrowDown: 2,
          s: 2,
          ArrowLeft: 3,
          a: 3
        }[event.key];
        if (direction !== undefined) {
          event.preventDefault();
          steerSnake(gameRef.current, direction);
        }
      } else if (event.code === 'Space' || event.key === 'ArrowUp') {
        event.preventDefault();
        flapBurger(gameRef.current);
      }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', keydown);
    };
  }, [game, endRound]);
  const swipe = event => {
    if (game !== 'snake' || !swipeRef.current) return;
    const dx = event.clientX - swipeRef.current.x;
    const dy = event.clientY - swipeRef.current.y;
    if (Math.hypot(dx, dy) < 22) return;
    const direction = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 1 : 3 : dy > 0 ? 2 : 0;
    steerSnake(gameRef.current, direction);
    swipeRef.current = {
      x: event.clientX,
      y: event.clientY
    };
  };
  const flap = () => flapBurger(gameRef.current);
  return <div className={`game-stage react-arcade-stage ${game}`}>
    <canvas ref={canvasRef} className="arcade-canvas" aria-label={`${title} game canvas`} onPointerDown={event => {
      swipeRef.current = {
        x: event.clientX,
        y: event.clientY
      };
      if (game === 'burger') flap();
    }} onPointerMove={swipe} onPointerUp={() => {
      swipeRef.current = null;
    }} onPointerCancel={() => {
      swipeRef.current = null;
    }} />
    <div className="arcade-hud">
      <button className="arcade-exit" onClick={onQuit} aria-label="Exit game">←</button>
      <span className="arcade-chip">SCORE <b>{hud.score}</b></span>
      <span className="arcade-chip arcade-best-chip">BEST <b>{hud.best}</b></span>
      {game === 'burger' && <><span className="arcade-chip">LAYERS <b>{hud.lives}</b></span><span className="arcade-chip">STAGE <b>{hud.theme + 1}</b></span></>}
    </div>
    {game === 'snake' && <div className="arcade-dpad" aria-label="Snake controls">
      <span />
      <button onClick={() => steerSnake(gameRef.current, 0)} aria-label="Move up">↑</button>
      <span />
      <button onClick={() => steerSnake(gameRef.current, 3)} aria-label="Move left">←</button>
      <button onClick={() => steerSnake(gameRef.current, 2)} aria-label="Move down">↓</button>
      <button onClick={() => steerSnake(gameRef.current, 1)} aria-label="Move right">→</button>
    </div>}
    {game === 'burger' && !result && <button className="arcade-flap" onPointerDown={event => {
      event.preventDefault();
      flap();
    }}>TAP TO FLY</button>}
    {(saving || result) && <div className="embedded-game-result" role="status" aria-live="polite">
      {saving ? <><span className="embedded-game-result-icon">⏳</span><small>ROUND COMPLETE</small><h2>Saving your score…</h2></> : <>
        <span className="embedded-game-result-icon">{result.error ? '!' : '🏆'}</span>
        <small>{result.error ? 'SCORE NOT SAVED' : 'ROUND COMPLETE'}</small><h2>{result.score} points</h2>
        {result.error ? <p className="embedded-game-result-error">{result.error}</p> : <p>+{result.xp} XP · +{result.coins} coins</p>}
        <button className="math-submit" onClick={onQuit}>BACK TO GAMES <span>↗</span></button>
      </>}
    </div>}
  </div>;
}
// Canvas-based game components and their input and lifecycle handling.
export function HungrySnakeGame({
  onEnd,
  onQuit
}) {
  return <ArcadeGame game="snake" title="Hungry Snakes" onEnd={onEnd} onQuit={onQuit} />;
}
export function FlyingBurgerGame({
  onEnd,
  onQuit
}) {
  return <ArcadeGame game="burger" title="Flying Burger" onEnd={onEnd} onQuit={onQuit} />;
}

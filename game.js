(() => {
  const canvas = document.getElementById("game");
  const statusEl = document.getElementById("status");
  const instructionsEl = document.getElementById("instructions");
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const TILE = 32;
  const FORMS = ["yellow", "blue", "red", "green"];
  const FORM_COLORS = {
    yellow: "#f3d63b",
    blue: "#4cb3ff",
    red: "#e75f5f",
    green: "#67d56f",
  };
  const SPRITE_STATES = [
    "idle1",
    "idle2",
    "run1",
    "run2",
    "run3",
    "run4",
    "jump",
    "fall",
    "attack1",
    "attack2",
    "ability1",
    "ability2",
  ];
  const SPRITE_INDEX = Object.fromEntries(
    SPRITE_STATES.map((state, index) => [state, index])
  );
  const SPRITE_ROWS = {
    yellow: 0,
    blue: 1,
    red: 2,
    green: 3,
    enemy: 4,
  };
  let spriteFrame = 64;
  const PLAYER_SPRITE_SIZE = 44;
  const PLAYER_SPRITE_OFFSET_X = -10;
  const PLAYER_SPRITE_OFFSET_Y = -10;
  const ENEMY_SPRITE_SIZE = 40;
  const ENEMY_SPRITE_OFFSET_X = -8;
  const ENEMY_SPRITE_OFFSET_Y = -9;
  const spriteSheet = new Image();
  let spriteReady = false;
  spriteSheet.addEventListener("load", () => {
    const detected = Math.floor(spriteSheet.width / SPRITE_STATES.length);
    if (detected > 0) {
      spriteFrame = detected;
    }
    spriteReady = true;
  });
  spriteSheet.addEventListener("error", () => {
    spriteReady = false;
  });
  spriteSheet.src = "assets/tiny_spritesheet.png";

  const MOVE_LEFT_KEYS = ["ArrowLeft", "KeyA"];
  const MOVE_RIGHT_KEYS = ["ArrowRight", "KeyD"];
  const MOVE_UP_KEYS = ["ArrowUp", "KeyW", "Space"];
  const MOVE_DOWN_KEYS = ["ArrowDown", "KeyS"];
  const ABILITY_KEYS = ["KeyJ", "ControlLeft", "ControlRight"];
  const MAX_JUMPS = 1;
  const AIR_SPIN_SPEED = Math.PI * 5.5;

  const keyState = Object.create(null);
  let prevKeyState = Object.create(null);

  const preventDefaults = new Set([
    ...MOVE_LEFT_KEYS,
    ...MOVE_RIGHT_KEYS,
    ...MOVE_UP_KEYS,
    ...MOVE_DOWN_KEYS,
    ...ABILITY_KEYS,
    "Digit1",
    "Digit2",
    "Digit3",
    "Digit4",
    "KeyQ",
    "KeyE",
    "KeyR",
  ]);

  window.addEventListener("keydown", (event) => {
    keyState[event.code] = true;
    if (preventDefaults.has(event.code)) {
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    keyState[event.code] = false;
    if (preventDefaults.has(event.code)) {
      event.preventDefault();
    }
  });

  let starsNear = [];
  let starsFar = [];
  let instructionsVisible = false;

  const game = {
    level: null,
    player: null,
    camera: { x: 0, y: 0 },
    projectiles: [],
    state: "playing",
    score: 0,
    fruits: 0,
    lives: 5,
    timer: 240,
    timerMax: 240,
    message: "",
  };

  function rebuildBackdropStars() {
    starsNear = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width * 3,
      y: Math.random() * (canvas.height * 0.75),
      size: 1 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
    }));

    starsFar = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width * 2.5,
      y: Math.random() * (canvas.height * 0.65),
      size: 1 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  function resizeCanvas() {
    const width = Math.max(1, Math.floor(window.innerWidth));
    const height = Math.max(1, Math.floor(window.innerHeight));
    if (canvas.width === width && canvas.height === height) {
      return;
    }
    canvas.width = width;
    canvas.height = height;
    rebuildBackdropStars();
  }

  function setInstructionsVisible(visible) {
    instructionsVisible = visible;
    if (!instructionsEl) {
      return;
    }
    instructionsEl.classList.toggle("hidden", !visible);
    instructionsEl.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function approach(value, target, amount) {
    if (value < target) {
      return Math.min(value + amount, target);
    }
    if (value > target) {
      return Math.max(value - amount, target);
    }
    return value;
  }

  function rectsIntersect(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function anyDown(keys) {
    return keys.some((k) => keyState[k]);
  }

  function anyPressed(keys) {
    return keys.some((k) => keyState[k] && !prevKeyState[k]);
  }

  function anyReleased(keys) {
    return keys.some((k) => !keyState[k] && prevKeyState[k]);
  }

  function buildLevel() {
    const w = 140;
    const h = 22;
    const tiles = Array.from({ length: h }, () => Array(w).fill("."));

    const setTile = (x, y, t) => {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        tiles[y][x] = t;
      }
    };

    const fillRect = (x, y, rw, rh, t) => {
      for (let yy = y; yy < y + rh; yy += 1) {
        for (let xx = x; xx < x + rw; xx += 1) {
          setTile(xx, yy, t);
        }
      }
    };

    fillRect(0, 19, w, 3, "#");

    fillRect(8, 16, 6, 1, "#");
    fillRect(14, 15, 4, 1, "#");

    // Gate de fogo
    fillRect(20, 13, 8, 1, "#");
    fillRect(23, 14, 1, 5, "B");
    fillRect(26, 16, 7, 1, "#");

    // Lago profundo
    for (let x = 35; x <= 49; x += 1) {
      for (let y = 17; y <= 21; y += 1) {
        setTile(x, y, "W");
      }
    }
    fillRect(34, 16, 1, 6, "#");
    fillRect(50, 16, 1, 6, "#");
    fillRect(51, 16, 4, 1, "#");

    // Muro de escavação
    fillRect(61, 12, 9, 1, "#");
    fillRect(64, 13, 4, 6, "D");
    fillRect(69, 16, 7, 1, "#");

    // Trecho com espinhos
    for (let x = 73; x <= 76; x += 1) {
      setTile(x, 18, "S");
    }

    // Abismo com gancho
    for (let x = 86; x <= 102; x += 1) {
      for (let y = 19; y <= 21; y += 1) {
        setTile(x, y, ".");
      }
      setTile(x, 21, "L");
    }
    fillRect(82, 18, 4, 1, "#");
    fillRect(103, 17, 6, 1, "#");

    // Castelo final
    fillRect(109, 16, 16, 1, "#");
    fillRect(123, 13, 1, 6, "#");
    fillRect(129, 12, 1, 7, "#");
    fillRect(125, 12, 6, 1, "#");

    setTile(2, 18, "P");
    setTile(133, 15, "E");

    const fruitPositions = [
      [6, 18],
      [11, 15],
      [18, 14],
      [29, 15],
      [38, 15],
      [43, 14],
      [58, 18],
      [71, 15],
      [79, 17],
      [90, 11],
      [96, 9],
      [107, 16],
      [116, 14],
      [132, 11],
    ];

    for (const [x, y] of fruitPositions) {
      setTile(x, y, "C");
    }

    const enemyPositions = [
      [16, 18],
      [32, 18],
      [56, 18],
      [70, 18],
      [111, 15],
      [119, 15],
    ];

    for (const [x, y] of enemyPositions) {
      setTile(x, y, "M");
    }

    const hookPositions = [
      [89, 9],
      [95, 7],
      [101, 9],
    ];

    for (const [x, y] of hookPositions) {
      setTile(x, y, "H");
    }

    const pickups = [];
    const enemies = [];
    const hooks = [];
    let spawn = { x: 2 * TILE + 4, y: 17 * TILE - 4 };

    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const t = tiles[y][x];
        if (t === "P") {
          spawn = { x: x * TILE + 4, y: y * TILE - 28 };
          tiles[y][x] = ".";
        } else if (t === "C") {
          pickups.push({
            x: x * TILE + TILE * 0.22,
            y: y * TILE + TILE * 0.22,
            w: TILE * 0.56,
            h: TILE * 0.56,
            collected: false,
            bob: Math.random() * Math.PI * 2,
          });
          tiles[y][x] = ".";
        } else if (t === "M") {
          enemies.push({
            x: x * TILE + 4,
            y: y * TILE - 24,
            w: 24,
            h: 24,
            vx: 58,
            vy: 0,
            dir: Math.random() > 0.5 ? 1 : -1,
            onGround: false,
            alive: true,
            stun: 0,
          });
          tiles[y][x] = ".";
        } else if (t === "H") {
          hooks.push({ x: x * TILE + TILE * 0.5, y: y * TILE + TILE * 0.5 });
          tiles[y][x] = ".";
        }
      }
    }

    return {
      w,
      h,
      tiles,
      spawn,
      pickups,
      enemies,
      hooks,
      exitText: "EXIT",
    };
  }

  function restartGame() {
    game.level = buildLevel();
    game.player = {
      x: game.level.spawn.x,
      y: game.level.spawn.y,
      w: 24,
      h: 24,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: false,
      jumpCount: 0,
      form: "yellow",
      invuln: 0,
      cooldown: 0,
      drown: 0,
      charge: 0,
      charging: false,
      hook: null,
      transformFx: 0,
      inWater: false,
      actionTimer: 0,
      actionType: "none",
      airSpin: 0,
      airSpinActive: false,
    };
    game.projectiles = [];
    game.camera.x = 0;
    game.camera.y = 0;
    game.state = "playing";
    game.score = 0;
    game.fruits = 0;
    game.lives = 5;
    game.timer = game.timerMax;
    game.message = "";
  }

  function respawnPlayer() {
    const p = game.player;
    p.x = game.level.spawn.x;
    p.y = game.level.spawn.y;
    p.vx = 0;
    p.vy = 0;
    p.jumpCount = 0;
    p.onGround = false;
    p.invuln = 1.75;
    p.drown = 0;
    p.charge = 0;
    p.charging = false;
    p.form = "yellow";
    p.transformFx = 0.25;
    p.hook = null;
    p.actionTimer = 0;
    p.actionType = "none";
    p.airSpin = 0;
    p.airSpinActive = false;
  }

  function getTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= game.level.w || ty >= game.level.h) {
      return "#";
    }
    return game.level.tiles[ty][tx];
  }

  function setTile(tx, ty, value) {
    if (tx < 0 || ty < 0 || tx >= game.level.w || ty >= game.level.h) {
      return;
    }
    game.level.tiles[ty][tx] = value;
  }

  function isSolidTile(tile) {
    return tile === "#" || tile === "D" || tile === "B";
  }

  function isHazardTile(tile) {
    return tile === "S" || tile === "L";
  }

  function rectTouchesTile(rect, matcher) {
    const startX = Math.floor(rect.x / TILE);
    const endX = Math.floor((rect.x + rect.w - 1) / TILE);
    const startY = Math.floor(rect.y / TILE);
    const endY = Math.floor((rect.y + rect.h - 1) / TILE);
    for (let ty = startY; ty <= endY; ty += 1) {
      for (let tx = startX; tx <= endX; tx += 1) {
        if (matcher(getTile(tx, ty), tx, ty)) {
          return true;
        }
      }
    }
    return false;
  }

  function moveHorizontal(body, dt) {
    body.x += body.vx * dt;
    const startY = Math.floor(body.y / TILE);
    const endY = Math.floor((body.y + body.h - 1) / TILE);

    if (body.vx > 0) {
      const tileX = Math.floor((body.x + body.w - 1) / TILE);
      for (let ty = startY; ty <= endY; ty += 1) {
        if (isSolidTile(getTile(tileX, ty))) {
          body.x = tileX * TILE - body.w;
          body.vx = 0;
          return true;
        }
      }
    } else if (body.vx < 0) {
      const tileX = Math.floor(body.x / TILE);
      for (let ty = startY; ty <= endY; ty += 1) {
        if (isSolidTile(getTile(tileX, ty))) {
          body.x = (tileX + 1) * TILE;
          body.vx = 0;
          return true;
        }
      }
    }
    return false;
  }

  function moveVertical(body, dt) {
    body.onGround = false;
    body.y += body.vy * dt;
    const startX = Math.floor(body.x / TILE);
    const endX = Math.floor((body.x + body.w - 1) / TILE);

    if (body.vy > 0) {
      const tileY = Math.floor((body.y + body.h - 1) / TILE);
      for (let tx = startX; tx <= endX; tx += 1) {
        if (isSolidTile(getTile(tx, tileY))) {
          body.y = tileY * TILE - body.h;
          body.vy = 0;
          body.onGround = true;
          body.jumpCount = 0;
          return true;
        }
      }
    } else if (body.vy < 0) {
      const tileY = Math.floor(body.y / TILE);
      for (let tx = startX; tx <= endX; tx += 1) {
        if (isSolidTile(getTile(tx, tileY))) {
          body.y = (tileY + 1) * TILE;
          body.vy = 0;
          return true;
        }
      }
    }
    return false;
  }

  function isJumpPressed() {
    return anyPressed(MOVE_UP_KEYS);
  }

  function getMoveAxis() {
    let axis = 0;
    if (anyDown(MOVE_LEFT_KEYS)) {
      axis -= 1;
    }
    if (anyDown(MOVE_RIGHT_KEYS)) {
      axis += 1;
    }
    return axis;
  }

  function getVerticalAxis() {
    let axis = 0;
    if (anyDown(MOVE_UP_KEYS)) {
      axis -= 1;
    }
    if (anyDown(MOVE_DOWN_KEYS)) {
      axis += 1;
    }
    return axis;
  }

  function loseLife(reason) {
    if (game.player.invuln > 0 || game.state !== "playing") {
      return;
    }

    game.lives -= 1;
    game.projectiles.length = 0;

    if (game.lives <= 0) {
      game.lives = 0;
      game.state = "gameover";
      game.message = "Fim de jogo. Pressione R para reiniciar.";
      return;
    }

    game.message = `Você perdeu uma vida (${reason}).`;
    game.timer = Math.max(40, game.timerMax - 20);
    respawnPlayer();
  }

  function awardFruit() {
    game.fruits += 1;
    game.score += 100;
    if (game.fruits % 20 === 0) {
      game.lives += 1;
      game.message = "Vida extra!";
    }
  }

  function switchForm(newForm) {
    const p = game.player;
    if (p.form === newForm || game.state !== "playing") {
      return;
    }
    if (p.hook) {
      releaseHook(false);
    }
    p.form = newForm;
    p.transformFx = 0.24;
    p.charge = 0;
    p.charging = false;
    p.actionTimer = 0;
    p.actionType = "none";
  }

  function cycleForm(dir) {
    const idx = FORMS.indexOf(game.player.form);
    const next = (idx + dir + FORMS.length) % FORMS.length;
    switchForm(FORMS[next]);
  }

  function handleFormInput() {
    if (anyPressed(["Digit1"])) switchForm("yellow");
    if (anyPressed(["Digit2"])) switchForm("blue");
    if (anyPressed(["Digit3"])) switchForm("red");
    if (anyPressed(["Digit4"])) switchForm("green");
    if (anyPressed(["KeyE"])) cycleForm(1);
  }

  function shootProjectile(type, power) {
    const p = game.player;
    const cx = p.x + p.w * 0.5;
    const cy = p.y + p.h * 0.5;

    if (type === "fire") {
      const speed = 250 + power * 220;
      game.projectiles.push({
        x: cx + p.facing * 10,
        y: cy,
        vx: speed * p.facing,
        vy: -35,
        r: 5 + power * 4,
        life: 1.3,
        type,
      });
    } else {
      game.projectiles.push({
        x: cx + p.facing * 10,
        y: cy,
        vx: p.facing * 170,
        vy: -75,
        r: 6,
        life: 1.8,
        type,
      });
    }
  }

  function digBlock() {
    const p = game.player;
    const moving = Math.abs(p.vx) > 25;
    let tx;
    let ty;

    if (moving) {
      tx = Math.floor((p.x + p.w * 0.5 + p.facing * (TILE * 0.8)) / TILE);
      ty = Math.floor((p.y + p.h * 0.55) / TILE);
    } else {
      tx = Math.floor((p.x + p.w * 0.5) / TILE);
      ty = Math.floor((p.y + p.h + 2) / TILE);
    }

    if (getTile(tx, ty) === "D") {
      setTile(tx, ty, ".");
      game.score += 50;
      game.message = "Terreno escavado.";
    }
  }

  function canSeeHook(fromX, fromY, toX, toY) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const length = Math.hypot(dx, dy);
    const steps = Math.floor(length / 8);

    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const px = fromX + dx * t;
      const py = fromY + dy * t;
      const tx = Math.floor(px / TILE);
      const ty = Math.floor(py / TILE);
      if (isSolidTile(getTile(tx, ty))) {
        return false;
      }
    }
    return true;
  }

  function attachHook() {
    const p = game.player;
    const px = p.x + p.w * 0.5;
    const py = p.y + p.h * 0.5;

    let best = null;
    let bestDist = 99999;

    for (const hook of game.level.hooks) {
      const dx = hook.x - px;
      const dy = hook.y - py;
      const dist = Math.hypot(dx, dy);
      if (dist < 240 && dist < bestDist && canSeeHook(px, py, hook.x, hook.y)) {
        bestDist = dist;
        best = hook;
      }
    }

    if (!best) {
      return;
    }

    const dx = px - best.x;
    const dy = py - best.y;
    p.hook = {
      x: best.x,
      y: best.y,
      length: Math.max(48, Math.hypot(dx, dy)),
      angle: Math.atan2(dx, dy),
      angVel: 0,
    };
    p.vx = 0;
    p.vy = 0;
  }

  function releaseHook(withMomentum) {
    const p = game.player;
    if (!p.hook) {
      return;
    }
    if (withMomentum) {
      p.vx = Math.cos(p.hook.angle) * p.hook.angVel * p.hook.length;
      p.vy = -Math.sin(p.hook.angle) * p.hook.angVel * p.hook.length;
    } else {
      p.vx *= 0.6;
      p.vy *= 0.6;
    }
    p.hook = null;
  }

  function updateHookedPlayer(dt, moveAxis) {
    const p = game.player;
    const hook = p.hook;
    if (!hook) {
      return;
    }

    const angularAccel = (-880 / hook.length) * Math.sin(hook.angle) + moveAxis * 1.9;
    hook.angVel += angularAccel * dt;
    hook.angVel *= 0.994;
    hook.angle += hook.angVel * dt;

    const px = hook.x + Math.sin(hook.angle) * hook.length;
    const py = hook.y + Math.cos(hook.angle) * hook.length;

    p.x = px - p.w * 0.5;
    p.y = py - p.h * 0.5;
    p.vx = Math.cos(hook.angle) * hook.angVel * hook.length;
    p.vy = -Math.sin(hook.angle) * hook.angVel * hook.length;

    const solidHit = rectTouchesTile(
      { x: p.x, y: p.y, w: p.w, h: p.h },
      (tile) => isSolidTile(tile)
    );

    if (solidHit) {
      releaseHook(false);
    }

    if (isJumpPressed()) {
      releaseHook(true);
      p.vy -= 170;
    }
  }

  function updatePlayer(dt) {
    const p = game.player;
    if (game.state !== "playing") {
      return;
    }

    p.invuln = Math.max(0, p.invuln - dt);
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.transformFx = Math.max(0, p.transformFx - dt);
    p.actionTimer = Math.max(0, p.actionTimer - dt);

    const moveAxis = getMoveAxis();
    if (moveAxis !== 0) {
      p.facing = moveAxis;
    }

    const abilityDown = anyDown(ABILITY_KEYS);

    if (p.form === "yellow") {
      if (anyPressed(ABILITY_KEYS)) {
        p.charging = true;
        p.charge = 0;
      }
      if (p.charging && abilityDown) {
        p.charge = Math.min(1.2, p.charge + dt);
      }
      if (p.charging && anyReleased(ABILITY_KEYS) && p.cooldown <= 0) {
        shootProjectile("fire", p.charge);
        p.charging = false;
        p.charge = 0;
        p.cooldown = 0.12;
        p.actionType = "attack";
        p.actionTimer = 0.18;
      }
      if (!abilityDown && p.charging && p.cooldown <= 0) {
        shootProjectile("fire", p.charge);
        p.charging = false;
        p.charge = 0;
        p.cooldown = 0.12;
        p.actionType = "attack";
        p.actionTimer = 0.18;
      }
    } else {
      p.charging = false;
      p.charge = 0;
      if (anyPressed(ABILITY_KEYS) && p.cooldown <= 0) {
        if (p.form === "blue") {
          shootProjectile("bubble", 0);
          p.actionType = "ability";
          p.actionTimer = 0.22;
        } else if (p.form === "red") {
          digBlock();
          p.actionType = "ability";
          p.actionTimer = 0.22;
        } else if (p.form === "green") {
          if (p.hook) {
            releaseHook(false);
          } else {
            attachHook();
          }
          p.actionType = "ability";
          p.actionTimer = 0.22;
        }
        p.cooldown = 0.16;
      }
    }

    if (p.hook) {
      updateHookedPlayer(dt, moveAxis);
    } else {
      const inWater = rectTouchesTile(
        { x: p.x, y: p.y, w: p.w, h: p.h },
        (tile) => tile === "W"
      );

      p.inWater = inWater;
      if (inWater && p.form !== "blue") {
        p.drown += dt;
      } else {
        p.drown = Math.max(0, p.drown - dt * 2.2);
      }

      if (p.drown > 1.35) {
        loseLife("afogou");
        return;
      }

      const speed = inWater ? 130 : 200;
      const accel = inWater ? 620 : 1150;
      p.vx = approach(p.vx, moveAxis * speed, accel * dt);

      if (inWater) {
        if (p.form === "blue") {
          const vAxis = getVerticalAxis();
          p.vy = approach(p.vy, vAxis * 170, 760 * dt);
          p.vy += 130 * dt;
        } else {
          p.vy += 390 * dt;
        }
        p.vx *= 0.997;
      } else {
        p.vy += 980 * dt;
      }

      if (isJumpPressed()) {
        if (p.onGround) {
          p.jumpCount = 0;
        }
        if (p.onGround || p.jumpCount < MAX_JUMPS) {
          const jump = 420 + p.jumpCount * 70;
          p.vy = -jump;
          p.onGround = false;
          p.jumpCount += 1;
          p.airSpinActive = true;
        }
      }

      moveHorizontal(p, dt);
      moveVertical(p, dt);
    }

    if (p.airSpinActive && !p.onGround && !p.inWater && !p.hook) {
      const spinDir = p.facing < 0 ? -1 : 1;
      p.airSpin += spinDir * AIR_SPIN_SPEED * dt;
      if (p.airSpin > Math.PI) {
        p.airSpin -= Math.PI * 2;
      } else if (p.airSpin < -Math.PI) {
        p.airSpin += Math.PI * 2;
      }
    } else {
      p.airSpin = 0;
      if (p.onGround || p.inWater || p.hook) {
        p.airSpinActive = false;
      }
    }

    const hazard = rectTouchesTile(
      { x: p.x, y: p.y, w: p.w, h: p.h },
      (tile) => isHazardTile(tile)
    );
    if (hazard) {
      loseLife("encostou em perigo");
      return;
    }

    if (p.y > game.level.h * TILE + 32) {
      loseLife("caiu no vazio");
      return;
    }

    const touchingExit = rectTouchesTile(
      { x: p.x + 4, y: p.y + 2, w: p.w - 8, h: p.h - 4 },
      (tile) => tile === "E"
    );
    if (touchingExit) {
      game.state = "won";
      game.message = "Fase concluída! Pressione R para jogar de novo.";
    }
  }

  function updateProjectiles(dt) {
    for (let i = game.projectiles.length - 1; i >= 0; i -= 1) {
      const p = game.projectiles[i];
      p.life -= dt;

      if (p.type === "fire") {
        p.vy += 120 * dt;
      } else {
        p.vy -= 38 * dt;
        p.vx *= 0.996;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const tx = Math.floor(p.x / TILE);
      const ty = Math.floor(p.y / TILE);
      const tile = getTile(tx, ty);

      if (p.type === "fire" && tile === "B") {
        setTile(tx, ty, ".");
        game.score += 80;
        game.projectiles.splice(i, 1);
        continue;
      }

      if (isSolidTile(tile)) {
        game.projectiles.splice(i, 1);
        continue;
      }

      if (tile === "W" && p.type === "fire") {
        game.projectiles.splice(i, 1);
        continue;
      }

      let removed = false;
      for (const enemy of game.level.enemies) {
        if (!enemy.alive) {
          continue;
        }
        const hit = {
          x: p.x - p.r,
          y: p.y - p.r,
          w: p.r * 2,
          h: p.r * 2,
        };
        if (rectsIntersect(hit, enemy)) {
          enemy.alive = false;
          game.score += p.type === "fire" ? 220 : 150;
          game.projectiles.splice(i, 1);
          removed = true;
          break;
        }
      }

      if (removed) {
        continue;
      }

      if (p.life <= 0) {
        game.projectiles.splice(i, 1);
      }
    }
  }

  function updateEnemies(dt) {
    for (const enemy of game.level.enemies) {
      if (!enemy.alive) {
        continue;
      }

      enemy.stun = Math.max(0, enemy.stun - dt);

      const inWater = rectTouchesTile(enemy, (tile) => tile === "W");
      const gravity = inWater ? 250 : 920;
      enemy.vy += gravity * dt;

      if (enemy.stun <= 0) {
        enemy.vx = enemy.dir * (inWater ? 42 : 58);
      } else {
        enemy.vx *= 0.93;
      }

      const hitWall = moveHorizontal(enemy, dt);
      moveVertical(enemy, dt);

      if (hitWall) {
        enemy.dir *= -1;
      }

      if (enemy.onGround) {
        const aheadX = enemy.dir > 0 ? enemy.x + enemy.w + 3 : enemy.x - 3;
        const aheadY = enemy.y + enemy.h + 2;
        const tx = Math.floor(aheadX / TILE);
        const ty = Math.floor(aheadY / TILE);
        const support = getTile(tx, ty);
        if (!isSolidTile(support) && support !== "W") {
          enemy.dir *= -1;
        }
      }

      if (enemy.y > game.level.h * TILE + 32) {
        enemy.alive = false;
      }

      const player = game.player;
      if (enemy.alive && rectsIntersect(enemy, player) && player.invuln <= 0) {
        const stomp = player.vy > 120 && player.y + player.h - 7 < enemy.y + 8;
        if (stomp) {
          enemy.alive = false;
          player.vy = -320;
          player.jumpCount = 1;
          player.airSpinActive = true;
          game.score += 180;
        } else {
          loseLife("atingido por inimigo");
          return;
        }
      }
    }
  }

  function updatePickups(dt) {
    const p = game.player;
    for (const item of game.level.pickups) {
      item.bob += dt * 3.2;
      if (item.collected) {
        continue;
      }

      if (rectsIntersect(p, item)) {
        item.collected = true;
        awardFruit();
      }
    }
  }

  function updateCamera(dt) {
    const worldW = game.level.w * TILE;
    const worldH = game.level.h * TILE;
    const p = game.player;

    const targetX = clamp(p.x + p.w * 0.5 - canvas.width * 0.5, 0, Math.max(0, worldW - canvas.width));
    const targetY = clamp(p.y + p.h * 0.5 - canvas.height * 0.58, 0, Math.max(0, worldH - canvas.height));

    game.camera.x += (targetX - game.camera.x) * Math.min(1, dt * 8);
    game.camera.y += (targetY - game.camera.y) * Math.min(1, dt * 8);
  }

  function updateStatusText() {
    if (game.state === "playing") {
      statusEl.textContent =
        game.message ||
        "Use as formas certas para cada obstaculo: fogo, agua, terra e ar. Q alterna instrucoes.";
    } else if (game.state === "won") {
      statusEl.textContent = "Você venceu. Pressione R para reiniciar.";
    } else {
      statusEl.textContent = "Fim de jogo. Pressione R para tentar novamente.";
    }
  }

  function update(dt) {
    if (anyPressed(["KeyR"])) {
      restartGame();
    }
    if (anyPressed(["KeyQ"])) {
      setInstructionsVisible(!instructionsVisible);
    }

    if (game.state !== "playing") {
      updateCamera(dt);
      updateStatusText();
      prevKeyState = { ...keyState };
      return;
    }

    handleFormInput();

    game.timer -= dt;
    if (game.timer <= 0) {
      loseLife("tempo esgotado");
      game.timer = game.timerMax;
    }

    updatePlayer(dt);
    updateProjectiles(dt);
    updateEnemies(dt);
    updatePickups(dt);
    updateCamera(dt);

    if (game.message && Math.random() < dt * 0.5) {
      game.message = "";
    }

    updateStatusText();
    prevKeyState = { ...keyState };
  }

  function drawBackdrop(time) {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, "#08103b");
    g.addColorStop(0.5, "#0a1647");
    g.addColorStop(1, "#132542");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const moonX = canvas.width - (game.camera.x * 0.05) % (canvas.width + 160) + 120;
    ctx.fillStyle = "rgba(220, 230, 255, 0.18)";
    ctx.beginPath();
    ctx.arc(moonX, 115, 62, 0, Math.PI * 2);
    ctx.fill();

    for (const s of starsFar) {
      const alpha = 0.35 + 0.35 * Math.sin(time * 0.4 + s.phase);
      ctx.fillStyle = `rgba(220, 230, 255, ${alpha})`;
      const x = ((s.x - game.camera.x * 0.08) % (canvas.width + 80)) - 40;
      const y = s.y;
      ctx.fillRect(x, y, s.size, s.size);
    }

    for (const s of starsNear) {
      const alpha = 0.5 + 0.45 * Math.sin(time + s.phase);
      ctx.fillStyle = `rgba(240, 246, 255, ${alpha})`;
      const x = ((s.x - game.camera.x * 0.16) % (canvas.width + 90)) - 45;
      const y = s.y;
      ctx.fillRect(x, y, s.size, s.size);
    }

    ctx.fillStyle = "rgba(12, 20, 46, 0.55)";
    for (let i = 0; i < 9; i += 1) {
      const px = i * 170 - (game.camera.x * 0.22) % 170;
      const h = 80 + ((i * 31) % 60);
      ctx.beginPath();
      ctx.moveTo(px, canvas.height - 70);
      ctx.lineTo(px + 80, canvas.height - 70 - h);
      ctx.lineTo(px + 165, canvas.height - 70);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawTile(tile, x, y, time) {
    if (tile === ".") {
      return;
    }

    if (tile === "#") {
      ctx.fillStyle = "#7f6547";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#937859";
      ctx.fillRect(x + 1, y + 1, TILE - 2, 7);
      ctx.fillStyle = "#5e4a33";
      ctx.fillRect(x + 2, y + TILE - 8, TILE - 4, 6);
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(x + 4, y + 12, 6, 3);
      ctx.fillRect(x + 17, y + 18, 8, 4);
      return;
    }

    if (tile === "D") {
      ctx.fillStyle = "#8f4f38";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#b86f52";
      ctx.fillRect(x + 1, y + 1, TILE - 2, 7);
      ctx.fillStyle = "#6e3827";
      ctx.fillRect(x + 2, y + TILE - 7, TILE - 4, 5);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(x + 7, y + 11, 4, 4);
      ctx.fillRect(x + 20, y + 14, 5, 5);
      return;
    }

    if (tile === "B") {
      ctx.fillStyle = "#4f2b73";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#7f46b2";
      ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
      ctx.fillStyle = "#9be587";
      ctx.fillRect(x + 6, y + 2, 4, TILE - 4);
      ctx.fillRect(x + 15, y + 2, 4, TILE - 4);
      return;
    }

    if (tile === "W") {
      const wave = Math.sin(time * 4 + x * 0.04) * 2;
      ctx.fillStyle = "rgba(57, 141, 226, 0.78)";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "rgba(170, 225, 255, 0.55)";
      ctx.fillRect(x, y + 4 + wave, TILE, 4);
      return;
    }

    if (tile === "S") {
      ctx.fillStyle = "#8f8f95";
      ctx.fillRect(x, y + TILE - 6, TILE, 6);
      ctx.fillStyle = "#d2d4da";
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.moveTo(x + i * 8 + 1, y + TILE - 6);
        ctx.lineTo(x + i * 8 + 4, y + 5);
        ctx.lineTo(x + i * 8 + 7, y + TILE - 6);
        ctx.fill();
      }
      return;
    }

    if (tile === "L") {
      const pulse = Math.sin(time * 7 + x * 0.08) * 0.5 + 0.5;
      ctx.fillStyle = "#a3371d";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = `rgba(255, ${120 + pulse * 80}, 30, 0.95)`;
      ctx.fillRect(x, y + 4 + pulse * 2, TILE, TILE - 8);
      ctx.fillStyle = `rgba(255, 230, 110, ${0.22 + pulse * 0.22})`;
      ctx.fillRect(x + 3, y + 8, TILE - 6, 7);
      return;
    }

    if (tile === "E") {
      ctx.fillStyle = "#2a2016";
      ctx.fillRect(x + 6, y + 2, TILE - 12, TILE - 4);
      ctx.strokeStyle = "#f7db74";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 6, y + 2, TILE - 12, TILE - 4);
      ctx.fillStyle = "#f7db74";
      ctx.font = "bold 9px Verdana";
      ctx.fillText("EXIT", x + 8, y + 18);
    }
  }

  function drawPickups(time) {
    for (const item of game.level.pickups) {
      if (item.collected) {
        continue;
      }
      const bob = Math.sin(item.bob + time * 1.7) * 2;
      const x = item.x - game.camera.x;
      const y = item.y - game.camera.y + bob;

      ctx.fillStyle = "#f0cf58";
      ctx.beginPath();
      ctx.ellipse(x + item.w * 0.5, y + item.h * 0.52, item.w * 0.4, item.h * 0.32, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ed8f46";
      ctx.fillRect(x + item.w * 0.15, y + item.h * 0.28, item.w * 0.24, item.h * 0.18);
      ctx.fillStyle = "#3c8a48";
      ctx.fillRect(x + item.w * 0.55, y + item.h * 0.12, item.w * 0.2, item.h * 0.12);
    }
  }

  function drawAtlasFrame(row, state, dx, dy, size, flipX) {
    if (!spriteReady) {
      return false;
    }
    const col = Object.prototype.hasOwnProperty.call(SPRITE_INDEX, state)
      ? SPRITE_INDEX[state]
      : 0;
    const frame = spriteFrame;
    const sx = col * frame;
    const sy = row * frame;

    ctx.save();
    if (flipX) {
      ctx.translate(dx + size, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(spriteSheet, sx, sy, frame, frame, 0, 0, size, size);
    } else {
      ctx.drawImage(spriteSheet, sx, sy, frame, frame, dx, dy, size, size);
    }
    ctx.restore();
    return true;
  }

  function getRunState(time) {
    const frames = ["run1", "run2", "run3", "run4"];
    return frames[Math.floor(time * 11.5) % frames.length];
  }

  function drawEnemyFallback(enemy, time) {
    const x = enemy.x - game.camera.x;
    const y = enemy.y - game.camera.y;

    ctx.fillStyle = "#71d470";
    ctx.beginPath();
    ctx.arc(x + 12, y + 12, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#5eb65f";
    for (let i = 0; i < 5; i += 1) {
      const offs = Math.sin(time * 6 + i * 0.7 + x * 0.02) * 1.5;
      ctx.fillRect(x + 3 + i * 4, y + 2 + offs, 3, 4);
    }

    ctx.fillStyle = "#13243d";
    ctx.fillRect(x + 5, y + 10, 14, 5);
    ctx.fillStyle = "#f3f8ff";
    ctx.fillRect(x + 8, y + 11, 3, 2);
    ctx.fillRect(x + 14, y + 11, 3, 2);
  }

  function drawEnemy(enemy, time) {
    const x = enemy.x - game.camera.x;
    const y = enemy.y - game.camera.y;

    let state = "idle1";
    if (enemy.stun > 0.02) {
      state = Math.floor(time * 22) % 2 === 0 ? "ability1" : "ability2";
    } else if (enemy.vy < -80) {
      state = "jump";
    } else if (enemy.vy > 120) {
      state = "fall";
    } else if (Math.abs(enemy.vx) > 12) {
      state = getRunState(time);
    } else {
      state = Math.floor(time * 2.4) % 2 === 0 ? "idle1" : "idle2";
    }

    const drawn = drawAtlasFrame(
      SPRITE_ROWS.enemy,
      state,
      x + ENEMY_SPRITE_OFFSET_X,
      y + ENEMY_SPRITE_OFFSET_Y,
      ENEMY_SPRITE_SIZE,
      enemy.dir < 0
    );
    if (!drawn) {
      drawEnemyFallback(enemy, time);
    }
  }

  function drawProjectiles(time) {
    for (const p of game.projectiles) {
      const x = p.x - game.camera.x;
      const y = p.y - game.camera.y;
      if (p.type === "fire") {
        ctx.fillStyle = "rgba(255, 214, 69, 0.92)";
        ctx.beginPath();
        ctx.arc(x, y, p.r + Math.sin(time * 12) * 1.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 111, 33, 0.82)";
        ctx.beginPath();
        ctx.arc(x, y, p.r * 0.55, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "rgba(151, 234, 255, 0.78)";
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(230, 255, 255, 0.9)";
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }
  }

  function drawHooks() {
    for (const hook of game.level.hooks) {
      const x = hook.x - game.camera.x;
      const y = hook.y - game.camera.y;
      ctx.fillStyle = "#6de4ef";
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#d7fbff";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, y, 7.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPlayerFallback(time, spinAngle = 0) {
    const p = game.player;
    if (p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0) {
      return;
    }

    const x = p.x - game.camera.x;
    const y = p.y - game.camera.y;
    const bodyColor = FORM_COLORS[p.form];

    if (p.transformFx > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${p.transformFx * 1.8})`;
      ctx.beginPath();
      ctx.arc(x + p.w * 0.5, y + p.h * 0.5, 18 + p.transformFx * 14, 0, Math.PI * 2);
      ctx.fill();
    }

    if (spinAngle !== 0) {
      ctx.save();
      ctx.translate(x + p.w * 0.5, y + p.h * 0.5);
      ctx.rotate(spinAngle);
      ctx.translate(-(x + p.w * 0.5), -(y + p.h * 0.5));
    }

    const bounce = Math.abs(p.vx) > 20 ? Math.sin(time * 18) * 1.1 : 0;
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(x + p.w * 0.5, y + p.h * 0.56, 11, 11 + bounce, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.ellipse(x + p.w * 0.36, y + p.h * 0.46, 4, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#20293f";
    ctx.fillRect(x + 5, y + 10, 14, 5);
    ctx.fillStyle = "#f4f8ff";
    ctx.fillRect(x + 8, y + 11, 3, 2);
    ctx.fillRect(x + 14, y + 11, 3, 2);

    const pupilOffset = p.facing > 0 ? 1 : -1;
    ctx.fillStyle = "#122033";
    ctx.fillRect(x + 9 + pupilOffset, y + 11, 1, 1);
    ctx.fillRect(x + 15 + pupilOffset, y + 11, 1, 1);

    ctx.fillStyle = "rgba(0,0,0,0.24)";
    for (let i = 0; i < 6; i += 1) {
      const px = x + 3 + i * 3;
      const py = y + 2 + Math.sin(time * 7 + i) * 1.4;
      ctx.fillRect(px, py, 2, 3);
    }

    if (spinAngle !== 0) {
      ctx.restore();
    }

    if (p.form === "yellow" && p.charging) {
      ctx.fillStyle = `rgba(255, 220, 100, ${0.3 + p.charge * 0.45})`;
      ctx.beginPath();
      ctx.arc(x + p.w * 0.5, y + p.h * 0.5, 16 + p.charge * 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function getPlayerAnimState(time) {
    const p = game.player;
    if (p.actionTimer > 0.01) {
      if (p.actionType === "attack") {
        return Math.floor(time * 28) % 2 === 0 ? "attack1" : "attack2";
      }
      return Math.floor(time * 28) % 2 === 0 ? "ability1" : "ability2";
    }
    if (p.hook) {
      return "ability2";
    }
    if (!p.inWater && p.vy < -140) {
      return "jump";
    }
    if (!p.inWater && p.vy > 140) {
      return "fall";
    }
    if (Math.abs(p.vx) > 30 || (p.inWater && Math.abs(p.vx) + Math.abs(p.vy) > 40)) {
      return getRunState(time);
    }
    return "idle1";
  }

  function drawPlayer(time) {
    const p = game.player;
    if (p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0) {
      return;
    }

    const x = p.x - game.camera.x;
    const y = p.y - game.camera.y;
    const spinAngle = !p.onGround && !p.inWater && !p.hook ? p.airSpin : 0;

    if (p.transformFx > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${p.transformFx * 1.8})`;
      ctx.beginPath();
      ctx.arc(x + p.w * 0.5, y + p.h * 0.5, 18 + p.transformFx * 14, 0, Math.PI * 2);
      ctx.fill();
    }

    const state = getPlayerAnimState(time);
    let drawn = false;
    if (spinAngle !== 0) {
      ctx.save();
      ctx.translate(x + p.w * 0.5, y + p.h * 0.5);
      ctx.rotate(spinAngle);
      drawn = drawAtlasFrame(
        SPRITE_ROWS[p.form],
        state,
        -p.w * 0.5 + PLAYER_SPRITE_OFFSET_X,
        -p.h * 0.5 + PLAYER_SPRITE_OFFSET_Y,
        PLAYER_SPRITE_SIZE,
        p.facing < 0
      );
      ctx.restore();
    } else {
      drawn = drawAtlasFrame(
        SPRITE_ROWS[p.form],
        state,
        x + PLAYER_SPRITE_OFFSET_X,
        y + PLAYER_SPRITE_OFFSET_Y,
        PLAYER_SPRITE_SIZE,
        p.facing < 0
      );
    }

    if (!drawn) {
      drawPlayerFallback(time, spinAngle);
      return;
    }

    if (p.form === "yellow" && p.charging) {
      ctx.fillStyle = `rgba(255, 220, 100, ${0.3 + p.charge * 0.45})`;
      ctx.beginPath();
      ctx.arc(x + p.w * 0.5, y + p.h * 0.5, 16 + p.charge * 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHookRope() {
    const p = game.player;
    if (!p.hook) {
      return;
    }
    const ax = p.hook.x - game.camera.x;
    const ay = p.hook.y - game.camera.y;
    const px = p.x + p.w * 0.5 - game.camera.x;
    const py = p.y + p.h * 0.5 - game.camera.y;

    ctx.strokeStyle = "#d6faff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(px, py);
    ctx.stroke();
  }

  function drawTiles(time) {
    const startX = Math.floor(game.camera.x / TILE) - 1;
    const endX = Math.floor((game.camera.x + canvas.width) / TILE) + 1;
    const startY = Math.floor(game.camera.y / TILE) - 1;
    const endY = Math.floor((game.camera.y + canvas.height) / TILE) + 1;

    for (let ty = startY; ty <= endY; ty += 1) {
      for (let tx = startX; tx <= endX; tx += 1) {
        if (tx < 0 || ty < 0 || tx >= game.level.w || ty >= game.level.h) {
          continue;
        }
        const tile = getTile(tx, ty);
        if (tile === ".") {
          continue;
        }
        const x = tx * TILE - game.camera.x;
        const y = ty * TILE - game.camera.y;
        drawTile(tile, x, y, time);
      }
    }
  }

  function drawHUD() {
    ctx.fillStyle = "rgba(7, 12, 28, 0.62)";
    ctx.fillRect(10, 10, 370, 76);
    ctx.strokeStyle = "rgba(115, 149, 240, 0.7)";
    ctx.strokeRect(10, 10, 370, 76);

    for (let i = 0; i < Math.max(0, game.lives); i += 1) {
      const x = 20 + i * 20;
      const y = 20;
      ctx.fillStyle = "#ff5c68";
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 6);
      ctx.bezierCurveTo(x + 8, y + 0, x, y + 0, x, y + 6);
      ctx.bezierCurveTo(x, y + 10, x + 8, y + 14, x + 8, y + 14);
      ctx.bezierCurveTo(x + 8, y + 14, x + 16, y + 10, x + 16, y + 6);
      ctx.bezierCurveTo(x + 16, y + 0, x + 8, y + 0, x + 8, y + 6);
      ctx.fill();
    }

    ctx.fillStyle = "#d5e3ff";
    ctx.font = "bold 14px Verdana";
    ctx.fillText(`Tempo: ${Math.ceil(game.timer)}`, 20, 56);
    ctx.fillText(`Pontos: ${game.score}`, 130, 56);
    ctx.fillText(`Frutas: ${game.fruits}`, 255, 56);

    const baseX = 20;
    const baseY = 66;
    FORMS.forEach((form, index) => {
      const selected = game.player.form === form;
      const x = baseX + index * 34;
      ctx.fillStyle = selected ? "#f6f8ff" : "rgba(255,255,255,0.35)";
      ctx.fillRect(x - 2, baseY - 2, 26, 18);
      ctx.fillStyle = FORM_COLORS[form];
      ctx.fillRect(x, baseY, 22, 14);
      ctx.fillStyle = "#1b2032";
      ctx.font = "bold 10px Verdana";
      ctx.fillText(String(index + 1), x + 8, baseY + 11);
    });

    if (game.state !== "playing") {
      ctx.fillStyle = "rgba(5, 9, 24, 0.75)";
      ctx.fillRect(canvas.width * 0.15, canvas.height * 0.32, canvas.width * 0.7, 130);
      ctx.strokeStyle = "#9eb8ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(canvas.width * 0.15, canvas.height * 0.32, canvas.width * 0.7, 130);
      ctx.fillStyle = "#f3f6ff";
      ctx.font = "bold 30px Verdana";
      ctx.fillText(
        game.state === "won" ? "Fase Concluida" : "Fim de Jogo",
        canvas.width * 0.31,
        canvas.height * 0.42
      );
      ctx.font = "bold 16px Verdana";
      ctx.fillStyle = "#c4d4ff";
      ctx.fillText("Pressione R para reiniciar", canvas.width * 0.34, canvas.height * 0.49);
    }
  }

  function render(time) {
    drawBackdrop(time);
    drawTiles(time);
    drawHooks();
    drawPickups(time);

    for (const enemy of game.level.enemies) {
      if (enemy.alive) {
        drawEnemy(enemy, time);
      }
    }

    drawProjectiles(time);
    drawHookRope();
    drawPlayer(time);
    drawHUD();
  }

  resizeCanvas();
  setInstructionsVisible(false);
  window.addEventListener("resize", resizeCanvas);
  restartGame();

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    render(now / 1000);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();

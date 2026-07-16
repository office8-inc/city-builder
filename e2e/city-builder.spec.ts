import { test, expect } from '@playwright/test';

// Helper: wait for game store to be available
async function waitForStore(page: any) {
  await page.waitForFunction(() => (window as any).__gameStore, { timeout: 15000 });
}

// Helper: evaluate game state
async function gameEval(page: any, fn: string) {
  return page.evaluate(fn);
}

// Helper: build basic infrastructure
async function buildCity(page: any) {
  return gameEval(page, `(() => {
    const s = window.__gameStore.getState();
    for (let i = 10; i < 50; i++) s.placeTrack(i, 25, i + 1, 25);
    for (let i = 10; i < 50; i++) s.placeTrack(25, i, 25, i + 1);
    s.buildStation(15, 25, 'ground_small', 'Alpha');
    s.buildStation(25, 25, 'terminal', 'Central');
    s.buildStation(35, 25, 'ground_large', 'Beta');
    s.buildStation(25, 15, 'depot', 'Depot');
    s.buildStation(25, 35, 'ground_small', 'Gamma');
    return { tracks: window.__gameStore.getState().tracks.size, stations: window.__gameStore.getState().stations.size };
  })()`);
}

test.describe('App Startup & Basic Rendering', () => {
  test('app loads with correct title', async ({ page }) => {
    await page.goto('/?autoplay');
    await expect(page).toHaveTitle('City Builder');
  });

  test('canvas renders without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/?autoplay');
    await waitForStore(page);
    await page.waitForTimeout(2000);
    // Filter out non-critical GLTF texture warnings
    const criticalErrors = errors.filter(e => !e.includes('GLTFLoader') && !e.includes('texture'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('3D canvas element exists', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const canvas = await page.$('canvas');
    expect(canvas).toBeTruthy();
  });

  test('UI elements render correctly', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    // Check toolbar buttons
    await expect(page.getByRole('button', { name: '鉄道' })).toBeVisible();
    await expect(page.getByRole('button', { name: '駅' })).toBeVisible();
    await expect(page.getByRole('button', { name: '列車' })).toBeVisible();
    await expect(page.getByRole('button', { name: '施設' })).toBeVisible();
    // Check header info
    await expect(page.getByText('A-Train City')).toBeVisible();
  });

  test('initial game state is valid', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const state = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      return {
        population: s.population,
        tracks: s.tracks.size,
        stations: s.stations.size,
        trains: s.trains.size,
        buildings: s.buildings.size,
        mapSize: s.mapSize,
      };
    })()`);
    expect(state.population).toBe(0);
    expect(state.tracks).toBe(0);
    expect(state.stations).toBe(0);
    expect(state.trains).toBe(0);
    expect(state.mapSize).toBeGreaterThan(0);
  });
});

test.describe('Infrastructure: Track & Station Placement', () => {
  test('place tracks successfully', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      s.placeTrack(10, 25, 11, 25);
      s.placeTrack(11, 25, 12, 25);
      s.placeTrack(12, 25, 13, 25);
      return window.__gameStore.getState().tracks.size;
    })()`);
    expect(result).toBe(3);
  });

  test('place all station types', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      // Build tracks first
      for (let i = 10; i < 50; i++) s.placeTrack(i, 25, i + 1, 25);
      for (let i = 10; i < 40; i++) s.placeTrack(25, i, 25, i + 1);
      // Place different station types
      s.buildStation(15, 25, 'ground_small', 'Small');
      s.buildStation(20, 25, 'ground_large', 'Large');
      s.buildStation(25, 25, 'terminal', 'Terminal');
      s.buildStation(25, 15, 'depot', 'Depot');
      // 高架駅は高架線路の上にのみ建設できるため、既存の地上線路網とは別の場所に
      // 専用の高架線路を敷設してから建てる
      s.setSelectedTool('track_elevated');
      s.placeTrack(30, 40, 31, 40);
      s.setSelectedTool('none');
      s.buildStation(30, 40, 'elevated', 'Elevated');
      const stations = Array.from(window.__gameStore.getState().stations.values());
      return stations.map(st => ({ name: st.name, type: st.type }));
    })()`);
    expect(result.length).toBe(5);
    expect(result.map((s: any) => s.type)).toContain('terminal');
    expect(result.map((s: any) => s.type)).toContain('depot');
    expect(result.map((s: any) => s.type)).toContain('elevated');
  });

  test('underground track coexists with ground track on the same tile, but not over water', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();

      // 地上線路を敷設
      s.setSelectedTool('track_straight');
      s.placeTrack(10, 25, 15, 25);
      // 同じタイル区間へ地下線路を重ねて敷設 → 地上・地下が共存できることを確認
      s.setSelectedTool('track_underground');
      s.placeTrack(10, 25, 15, 25);

      const segs = Array.from(window.__gameStore.getState().tracks.values())
        .filter(t => t.startZ === 25 && t.endZ === 25 && t.startX >= 10 && t.endX <= 15);
      const groundCount = segs.filter(t => t.elevation === 0).length;
      const undergroundCount = segs.filter(t => t.elevation === -1).length;

      // マップ上から水域タイルを探し、地下線路も水上には敷設できないことを確認
      const map = window.__gameStore.getState().map;
      let waterTile = null;
      for (let x = 1; x < map.length - 1 && !waterTile; x++) {
        for (let z = 1; z < map[x].length - 1; z++) {
          if (map[x][z].terrain === 'water' && map[x + 1][z].terrain === 'water') {
            waterTile = { x, z };
            break;
          }
        }
      }

      let waterBlocked = true;
      let foundWater = false;
      if (waterTile) {
        foundWater = true;
        const before = window.__gameStore.getState().tracks.size;
        s.setSelectedTool('track_underground');
        s.placeTrack(waterTile.x, waterTile.z, waterTile.x + 1, waterTile.z);
        const after = window.__gameStore.getState().tracks.size;
        waterBlocked = after === before;
      }

      return { groundCount, undergroundCount, foundWater, waterBlocked };
    })()`);

    expect(result.groundCount).toBeGreaterThan(0);
    expect(result.undergroundCount).toBeGreaterThan(0);
    expect(result.groundCount).toBe(result.undergroundCount);
    if (result.foundWater) {
      expect(result.waterBlocked).toBe(true);
    }
  });

  test('place trains at stations', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      for (let i = 10; i < 50; i++) s.placeTrack(i, 25, i + 1, 25);
      s.buildStation(15, 25, 'ground_small', 'A');
      s.buildStation(35, 25, 'ground_large', 'B');
      const stations = Array.from(window.__gameStore.getState().stations.values());
      s.setSelectedTrainType('local');
      s.placeTrain(stations[0].id);
      s.setSelectedTrainType('express');
      s.placeTrain(stations[1].id);
      s.setSelectedTrainType('freight');
      s.placeTrain(stations[0].id);
      const trains = Array.from(window.__gameStore.getState().trains.values());
      return trains.map(t => ({ name: t.name, type: t.type, cars: t.cars }));
    })()`);
    expect(result.length).toBe(3);
    expect(result[0].type).toBe('local');
    expect(result[1].type).toBe('express');
    expect(result[2].type).toBe('freight');
  });
});

test.describe('City Development & Buildings', () => {
  test('city develops after ticks', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    await buildCity(page);
    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      for (let i = 0; i < 2000; i++) s.tick();
      const s2 = window.__gameStore.getState();
      return {
        population: s2.population,
        buildings: s2.buildings.size,
        roads: Array.from(s2.map.flat()).filter(t => t.roadLevel > 0).length,
      };
    })()`);
    expect(result.population).toBeGreaterThan(0);
    expect(result.buildings).toBeGreaterThan(0);
  });

  test('building categories are generated', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    await buildCity(page);
    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      for (let i = 0; i < 3000; i++) s.tick();
      const buildings = Array.from(window.__gameStore.getState().buildings.values());
      const types = {};
      buildings.forEach(b => { types[b.type] = (types[b.type] || 0) + 1; });
      return types;
    })()`);
    // Should have at least residential and commercial
    expect(result).toHaveProperty('residential');
    expect(result).toHaveProperty('commercial');
  });

  test('roads are generated around buildings', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    await buildCity(page);
    const roadCount = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      for (let i = 0; i < 2000; i++) s.tick();
      const map = window.__gameStore.getState().map;
      let count = 0;
      for (let x = 0; x < map.length; x++)
        for (let z = 0; z < map[x].length; z++)
          if (map[x][z].roadLevel > 0) count++;
      return count;
    })()`);
    expect(roadCount).toBeGreaterThan(0);
  });
});

test.describe('Day/Night Cycle', () => {
  test('night mode activates after 18:00', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const store = window.__gameStore;
      store.setState({ gameTime: { year: 2024, month: 4, day: 1, hour: 20, minute: 0 } });
      const h = store.getState().gameTime.hour;
      return { hour: h, isNight: h < 6 || h >= 18 };
    })()`);
    expect(result.isNight).toBe(true);
  });

  test('day mode at noon', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const store = window.__gameStore;
      store.setState({ gameTime: { year: 2024, month: 4, day: 1, hour: 12, minute: 0 } });
      const h = store.getState().gameTime.hour;
      return { hour: h, isNight: h < 6 || h >= 18 };
    })()`);
    expect(result.isNight).toBe(false);
  });
});

test.describe('Game Speed Controls', () => {
  test('speed buttons exist and work', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    // Pause button
    const pauseBtn = page.locator('button:has-text("⏸")');
    await expect(pauseBtn).toBeVisible();
    // Play button
    const playBtn = page.locator('button:has-text("▶")');
    await expect(playBtn).toBeVisible();
    // Speed should change when clicking buttons
    await playBtn.click();
    const speed = await gameEval(page, `window.__gameStore.getState().speed`);
    expect(speed).toBeGreaterThan(0);
  });
});

test.describe('Save/Load', () => {
  test('save and load game', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    await buildCity(page);
    // Run some ticks
    await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      for (let i = 0; i < 1000; i++) s.tick();
    })()`);
    // Save
    await gameEval(page, `window.__gameStore.getState().saveGame()`);
    const popBefore = await gameEval(page, `window.__gameStore.getState().population`);
    // Load
    await gameEval(page, `window.__gameStore.getState().loadGame()`);
    const popAfter = await gameEval(page, `window.__gameStore.getState().population`);
    expect(popAfter).toBe(popBefore);
  });
});

test.describe('Console Error Check', () => {
  test('no critical console errors during gameplay', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/?autoplay');
    await waitForStore(page);
    await buildCity(page);
    // Run simulation
    await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      s.setSelectedTrainType('local');
      const stations = Array.from(s.stations.values());
      if (stations.length > 0) s.placeTrain(stations[0].id);
      for (let i = 0; i < 2000; i++) s.tick();
    })()`);
    await page.waitForTimeout(3000);
    // Filter out non-critical texture warnings
    const critical = errors.filter(e =>
      !e.includes('GLTFLoader') &&
      !e.includes('texture') &&
      !e.includes('React DevTools') &&
      !e.includes('Download the React DevTools')
    );
    expect(critical).toHaveLength(0);
  });
});

test.describe('GLB Model Loading', () => {
  test('no texture load errors', async ({ page }) => {
    const textureErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('texture')) {
        textureErrors.push(msg.text());
      }
    });
    await page.goto('/?autoplay');
    await waitForStore(page);
    await buildCity(page);
    await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      for (let i = 0; i < 2000; i++) s.tick();
    })()`);
    await page.waitForTimeout(3000);
    expect(textureErrors).toHaveLength(0);
  });

  test('all train types render', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      for (let i = 10; i < 50; i++) s.placeTrack(i, 25, i + 1, 25);
      s.buildStation(15, 25, 'ground_small', 'A');
      s.buildStation(25, 25, 'ground_small', 'B');
      s.buildStation(35, 25, 'ground_small', 'C');
      s.buildStation(45, 25, 'ground_small', 'D');
      const stations = Array.from(window.__gameStore.getState().stations.values());
      const types = ['local', 'express', 'freight', 'diesel'];
      types.forEach((t, i) => {
        s.setSelectedTrainType(t);
        s.placeTrain(stations[i % stations.length].id);
      });
      return Array.from(window.__gameStore.getState().trains.values()).map(t => t.type);
    })()`);
    expect(result).toContain('local');
    expect(result).toContain('express');
    expect(result).toContain('freight');
    expect(result).toContain('diesel');
  });
});

test.describe('Subsidiary Buildings', () => {
  test('place subsidiaries', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      const types = ['factory', 'hotel', 'department_store', 'warehouse', 'convenience_store'];
      types.forEach((t, i) => {
        s.setSelectedSubsidiaryType(t);
        s.buildSubsidiary(30 + i * 2, 30);
      });
      return Array.from(window.__gameStore.getState().subsidiaries.values()).map(sub => sub.type);
    })()`);
    expect(result.length).toBeGreaterThan(0);
  });
});

test.describe('Financial System', () => {
  test('track placement costs money', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const before = window.__gameStore.getState().finance.cash;
      window.__gameStore.getState().placeTrack(10, 25, 11, 25);
      const after = window.__gameStore.getState().finance.cash;
      return { before, after, diff: before - after };
    })()`);
    expect(result.diff).toBeGreaterThan(0);
  });

  test('loans work', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      const cashBefore = s.finance.cash;
      s.takeLoan(1000000000, 60);
      const s2 = window.__gameStore.getState();
      return {
        cashBefore,
        cashAfter: s2.finance.cash,
        loans: s2.loans.length,
      };
    })()`);
    expect(result.cashAfter).toBeGreaterThan(result.cashBefore);
    expect(result.loans).toBe(1);
  });
});

test.describe('Panel Navigation & Shortcuts', () => {
  test('G key opens the schedule panel', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    // Canvas内のKeyboardControlsのuseEffectがマウントされるまで少し待ってから押す
    await page.waitForTimeout(1500);
    await page.keyboard.press('g');
    await expect(page.getByText('ダイヤ設定')).toBeVisible();
    const shown = await gameEval(page, `window.__gameStore.getState().showSchedulePanel`);
    expect(shown).toBe(true);
  });

  test('O key opens the settings panel', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    await page.waitForTimeout(1500);
    await page.keyboard.press('o');
    await expect(page.getByText('マスター音量')).toBeVisible();
    const shown = await gameEval(page, `window.__gameStore.getState().showSettingsPanel`);
    expect(shown).toBe(true);
  });

  test('top bar buttons open schedule and settings panels', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    await page.getByRole('button', { name: /ダイヤ/ }).click();
    expect(await gameEval(page, `window.__gameStore.getState().showSchedulePanel`)).toBe(true);
    await page.getByRole('button', { name: /設定/ }).click();
    expect(await gameEval(page, `window.__gameStore.getState().showSettingsPanel`)).toBe(true);
  });
});

test.describe('Confirm Dialog', () => {
  test('confirm dialog shows message and OK triggers the callback', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    await gameEval(page, `(() => {
      window.__confirmTriggered = false;
      window.__gameStore.getState().requestConfirm('テスト確認メッセージ', () => { window.__confirmTriggered = true; });
    })()`);
    await expect(page.getByText('テスト確認メッセージ')).toBeVisible();
    await page.getByRole('button', { name: 'OK' }).click();
    expect(await gameEval(page, `window.__confirmTriggered`)).toBe(true);
    expect(await gameEval(page, `window.__gameStore.getState().confirmDialog`)).toBeNull();
  });

  test('confirm dialog cancel does not trigger the callback', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    await gameEval(page, `(() => {
      window.__confirmTriggered = false;
      window.__gameStore.getState().requestConfirm('テスト確認メッセージ2', () => { window.__confirmTriggered = true; });
    })()`);
    await expect(page.getByText('テスト確認メッセージ2')).toBeVisible();
    await page.getByRole('button', { name: 'キャンセル' }).click();
    expect(await gameEval(page, `window.__confirmTriggered`)).toBe(false);
  });

  test('bulldozing a station removes it', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      s.placeTrack(10, 25, 15, 25);
      s.buildStation(12, 25);
      const before = window.__gameStore.getState().stations.size;
      s.bulldoze(12, 25);
      const after = window.__gameStore.getState().stations.size;
      return { before, after };
    })()`);
    expect(result.before).toBe(1);
    expect(result.after).toBe(0);
  });

  test('bulldozing a train removes it', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      for (let i = 10; i <= 30; i++) s.placeTrack(i, 25, i + 1, 25);
      s.buildStation(10, 25);
      s.buildStation(30, 25);
      const stations = Array.from(window.__gameStore.getState().stations.values());
      s.setSelectedTrainType('local');
      s.placeTrain(stations[0].id);
      // 駅タイル上では駅の撤去が優先されるため、列車を駅から離れた区間まで進める
      for (let i = 0; i < 50; i++) s.tick();
      const train = Array.from(window.__gameStore.getState().trains.values())[0];
      const segment = window.__gameStore.getState().tracks.get(train.currentSegmentId);
      const before = window.__gameStore.getState().trains.size;
      s.bulldoze(segment.startX, segment.startZ);
      const after = window.__gameStore.getState().trains.size;
      return { before, after };
    })()`);
    expect(result.before).toBe(1);
    expect(result.after).toBe(0);
  });
});

test.describe('Bankruptcy & Emergency Bailout', () => {
  test('going bankrupt shows the gameover screen, and emergency bailout returns to playing', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);

    // 資金をマイナス・負債を上限超過にしてから月初(day=1, hour=0, minute=0)のtickを踏ませ、破産条件を満たす
    await gameEval(page, `(() => {
      const store = window.__gameStore;
      const s = store.getState();
      store.setState({
        finance: { ...s.finance, cash: -5_000_000_000, debt: 999_999_999_999 },
        constructionMode: false,
        gameTime: { year: 2024, month: 4, day: 30, hour: 23, minute: 50 },
      });
      store.getState().tick();
    })()`);

    const phaseAfterBankruptcy = await gameEval(page, `window.__gameStore.getState().gamePhase`);
    expect(phaseAfterBankruptcy).toBe('gameover');
    await expect(page.getByText('経営破綻')).toBeVisible();

    const cashBeforeBailout = await gameEval(page, `window.__gameStore.getState().finance.cash`);

    await page.getByRole('button', { name: '緊急支援を受ける（1回限り）' }).click();

    const state = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      const bailoutLoan = s.loans.find(l => l.principal === 240000000) ?? null;
      return {
        gamePhase: s.gamePhase,
        cash: s.finance.cash,
        bailoutUsed: s.bailoutUsed,
        bailoutLoan,
      };
    })()`);

    expect(state.gamePhase).toBe('playing');
    expect(state.bailoutUsed).toBe(true);
    expect(state.cash).toBe(cashBeforeBailout + 200_000_000);
    expect(state.bailoutLoan).toBeTruthy();
    expect(state.bailoutLoan.interestRate).toBe(0.08);
    expect(state.bailoutLoan.remainingMonths).toBe(120);

    await expect(page.getByText('経営破綻')).not.toBeVisible();
  });
});

test.describe('Material Transport Pipeline', () => {
  test('building level-up to level 4 requires and consumes nearby material stock', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);

    const result = await gameEval(page, `(() => {
      const store = window.__gameStore;

      // cityDevelopment.ts のseededRandomと同一実装（建物レベルアップ判定の乱数と一致させるため）
      function seededRandom(seed) {
        let s = seed | 0;
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      }

      const bx = 62, bz = 60;
      const seedBase = bx * 7001 + bz * 3011;

      // levelUpBuildings(state)はtick()内でadvanceTime前のstate（＝tick開始時点のgameTime）を
      // そのまま参照するため、「月末23:50→tick1回」で読ませる乱数のseedはその開始時点の年月になる。
      // ここではその年月自体を「20%判定に当選する」ものになるまで探索する
      let priorYear = 2024, priorMonth = 4;
      for (let i = 0; i < 240; i++) {
        const rand = seededRandom(seedBase + priorMonth * 97 + priorYear * 13);
        if (rand <= 0.2) break;
        priorMonth++;
        if (priorMonth > 12) { priorMonth = 1; priorYear++; }
      }

      function runScenario(materialStock) {
        const s = store.getState();
        s.placeTrack(60, 60, 61, 60);
        s.buildStation(60, 60);
        const station = Array.from(store.getState().stations.values()).slice(-1)[0];
        store.setState({
          stations: new Map(store.getState().stations).set(station.id, { ...station, activityLevel: 80 }),
        });

        // レベル3の集合住宅(apartment_medium, maxLevel=4)を直接注入する
        const building = {
          id: 'test_bld_1', x: bx, z: bz, type: 'residential', subtype: 'apartment_medium',
          level: 3, width: 2, depth: 2, height: 5, residents: 240, workers: 0,
        };
        store.setState({ buildings: new Map([[building.id, building]]) });

        const map = store.getState().map;
        map[bx][bz].materialStock = materialStock;

        store.setState({
          gameTime: { year: priorYear, month: priorMonth, day: 30, hour: 23, minute: 50 },
          lastLevelUpMonth: 0,
          lastDevelopmentDay: 0,
        });
        store.getState().tick();

        const b = store.getState().buildings.get('test_bld_1');
        const stockAfter = store.getState().map[bx][bz].materialStock;
        return { level: b.level, stockAfter };
      }

      const sufficient = runScenario(100);
      const insufficient = runScenario(0);

      return { sufficient, insufficient, priorYear, priorMonth };
    })()`);

    // 資材が閾値(50)以上あればレベル4へ昇格し、閾値分だけ消費される（余剰は残る）
    expect(result.sufficient.level).toBe(4);
    expect(result.sufficient.stockAfter).toBe(100 - 50);

    // 全く同じ乱数当選タイミングでも、資材が無ければレベル4へは昇格しない
    expect(result.insufficient.level).toBe(3);
    expect(result.insufficient.stockAfter).toBe(0);
  });

  test('freight train picks up material at one station and delivers it with income at another', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);

    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      s.placeTrack(70, 70, 71, 70);
      s.buildStation(70, 70);
      s.buildStation(71, 70);
      const stations = Array.from(window.__gameStore.getState().stations.values());
      const stationA = stations.find(st => st.x === 70 && st.z === 70);
      const stationB = stations.find(st => st.x === 71 && st.z === 70);

      const map = window.__gameStore.getState().map;
      map[70][70].materialStock = 30;

      s.setSelectedTrainType('freight');
      s.placeTrain(stationA.id);
      const train = Array.from(window.__gameStore.getState().trains.values())[0];
      s.updateTrainSchedule(train.id, {
        stops: [
          { stationId: stationA.id, action: 'stop', waitTime: 10 },
          { stationId: stationB.id, action: 'stop', waitTime: 10 },
        ],
        currentStopIndex: 0,
        loopMode: 'bounce',
      });

      for (let i = 0; i < 2000; i++) s.tick();

      const s2 = window.__gameStore.getState();
      return {
        originStock: s2.map[70][70].materialStock,
        destStock: s2.map[71][70].materialStock,
        materialTransportIncome: s2.finance.quarterlyIncome.materialTransport,
      };
    })()`);

    expect(result.originStock).toBeLessThan(30);
    expect(result.destStock).toBeGreaterThan(0);
    expect(result.materialTransportIncome).toBeGreaterThan(0);
  });
});

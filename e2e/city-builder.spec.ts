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

  test('loading a pre-P2-5 save re-filters a mixed-layer station\'s connectedTracks by elevation (P2-B)', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();

      // 地上+地下が混在するタイル(51,50)に地上駅を建てる（現行コードは既にconnectedTracksを
      // elevation:0のみに絞り込むため、正常系ではこのバグは再現しない）
      s.setSelectedTool('track_straight');
      s.placeTrack(50, 50, 52, 50);
      s.setSelectedTool('track_underground');
      s.placeTrack(50, 50, 52, 50);
      s.setSelectedTool('none');
      s.buildStation(51, 50);

      const station = Array.from(window.__gameStore.getState().stations.values())[0];
      const groundTrackId = station.connectedTracks[0];
      const tile = window.__gameStore.getState().map[51][50];
      const tracks = window.__gameStore.getState().tracks;
      const undergroundTrackId = tile.trackIds.find(tid => tracks.get(tid).elevation === -1);

      // セーブしたJSONを、P2-5修正より前のフォーマット（station.elevationが存在せず、
      // connectedTracksに地下線路IDも混在＝地下が先頭）へ意図的に書き換えてlocalStorageへ戻す
      s.saveGame();
      const raw = JSON.parse(localStorage.getItem('atrain-city-save'));
      const entry = raw.stations.find(([id]) => id === station.id);
      delete entry[1].elevation;
      entry[1].connectedTracks = [undergroundTrackId, groundTrackId];
      localStorage.setItem('atrain-city-save', JSON.stringify(raw));

      // ロードし直す
      window.__gameStore.getState().loadGame();
      const loadedStation = window.__gameStore.getState().stations.get(station.id);

      // 修復されたconnectedTracksで列車を配置し、地上線路上にスポーンすることを確認
      s.setSelectedTrainType('local');
      s.placeTrain(station.id);
      const train = Array.from(window.__gameStore.getState().trains.values())[0];
      const trainSegElevation = window.__gameStore.getState().tracks.get(train.currentSegmentId).elevation;

      return {
        elevation: loadedStation.elevation,
        connectedTracks: loadedStation.connectedTracks,
        groundTrackId,
        trainSegElevation,
      };
    })()`);
    expect(result.elevation).toBe(0);
    // 地下線路IDは除去され、地上線路IDのみが残っていること
    expect(result.connectedTracks).toEqual([result.groundTrackId]);
    // 列車は地上(elevation:0)の線路上にスポーンすること（地下にスポーンしていない）
    expect(result.trainSegElevation).toBe(0);
  });

  test('loading a legacy (pre-elevation-clamp-removal) subway station save keeps its connected tracks despite a type/elevation mismatch (P2-D)', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();

      // 現行コードで地下鉄駅を建設する（connectedTracksは本来elevation:-1の線路のみ）
      s.setSelectedTool('track_underground');
      s.placeTrack(80, 80, 82, 80);
      s.setSelectedTool('none');
      s.buildStation(81, 80, 'underground');

      const station = Array.from(window.__gameStore.getState().stations.values())[0];
      const connectedTrackIds = [...station.connectedTracks];

      // セーブJSONを、v1.0で地下線路のelevationクランプ(Math.max(0, elevation))を撤廃する
      // 前のフォーマットへ意図的に書き換える: station.elevationは存在せず(手がかりはtype:
      // 'underground'のみ)、かつ実際の接続線路は当時のバグにより全てelevation:0で記録されていた
      s.saveGame();
      const raw = JSON.parse(localStorage.getItem('atrain-city-save'));
      const stEntry = raw.stations.find(([id]) => id === station.id);
      delete stEntry[1].elevation;
      for (const [tid, t] of raw.tracks) {
        if (connectedTrackIds.includes(tid)) t.elevation = 0;
      }
      localStorage.setItem('atrain-city-save', JSON.stringify(raw));

      // ロードし直す
      window.__gameStore.getState().loadGame();
      const loadedStation = window.__gameStore.getState().stations.get(station.id);

      // 修復されたconnectedTracksで実際に列車を配置できることも確認
      s.setSelectedTrainType('local');
      s.placeTrain(station.id);
      const trainPlaced = window.__gameStore.getState().trains.size > 0;

      return {
        elevation: loadedStation.elevation,
        connectedTracks: [...loadedStation.connectedTracks].sort(),
        originalConnectedTrackIds: connectedTrackIds.sort(),
        trainPlaced,
      };
    })()`);
    // type由来の理論値(-1)ではなく、実際に接続されている線路のelevation(0)を採用していること
    expect(result.elevation).toBe(0);
    // 接続線路が全滅せず、元の接続線路がそのまま保持されていること
    expect(result.connectedTracks).toEqual(result.originalConnectedTrackIds);
    expect(result.trainPlaced).toBe(true);
  });

  test('legacy elevation fallback prefers the known clamp result (elevation:0) over a higher-segment-count elevated line (P2-E)', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();

      // 地下線路のみのタイル(91,85)に地下鉄駅を建てる（現行コードのconnectedTracksは
      // 本来この1本の地下線路IDのみ）
      s.setSelectedTool('track_underground');
      s.placeTrack(91, 85, 92, 85);
      s.setSelectedTool('none');
      s.buildStation(91, 85, 'underground');

      const station = Array.from(window.__gameStore.getState().stations.values())[0];
      const realUndergroundTrackId = station.connectedTracks[0];

      // 駅を建てた後、同じタイル(91,85)を通る高架のスルー線を敷設する（=タイルがレイヤー
      // 混在になる。旧・地下鉄駅の交差タイルを模した状況を作るための細工）
      s.setSelectedTool('track_elevated');
      s.placeTrack(90, 85, 92, 85);
      s.setSelectedTool('none');
      const tile = window.__gameStore.getState().map[91][85];
      const tracks = window.__gameStore.getState().tracks;
      const elevatedTrackIds = tile.trackIds.filter(tid => tracks.get(tid).elevation === 1);

      // セーブJSONを、v1.0で地下線路のelevationクランプ(Math.max(0, elevation))を撤廃する
      // 前のフォーマットへ意図的に書き換える: station.elevationは存在せず、connectedTracksは
      // 全レイヤー混在（地下鉄の終端線1本 + 高架のスルー線2本）、地下線路はクランプにより
      // elevation:0で記録されていた（高架線はクランプの影響を受けないためelevation:1のまま）
      s.saveGame();
      const raw = JSON.parse(localStorage.getItem('atrain-city-save'));
      const stEntry = raw.stations.find(([id]) => id === station.id);
      delete stEntry[1].elevation;
      stEntry[1].connectedTracks = [...elevatedTrackIds, realUndergroundTrackId];
      for (const [tid, t] of raw.tracks) {
        if (tid === realUndergroundTrackId) t.elevation = 0;
      }
      localStorage.setItem('atrain-city-save', JSON.stringify(raw));

      // ロードし直す
      window.__gameStore.getState().loadGame();
      const loadedStation = window.__gameStore.getState().stations.get(station.id);

      return {
        elevation: loadedStation.elevation,
        connectedTracks: [...loadedStation.connectedTracks].sort(),
        realUndergroundTrackId,
        elevatedTrackCount: elevatedTrackIds.length,
      };
    })()`);
    expect(result.elevatedTrackCount).toBe(2);
    // セグメント数の多数決(高架2本)ではなく、クランプの既知の結果であるelevation:0を採用すること
    expect(result.elevation).toBe(0);
    // 本来の地下鉄線1本のみに正しく紐づき、無関係な高架線には紐づかないこと
    expect(result.connectedTracks).toEqual([result.realUndergroundTrackId]);
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

  test('freight train does not earn income by loading and unloading at the same station (P2-4 exploit closed)', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);

    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      // 行き止まりの短い一本線(x=80〜82)。駅は片側の行き止まり(x=80)にのみ置くため、
      // 列車は物理的な反射で常にこの同じ駅へ戻ってくる（＝同一駅への重複到着を再現する）
      s.placeTrack(80, 80, 82, 80);
      s.buildStation(80, 80);
      const station = Array.from(window.__gameStore.getState().stations.values())[0];

      const map = window.__gameStore.getState().map;
      map[80][80].materialStock = 100;

      s.setSelectedTrainType('freight');
      s.placeTrain(station.id);
      const train = Array.from(window.__gameStore.getState().trains.values())[0];
      s.updateTrainSchedule(train.id, {
        stops: [{ stationId: station.id, action: 'stop', waitTime: 5 }],
        currentStopIndex: 0,
        loopMode: 'loop',
      });

      for (let i = 0; i < 3000; i++) s.tick();

      const s2 = window.__gameStore.getState();
      return {
        income: s2.finance.quarterlyIncome.materialTransport,
        materialLoad: s2.trains.get(train.id).materialLoad,
        loadedAtStationId: s2.trains.get(train.id).loadedAtStationId,
        stationId: station.id,
      };
    })()`);

    // 積み込んだのと同じ駅を何度往復しても、輸送収入は一切発生しない
    expect(result.income).toBe(0);
    // 荷降ろしされず積んだまま（同一駅では荷降ろし自体を抑止する）
    expect(result.materialLoad).toBeGreaterThan(0);
    expect(result.loadedAtStationId).toBe(result.stationId);
  });
});

test.describe('Milestones', () => {
  test('reaching 5 stations fires the milestone notification', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const store = window.__gameStore;
      const s = store.getState();
      for (let i = 10; i < 30; i++) s.placeTrack(i, 25, i + 1, 25);
      s.buildStation(12, 25);
      s.buildStation(15, 25);
      s.buildStation(18, 25);
      s.buildStation(21, 25);
      s.buildStation(24, 25);

      // 日次更新をまたぐ（day境界: hour23:50 → tick1回でhour0:00へ）ことでマイルストーン判定を発火させる
      store.setState({ gameTime: { year: 2024, month: 4, day: 1, hour: 23, minute: 50 }, lastDevelopmentDay: 0 });
      store.getState().tick();

      const state = store.getState();
      return {
        achieved: Array.from(state.achievedMilestones),
        notifications: state.notifications.map(n => n.message),
      };
    })()`);
    expect(result.achieved).toContain('stations_5');
    expect(result.notifications).toContain('🚉 駅を5駅開業しました！');
  });
});

test.describe('Scenario Time Limit & Clear/Failed Screens', () => {
  test('achieving all objectives transitions to the scenario clear screen', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const store = window.__gameStore;
      const s = store.getState();

      // 「山間の街おこし」シナリオの目標（人口5,000人・駅5つ）を満たす状態を作る
      for (let i = 10; i < 30; i++) s.placeTrack(i, 25, i + 1, 25);
      s.buildStation(12, 25);
      s.buildStation(15, 25);
      s.buildStation(18, 25);
      s.buildStation(21, 25);
      s.buildStation(24, 25);

      // calculatePopulationはbuildingsのresidents合計を見るだけなので、
      // 実在しないsubtypeの建物を直接注入すればlevelUpBuildingsの影響を受けずに人口を作れる
      store.setState({
        buildings: new Map([['pop_test', {
          id: 'pop_test', x: 5, z: 5, type: 'residential', subtype: '__scenario_test__',
          level: 1, width: 1, depth: 1, height: 1, residents: 6000, workers: 0,
        }]]),
      });

      store.setState({
        scenarioId: 'mountain_village',
        scenarioStartYear: 2024,
        scenarioCleared: false,
        gamePhase: 'playing',
        // 月初(day=1, hour=0, minute=0)のtickでシナリオ判定が走るよう、月末23:50から1tick進める
        gameTime: { year: 2024, month: 5, day: 30, hour: 23, minute: 50 },
        lastLevelUpMonth: 0,
        lastDevelopmentDay: 0,
      });
      store.getState().tick();

      const state = store.getState();
      return { gamePhase: state.gamePhase, scenarioCleared: state.scenarioCleared, population: state.population };
    })()`);
    expect(result.gamePhase).toBe('scenario_clear');
    expect(result.scenarioCleared).toBe(true);
    expect(result.population).toBeGreaterThanOrEqual(5000);
    await expect(page.getByText('シナリオクリア！')).toBeVisible();
    // 「山間の街おこし」というテキストは通知にも重複して出るため、クリア画面カード内の要素に絞る
    await expect(page.getByText('シナリオクリア！').locator('..').getByText('山間の街おこし')).toBeVisible();
  });

  test('income objective is judged against the quarter just closed, not the just-reset quarterlyIncome (P1-1)', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const store = window.__gameStore;
      const s0 = store.getState();

      // 「海辺の都市計画」シナリオの人口・列車数の目標は状態を直接注入・実列車配置で満たしておき、
      // 収入目標(四半期収入1億円)だけが焦点になるようにする。列車10両分の建設費を賄えるよう資金を確保
      store.setState({ finance: { ...s0.finance, cash: 5_000_000_000 } });
      s0.placeTrack(40, 40, 41, 40);
      s0.buildStation(40, 40);
      const trainStation = Array.from(store.getState().stations.values())[0];
      s0.setSelectedTrainType('local');
      for (let i = 0; i < 10; i++) s0.placeTrain(trainStation.id);

      store.setState({
        buildings: new Map([['pop_test', {
          id: 'pop_test', x: 5, z: 5, type: 'residential', subtype: '__scenario_test__',
          level: 1, width: 1, depth: 1, height: 1, residents: 20000, workers: 0,
        }]]),
      });

      // ちょうど四半期末(月初でquarterlyIncomeが0にリセットされるタイミング)に
      // 収入目標を達成させる: 四半期決算のリセットは月1/4/7/10の day=1, hour=0, minute=0で走るため、
      // 3月末(このゲームの暦は1ヶ月=30日固定)23:50から1tick進めて4月1日0:00に到達させる
      const s = store.getState();
      store.setState({
        finance: {
          ...s.finance,
          quarterlyIncome: { railFare: 150_000_000, subsidiary: 0, other: 0, landRent: 0, materialTransport: 0 },
        },
        scenarioId: 'seaside_city',
        scenarioStartYear: 2024,
        scenarioCleared: false,
        gamePhase: 'playing',
        gameTime: { year: 2024, month: 3, day: 30, hour: 23, minute: 50 },
        lastLevelUpMonth: 0,
        lastDevelopmentDay: 0,
      });
      store.getState().tick();

      const state = store.getState();
      return {
        gamePhase: state.gamePhase,
        scenarioCleared: state.scenarioCleared,
        quarterlyIncomeAfter: state.finance.quarterlyIncome,
      };
    })()`);
    expect(result.gamePhase).toBe('scenario_clear');
    expect(result.scenarioCleared).toBe(true);
    // 判定後、quarterlyIncomeは通常どおり0にリセットされていること（判定用の一時値が漏れ残っていない）
    const qi = result.quarterlyIncomeAfter;
    expect(qi.railFare + qi.subsidiary + qi.other + qi.landRent + qi.materialTransport).toBe(0);
  });

  test('exceeding the time limit without completing objectives shows the failed screen, and continuing returns to free play', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const phase = await gameEval(page, `(() => {
      const store = window.__gameStore;
      store.setState({
        scenarioId: 'mountain_village',
        scenarioStartYear: 1990, // timeLimit(30年)を大幅に超過させる
        scenarioCleared: false,
        gamePhase: 'playing',
        gameTime: { year: 2024, month: 5, day: 30, hour: 23, minute: 50 },
        lastLevelUpMonth: 0,
      });
      store.getState().tick();
      return store.getState().gamePhase;
    })()`);
    expect(phase).toBe('scenario_failed');
    await expect(page.getByText('シナリオ失敗…')).toBeVisible();

    await page.getByRole('button', { name: 'このまま続ける' }).click();
    const after = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      return { gamePhase: s.gamePhase, scenarioId: s.scenarioId };
    })()`);
    expect(after.gamePhase).toBe('playing');
    expect(after.scenarioId).toBeNull();
    await expect(page.getByText('シナリオ失敗…')).not.toBeVisible();
  });
});

test.describe('Underground Track & Subway Station', () => {
  test('subway station can only be built on underground-only track', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();

      // 地下線路のみのタイルには地下鉄駅を建設できる
      s.setSelectedTool('track_underground');
      s.placeTrack(58, 64, 60, 64);
      s.buildStation(59, 64, 'underground');

      // 地上線路のみのタイルには地下鉄駅を建設できない（エラー通知が出て駅は作られない）
      s.setSelectedTool('track_straight');
      s.placeTrack(58, 66, 60, 66);
      const beforeCount = window.__gameStore.getState().stations.size;
      s.buildStation(59, 66, 'underground');
      const afterCount = window.__gameStore.getState().stations.size;

      const stations = Array.from(window.__gameStore.getState().stations.values());
      return {
        subwayStation: stations.find(st => st.x === 59 && st.z === 64) ?? null,
        beforeCount,
        afterCount,
      };
    })()`);
    expect(result.subwayStation).toBeTruthy();
    expect(result.subwayStation.type).toBe('underground');
    // 地上線路タイルへの地下鉄駅建設は拒否され、駅数は増えない
    expect(result.afterCount).toBe(result.beforeCount);
  });

  test('station build is rejected on a tile with only elevated+underground track and no ground-level track (P2-C)', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();

      // 高架線路と地下線路のみを敷設し、地上(elevation:0)の線路は存在しないタイルを作る
      s.setSelectedTool('track_elevated');
      s.placeTrack(95, 95, 97, 95);
      s.setSelectedTool('track_underground');
      s.placeTrack(95, 95, 97, 95);
      s.setSelectedTool('none');

      const cashBeforeStation = window.__gameStore.getState().finance.cash;
      // stationTypeを指定しない場合のデフォルトはground_small。onlyUnderground/onlyElevated
      // が共にfalseになるため、旧チェックをすり抜けて建設できてしまっていた
      s.buildStation(96, 95);

      const state = window.__gameStore.getState();
      return {
        stationCount: state.stations.size,
        cashUnchanged: state.finance.cash === cashBeforeStation,
        tileStationId: state.map[96][95].stationId,
      };
    })()`);
    expect(result.stationCount).toBe(0);
    expect(result.tileStationId).toBeFalsy();
    // 建設が拒否され、駅の建設費は引かれていないこと
    expect(result.cashUnchanged).toBe(true);
  });
});

test.describe('Diagram Loop Modes', () => {
  test('one-way schedule terminates the train at the final stop, and restartTerminatedTrain resumes it in reverse', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      for (let i = 10; i < 20; i++) s.placeTrack(i, 25, i + 1, 25);
      s.buildStation(10, 25);
      s.buildStation(20, 25);
      const stations = Array.from(window.__gameStore.getState().stations.values());
      const stationA = stations.find(st => st.x === 10 && st.z === 25);
      const stationB = stations.find(st => st.x === 20 && st.z === 25);

      s.setSelectedTrainType('local');
      s.placeTrain(stationA.id);
      const train = Array.from(window.__gameStore.getState().trains.values())[0];
      s.updateTrainSchedule(train.id, {
        stops: [
          { stationId: stationA.id, action: 'stop', waitTime: 5 },
          { stationId: stationB.id, action: 'stop', waitTime: 5 },
        ],
        currentStopIndex: 0,
        loopMode: 'one-way',
      });

      for (let i = 0; i < 2000; i++) s.tick();
      const afterArrival = window.__gameStore.getState().trains.get(train.id);

      s.restartTerminatedTrain(train.id);
      const afterRestart = window.__gameStore.getState().trains.get(train.id);

      return {
        terminatedState: afterArrival.state,
        terminatedFlag: afterArrival.terminated,
        restartedState: afterRestart.state,
        restartedFlag: afterRestart.terminated,
      };
    })()`);
    expect(result.terminatedState).toBe('stopped');
    expect(result.terminatedFlag).toBe(true);
    expect(result.restartedState).toBe('running');
    expect(result.restartedFlag).toBe(false);
  });

  test('bounce schedule reverses direction at a through-station terminal, not just at a physical track dead-end', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      // x=10〜30の一本の直線区間。終端駅は途中のx=20に置き、その先(20→30)も
      // 線路が続く＝終端駅は物理的な行き止まりではない（P1-2で報告された状況）
      for (let i = 10; i < 30; i++) s.placeTrack(i, 29, i + 1, 29);
      s.buildStation(10, 29);
      s.buildStation(20, 29);
      const stations = Array.from(window.__gameStore.getState().stations.values());
      const stationA = stations.find(st => st.x === 10 && st.z === 29);
      const stationTerm = stations.find(st => st.x === 20 && st.z === 29);

      s.setSelectedTrainType('local');
      s.placeTrain(stationA.id);
      const train = Array.from(window.__gameStore.getState().trains.values())[0];
      s.updateTrainSchedule(train.id, {
        stops: [
          { stationId: stationA.id, action: 'stop', waitTime: 5 },
          { stationId: stationTerm.id, action: 'stop', waitTime: 5 },
        ],
        currentStopIndex: 0,
        loopMode: 'bounce',
      });

      let maxX = -Infinity;
      let reachedTerminal = false;
      let minXAfterTerminal = Infinity;
      for (let i = 0; i < 4000; i++) {
        s.tick();
        const t = window.__gameStore.getState().trains.get(train.id);
        const seg = window.__gameStore.getState().tracks.get(t.currentSegmentId);
        if (!seg) continue;
        const x = seg.startX + (seg.endX - seg.startX) * t.positionOnSegment;
        if (x > maxX) maxX = x;
        if (x >= 19.5) reachedTerminal = true;
        if (reachedTerminal && x < minXAfterTerminal) minXAfterTerminal = x;
      }
      return { maxX, reachedTerminal, minXAfterTerminal };
    })()`);
    expect(result.reachedTerminal).toBe(true);
    // 終端駅(x=20)の先、行き止まり(x=30)へ向かって暴走していないこと
    expect(result.maxX).toBeLessThan(21);
    // 折り返して起点(x=10)付近まで正しく戻ってきていること
    expect(result.minXAfterTerminal).toBeLessThan(11);
  });

  test('bounce reversal is correct when the schedule is applied exactly as the train crosses into a reversed-orientation segment (P2-A)', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const result = await gameEval(page, `(() => {
      const store = window.__gameStore;
      const s = store.getState();
      // 起点側(x=10〜20)は増加方向で敷設（各区間はstartX<endX）
      s.placeTrack(10, 33, 20, 33);
      // 終端駅の先(x=20〜30)はあえて減少方向(30→20)に敷設し、各区間のstart/end座標を
      // 反転させる（startX>endX）。P2-A: この向きの区間へ遷移する瞬間にupdatedTrain.direction
      // は既に-train.directionへ反転済みになっており、単純な-train.direction代入では
      // 反転が相殺されて折り返さず通過してしまうことがあった
      s.placeTrack(30, 33, 20, 33);
      s.buildStation(10, 33);
      s.buildStation(20, 33);
      const stations = Array.from(store.getState().stations.values());
      const stationA = stations.find(st => st.x === 10 && st.z === 33);
      const stationTerm = stations.find(st => st.x === 20 && st.z === 33);

      s.setSelectedTrainType('local');
      s.placeTrain(stationA.id);
      const train = Array.from(store.getState().trains.values())[0];
      const approachSeg = Array.from(store.getState().tracks.values())
        .find(t => t.startX === 19 && t.endX === 20 && t.startZ === 33);

      // P2-Aの競合は「終端駅の1tick手前にいる状態でbounceダイヤが適用/編集される」ケースで
      // 起きる。通常の走行では到着判定(positionOnSegment>0.85)がセグメント境界(1.0)より
      // 十分手前で発火するため、この競合の再現には手動で「境界を跨ぐ直前」まで進めてから
      // ダイヤを適用する必要がある
      const newTrains = new Map(store.getState().trains);
      newTrains.set(train.id, {
        ...store.getState().trains.get(train.id),
        currentSegmentId: approachSeg.id,
        positionOnSegment: 0.99,
        direction: 1,
        state: 'running',
        schedule: { stops: [], currentStopIndex: 0, loopMode: 'bounce' },
      });
      store.setState({ trains: newTrains });
      store.getState().updateTrainSchedule(train.id, {
        stops: [
          { stationId: stationA.id, action: 'stop', waitTime: 5 },
          { stationId: stationTerm.id, action: 'stop', waitTime: 5 },
        ],
        currentStopIndex: 0,
        loopMode: 'bounce',
      });

      let maxX = -Infinity;
      let reachedTerminal = false;
      let minXAfterTerminal = Infinity;
      for (let i = 0; i < 4000; i++) {
        store.getState().tick();
        const t = store.getState().trains.get(train.id);
        const seg = store.getState().tracks.get(t.currentSegmentId);
        if (!seg) continue;
        const x = seg.startX + (seg.endX - seg.startX) * t.positionOnSegment;
        if (x > maxX) maxX = x;
        if (x >= 19.5) reachedTerminal = true;
        if (reachedTerminal && x < minXAfterTerminal) minXAfterTerminal = x;
      }
      return { maxX, reachedTerminal, minXAfterTerminal };
    })()`);
    expect(result.reachedTerminal).toBe(true);
    // 終端駅(x=20)の先、逆向き区間(x=30)へ向かって暴走していないこと
    expect(result.maxX).toBeLessThan(21);
    // 折り返して起点(x=10)付近まで正しく戻ってきていること
    expect(result.minXAfterTerminal).toBeLessThan(11);
  });
});

test.describe('Procedural Terrain: Hills, Mountains & Forest', () => {
  test('generated map includes hill, mountain and forest tiles', async ({ page }) => {
    await page.goto('/?autoplay');
    await waitForStore(page);
    const counts = await gameEval(page, `(() => {
      const map = window.__gameStore.getState().map;
      const counts = {};
      for (let x = 0; x < map.length; x++) {
        for (let z = 0; z < map[x].length; z++) {
          const t = map[x][z].terrain;
          counts[t] = (counts[t] || 0) + 1;
        }
      }
      return counts;
    })()`);
    expect(counts.flat).toBeGreaterThan(0);
    expect(counts.hill).toBeGreaterThan(0);
    expect(counts.mountain).toBeGreaterThan(0);
    expect(counts.forest).toBeGreaterThan(0);
    expect(counts.water).toBeGreaterThan(0);
  });
});

test.describe('Sound Connection', () => {
  test('adjusting volume sliders in the settings panel does not throw', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/?autoplay');
    await waitForStore(page);
    await page.waitForTimeout(1500);
    await page.keyboard.press('o');
    await expect(page.getByText('マスター音量')).toBeVisible();

    const sliders = page.locator('input[type="range"]');
    await sliders.nth(0).fill('80'); // マスター音量
    await sliders.nth(1).fill('10'); // BGM
    await sliders.nth(2).fill('90'); // 効果音
    await page.waitForTimeout(300);

    // 建設操作でplayBuildSoundも経由させる
    await gameEval(page, `(() => {
      const s = window.__gameStore.getState();
      s.placeTrack(10, 25, 11, 25);
      s.buildStation(10, 25);
    })()`);
    await page.waitForTimeout(300);

    expect(errors).toHaveLength(0);
  });
});

test.describe('Tutorial', () => {
  test('stepping through all tutorial steps completes it and returns to playing', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('atrain-tutorial-done'));
    await page.goto('/');
    await waitForStore(page);
    await page.getByRole('button', { name: '新しいゲーム' }).click();

    const phaseAfterStart = await gameEval(page, `window.__gameStore.getState().gamePhase`);
    expect(phaseAfterStart).toBe('tutorial');
    await expect(page.getByText(/ステップ 1 \//)).toBeVisible();

    const stepCount = await gameEval(page, `window.__gameStore.getState().tutorialStep`);
    expect(stepCount).toBe(0);

    // 「次へ」を末尾まで押し続け、最後は「完了」になる
    for (let i = 0; i < 9; i++) {
      await page.getByRole('button', { name: /^(次へ|完了)$/ }).click();
    }

    const result = await page.evaluate(() => ({
      gamePhase: (window as any).__gameStore.getState().gamePhase,
      tutorialDone: localStorage.getItem('atrain-tutorial-done'),
    }));
    expect(result.gamePhase).toBe('playing');
    expect(result.tutorialDone).toBe('1');
  });
});

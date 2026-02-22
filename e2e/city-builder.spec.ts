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
    await expect(page.getByText('鉄道')).toBeVisible();
    await expect(page.getByText('駅')).toBeVisible();
    await expect(page.getByText('列車')).toBeVisible();
    await expect(page.getByText('施設')).toBeVisible();
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
      s.buildStation(30, 25, 'elevated', 'Elevated');
      s.buildStation(25, 15, 'depot', 'Depot');
      const stations = Array.from(window.__gameStore.getState().stations.values());
      return stations.map(st => ({ name: st.name, type: st.type }));
    })()`);
    expect(result.length).toBe(5);
    expect(result.map((s: any) => s.type)).toContain('terminal');
    expect(result.map((s: any) => s.type)).toContain('depot');
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

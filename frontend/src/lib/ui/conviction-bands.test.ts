import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CONVICTION_BANDS, convictionTileClass } from "./conviction-bands";

/**
 * The heatmap encodes conviction as colour and now prints a key for it. Key
 * and tiles are built from one array, so they cannot disagree by construction
 * -- but only while the array stays the single source. These are what notice
 * if a tile class is hardcoded back into the component, or a boundary moves
 * without its label moving with it.
 */
describe("conviction bands", () => {
  test("each band's legend swatch is the colour its tiles actually use", () => {
    for (const band of CONVICTION_BANDS) {
      const swatchColour = band.swatch.replace(/^bg-/, "").split(" ")[0];
      assert.ok(band.tile.includes(swatchColour), `legend ${band.swatch} does not match tile ${band.tile}`);
    }
  });

  test("bands run high to low, which is what the lookup depends on", () => {
    const floors = CONVICTION_BANDS.map((band) => band.floor);
    assert.deepEqual(floors, [...floors].sort((a, b) => b - a));
    assert.equal(floors[floors.length - 1], 0, "the last band must be the catch-all");
  });

  test("the boundaries land where the labels say they do", () => {
    assert.equal(convictionTileClass(80), CONVICTION_BANDS[0].tile);
    assert.equal(convictionTileClass(79.9), CONVICTION_BANDS[1].tile);
    assert.equal(convictionTileClass(65), CONVICTION_BANDS[1].tile);
    assert.equal(convictionTileClass(64.9), CONVICTION_BANDS[2].tile);
    assert.equal(convictionTileClass(50), CONVICTION_BANDS[2].tile);
    assert.equal(convictionTileClass(49.9), CONVICTION_BANDS[3].tile);
    assert.equal(convictionTileClass(0), CONVICTION_BANDS[3].tile);
  });

  // Three label shapes are in use and each says something different: "80+" is
  // open above, "65-79" is closed, "<50" states the band *above* it. Reading
  // them all as "starts at the floor" is what my first version of this test
  // got wrong, and the catch-all caught it.
  test("every label describes its own band's range", () => {
    for (const [index, band] of CONVICTION_BANDS.entries()) {
      const digits = band.label.match(/\d+/g)?.map(Number) ?? [];
      const above = CONVICTION_BANDS[index - 1];
      if (!digits.length) continue;

      if (band.label.startsWith("<")) {
        assert.ok(above, `"${band.label}" only makes sense with a band above it`);
        assert.equal(digits[0], above.floor, `"${band.label}" should stop where the band above starts (${above.floor})`);
        continue;
      }

      assert.equal(digits[0], band.floor, `label "${band.label}" does not start at its floor ${band.floor}`);
      if (digits.length > 1) {
        assert.ok(above, `"${band.label}" names an upper bound but has no band above it`);
        assert.equal(digits[1], above.floor - 1, `"${band.label}" does not stop below ${above.floor}`);
      }
    }
  });

  // gaugePercent can produce values outside 0-100; a tile with no colour class
  // would read as a rendering fault rather than as a low score.
  test("an out-of-range score still gets a colour", () => {
    assert.equal(convictionTileClass(-5), CONVICTION_BANDS[3].tile);
    assert.equal(convictionTileClass(1000), CONVICTION_BANDS[0].tile);
  });
});

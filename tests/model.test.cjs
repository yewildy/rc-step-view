const { test } = require("node:test");
const assert = require("node:assert/strict");
const { circuit, voltageAt, sampleCurve } = require("../model.js");
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test("kΩ and µF become SI units and give the expected time constant", () => {
  const model = circuit(10, 10, 5);
  near(model.resistanceOhms, 10000);
  near(model.capacitanceFarads, 0.00001);
  near(model.tauSeconds, 0.1);
});
test("charging and discharging agree with their initial and one-tau values", () => {
  const model = circuit(10, 10, 5);
  near(voltageAt(model, 0, "charge"), 0);
  near(voltageAt(model, 0, "discharge"), 5);
  near(voltageAt(model, 0.1, "charge"), 3.1606027941427883);
  near(voltageAt(model, 0.1, "discharge"), 1.8393972058572117);
  near(voltageAt(model, 0.5, "charge"), 4.966310265004573);
});
test("doubling either R or C slows charging at the same actual time", () => {
  const base = circuit(10, 10, 5);
  for (const slower of [circuit(20, 10, 5), circuit(10, 20, 5)]) {
    near(slower.tauSeconds, 2 * base.tauSeconds);
    near(voltageAt(slower, 0.1, "charge"), 1.9673467014368329);
    assert.ok(voltageAt(slower, 0.1, "charge") < voltageAt(base, 0.1, "charge"));
  }
});
test("sampled curves are bounded, monotonic and complementary", () => {
  const model = circuit(1, 100, 12);
  const charge = sampleCurve(model, "charge", 0.5);
  const discharge = sampleCurve(model, "discharge", 0.5);
  assert.equal(charge.length, 151);
  near(charge[0].timeSeconds, 0);
  near(charge.at(-1).timeSeconds, 0.5);
  for (let index = 0; index < charge.length; index++) {
    near(charge[index].voltage + discharge[index].voltage, 12);
    assert.ok(charge[index].voltage >= 0 && charge[index].voltage <= 12);
    if (index) {
      assert.ok(charge[index].voltage >= charge[index - 1].voltage);
      assert.ok(discharge[index].voltage <= discharge[index - 1].voltage);
    }
  }
});
test("zero volts stays flat; supported extremes remain finite", () => {
  assert.ok(sampleCurve(circuit(10, 10, 0), "charge", 0.5).every(point => point.voltage === 0));
  for (const model of [circuit(0.1, 0.1, 24), circuit(1000, 1000, 24)]) {
    assert.ok(sampleCurve(model, "discharge", 5 * model.tauSeconds).every(point => Number.isFinite(point.voltage)));
  }
});
test("a long observation window still samples the fast initial transient", () => {
  const model = circuit(0.1, 0.1, 5);
  const points = sampleCurve(model, "charge", 5000);
  assert.ok(points[1].timeSeconds < model.tauSeconds);
  assert.ok(points[1].voltage > 0 && points[1].voltage < 5 * (1 - Math.exp(-1)));
  near(points.at(-1).timeSeconds, 5000);
  near(points.at(-1).voltage, 5);
  for (let index = 1; index < points.length; index++) assert.ok(points[index].timeSeconds > points[index - 1].timeSeconds);
});
test("invalid parameters, time, mode and sample counts are rejected", () => {
  for (const args of [[0, 10, 5], [10, -1, 5], [10, 10, 25], [NaN, 10, 5], [10, Infinity, 5]]) {
    assert.throws(() => circuit(...args), RangeError);
  }
  const model = circuit(10, 10, 5);
  assert.throws(() => voltageAt(model, -1, "charge"), RangeError);
  assert.throws(() => voltageAt(model, 1, "other"), RangeError);
  for (const window of [0, Infinity, 5001]) assert.throws(() => sampleCurve(model, "charge", window), RangeError);
  for (const count of [1, 2.5, 2001]) assert.throws(() => sampleCurve(model, "charge", 0.5, count), RangeError);
});

(function (root) {
  "use strict";

  function inRange(value, low, high, name) {
    if (!Number.isFinite(value) || value < low || value > high) {
      throw new RangeError(`${name}需在 ${low}–${high} 之间。`);
    }
  }

  function circuit(resistanceKohm, capacitanceUf, voltage) {
    inRange(resistanceKohm, 0.1, 1000, "电阻（kΩ）");
    inRange(capacitanceUf, 0.1, 1000, "电容（µF）");
    inRange(voltage, 0, 24, "电压（V）");
    const resistanceOhms = resistanceKohm * 1000;
    const capacitanceFarads = capacitanceUf * 1e-6;
    return { resistanceOhms, capacitanceFarads, voltage,
      tauSeconds: resistanceOhms * capacitanceFarads };
  }

  function voltageAt(model, timeSeconds, mode) {
    if (!Number.isFinite(timeSeconds) || timeSeconds < 0) throw new RangeError("时间需为非负数。");
    if (!["charge", "discharge"].includes(mode)) throw new RangeError("未知的充放电模式。");
    const remaining = Math.exp(-timeSeconds / model.tauSeconds);
    return model.voltage * (mode === "charge" ? 1 - remaining : remaining);
  }

  function sampleCurve(model, mode, windowSeconds, count = 151) {
    inRange(windowSeconds, 0.000001, 5000, "观察时长（秒）");
    if (!Number.isInteger(count) || count < 2 || count > 2000) throw new RangeError("采样点数需为 2–2000 的整数。");
    // A long window still needs enough samples in the short transient near t = 0.
    const earlyWindow = count < 3 ? windowSeconds : Math.min(windowSeconds, 10 * model.tauSeconds);
    const earlySteps = earlyWindow === windowSeconds ? count - 1 : Math.floor((count - 1) * 0.75);
    return Array.from({ length: count }, (_, index) => {
      const timeSeconds = index <= earlySteps ? earlyWindow * index / earlySteps :
        earlyWindow + (windowSeconds - earlyWindow) * (index - earlySteps) / (count - 1 - earlySteps);
      return { timeSeconds, voltage: voltageAt(model, timeSeconds, mode) };
    });
  }

  const api = { circuit, voltageAt, sampleCurve };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RCModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

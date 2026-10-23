"use strict";
const { circuit, voltageAt, sampleCurve } = RCModel;
const byId = id => document.getElementById(id);
const ns = "http://www.w3.org/2000/svg";
const plot = byId("plot");
let mode = "charge";
let model = circuit(10, 10, 5);
let windowSeconds = 0.5;
let reference = null;

function number(value) { return Number(value.toPrecision(4)).toString(); }
function time(value) {
  if (value === 0) return "0 s";
  if (value < 0.001) return `${number(value * 1e6)} µs`;
  if (value < 1) return `${number(value * 1000)} ms`;
  return `${number(value)} s`;
}
function svg(tag, attributes = {}, text) {
  const element = document.createElementNS(ns, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (text !== undefined) element.textContent = text;
  return element;
}
function describe(curve, curveMode) {
  return `${curveMode === "charge" ? "充电" : "放电"} · R ${number(curve.resistanceOhms / 1000)} kΩ · C ${number(curve.capacitanceFarads * 1e6)} µF · V ${number(curve.voltage)} V · τ ${time(curve.tauSeconds)}`;
}

function draw() {
  const width = Math.max(240, plot.clientWidth || 860);
  const height = width < 420 ? 300 : 360;
  const left = 52, top = 30, right = 24, bottom = 52;
  plot.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const maxVoltage = Math.max(model.voltage, reference ? reference.model.voltage : 0) || 1;
  const x = seconds => left + seconds / windowSeconds * (width - left - right);
  const y = volts => height - bottom - volts / maxVoltage * (height - top - bottom);
  const timeScale = windowSeconds < 0.001 ? 1e6 : windowSeconds < 1 ? 1000 : 1;
  const unit = timeScale === 1e6 ? "µs" : timeScale === 1000 ? "ms" : "s";
  plot.replaceChildren(svg("title", { id: "plot-description" }, `${mode === "charge" ? "充电" : "放电"}曲线${reference ? "与保留的对照曲线" : ""}，时间 0 至 ${time(windowSeconds)}，电压 0 至 ${number(maxVoltage)} V`));
  for (let index = 0; index <= 5; index++) {
    const seconds = windowSeconds * index / 5, volts = maxVoltage * index / 5;
    plot.append(svg("line", { x1: x(seconds), x2: x(seconds), y1: top, y2: y(0), class: "plot-grid" }),
      svg("text", { x: x(seconds), y: height - 28, "text-anchor": "middle", class: "plot-text" }, number(seconds * timeScale)),
      svg("line", { x1: left, x2: width - right, y1: y(volts), y2: y(volts), class: "plot-grid" }),
      svg("text", { x: left - 10, y: y(volts) + 4, "text-anchor": "end", class: "plot-text" }, number(volts)));
  }
  plot.append(svg("path", { d: `M${left},${top}V${y(0)}H${width - right}`, class: "plot-axis" }),
    svg("text", { x: left, y: 16, class: "plot-text" }, "V_C (V)"),
    svg("text", { x: width - right, y: height - 4, "text-anchor": "end", class: "plot-text" }, `t (${unit})`));
  if (model.tauSeconds <= windowSeconds) {
    plot.append(svg("line", { id: "tau-line", x1: x(model.tauSeconds), x2: x(model.tauSeconds), y1: top, y2: y(0), class: "tau-marker" }),
      svg("text", { x: Math.min(x(model.tauSeconds) + 6, width - right - 20), y: top + 14, class: "plot-text" }, "1τ"));
  }
  const curvePath = (curve, curveMode) => sampleCurve(curve, curveMode, windowSeconds)
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.timeSeconds)},${y(point.voltage)}`).join(" ");
  if (reference) plot.append(svg("path", { id: "reference-response", d: curvePath(reference.model, reference.mode), class: "reference-line" }));
  plot.append(svg("path", { id: "response", d: curvePath(model, mode), class: "response-line" }));
  const selectedTime = windowSeconds * Number(byId("cursor").value) / 1000;
  const selectedVoltage = voltageAt(model, selectedTime, mode);
  plot.append(svg("line", { x1: x(selectedTime), x2: x(selectedTime), y1: top, y2: y(0), class: "cursor-marker" }),
    svg("circle", { id: "selected-point", cx: x(selectedTime), cy: y(selectedVoltage), r: 5, class: "cursor-dot" }));
  byId("readout").textContent = `t = ${time(selectedTime)} · V_C = ${number(selectedVoltage)} V`;
  const referenceReadout = byId("reference-readout");
  referenceReadout.hidden = !reference;
  referenceReadout.textContent = "";
  if (reference) {
    const referenceVoltage = voltageAt(reference.model, selectedTime, reference.mode);
    plot.append(svg("circle", { id: "reference-point", cx: x(selectedTime), cy: y(referenceVoltage), r: 4, class: "reference-dot" }));
    referenceReadout.textContent = `同一时刻，对照 V_C = ${number(referenceVoltage)} V`;
  }
  byId("cursor").setAttribute("aria-valuetext", [byId("readout").textContent, referenceReadout.textContent].filter(Boolean).join("；"));
  byId("current-description").textContent = `当前（实线）· ${describe(model, mode)}`;
  byId("reference-description").hidden = !reference;
  byId("reference-description").textContent = reference ? `对照（虚线）· ${describe(reference.model, reference.mode)}` : "";
  byId("clear-reference").disabled = !reference;
  byId("capture").textContent = reference ? "用当前曲线替换对照" : "保留当前曲线作对照";
  byId("tau").textContent = time(model.tauSeconds);
  byId("at-tau").textContent = `${number(voltageAt(model, model.tauSeconds, mode))} V`;
  byId("at-five").textContent = `${number(voltageAt(model, 5 * model.tauSeconds, mode))} V`;
  byId("window-label").textContent = time(windowSeconds);
  byId("r-label").textContent = `R = ${number(model.resistanceOhms / 1000)} kΩ`;
  byId("c-label").textContent = `C = ${number(model.capacitanceFarads * 1e6)} µF`;
  byId("source-label").textContent = mode === "charge" ? `${number(model.voltage)} V` : "电源断开";
  byId("source").toggleAttribute("hidden", mode === "discharge");
  byId("bypass").toggleAttribute("hidden", mode === "charge");
  byId("initial-condition").textContent = mode === "charge" ?
    "初始电容电压为 0 V；t = 0 时接通所选电压的电源。" :
    `初始电容电压为 ${number(model.voltage)} V；t = 0 时断开电源，经电阻放电。`;
  byId("formula").textContent = mode === "charge" ? "V_C(t) = V × (1 − e^(−t/RC))" : "V_C(t) = V × e^(−t/RC)";
  for (const name of ["charge", "discharge"]) byId(name).setAttribute("aria-pressed", name === mode);
}

function update(fit = false) {
  try {
    const hints = { resistance: "电阻需为 0.1–1000 kΩ。", capacitance: "电容需为 0.1–1000 µF。",
      voltage: "电压需为 0–24 V。", window: "观察时长需为 0.001–5000000 ms。" };
    for (const id of ["resistance", "capacitance", "voltage", ...(fit ? [] : ["window"])]) {
      if (!byId(id).checkValidity()) throw new RangeError(hints[id]);
    }
    const nextModel = circuit(Number(byId("resistance").value), Number(byId("capacitance").value), Number(byId("voltage").value));
    const nextWindow = fit ? 5 * nextModel.tauSeconds : Number(byId("window").value) / 1000;
    sampleCurve(nextModel, mode, nextWindow);
    model = nextModel;
    windowSeconds = nextWindow;
    if (fit) byId("window").value = String(windowSeconds * 1000);
    byId("error").textContent = "";
    draw();
    return true;
  } catch (error) {
    byId("error").textContent = `${error.message} 曲线保留上次有效参数。`;
    return false;
  }
}

function plotImage() {
  const chart = plot.cloneNode(true);
  const original = plot.querySelectorAll("*");
  const copied = chart.querySelectorAll("*");
  const properties = ["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap",
    "stroke-linejoin", "font-family", "font-size", "font-weight", "opacity"];
  // Standalone SVG files cannot rely on this page's external stylesheet.
  original.forEach((element, index) => {
    const style = getComputedStyle(element);
    for (const property of properties) copied[index].setAttribute(property, style.getPropertyValue(property));
  });
  chart.removeAttribute("id");
  const bounds = plot.viewBox.baseVal;
  const width = Math.max(320, bounds.width);
  const chartHeight = bounds.height * width / bounds.width;
  const selectedTime = windowSeconds * Number(byId("cursor").value) / 1000;
  const image = svg("svg", { xmlns: ns, role: "img", "aria-labelledby": "export-title",
    "font-family": getComputedStyle(document.body).fontFamily, "font-size": 12, fill: "#293d49" });
  image.append(svg("title", { id: "export-title" }, "RC Step View · 理想 RC 响应"),
    svg("desc", {}, [describe(model, mode), reference ? describe(reference.model, reference.mode) : "",
      `t = ${time(selectedTime)}, window = ${time(windowSeconds)}`].filter(Boolean).join("; ")),
    svg("rect", { width: "100%", height: "100%", fill: "white" }));
  let row = 28;
  const text = (value, x = 16, attributes = {}) => {
    image.append(svg("text", { x, y: row, ...attributes }, value));
    row += 20;
  };
  text("RC Step View · 理想 RC 响应", 16, { "font-size": 16, "font-weight": 600 });
  text(`t = ${time(selectedTime)} · window = ${time(windowSeconds)}`);
  const legend = (label, curve, curveMode, pathId, dashed) => {
    const color = getComputedStyle(byId(pathId)).stroke;
    image.append(svg("line", { x1: 16, x2: 36, y1: row - 4, y2: row - 4, stroke: color,
      "stroke-width": 2.5, "stroke-dasharray": dashed ? "7 5" : "none" }));
    text(`${label} · ${curveMode === "charge" ? "充电 / Charge" : "放电 / Discharge"}`, 44);
    text(`R ${number(curve.resistanceOhms / 1000)} kΩ · C ${number(curve.capacitanceFarads * 1e6)} µF · V ${number(curve.voltage)} V`);
    text(`τ ${time(curve.tauSeconds)} · V_C(t) ${number(voltageAt(curve, selectedTime, curveMode))} V`);
  };
  legend("当前 / Current", model, mode, "response", false);
  if (reference) legend("对照 / Reference", reference.model, reference.mode, "reference-response", true);
  chart.setAttribute("x", 0);
  chart.setAttribute("y", row + 8);
  chart.setAttribute("width", width);
  chart.setAttribute("height", chartHeight);
  image.append(chart);
  row += chartHeight + 28;
  text("Ideal single RC · calculated, not measured", 16, { "font-size": 11 });
  image.setAttribute("viewBox", `0 0 ${width} ${row}`);
  image.setAttribute("width", width);
  image.setAttribute("height", row);
  return new XMLSerializer().serializeToString(image);
}

byId("parameters").addEventListener("submit", event => { event.preventDefault(); update(); });
for (const id of ["resistance", "capacitance", "voltage", "window"]) byId(id).addEventListener("input", () => update());
byId("fit").addEventListener("click", () => update(true));
byId("capture").addEventListener("click", () => {
  if (!update()) return;
  // Copy the valid circuit and mode; both curves use the live observation window.
  reference = { model: { ...model }, mode };
  draw();
});
byId("clear-reference").addEventListener("click", () => { reference = null; draw(); });
byId("save-svg").addEventListener("click", () => {
  if (!update()) return;
  const url = URL.createObjectURL(new Blob([plotImage()], { type: "image/svg+xml;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `rc-response-${mode}${reference ? "-comparison" : ""}.svg`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
byId("load-example").addEventListener("click", () => {
  const values = { resistance: "10", capacitance: "22", voltage: "5", window: "500", cursor: "200" };
  for (const [id, value] of Object.entries(values)) byId(id).value = value;
  mode = "charge";
  reference = { model: circuit(10, 10, 5), mode: "charge" };
  update();
});
byId("cursor").addEventListener("input", draw);
for (const name of ["charge", "discharge"]) byId(name).addEventListener("click", () => { mode = name; draw(); });
window.addEventListener("resize", draw);
draw();

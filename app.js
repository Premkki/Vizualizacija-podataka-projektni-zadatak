const dimensionDefinitions = {
  primaryGenre: "Primarni zanr",
  type: "Tip aplikacije"
};

const metricDefinitions = {
  releaseCount: {
    label: "Broj izdanih aplikacija (tis.)",
    accessor: (stats) => stats.count,
    format: (value) => formatInteger(value)
  },
  freeShare: {
    label: "Udio free-to-play izdanja (%)",
    accessor: (stats) => stats.count ? stats.freeCount / stats.count : 0,
    format: (value) => `${(value * 100).toFixed(1)}%`
  },
  avgPrice: {
    label: "Prosjecna cijena (USD)",
    accessor: (stats) => stats.priceN ? stats.priceSum / stats.priceN : 0,
    format: (value) => `$${value.toFixed(2)}`
  },
  avgRecommendations: {
    label: "Prosjecan broj preporuka (tis.)",
    accessor: (stats) => stats.recommendationsN ? stats.recommendationsSum / stats.recommendationsN : 0,
    format: (value) => formatInteger(Math.round(value))
  },
  avgMetacritic: {
    label: "Prosjecan Metacritic",
    accessor: (stats) => stats.metacriticN ? stats.metacriticSum / stats.metacriticN : 0,
    format: (value) => value.toFixed(1)
  },
  avgAchievements: {
    label: "Prosjecan broj achievementa",
    accessor: (stats) => stats.achievementsN ? stats.achievementsSum / stats.achievementsN : 0,
    format: (value) => value.toFixed(1)
  },
  avgDiscount: {
    label: "Prosjecan popust (%)",
    accessor: (stats) => stats.discountN ? stats.discountSum / stats.discountN : 0,
    format: (value) => `${value.toFixed(1)}%`
  }
};

const scatterMetrics = {
  year: { label: "Godina izlaska", scale: "linear", domainMode: "year", format: (value) => value },
  price: {
    label: "Cijena (USD)",
    scale: "symlog",
    domainMode: "positiveMax",
    tickValues: [0.5, 1, 2, 5, 10, 20, 50, 100, 500, 1000, 5000, 10000, 50000],
    format: (value) => value == null ? "n/a" : `$${value.toFixed(2)}`
  },
  recommendations: {
    label: "Broj preporuka (tis.)",
    scale: "symlog",
    domainMode: "positiveMax",
    tickValues: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 2000000],
    format: (value) => value == null ? "n/a" : formatInteger(value)
  },
  metacritic: {
    label: "Metacritic",
    scale: "linear",
    domainMode: "boundedExtent",
    pad: [2, 2],
    minLimit: 0,
    maxLimit: 100,
    format: (value) => value == null ? "n/a" : value.toFixed(1)
  },
  achievements: {
    label: "Achievementi",
    scale: "symlog",
    domainMode: "zeroMax",
    tickValues: [0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000],
    format: (value) => value == null ? "n/a" : formatInteger(value)
  },
  discount: {
    label: "Popust (%)",
    scale: "linear",
    domainMode: "fixed",
    domain: [0, 100],
    tickValues: [0, 25, 50, 75, 100],
    format: (value) => value == null ? "n/a" : `${value.toFixed(1)}%`
  },
  platformCount: {
    label: "Broj podrzanih platformi",
    scale: "linear",
    domainMode: "fixed",
    domain: [1, 3],
    tickValues: [1, 2, 3],
    format: (value) => value == null ? "n/a" : value
  }
};

const businessModelLabels = {
  free: "Free",
  paid: "Paid"
};

const defaultCompareSelections = {
  primaryGenre: [],
  type: []
};

const colorSets = {
  primaryGenre: ["#b55d3d", "#3d8b6d", "#5d63c6", "#cf8f2e", "#8d4ec9", "#2f7cb9", "#c45d8e", "#6f9341", "#b07a2d", "#6d7ea8", "#707070"],
  type: ["#3d8b6d", "#b55d3d", "#5d63c6", "#cf8f2e", "#8d4ec9", "#6f9341", "#707070"]
};

const dimensions = {
  bar: { width: 640, height: 420, margin: { top: 24, right: 20, bottom: 72, left: 92 } },
  mix: { width: 640, height: 420, margin: { top: 24, right: 20, bottom: 72, left: 92 } },
  comparison: { width: 640, height: 420, margin: { top: 24, right: 20, bottom: 72, left: 72 } },
  scatter: { width: 640, height: 420, margin: { top: 24, right: 24, bottom: 72, left: 72 } }
};

const state = {
  data: null,
  dimension: "primaryGenre",
  metric: "releaseCount",
  sortOrder: "desc",
  selectedCategories: new Set(),
  compareCategories: new Set(defaultCompareSelections.primaryGenre),
  yearStart: null,
  yearEnd: null,
  yearTargetEnd: null,
  animationYear: null,
  shareView: "free",
  scatterX: "price",
  scatterY: "recommendations"
};

let animationTimer = null;
let transitionOverrideDuration = null;

const tooltip = d3.select("#tooltip");
const kpiGrid = d3.select("#kpi-grid");
const statusMessage = d3.select("#status-message");
const mixLegend = d3.select("#mix-legend");
const comparisonLegend = d3.select("#comparison-legend");
const scatterLegend = d3.select("#scatter-legend");
const comparisonNote = d3.select("#comparison-note");
const scatterNote = d3.select("#scatter-note");

const barSvg = setupSvg("#bar-chart", dimensions.bar);
const mixSvg = setupSvg("#engagement-chart", dimensions.mix);
const comparisonSvg = setupSvg("#comparison-chart", dimensions.comparison);
const scatterSvg = setupSvg("#scatter-chart", dimensions.scatter);

initializeControls();
loadData();

function setupSvg(selector, config) {
  const svg = d3.select(selector)
    .attr("viewBox", `0 0 ${config.width} ${config.height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const chartWidth = config.width - config.margin.left - config.margin.right;
  const chartHeight = config.height - config.margin.top - config.margin.bottom;

  const root = svg.append("g")
    .attr("transform", `translate(${config.margin.left},${config.margin.top})`);

  root.append("g").attr("class", "grid x-grid");
  root.append("g").attr("class", "grid y-grid");
  root.append("g").attr("class", "plot");
  root.append("g").attr("class", "axis x-axis").attr("transform", `translate(0,${chartHeight})`);
  root.append("g").attr("class", "axis y-axis");
  root.append("text")
    .attr("class", "axis-label x-label")
    .attr("x", chartWidth / 2)
    .attr("y", chartHeight + 56)
    .attr("text-anchor", "middle");
  root.append("text")
    .attr("class", "axis-label y-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -chartHeight / 2)
    .attr("y", -58)
    .attr("text-anchor", "middle");

  return { svg, root, chartWidth, chartHeight };
}

function renderHeaderLegend(container, items) {
  const chips = container.selectAll(".legend-chip")
    .data(items, (d) => d.label)
    .join(
      (enter) => {
        const chip = enter.append("span").attr("class", "legend-chip");
        chip.append("span").attr("class", "legend-marker");
        chip.append("span").attr("class", "legend-chip-label");
        return chip;
      },
      (update) => update,
      (exit) => exit.remove()
    );

  chips.select(".legend-marker")
    .attr("class", (d) => `legend-marker ${d.shape === "circle" ? "circle" : ""}`.trim())
    .style("background", (d) => d.color);

  chips.select(".legend-chip-label").text((d) => d.label);
}

function initializeControls() {
  populateSelect("#group-by", dimensionDefinitions, state.dimension);
  populateSelect("#metric", objectMap(metricDefinitions, (value) => value.label), state.metric);
  populateSelect("#scatter-x", objectMap(scatterMetrics, (value) => value.label), state.scatterX);
  populateSelect("#scatter-y", objectMap(scatterMetrics, (value) => value.label), state.scatterY);

  d3.select("#group-by").on("change", (event) => {
    stopAnimationIfRunning();
    state.dimension = event.target.value;
    state.selectedCategories.clear();
    state.compareCategories = new Set(defaultCompareSelections[state.dimension]);
    syncCompareOptions();
    updateDashboard();
  });

  d3.select("#metric").on("change", (event) => {
    stopAnimationIfRunning();
    state.metric = event.target.value;
    updateDashboard();
  });

  d3.select("#sort-order").on("change", (event) => {
    stopAnimationIfRunning();
    state.sortOrder = event.target.value;
    updateDashboard();
  });

  d3.select("#scatter-x").on("change", (event) => {
    stopAnimationIfRunning();
    state.scatterX = event.target.value;
    updateDashboard();
  });

  d3.select("#scatter-y").on("change", (event) => {
    stopAnimationIfRunning();
    state.scatterY = event.target.value;
    updateDashboard();
  });

  d3.selectAll("#share-view-toggle .share-option").on("click", function() {
    const nextView = this.dataset.shareView;
    if (nextView === state.shareView) {
      return;
    }
    state.shareView = nextView;
    syncShareToggle();
    updateDashboard();
  });

  d3.select("#year-start").on("change", (event) => {
    stopAnimationIfRunning();
    state.yearStart = event.target.value;
    state.animationYear = null;
    if (+state.yearStart > +state.yearEnd) {
      state.yearEnd = state.yearStart;
      state.yearTargetEnd = state.yearStart;
    }
    runWithoutTransitions(() => updateDashboard());
  });

  d3.select("#year-end").on("change", (event) => {
    stopAnimationIfRunning();
    state.yearEnd = event.target.value;
    state.yearTargetEnd = event.target.value;
    state.animationYear = null;
    if (+state.yearEnd < +state.yearStart) {
      state.yearStart = state.yearEnd;
    }
    runWithoutTransitions(() => updateDashboard());
  });

  d3.select("#play-toggle").on("click", () => {
    if (animationTimer) {
      stopAnimation();
    } else {
      startAnimation();
    }
  });

  d3.select("#reset-filters").on("click", () => {
    stopAnimation();
    state.dimension = "primaryGenre";
    state.metric = "releaseCount";
    state.sortOrder = "desc";
    state.selectedCategories.clear();
    state.compareCategories = new Set(defaultCompareSelections.primaryGenre);
    state.yearStart = String(state.data.years[0]);
    state.yearEnd = String(state.data.years.at(-1));
    state.yearTargetEnd = state.yearEnd;
    state.animationYear = null;
    state.shareView = "free";
    state.scatterX = "price";
    state.scatterY = "recommendations";
    syncControls();
    updateDashboard();
  });

  d3.select("#compare-genres")
    .on("click", (event) => {
      const trigger = event.target.closest(".compare-option");
      if (!trigger) {
        return;
      }
      toggleCompareCategory(trigger.dataset.category);
    })
    .on("keydown", (event) => {
      const trigger = event.target.closest(".compare-option");
      if (!trigger || (event.key !== "Enter" && event.key !== " ")) {
        return;
      }
      event.preventDefault();
      toggleCompareCategory(trigger.dataset.category);
    });
}

async function loadData() {
  setStatus("Ucitavanje Steam podataka...");
  try {
    const response = await fetch("steam_dashboard_data.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Neuspjelo ucitavanje obradene datoteke (${response.status})`);
    }

    const rawData = await response.json();
    state.data = preprocessData(rawData);
    state.yearStart = String(state.data.years[0]);
    state.yearEnd = String(state.data.years.at(-1));
    state.yearTargetEnd = state.yearEnd;
    state.animationYear = null;

    populateYearOptions();
    syncCompareOptions();
    syncControls();
    updateDashboard();
    setStatus("");
  } catch (error) {
    console.error("Steam dashboard load failed:", error);
    setStatus("Podatci se nisu uspjeli ucitati. Pokreni stranicu kroz lokalni server i provjeri da je steam_dashboard_data.json dostupan.", true);
  }
}

function preprocessData(rawData) {
  const dimensionsIndexed = {};
  Object.entries(rawData.dimensions).forEach(([dimensionKey, bundle]) => {
    const totals = bundle.totals.map((entry) => ({
      category: entry.category,
      models: normaliseModels(entry.models)
    }));

    const yearly = bundle.yearly.map((entry) => ({
      year: entry.year,
      category: entry.category,
      models: normaliseModels(entry.models)
    }));

    const yearlyIndex = new Map();
    yearly.forEach((entry) => {
      if (!yearlyIndex.has(entry.year)) {
        yearlyIndex.set(entry.year, new Map());
      }
      yearlyIndex.get(entry.year).set(entry.category, entry.models);
    });

    dimensionsIndexed[dimensionKey] = {
      categories: bundle.categories,
      totals,
      yearly,
      yearlyIndex
    };
  });

  rawData.sampleApps = rawData.sampleApps.map((app) => ({
    ...app,
    model: app.isFree ? "free" : "paid"
  }));

  rawData.dimensions = dimensionsIndexed;
  return rawData;
}

function normaliseModels(models) {
  const copy = {};
  Object.entries(models).forEach(([model, stats]) => {
    copy[model] = {
      count: +stats.count,
      priceSum: +stats.priceSum,
      priceN: +stats.priceN,
      recommendationsSum: +stats.recommendationsSum,
      recommendationsN: +stats.recommendationsN,
      metacriticSum: +stats.metacriticSum,
      metacriticN: +stats.metacriticN,
      achievementsSum: +stats.achievementsSum,
      achievementsN: +stats.achievementsN,
      discountSum: +stats.discountSum,
      discountN: +stats.discountN,
      freeCount: model === "free" ? +stats.count : 0,
      paidCount: model === "paid" ? +stats.count : 0
    };
  });

  copy.all.freeCount = copy.free.count;
  copy.all.paidCount = copy.paid.count;
  return copy;
}

function populateYearOptions() {
  const startOptions = Object.fromEntries(state.data.years.map((year) => [String(year), String(year)]));
  const endOptions = Object.fromEntries(state.data.years.map((year) => [String(year), String(year)]));
  populateSelect("#year-start", startOptions, state.yearStart);
  populateSelect("#year-end", endOptions, state.yearEnd);
}

function syncCompareOptions() {
  if (!state.data) {
    return;
  }

  const categories = state.data.dimensions[state.dimension].categories;
  const compareList = d3.select("#compare-genres");
  compareList.selectAll(".compare-option")
    .data(categories, (d) => d)
    .join(
      (enter) => enter.append("button")
        .attr("type", "button")
        .attr("class", "compare-option")
        .attr("role", "option"),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr("data-category", (d) => d)
    .classed("is-selected", (d) => state.compareCategories.has(d))
    .attr("aria-selected", (d) => state.compareCategories.has(d) ? "true" : "false")
    .text((d) => d);
}

function syncControls() {
  d3.select("#group-by").property("value", state.dimension);
  d3.select("#metric").property("value", state.metric);
  d3.select("#sort-order").property("value", state.sortOrder);
  d3.select("#scatter-x").property("value", state.scatterX);
  d3.select("#scatter-y").property("value", state.scatterY);
  d3.select("#year-start").property("value", state.yearStart);
  d3.select("#year-end").property("value", state.yearEnd);
  syncShareToggle();
  syncCompareOptions();
  updatePlayToggle();
}

function updateDashboard() {
  if (!state.data) {
    return;
  }

  syncControls();

  const snapshotRows = getSnapshotRows();
  const filteredSnapshotRows = getCategoryFilteredRows(snapshotRows);
  const lineSeries = getComparisonSeries();
  const samplePoints = getScatterPoints();

  updateKpis(filteredSnapshotRows);
  updateBarChart(snapshotRows);
  updateMixChart(filteredSnapshotRows);
  updateComparisonChart(lineSeries);
  updateScatterChart(samplePoints);
}

function getSnapshotRows() {
  const bundle = state.data.dimensions[state.dimension];
  const startYear = getEffectiveYearStart();
  const targetYear = getEffectiveYearEnd();
  const accumulator = new Map();

  state.data.years
    .filter((year) => year >= startYear && year <= targetYear)
    .forEach((year) => {
      const yearMap = bundle.yearlyIndex.get(year);
      if (!yearMap) {
        return;
      }
      yearMap.forEach((models, category) => {
        if (!accumulator.has(category)) {
          accumulator.set(category, zeroStats());
        }
        sumInto(accumulator.get(category), combineSelectedModels(models));
      });
    });

  const rows = bundle.categories.map((category) => ({
    category,
    stats: accumulator.get(category) || zeroStats(),
    value: metricDefinitions[state.metric].accessor(accumulator.get(category) || zeroStats())
  }));

  return sortSnapshotRows(rows);
}

function getCategoryFilteredRows(rows) {
  if (state.selectedCategories.size > 0) {
    return rows.filter((row) => state.selectedCategories.has(row.category));
  }
  if (state.compareCategories.size > 0) {
    return rows.filter((row) => state.compareCategories.has(row.category));
  }
  return [];
}

function getComparisonSeries() {
  const bundle = state.data.dimensions[state.dimension];
  const activeCategories = Array.from(state.compareCategories);
  const yearsInRange = getVisibleYears();

  return activeCategories.map((category) => ({
    category,
    values: yearsInRange.map((year) => {
      const yearMap = bundle.yearlyIndex.get(year);
      const models = yearMap?.get(category);
      const stats = models ? combineSelectedModels(models) : zeroStats();
      return {
        year,
        value: metricDefinitions[state.metric].accessor(stats),
        stats
      };
    })
  }));
}

function getScatterPoints() {
  const targetYear = getEffectiveYearEnd();
  const startYear = getEffectiveYearStart();
  const compareCategories = state.compareCategories;

  const filtered = state.data.sampleApps.filter((app) => {
    const yearPass = app.year >= startYear && app.year <= targetYear;
    const categoryPass = compareCategories.size > 0 && compareCategories.has(app[state.dimension]);
    return yearPass && categoryPass;
  });

  if (filtered.length <= 3200) {
    return filtered;
  }

  const step = Math.ceil(filtered.length / 3200);
  return filtered.filter((_, index) => index % step === 0);
}

function updateKpis(rows) {
  const duration = getTransitionDuration();
  if (rows.length === 0) {
    kpiGrid.selectAll(".kpi-card")
      .data([])
      .join(
        (enter) => enter,
        (update) => update,
        (exit) => exit.transition().duration(250).style("opacity", 0).remove()
      );
    return;
  }

  const summaryStats = rows.reduce((acc, row) => {
    sumInto(acc, row.stats);
    return acc;
  }, zeroStats());

  const summary = [
    {
      label: "Aplikacije u fokusu",
      value: formatInteger(summaryStats.count)
    },
    {
      label: "Udio free-to-play naslova",
      value: `${(summaryStats.count ? (summaryStats.freeCount / summaryStats.count) * 100 : 0).toFixed(1)}%`
    },
    {
      label: "Prosjecna cijena",
      value: summaryStats.priceN ? `$${(summaryStats.priceSum / summaryStats.priceN).toFixed(2)}` : "n/a"
    },
    {
      label: "Prosjecne preporuke",
      value: summaryStats.recommendationsN ? formatInteger(Math.round(summaryStats.recommendationsSum / summaryStats.recommendationsN)) : "n/a"
    }
  ];

  const cards = kpiGrid.selectAll(".kpi-card")
    .data(summary, (d) => d.label)
    .join(
      (enter) => {
        const card = enter.append("article")
          .attr("class", "kpi-card")
          .style("opacity", 0)
          .style("transform", "translateY(12px)");
        card.append("p");
        card.append("strong");
        return card;
      },
      (update) => update,
      (exit) => exit.transition().duration(250).style("opacity", 0).remove()
    );

  cards.select("p").text((d) => d.label);
  cards.select("strong").text((d) => d.value);

  cards.transition()
    .duration(duration)
    .style("opacity", 1)
    .style("transform", "translateY(0px)");
}

function updateBarChart(rows) {
  const { root, chartWidth, chartHeight } = barSvg;
  const transition = createChartTransition();
  const x = d3.scaleBand().domain(rows.map((d) => d.category)).range([0, chartWidth]).padding(0.22);
  const maxValue = d3.max(rows, (d) => d.value) || 0;
  const y = d3.scaleLinear().domain([0, maxValue]).nice().range([chartHeight, 0]);

  root.select(".x-axis")
    .transition(transition)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-18)")
    .style("text-anchor", "end");

  root.select(".y-axis")
    .transition(transition)
    .call(d3.axisLeft(y).ticks(6).tickFormat(getAxisFormatter(state.metric)));

  root.select(".y-grid")
    .transition(transition)
    .call(d3.axisLeft(y).ticks(6).tickSize(-chartWidth).tickFormat(""));

  root.select(".x-grid").call((g) => g.selectAll("*").remove());
  root.select(".x-label").text(dimensionDefinitions[state.dimension]);
  root.select(".y-label").text(metricDefinitions[state.metric].label);

  const bars = root.select(".plot")
    .selectAll(".bar")
    .data(rows, (d) => d.category)
    .join(
      (enter) => enter.append("rect")
        .attr("class", "bar")
        .attr("x", (d) => x(d.category))
        .attr("width", x.bandwidth())
        .attr("y", chartHeight)
        .attr("height", 0)
        .attr("rx", 12)
        .attr("fill", (d) => getCategoryColor(d.category))
        .on("click", (_, d) => toggleCategory(d.category))
        .on("mousemove", (event, d) => showTooltip(event, buildBarTooltip(d))),
      (update) => update,
      (exit) => exit.transition(transition).attr("y", chartHeight).attr("height", 0).remove()
    );

  bars.classed("inactive", (d) => state.selectedCategories.size > 0 && !state.selectedCategories.has(d.category))
    .on("click", (_, d) => toggleCategory(d.category))
    .on("mouseleave", hideTooltip)
    .transition(transition)
    .attr("x", (d) => x(d.category))
    .attr("width", x.bandwidth())
    .attr("y", (d) => y(d.value))
    .attr("height", (d) => chartHeight - y(d.value))
    .attr("fill", (d) => state.selectedCategories.has(d.category) ? "#7b351b" : getCategoryColor(d.category));
}

function updateMixChart(rows) {
  const { root, chartWidth, chartHeight } = mixSvg;
  const transition = createChartTransition();
  const shareKey = state.shareView === "free" ? "Free" : "Paid";
  const shareColor = state.shareView === "free" ? "#3d8b6d" : "#cf8f2e";
  const prepared = rows.map((row) => {
    const total = row.stats.count || 1;
    const freeShare = row.stats.freeCount / total;
    const paidShare = row.stats.paidCount / total;
    return {
      ...row,
      Free: freeShare,
      Paid: paidShare,
      shareValue: state.shareView === "free" ? freeShare : paidShare
    };
  });

  const x = d3.scaleBand().domain(prepared.map((d) => d.category)).range([0, chartWidth]).padding(0.18);
  const yMax = 1;
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([chartHeight, 0]);

  root.select(".x-axis")
    .transition(transition)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-18)")
    .style("text-anchor", "end");

  root.select(".y-axis")
    .transition(transition)
    .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(".0%")));

  root.select(".y-grid")
    .transition(transition)
    .call(d3.axisLeft(y).ticks(6).tickSize(-chartWidth).tickFormat(""));

  root.select(".x-label").text(dimensionDefinitions[state.dimension]);
  root.select(".y-label").text(state.shareView === "free" ? "Udio free izdanja" : "Udio paid izdanja");

  root.select(".plot")
    .selectAll(".series")
    .data([])
    .join(
      (enter) => enter.append("g").attr("class", "series"),
      (update) => update,
      (exit) => exit.remove()
    );

  root.select(".plot")
    .selectAll(".segment")
    .data(prepared, (d) => d.category)
    .join(
      (enter) => enter.append("rect")
        .attr("class", "segment")
        .attr("x", (d) => x(d.category))
        .attr("width", x.bandwidth())
        .attr("y", chartHeight)
        .attr("height", 0)
        .attr("rx", 10)
        .on("mousemove", (event, d) => showTooltip(event, buildMixTooltip(d))),
      (update) => update,
      (exit) => exit.transition(transition).attr("y", chartHeight).attr("height", 0).remove()
    )
    .on("mouseleave", hideTooltip)
    .transition(transition)
    .attr("x", (d) => x(d.category))
    .attr("width", x.bandwidth())
    .attr("fill", shareColor)
    .attr("y", (d) => y(d.shareValue))
    .attr("height", (d) => chartHeight - y(d.shareValue));

  renderHeaderLegend(mixLegend, [{ label: shareKey, color: shareColor }]);
}

function updateComparisonChart(seriesData) {
  const { root, chartWidth, chartHeight } = comparisonSvg;
  const transition = createChartTransition();
  const visibleYears = getVisibleYears();
  const x = d3.scalePoint().domain(visibleYears).range([0, chartWidth]).padding(0.25);
  const maxValue = d3.max(seriesData.flatMap((series) => series.values.map((d) => d.value))) || 0;
  const y = d3.scaleLinear().domain([0, maxValue]).nice().range([chartHeight, 0]);
  const line = d3.line()
    .x((d) => x(d.year))
    .y((d) => y(d.value))
    .curve(d3.curveMonotoneX);

  root.select(".x-axis")
    .transition(transition)
    .call(d3.axisBottom(x).tickValues(getYearTicks()));

  root.select(".y-axis")
    .transition(transition)
    .call(d3.axisLeft(y).ticks(6).tickFormat(getAxisFormatter(state.metric)));

  root.select(".y-grid")
    .transition(transition)
    .call(d3.axisLeft(y).ticks(6).tickSize(-chartWidth).tickFormat(""));

  root.select(".x-label").text("Godina izlaska");
  const metricLabel = metricDefinitions[state.metric].label;
  root.select(".y-label").text(metricLabel);

  const activeBandData = [getEffectiveYearEnd()];
  root.select(".plot")
    .selectAll(".focus-band")
    .data(activeBandData, (d) => d)
    .join(
      (enter) => enter.append("rect")
        .attr("class", "focus-band")
        .attr("x", (d) => (x(d) ?? 0) - 12)
        .attr("width", 24)
        .attr("y", 0)
        .attr("height", chartHeight)
        .style("opacity", 0),
      (update) => update,
      (exit) => exit.transition(transition).style("opacity", 0).remove()
    )
    .transition(transition)
    .attr("x", (d) => (x(d) ?? 0) - 12)
    .attr("height", chartHeight)
    .style("opacity", 1);

  const series = root.select(".plot")
    .selectAll(".series-wrap")
    .data(seriesData, (d) => d.category)
    .join(
      (enter) => {
        const g = enter.append("g").attr("class", "series-wrap");
        g.append("path").attr("class", "line-series").attr("fill", "none").attr("stroke-width", 3);
        g.append("g").attr("class", "point-layer");
        return g;
      },
      (update) => update,
      (exit) => exit.transition(transition).style("opacity", 0).remove()
    );

  series.select(".line-series")
    .classed("inactive", (d) => state.compareCategories.size > 0 && !state.compareCategories.has(d.category))
    .transition(transition)
    .attr("stroke", (d) => getCategoryColor(d.category))
    .attr("d", (d) => line(d.values));

  series.select(".point-layer")
    .selectAll(".compare-point")
    .data((d) => d.values.map((value) => ({ ...value, category: d.category })), (d) => `${d.category}-${d.year}`)
    .join(
      (enter) => enter.append("circle")
        .attr("class", "compare-point")
        .attr("cx", (d) => x(d.year))
        .attr("cy", chartHeight)
        .attr("r", 0)
        .attr("fill", (d) => getCategoryColor(d.category))
        .on("mousemove", (event, d) => showTooltip(event, `<strong>${d.category}</strong><br>Godina: ${d.year}<br>${metricDefinitions[state.metric].format(d.value)}`)),
      (update) => update,
      (exit) => exit.transition(transition).attr("r", 0).remove()
    )
    .on("mouseleave", hideTooltip)
    .transition(transition)
    .attr("cx", (d) => x(d.year))
    .attr("cy", (d) => y(d.value))
    .attr("r", (d) => d.year === getEffectiveYearEnd() ? 6 : 3.5);

  renderHeaderLegend(comparisonLegend, seriesData.map((d) => ({
    label: d.category,
    color: getCategoryColor(d.category)
  })));
  comparisonNote.text("");
}

function updateScatterChart(points) {
  const { root, chartWidth, chartHeight } = scatterSvg;
  const transition = createChartTransition();
  const xMetric = scatterMetrics[state.scatterX];
  const yMetric = scatterMetrics[state.scatterY];

  const xValues = points.map((d) => d[state.scatterX]).filter((value) => value != null);
  const yValues = points.map((d) => d[state.scatterY]).filter((value) => value != null);
  const sizeValues = points.map((d) => d.achievements).filter((value) => value != null);

  const x = buildNumericScale(xMetric, xValues, [0, chartWidth]);
  const y = buildNumericScale(yMetric, yValues, [chartHeight, 0]);
  const size = d3.scaleSqrt().domain(d3.extent(sizeValues.length ? sizeValues : [0, 100])).range([3, 10]);
  const xAxis = d3.axisBottom(x).tickFormat(getScatterAxisFormatter(state.scatterX));
  const yAxis = d3.axisLeft(y).tickFormat(getScatterAxisFormatter(state.scatterY));
  const xGridAxis = d3.axisBottom(x).tickSize(-chartHeight).tickFormat("");
  const yGridAxis = d3.axisLeft(y).tickSize(-chartWidth).tickFormat("");
  const xTickValues = getScatterTickValues(state.scatterX, x, "x", chartWidth);
  const yTickValues = getScatterTickValues(state.scatterY, y, "y", chartHeight);

  if (xTickValues) {
    xAxis.tickValues(xTickValues);
    xGridAxis.tickValues(xTickValues);
  } else {
    xAxis.ticks(6);
    xGridAxis.ticks(6);
  }

  if (yTickValues) {
    yAxis.tickValues(yTickValues);
    yGridAxis.tickValues(yTickValues);
  } else {
    yAxis.ticks(6);
    yGridAxis.ticks(6);
  }

  root.select(".x-axis")
    .transition(transition)
    .call(xAxis);

  root.select(".y-axis")
    .transition(transition)
    .call(yAxis);

  root.select(".x-grid")
    .transition(transition)
    .call(xGridAxis)
    .attr("transform", `translate(0,${chartHeight})`);

  root.select(".y-grid")
    .transition(transition)
    .call(yGridAxis);

  root.select(".x-label").text(xMetric.label);
  root.select(".y-label").text(yMetric.label);

  const visiblePoints = points
    .filter((d) => d[state.scatterX] != null && d[state.scatterY] != null)
    .map((d) => {
      const position = getScatterPointPosition(d, x, y, xMetric, yMetric, chartWidth, chartHeight);
      return {
        ...d,
        scatterXPos: position.x,
        scatterYPos: position.y
      };
    });

  const pointSelection = root.select(".plot")
    .selectAll(".point")
    .data(visiblePoints, (d) => d.appid)
    .join(
      (enter) => enter.append("circle")
        .attr("class", "point")
        .attr("cx", (d) => d.scatterXPos)
        .attr("cy", chartHeight)
        .attr("r", 0)
        .attr("fill", (d) => getScatterPointColor(d[state.dimension]))
        .attr("fill-opacity", 0.58)
        .attr("stroke", "rgba(255, 250, 241, 0.92)")
        .attr("stroke-width", 1.1)
        .on("mousemove", (event, d) => showTooltip(event, buildScatterTooltip(d))),
      (update) => update,
      (exit) => exit.transition(transition).attr("r", 0).remove()
    );

  pointSelection.classed("inactive", false)
    .on("mouseleave", hideTooltip)
    .transition(transition)
    .attr("cx", (d) => d.scatterXPos)
    .attr("cy", (d) => d.scatterYPos)
    .attr("r", (d) => Math.max(2.5, size(d.achievements ?? 0) * 0.82))
    .attr("fill", (d) => getScatterPointColor(d[state.dimension]))
    .attr("fill-opacity", 0.58)
    .attr("stroke", "rgba(255, 250, 241, 0.92)")
    .attr("stroke-width", 1.1);

  const legendCategories = Array.from(state.compareCategories);

  renderHeaderLegend(scatterLegend, legendCategories.map((category) => ({
    label: category,
    color: getCategoryColor(category),
    shape: "circle"
  })));
  scatterLegend.selectAll(".legend-caption")
    .data(["Velicina tocke = broj achievementa"])
    .join("span")
    .attr("class", "legend-caption")
    .text((d) => d);
  scatterNote.text("");
}

function createSnapshotRow(category, stats) {
  return {
    category,
    stats,
    value: metricDefinitions[state.metric].accessor(stats)
  };
}

function sortSnapshotRows(rows) {
  return rows.sort((a, b) => {
    if (state.sortOrder === "alpha") {
      return d3.ascending(a.category, b.category);
    }
    return state.sortOrder === "asc"
      ? d3.ascending(a.value, b.value)
      : d3.descending(a.value, b.value);
  });
}

function combineSelectedModels(models) {
  return { ...models.all };
}

function zeroStats() {
  return {
    count: 0,
    freeCount: 0,
    paidCount: 0,
    priceSum: 0,
    priceN: 0,
    recommendationsSum: 0,
    recommendationsN: 0,
    metacriticSum: 0,
    metacriticN: 0,
    achievementsSum: 0,
    achievementsN: 0,
    discountSum: 0,
    discountN: 0
  };
}

function sumInto(target, source) {
  Object.keys(target).forEach((key) => {
    target[key] += source[key] || 0;
  });
}

function buildNumericScale(metricConfig, values, range) {
  const scaleType = metricConfig.scale;
  const fallbackDomain = [0, 1];
  const domain = resolveScatterDomain(metricConfig, values) ?? fallbackDomain;

  if (scaleType === "symlog") {
    return d3.scaleSymlog().constant(1).domain(domain).range(range);
  }
  return d3.scaleLinear().domain(domain).nice().range(range);
}

function getAxisFormatter(metricKey) {
  if (metricKey === "freeShare") {
    return d3.format(".0%");
  }
  if (metricKey === "avgPrice") {
    return (value) => `$${value}`;
  }
  if (metricKey === "avgDiscount") {
    return (value) => `${value}%`;
  }
  return formatCompactAxisValue;
}

function getScatterAxisFormatter(metricKey) {
  if (metricKey === "year" || metricKey === "platformCount") {
    return d3.format("d");
  }
  if (metricKey === "price") {
    return formatCompactCurrencyAxisValue;
  }
  if (metricKey === "discount") {
    return (value) => `${value}%`;
  }
  return formatCompactAxisValue;
}

function getScatterTickValues(metricKey, scale, axis, axisLength) {
  const metricConfig = scatterMetrics[metricKey];
  const [domainMin, domainMax] = scale.domain();
  if (!metricConfig.tickValues) {
    return null;
  }

  const filtered = filterTickValues(metricConfig.tickValues, domainMin, domainMax);
  return condenseScatterTickValues(filtered, scale, axis, axisLength);
}

function formatCompactAxisValue(value) {
  const abs = Math.abs(value);

  if (abs >= 1000000) {
    return `${trimAxisNumber(value / 1000000)} mil.`;
  }
  if (abs >= 1000) {
    return `${trimAxisNumber(value / 1000)} tis.`;
  }
  if (abs >= 10) {
    return trimAxisNumber(value);
  }
  return d3.format(".1f")(value).replace(/\.0$/, "");
}

function trimAxisNumber(value) {
  return d3.format("~f")(value);
}

function formatCompactCurrencyAxisValue(value) {
  const abs = Math.abs(value);

  if (abs >= 1000000) {
    return `$${trimAxisNumber(value / 1000000)} mil.`;
  }
  if (abs >= 1000) {
    return `$${trimAxisNumber(value / 1000)} tis.`;
  }
  if (abs >= 10) {
    return `$${trimAxisNumber(value)}`;
  }
  return `$${d3.format(".1f")(value).replace(/\.0$/, "")}`;
}

function filterTickValues(candidates, domainMin, domainMax) {
  return candidates.filter((value) => value >= domainMin && value <= domainMax);
}

function condenseScatterTickValues(tickValues, scale, axis, axisLength) {
  if (tickValues.length <= 2) {
    return tickValues;
  }

  const minSpacing = axis === "x"
    ? Math.max(46, axisLength * 0.075)
    : Math.max(34, axisLength * 0.06);

  const kept = [tickValues[0]];

  for (let index = 1; index < tickValues.length - 1; index += 1) {
    const value = tickValues[index];
    const lastKept = kept.at(-1);
    if (Math.abs(scale(value) - scale(lastKept)) >= minSpacing) {
      kept.push(value);
    }
  }

  const lastValue = tickValues.at(-1);
  const lastKept = kept.at(-1);
  if (Math.abs(scale(lastValue) - scale(lastKept)) < minSpacing * 0.7 && kept.length > 1) {
    kept.pop();
  }
  if (kept.at(-1) !== lastValue) {
    kept.push(lastValue);
  }

  return kept;
}

function resolveScatterDomain(metricConfig, values) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort(d3.ascending);
  const minValue = sorted[0];
  const maxValue = sorted.at(-1);

  if (metricConfig.domainMode === "fixed") {
    return [...metricConfig.domain];
  }

  if (metricConfig.domainMode === "year") {
    return [minValue - 0.5, maxValue + 0.5];
  }

  if (metricConfig.domainMode === "zeroMax") {
    const safeMax = Math.max(maxValue, minValue, 1);
    return [0, safeMax * 1.02];
  }

  if (metricConfig.domainMode === "positiveMax") {
    const lowerBound = minValue > 0 ? minValue * 0.92 : minValue;
    const upperBound = Math.max(maxValue, minValue, 1) * 1.02;
    return [lowerBound, upperBound];
  }

  if (metricConfig.domainMode === "boundedExtent") {
    const [lowerPad, upperPad] = metricConfig.pad ?? [0, 0];
    const minLimit = metricConfig.minLimit ?? -Infinity;
    const maxLimit = metricConfig.maxLimit ?? Infinity;
    const lower = Math.max(minLimit, minValue - lowerPad);
    const upper = Math.min(maxLimit, maxValue + upperPad);
    return lower === upper ? [lower - 1, upper + 1] : [lower, upper];
  }

  return minValue === maxValue ? [minValue - 1, maxValue + 1] : [minValue, maxValue];
}

function getScaleExtent(values, quantileCap = 1) {
  if (!values.length) {
    return [0, 1];
  }

  const sorted = [...values].sort(d3.ascending);
  const maxValue = quantileCap >= 1 ? sorted.at(-1) : d3.quantileSorted(sorted, quantileCap);
  return [sorted[0], maxValue ?? sorted.at(-1)];
}

function getScatterPointPosition(app, xScale, yScale, xMetric, yMetric, chartWidth, chartHeight) {
  const baseX = xScale(app[state.scatterX]);
  const baseY = yScale(app[state.scatterY]);
  const xJitterRange = xMetric.scale === "symlog" ? 11 : 7;
  const yJitterRange = yMetric.scale === "symlog" ? 7 : 5;

  return {
    x: clamp(baseX + getDeterministicJitter(app.appid * 17 + 3, xJitterRange), 0, chartWidth),
    y: clamp(baseY + getDeterministicJitter(app.appid * 29 + 7, yJitterRange), 0, chartHeight)
  };
}

function getDeterministicJitter(seed, range) {
  const hash = Math.sin(seed) * 10000;
  return (hash - Math.floor(hash) - 0.5) * range * 2;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getYearTicks() {
  const visibleYears = getVisibleYears();
  return visibleYears.filter((year, index) => index % 4 === 0 || year === visibleYears.at(-1));
}

function getCategoryColor(category) {
  const categories = state.data.dimensions[state.dimension].categories;
  const palette = colorSets[state.dimension];
  const index = Math.max(categories.indexOf(category), 0);
  return palette[index % palette.length];
}

function getScatterPointColor(category) {
  const base = d3.color(getCategoryColor(category));
  return base ? base.brighter(0.55).formatHex() : getCategoryColor(category);
}

function toggleCategory(category) {
  const shouldRestartAnimation = restartAnimationFromStartIfRunning();
  if (state.selectedCategories.has(category)) {
    state.selectedCategories.delete(category);
  } else {
    state.selectedCategories.add(category);
  }
  if (shouldRestartAnimation) {
    startAnimation();
    return;
  }
  updateDashboard();
}

function toggleCompareCategory(category) {
  const shouldRestartAnimation = restartAnimationFromStartIfRunning();
  if (state.compareCategories.has(category)) {
    state.compareCategories.delete(category);
  } else {
    state.compareCategories.add(category);
  }
  if (shouldRestartAnimation) {
    startAnimation();
    return;
  }
  updateDashboard();
}

function startAnimation() {
  stopAnimation({ interrupt: false, redraw: false });
  const sequence = getTargetRangeYears();
  if (!sequence.length) {
    updatePlayToggle();
    return;
  }

  if (
    state.animationYear == null
    || state.animationYear < sequence[0]
    || state.animationYear > sequence.at(-1)
    || state.animationYear === sequence.at(-1)
  ) {
    state.animationYear = sequence[0];
  }

  animationTimer = window.setInterval(() => {
    const index = sequence.indexOf(state.animationYear);
    if (index >= sequence.length - 1) {
      finishAnimation();
      return;
    }
    state.animationYear = sequence[index + 1];
    syncControls();
    updateDashboard();
    if (index + 1 >= sequence.length - 1) {
      finishAnimation();
    }
  }, 1500);
  updatePlayToggle();
  syncControls();
  updateDashboard();
}

function stopAnimation({ interrupt = true, redraw = true } = {}) {
  if (animationTimer) {
    window.clearInterval(animationTimer);
    animationTimer = null;
  }

  if (interrupt) {
    interruptDashboardTransitions();
  }

  updatePlayToggle();

  if (redraw && state.data) {
    runWithoutTransitions(() => updateDashboard());
  }
}

function buildBarTooltip(row) {
  return `<strong>${row.category}</strong><br>${metricDefinitions[state.metric].label}: ${metricDefinitions[state.metric].format(row.value)}<br>Broj aplikacija: ${formatInteger(row.stats.count)}<br>Free/Paid: ${formatInteger(row.stats.freeCount)} / ${formatInteger(row.stats.paidCount)}`;
}

function buildMixTooltip(segment) {
  const rawValue = state.shareView === "free" ? segment.stats.freeCount : segment.stats.paidCount;
  const shareValue = state.shareView === "free" ? segment.Free : segment.Paid;
  return `<strong>${segment.category}</strong><br>${state.shareView === "free" ? "Free" : "Paid"} udio: ${(shareValue * 100).toFixed(1)}%<br>Broj izdanja: ${formatInteger(rawValue)}`;
}

function buildScatterTooltip(app) {
  return `<strong>${escapeHtml(app.name)}</strong><br>Godina: ${app.year}<br>${dimensionDefinitions[state.dimension]}: ${app[state.dimension]}<br>${scatterMetrics[state.scatterX].label}: ${scatterMetrics[state.scatterX].format(app[state.scatterX])}<br>${scatterMetrics[state.scatterY].label}: ${scatterMetrics[state.scatterY].format(app[state.scatterY])}<br>Model: ${app.isFree ? "Free" : "Paid"}`;
}

function populateSelect(selector, options, selected) {
  const select = d3.select(selector);
  select.selectAll("option")
    .data(Object.entries(options))
    .join("option")
    .attr("value", ([value]) => value)
    .text(([, label]) => label);
  select.property("value", selected);
}

function objectMap(source, mapFn) {
  return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, mapFn(value)]));
}

function formatInteger(value) {
  return new Intl.NumberFormat("hr-HR").format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function showTooltip(event, html) {
  tooltip.html(html)
    .style("left", `${event.clientX + 16}px`)
    .style("top", `${event.clientY + 16}px`)
    .attr("hidden", null);
}

function hideTooltip() {
  tooltip.attr("hidden", true);
}

function setStatus(message, isError = false) {
  if (!message) {
    statusMessage.text("").attr("class", "status-message hidden");
    return;
  }

  statusMessage
    .text(message)
    .attr("class", `status-message${isError ? " error" : ""}`);
}

function updatePlayToggle() {
  d3.select("#play-toggle").text(animationTimer ? "Zaustavi" : "Pokreni");
}

function syncShareToggle() {
  d3.selectAll("#share-view-toggle .share-option")
    .classed("active", function() {
      return this.dataset.shareView === state.shareView;
    })
    .attr("aria-pressed", function() {
      return this.dataset.shareView === state.shareView ? "true" : "false";
    });
}

function stopAnimationIfRunning() {
  if (animationTimer) {
    stopAnimation({ redraw: false });
  }
}

function restartAnimationFromStartIfRunning() {
  if (!animationTimer) {
    return false;
  }

  stopAnimation({ redraw: false });
  state.animationYear = getTargetRangeYears()[0] ?? +state.yearStart;
  return true;
}

function finishAnimation() {
  if (animationTimer) {
    window.clearInterval(animationTimer);
    animationTimer = null;
  }
  updatePlayToggle();
}

function getEffectiveYearStart() {
  return +state.yearStart;
}

function getEffectiveYearEnd() {
  return state.animationYear ?? +state.yearEnd;
}

function getVisibleYears() {
  const startYear = getEffectiveYearStart();
  const endYear = Math.max(getEffectiveYearEnd(), startYear);
  return state.data.years.filter((year) => year >= startYear && year <= endYear);
}

function getTargetRangeYears() {
  const startYear = +state.yearStart;
  const endYear = Math.max(+(state.yearTargetEnd ?? state.yearEnd), startYear);
  return state.data.years.filter((year) => year >= startYear && year <= endYear);
}

function getTransitionDuration() {
  return transitionOverrideDuration ?? 850;
}

function createChartTransition() {
  return d3.transition()
    .duration(getTransitionDuration())
    .ease(d3.easeCubicInOut);
}

function runWithoutTransitions(callback) {
  transitionOverrideDuration = 0;
  try {
    callback();
  } finally {
    transitionOverrideDuration = null;
  }
}

function interruptDashboardTransitions() {
  d3.selectAll("#kpi-grid *, #bar-chart *, #engagement-chart *, #comparison-chart *, #scatter-chart *").interrupt();
}

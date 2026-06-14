const chartData = {
  recovery: {
    values: [74, 77, 71, 76, 80, 79, 82],
    value: "82",
    copy: "+4 from last Saturday",
    label: "Seven day recovery chart",
  },
  sleep: {
    values: [68, 75, 82, 73, 77, 80, 79],
    value: "79",
    copy: "7h 24m last night",
    label: "Seven day sleep score chart",
  },
  activity: {
    values: [55, 68, 62, 79, 73, 64, 74],
    value: "74%",
    copy: "Weekly cardio target",
    label: "Seven day activity chart",
  },
};

const detailContent = {
  plan: {
    label: "Today’s plan",
    title: "A steady day",
    html: `
      <ol class="plan-list">
        <li><span>Morning</span><strong>Hydrate and get 10 minutes of daylight</strong><small>Your sleep timing was consistent. Keep the wake signal strong.</small></li>
        <li><span>Afternoon</span><strong>Take a 25-minute Zone 2 walk</strong><small>This closes most of your weekly cardio gap at a recovery-friendly effort.</small></li>
        <li><span>Evening</span><strong>Start winding down by 10:30 PM</strong><small>A similar bedtime gives tomorrow’s recovery signal a cleaner baseline.</small></li>
      </ol>`,
  },
  data: {
    label: "Connected data",
    title: "What BALA can use",
    html: `
      <div class="source-list">
        <div><strong>Apple Health / HealthKit</strong><span>Heart rate, resting heart rate, HRV, sleep, workouts, steps, distance, active energy.</span></div>
        <div><strong>Fitbit Air / Google Health</strong><span>24/7 heart rate, resting heart rate, HRV, SpO₂, breathing rate, skin-temperature variation, sleep stages and duration, steps, readiness, weekly cardio load, VO₂ max, automatic workouts, and supported heart-rhythm alerts.</span></div>
        <p>This browser prototype uses realistic demo data. Live Apple data requires an iPhone app with HealthKit permission. Fitbit access requires the user’s Google/Fitbit authorization and supported APIs. Rhythm alerts and other regulated features vary by country, age, device, and eligibility.</p>
      </div>`,
  },
  privacy: {
    label: "Privacy",
    title: "Your health data should stay yours",
    html: `<div class="source-list"><p>BALA is designed to request only the metrics needed for features you choose. Health access should be optional, revocable, and processed locally where practical. This demo does not read or upload your personal health data.</p></div>`,
  },
};

const signalDetails = {
  readiness: ["Readiness", "82", "A combined view of recent sleep, recovery signals, and activity load. Use it to pace your day, not as a medical assessment."],
  sleep: ["Sleep", "7h 24m · score 79", "You were asleep for 7 hours 24 minutes. Timing and duration were close to your recent pattern."],
  heart: ["Resting heart rate", "61 bpm", "Two beats below your recent average. A single day matters less than a consistent trend."],
  cardio: ["Weekly cardio", "74%", "You are 12 load points below this week’s target. A moderate walk is enough to make useful progress."],
  hrv: ["Heart rate variability", "46 ms", "Within your personal range. HRV is most useful compared with your own baseline over time."],
  spo2: ["SpO₂", "97%", "An overnight estimate from a compatible wearable. It is not a diagnosis or a substitute for a medical-grade measurement."],
  breathing: ["Breathing rate", "13 brpm", "Near your recent sleeping baseline. BALA looks for sustained changes rather than reacting to one night."],
  temperature: ["Skin-temperature variation", "+0.1°F", "Near baseline. Wearables measure skin-temperature variation, which is different from core body temperature."],
  steps: ["Steps", "6,842", "You are at 68% of a 10,000-step demo goal. Goals should match your ability and context."],
};

const dialog = document.querySelector("#detail-dialog");
const dialogLabel = document.querySelector("#dialog-label");
const dialogTitle = document.querySelector("#dialog-title");
const dialogContentNode = document.querySelector("#dialog-content");
const chart = document.querySelector("#chart");
const chartValue = document.querySelector("#chart-value");
const chartCopy = document.querySelector("#chart-copy");
const linePath = document.querySelector("#line-path");
const areaPath = document.querySelector("#area-path");
const pointGroup = document.querySelector("#point-group");
const addButton = document.querySelector("#add-button");
const coachDrawer = document.querySelector("#coach-drawer");
const coachMessages = document.querySelector("#coach-messages");
const coachInput = document.querySelector("#coach-input");
const voiceInputButton = document.querySelector("#voice-input");
const voiceModeButton = document.querySelector("#voice-mode");
const voiceStatus = document.querySelector("#voice-status");
const captureDialog = document.querySelector("#capture-dialog");
const captureForm = document.querySelector("#capture-form");
const healthFile = document.querySelector("#health-file");
const installDialog = document.querySelector("#install-dialog");
const installTitle = document.querySelector("#install-title");
const installContent = document.querySelector("#install-content");
const installButton = document.querySelector("#install-button");
const devicesDialog = document.querySelector("#devices-dialog");
const providerDetail = document.querySelector("#provider-detail");
const appleImportDialog = document.querySelector("#apple-import-dialog");
const STORAGE_KEY = "bala-local-health-v1";
let deferredInstallPrompt = null;
let voiceRepliesEnabled = true;
let speechRecognition = null;
let isListening = false;

const providerGuides = {
  apple: {
    title: "Apple Health and Apple Watch",
    status: "Requires the native iPhone HealthKit companion for automatic sync.",
    copy: "HealthKit supplies source revision and product information, so BALA can preserve whether a sample came from Apple Watch, iPhone, or another app. The web app can use Apple Health export.xml today.",
  },
  "health-connect": {
    title: "Android Health Connect",
    status: "Requires the native Android companion and user-approved read permissions.",
    copy: "Health Connect records include data origin metadata. BALA should use it to identify the app and device that created each record and avoid combining duplicate copies.",
  },
  fitbit: {
    title: "Fitbit",
    status: "Direct cloud connection uses Fitbit OAuth 2.0 and a registered application.",
    copy: "Fitbit can provide activity, sleep, heart-rate and other supported records. Tokens must be stored securely and only the scopes needed by BALA should be requested.",
  },
  samsung: {
    title: "Samsung Health",
    status: "Automatic access uses Samsung Health Data SDK on Android.",
    copy: "The SDK covers Galaxy Watch and Galaxy Ring data including sleep, heart rate, blood oxygen, skin temperature, steps and Energy Score. Samsung Health 6.30.2+ and Android 10+ are required.",
  },
  oura: {
    title: "Oura",
    status: "Direct cloud connection uses Oura OAuth and its API.",
    copy: "Oura is especially useful for overnight sleep, readiness and heart-rate trends. BALA should retain Oura as the source rather than presenting its score as a device-independent measurement.",
  },
  garmin: {
    title: "Garmin",
    status: "Garmin Health API access requires approval; commercial use can require licensing.",
    copy: "Garmin offers detailed all-day health and training data. It should be an optional partner integration, not a dependency for BALA’s free core experience.",
  },
};

function openDialog(type) {
  const content = detailContent[type];
  dialogLabel.textContent = content.label;
  dialogTitle.textContent = content.title;
  dialogContentNode.innerHTML = content.html;
  dialog.showModal();
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function platformGuide() {
  const ios = isIos();
  installTitle.textContent = isStandalone() ? "BALA is installed" : "Install BALA free";
  installContent.innerHTML = `
    <div class="platform-summary">
      <span class="status-badge">${isStandalone() ? "Installed app mode" : "Browser-ready PWA"}</span>
      <p>BALA can be installed from the browser with offline access and no subscription. Your locally entered or imported health data stays on this device.</p>
    </div>
    <div class="platform-grid">
      <section class="platform-option ${ios ? "recommended" : ""}">
        <div class="platform-icon apple" aria-hidden="true">A</div>
        <div>
          <strong>iPhone + Apple Watch</strong>
          <span>${ios ? "This appears to be your device." : "Install from Safari."}</span>
        </div>
        <ol>
          <li>In Safari, tap Share, then Add to Home Screen.</li>
          <li>Use Apple Health export import in this web version.</li>
          <li>Automatic Apple Watch sync requires the planned native HealthKit companion and your explicit permission.</li>
        </ol>
      </section>
      <section class="platform-option ${!ios ? "recommended" : ""}">
        <div class="platform-icon android" aria-hidden="true">G</div>
        <div>
          <strong>Android + wearables</strong>
          <span>${!ios ? "This appears to be your device." : "Install from Chrome."}</span>
        </div>
        <ol>
          <li>In Chrome, choose Install app or Add to Home screen.</li>
          <li>Use manual capture in this web version.</li>
          <li>Automatic sync requires the planned Android Health Connect companion and only the permissions you approve.</li>
        </ol>
      </section>
    </div>
    <div class="connection-note">
      <strong>Important limitation</strong>
      <p>A browser cannot directly read HealthKit or Health Connect. The installable web app is usable now; automatic background wearable sync needs small native iOS and Android bridges.</p>
    </div>`;
  installDialog.showModal();
}

function openDevices() {
  devicesDialog.showModal();
}

function showProviderGuide(provider) {
  const guide = providerGuides[provider];
  providerDetail.innerHTML = `
    <span class="status-badge">Setup path</span>
    <h3>${guide.title}</h3>
    <strong>${guide.status}</strong>
    <p>${guide.copy}</p>
    <small>This screen explains the integration. It does not transmit health data or connect an account.</small>`;
  document.querySelectorAll(".device-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.provider === provider);
  });
}

async function requestInstall() {
  if (isStandalone()) {
    platformGuide();
    return;
  }
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (choice.outcome === "accepted") installButton.textContent = "BALA installed";
    return;
  }
  platformGuide();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getLocalMetrics() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

function scoreMetrics(metrics) {
  const sleepScore = metrics.sleep ? clamp(100 - Math.abs(8 - metrics.sleep) * 17, 35, 100) : 75;
  const movementScore = metrics.steps ? clamp((metrics.steps / 8500) * 100, 30, 100) : 70;
  const recoveryScore = metrics.hrv ? clamp((metrics.hrv / 50) * 90, 40, 100) : 75;
  return Math.round(sleepScore * 0.45 + recoveryScore * 0.35 + movementScore * 0.2);
}

function buildRecommendation(metrics) {
  if (metrics.sleep && metrics.sleep < 6.5) {
    return {
      title: "Choose recovery over intensity today",
      copy: "Your recorded sleep was short. Favor an easy walk, regular meals, hydration, and an earlier wind-down.",
    };
  }
  if (metrics.rhr && metrics.rhr >= 75 && metrics.hrv && metrics.hrv < 35) {
    return {
      title: "Keep today light and watch the trend",
      copy: "Your recovery signals differ from this demo baseline. Avoid using one reading as a diagnosis; recheck how you feel and monitor the pattern.",
    };
  }
  if ((metrics.steps || 0) < 6000 || (metrics.exercise || 0) < 20) {
    return {
      title: "Take a 20-minute comfortable walk",
      copy: "This is the clearest low-risk action from today’s activity. Stop if you feel unwell and choose an effort where conversation stays easy.",
    };
  }
  return {
    title: "Protect the routine that is working",
    copy: "Your sleep and movement entries support a normal day. Keep activity comfortable and preserve a consistent bedtime.",
  };
}

function metricEvidence(metrics) {
  return [
    metrics?.sleep && `${metrics.sleep.toFixed(1)} hours of sleep`,
    metrics?.rhr && `${Math.round(metrics.rhr)} bpm resting heart rate`,
    metrics?.hrv && `${Math.round(metrics.hrv)} ms HRV`,
    metrics?.spo2 && `${Math.round(metrics.spo2)}% SpO2`,
    metrics?.steps !== undefined && `${Math.round(metrics.steps).toLocaleString()} steps`,
    metrics?.exercise !== undefined && `${Math.round(metrics.exercise)} exercise minutes`,
  ].filter(Boolean);
}

function coachResponse(question, metrics) {
  if (!metrics) {
    return "I’m still showing demo data. Add today’s metrics or import your Apple Health ZIP, then I can explain your local values.";
  }
  const normalized = question.toLowerCase();
  const evidence = metricEvidence(metrics).join(", ") || "the values you recorded";

  if (/sleep|bed|tired|fatigue/.test(normalized)) {
    const duration = metrics.sleep ? `${metrics.sleep.toFixed(1)} hours` : "no recent sleep duration";
    const durationContext = metrics.sleep < 6
      ? "That is well below the usual 7–9 hour range for most adults."
      : metrics.sleep < 7
        ? "That is a little below the usual 7–9 hour range for most adults."
        : "Duration alone does not look unusually short.";
    return `Your latest record shows ${duration}. ${durationContext} Keep one consistent wake time, stop caffeine by early afternoon, and begin a quiet wind-down 30–60 minutes before bed. If poor sleep or marked daytime sleepiness persists, discuss it with a clinician.`;
  }

  if (/hrv|variability/.test(normalized)) {
    if (!metrics.hrv) return "No HRV value was found in your latest import. HRV is most useful against your own multi-week baseline, measured under similar conditions.";
    return `Your latest HRV is ${Math.round(metrics.hrv)} ms. HRV varies widely between people, so compare it with your own baseline rather than another person’s number. Sleep, illness, alcohol, stress, and hard training can lower it. Use the trend with resting heart rate and how you feel.`;
  }

  if (/heart|rhr|pulse/.test(normalized)) {
    if (!metrics.rhr) return "No resting heart-rate value was found in your latest import. A multi-day trend is more useful than one reading.";
    return `Your latest resting heart rate is ${Math.round(metrics.rhr)} bpm. One high day can reflect short sleep, stress, dehydration, illness, alcohol, or recent exertion. Recheck the trend and how you feel. Seek medical care for concerning symptoms or a persistently unusual rate.`;
  }

  if (/oxygen|spo2|blood oxygen/.test(normalized)) {
    if (!metrics.spo2) return "No blood-oxygen estimate was found in your latest import. Wearable SpO2 is a wellness estimate and can be affected by fit, movement, skin temperature, and circulation.";
    return `Your latest wearable SpO2 estimate is ${Math.round(metrics.spo2)}%. Treat it as a trend rather than a diagnosis. Recheck watch fit and measurement conditions. Seek medical advice for persistent unusual readings or symptoms such as shortness of breath, chest pain, confusion, or blue lips.`;
  }

  if (/stress|anxious|calm|relax/.test(normalized)) {
    return `Your latest record includes ${evidence}. Wearables cannot measure stress directly, but short sleep, a higher resting heart rate, and lower-than-usual HRV can accompany strain. Take five slow minutes, hydrate, and choose light movement. Persistent anxiety or concerning symptoms deserve professional support.`;
  }

  if (/hydr|water|drink/.test(normalized)) {
    return "BALA does not have enough data to calculate an exact fluid target. Drink regularly with meals and activity, use thirst and pale-yellow urine as practical cues, and increase fluids during heat or prolonged exercise. Medical conditions can change fluid needs.";
  }

  if (/readiness|recover|score/.test(normalized)) {
    return `Your BALA readiness estimate is ${scoreMetrics(metrics)}. It combines sleep, HRV, and movement from ${evidence}. It is a wellness estimate, not a medical score; today, use it to choose a comfortable effort and protect sleep tonight.`;
  }

  if (/step|walk|activity|exercise|workout|today|do/.test(normalized)) {
    const recommendation = buildRecommendation(metrics);
    return `${recommendation.title}. ${recommendation.copy} I used ${evidence}. Stop activity and seek appropriate care if you feel unwell.`;
  }

  const recommendation = buildRecommendation(metrics);
  return `${recommendation.title}. I based this on ${evidence}. Ask specifically about sleep, HRV, resting heart rate, readiness, or activity for a more focused explanation. This is wellness guidance, not a diagnosis.`;
}

function updateDashboard(metrics) {
  if (!metrics) return;
  const score = scoreMetrics(metrics);
  document.querySelector(".score-ring strong").textContent = score;
  document.querySelector(".score-ring").setAttribute("aria-label", `Bala score ${score} out of 100`);
  document.querySelector("#readiness-value").textContent = score;
  document.querySelector("#readiness-note").textContent = "From your local entries";

  if (metrics.sleep) {
    const hours = Math.floor(metrics.sleep);
    const minutes = Math.round((metrics.sleep - hours) * 60);
    document.querySelector("#sleep-value").textContent = `${hours}h ${String(minutes).padStart(2, "0")}m`;
    document.querySelector("#sleep-note").textContent = "Locally recorded";
  }
  if (metrics.rhr) {
    document.querySelector("#heart-value").textContent = Math.round(metrics.rhr);
    document.querySelector("#heart-note").textContent = "Locally recorded";
  }
  if (metrics.hrv) document.querySelector("#hrv-value").textContent = Math.round(metrics.hrv);
  if (metrics.spo2) document.querySelector("#spo2-value").textContent = Math.round(metrics.spo2);
  if (metrics.steps !== undefined) {
    document.querySelector("#steps-value").textContent = Math.round(metrics.steps).toLocaleString();
    const percentage = clamp(Math.round((metrics.steps / 10000) * 100), 0, 100);
    document.querySelector("#steps-note").textContent = `${percentage}% of demo goal`;
    document.querySelector("#steps-progress").style.width = `${percentage}%`;
    document.querySelector("#activity-value").textContent = `${percentage}%`;
    document.querySelector("#activity-note").textContent = "Of daily step goal";
  }

  const recommendation = buildRecommendation(metrics);
  document.querySelector("#suggestion-title").textContent = recommendation.title;
  document.querySelector(".suggestion-panel > p:not(.section-label)").textContent = recommendation.copy;
  document.querySelector("#source-title").textContent = metrics.source || "Local check-in";
  document.querySelector("#source-status").textContent = `Saved on this device · ${new Date(metrics.updatedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`;
  document.querySelector("#clear-button").hidden = false;
  document.querySelector("#chart-value").textContent = score;
  document.querySelector("#chart-copy").textContent = "Local wellness estimate";
}

function numericFormValue(formData, name) {
  const raw = formData.get(name);
  return raw === "" ? undefined : Number(raw);
}

function saveMetrics(metrics) {
  const existing = getLocalMetrics() || {};
  const stored = { ...existing, ...metrics, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  updateDashboard(stored);
  return stored;
}

function parseAppleDate(value) {
  if (!value) return new Date(NaN);
  const normalized = value
    .replace(" ", "T")
    .replace(/ ([+-]\d{2})(\d{2})$/, "$1:$2");
  return new Date(normalized);
}

function recordAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/(\w+)="([^"]*)"/g)) attributes[match[1]] = match[2];
  return attributes;
}

async function parseAppleHealthStream(stream) {
  const supportedTypes = new Set([
    "HKQuantityTypeIdentifierStepCount",
    "HKQuantityTypeIdentifierRestingHeartRate",
    "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
    "HKQuantityTypeIdentifierOxygenSaturation",
    "HKQuantityTypeIdentifierAppleExerciseTime",
    "HKCategoryTypeIdentifierSleepAnalysis",
  ]);
  const days = new Map();
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let recordCount = 0;

  const processTag = (tag) => {
    const attributes = recordAttributes(tag);
    if (!supportedTypes.has(attributes.type)) return;
    const end = parseAppleDate(attributes.endDate || attributes.startDate);
    if (Number.isNaN(end.getTime())) return;
    const dayKey = (attributes.endDate || attributes.startDate).slice(0, 10);
    const day = days.get(dayKey) || {
      sleepSeconds: 0,
      steps: 0,
      exercise: 0,
      rhrTotal: 0,
      rhrCount: 0,
      hrvTotal: 0,
      hrvCount: 0,
      spo2Total: 0,
      spo2Count: 0,
    };
    const value = Number(attributes.value);

    if (attributes.type === "HKQuantityTypeIdentifierStepCount" && Number.isFinite(value)) day.steps += value;
    if (attributes.type === "HKQuantityTypeIdentifierAppleExerciseTime" && Number.isFinite(value)) day.exercise += value;
    if (attributes.type === "HKQuantityTypeIdentifierRestingHeartRate" && Number.isFinite(value)) {
      day.rhrTotal += value;
      day.rhrCount += 1;
    }
    if (attributes.type === "HKQuantityTypeIdentifierHeartRateVariabilitySDNN" && Number.isFinite(value)) {
      day.hrvTotal += value;
      day.hrvCount += 1;
    }
    if (attributes.type === "HKQuantityTypeIdentifierOxygenSaturation" && Number.isFinite(value)) {
      day.spo2Total += value;
      day.spo2Count += 1;
    }
    if (attributes.type === "HKCategoryTypeIdentifierSleepAnalysis" && /Asleep/.test(attributes.value || "")) {
      const start = parseAppleDate(attributes.startDate);
      if (!Number.isNaN(start.getTime())) day.sleepSeconds += Math.max(0, end - start) / 1000;
    }
    days.set(dayKey, day);
    recordCount += 1;
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    let start = buffer.indexOf("<Record");
    while (start !== -1) {
      const end = buffer.indexOf(">", start);
      if (end === -1) break;
      processTag(buffer.slice(start, end + 1));
      buffer = buffer.slice(end + 1);
      start = buffer.indexOf("<Record");
    }
    if (buffer.length > 20000 && start === -1) buffer = buffer.slice(-1000);
    if (done) break;
  }

  if (!recordCount || !days.size) throw new Error("No supported Apple Health records were found.");
  const latestDayKey = [...days.keys()].sort().at(-1);
  const day = days.get(latestDayKey);
  const average = (total, count) => count ? total / count : undefined;
  const oxygen = average(day.spo2Total, day.spo2Count);

  return {
    source: `Apple Health import · ${latestDayKey}`,
    sleep: day.sleepSeconds ? day.sleepSeconds / 3600 : undefined,
    rhr: average(day.rhrTotal, day.rhrCount),
    hrv: average(day.hrvTotal, day.hrvCount),
    spo2: oxygen === undefined ? undefined : oxygen <= 1 ? oxygen * 100 : oxygen,
    steps: day.steps,
    exercise: day.exercise,
  };
}

function appleHealthXmlStream(zipFile) {
  if (!window.fflate) throw new Error("The ZIP reader did not load. Refresh BALA and try again.");

  return new ReadableStream({
    start(controller) {
      let foundExport = false;
      let finished = false;
      const fail = (error) => {
        if (finished) return;
        finished = true;
        controller.error(error instanceof Error ? error : new Error(String(error)));
      };

      const unzip = new window.fflate.Unzip((entry) => {
        const path = entry.name.replaceAll("\\", "/").toLowerCase();
        if (path !== "export.xml" && !path.endsWith("/export.xml")) return;

        foundExport = true;
        entry.ondata = (error, chunk, final) => {
          if (error) {
            fail(error);
            return;
          }
          if (chunk?.length) controller.enqueue(chunk);
          if (final && !finished) {
            finished = true;
            controller.close();
          }
        };
        entry.start();
      });
      unzip.register(window.fflate.AsyncUnzipInflate);

      (async () => {
        try {
          const reader = zipFile.stream().getReader();
          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              unzip.push(new Uint8Array(), true);
              if (!foundExport) fail(new Error("This ZIP does not contain Apple Health export.xml."));
              break;
            }
            unzip.push(value, false);
          }
        } catch (error) {
          fail(error);
        }
      })();
    },
  });
}

function parseAppleHealthFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".zip")) return parseAppleHealthStream(appleHealthXmlStream(file));
  if (name.endsWith(".xml")) return parseAppleHealthStream(file.stream());
  throw new Error("Choose apple_health_export.zip or export.xml.");
}

function openSignalDetail(key) {
  const [title, value, copy] = signalDetails[key];
  dialogLabel.textContent = "Health signal";
  dialogTitle.textContent = title;
  dialogContentNode.innerHTML = `
    <div class="signal-detail">
      <strong>${value}</strong>
      <p>${copy}</p>
      <small>Demo value · your personal range becomes more useful with consistent wear.</small>
    </div>`;
  dialog.showModal();
}

function chartPath(values) {
  const min = 45;
  const max = 90;
  return values.map((value, index) => {
    const x = 8 + index * 114;
    const y = 190 - ((value - min) / (max - min)) * 155;
    return { x, y };
  });
}

function renderChart(type) {
  const data = chartData[type];
  const points = chartPath(data.values);
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  linePath.setAttribute("d", path);
  areaPath.setAttribute("d", `${path} L${points.at(-1).x},205 L${points[0].x},205 Z`);
  pointGroup.replaceChildren(
    ...points.map((point, index) => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", point.x);
      circle.setAttribute("cy", point.y);
      circle.setAttribute("r", index === points.length - 1 ? "6" : "4");
      circle.setAttribute("class", index === points.length - 1 ? "point current" : "point");
      return circle;
    }),
  );
  chartValue.textContent = data.value;
  chartCopy.textContent = data.copy;
  chart.setAttribute("aria-label", data.label);
}

document.querySelectorAll("[data-chart]").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("[data-chart]").forEach((item) => {
      const selected = item === tab;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-selected", String(selected));
    });
    renderChart(tab.dataset.chart);
  });
});

document.querySelectorAll("[data-signal]").forEach((button) => {
  button.addEventListener("click", () => openSignalDetail(button.dataset.signal));
});

document.querySelector("#plan-button").addEventListener("click", () => openDialog("plan"));
document.querySelector("#sync-button").addEventListener("click", platformGuide);
document.querySelector("#all-data-button").addEventListener("click", () => openDialog("data"));
document.querySelector("#privacy-button").addEventListener("click", () => openDialog("privacy"));
document.querySelector("#capture-button").addEventListener("click", () => captureDialog.showModal());
document.querySelector("#capture-close").addEventListener("click", () => captureDialog.close());
installButton.addEventListener("click", requestInstall);
document.querySelector("#devices-button").addEventListener("click", openDevices);
document.querySelector("#source-details-button").addEventListener("click", openDevices);
document.querySelectorAll(".device-card button").forEach((button) => {
  button.addEventListener("click", () => showProviderGuide(button.closest(".device-card").dataset.provider));
});
document.querySelector("#import-button").addEventListener("click", () => appleImportDialog.showModal());
document.querySelector("#choose-health-file").addEventListener("click", () => healthFile.click());
document.querySelector("#clear-button").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
});

captureForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(captureForm);
  saveMetrics({
    source: "Local check-in",
    sleep: numericFormValue(formData, "sleep"),
    rhr: numericFormValue(formData, "rhr"),
    hrv: numericFormValue(formData, "hrv"),
    spo2: numericFormValue(formData, "spo2"),
    steps: numericFormValue(formData, "steps"),
    exercise: numericFormValue(formData, "exercise"),
  });
  captureDialog.close();
  captureForm.reset();
});

healthFile.addEventListener("change", async () => {
  const [file] = healthFile.files;
  if (!file) return;
  try {
    appleImportDialog.close();
    if (!/\.(zip|xml)$/i.test(file.name)) throw new Error("Choose apple_health_export.zip or export.xml.");
    dialogLabel.textContent = "Reading Apple Health";
    dialogTitle.textContent = "Processing your export locally";
    dialogContentNode.innerHTML = `<div class="source-list"><p>BALA is reading ${(file.size / 1024 / 1024).toFixed(1)} MB locally. Keep the app open until this finishes.</p></div>`;
    dialog.showModal();
    const metrics = saveMetrics(await parseAppleHealthFile(file));
    const count = Object.entries(metrics)
      .filter(([key, value]) => !["source", "updatedAt"].includes(key) && value !== undefined)
      .length;
    dialogLabel.textContent = "Import complete";
    dialogTitle.textContent = "Your latest Apple Health day is ready";
    dialogContentNode.innerHTML = `<div class="source-list"><p>BALA found local values for ${count} metrics. The file was processed in this browser and was not uploaded.</p></div>`;
    if (!dialog.open) dialog.showModal();
  } catch (error) {
    dialogLabel.textContent = "Import could not finish";
    dialogTitle.textContent = "Check the selected file";
    dialogContentNode.innerHTML = `<div class="source-list"><p>${error.message}</p><p>Choose <strong>apple_health_export.zip</strong> directly, or the <strong>export.xml</strong> inside its unzipped folder.</p></div>`;
    if (!dialog.open) dialog.showModal();
  } finally {
    healthFile.value = "";
  }
});

addButton.addEventListener("click", () => {
  addButton.classList.add("added");
  addButton.querySelector("span").textContent = "Added to today";
  addButton.querySelector("svg path").setAttribute("d", "m5 12 4 4L19 6");
});

function openCoach(prompt = "") {
  coachDrawer.classList.add("open");
  coachDrawer.setAttribute("aria-hidden", "false");
  if (prompt) coachInput.value = prompt;
  window.setTimeout(() => coachInput.focus(), 180);
}

function closeCoach() {
  speechRecognition?.stop();
  window.speechSynthesis?.cancel();
  coachDrawer.classList.remove("open");
  coachDrawer.setAttribute("aria-hidden", "true");
}

function preferredIndianVoice() {
  const voices = window.speechSynthesis?.getVoices() || [];
  return voices.find((voice) => voice.lang.toLowerCase() === "en-in" && /rishi|veena|indian/i.test(voice.name))
    || voices.find((voice) => voice.lang.toLowerCase() === "en-in")
    || voices.find((voice) => /india|indian/i.test(`${voice.name} ${voice.lang}`))
    || voices.find((voice) => voice.lang.toLowerCase().startsWith("en"))
    || voices[0];
}

function speakCoachAnswer(text) {
  if (!voiceRepliesEnabled || !window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = preferredIndianVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || "en-IN";
  utterance.rate = 0.94;
  utterance.pitch = 0.9;
  window.speechSynthesis.speak(utterance);
}

function setListening(active, status) {
  isListening = active;
  voiceInputButton.classList.toggle("listening", active);
  voiceInputButton.setAttribute("aria-pressed", String(active));
  voiceInputButton.setAttribute("aria-label", active ? "Stop listening" : "Speak your question");
  if (status) voiceStatus.textContent = status;
}

function setupSpeechRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    voiceInputButton.disabled = true;
    voiceInputButton.title = "Voice input is not supported in this browser";
    voiceStatus.textContent = "Spoken replies are available. Voice input is not supported here, so type your question.";
    return;
  }

  speechRecognition = new Recognition();
  speechRecognition.lang = "en-IN";
  speechRecognition.interimResults = true;
  speechRecognition.continuous = false;
  speechRecognition.onstart = () => setListening(true, "Listening in Indian English…");
  speechRecognition.onresult = (event) => {
    const results = Array.from(event.results);
    const transcript = results.map((result) => result[0].transcript).join("");
    coachInput.value = transcript;
    if (results[results.length - 1].isFinal) {
      setListening(false, "Got it. BALA is answering…");
      document.querySelector("#coach-form").requestSubmit();
    }
  };
  speechRecognition.onerror = (event) => {
    const message = event.error === "not-allowed"
      ? "Microphone permission was not allowed. Enable it in browser settings or type your question."
      : "I could not hear that clearly. Tap the microphone and try again.";
    setListening(false, message);
  };
  speechRecognition.onend = () => {
    if (isListening) setListening(false, "Tap the microphone to speak again.");
  };
}

document.querySelector("#ask-button").addEventListener("click", () => openCoach());
document.querySelector("#coach-close").addEventListener("click", closeCoach);
voiceInputButton.addEventListener("click", async () => {
  window.speechSynthesis?.cancel();
  if (!speechRecognition) {
    voiceStatus.textContent = "Voice input is not supported in this browser.";
    return;
  }
  if (isListening) {
    speechRecognition.stop();
    return;
  }
  try {
    setListening(true, "Requesting microphone access…");
    if (navigator.mediaDevices?.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    }
    speechRecognition.start();
  } catch (error) {
    const denied = error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError";
    setListening(false, denied
      ? "Microphone is blocked. On iPhone: Settings → Safari → Microphone → Allow, then reopen BALA."
      : `Microphone could not start${error?.name ? ` (${error.name})` : ""}. Reopen BALA and try again.`);
  }
});
voiceModeButton.addEventListener("click", () => {
  voiceRepliesEnabled = !voiceRepliesEnabled;
  voiceModeButton.setAttribute("aria-pressed", String(voiceRepliesEnabled));
  voiceModeButton.innerHTML = `<span aria-hidden="true">◖))</span> Spoken replies ${voiceRepliesEnabled ? "on · Indian English" : "off"}`;
  if (!voiceRepliesEnabled) window.speechSynthesis?.cancel();
});
document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((nav) => nav.classList.toggle("active", nav === item));
    if (item.dataset.section === "coach") openCoach();
    if (item.dataset.section === "data") openDialog("data");
    if (item.dataset.section === "trends") document.querySelector("#signals-title").scrollIntoView({ behavior: "smooth" });
    if (item.dataset.section === "today") window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

document.querySelectorAll(".prompt-chips button").forEach((button) => {
  button.addEventListener("click", () => openCoach(button.textContent));
});

document.querySelector("#coach-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = coachInput.value.trim();
  if (!question) return;
  const user = document.createElement("div");
  user.className = "user-message";
  user.textContent = question;
  const response = document.createElement("div");
  response.className = "coach-message";
  const answerText = document.createElement("p");
  answerText.textContent = coachResponse(question, getLocalMetrics());
  response.append(answerText);
  coachMessages.append(user, response);
  coachInput.value = "";
  coachMessages.scrollTop = coachMessages.scrollHeight;
  const note = document.createElement("small");
  note.className = "ai-source";
  note.textContent = "BALA on-device coach · private";
  response.append(note);
  speakCoachAnswer(answerText.textContent);
});

setupSpeechRecognition();
renderChart("recovery");
updateDashboard(getLocalMetrics());

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.textContent = "Install BALA";
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButton.textContent = "BALA installed";
});

if (isStandalone()) installButton.textContent = "Installed";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

const launchAction = new URLSearchParams(window.location.search).get("action");
if (launchAction === "capture") captureDialog.showModal();
if (launchAction === "coach") openCoach();

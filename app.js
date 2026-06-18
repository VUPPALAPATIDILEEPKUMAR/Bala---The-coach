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
  spo2: ["SpO₂", "97%", "An overnight estimate from a compatible wearable. Use it for personal awareness and discuss persistent concerns with a qualified professional."],
  breathing: ["Breathing rate", "13 brpm", "Near your recent sleeping baseline. BALA looks for sustained changes rather than reacting to one night."],
  temperature: ["Skin-temperature variation", "+0.1°F", "Near baseline. Wearables measure skin-temperature variation, which is different from core body temperature."],
  steps: ["Steps", "6,842", "You are at 68% of a 10,000-step daily goal. Goals should match your ability and context."],
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
const stopListeningButton = document.querySelector("#voice-stop-listening");
const readAloudToggle = document.querySelector("#read-aloud-toggle");
const stopSpeakingButton = document.querySelector("#voice-stop-speaking");
const voiceStatus = document.querySelector("#voice-status");
const coachLanguage = document.querySelector("#coach-language");
const symptomDialog = document.querySelector("#symptom-dialog");
const symptomForm = document.querySelector("#symptom-form");
const coachModeLabel = document.querySelector("#coach-mode-label");
const shortcutDialog = document.querySelector("#shortcut-dialog");
const shortcutTemplate = document.querySelector("#shortcut-template");
const captureDialog = document.querySelector("#capture-dialog");
const captureForm = document.querySelector("#capture-form");
const healthFile = document.querySelector("#health-file");
const installDialog = document.querySelector("#install-dialog");
const installTitle = document.querySelector("#install-title");
const installContent = document.querySelector("#install-content");
const installButton = document.querySelector("#install-button");
const setupInstallButton = document.querySelector("#setup-install-button");
const setupCardCopy = document.querySelector("#setup-card-copy");
const devicesDialog = document.querySelector("#devices-dialog");
const providerDetail = document.querySelector("#provider-detail");
const appleImportDialog = document.querySelector("#apple-import-dialog");
const importSource = document.querySelector("#import-source");
const importSourceSteps = document.querySelector("#import-source-steps");
const importSupportNote = document.querySelector("#import-support-note");
const onboardingDialog = document.querySelector("#onboarding-dialog");
const onboardingForm = document.querySelector("#onboarding-form");
const profileNameInput = document.querySelector("#profile-name");
const onboardingCancel = document.querySelector("#onboarding-cancel");
const resetNameButton = document.querySelector("#reset-name-button");
const profileButton = document.querySelector("#profile-button");
const exportDataButton = document.querySelector("#export-data-button");
const importDataButton = document.querySelector("#import-data-button");
const balaImportFile = document.querySelector("#bala-import-file");
const dataPortabilityStatus = document.querySelector("#data-portability-status");
const STORAGE_KEY = "bala-local-health-v1";
const SYMPTOM_KEY = "bala-symptoms-v1";
const PROFILE_KEY = "bala-profile-v1";
const EXPORT_FORMAT = "bala-data-export";
const EXPORT_VERSION = 1;
const DATA_SOURCE_KEY = "currentDataSource";
let deferredInstallPrompt = null;
let voiceRepliesEnabled = false;
let speechRecognition = null;
let isListening = false;
let microphonePermissionGranted = false;
const conversation = [];
const DEMO_METRICS = {
  source: "BALA demo",
  sleep: 7.4,
  rhr: 61,
  hrv: 46,
  spo2: 97,
  steps: 6842,
  exercise: 32,
  history: [
    { date: "2026-06-08", sleep: 6.8, rhr: 65, hrv: 40, spo2: 97, steps: 5900, exercise: 18 },
    { date: "2026-06-09", sleep: 7.1, rhr: 64, hrv: 42, spo2: 97, steps: 7600, exercise: 27 },
    { date: "2026-06-10", sleep: 6.6, rhr: 66, hrv: 39, spo2: 96, steps: 5100, exercise: 14 },
    { date: "2026-06-11", sleep: 7.3, rhr: 62, hrv: 45, spo2: 97, steps: 8900, exercise: 36 },
    { date: "2026-06-12", sleep: 7.6, rhr: 61, hrv: 48, spo2: 98, steps: 9400, exercise: 41 },
    { date: "2026-06-13", sleep: 7.2, rhr: 62, hrv: 44, spo2: 97, steps: 7200, exercise: 29 },
    { date: "2026-06-14", sleep: 7.4, rhr: 61, hrv: 46, spo2: 97, steps: 6842, exercise: 32 },
  ],
};

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

const dataSourceLabels = {
  apple: "Apple Health Import",
  "health-connect": "Android Health Connect Import",
  samsung: "Samsung Health Import",
  fitbit: "Fitbit Import",
  garmin: "Garmin Import",
  oura: "Oura Import",
  "manual-csv": "Manual CSV Import",
  "manual-json": "Manual JSON Import",
  manual: "Manual Entry",
  demo: "Demo Mode",
};

const healthSourceGuides = {
  apple: {
    title: "Apple Health / Apple Watch",
    steps: [
      "Open the Health app.",
      "Tap your profile picture, then Export All Health Data.",
      "Save the ZIP file, open BALA, and tap Import file.",
    ],
    files: "Supported now: Apple Health ZIP and export.xml.",
  },
  "health-connect": {
    title: "Android Health Connect",
    steps: [
      "Open Android Settings and search for Health Connect.",
      "Tap Manage data, then Backup and restore or an export option if available.",
      "Save the exported file, open BALA, and tap Import file.",
    ],
    files: "Health Connect export availability varies. BALA currently reads only a simple supported CSV or JSON file.",
  },
  samsung: {
    title: "Samsung Health",
    steps: [
      "Open Samsung Health, then open Settings.",
      "Tap Download personal data and save the downloaded files.",
      "Open BALA and tap Import file.",
    ],
    files: "Samsung downloads can contain multiple files. BALA currently reads only a simple supported CSV or JSON file.",
  },
  fitbit: {
    title: "Fitbit",
    steps: [
      "Open your Fitbit account settings and choose Data Export.",
      "Request or download your data as ZIP, CSV, or JSON where offered.",
      "Save the file, open BALA, and tap Import file.",
    ],
    files: "BALA reads only simple CSV or JSON records with supported daily fields. Fitbit archives are not fully parsed yet.",
  },
  garmin: {
    title: "Garmin Connect",
    steps: [
      "Open Garmin Connect on the web.",
      "Open Activities or Reports, then choose Export CSV where available.",
      "Save the file, open BALA, and tap Import file.",
    ],
    files: "BALA reads only supported daily columns. FIT, TCX, GPX, and complex Garmin exports are not parsed yet.",
  },
  oura: {
    title: "Oura",
    steps: [
      "Open Oura on the web or the Membership Hub.",
      "Choose Download Data, Export data, or download your trends as CSV.",
      "Save the CSV file, open BALA, and tap Import file.",
    ],
    files: "Oura CSV columns vary. BALA currently reads only supported BALA daily field names.",
  },
};

function openDialog(type) {
  const content = detailContent[type];
  if (type === "plan") {
    const metrics = getLocalMetrics() || DEMO_METRICS;
    const recommendation = buildRecommendation(metrics, getRecentSymptoms());
    dialogLabel.textContent = "Today’s guide";
    dialogTitle.textContent = recommendation.title;
    dialogContentNode.innerHTML = `
      <ol class="plan-list">
        <li><span>Start here</span><strong>${recommendation.title}</strong><small>${recommendation.copy}</small></li>
        <li><span>During the day</span><strong>Keep the effort conversational</strong><small>Use your body signals and symptom check-in to adjust. Pause if you feel unwell.</small></li>
        <li><span>Tonight</span><strong>Protect a consistent wind-down</strong><small>A regular sleep window gives tomorrow’s recovery view a cleaner comparison.</small></li>
      </ol>`;
    dialog.showModal();
    return;
  }
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
          <li>Tap Share &rarr; Add to Home Screen &rarr; Add.</li>
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
      <p>A browser cannot directly read HealthKit or Health Connect. The installable web app is usable now; automatic wearable sync needs future iPhone and Android app support.</p>
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

function getProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY)) || null;
  } catch {
    return null;
  }
}

function getUserName() {
  return String(getProfile()?.name || "").trim();
}

function getSymptomHistory() {
  try {
    const entries = JSON.parse(localStorage.getItem(SYMPTOM_KEY) || "[]");
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

function inferDataSource(metrics = getLocalMetrics()) {
  const saved = localStorage.getItem(DATA_SOURCE_KEY);
  if (saved && dataSourceLabels[saved]) return saved;
  const source = String(metrics?.source || "").toLowerCase();
  if (source.includes("apple")) return "apple";
  if (source.includes("demo")) return "demo";
  return metrics ? "manual" : "demo";
}

function setCurrentDataSource(source) {
  const normalized = dataSourceLabels[source] ? source : "manual";
  localStorage.setItem(DATA_SOURCE_KEY, normalized);
  const label = dataSourceLabels[normalized];
  const scoreSource = document.querySelector("#score-data-source");
  if (scoreSource) scoreSource.textContent = `Data source: ${label}`;
  return label;
}

function renderImportSource(source = importSource.value) {
  const guide = healthSourceGuides[source];
  if (guide) {
    importSourceSteps.innerHTML = `
      <ol>${guide.steps.map((step, index) => `<li><span>${index + 1}</span><div><strong>${step}</strong></div></li>`).join("")}</ol>
      <div class="connection-note"><strong>Manual import only</strong><p>Live sync is not available yet. Direct wearable connections are planned for a future version.</p></div>`;
    importSupportNote.textContent = guide.files;
    return;
  }
  const fileType = source === "manual-json" ? "JSON" : "CSV";
  importSourceSteps.innerHTML = `
    <ol>
      <li><span>1</span><div><strong>Prepare a simple ${fileType} file</strong><small>Use date, sleepHours, restingHeartRate, hrv, steps, spo2, and symptomsNote.</small></div></li>
      <li><span>2</span><div><strong>Choose the file in BALA</strong><small>BALA validates supported daily fields and keeps valid dated rows as local history.</small></div></li>
    </ol>
    <div class="connection-note"><strong>Processed on this device</strong><p>Your imported data stays local unless you later export or manually share it.</p></div>`;
  importSupportNote.textContent = source === "manual-json"
    ? "Supported now: BALA data exports and simple JSON records with recognized fields."
    : "Supported now: CSV with the BALA sample headers.";
}

function openHealthImport(source = inferDataSource()) {
  const selected = ["apple", "health-connect", "samsung", "fitbit", "garmin", "oura", "manual-csv", "manual-json"].includes(source)
    ? source
    : "manual-csv";
  importSource.value = selected;
  renderImportSource(importSource.value);
  appleImportDialog.showModal();
}

function openHealthSourceGuide(source) {
  const guide = healthSourceGuides[source];
  if (!guide) return;
  dialogLabel.textContent = "Connect your health data";
  dialogTitle.textContent = guide.title;
  dialogContentNode.innerHTML = `
    <ol class="plan-list">${guide.steps.map((step, index) => `<li><span>Step ${index + 1}</span><strong>${step}</strong></li>`).join("")}</ol>
    <div class="connection-note"><strong>Import your exported health data</strong><p>${guide.files} Live sync is not available yet.</p></div>`;
  dialog.showModal();
}

function personalizeTitle(title) {
  const name = getUserName();
  if (!name) return title;
  return `${name}, ${title.charAt(0).toLowerCase()}${title.slice(1)}`;
}

function updatePersonalization() {
  const name = getUserName();
  document.querySelector("#welcome-label").textContent = name
    ? `Good to see you, ${name}`
    : "A calm guide for everyday awareness";
  profileButton.textContent = name ? `Edit name: ${name}` : "Set up your name";
  document.querySelector("#guide-label").textContent = name ? `Today's Guide for ${name}` : "Today's Guide";
  document.querySelector("#coach-title").textContent = name ? `${name}'s BALA Coach` : "Ask BALA";
  document.querySelector("#coach-welcome").textContent = name
    ? `Hi ${name}. I can help you understand the saved signals available in this app right now, including sleep, recovery, heart, activity, and symptom check-ins.`
    : "I can help you understand the signals available in this app right now, including sleep, recovery, activity, and your saved check-ins.";
  let grounding = document.querySelector("#coach-grounding");
  if (!grounding) {
    grounding = document.createElement("small");
    grounding.id = "coach-grounding";
    const welcome = document.querySelector("#coach-welcome");
    welcome?.insertAdjacentElement("afterend", grounding);
  }
  grounding.textContent = "If this is demo data or limited check-ins, treat this as a gentle guide, not medical advice.";
  coachInput.placeholder = name ? `What would you like to understand, ${name}?` : "What changed this week?";
  coachModeLabel.textContent = "Private coach · using only this app's available signals";
  const metrics = getLocalMetrics();
  if (metrics) updateDashboard(metrics);
}

function openOnboarding(allowClose = false) {
  const name = getUserName();
  profileNameInput.value = name;
  onboardingCancel.hidden = !allowClose;
  resetNameButton.hidden = !allowClose || !name;
  onboardingDialog.showModal();
  window.setTimeout(() => profileNameInput.focus(), 80);
}

onboardingDialog.addEventListener("cancel", (event) => {
  if (!getUserName()) event.preventDefault();
});

function getRecentSymptoms() {
  try {
    const entries = getSymptomHistory();
    const latest = entries.at(-1);
    if (!latest) return null;
    const age = Date.now() - new Date(latest.date).getTime();
    return age <= 36 * 60 * 60 * 1000 ? latest : null;
  } catch {
    return null;
  }
}

function buildDoctorReadySummary(metrics, symptoms = getSymptomHistory()) {
  if (!metrics) return "";
  const baseline = baselineAnalysis(metrics);
  return [
    "BALA WELLNESS SUMMARY",
    `Generated: ${new Date().toLocaleString()}`,
    `Source: ${metrics.source || "Local check-in"}`,
    `Baseline: ${baseline.days} days - ${baseline.level}`,
    baseline.copy,
    "",
    "LATEST SUPPORTED METRICS",
    ...metricEvidence(metrics).map((item) => `- ${item}`),
    "",
    "RECENT SYMPTOM CHECK-INS",
    ...(symptoms.length
      ? symptoms.slice(-10).map((entry) => `- ${new Date(entry.date).toLocaleDateString()}: ${(entry.symptoms || []).join(", ") || "No listed symptom"}${entry.note ? ` - ${entry.note}` : ""}`)
      : ["- None recorded"]),
    "",
    "This report is health-awareness context from supported body signals. Discuss persistent concerns with a qualified clinician.",
  ].join("\n");
}

function downloadJson(filename, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadText(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadSampleCsv() {
  const date = new Date().toISOString().slice(0, 10);
  const sample = [
    "date,sleepHours,restingHeartRate,hrv,steps,spo2,symptomsNote",
    `${date},7.5,61,46,6842,97,Feeling steady`,
  ].join("\n");
  downloadText("bala-sample-health-data.csv", sample, "text/csv;charset=utf-8");
}

function exportBalaData() {
  const exportedAt = new Date().toISOString();
  const payload = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt,
    data: {
      profile: getProfile(),
      health: getLocalMetrics(),
      symptomCheckIns: getSymptomHistory(),
      settings: {
        language: localStorage.getItem("bala-language") || "en-IN",
        tone: localStorage.getItem("bala-tone") || "warm-family",
        demoMode: getLocalMetrics()?.source === "BALA demo",
        currentDataSource: inferDataSource(),
      },
    },
  };
  downloadJson(`bala-data-${exportedAt.slice(0, 10)}.json`, payload);
  dataPortabilityStatus.textContent = "BALA data export created locally.";
}

function supportedImportData(payload) {
  if (!payload || payload.format !== EXPORT_FORMAT || payload.version !== EXPORT_VERSION || !payload.data || typeof payload.data !== "object") {
    throw new Error("This file does not look like a supported BALA data export.");
  }
  const { profile, health, symptomCheckIns, settings } = payload.data;
  if (profile !== null && profile !== undefined && (typeof profile !== "object" || Array.isArray(profile) || typeof profile.name !== "string")) {
    throw new Error("The BALA profile in this file is invalid.");
  }
  if (health !== null && health !== undefined && (typeof health !== "object" || Array.isArray(health))) {
    throw new Error("The saved health signals in this file are invalid.");
  }
  if (symptomCheckIns !== undefined && !Array.isArray(symptomCheckIns)) {
    throw new Error("The symptom check-in history in this file is invalid.");
  }
  const numericMetric = (value, min, max) => {
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? number : undefined;
  };
  const cleanMetricRecord = (record, includeHistory = false) => {
    if (!record || typeof record !== "object") return null;
    const cleaned = {
      date: typeof record.date === "string" ? record.date.slice(0, 10) : undefined,
      source: typeof record.source === "string" ? record.source.slice(0, 120) : undefined,
      sleep: numericMetric(record.sleep, 0, 16),
      rhr: numericMetric(record.rhr, 25, 220),
      hrv: numericMetric(record.hrv, 1, 300),
      spo2: numericMetric(record.spo2, 70, 100),
      steps: numericMetric(record.steps, 0, 200000),
      exercise: numericMetric(record.exercise, 0, 1440),
      note: typeof record.note === "string" ? record.note.slice(0, 240) : undefined,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
    };
    if (includeHistory && Array.isArray(record.history)) {
      cleaned.history = record.history
        .slice(-90)
        .map((day) => cleanMetricRecord(day))
        .filter((day) => day?.date);
    }
    return Object.fromEntries(Object.entries(cleaned).filter(([, value]) => value !== undefined));
  };
  const cleanSymptoms = Array.isArray(symptomCheckIns)
    ? symptomCheckIns.slice(-60).map((entry) => ({
      date: typeof entry?.date === "string" ? entry.date : new Date().toISOString(),
      symptoms: Array.isArray(entry?.symptoms)
        ? entry.symptoms.filter((item) => typeof item === "string").slice(0, 10)
        : [],
      note: typeof entry?.note === "string" ? entry.note.slice(0, 240) : "",
    }))
    : [];
  const allowedLanguages = new Set(["en-US", "en-IN", "hi-IN", "te-IN", "es-ES", "ta-IN", "kn-IN", "ml-IN", "mr-IN", "bn-IN"]);
  const allowedTones = new Set(["warm-family", "friendly-coach", "calm-clinical"]);
  return {
    profile: profile ? { name: String(profile.name).trim().slice(0, 40), updatedAt: profile.updatedAt || new Date().toISOString() } : null,
    health: health ? cleanMetricRecord(health, true) : null,
    symptomCheckIns: cleanSymptoms,
    settings: {
      language: allowedLanguages.has(settings?.language) ? settings.language : "en-US",
      tone: allowedTones.has(settings?.tone) ? settings.tone : "warm-family",
      currentDataSource: dataSourceLabels[settings?.currentDataSource] ? settings.currentDataSource : undefined,
    },
  };
}

function restoreBalaData(data) {
  if (data.profile?.name) localStorage.setItem(PROFILE_KEY, JSON.stringify(data.profile));
  else localStorage.removeItem(PROFILE_KEY);
  if (data.health) localStorage.setItem(STORAGE_KEY, JSON.stringify(data.health));
  else localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(SYMPTOM_KEY, JSON.stringify(data.symptomCheckIns));
  localStorage.setItem("bala-language", data.settings.language);
  localStorage.setItem("bala-tone", data.settings.tone);
  if (data.settings.currentDataSource && dataSourceLabels[data.settings.currentDataSource]) {
    localStorage.setItem(DATA_SOURCE_KEY, data.settings.currentDataSource);
  }
}

function scoreBreakdown(metrics, symptomContext = null) {
  const history = Array.isArray(metrics?.history) ? metrics.history.slice(-15) : [];
  const prior = history.slice(0, -1);
  const hrvBase = averageValues(prior.map((day) => day.hrv));
  const rhrBase = averageValues(prior.map((day) => day.rhr));
  const parts = [];
  const add = (key, label, score, weight, note) => {
    if (!Number.isFinite(score)) return;
    parts.push({ key, label, score: clamp(Math.round(score), 25, 100), weight, note });
  };

  if (Number.isFinite(metrics?.sleep)) {
    const sleep = metrics.sleep;
    const sleepScore = sleep >= 7 && sleep <= 9
      ? 92 - Math.abs(8 - sleep) * 4
      : sleep < 7
        ? 92 - (7 - sleep) * 18
        : 88 - (sleep - 9) * 10;
    add("sleep", "Sleep", sleepScore, 32, `${sleep.toFixed(1)}h recorded`);
  }

  if (Number.isFinite(metrics?.hrv)) {
    const hrvRatio = hrvBase ? metrics.hrv / hrvBase : null;
    const hrvScore = hrvRatio
      ? 75 + clamp((hrvRatio - 1) * 70, -40, 20)
      : 75;
    add("hrv", "HRV", hrvScore, 23, hrvBase ? `${Math.round((hrvRatio - 1) * 100)}% vs baseline` : "Baseline building");
  }

  if (Number.isFinite(metrics?.rhr)) {
    const difference = rhrBase ? metrics.rhr - rhrBase : 0;
    const rhrScore = rhrBase ? 82 - clamp(difference * 5, -10, 45) : 76;
    add("rhr", "Resting heart rate", rhrScore, 20, rhrBase ? `${difference >= 0 ? "+" : ""}${Math.round(difference)} bpm vs baseline` : "Baseline building");
  }

  if (Number.isFinite(metrics?.steps) || Number.isFinite(metrics?.exercise)) {
    const stepsScore = Number.isFinite(metrics.steps) ? clamp((metrics.steps / 8000) * 90, 35, 100) : 70;
    const exerciseScore = Number.isFinite(metrics.exercise) ? clamp((metrics.exercise / 30) * 90, 35, 100) : 70;
    add("activity", "Activity", stepsScore * 0.65 + exerciseScore * 0.35, 20, `${Math.round(metrics.steps || 0).toLocaleString()} steps`);
  }

  if (Number.isFinite(metrics?.spo2)) {
    const spo2Score = metrics.spo2 >= 97 ? 90 : metrics.spo2 >= 95 ? 78 : metrics.spo2 >= 92 ? 62 : 45;
    add("spo2", "SpO₂ estimate", spo2Score, 5, `${Math.round(metrics.spo2)}% wearable estimate`);
  }

  const weight = parts.reduce((sum, part) => sum + part.weight, 0);
  let total = weight
    ? Math.round(parts.reduce((sum, part) => sum + part.score * part.weight, 0) / weight)
    : 70;
  const symptoms = symptomContext?.symptoms || [];
  const urgentSymptoms = symptoms.some((item) => ["chest pain", "shortness of breath", "fainting or severe dizziness"].includes(item));
  if (urgentSymptoms) {
    total = Math.min(total, 45);
    parts.unshift({ key: "symptoms", label: "Symptoms check", score: 45, weight: 0, note: "Put symptoms first" });
  } else if (symptoms.length) {
    total = Math.max(25, total - 8);
    parts.unshift({ key: "symptoms", label: "Symptoms check", score: 60, weight: 0, note: symptoms.join(", ") });
  }
  return { total, parts: parts.sort((a, b) => a.score - b.score) };
}

function scoreMetrics(metrics) {
  return scoreBreakdown(metrics).total;
}

function scoreStatus(score) {
  if (score >= 80) return { label: "Strong day", level: "strong", icon: "↑" };
  if (score >= 65) return { label: "Take it easy", level: "steady", icon: "↓" };
  if (score >= 50) return { label: "Recovery needed", level: "recover", icon: "↓" };
  return { label: "Check your signals", level: "check", icon: "!" };
}

function averageValues(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : undefined;
}

const baselineFields = {
  sleep: { label: "Sleep", unit: "h", decimals: 1, threshold: 0.75 },
  rhr: { label: "Resting heart rate", unit: " bpm", decimals: 0, threshold: 5 },
  hrv: { label: "HRV", unit: " ms", decimals: 0, ratioThreshold: 0.15 },
  steps: { label: "Steps", unit: "", decimals: 0, ratioThreshold: 0.2 },
  spo2: { label: "SpO2", unit: "%", decimals: 0, threshold: 1.5 },
};

function validCheckIns(metrics) {
  const history = Array.isArray(metrics?.history) ? metrics.history : [];
  return history
    .filter((entry) => (
      typeof entry?.date === "string"
      && Object.keys(baselineFields).some((key) => Number.isFinite(entry[key]))
    ))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function formatBaselineValue(key, value) {
  if (!Number.isFinite(value)) return "Not available";
  const field = baselineFields[key];
  const formatted = field.decimals ? value.toFixed(field.decimals) : Math.round(value).toLocaleString();
  return `${formatted}${field.unit}`;
}

function baselineComparison(key, latest, average) {
  if (!Number.isFinite(latest) || !Number.isFinite(average)) return null;
  const field = baselineFields[key];
  const difference = latest - average;
  const threshold = field.ratioThreshold ? Math.abs(average) * field.ratioThreshold : field.threshold;
  const direction = Math.abs(difference) < threshold ? "near" : difference > 0 ? "above" : "below";
  const label = direction === "near"
    ? "Near baseline"
    : direction === "above"
      ? "Above recent baseline"
      : "Below recent baseline";
  return { key, direction, label, difference, latest, average };
}

function baselineAnalysis(metrics) {
  const history = validCheckIns(metrics);
  const baselineCheckIns = history.slice(-3);
  const latest = history.at(-1) || metrics;
  const averages = Object.fromEntries(
    Object.keys(baselineFields).map((key) => [key, averageValues(baselineCheckIns.map((day) => day[key]))]),
  );
  const comparisons = Object.keys(baselineFields)
    .map((key) => baselineComparison(key, latest?.[key], averages[key]))
    .filter(Boolean);
  const changed = comparisons.filter((item) => item.direction !== "near");
  const ready = baselineCheckIns.length >= 3;
  if (!ready) {
    return {
      ready,
      days: history.length,
      level: "Baseline building",
      copy: "Add 3 check-ins to build your first BALA baseline.",
      averages,
      comparisons: [],
      history,
      timeline: history.slice(-5).reverse(),
    };
  }
  const changeCopy = changed.length
    ? `${changed.map((item) => `${baselineFields[item.key].label} is ${item.direction} your recent baseline`).join("; ")}.`
    : "Your latest supported signals are near your recent baseline.";
  return {
    ready,
    days: history.length,
    level: changed.length ? "Recent pattern changed" : "Near your baseline",
    copy: changeCopy,
    averages,
    comparisons,
    history,
    timeline: history.slice(-5).reverse(),
  };
}

function weeklyTrend(key, history, average, baselineAverage) {
  const values = history.filter((entry) => Number.isFinite(entry[key]));
  if (values.length < 3 || !Number.isFinite(average)) return { key, label: "Not enough data", direction: "unknown" };
  const split = Math.max(1, Math.floor(values.length / 2));
  const earlier = averageValues(values.slice(0, split).map((entry) => entry[key]));
  const recent = averageValues(values.slice(split).map((entry) => entry[key]));
  if (!Number.isFinite(earlier) || !Number.isFinite(recent)) return { key, label: "Not enough data", direction: "unknown" };
  const ratio = earlier ? (recent - earlier) / Math.abs(earlier) : 0;
  const smallChange = key === "sleep" ? 0.06 : key === "rhr" || key === "spo2" ? 0.03 : 0.1;
  if (Math.abs(ratio) < smallChange) {
    if (Number.isFinite(baselineAverage)) {
      const comparison = baselineComparison(key, average, baselineAverage);
      if (comparison?.direction === "below") return { key, label: "Lower than usual", direction: "lower" };
      if (comparison?.direction === "above") return { key, label: "Higher than usual", direction: "higher" };
    }
    return { key, label: "Steady", direction: "steady" };
  }
  const improving = key === "rhr" ? ratio < 0 : ratio > 0;
  return improving
    ? { key, label: "Improving", direction: "improving" }
    : ratio < 0
      ? { key, label: "Lower than usual", direction: "lower" }
      : { key, label: "Higher than usual", direction: "higher" };
}

function weeklyPatternsAnalysis(metrics) {
  const history = validCheckIns(metrics).slice(-7);
  const baseline = baselineAnalysis(metrics);
  const averages = Object.fromEntries(
    Object.keys(baselineFields).map((key) => [key, averageValues(history.map((entry) => entry[key]))]),
  );
  const trends = Object.fromEntries(
    Object.keys(baselineFields).map((key) => [
      key,
      weeklyTrend(key, history, averages[key], baseline.averages[key]),
    ]),
  );
  if (history.length < 3) {
    return {
      ready: false,
      history,
      averages,
      trends,
      insights: ["Add a few more check-ins to see weekly patterns."],
      focus: {
        label: "Add more check-ins",
        copy: "A few more check-ins will help BALA offer a pattern-aware focus.",
      },
    };
  }

  const insights = [];
  const baselineCount = (key, direction) => {
    const baselineAverage = baseline.averages[key];
    if (!Number.isFinite(baselineAverage)) return 0;
    return history.filter((entry) => baselineComparison(key, entry[key], baselineAverage)?.direction === direction).length;
  };
  if (trends.sleep.direction === "lower") insights.push("Your sleep has been trending lower across recent check-ins.");
  else if (baselineCount("sleep", "below") >= 2) insights.push("Your sleep has been lower than your recent baseline on multiple check-ins.");
  else if (trends.sleep.direction === "improving") insights.push("Your recorded sleep has been moving closer to a steadier pattern.");
  else insights.push("Your sleep has been fairly steady across recent check-ins.");

  if (trends.steps.direction === "lower") insights.push("Your steps are trending lower this week.");
  else if (trends.steps.direction === "improving") insights.push("Your steps have been gradually increasing across recent check-ins.");
  else insights.push("Your activity has stayed close to its recent weekly pattern.");

  if (trends.hrv.direction === "lower") insights.push("Your HRV has been trending lower across recent check-ins.");
  else if (baselineCount("hrv", "below") >= 2) insights.push("Your HRV has been below your recent baseline on multiple check-ins.");
  else insights.push("Your HRV has been close to your recent pattern.");

  if (trends.rhr.direction === "higher") insights.push("Your resting heart rate has been trending higher across recent check-ins.");
  else if (baselineCount("rhr", "above") >= 2) insights.push("Your resting heart rate has been higher than your baseline recently.");
  else insights.push("Your resting heart rate has been close to your recent pattern.");

  if (baselineCount("spo2", "below") >= 2) insights.push("Your wearable SpO2 estimates have been lower than your recent pattern on multiple check-ins.");
  else insights.push("Your SpO2 readings look close to your recent pattern.");

  const sleepNeedsFocus = baselineCount("sleep", "below") >= 2 || trends.sleep.direction === "lower";
  const rhrNeedsFocus = baselineCount("rhr", "above") >= 2 || trends.rhr.direction === "higher";
  const hrvNeedsFocus = baselineCount("hrv", "below") >= 2 || trends.hrv.direction === "lower";
  const stepsNeedFocus = trends.steps.direction === "lower" || baselineCount("steps", "below") >= 2;
  let focus = {
    label: "Keep current routine",
    copy: "Your recent supported signals look fairly steady. Keep the routines that feel sustainable.",
  };
  if (sleepNeedsFocus) {
    focus = {
      label: "Sleep recovery",
      copy: "Protect a consistent wind-down, regular meals, hydration, and a lighter evening.",
    };
  } else if (rhrNeedsFocus) {
    focus = {
      label: "Hydration and rest",
      copy: "Give recovery more room with regular fluids, rest, and a check-in with how you feel.",
    };
  } else if (hrvNeedsFocus) {
    focus = {
      label: "Breathing and stress balance",
      copy: "Choose a few minutes of slow breathing, gentle movement, hydration, and sleep focus.",
    };
  } else if (stepsNeedFocus) {
    focus = {
      label: "Lighter movement",
      copy: "Try a comfortable walk or light mobility if you feel well, without chasing a number.",
    };
  }
  return { ready: true, history, averages, trends, insights: insights.slice(0, 5), focus };
}

function timelineSummary(metrics) {
  const baseline = baselineAnalysis(metrics);
  const lines = [
    "BALA DOCTOR-READY SUMMARY",
    `Generated: ${new Date().toLocaleString()}`,
    "",
    "This is a personal health-awareness summary of body signals you entered.",
    "It is not medical advice and does not replace a healthcare professional.",
    ...(metrics?.source === "BALA demo"
      ? ["", "NOTE: Sample demo data — not your own readings."]
      : []),
    "",
    "BASELINE (latest 3 check-ins)",
    baseline.ready
      ? Object.entries(baseline.averages)
        .filter(([, value]) => Number.isFinite(value))
        .map(([key, value]) => `${baselineFields[key].label} ${formatBaselineValue(key, value)}`)
        .join(", ")
      : "Add 3 check-ins to build your first BALA baseline.",
    "",
    "RECENT TREND",
    baseline.copy,
    "",
    "LAST 5 CHECK-INS",
    ...(baseline.timeline.length
      ? baseline.timeline.map((entry) => {
        const signals = Object.keys(baselineFields)
          .filter((key) => Number.isFinite(entry[key]))
          .map((key) => `${baselineFields[key].label} ${formatBaselineValue(key, entry[key])}`);
        const note = entry.note ? `; note: ${String(entry.note).slice(0, 240)}` : "";
        return `- ${entry.date}: ${signals.join(", ") || "No supported signal values"}${note}`;
      })
      : ["- No valid check-ins yet."]),
    "",
    "TO SHARE WITH YOUR HEALTHCARE PROFESSIONAL (your notes — not medical advice)",
    "- How you have been feeling and anything you noticed",
    "- Any changes in sleep, activity, or how you have been resting",
    "- Anything you would like to ask",
    "",
    "BALA organizes supported signals for awareness. It does not provide diagnosis or replace professional care. Talk to a healthcare professional if you are concerned.",
  ];
  return lines.join("\n");
}

const TIMELINE_COLLAPSED_COUNT = 5;
const TIMELINE_EXPANDED_COUNT = 30;
const TIMELINE_STEP = 30;
let timelineShownCount = TIMELINE_COLLAPSED_COUNT;
let manageHistory = false;
let editingDate = null;

function renderBaselineAndTimeline(metrics) {
  const baseline = baselineAnalysis(metrics);
  document.querySelector("#baseline-days").textContent = `${baseline.days} check-in${baseline.days === 1 ? "" : "s"}`;
  document.querySelector("#baseline-level").textContent = baseline.level;
  document.querySelector("#baseline-copy").textContent = baseline.copy;

  const averagesNode = document.querySelector("#baseline-averages");
  averagesNode.replaceChildren();
  if (baseline.ready) {
    Object.entries(baselineFields).forEach(([key, field]) => {
      const item = document.createElement("div");
      const label = document.createElement("span");
      const value = document.createElement("strong");
      label.textContent = field.label;
      value.textContent = formatBaselineValue(key, baseline.averages[key]);
      item.append(label, value);
      averagesNode.append(item);
    });
  } else {
    const empty = document.createElement("p");
    empty.className = "baseline-empty";
    empty.textContent = "Add 3 check-ins to build your first BALA baseline.";
    averagesNode.append(empty);
  }

  document.querySelector("#change-summary-copy").textContent = baseline.ready
    ? baseline.copy
    : "Add 3 check-ins to compare your latest signals with your baseline.";
  const labelsNode = document.querySelector("#change-labels");
  labelsNode.replaceChildren();
  baseline.comparisons.forEach((comparison) => {
    const item = document.createElement("div");
    item.className = `change-label ${comparison.direction}`;
    const signal = document.createElement("strong");
    const label = document.createElement("span");
    signal.textContent = baselineFields[comparison.key].label;
    label.textContent = comparison.label;
    item.append(signal, label);
    labelsNode.append(item);
  });

  const isDemoRecord = metrics?.source === "BALA demo";
  const orderedHistory = baseline.history.slice().reverse();
  const total = orderedHistory.length;
  const shownEntries = orderedHistory.slice(0, Math.min(total, timelineShownCount));
  const shown = shownEntries.length;
  const canManage = !isDemoRecord && total > 0;
  if (!canManage) manageHistory = false;

  const countLabel = document.querySelector("#timeline-count-label");
  if (countLabel) {
    countLabel.textContent = total > shown
      ? `Latest ${shown} of ${total} check-ins`
      : total
        ? `Last ${total} check-in${total === 1 ? "" : "s"}`
        : "No check-ins yet";
  }

  const toggle = document.querySelector("#timeline-toggle");
  if (toggle) {
    if (total > TIMELINE_COLLAPSED_COUNT) {
      toggle.hidden = false;
      const allVisible = shown >= total;
      toggle.textContent = allVisible ? "Show fewer check-ins" : "Show more check-ins";
      toggle.setAttribute("aria-expanded", shown > TIMELINE_COLLAPSED_COUNT ? "true" : "false");
    } else {
      toggle.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }
  }

  const manageToggle = document.querySelector("#manage-history-toggle");
  if (manageToggle) {
    manageToggle.hidden = !canManage;
    manageToggle.textContent = manageHistory ? "Done" : "Manage history";
    manageToggle.setAttribute("aria-pressed", manageHistory ? "true" : "false");
  }

  const timelineNode = document.querySelector("#timeline-list");
  timelineNode.replaceChildren();
  if (!shownEntries.length) {
    const empty = document.createElement("p");
    empty.className = "timeline-empty";
    empty.textContent = "Add your first check-in above to start your private history. Recent check-ins appear here and stay on this device.";
    timelineNode.append(empty);
    return;
  }
  shownEntries.forEach((entry) => {
    const item = document.createElement("article");
    const header = document.createElement("header");
    const date = document.createElement("strong");
    const source = document.createElement("span");
    date.textContent = new Date(`${entry.date}T00:00:00`).toLocaleDateString([], { dateStyle: "medium" });
    source.textContent = entry.source || (isDemoRecord ? "Demo data" : "Local check-in");
    header.append(date, source);
    const signals = document.createElement("p");
    signals.textContent = Object.keys(baselineFields)
      .filter((key) => Number.isFinite(entry[key]))
      .map((key) => `${baselineFields[key].label}: ${formatBaselineValue(key, entry[key])}`)
      .join(" · ");
    item.append(header, signals);
    if (entry.note) {
      const note = document.createElement("small");
      note.textContent = `Note: ${String(entry.note).slice(0, 240)}`;
      item.append(note);
    }
    if (canManage && manageHistory) {
      const entryDate = entry.date;
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "timeline-edit";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => openEditCheckIn(entryDate));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "timeline-remove";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => removeCheckIn(entryDate));
      const actions = document.createElement("div");
      actions.className = "timeline-row-actions";
      actions.append(edit, remove);
      item.append(actions);
    }
    timelineNode.append(item);
  });
}

// SNAPSHOT_SYNC_START
function alignLatestSnapshot(record) {
  const snapshotFields = ["source", "sleep", "rhr", "hrv", "steps", "spo2", "exercise", "note"];
  const history = (Array.isArray(record.history) ? record.history : [])
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const withoutSnapshot = Object.fromEntries(
    Object.entries(record).filter(([key]) => !snapshotFields.includes(key)),
  );
  const latest = history.at(-1);
  const snapshot = latest
    ? Object.fromEntries(snapshotFields.filter((key) => latest[key] !== undefined).map((key) => [key, latest[key]]))
    : {};
  return { ...withoutSnapshot, ...snapshot, history };
}
// SNAPSHOT_SYNC_END

function removeCheckIn(date) {
  const existing = getLocalMetrics();
  if (!existing || existing.source === "BALA demo") return;
  const niceDate = new Date(`${date}T00:00:00`).toLocaleDateString([], { dateStyle: "medium" });
  if (!window.confirm(`Remove your check-in from ${niceDate}? This can't be undone.`)) return;
  const history = (Array.isArray(existing.history) ? existing.history : []).filter((entry) => entry.date !== date);
  if (!history.length) {
    localStorage.removeItem(STORAGE_KEY);
    manageHistory = false;
    updateDashboard(null);
    return;
  }
  const stored = alignLatestSnapshot({
    ...existing,
    history,
    updatedAt: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  updateDashboard(stored);
}

const CAPTURE_FIELDS = ["sleep", "rhr", "hrv", "spo2", "steps", "exercise", "note"];

function localToday() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function resetCaptureMode() {
  editingDate = null;
  const title = document.querySelector("#capture-title");
  if (title) title.textContent = "Add today’s metrics";
  const editNote = document.querySelector("#capture-edit-note");
  if (editNote) {
    editNote.hidden = true;
    editNote.textContent = "";
  }
  const dateField = document.querySelector("#capture-date-field");
  const dateInput = document.querySelector("#capture-date");
  if (dateField) dateField.hidden = false;
  if (dateInput) {
    dateInput.max = localToday();
    dateInput.value = localToday();
  }
}

function openEditCheckIn(date) {
  const metrics = getLocalMetrics();
  if (!metrics || metrics.source === "BALA demo") return;
  const entry = (Array.isArray(metrics.history) ? metrics.history : []).find((item) => item.date === date);
  if (!entry) return;
  editingDate = date;
  CAPTURE_FIELDS.forEach((name) => {
    const field = captureForm.elements.namedItem(name);
    if (field) field.value = entry[name] !== undefined ? entry[name] : "";
  });
  const title = document.querySelector("#capture-title");
  if (title) title.textContent = "Edit check-in";
  const editNote = document.querySelector("#capture-edit-note");
  if (editNote) {
    editNote.textContent = `Editing your check-in from ${new Date(`${date}T00:00:00`).toLocaleDateString([], { dateStyle: "medium" })}`;
    editNote.hidden = false;
  }
  const dateField = document.querySelector("#capture-date-field");
  if (dateField) dateField.hidden = true;
  captureDialog.showModal();
}

function renderWeeklyPatterns(metrics) {
  const weekly = weeklyPatternsAnalysis(metrics);
  document.querySelector("#weekly-count").textContent = `${weekly.history.length} check-in${weekly.history.length === 1 ? "" : "s"}`;
  document.querySelector("#weekly-patterns-copy").textContent = weekly.ready
    ? "A calm summary of up to your latest 7 valid check-ins."
    : "Add a few more check-ins to see weekly patterns.";

  const averagesNode = document.querySelector("#weekly-averages");
  averagesNode.replaceChildren();
  Object.entries(baselineFields).forEach(([key, field]) => {
    const item = document.createElement("div");
    const header = document.createElement("span");
    const value = document.createElement("strong");
    const trend = document.createElement("small");
    header.textContent = field.label;
    value.textContent = formatBaselineValue(key, weekly.averages[key]);
    trend.className = `weekly-trend ${weekly.trends[key].direction}`;
    trend.textContent = weekly.trends[key].label;
    item.append(header, value, trend);
    averagesNode.append(item);
  });

  const insightsNode = document.querySelector("#pattern-insights-list");
  insightsNode.replaceChildren();
  weekly.insights.forEach((insight) => {
    const item = document.createElement("li");
    item.textContent = insight;
    insightsNode.append(item);
  });

  document.querySelector("#weekly-focus-label").textContent = weekly.focus.label;
  document.querySelector("#weekly-focus-copy").textContent = weekly.focus.copy;
}

async function copyTimelineSummary() {
  const status = document.querySelector("#timeline-status");
  const metrics = getLocalMetrics();
  if (!metrics || !validCheckIns(metrics).length) {
    status.textContent = "Add a valid check-in before copying a timeline.";
    return;
  }
  const summary = timelineSummary(metrics);
  try {
    await navigator.clipboard.writeText(summary);
    status.textContent = "Timeline summary copied. Share it only with someone you trust.";
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = summary;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    textarea.remove();
    if (copied) {
      status.textContent = "Timeline summary copied. Share it only with someone you trust.";
      return;
    }
    dialogLabel.textContent = "Timeline summary";
    dialogTitle.textContent = "Select and copy your timeline";
    const wrapper = document.createElement("div");
    wrapper.className = "source-list";
    const copy = document.createElement("p");
    copy.textContent = "Automatic clipboard access is unavailable in this browser. Select the local summary below and copy it manually.";
    const manual = document.createElement("textarea");
    manual.className = "timeline-copy-fallback";
    manual.value = summary;
    manual.setAttribute("readonly", "");
    wrapper.append(copy, manual);
    dialogContentNode.replaceChildren(wrapper);
    dialog.showModal();
    manual.focus();
    manual.select();
    status.textContent = "Automatic copy was unavailable. The timeline is selected for manual copying.";
  }
}

function downloadTimelineSummary() {
  const status = document.querySelector("#timeline-status");
  const metrics = getLocalMetrics();
  if (!metrics || !validCheckIns(metrics).length) {
    status.textContent = "Add a valid check-in before downloading.";
    return;
  }
  const filename = `bala-doctor-ready-${new Date().toISOString().slice(0, 10)}.txt`;
  downloadText(filename, timelineSummary(metrics), "text/plain");
  status.textContent = "Summary downloaded. Share only with someone you trust.";
}

function buildRecommendation(metrics, symptomContext = getRecentSymptoms()) {
  const symptoms = symptomContext?.symptoms || [];
  const note = String(metrics?.note || "").trim();
  const history = Array.isArray(metrics?.history) ? metrics.history.slice(0, -1).slice(-14) : [];
  const rhrBase = averageValues(history.map((day) => day.rhr));
  const hrvBase = averageValues(history.map((day) => day.hrv));
  const higherRhr = Number.isFinite(metrics?.rhr) && (rhrBase ? metrics.rhr >= rhrBase + 8 : metrics.rhr >= 75);
  const lowerHrv = Number.isFinite(metrics?.hrv) && (hrvBase ? metrics.hrv < hrvBase * 0.75 : metrics.hrv < 35);
  if (symptoms.some((item) => ["chest pain", "shortness of breath", "fainting or severe dizziness"].includes(item))) {
    return {
      title: "Pause and put your symptoms first",
      copy: "Your latest check-in includes an urgent symptom. Stop routine coaching and seek timely medical help, especially if it is new, severe, or worsening.",
    };
  }
  if (symptoms.length) {
    return {
      title: "Choose a gentler day and check in again",
      copy: `You recorded ${symptoms.join(", ")}. Keep activity comfortable, support rest and hydration, and notice whether the symptom improves or persists.`,
    };
  }
  if (note && /chest pain|shortness of breath|faint|severe dizziness|blue lips|confusion/i.test(note)) {
    return {
      title: "Put your symptoms ahead of the numbers",
      copy: "Your note describes a potentially concerning symptom. Contact a healthcare professional promptly, and seek urgent medical help if symptoms are severe, new, or worsening.",
    };
  }
  if (Number.isFinite(metrics?.spo2) && metrics.spo2 < 95) {
    return {
      title: "Recheck your oxygen estimate and how you feel",
      copy: "Your wearable SpO2 estimate is lower than expected. Check device fit and measurement conditions, and contact a healthcare professional if readings stay low or you have concerning symptoms.",
    };
  }
  if (metrics.sleep && metrics.sleep < 6.5) {
    return {
      title: "Choose recovery over intensity today",
      copy: "Your recorded sleep was short. Favor an easy walk, regular meals, hydration, and an earlier wind-down.",
    };
  }
  if (higherRhr) {
    return {
      title: "Give recovery a little more room today",
      copy: "Your resting heart rate is higher than your recent pattern or usual wellness range. Favor rest, hydration, a stress check, and comfortable activity while you monitor the trend.",
    };
  }
  if (lowerHrv) {
    return {
      title: "Choose a lighter recovery-focused day",
      copy: "Your HRV is lower than your recent pattern or still building a baseline. Focus on sleep, gentle movement, hydration, and a few minutes of slow breathing.",
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
    metrics?.note && `your note: "${String(metrics.note).slice(0, 120)}"`,
  ].filter(Boolean);
}

function coachResponseCore(question, metrics) {
  const normalized = question.toLowerCase().trim();
  const symptomContext = getRecentSymptoms();
  const recentSymptoms = symptomContext?.symptoms || [];
  const symptomText = recentSymptoms.length ? recentSymptoms.join(", ") : "";
  const name = getUserName();
  if (/^(hi|hello|hey|hiya|namaste|good morning|good afternoon|good evening)[!. ]*$/.test(normalized)) {
    const greetings = {
      "hi-IN": "नमस्ते! मैं BALA हूँ, आपका निजी स्वास्थ्य मार्गदर्शक। आप नींद, HRV, आराम की हृदय गति, ऑक्सीजन, तनाव या आज क्या करना है, पूछ सकते हैं।",
      "te-IN": "నమస్తే! నేను BALA, మీ వ్యక్తిగత ఆరోగ్య మార్గదర్శిని. నిద్ర, HRV, విశ్రాంతి హృదయ స్పందన, ఆక్సిజన్, ఒత్తిడి లేదా ఈ రోజు ఏమి చేయాలో అడగండి.",
      "ta-IN": "வணக்கம்! நான் BALA, உங்கள் தனிப்பட்ட நல வழிகாட்டி. தூக்கம், HRV, ஓய்வு இதயத் துடிப்பு, ஆக்சிஜன், மனஅழுத்தம் அல்லது இன்று என்ன செய்யலாம் என்று கேளுங்கள்.",
      "kn-IN": "ನಮಸ್ಕಾರ! ನಾನು BALA, ನಿಮ್ಮ ಖಾಸಗಿ ಆರೋಗ್ಯ ಮಾರ್ಗದರ್ಶಿ. ನಿದ್ರೆ, HRV, ವಿಶ್ರಾಂತಿ ಹೃದಯಬಡಿತ, ಆಮ್ಲಜನಕ, ಒತ್ತಡ ಅಥವಾ ಇಂದು ಏನು ಮಾಡಬೇಕು ಎಂದು ಕೇಳಿ.",
      "ml-IN": "നമസ്കാരം! ഞാൻ BALA, നിങ്ങളുടെ സ്വകാര്യ ആരോഗ്യ സഹായി. ഉറക്കം, HRV, വിശ്രമ ഹൃദയമിടിപ്പ്, ഓക്സിജൻ, സമ്മർദ്ദം, അല്ലെങ്കിൽ ഇന്ന് എന്ത് ചെയ്യണം എന്ന് ചോദിക്കാം.",
      "mr-IN": "नमस्कार! मी BALA, तुमचा खाजगी आरोग्य मार्गदर्शक. झोप, HRV, विश्रांतीतील हृदयगती, ऑक्सिजन, ताण किंवा आज काय करावे ते विचारा.",
      "bn-IN": "নমস্কার! আমি BALA, আপনার ব্যক্তিগত স্বাস্থ্য সহায়ক। ঘুম, HRV, বিশ্রামের হৃদস্পন্দন, অক্সিজেন, চাপ বা আজ কী করা উচিত জিজ্ঞাসা করুন।",
    };
    return greetings[coachLanguage.value] || "Hi! I’m BALA, your private health guide. Ask me about your sleep, HRV, resting heart rate, blood oxygen, readiness, stress, hydration, steps, or what to do today.";
  }
  if (/^(thanks|thank you|thx|okay|ok|cool|great)[!. ]*$/.test(normalized)) {
    return "You’re welcome. I’m here whenever you want to understand a health signal or choose one sensible next step.";
  }
  if (/who are you|what are you|your name/.test(normalized)) {
    return "I’m BALA, a private on-device wellness coach. I explain supported body signals and suggest small, conservative actions for health awareness.";
  }
  if (/what can you do|help me|how can you help/.test(normalized)) {
    return "I can explain sleep, HRV, resting heart rate, SpO₂, readiness, stress, hydration, steps, and exercise using your imported metrics. Try asking, “Why is my sleep low?” or “What should I do today?”";
  }
  if (!metrics) {
    return `${name ? `${name}, ` : ""}add today's metrics or import your Apple Health ZIP, then I can explain your local values.`;
  }
  const evidence = metricEvidence(metrics).join(", ") || "the values you recorded";
  const history = Array.isArray(metrics.history) ? metrics.history.slice(0, -1).slice(-14) : [];
  const rhrBase = averageValues(history.map((day) => day.rhr));
  const hrvBase = averageValues(history.map((day) => day.hrv));
  const baseline = baselineAnalysis(metrics);
  const weekly = weeklyPatternsAnalysis(metrics);

  if (/how was my week|what patterns|weekly pattern|this week|am i improving|improv|focus on this week|focus this week/.test(normalized)) {
    if (!weekly.ready) return "Add a few more check-ins to see weekly patterns. With at least 3 valid check-ins, I can summarize recent averages, pattern directions, and one simple focus.";
    const trendSummary = Object.entries(weekly.trends)
      .filter(([, trend]) => trend.direction !== "unknown")
      .map(([key, trend]) => `${baselineFields[key].label}: ${trend.label.toLowerCase()}`)
      .join("; ");
    if (/focus/.test(normalized)) {
      return `${weekly.focus.label}. ${weekly.focus.copy} I based this on up to your latest 7 valid check-ins and your personal baseline.`;
    }
    if (/improv/.test(normalized)) {
      const improving = Object.entries(weekly.trends)
        .filter(([, trend]) => trend.direction === "improving")
        .map(([key]) => baselineFields[key].label);
      return improving.length
        ? `${improving.join(", ")} ${improving.length === 1 ? "is" : "are"} moving in a more supportive direction across your recent check-ins. Other signals are summarized as ${trendSummary}. Patterns can vary, so use this for awareness rather than a medical conclusion.`
        : `I do not see a clear improving direction yet. Your recent pattern is ${trendSummary}. Keep adding consistent check-ins so the weekly view becomes more useful.`;
    }
    return `Across ${weekly.history.length} recent check-ins: ${weekly.insights.join(" ")} Your next 24-hour focus is ${weekly.focus.label.toLowerCase()}. ${weekly.focus.copy}`;
  }

  if (/what changed|compared? to (my )?baseline|how am i compared|baseline|recent trend/.test(normalized)) {
    if (!baseline.ready) return "Add 3 check-ins to build your first BALA baseline. Then I can compare your latest sleep, resting heart rate, HRV, steps, and SpO2 with your recent pattern.";
    const comparisons = baseline.comparisons.length
      ? baseline.comparisons.map((item) => `${baselineFields[item.key].label} is ${item.label.toLowerCase()}`).join("; ")
      : "No comparable supported signals were found in the latest check-in.";
    return `Your BALA baseline uses your latest 3 valid check-ins. ${comparisons}. ${baseline.copy} Use this as personal pattern awareness, not a medical conclusion.`;
  }

  if (/tell my doctor|tell a doctor|doctor|clinician|healthcare professional/.test(normalized)) {
    const recent = baseline.timeline;
    if (!recent.length) return "There are no valid check-ins to summarize yet. Add dated signals and symptom notes, then BALA can organize them for a healthcare conversation.";
    const dates = recent.map((entry) => entry.date).join(", ");
    const change = baseline.ready ? baseline.copy : "Your baseline is still building.";
    return `You can share that BALA has ${recent.length} recent check-in${recent.length === 1 ? "" : "s"} dated ${dates}. Mention the recorded sleep, resting heart rate, HRV, steps, SpO2 estimates, and any symptom notes. ${change} Use the Doctor-Ready Timeline for the exact values, and describe any persistent or concerning symptoms directly to the healthcare professional.`;
  }

  if (/symptom|feel|feeling|unwell|pain|dizz|faint|breath|palpitation|fatigue|fever/.test(normalized)) {
    if (!recentSymptoms.length) return "I do not have a recent symptom check-in yet. Add one so I can consider how you feel alongside sleep, recovery, heart, and activity signals.";
    const urgent = recentSymptoms.some((item) => ["chest pain", "shortness of breath", "fainting or severe dizziness"].includes(item));
    if (urgent) return `Your latest check-in includes ${symptomText}. Put the symptom ahead of the wearable numbers. If it is new, severe, or worsening, seek urgent medical help now.`;
    return `Your latest check-in includes ${symptomText}. Pair that with ${evidence}. Choose a lighter day, hydrate, rest, and check again later. If the symptom persists or worries you, contact a qualified clinician.`;
  }

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
    const context = hrvBase
      ? metrics.hrv < hrvBase * 0.75
        ? `This is lower than your recent average of ${Math.round(hrvBase)} ms.`
        : `Your recent average is ${Math.round(hrvBase)} ms.`
      : "Your personal baseline is still building.";
    return `Your latest HRV is ${Math.round(metrics.hrv)} ms. ${context} HRV varies widely between people. If it is low for you, favor recovery, slow breathing, lighter activity, hydration, and sleep focus.`;
  }

  if (/heart|rhr|pulse/.test(normalized)) {
    if (!metrics.rhr) return "No resting heart-rate value was found in your latest import. A multi-day trend is more useful than one reading.";
    const context = rhrBase
      ? metrics.rhr >= rhrBase + 8
        ? `That is higher than your recent average of ${Math.round(rhrBase)} bpm.`
        : `Your recent average is ${Math.round(rhrBase)} bpm.`
      : "Your personal baseline is still building.";
    return `Your latest resting heart rate is ${Math.round(metrics.rhr)} bpm. ${context} A higher value can accompany stress, dehydration, illness, short sleep, or recent exertion. Rest, hydrate, check your stress and symptoms, and monitor the trend. Contact a healthcare professional for persistent unusual readings or concerning symptoms.`;
  }

  if (/oxygen|spo2|blood oxygen/.test(normalized)) {
    if (!metrics.spo2) return "No blood-oxygen estimate was found in your latest import. Wearable SpO2 is a wellness estimate and can be affected by fit, movement, skin temperature, and circulation.";
    return `Your latest wearable SpO2 estimate is ${Math.round(metrics.spo2)}%. Treat it as one body signal and look for a consistent pattern. Recheck watch fit and measurement conditions. Seek medical advice for persistent unusual readings or symptoms such as shortness of breath, chest pain, confusion, or blue lips.`;
  }

  if (/stress|anxious|calm|relax/.test(normalized)) {
    return `Your latest record includes ${evidence}. Wearables cannot measure stress directly, but short sleep, a higher resting heart rate, and lower-than-usual HRV can accompany strain. Take five slow minutes, hydrate, and choose light movement. Persistent anxiety or concerning symptoms deserve professional support.`;
  }

  if (/hydr|water|drink/.test(normalized)) {
    return "BALA does not have enough data to calculate an exact fluid target. Drink regularly with meals and activity, use thirst and pale-yellow urine as practical cues, and increase fluids during heat or prolonged exercise. Medical conditions can change fluid needs.";
  }

  if (/readiness|recover|score/.test(normalized)) {
    const breakdown = scoreBreakdown(metrics, symptomContext);
    const lowest = breakdown.parts.slice(0, 2).map((part) => `${part.label.toLowerCase()} ${part.score}`).join(" and ");
    const context = recentSymptoms.length ? ` Your recent check-in also includes ${symptomText}.` : "";
    const trend = baseline.ready ? ` Compared with your recent baseline, ${baseline.copy.toLowerCase()}` : " Your 3-check-in baseline is still building.";
    const weeklyContext = weekly.ready ? ` Your weekly focus is ${weekly.focus.label.toLowerCase()}.` : "";
    return `Your BALA score is ${breakdown.total}. It is calculated from the signals available today, with the most attention on sleep, HRV, resting heart rate, and activity. The lower contributors are ${lowest || "still building a baseline"}.${trend}${weeklyContext}${context} Use it to pace the day, not as a medical conclusion.`;
  }

  if (/step|walk|activity|exercise|workout|today|do/.test(normalized)) {
    const recommendation = buildRecommendation(metrics, symptomContext);
    return `${recommendation.title}. ${recommendation.copy} I used ${evidence}. Stop activity and seek appropriate care if you feel unwell.`;
  }

  const recommendation = buildRecommendation(metrics, symptomContext);
  const symptomContextCopy = recentSymptoms.length ? ` Your recent check-in includes ${symptomText}.` : "";
  return `${recommendation.title}. ${recommendation.copy} I based this on ${evidence}.${symptomContextCopy} Ask me about any one signal for a more focused explanation.`;
}

function coachResponse(question, metrics) {
  const normalized = question.toLowerCase().trim();
  const urgentTerms = /\b(chest pain|severe shortness of breath|fainting|emergency|severe symptoms?)\b/;
  if (urgentTerms.test(normalized)) {
    return "BALA is not an emergency service. If you may be experiencing urgent symptoms, seek emergency care or contact local emergency services now.";
  }

  const directAnswer = coachResponseCore(question, metrics);
  const isGreeting = /^(hi|hello|hey|hiya|namaste|good morning|good afternoon|good evening|thanks|thank you|thx|okay|ok|cool|great)[!. ]*$/.test(normalized);
  const simpleExchange = isGreeting
    || /who are you|what are you|your name|what can you do|help me|how can you help/.test(normalized);
  const languageNote = coachLanguage.value === "en-US" || isGreeting ? "" : "\n\nCoaching responses are in English. Greetings and basic responses are available in your selected language.";
  if (!metrics || simpleExchange) return `${directAnswer}${languageNote}`;

  const name = getUserName();
  const symptomContext = getRecentSymptoms();
  const symptoms = symptomContext?.symptoms || [];
  const baseline = baselineAnalysis(metrics);
  const weekly = weeklyPatternsAnalysis(metrics);
  const recommendation = buildRecommendation(metrics, symptomContext);
  const breakdown = scoreBreakdown(metrics, symptomContext);
  const source = dataSourceLabels[inferDataSource(metrics)] || "Local health data";
  const evidence = metricEvidence(metrics).slice(0, 5);
  const contextParts = [
    `BALA Score ${breakdown.total}`,
    `data source ${source}`,
    evidence.length ? `latest signals: ${evidence.join(", ")}` : "",
    baseline.ready ? `baseline: ${baseline.copy}` : "baseline: still building",
    weekly.ready ? `weekly pattern: ${weekly.insights.slice(0, 2).join(" ")}` : "weekly pattern: add a few more check-ins",
    metrics.note ? `your note: "${String(metrics.note).slice(0, 120)}"` : "",
  ].filter(Boolean);
  const gentleNext = weekly.ready
    ? `${weekly.focus.label}. ${weekly.focus.copy} Today's Guide also suggests: ${recommendation.title.toLowerCase()}.`
    : `${recommendation.title}. ${recommendation.copy}`;
  const needsSafetyNote = symptoms.length > 0
    || (Number.isFinite(metrics.spo2) && metrics.spo2 < 95)
    || /doctor|clinician|healthcare professional|symptom|unwell|pain|dizz|breath|palpitation|fever/.test(normalized);
  const safetyNote = needsSafetyNote
    ? "\n\nSafety note: BALA supports health awareness and does not diagnose or replace professional care. If you feel unwell or concerned, consider contacting a healthcare professional."
    : "";

  const contextSummary = contextParts
    .map((part) => part.replace(/[.\s]+$/, ""))
    .join(". ");
  return `${name ? `${name}, ` : ""}${directAnswer}\n\nWhat your signals show: ${contextSummary}.\n\nGentle next step: ${gentleNext}${safetyNote}${languageNote}`;
}

function updateDashboard(metrics) {
  if (!metrics) {
    renderBaselineAndTimeline(null);
    renderWeeklyPatterns(null);
    return;
  }
  const currentSource = inferDataSource(metrics);
  const currentSourceLabel = setCurrentDataSource(currentSource);
  const symptomContext = getRecentSymptoms();
  const breakdown = scoreBreakdown(metrics, symptomContext);
  const score = breakdown.total;
  const symptoms = symptomContext?.symptoms || [];
  const urgentSymptoms = symptoms.some((item) => ["chest pain", "shortness of breath", "fainting or severe dizziness"].includes(item));
  const status = urgentSymptoms
    ? { label: "Check symptoms first", level: "check", icon: "!" }
    : scoreStatus(score);
  const scoreRing = document.querySelector(".score-ring");
  scoreRing.querySelector("strong").textContent = score;
  scoreRing.setAttribute("aria-label", `Bala score ${score} out of 100, ${status.label}`);
  scoreRing.dataset.level = status.level;
  scoreRing.querySelector(".ring-value").style.strokeDashoffset = String(390 - (390 * score) / 100);
  document.querySelector("#score-icon").textContent = status.icon;
  document.querySelector("#score-status").lastChild.textContent = ` ${status.label}`;
  document.querySelector("#score-status").dataset.level = status.level;
  document.querySelector("#readiness-icon").textContent = status.icon;
  document.querySelector("#readiness-icon").dataset.level = status.level;
  document.querySelector("#readiness-value").textContent = score;
  document.querySelector("#readiness-note").textContent = `${status.label} · deterministic`;
  const checkCopy = breakdown.parts.slice(0, 3).map((part) => `${part.label}: ${part.note}`);
  ["#score-check-1", "#score-check-2", "#score-check-3"].forEach((selector, index) => {
    document.querySelector(selector).textContent = checkCopy[index] || "Add another signal for more context";
  });

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
  if (metrics.hrv) {
    document.querySelector("#hrv-value").textContent = Math.round(metrics.hrv);
    const history = Array.isArray(metrics.history) ? metrics.history.slice(0, -1).slice(-14) : [];
    const baseline = averageValues(history.map((day) => day.hrv));
    const lowerThanPattern = baseline ? metrics.hrv < baseline * 0.75 : metrics.hrv < 35;
    const status = document.querySelector("#hrv-status");
    status.textContent = lowerThanPattern ? "Below recent pattern" : baseline ? "Near recent pattern" : "Baseline building";
    status.className = lowerThanPattern ? "watch" : "good";
  }
  if (metrics.spo2) {
    document.querySelector("#spo2-value").textContent = Math.round(metrics.spo2);
    const status = document.querySelector("#spo2-status");
    const needsAttention = metrics.spo2 < 95;
    status.textContent = needsAttention ? "Recheck and monitor" : "Within range";
    status.className = needsAttention ? "watch" : "good";
  }
  if (metrics.steps !== undefined) {
    document.querySelector("#steps-value").textContent = Math.round(metrics.steps).toLocaleString();
    const percentage = clamp(Math.round((metrics.steps / 10000) * 100), 0, 100);
    document.querySelector("#steps-note").textContent = `${percentage}% of daily goal`;
    document.querySelector("#steps-progress").style.width = `${percentage}%`;
    document.querySelector("#activity-value").textContent = `${percentage}%`;
    document.querySelector("#activity-note").textContent = "Of daily step goal";
  }

  const recommendation = buildRecommendation(metrics, symptomContext);
  document.querySelector("#score-heading").textContent = personalizeTitle(recommendation.title);
  document.querySelector("#score-guide-copy").textContent = recommendation.copy;
  document.querySelector("#suggestion-title").textContent = recommendation.title;
  document.querySelector(".suggestion-panel > p:not(.section-label)").textContent = recommendation.copy;
  document.querySelector("#source-title").textContent = currentSourceLabel;
  document.querySelector("#source-status").textContent = `Saved on this device · ${new Date(metrics.updatedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`;
  document.querySelector("#clear-button").hidden = false;
  document.querySelector("#chart-value").textContent = score;
  document.querySelector("#chart-copy").textContent = "Local wellness estimate";
  renderBaselineAndTimeline(metrics);
  renderWeeklyPatterns(metrics);
  if (metrics.history?.length) {
    const recent = metrics.history.slice(-7);
    chartData.recovery.values = recent.map(scoreMetrics);
    chartData.recovery.value = String(scoreMetrics(metrics));
    chartData.recovery.copy = `${recent.length}-day personal history`;
    renderChart("recovery");
  }
}

function numericFormValue(formData, name) {
  const raw = formData.get(name);
  return raw === "" ? undefined : Number(raw);
}

function saveMetrics(metrics) {
  const existing = getLocalMetrics() || {};
  const availableMetrics = Object.fromEntries(
    Object.entries(metrics).filter(([, value]) => value !== undefined),
  );
  const today = new Date().toISOString().slice(0, 10);
  const incomingHistory = Array.isArray(availableMetrics.history) ? availableMetrics.history : [];
  const historyMap = new Map([...(existing.history || []), ...incomingHistory].map((day) => [day.date, day]));
  if (!incomingHistory.length) {
    const existingToday = historyMap.get(today) || {};
    historyMap.set(today, { ...existingToday, date: today, ...availableMetrics });
  }
  const stored = alignLatestSnapshot({
    ...existing,
    ...availableMetrics,
    history: [...historyMap.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-90),
    updatedAt: new Date().toISOString(),
  });
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
  const dayKeys = [...days.keys()].sort();
  const latestDayKey = dayKeys.at(-1);
  const day = days.get(latestDayKey);
  const average = (total, count) => count ? total / count : undefined;
  const oxygen = average(day.spo2Total, day.spo2Count);
  const summarizeDay = (key) => {
    const item = days.get(key);
    const oxygenValue = average(item.spo2Total, item.spo2Count);
    return {
      date: key,
      sleep: item.sleepSeconds ? item.sleepSeconds / 3600 : undefined,
      rhr: average(item.rhrTotal, item.rhrCount),
      hrv: average(item.hrvTotal, item.hrvCount),
      spo2: oxygenValue === undefined ? undefined : oxygenValue <= 1 ? oxygenValue * 100 : oxygenValue,
      steps: item.steps,
      exercise: item.exercise,
    };
  };

  return {
    source: `Apple Health import · ${latestDayKey}`,
    sleep: day.sleepSeconds ? day.sleepSeconds / 3600 : undefined,
    rhr: average(day.rhrTotal, day.rhrCount),
    hrv: average(day.hrvTotal, day.hrvCount),
    spo2: oxygen === undefined ? undefined : oxygen <= 1 ? oxygen * 100 : oxygen,
    steps: day.steps,
    exercise: day.exercise,
    history: dayKeys.slice(-90).map(summarizeDay),
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

const importFieldLabels = {
  sleep: "Sleep hours",
  rhr: "Resting heart rate",
  hrv: "HRV",
  steps: "Steps",
  spo2: "SpO2",
  note: "Symptoms note",
};

function normalizedImportRecord(record) {
  return Object.fromEntries(
    Object.entries(record || {}).map(([key, value]) => [
      key.toLowerCase().replace(/[^a-z0-9]/g, ""),
      typeof value === "string" ? value.trim() : value,
    ]),
  );
}

function importDate(value) {
  const text = String(value || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : text;
}

function manualMetricRecord(record) {
  const normalized = normalizedImportRecord(record);
  const number = (keys, min, max) => {
    const raw = keys.map((key) => normalized[key]).find((value) => value !== "" && value !== undefined);
    const value = Number(raw);
    return Number.isFinite(value) && value >= min && value <= max ? value : undefined;
  };
  const note = ["symptomsnote", "note", "moodorsymptomsnote"]
    .map((key) => normalized[key])
    .find((value) => typeof value === "string");
  return Object.fromEntries(Object.entries({
    date: importDate(normalized.date),
    source: "Manual file import",
    sleep: number(["sleephours", "sleep"], 0, 16),
    rhr: number(["restingheartrate", "rhr"], 25, 220),
    hrv: number(["hrv", "hrvms"], 1, 300),
    spo2: number(["spo2", "spo2percent"], 70, 100),
    steps: number(["steps"], 0, 200000),
    exercise: number(["exerciseminutes", "exercise"], 0, 1440),
    note: note ? note.slice(0, 240) : undefined,
  }).filter(([, value]) => value !== undefined));
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "\"") {
      if (quoted && text[index + 1] === "\"") {
        value += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  row.push(value);
  if (row.some((item) => item.trim())) rows.push(row);
  if (quoted) throw new Error("This CSV has an unfinished quoted value.");
  return rows;
}

function detectedImportFields(records) {
  return Object.keys(importFieldLabels).filter((key) => records.some((record) => (
    key === "note" ? Boolean(record.note) : Number.isFinite(record[key])
  )));
}

function importPackage(records, format) {
  const validRecords = records
    .filter((record) => record.date && metricEvidence(record).length)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-90);
  if (!validRecords.length) {
    throw new Error(`No valid dated BALA signal records were found in this ${format} file.`);
  }
  const latest = validRecords.at(-1);
  const detectedFields = detectedImportFields(validRecords);
  return {
    metrics: { ...latest, history: validRecords },
    recordsImported: validRecords.length,
    latestDate: latest.date,
    detectedFields,
    missingFields: Object.keys(importFieldLabels).filter((key) => !detectedFields.includes(key)),
  };
}

function balaExportImportPackage(payload) {
  const data = supportedImportData(payload);
  if (!data.health) throw new Error("This BALA export does not contain saved health signals.");
  const health = data.health;
  const history = Array.isArray(health.history) && health.history.length
    ? health.history
    : [{ ...health, date: importDate(health.date || health.updatedAt) || new Date().toISOString().slice(0, 10) }];
  const normalizedHistory = history.map((record) => ({
    ...record,
    date: importDate(record.date) || new Date().toISOString().slice(0, 10),
  }));
  const result = importPackage(normalizedHistory, "BALA JSON export");
  result.metrics = { ...health, ...result.metrics };
  return result;
}

async function parseManualSignalFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json")) {
    const parsed = JSON.parse(await file.text());
    if (parsed?.format === EXPORT_FORMAT) return balaExportImportPackage(parsed);
    const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.records) ? parsed.records : [parsed];
    return importPackage(records.map(manualMetricRecord), "JSON");
  }
  if (name.endsWith(".csv")) {
    const rows = parseCsvRows(await file.text());
    if (rows.length < 2) throw new Error("This CSV needs a header row and at least one data row.");
    const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());
    const records = rows.slice(1).map((values) => manualMetricRecord(
      Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])),
    ));
    return importPackage(records, "CSV");
  }
  throw new Error("BALA can guide you through exporting this data, but this file format is not fully parsed yet. For now, try CSV or JSON.");
}

function showImportResult(result, sourceLabel) {
  dialogLabel.textContent = "Import complete";
  dialogTitle.textContent = `${sourceLabel} is ready`;
  const container = document.createElement("div");
  container.className = "source-list";
  const summary = document.createElement("p");
  summary.textContent = "Your supported health signals were processed locally in this browser and were not uploaded.";
  const list = document.createElement("ul");
  list.className = "import-result-list";
  const rows = [
    ["Source imported from", sourceLabel],
    ["Records imported", String(result.recordsImported)],
    ["Latest date imported", result.latestDate || "Not provided"],
    ["Fields detected", result.detectedFields.map((key) => importFieldLabels[key]).join(", ") || "None"],
    ["Fields missing", result.missingFields.map((key) => importFieldLabels[key]).join(", ") || "None"],
  ];
  rows.forEach(([label, value]) => {
    const item = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = label;
    const span = document.createElement("span");
    span.textContent = value;
    item.append(strong, span);
    list.append(item);
  });
  container.append(summary, list);
  dialogContentNode.replaceChildren(container);
  if (!dialog.open) dialog.showModal();
}

function showImportError(message) {
  dialogLabel.textContent = "Import could not finish";
  dialogTitle.textContent = "Check the selected file";
  const container = document.createElement("div");
  container.className = "source-list";
  const errorCopy = document.createElement("p");
  errorCopy.textContent = message;
  const localCopy = document.createElement("p");
  localCopy.textContent = "Live sync is not available yet. You can try the BALA sample CSV or add signals manually.";
  container.append(errorCopy, localCopy);
  dialogContentNode.replaceChildren(container);
  if (!dialog.open) dialog.showModal();
}

function openSignalDetail(key) {
  const metrics = getLocalMetrics();
  let [title, value, copy] = signalDetails[key];
  if (metrics) {
    if (key === "readiness") {
      const breakdown = scoreBreakdown(metrics, getRecentSymptoms());
      value = String(breakdown.total);
      copy = `This deterministic score uses the signals available today. ${breakdown.parts.map((part) => `${part.label} ${part.score}`).join(", ")}. Missing signals are not guessed.`;
    }
    if (key === "sleep" && Number.isFinite(metrics.sleep)) value = `${metrics.sleep.toFixed(1)} hours`;
    if (key === "heart" && Number.isFinite(metrics.rhr)) value = `${Math.round(metrics.rhr)} bpm`;
    if (key === "hrv" && Number.isFinite(metrics.hrv)) value = `${Math.round(metrics.hrv)} ms`;
    if (key === "spo2" && Number.isFinite(metrics.spo2)) value = `${Math.round(metrics.spo2)}%`;
    if (key === "steps" && Number.isFinite(metrics.steps)) value = Math.round(metrics.steps).toLocaleString();
  }
  dialogLabel.textContent = "Health signal";
  dialogTitle.textContent = title;
  dialogContentNode.innerHTML = `
    <div class="signal-detail">
      <strong>${value}</strong>
      <p>${copy}</p>
      <small>${metrics?.source || "Demo value"} · personal patterns become more useful with consistent wear.</small>
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
document.querySelector("#demo-button").addEventListener("click", () => {
  setCurrentDataSource("demo");
  saveMetrics(DEMO_METRICS);
  document.querySelector("#demo-button").textContent = "Demo ready";
  document.querySelector(".score-panel").scrollIntoView({ behavior: "smooth", block: "center" });
});
document.querySelector("#hero-import-button").addEventListener("click", () => openHealthImport());
document.querySelector("#hero-ask-button").addEventListener("click", () => openCoach());
document.querySelector("#hero-report-button").addEventListener("click", () => document.querySelector("#report-button").click());
document.querySelector("#sync-button").addEventListener("click", platformGuide);
document.querySelector("#all-data-button").addEventListener("click", () => openDialog("data"));
document.querySelector("#privacy-button").addEventListener("click", () => openDialog("privacy"));
function openCaptureForm() {
  resetCaptureMode();
  captureForm.reset();
  const metrics = getLocalMetrics();
  CAPTURE_FIELDS.forEach((name) => {
    const field = captureForm.elements.namedItem(name);
    if (field && metrics?.[name] !== undefined) field.value = metrics[name];
  });
  const dateField = document.querySelector("#capture-date-field");
  const dateInput = document.querySelector("#capture-date");
  if (dateField) dateField.hidden = false;
  if (dateInput) {
    dateInput.max = localToday();
    dateInput.value = localToday();
  }
  captureDialog.showModal();
}

document.querySelector("#capture-button").addEventListener("click", openCaptureForm);
document.querySelector("#capture-close").addEventListener("click", () => captureDialog.close());
captureDialog.addEventListener("close", resetCaptureMode);
installButton.addEventListener("click", requestInstall);
setupInstallButton.addEventListener("click", requestInstall);
profileButton.addEventListener("click", () => openOnboarding(true));
onboardingCancel.addEventListener("click", () => onboardingDialog.close());
resetNameButton.addEventListener("click", () => {
  localStorage.removeItem(PROFILE_KEY);
  profileNameInput.value = "";
  resetNameButton.hidden = true;
  onboardingCancel.hidden = true;
  updatePersonalization();
  profileNameInput.focus();
});
onboardingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = String(new FormData(onboardingForm).get("name") || "").trim().replace(/\s+/g, " ");
  if (!name) return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, updatedAt: new Date().toISOString() }));
  onboardingDialog.close();
  updatePersonalization();
});
document.querySelector("#devices-button").addEventListener("click", () => {
  document.querySelector("#connections-title").scrollIntoView({ behavior: "smooth", block: "start" });
});
document.querySelector("#source-details-button")?.addEventListener("click", openDevices);
document.querySelectorAll(".device-card button").forEach((button) => {
  button.addEventListener("click", () => showProviderGuide(button.closest(".device-card").dataset.provider));
});
document.querySelector("#import-button").addEventListener("click", () => openHealthImport());
document.querySelectorAll("[data-health-source]").forEach((button) => {
  button.addEventListener("click", () => openHealthSourceGuide(button.dataset.healthSource));
});
document.querySelectorAll("[data-source-import]").forEach((button) => {
  button.addEventListener("click", () => openHealthImport(button.dataset.sourceImport));
});
document.querySelector("[data-source-action='demo']").addEventListener("click", () => {
  document.querySelector("#demo-button").click();
});
document.querySelectorAll("[data-download-sample-csv]").forEach((button) => {
  button.addEventListener("click", downloadSampleCsv);
});
document.querySelector("#copy-timeline-button").addEventListener("click", copyTimelineSummary);
document.querySelector("#download-timeline-button").addEventListener("click", downloadTimelineSummary);
const timelineToggle = document.querySelector("#timeline-toggle");
if (timelineToggle) {
  timelineToggle.addEventListener("click", () => {
    const metrics = getLocalMetrics() || DEMO_METRICS;
    const total = validCheckIns(metrics).length;
    if (timelineShownCount >= total) {
      timelineShownCount = TIMELINE_COLLAPSED_COUNT;
    } else if (timelineShownCount <= TIMELINE_COLLAPSED_COUNT) {
      timelineShownCount = TIMELINE_EXPANDED_COUNT;
    } else {
      timelineShownCount += TIMELINE_STEP;
    }
    updateDashboard(metrics);
  });
}
const manageHistoryToggle = document.querySelector("#manage-history-toggle");
if (manageHistoryToggle) {
  manageHistoryToggle.addEventListener("click", () => {
    manageHistory = !manageHistory;
    updateDashboard(getLocalMetrics() || DEMO_METRICS);
  });
}
importSource.addEventListener("change", () => {
  renderImportSource(importSource.value);
});
document.querySelector("#shortcut-button").addEventListener("click", () => {
  shortcutTemplate.value = `${location.origin}${location.pathname}#sync=1&sleep=7.5&rhr=62&hrv=45&spo2=97&steps=8000&exercise=30`;
  shortcutDialog.showModal();
});
document.querySelector("#copy-shortcut-link").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shortcutTemplate.value);
    document.querySelector("#copy-shortcut-link").textContent = "Template copied";
  } catch {
    shortcutTemplate.select();
    document.querySelector("#copy-shortcut-link").textContent = "Select and copy the link";
  }
});
document.querySelector("#choose-health-file").addEventListener("click", () => healthFile.click());
exportDataButton.addEventListener("click", exportBalaData);
importDataButton.addEventListener("click", () => balaImportFile.click());
balaImportFile.addEventListener("change", async () => {
  const [file] = balaImportFile.files;
  if (!file) return;
  try {
    if (!file.name.toLowerCase().endsWith(".json")) throw new Error("Choose a BALA JSON export file.");
    if (file.size > 5 * 1024 * 1024) throw new Error("This backup is too large. Choose a BALA JSON export smaller than 5 MB.");
    const payload = JSON.parse(await file.text());
    const data = supportedImportData(payload);
    const confirmed = window.confirm("Importing this BALA backup will replace the supported profile, health signals, check-ins, and settings currently stored on this device. Continue?");
    if (!confirmed) {
      dataPortabilityStatus.textContent = "Import canceled. Your current BALA data was not changed.";
      return;
    }
    restoreBalaData(data);
    dataPortabilityStatus.textContent = "BALA data restored. Refreshing your local guide...";
    window.setTimeout(() => window.location.reload(), 250);
  } catch (error) {
    dataPortabilityStatus.textContent = error instanceof SyntaxError
      ? "This file is not valid JSON. Choose a BALA data export and try again."
      : error.message;
  } finally {
    balaImportFile.value = "";
  }
});
document.querySelector("#clear-button").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SYMPTOM_KEY);
  window.location.reload();
});
document.querySelector("#symptom-button").addEventListener("click", () => symptomDialog.showModal());
document.querySelector("#symptom-card-button").addEventListener("click", () => symptomDialog.showModal());
document.querySelector("#coach-card-button").addEventListener("click", () => openCoach());
document.querySelector("#report-card-button").addEventListener("click", () => document.querySelector("#report-button").click());
document.querySelector("#voice-preview-button").addEventListener("click", () => openCoach());
document.querySelector("#symptom-close").addEventListener("click", () => symptomDialog.close());
symptomForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(symptomForm);
  const symptoms = formData.getAll("symptom");
  const note = String(formData.get("note") || "").trim();
  const entry = { date: new Date().toISOString(), symptoms, note };
  const history = JSON.parse(localStorage.getItem(SYMPTOM_KEY) || "[]");
  localStorage.setItem(SYMPTOM_KEY, JSON.stringify([...history, entry].slice(-60)));
  updateDashboard(getLocalMetrics() || DEMO_METRICS);
  symptomDialog.close();
  symptomForm.reset();
  const urgent = symptoms.some((item) => ["chest pain", "shortness of breath", "fainting or severe dizziness"].includes(item));
  dialogLabel.textContent = urgent ? "Safety first" : "Context saved";
  dialogTitle.textContent = urgent ? "Wearables cannot rule out an emergency" : "BALA will use this context";
  dialogContentNode.innerHTML = urgent
    ? `<div class="connection-note"><strong>Get urgent help now if symptoms are severe, new, or worsening.</strong><p>Call local emergency services. Do not wait for BALA or a wearable reading.</p></div>`
    : `<div class="source-list"><p>Your symptom check-in was saved only on this device and will be included in your report.</p></div>`;
  dialog.showModal();
});
document.querySelector("#report-button").addEventListener("click", () => {
  const metrics = getLocalMetrics();
  const symptoms = getSymptomHistory();
  if (!metrics) {
    dialogLabel.textContent = "Report unavailable";
    dialogTitle.textContent = "Add health data first";
    dialogContentNode.innerHTML = `<div class="source-list"><p>Import Apple Health or add a check-in before creating a report.</p></div>`;
    dialog.showModal();
    return;
  }
  const baseline = baselineAnalysis(metrics);
  const lines = [
    "BALA WELLNESS SUMMARY",
    `Generated: ${new Date().toLocaleString()}`,
    `Source: ${metrics.source || "Local check-in"}`,
    `Baseline: ${baseline.days} days · ${baseline.level}`,
    baseline.copy,
    "",
    "LATEST SUPPORTED METRICS",
    ...metricEvidence(metrics).map((item) => `- ${item}`),
    "",
    "RECENT SYMPTOM CHECK-INS",
    ...(symptoms.length ? symptoms.slice(-10).map((entry) => `- ${new Date(entry.date).toLocaleDateString()}: ${entry.symptoms.join(", ") || "No listed symptom"}${entry.note ? ` · ${entry.note}` : ""}`) : ["- None recorded"]),
    "",
    "This report is health-awareness context from supported body signals. Discuss persistent concerns with a qualified clinician.",
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `bala-health-summary-${new Date().toISOString().slice(0, 10)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
});

captureForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(captureForm);
  const values = {
    sleep: numericFormValue(formData, "sleep"),
    rhr: numericFormValue(formData, "rhr"),
    hrv: numericFormValue(formData, "hrv"),
    spo2: numericFormValue(formData, "spo2"),
    steps: numericFormValue(formData, "steps"),
    exercise: numericFormValue(formData, "exercise"),
  };
  const note = String(formData.get("note") || "").trim();

  if (editingDate) {
    const existing = getLocalMetrics();
    if (!existing || existing.source === "BALA demo") {
      captureDialog.close();
      return;
    }
    if (!Object.values(values).some((value) => value !== undefined)) {
      window.alert("Add at least one value before saving your check-in.");
      return;
    }
    const entries = Array.isArray(existing.history) ? existing.history : [];
    const existingEntry = entries.find((item) => item.date === editingDate) || {};
    const editedEntry = { date: editingDate, source: existingEntry.source || "Local check-in", ...values };
    Object.keys(editedEntry).forEach((key) => editedEntry[key] === undefined && delete editedEntry[key]);
    if (note) editedEntry.note = note;
    const newestDate = entries.reduce((max, item) => (item.date > max ? item.date : max), "");
    setCurrentDataSource("manual");
    if (editingDate === newestDate) {
      saveMetrics({ source: "Local check-in", ...values, ...(note ? { note } : {}), history: [editedEntry] });
    } else {
      saveMetrics({ history: [editedEntry] });
    }
    captureDialog.close();
    captureForm.reset();
    return;
  }

  const chosenDate = String(formData.get("date") || "").trim() || localToday();
  if (chosenDate > localToday()) {
    window.alert("You can’t log a check-in for a future date.");
    return;
  }
  if (!Object.values(values).some((value) => value !== undefined)) {
    window.alert("Add at least one value before saving your check-in.");
    return;
  }
  const existing = getLocalMetrics();
  const entries = Array.isArray(existing?.history) ? existing.history : [];
  if (entries.some((item) => item.date === chosenDate)) {
    const niceDate = new Date(`${chosenDate}T00:00:00`).toLocaleDateString([], { dateStyle: "medium" });
    if (!window.confirm(`A check-in already exists for ${niceDate}. Replace it?`)) {
      return;
    }
  }
  const entry = { date: chosenDate, source: "Local check-in", ...values };
  Object.keys(entry).forEach((key) => entry[key] === undefined && delete entry[key]);
  if (note) entry.note = note;
  const newestDate = entries.reduce((max, item) => (item.date > max ? item.date : max), "");
  setCurrentDataSource("manual");
  if (chosenDate >= newestDate) {
    saveMetrics({ source: "Local check-in", ...values, ...(note ? { note } : {}), history: [entry] });
  } else {
    saveMetrics({ history: [entry] });
  }
  captureDialog.close();
  captureForm.reset();
});

healthFile.addEventListener("change", async () => {
  const [file] = healthFile.files;
  if (!file) return;
  const selectedSource = importSource.value;
  try {
    appleImportDialog.close();
    const isAppleExport = selectedSource === "apple" && /\.(zip|xml)$/i.test(file.name);
    const isSimpleFile = /\.(csv|json)$/i.test(file.name);
    const maximumSize = isAppleExport ? 500 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maximumSize) {
      throw new Error(isAppleExport
        ? "This Apple Health export is too large for this browser session. Try a smaller export or use manual CSV or JSON."
        : "This file is too large. Choose a CSV or JSON file smaller than 10 MB.");
    }
    if (selectedSource === "manual-csv" && !/\.csv$/i.test(file.name)) throw new Error("Choose a CSV file for Manual CSV.");
    if (selectedSource === "manual-json" && !/\.json$/i.test(file.name)) throw new Error("Choose a JSON file for Manual JSON.");
    if (!isAppleExport && !isSimpleFile) {
      throw new Error("BALA can guide you through exporting this data, but this file format is not fully parsed yet. For now, try CSV or JSON.");
    }
    dialogLabel.textContent = "Reading health data";
    dialogTitle.textContent = "Processing your export locally";
    dialogContentNode.innerHTML = `<div class="source-list"><p>BALA is reading ${(file.size / 1024 / 1024).toFixed(1)} MB locally. Keep the app open until this finishes.</p></div>`;
    dialog.showModal();
    let result;
    if (isAppleExport) {
      const appleMetrics = await parseAppleHealthFile(file);
      const history = Array.isArray(appleMetrics.history) ? appleMetrics.history : [];
      const detectedFields = detectedImportFields([appleMetrics]);
      result = {
        metrics: appleMetrics,
        recordsImported: history.length || 1,
        latestDate: history.at(-1)?.date || new Date().toISOString().slice(0, 10),
        detectedFields,
        missingFields: Object.keys(importFieldLabels).filter((key) => !detectedFields.includes(key)),
      };
    } else {
      result = await parseManualSignalFile(file);
    }
    result.metrics.source = dataSourceLabels[selectedSource];
    setCurrentDataSource(selectedSource);
    saveMetrics(result.metrics);
    showImportResult(result, dataSourceLabels[selectedSource]);
  } catch (error) {
    showImportError(error.message || "The selected file could not be read.");
  } finally {
    healthFile.value = "";
  }
});

addButton.addEventListener("click", () => {
  openDialog("plan");
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
  setListening(false);
  stopSpeakingButton.disabled = true;
  coachDrawer.classList.remove("open");
  coachDrawer.setAttribute("aria-hidden", "true");
}

function preferredCoachVoice() {
  const voices = window.speechSynthesis?.getVoices() || [];
  const selectedLanguage = coachLanguage.value.toLowerCase();
  return voices.find((voice) => voice.lang.toLowerCase() === selectedLanguage)
    || voices.find((voice) => voice.lang.toLowerCase().startsWith(selectedLanguage.split("-")[0]))
    || voices.find((voice) => voice.lang.toLowerCase().startsWith("en"))
    || voices[0];
}

function speakCoachAnswer(text) {
  if (!voiceRepliesEnabled || !window.speechSynthesis || !text) {
    stopSpeakingButton.disabled = true;
    voiceStatus.textContent = "Answer ready. You can type another question or tap Speak.";
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = preferredCoachVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || coachLanguage.value;
  utterance.rate = 0.94;
  utterance.pitch = 0.9;
  utterance.onstart = () => {
    stopSpeakingButton.disabled = false;
    voiceStatus.textContent = "BALA is reading the answer aloud.";
  };
  utterance.onend = () => {
    stopSpeakingButton.disabled = true;
    voiceStatus.textContent = "Answer complete. Tap Speak or type another question.";
  };
  utterance.onerror = () => {
    stopSpeakingButton.disabled = true;
    voiceStatus.textContent = "The answer is on screen. Spoken playback was unavailable.";
  };
  window.speechSynthesis.speak(utterance);
}

function setListening(active, status) {
  isListening = active;
  voiceInputButton.classList.toggle("listening", active);
  voiceInputButton.disabled = active;
  stopListeningButton.disabled = !active;
  if (status) voiceStatus.textContent = status;
}

function setupSpeechRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    voiceInputButton.disabled = true;
    voiceInputButton.title = "Voice input is not supported in this browser";
    stopListeningButton.disabled = true;
    voiceStatus.textContent = "Voice input is not supported in this browser yet. You can still type your question.";
  } else {
    speechRecognition = new Recognition();
    speechRecognition.lang = coachLanguage.value;
    speechRecognition.interimResults = true;
    speechRecognition.continuous = false;
    speechRecognition.onstart = () => {
      const label = coachLanguage.options[coachLanguage.selectedIndex].text;
      setListening(true, `Listening in ${label}. Speak naturally.`);
    };
    speechRecognition.onresult = (event) => {
      const results = Array.from(event.results);
      const transcript = results.map((result) => result[0].transcript).join("");
      coachInput.value = transcript;
      if (results[results.length - 1].isFinal) {
        setListening(false, "Got it. BALA is using your local signals and check-ins.");
        document.querySelector("#coach-form").requestSubmit();
      }
    };
    speechRecognition.onerror = (event) => {
      const message = event.error === "not-allowed"
        ? "Microphone permission was not allowed. Enable it in browser settings or type your question."
        : "I could not hear that clearly. Tap Speak and try again.";
      setListening(false, message);
    };
    speechRecognition.onend = () => {
      if (isListening) setListening(false, "Listening stopped. Tap Speak to try again.");
    };
  }

  if (!window.speechSynthesis) {
    readAloudToggle.disabled = true;
    stopSpeakingButton.disabled = true;
    voiceStatus.textContent += " Spoken playback is not supported here.";
    return;
  }
}

async function startListening() {
  window.speechSynthesis?.cancel();
  stopSpeakingButton.disabled = true;
  if (!speechRecognition) {
    voiceStatus.textContent = "Voice input is not supported in this browser yet. You can still type your question.";
    return;
  }
  if (isListening) return;
  try {
    setListening(true, microphonePermissionGranted ? "Starting the microphone…" : "Requesting microphone access…");
    if (!microphonePermissionGranted && navigator.mediaDevices?.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      microphonePermissionGranted = true;
    }
    speechRecognition.lang = coachLanguage.value;
    speechRecognition.start();
  } catch (error) {
    const denied = error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError";
    setListening(false, denied
      ? "Microphone is blocked. Allow microphone access in browser settings, then reopen BALA."
      : `Microphone could not start${error?.name ? ` (${error.name})` : ""}. Type your question or try again.`);
  }
}

document.querySelector("#ask-button").addEventListener("click", () => openCoach());
document.querySelector("#coach-close").addEventListener("click", closeCoach);
voiceInputButton.addEventListener("click", startListening);
stopListeningButton.addEventListener("click", () => {
  speechRecognition?.stop();
  setListening(false, "Listening stopped. You can edit the transcript or type your question.");
});
readAloudToggle.addEventListener("change", () => {
  voiceRepliesEnabled = readAloudToggle.checked;
  localStorage.setItem("bala-read-aloud", String(voiceRepliesEnabled));
  if (!voiceRepliesEnabled) {
    window.speechSynthesis?.cancel();
    stopSpeakingButton.disabled = true;
  }
  voiceStatus.textContent = voiceRepliesEnabled
    ? "Read answer aloud is on. Your browser or device will handle speech playback."
    : "Read answer aloud is off.";
});
stopSpeakingButton.addEventListener("click", () => {
  window.speechSynthesis?.cancel();
  stopSpeakingButton.disabled = true;
  voiceStatus.textContent = "Spoken playback stopped. The full answer remains on screen.";
});
coachLanguage.addEventListener("change", () => {
  localStorage.setItem("bala-language", coachLanguage.value);
  if (speechRecognition) speechRecognition.lang = coachLanguage.value;
  const label = coachLanguage.options[coachLanguage.selectedIndex].text;
  const langNote = coachLanguage.value === "en-US" ? "" : " Greetings and basic responses are available in this language.";
  voiceStatus.textContent = `Voice language set to ${label}.${langNote}`;
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
  button.addEventListener("click", () => {
    coachInput.value = button.textContent;
    document.querySelector("#coach-form").requestSubmit();
  });
});

document.querySelector("#coach-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const question = coachInput.value.trim();
  if (!question) return;
  const user = document.createElement("div");
  user.className = "user-message";
  user.textContent = question;
  const response = document.createElement("div");
  response.className = "coach-message";
  const answerText = document.createElement("p");
  const localAnswer = coachResponse(question, getLocalMetrics());
  answerText.textContent = localAnswer;
  response.append(answerText);
  coachMessages.append(user, response);
  coachInput.value = "";
  coachMessages.scrollTop = coachMessages.scrollHeight;
  const note = document.createElement("small");
  note.className = "ai-source";
  note.textContent = "BALA local guidance from this app's available signals";
  response.append(note);
  conversation.push({ role: "user", content: question });
  voiceStatus.textContent = "BALA used your available local signals and check-ins.";
  coachModeLabel.textContent = "Private coach - using this app's available signals";
  coachModeLabel.textContent = "Private coach · local guidance active";
  conversation.push({ role: "assistant", content: answerText.textContent });
  coachModeLabel.textContent = "Private coach - using this app's available signals";
  if (conversation.length > 12) conversation.splice(0, conversation.length - 12);
  speakCoachAnswer(answerText.textContent);
});

coachLanguage.value = ["en-US", "hi-IN", "te-IN", "ta-IN"].includes(localStorage.getItem("bala-language"))
  ? localStorage.getItem("bala-language")
  : "en-US";
voiceRepliesEnabled = localStorage.getItem("bala-read-aloud") === "true";
readAloudToggle.checked = voiceRepliesEnabled;
setupSpeechRecognition();
renderChart("recovery");
setCurrentDataSource(inferDataSource());
renderImportSource(importSource.value);
updatePersonalization();
updateDashboard(getLocalMetrics() || DEMO_METRICS);
if (!getUserName()) openOnboarding(false);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.textContent = "Install BALA";
  setupInstallButton.textContent = "Install BALA";
  setupCardCopy.textContent = "Your browser can show an install prompt. Installation only starts after you choose it.";
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButton.textContent = "BALA installed";
  setupInstallButton.textContent = "Installed";
  setupCardCopy.textContent = "BALA is installed on this device. Your local health data remains in this browser profile.";
});

if (isStandalone()) {
  installButton.textContent = "Installed";
  setupInstallButton.textContent = "Installed";
  setupCardCopy.textContent = "BALA is running from your home screen. Your local health data remains in this browser profile.";
} else if (isIos()) {
  setupCardCopy.textContent = "On iPhone in Safari: Tap Share -> Add to Home Screen -> Add. BALA cannot install itself.";
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

function importShortcutSync() {
  if (!location.hash.startsWith("#sync=")) return;
  const values = new URLSearchParams(location.hash.slice(1));
  const number = (name) => {
    const value = Number(values.get(name));
    return Number.isFinite(value) ? value : undefined;
  };
  const metrics = {
    source: "Apple Shortcut daily sync",
    sleep: number("sleep"),
    rhr: number("rhr"),
    hrv: number("hrv"),
    spo2: number("spo2"),
    steps: number("steps"),
    exercise: number("exercise"),
  };
  if (Object.values(metrics).some((value) => Number.isFinite(value))) {
    setCurrentDataSource("apple");
    saveMetrics(metrics);
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    dialogLabel.textContent = "Daily sync complete";
    dialogTitle.textContent = "Today’s Health summary is in BALA";
    dialogContentNode.innerHTML = `<div class="source-list"><p>The Apple Shortcut values were processed locally. They were not sent to GitHub or an AI provider.</p></div>`;
    dialog.showModal();
  }
}

const launchAction = new URLSearchParams(window.location.search).get("action");
if (launchAction === "capture") captureDialog.showModal();
if (launchAction === "coach") openCoach();
importShortcutSync();

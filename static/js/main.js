/**
 * Client-Side JavaScript for AI Spam Message Detector & Receipt Scam Scanner
 * Handles AJAX requests, UI updates, Chart.js visualizations, image uploads, and interactions.
 */

// Global Chart references for updating
let charts = {
  distribution: null,
  confidence: null,
  activity: null,
  keywords: null,
};

// Selected receipt file or sample
let activeReceiptFile = null;
let activeSampleType = null;

// DOM ready
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initTextareaCounters();
  initSamplePills();
  initAnalyzeForm();
  initHistoryControls();
  initCharts();
  initReceiptScanner();
});

/**
 * Tab Navigation
 */
function initTabs() {
  const tabButtons = document.querySelectorAll(".nav-item-btn");
  const tabSections = {
    home: document.getElementById("tab-home"),
    receipt: document.getElementById("tab-receipt"),
    history: document.getElementById("tab-history"),
    analytics: document.getElementById("tab-analytics"),
    about: document.getElementById("tab-about"),
    deploy: document.getElementById("tab-deploy"),
  };

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      if (!targetTab) return;

      // Update button active state
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Hide all sections, show target
      Object.keys(tabSections).forEach((key) => {
        if (tabSections[key]) {
          tabSections[key].style.display = key === targetTab ? "block" : "none";
        }
      });

      // Special action on tab switch
      if (targetTab === "history") {
        fetchHistory();
      } else if (targetTab === "analytics") {
        fetchAnalyticsAndUpdateCharts();
      } else if (targetTab === "receipt") {
        fetchReceiptHistory();
      }
    });
  });

  // Direct buttons to switch tabs (e.g. from hero or footer)
  document.querySelectorAll("[data-navigate-tab]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const tabName = el.getAttribute("data-navigate-tab");
      const targetBtn = document.querySelector(`.nav-item-btn[data-tab="${tabName}"]`);
      if (targetBtn) targetBtn.click();
    });
  });
}

/**
 * Textarea character & word counter
 */
function initTextareaCounters() {
  const textarea = document.getElementById("message-input");
  const charCounter = document.getElementById("char-count");
  const wordCounter = document.getElementById("word-count");

  if (!textarea) return;

  const updateCounts = () => {
    const text = textarea.value;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;

    if (charCounter) charCounter.textContent = chars;
    if (wordCounter) wordCounter.textContent = words;
  };

  textarea.addEventListener("input", updateCounts);

  // Keyboard shortcut: Ctrl + Enter / Cmd + Enter to Analyze
  textarea.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      const analyzeBtn = document.getElementById("btn-analyze");
      if (analyzeBtn) analyzeBtn.click();
    }
  });
}

/**
 * Quick Sample Buttons for SMS
 */
const SAMPLE_MESSAGES = {
  spam1: "WINNER! As a valued network customer you have been selected to receive a £900 prize reward! To claim call 09061701461. Claim code KL341. Valid 12 hours only.",
  spam2: "URGENT! Your mobile number won a $2,000 Walmart gift card! Click http://bit.ly/spam-gift to claim now! Reply STOP to opt out.",
  spam3: "Congratulations! Free entry in 2 a weekly competition to win FA Cup final tickets! Text FA to 87121 to receive entry.",
  ham1: "Hey mate, are we still meeting for lunch at 1 PM today? Let me know if that time works for you!",
  ham2: "I'm on my way home now. Stuck in a bit of traffic but should be back around 6:30. Love you!",
  ham3: "Can you please send me the revised project report when you get to your desk? Need it for the 3 PM sync.",
};

function initSamplePills() {
  document.querySelectorAll(".sample-pill[data-sample]").forEach((pill) => {
    pill.addEventListener("click", () => {
      const sampleKey = pill.getAttribute("data-sample");
      const textarea = document.getElementById("message-input");
      if (SAMPLE_MESSAGES[sampleKey] && textarea) {
        textarea.value = SAMPLE_MESSAGES[sampleKey];
        textarea.dispatchEvent(new Event("input"));
        textarea.focus();
        showToast("Sample loaded! Click 'Analyze Message' to test.", "info");
      }
    });
  });
}

/**
 * Message Input & Analyze action
 */
function initAnalyzeForm() {
  const analyzeBtn = document.getElementById("btn-analyze");
  const clearBtn = document.getElementById("btn-clear");
  const textarea = document.getElementById("message-input");

  if (clearBtn && textarea) {
    clearBtn.addEventListener("click", () => {
      textarea.value = "";
      textarea.dispatchEvent(new Event("input"));
      textarea.focus();
      resetResultCard();
      showToast("Input cleared", "info");
    });
  }

  if (analyzeBtn && textarea) {
    analyzeBtn.addEventListener("click", async () => {
      const message = textarea.value.trim();
      if (!message) {
        showToast("Please enter or paste an SMS message to analyze.", "danger");
        textarea.focus();
        return;
      }

      // UI Loading state
      analyzeBtn.disabled = true;
      const originalBtnHTML = analyzeBtn.innerHTML;
      analyzeBtn.innerHTML = `<span class="spinner"></span> Analyzing AI Model...`;

      try {
        const response = await fetch("/api/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Analysis failed.");
        }

        renderPredictionResult(data);
        showToast(`Classified as ${data.prediction} (${data.confidence}% confidence)`, data.is_spam ? "danger" : "success");

        // Refresh live stats
        refreshStatsOverview();
      } catch (err) {
        showToast(err.message || "Failed to analyze message", "danger");
      } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = originalBtnHTML;
      }
    });
  }
}

/**
 * Display prediction results
 */
function renderPredictionResult(data) {
  const emptyState = document.getElementById("results-empty");
  const contentState = document.getElementById("results-content");

  if (emptyState) emptyState.style.display = "none";
  if (contentState) contentState.style.display = "block";

  // 1. Verdict Box
  const badgeBox = document.getElementById("prediction-badge-box");
  const verdictTitle = document.getElementById("verdict-title");
  const verdictSubtitle = document.getElementById("verdict-subtitle");

  if (data.is_spam) {
    badgeBox.className = "prediction-badge-box is-spam";
    verdictTitle.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> SPAM DETECTED`;
    verdictSubtitle.textContent = `High risk SMS pattern identified with ${data.confidence}% confidence`;
  } else {
    badgeBox.className = "prediction-badge-box is-ham";
    verdictTitle.innerHTML = `<i class="fa-solid fa-shield-halved"></i> LEGITIMATE (NOT SPAM)`;
    verdictSubtitle.textContent = `Clean authentic communication pattern with ${data.confidence}% confidence`;
  }

  // 2. Probabilities
  const spamProbBar = document.getElementById("spam-prob-fill");
  const hamProbBar = document.getElementById("ham-prob-fill");
  const spamProbVal = document.getElementById("spam-prob-val");
  const hamProbVal = document.getElementById("ham-prob-val");

  if (spamProbBar) spamProbBar.style.width = `${data.spam_probability}%`;
  if (hamProbBar) hamProbBar.style.width = `${data.ham_probability}%`;
  if (spamProbVal) spamProbVal.textContent = `${data.spam_probability}%`;
  if (hamProbVal) hamProbVal.textContent = `${data.ham_probability}%`;

  // 3. Keywords
  const keywordsContainer = document.getElementById("result-keywords");
  if (keywordsContainer) {
    keywordsContainer.innerHTML = "";
    if (data.detailed_keywords && data.detailed_keywords.length > 0) {
      data.detailed_keywords.forEach((kw) => {
        const span = document.createElement("span");
        span.className = `keyword-tag ${kw.category === "spam" ? "spam-tag" : "ham-tag"}`;
        span.innerHTML = `<i class="fa-solid ${kw.category === "spam" ? "fa-bolt" : "fa-check"}"></i> ${kw.word} <small>(${kw.score > 0 ? "+" : ""}${kw.score})</small>`;
        keywordsContainer.appendChild(span);
      });
    } else {
      keywordsContainer.innerHTML = `<span style="color: var(--text-dim); font-size: 0.85rem;">No strong vocabulary bias detected.</span>`;
    }
  }

  // 4. Metadata
  if (data.metadata) {
    const metaChars = document.getElementById("meta-chars");
    const metaWords = document.getElementById("meta-words");
    const metaCaps = document.getElementById("meta-caps");

    if (metaChars) metaChars.textContent = data.metadata.char_count;
    if (metaWords) metaWords.textContent = data.metadata.word_count;
    if (metaCaps) metaCaps.textContent = `${data.metadata.uppercase_ratio}%`;
  }

  // Store current result for copy button
  window.currentAnalysisResult = data;
}

function resetResultCard() {
  const emptyState = document.getElementById("results-empty");
  const contentState = document.getElementById("results-content");
  if (emptyState) emptyState.style.display = "block";
  if (contentState) contentState.style.display = "none";
}

/**
 * Copy Result to Clipboard
 */
document.addEventListener("click", (e) => {
  if (e.target && e.target.closest("#btn-copy-result")) {
    const data = window.currentAnalysisResult;
    if (!data) return;

    const copyText = `AI SMS Spam Detector Analysis:
Result: ${data.prediction}
Confidence: ${data.confidence}% (Spam: ${data.spam_probability}%, Ham: ${data.ham_probability}%)
Keywords: ${data.keywords ? data.keywords.join(", ") : "None"}
Message: "${data.message}"`;

    navigator.clipboard.writeText(copyText).then(() => {
      showToast("Result copied to clipboard!", "success");
    });
  }
});

/**
 * Refresh top overview stats
 */
async function refreshStatsOverview() {
  try {
    const res = await fetch("/api/analytics");
    if (!res.ok) return;
    const data = await res.json();
    const summary = data.summary;

    const statTotal = document.getElementById("overview-total");
    const statSpam = document.getElementById("overview-spam");
    const statHam = document.getElementById("overview-ham");

    if (statTotal) statTotal.textContent = summary.total_analyzed;
    if (statSpam) statSpam.textContent = summary.spam_count;
    if (statHam) statHam.textContent = summary.ham_count;
  } catch (e) {
    console.error("Error refreshing stats", e);
  }
}

/**
 * History Table Controls
 */
function initHistoryControls() {
  const searchInput = document.getElementById("history-search");
  const filterSelect = document.getElementById("history-filter");
  const clearHistoryBtn = document.getElementById("btn-clear-history");
  const exportCsvBtn = document.getElementById("btn-export-csv");

  let debounceTimer = null;
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchHistory();
      }, 300);
    });
  }

  if (filterSelect) {
    filterSelect.addEventListener("change", () => {
      fetchHistory();
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", async () => {
      if (!confirm("Are you sure you want to clear all analysis history?")) return;

      try {
        const res = await fetch("/api/history/clear", { method: "POST" });
        if (res.ok) {
          showToast("Analysis history cleared.", "info");
          fetchHistory();
          refreshStatsOverview();
        }
      } catch (err) {
        showToast("Failed to clear history", "danger");
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", () => {
      exportHistoryToCSV();
    });
  }
}

/**
 * Fetch and render history table
 */
async function fetchHistory() {
  const searchInput = document.getElementById("history-search");
  const filterSelect = document.getElementById("history-filter");
  const tableBody = document.getElementById("history-table-body");

  if (!tableBody) return;

  const search = searchInput ? searchInput.value.trim() : "";
  const filter = filterSelect ? filterSelect.value : "all";

  const url = `/api/history?search=${encodeURIComponent(search)}&filter=${encodeURIComponent(filter)}&limit=100`;

  try {
    const res = await fetch(url);
    const records = await res.json();

    tableBody.innerHTML = "";
    if (records.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-dim);">
            <i class="fa-solid fa-inbox" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>
            No analysis records found.
          </td>
        </tr>`;
      return;
    }

    records.forEach((rec) => {
      const tr = document.createElement("tr");
      tr.id = `history-row-${rec.id}`;

      const isSpam = rec.is_spam;
      const statusBadge = isSpam
        ? `<span class="badge-status spam"><i class="fa-solid fa-triangle-exclamation"></i> Spam</span>`
        : `<span class="badge-status ham"><i class="fa-solid fa-check"></i> Not Spam</span>`;

      const confVal = isSpam ? rec.spam_probability : rec.ham_probability;

      tr.innerHTML = `
        <td style="color: var(--text-dim); font-size: 0.8rem;">#${rec.id}</td>
        <td>
          <div class="history-msg-snippet" title="${escapeHtml(rec.message)}">
            ${escapeHtml(rec.message)}
          </div>
        </td>
        <td>${statusBadge}</td>
        <td>
          <span style="font-weight: 600;">${confVal}%</span>
        </td>
        <td style="color: var(--text-dim); font-size: 0.8rem;">
          ${rec.created_at || "Recent"}
        </td>
        <td style="text-align: right;">
          <button class="delete-btn" onclick="deleteHistoryItem(${rec.id})" title="Delete record">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load history", err);
  }
}

/**
 * Delete a single history row
 */
window.deleteHistoryItem = async function (id) {
  try {
    const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
    if (res.ok) {
      const row = document.getElementById(`history-row-${id}`);
      if (row) row.remove();
      showToast(`Record #${id} removed.`, "info");
      refreshStatsOverview();
    }
  } catch (err) {
    showToast("Error deleting item", "danger");
  }
};

/**
 * Export history as CSV file
 */
async function exportHistoryToCSV() {
  try {
    const res = await fetch("/api/history?limit=1000");
    const records = await res.json();
    if (!records || records.length === 0) {
      showToast("No records to export.", "info");
      return;
    }

    let csvContent = "ID,Message,Prediction,SpamProbability,HamProbability,Timestamp\n";
    records.forEach((r) => {
      const safeMsg = `"${r.message.replace(/"/g, '""')}"`;
      csvContent += `${r.id},${safeMsg},${r.prediction},${r.spam_probability},${r.ham_probability},"${r.created_at}"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `spam_detector_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV exported successfully!", "success");
  } catch (err) {
    showToast("Failed to export CSV", "danger");
  }
}

/**
 * Analytics Charts (Chart.js)
 */
async function initCharts() {
  if (typeof Chart === "undefined") return;

  Chart.defaults.color = "#9ca3af";
  Chart.defaults.borderColor = "rgba(255, 255, 255, 0.08)";
  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  await fetchAnalyticsAndUpdateCharts();
}

async function fetchAnalyticsAndUpdateCharts() {
  if (typeof Chart === "undefined") return;

  try {
    const res = await fetch("/api/analytics");
    const data = await res.json();
    const summary = data.summary;
    const metrics = data.metrics;

    // 1. Distribution Doughnut Chart
    const distCtx = document.getElementById("chart-distribution");
    if (distCtx) {
      if (charts.distribution) charts.distribution.destroy();
      charts.distribution = new Chart(distCtx, {
        type: "doughnut",
        data: {
          labels: ["Spam Messages", "Legitimate (Ham)"],
          datasets: [
            {
              data: [summary.spam_count, summary.ham_count],
              backgroundColor: ["#ef4444", "#10b981"],
              borderWidth: 2,
              borderColor: "#111827",
              hoverOffset: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom" },
          },
          cutout: "68%",
        },
      });
    }

    // 2. Confidence Buckets Bar Chart
    const confCtx = document.getElementById("chart-confidence");
    if (confCtx) {
      if (charts.confidence) charts.confidence.destroy();
      charts.confidence = new Chart(confCtx, {
        type: "bar",
        data: {
          labels: ["High (≥90%)", "Medium (70-89%)", "Low (<70%)"],
          datasets: [
            {
              label: "Messages Count",
              data: [
                summary.confidence_buckets.high,
                summary.confidence_buckets.medium,
                summary.confidence_buckets.low,
              ],
              backgroundColor: ["#6366f1", "#a855f7", "#ec4899"],
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } },
          },
        },
      });
    }

    // 3. Activity Trend Chart
    const actCtx = document.getElementById("chart-activity");
    if (actCtx && summary.daily_stats) {
      if (charts.activity) charts.activity.destroy();
      const labels = summary.daily_stats.map((s) => s.date);
      const spamData = summary.daily_stats.map((s) => s.spam);
      const hamData = summary.daily_stats.map((s) => s.ham);

      charts.activity = new Chart(actCtx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Spam",
              data: spamData,
              borderColor: "#ef4444",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              tension: 0.3,
              fill: true,
            },
            {
              label: "Legitimate",
              data: hamData,
              borderColor: "#10b981",
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              tension: 0.3,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom" },
          },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } },
          },
        },
      });
    }

    // 4. Top Spam Indicator Words Horizontal Bar Chart
    const kwCtx = document.getElementById("chart-keywords");
    if (kwCtx && metrics.top_spam_words) {
      if (charts.keywords) charts.keywords.destroy();
      const topWords = metrics.top_spam_words.slice(0, 8);
      const kwLabels = topWords.map((w) => w.word);
      const kwWeights = topWords.map((w) => w.weight);

      charts.keywords = new Chart(kwCtx, {
        type: "bar",
        indexAxis: "y",
        data: {
          labels: kwLabels,
          datasets: [
            {
              label: "Spam Log-Odds Weight",
              data: kwWeights,
              backgroundColor: "rgba(239, 68, 68, 0.8)",
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            x: { beginAtZero: true },
          },
        },
      });
    }
  } catch (err) {
    console.error("Error updating charts", err);
  }
}

/**
 * ================= RECEIPT SCAM SCANNER CLIENT LOGIC =================
 */
function initReceiptScanner() {
  const dropzone = document.getElementById("receipt-dropzone");
  const fileInput = document.getElementById("receipt-file-input");
  const previewBox = document.getElementById("receipt-preview-box");
  const previewImg = document.getElementById("receipt-preview-img");
  const removeBtn = document.getElementById("btn-remove-receipt");
  const scanBtn = document.getElementById("btn-scan-receipt");
  const clearBtn = document.getElementById("btn-clear-receipt");

  const sampleFakeBtn = document.getElementById("btn-sample-fake-receipt");
  const sampleRealBtn = document.getElementById("btn-sample-real-receipt");

  const geminiInput = document.getElementById("gemini-api-key");
  const groqInput = document.getElementById("groq-api-key");
  const rememberCheckbox = document.getElementById("remember-api-keys");

  // Load saved API keys from localStorage
  if (geminiInput && localStorage.getItem("saved_gemini_key")) {
    geminiInput.value = localStorage.getItem("saved_gemini_key");
  }
  if (groqInput && localStorage.getItem("saved_groq_key")) {
    groqInput.value = localStorage.getItem("saved_groq_key");
  }

  // Save API keys when modified
  const saveKeysToStorage = () => {
    if (rememberCheckbox && rememberCheckbox.checked) {
      if (geminiInput) localStorage.setItem("saved_gemini_key", geminiInput.value.trim());
      if (groqInput) localStorage.setItem("saved_groq_key", groqInput.value.trim());
    } else {
      localStorage.removeItem("saved_gemini_key");
      localStorage.removeItem("saved_groq_key");
    }
  };
  if (geminiInput) geminiInput.addEventListener("input", saveKeysToStorage);
  if (groqInput) groqInput.addEventListener("input", saveKeysToStorage);

  // Toggle API settings accordion
  const toggleBtn = document.getElementById("toggle-api-settings");
  const settingsBody = document.getElementById("api-settings-body");
  const toggleIcon = document.getElementById("api-toggle-icon");
  if (toggleBtn && settingsBody) {
    toggleBtn.addEventListener("click", () => {
      const isHidden = settingsBody.style.display === "none";
      settingsBody.style.display = isHidden ? "flex" : "none";
      if (toggleIcon) toggleIcon.className = isHidden ? "fa-solid fa-chevron-up" : "fa-solid fa-chevron-down";
    });
  }

  // Dropzone click -> file dialog
  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());

    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });

    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("dragover");
    });

    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleReceiptFileSelected(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleReceiptFileSelected(e.target.files[0]);
      }
    });
  }

  function handleReceiptFileSelected(file) {
    if (!file.type.startsWith("image/")) {
      showToast("Please select a valid image file (PNG, JPG, WEBP).", "danger");
      return;
    }

    activeReceiptFile = file;
    activeSampleType = null;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (previewImg && previewBox && dropzone) {
        previewImg.src = e.target.result;
        previewBox.style.display = "block";
        dropzone.style.display = "none";
      }
    };
    reader.readAsDataURL(file);
    showToast(`Loaded "${file.name}"`, "info");
  }

  // Remove image
  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      resetReceiptInput();
      showToast("Receipt removed", "info");
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      resetReceiptInput();
      resetReceiptResults();
      showToast("Receipt scanner reset", "info");
    });
  }

  function resetReceiptInput() {
    activeReceiptFile = null;
    activeSampleType = null;
    if (fileInput) fileInput.value = "";
    if (previewBox) previewBox.style.display = "none";
    if (previewImg) previewImg.src = "";
    if (dropzone) dropzone.style.display = "block";
  }

  function resetReceiptResults() {
    const emptyState = document.getElementById("receipt-results-empty");
    const contentState = document.getElementById("receipt-results-content");
    if (emptyState) emptyState.style.display = "block";
    if (contentState) contentState.style.display = "none";
  }

  // Pre-loaded sample buttons
  if (sampleFakeBtn) {
    sampleFakeBtn.addEventListener("click", () => {
      activeReceiptFile = null;
      activeSampleType = "fake";
      if (previewImg && previewBox && dropzone) {
        previewImg.src = "/static/images/sample_fake_receipt.png";
        previewBox.style.display = "block";
        dropzone.style.display = "none";
      }
      showToast("Loaded Sample Fake Receipt. Click 'Scan Receipt' to test!", "info");
    });
  }

  if (sampleRealBtn) {
    sampleRealBtn.addEventListener("click", () => {
      activeReceiptFile = null;
      activeSampleType = "real";
      if (previewImg && previewBox && dropzone) {
        previewImg.src = "/static/images/sample_real_receipt.png";
        previewBox.style.display = "block";
        dropzone.style.display = "none";
      }
      showToast("Loaded Sample Authentic Receipt. Click 'Scan Receipt' to test!", "info");
    });
  }

  // Scan Action
  if (scanBtn) {
    scanBtn.addEventListener("click", async () => {
      if (!activeReceiptFile && !activeSampleType) {
        showToast("Please upload a receipt screenshot or select a test sample first.", "danger");
        return;
      }

      const engineSelect = document.getElementById("receipt-engine");
      const engine = engineSelect ? engineSelect.value : "dual";
      const geminiKey = geminiInput ? geminiInput.value.trim() : "";
      const groqKey = groqInput ? groqInput.value.trim() : "";

      scanBtn.disabled = true;
      const originalBtnHTML = scanBtn.innerHTML;
      scanBtn.innerHTML = `<span class="spinner"></span> Inspecting with AI Vision...`;

      const formData = new FormData();
      if (activeReceiptFile) {
        formData.append("image", activeReceiptFile);
      } else if (activeSampleType) {
        formData.append("sample_type", activeSampleType);
      }

      formData.append("engine", engine);
      if (geminiKey) formData.append("gemini_api_key", geminiKey);
      if (groqKey) formData.append("groq_api_key", groqKey);

      try {
        const response = await fetch("/api/scan-receipt", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Receipt scan failed.");
        }

        renderReceiptResult(data);
        showToast(`Scan complete: ${data.verdict} (Risk: ${data.risk_score}/100)`, data.is_scam ? "danger" : "success");
        fetchReceiptHistory();
      } catch (err) {
        showToast(err.message || "Error analyzing receipt", "danger");
      } finally {
        scanBtn.disabled = false;
        scanBtn.innerHTML = originalBtnHTML;
      }
    });
  }
}

/**
 * Display Receipt Forensic Result
 */
function renderReceiptResult(data) {
  const emptyState = document.getElementById("receipt-results-empty");
  const contentState = document.getElementById("receipt-results-content");

  if (emptyState) emptyState.style.display = "none";
  if (contentState) contentState.style.display = "block";

  // Verdict Banner
  const banner = document.getElementById("receipt-verdict-banner");
  const title = document.getElementById("receipt-verdict-title");
  const subtitle = document.getElementById("receipt-verdict-subtitle");

  if (data.verdict === "SCAM") {
    banner.className = "prediction-badge-box is-spam";
    title.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> FAKE / SCAM RECEIPT`;
    subtitle.textContent = data.summary || "High probability synthetic fraud signature detected.";
  } else if (data.verdict === "SUSPICIOUS") {
    banner.className = "prediction-badge-box";
    banner.style.background = "rgba(245, 158, 11, 0.15)";
    banner.style.border = "2px solid rgba(245, 158, 11, 0.4)";
    title.style.color = "#fbbf24";
    title.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> SUSPICIOUS RECEIPT`;
    subtitle.textContent = data.summary || "Inconclusive cues. Review details carefully.";
  } else {
    banner.className = "prediction-badge-box is-ham";
    title.innerHTML = `<i class="fa-solid fa-shield-halved"></i> AUTHENTIC RECEIPT`;
    subtitle.textContent = data.summary || "Receipt matches legitimate bank confirmation patterns.";
  }

  // Risk Score
  const riskScore = document.getElementById("receipt-risk-score");
  const riskFill = document.getElementById("receipt-risk-fill");
  const engineBadge = document.getElementById("receipt-engine-badge");
  const confVal = document.getElementById("receipt-confidence-val");

  if (riskScore) riskScore.textContent = `${data.risk_score} / 100`;
  if (riskFill) {
    riskFill.style.width = `${data.risk_score}%`;
    if (data.risk_score >= 70) {
      riskFill.className = "risk-bar-fill fill-spam";
    } else if (data.risk_score >= 40) {
      riskFill.className = "risk-bar-fill";
      riskFill.style.background = "#fbbf24";
    } else {
      riskFill.className = "risk-bar-fill fill-ham";
    }
  }

  if (engineBadge) engineBadge.textContent = `Engine: ${data.engine_used || "AI Vision"}`;
  if (confVal) confVal.textContent = `Confidence: ${data.confidence || 90}%`;

  // Extracted Details
  const details = data.extracted_details || {};
  const extApp = document.getElementById("ext-app");
  const extAmount = document.getElementById("ext-amount");
  const extPayee = document.getElementById("ext-payee");
  const extUtr = document.getElementById("ext-utr");

  if (extApp) extApp.textContent = details.app_or_bank || "Unknown";
  if (extAmount) extAmount.textContent = details.amount || "N/A";
  if (extPayee) extPayee.textContent = details.payee || "N/A";
  if (extUtr) extUtr.textContent = details.transaction_id || "N/A";

  // Forensic Checks Table
  const tbody = document.getElementById("receipt-forensic-tbody");
  if (tbody) {
    tbody.innerHTML = "";
    if (data.forensic_checks && data.forensic_checks.length > 0) {
      data.forensic_checks.forEach((chk) => {
        const tr = document.createElement("tr");
        const statusClass = (chk.status || "").toLowerCase();
        let icon = "fa-check";
        if (statusClass === "fail") icon = "fa-xmark";
        if (statusClass === "warning") icon = "fa-triangle-exclamation";

        tr.innerHTML = `
          <td style="font-weight: 500;">${escapeHtml(chk.check)}</td>
          <td>
            <span class="forensic-badge ${statusClass}">
              <i class="fa-solid ${icon}"></i> ${escapeHtml(chk.status)}
            </span>
          </td>
          <td style="color: var(--text-muted);">${escapeHtml(chk.details)}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  // Red Flags
  const flagsCard = document.getElementById("receipt-red-flags-card");
  const flagsList = document.getElementById("receipt-red-flags-list");
  if (flagsCard && flagsList) {
    if (data.red_flags && data.red_flags.length > 0) {
      flagsCard.style.display = "block";
      flagsList.innerHTML = data.red_flags.map((rf) => `<li>${escapeHtml(rf)}</li>`).join("");
    } else {
      flagsCard.style.display = "none";
      flagsList.innerHTML = "";
    }
  }

  // Recommendation
  const recText = document.getElementById("receipt-recommendation-text");
  if (recText) {
    recText.textContent = data.recommendation || "Verify transaction directly in your banking app before delivering goods or services.";
  }
}

/**
 * Fetch and render receipt history
 */
async function fetchReceiptHistory() {
  const tbody = document.getElementById("receipt-history-tbody");
  if (!tbody) return;

  try {
    const res = await fetch("/api/receipt-history");
    const records = await res.json();

    tbody.innerHTML = "";
    if (records.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-dim);">
            No receipt scans recorded yet.
          </td>
        </tr>`;
      return;
    }

    records.forEach((r) => {
      const tr = document.createElement("tr");
      tr.id = `receipt-row-${r.id}`;

      const isScam = r.is_scam;
      const statusBadge = isScam
        ? `<span class="badge-status spam"><i class="fa-solid fa-triangle-exclamation"></i> Fake / Scam</span>`
        : `<span class="badge-status ham"><i class="fa-solid fa-check"></i> Authentic</span>`;

      const riskColor = r.risk_score >= 70 ? "#f87171" : r.risk_score >= 40 ? "#fbbf24" : "#34d399";

      tr.innerHTML = `
        <td style="color: var(--text-dim); font-size: 0.8rem;">#${r.id}</td>
        <td style="font-weight: 500;">${escapeHtml(r.filename)}</td>
        <td>${statusBadge}</td>
        <td>
          <strong style="color: ${riskColor};">${r.risk_score}/100</strong>
        </td>
        <td style="color: #fbbf24; font-weight: 600;">${escapeHtml(r.amount || "N/A")}</td>
        <td>${escapeHtml(r.app_name || "N/A")}</td>
        <td style="color: var(--text-dim); font-size: 0.8rem;">${escapeHtml(r.engine_used || "")}</td>
        <td style="text-align: right;">
          <button class="delete-btn" onclick="deleteReceiptItem(${r.id})" title="Delete record">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Error fetching receipt history", err);
  }
}

window.deleteReceiptItem = async function (id) {
  try {
    const res = await fetch(`/api/receipt-history/${id}`, { method: "DELETE" });
    if (res.ok) {
      const row = document.getElementById(`receipt-row-${id}`);
      if (row) row.remove();
      showToast(`Receipt record #${id} removed.`, "info");
    }
  } catch (err) {
    showToast("Error deleting item", "danger");
  }
};

window.togglePasswordVisibility = function (inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
};

/**
 * Toast Notification Utility
 */
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  let icon = "fa-circle-info";
  if (type === "success") icon = "fa-circle-check";
  if (type === "danger") icon = "fa-triangle-exclamation";

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  // Animate in
  setTimeout(() => toast.classList.add("show"), 10);

  // Auto remove after 3.5 seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

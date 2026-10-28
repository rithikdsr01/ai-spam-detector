/**
 * Client-Side JavaScript for AI Spam Message Detector
 * Handles AJAX requests, UI updates, Chart.js visualizations, and interactions.
 */

// Global Chart references for updating
let charts = {
  distribution: null,
  confidence: null,
  activity: null,
  keywords: null,
};

// DOM ready
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initTextareaCounters();
  initSamplePills();
  initAnalyzeForm();
  initHistoryControls();
  initCharts();
});

/**
 * Tab Navigation
 */
function initTabs() {
  const tabButtons = document.querySelectorAll(".nav-item-btn");
  const tabSections = {
    home: document.getElementById("tab-home"),
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
 * Quick Sample Buttons
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
  document.querySelectorAll(".sample-pill").forEach((pill) => {
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
  // Check if Chart.js is loaded
  if (typeof Chart === "undefined") return;

  // Chart defaults for dark theme
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

document.addEventListener("DOMContentLoaded", () => {
  const getEl = (id) => document.getElementById(id);

  const elements = {
    senderAccount: getEl("senderAccount"),
    dest: getEl("dest"),
    saludo: getEl("saludo"),
    case: getEl("case"),
    links: getEl("links"),
    subjectTemplate: getEl("subjectTemplate"),
    bodyTemplate: getEl("bodyTemplate"),
    start: getEl("start"),
    reset: getEl("reset"),
    status: getEl("status"),
    delayMin: getEl("delayMin"),
    delayMax: getEl("delayMax"),
  };

  const DEFAULTS = {
    case: "009873965829517000",
    subjectTemplate:
      "{{username}} | Feedback #{{CASE}} 𝄀 Shadowbanned Account Notice",
    bodyTemplate: `{{saludo}}

We want to inform you that the account @{{username}} is violating twenty-eight (28) community reports of our platform.

For these reasons we have limited the interaction on your account and your profile will no longer be shown to people who do not follow you.

If this situation is not regularized, we can delete your account without prior notice.

Sincerely, Meta Premier Partners Operations Team
---------------------------
Case No. {{CASE}}`,
  };

  function loadSettings() {
    chrome.storage.local.get(
      [
        "senderAccount",
        "dest",
        "saludo",
        "case",
        "links",
        "subjectTemplate",
        "bodyTemplate",
        "delayMin",
        "delayMax",
        "currentIndex",
      ],
      (res) => {
        if (elements.senderAccount)
          elements.senderAccount.value = res.senderAccount || "";
        if (elements.dest) elements.dest.value = res.dest || "";
        if (elements.saludo) elements.saludo.value = res.saludo || "";
        if (elements.case) elements.case.value = res.case || DEFAULTS.case;
        if (elements.links) elements.links.value = res.links || "";
        if (elements.subjectTemplate)
          elements.subjectTemplate.value =
            res.subjectTemplate || DEFAULTS.subjectTemplate;
        if (elements.bodyTemplate)
          elements.bodyTemplate.value =
            res.bodyTemplate || DEFAULTS.bodyTemplate;
        if (elements.delayMin) elements.delayMin.value = res.delayMin || "3000";
        if (elements.delayMax) elements.delayMax.value = res.delayMax || "8000";
        updateStatusUI(res.currentIndex || 0);
      },
    );
  }

  function saveSettings() {
    chrome.storage.local.set({
      senderAccount: elements.senderAccount ? elements.senderAccount.value : "",
      dest: elements.dest ? elements.dest.value : "",
      saludo: elements.saludo ? elements.saludo.value : "",
      case: elements.case ? elements.case.value : "",
      links: elements.links ? elements.links.value : "",
      subjectTemplate: elements.subjectTemplate
        ? elements.subjectTemplate.value
        : "",
      bodyTemplate: elements.bodyTemplate ? elements.bodyTemplate.value : "",
      delayMin: elements.delayMin ? elements.delayMin.value : "",
      delayMax: elements.delayMax ? elements.delayMax.value : "",
    });
  }

  function parseLinks(text) {
    if (!text) return [];
    return text
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(normalizeLink);
  }

  function normalizeLink(s) {
    if (s.includes("instagram.com")) {
      const parts = s.split("instagram.com/")[1] || "";
      return parts.split(/[/?#]/)[0];
    }
    return s.replace(/[\\/?#].*$/, "").split(/[/?#]/)[0];
  }

  function nextCase(caseStr) {
    try {
      const n = BigInt(caseStr) + 1n;
      return n.toString().padStart(caseStr.length, "0");
    } catch (e) {
      const num = parseInt(caseStr, 10) || 0;
      const next = num + 1;
      return String(next).padStart(caseStr.length, "0");
    }
  }

  function fillTemplate(tpl, map) {
    return tpl
      .replace(/\{\{\s*username\s*\}\}/g, map.username)
      .replace(/\{\{\s*CASE\s*\}\}/g, map.CASE)
      .replace(/\{\{\s*saludo\s*\}\}/g, map.saludo);
  }

  function openMail(senderAccount, dest, subject, body, callback) {
    const authParam = senderAccount
      ? `authuser=${encodeURIComponent(senderAccount)}&`
      : "";
    const url = `https://mail.google.com/mail/?${authParam}view=cm&fs=1&to=${encodeURIComponent(
      dest,
    )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    chrome.tabs.create({ url }, callback);
  }

  function updateStatusUI(index) {
    if (!elements.links || !elements.status || !elements.start) return;

    const list = parseLinks(elements.links.value);
    if (list.length === 0) {
      elements.status.textContent = "No hay links válidos.";
      elements.start.disabled = true;
      return;
    }
    if (index >= list.length) {
      elements.status.textContent = `✅ Proceso finalizado. ${list.length}/${list.length} enviados.`;
      elements.start.disabled = true;
      return;
    }
    elements.status.textContent = `Listo para enviar ${index + 1}/${
      list.length
    }: ${list[index]}`;
    elements.start.disabled = false;
  }

  function handleSend() {
    if (!elements.links) return;

    saveSettings();
    const list = parseLinks(elements.links.value);

    if (list.length === 0) {
      if (elements.status)
        elements.status.textContent = "No hay links válidos.";
      return;
    }

    chrome.storage.local.get(["currentIndex", "case"], (res) => {
      const index = res.currentIndex || 0;
      const currentCase =
        res.case ||
        (elements.case ? elements.case.value.trim() : DEFAULTS.case);

      if (index >= list.length) {
        if (elements.status)
          elements.status.textContent = `✅ Proceso finalizado. ${list.length}/${list.length} enviados.`;
        if (elements.start) elements.start.disabled = true;
        return;
      }

      const username = list[index];
      const senderAccount = elements.senderAccount
        ? elements.senderAccount.value.trim()
        : "";
      const dest = elements.dest ? elements.dest.value.trim() : "";
      const saludo = elements.saludo ? elements.saludo.value : "";
      const subjectTemplate = elements.subjectTemplate
        ? elements.subjectTemplate.value
        : DEFAULTS.subjectTemplate;
      const bodyTemplate = elements.bodyTemplate
        ? elements.bodyTemplate.value
        : DEFAULTS.bodyTemplate;

      const subject = fillTemplate(subjectTemplate, {
        username,
        CASE: currentCase,
        saludo,
      });

      const body = fillTemplate(bodyTemplate, {
        username,
        CASE: currentCase,
        saludo,
      });

      const newIndex = index + 1;
      const newCase = nextCase(currentCase);

      chrome.storage.local.set(
        {
          _processing: true,
          currentIndex: newIndex,
          case: newCase,
        },
        () => {
          openMail(senderAccount, dest, subject, body, () => {});
          if (elements.case) elements.case.value = newCase;
          updateStatusUI(newIndex);
        },
      );
    });
  }

  if (elements.start) {
    elements.start.addEventListener("click", handleSend);
  }

  if (elements.reset) {
    elements.reset.addEventListener("click", () => {
      chrome.storage.local.set({ currentIndex: 0 }, () => {
        updateStatusUI(0);
      });
    });
  }

  if (elements.links) {
    elements.links.addEventListener("input", () => {
      chrome.storage.local.set({ currentIndex: 0 }, () => updateStatusUI(0));
    });
  }

  loadSettings();
});

let isProcessing = false;
let activeTabId = null;

function getNextEmailData(callback) {
  chrome.storage.local.get(
    [
      'currentIndex',
      'links',
      'dest',
      'saludo',
      'case',
      'subjectTemplate',
      'bodyTemplate',
    ],
    (res) => {
      const index = res.currentIndex || 0;
      const linksText = res.links || '';

      const list = linksText
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          if (s.includes('instagram.com')) {
            const parts = s.split('instagram.com/')[1] || '';
            return parts.split(/[/?#]/)[0];
          }
          return s.replace(/[\\/?#].*$/, '').split(/[/?#]/)[0];
        });

      if (index >= list.length) {
        callback(null);
        return;
      }

      const username = list[index];
      const currentCase = res.case || '009873965829517000';

      let nextCaseVal = currentCase;
      try {
        const n = BigInt(currentCase) + 1n;
        nextCaseVal = n.toString().padStart(currentCase.length, '0');
      } catch (e) {
        const num = parseInt(currentCase, 10) || 0;
        nextCaseVal = String(num + 1).padStart(currentCase.length, '0');
      }

      const subjectTpl =
        res.subjectTemplate ||
        '{{username}} | Feedback #{{CASE}} 𝄀 Shadowbanned Account Notice';
      const bodyTpl =
        res.bodyTemplate ||
        `{{saludo}}

We want to inform you that the account @{{username}} is violating twenty-eight (28) community reports of our platform.

For these reasons we have limited the interaction on your account and your profile will no longer be shown to people who do not follow you.

If this situation is not regularized, we can delete your account without prior notice.

Sincerely, Meta Premier Partners Operations Team
---------------------------
Case No. {{CASE}}`;

      const map = {
        username,
        CASE: currentCase,
        saludo: res.saludo || '',
      };

      const subject = subjectTpl
        .replace(/\{\{\s*username\s*\}\}/g, map.username)
        .replace(/\{\{\s*CASE\s*\}\}/g, map.CASE)
        .replace(/\{\{\s*saludo\s*\}\}/g, map.saludo);

      const body = bodyTpl
        .replace(/\{\{\s*username\s*\}\}/g, map.username)
        .replace(/\{\{\s*CASE\s*\}\}/g, map.CASE)
        .replace(/\{\{\s*saludo\s*\}\}/g, map.saludo);

      callback({
        url: `https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${encodeURIComponent(
          res.dest || ''
        )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
        nextIndex: index + 1,
        nextCase: nextCaseVal,
      });
    }
  );
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.firstTab) {
    isProcessing = true;
    activeTabId = msg.firstTab;
  }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (isProcessing && tabId === activeTabId) {
    activeTabId = null;

    getNextEmailData((data) => {
      if (!data) {
        isProcessing = false;
        return;
      }

      chrome.tabs.create({ url: data.url }, (newTab) => {
        activeTabId = newTab.id;
        chrome.storage.local.set({
          currentIndex: data.nextIndex,
          case: data.nextCase,
        });
      });
    });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isProcessing && tabId === activeTabId && changeInfo.url) {
    if (
      !changeInfo.url.includes('view=cm') &&
      !changeInfo.url.includes('google.com/mail')
    ) {
      // Si navegó fuera de gmail, asumimos fin o error, pero mejor esperar a cierre explícito
      // Por seguridad, dejaremos que el usuario cierre la pestaña (onRemoved).
    }
  }
});

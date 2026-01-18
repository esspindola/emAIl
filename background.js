function getNextEmailData(callback) {
  chrome.storage.local.get(
    [
      "currentIndex",
      "links",
      "senderAccount",
      "dest",
      "saludo",
      "case",
      "subjectTemplate",
      "bodyTemplate",
    ],
    (res) => {
      const index = res.currentIndex || 0;
      const linksText = res.links || "";

      const list = linksText
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          if (s.includes("instagram.com")) {
            const parts = s.split("instagram.com/")[1] || "";
            return parts.split(/[/?#]/)[0];
          }
          return s.replace(/[\\/?#].*$/, "").split(/[/?#]/)[0];
        });

      if (index >= list.length) {
        callback(null);
        return;
      }

      const username = list[index];
      const currentCase = res.case || "009873965829517000";

      let nextCaseVal = currentCase;
      try {
        const n = BigInt(currentCase) + 1n;
        nextCaseVal = n.toString().padStart(currentCase.length, "0");
      } catch (e) {
        const num = parseInt(currentCase, 10) || 0;
        nextCaseVal = String(num + 1).padStart(currentCase.length, "0");
      }

      const subjectTpl =
        res.subjectTemplate ||
        "{{username}} | Feedback #{{CASE}} 𝄀 Shadowbanned Account Notice";
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
        saludo: res.saludo || "",
      };

      const subject = subjectTpl
        .replace(/\{\{\s*username\s*\}\}/g, map.username)
        .replace(/\{\{\s*CASE\s*\}\}/g, map.CASE)
        .replace(/\{\{\s*saludo\s*\}\}/g, map.saludo);

      const body = bodyTpl
        .replace(/\{\{\s*username\s*\}\}/g, map.username)
        .replace(/\{\{\s*CASE\s*\}\}/g, map.CASE)
        .replace(/\{\{\s*saludo\s*\}\}/g, map.saludo);

      const senderAccount = res.senderAccount || "";
      const authParam = senderAccount
        ? `authuser=${encodeURIComponent(senderAccount)}&`
        : "";

      callback({
        url: `https://mail.google.com/mail/?${authParam}view=cm&fs=1&to=${encodeURIComponent(
          res.dest || "",
        )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
        nextIndex: index + 1,
        nextCase: nextCaseVal,
      });
    },
  );
}

chrome.tabs.onRemoved.addListener(() => {
  chrome.storage.local.get(["_processing"], (state) => {
    if (!state._processing) return;

    getNextEmailData((data) => {
      if (!data) {
        chrome.storage.local.set({ _processing: false });
        return;
      }

      chrome.tabs.create({ url: data.url }, () => {
        chrome.storage.local.set({
          currentIndex: data.nextIndex,
          case: data.nextCase,
        });
      });
    });
  });
});

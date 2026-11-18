// The page loads its data from the tokenized loopback session. Model text is
// inserted by the client as text nodes; only bundled assets are served.
export function alignmentPage(lang, prefix) {
  const ko = lang === "ko";
  const t = (k, e) => (ko ? k : e);
  return `<!doctype html><html lang="${ko ? "ko" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t("정렬 결정", "Alignment decisions")}</title><link rel="stylesheet" href="${prefix}/app.css"><script defer src="${prefix}/app.js"></script></head>
<body data-base="${prefix}"><header><strong>Ontology Writer</strong><span>${t("정렬 결정", "Alignment decisions")}</span><output id="connection" aria-live="polite"></output></header>
<main><article><p id="warning" role="alert"></p><h1>${t("정렬에 필요한 결정", "Alignment decisions")}</h1>
<p>${t("터미널에서 시작한 정렬 중 답변이나 승인이 필요한 항목이 여기에 표시됩니다.", "Questions and approvals from alignment started in the terminal appear here.")}</p>
<label><input id="history" type="checkbox">${t("응답한 항목과 결과도 보기", "Show answered items and results")}</label>
<div id="requests" aria-live="polite"></div></article></main>
<footer><button id="end" type="button">${t("세션 종료", "End session")}</button></footer></body></html>`;
}

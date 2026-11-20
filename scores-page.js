// Stickers, student profile, and score entry. Loaded after the teacher page script.
// ── AVERY 5160 STICKER SHEET (1" × 2-5/8", 30 per Letter page) ──
function stickerPeriodCmp(a, b) {
  var na = parseInt(a, 10), nb = parseInt(b, 10);
  var pa = isNaN(na) ? Number.POSITIVE_INFINITY : na;
  var pb = isNaN(nb) ? Number.POSITIVE_INFINITY : nb;
  if (pa !== pb) return pa - pb;
  return String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: "base" });
}
function stickerAlphaCmp(a, b) {
  var ln = String(a.last || "").trim().localeCompare(String(b.last || "").trim(), undefined, { sensitivity: "base", numeric: true });
  return ln || String(a.first || "").trim().localeCompare(String(b.first || "").trim(), undefined, { sensitivity: "base", numeric: true });
}
function openStickerSheet() {
  var list = allStudents();
  if (!list.length) { alert("No students to print. Add students to the roster first."); return; }
  var overlay = document.getElementById("sticker-overlay");
  if (!overlay) { alert("Refresh the page, then try Stickers again."); return; }
  var pSel = document.getElementById("sticker-period");
  var sSel = document.getElementById("sticker-sort");
  if (pSel) {
    var cur = pSel.value || "all";
    var periods = Array.from(new Set(list.map(function(s) { return s.period; }))).sort(stickerPeriodCmp);
    pSel.innerHTML = '<option value="all">All periods</option>' + periods.map(function(p) {
      return '<option value="' + String(p == null ? "" : p).replace(/"/g, "&quot;") + '">Period ' + p + "</option>";
    }).join("");
    pSel.value = (cur === "all" || periods.map(String).indexOf(String(cur)) >= 0) ? cur : "all";
  }
  if (sSel && !sSel.value) sSel.value = "period";
  overlay.classList.remove("hidden");
  document.body.classList.add("sticker-open");
  if (!window._stickerPrintBound) {
    window._stickerPrintBound = true;
    window.addEventListener("afterprint", function() { document.body.classList.remove("sticker-print"); });
  }
  renderStickerSheet();
}
function closeStickerSheet() {
  var overlay = document.getElementById("sticker-overlay");
  if (overlay) overlay.classList.add("hidden");
  document.body.classList.remove("sticker-open", "sticker-print");
}
function printStickerSheet() {
  document.body.classList.add("sticker-print");
  window.print();
}
function renderStickerSheet() {
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  var sort = (document.getElementById("sticker-sort") || {}).value || "period";
  var period = (document.getElementById("sticker-period") || {}).value || "all";
  var list = allStudents().filter(function(s) {
    return period === "all" || String(s.period) === String(period);
  });
  if (sort === "alpha") list.sort(stickerAlphaCmp);
  else list.sort(function(a, b) {
    var p = stickerPeriodCmp(a.period, b.period);
    return p || stickerAlphaCmp(a, b);
  });
  var groups = [];
  if (sort === "period" && period === "all") {
    var map = {}, keys = [];
    list.forEach(function(s) {
      var k = String(s.period == null ? "" : s.period);
      if (!map[k]) { map[k] = []; keys.push(k); }
      map[k].push(s);
    });
    keys.sort(stickerPeriodCmp);
    keys.forEach(function(k) {
      groups.push({ label: k === "" ? "No period" : "Period " + k, rows: map[k] });
    });
  } else {
    var title = period === "all" ? "All periods · A–Z" : "Period " + period;
    groups.push({ label: title, rows: list });
  }
  var perSheet = 30;
  function labelHtml(s) {
    var name = esc(studentName(s));
    var code = esc(s.access_code || "—");
    var meta = [];
    if (s.period) meta.push("P" + s.period);
    if (s.grade) meta.push("Gr " + s.grade);
    return '<div class="st-label"><div class="st-name">' + name + '</div><div class="st-code">' + code + "</div>" +
      (meta.length ? '<div class="st-meta">' + esc(meta.join(" · ")) + "</div>" : "") + "</div>";
  }
  function sheetHtml(page) {
    var cells = page.map(labelHtml);
    while (cells.length < perSheet) cells.push('<div class="st-label empty"></div>');
    return '<div class="st-sheet">' + cells.join("") + "</div>";
  }
  var html = groups.map(function(g) {
    var pages = "";
    for (var i = 0; i < g.rows.length; i += perSheet) pages += sheetHtml(g.rows.slice(i, i + perSheet));
    return '<div class="st-sheet-label">' + esc(g.label) + " · " + g.rows.length + " student" + (g.rows.length === 1 ? "" : "s") + "</div>" + pages;
  }).join("");
  var pagesEl = document.getElementById("sticker-pages");
  if (pagesEl) pagesEl.innerHTML = html || '<p style="text-align:center;padding:2rem;color:#4A5068">No students in this period.</p>';
  var btn = document.getElementById("sticker-print-btn");
  if (btn) btn.textContent = period === "all" ? "Print all" : "Print this period";
  var meta = document.getElementById("sticker-meta");
  var sortNote = sort === "period" && period === "all"
    ? "Whole roster · sorted by period, A–Z last name inside each period · new sheet per period"
    : (sort === "alpha" ? "Sorted A–Z by last name" : "A–Z by last name");
  if (meta) meta.textContent = list.length + " students · " + sortNote + " · Avery 5160 / 8160, 1 in x 2-5/8 in, 30 per page. Print at Letter, 100%, margins None.";
}

// ── STUDENT PROFILE ──────────────────────────────────────────
function openSP(id) {
  var s = students.find(function(x) { return x.id === id; }) || allStudents().find(function(x) { return x.id === id; });
  if (!s) return;
  var av = document.getElementById("sp-av");
  av.style.cssText = avSty(studentFirst(s), studentLast(s), 48);
  av.textContent = (studentFirst(s)[0] || "?") + (studentLast(s)[0] || "");
  document.getElementById("sp-name").textContent = studentName(s);
  document.getElementById("sp-sub").textContent = "Grade " + s.grade + " · Period " + s.period + (s.gender ? " · " + genderLabel(genderKey(s.gender) === "unknown" ? s.gender : genderKey(s.gender)) : "") + (s.email ? " · " + s.email : "");
  fillStudentProfileForm(s);
  var totalEntries = skills.reduce(function(sum, sk) { return sum + getVals(s.id, sk.id).length; }, 0);
  var improving    = skills.filter(function(sk) { var imp = getImp(s.id, sk.id); return imp && imp.ok; }).length;
  var bestRank     = null;
  skills.forEach(function(sk) { var r = getRank(s.id, sk.id); if (r && (!bestRank || r < bestRank)) bestRank = r; });
  setHTML("sp-stats", [
    {icon:"📊", n: totalEntries, l:"Total Entries"},
    {icon:"🏆", n: bestRank ? "#" + bestRank : "—", l:"Best Rank"},
    {icon:"📈", n: improving + "/" + skills.length, l:"Improving"},
    {icon:"📅", n: Math.max.apply(null, skills.map(function(sk) { return getVals(s.id, sk.id).length; }).concat([0])) + " wks", l:"Weeks Logged"}
  ].map(function(c) { return '<div class="stat-card"><div style="font-size:18px">' + c.icon + '</div><div class="stat-n">' + c.n + '</div><div class="stat-l">' + c.l + '</div></div>'; }).join(""));
  var goals = studentGoals[s.id] || {};
  setHTML("sp-goals", skills.map(function(sk) {
    var last = getLast(s.id, sk.id);
    return '<div><label class="lbl">' + sk.name + ' goal (' + (isTimeSkill(sk) ? "sec or mm:ss" : sk.unit) + ')</label><input ' + (isTimeSkill(sk) ? 'type="text" inputmode="decimal" autocomplete="off" placeholder="' + (last !== null ? formatTimeValue(last, sk) : "6:42") + '" value="' + (goals[sk.id] ? formatTimeValue(goals[sk.id], sk) : "") + '"' : 'type="number" step="0.1" placeholder="' + (last !== null ? "Current: " + last : "No entries yet") + '" value="' + (goals[sk.id] || "") + '"') + ' id="goal-' + sk.id + '" style="font-size:14px"/></div>';
  }).join(""));
  setHTML("sp-charts", skills.map(function(sk) {
    var vals = getVals(s.id, sk.id), rank = getRank(s.id, sk.id), imp = getImp(s.id, sk.id);
    var goal = goals[sk.id], last = vals.length ? vals[vals.length-1] : null;
    var best = vals.length ? (sk.lower_better ? Math.min.apply(null,vals) : Math.max.apply(null,vals)) : null;
    var bars = "";
    if (vals.length) {
      var mn = Math.min.apply(null,vals) - 1, mx = Math.max.apply(null,vals) + 1, rng = mx - mn || 1;
      bars = '<div style="display:flex;align-items:flex-end;gap:3px;height:64px;padding:0 4px;position:relative">' +
        vals.map(function(v, i) {
          var h = Math.max(4, Math.round(((sk.lower_better ? mx - v : v - mn) / rng) * 56));
          var isLast = i === vals.length - 1;
          var col = isLast ? "var(--gold)" : (i > 0 && (sk.lower_better ? v < vals[i-1] : v > vals[i-1]) ? "rgba(201,168,76,.5)" : "var(--surface3)");
          return '<div style="display:flex;flex-direction:column;align-items:center;flex:1"><div style="font-size:9px;color:var(--text3);margin-bottom:2px">' + formatTimeValue(v, sk) + '</div><div style="width:100%;height:' + h + 'px;background:' + col + ';border-radius:3px 3px 0 0"></div></div>';
        }).join("") +
        (goal ? '<div style="position:absolute;left:0;right:0;height:1px;background:rgba(201,168,76,.6);bottom:' + Math.round(((sk.lower_better?mx-goal:goal-mn)/rng)*56) + 'px"><span style="position:absolute;right:0;top:-14px;font-size:9px;color:var(--gold)">🎯' + goal + '</span></div>' : "") +
        '</div>' +
        '<div style="display:flex;gap:3px;margin-top:2px">' + vals.map(function(_,i) { return '<div style="flex:1;text-align:center;font-size:9px;color:var(--text3)">W' + (i+1) + '</div>'; }).join("") + '</div>';
    }
    return '<div class="card" style="border-color:' + (rank===1?"rgba(201,168,76,.4)":rank===2?"rgba(180,180,180,.3)":"var(--border)") + '">' +
      '<div class="row" style="margin-bottom:10px"><div style="flex:1"><div style="font-weight:600;font-size:14px">' + sk.name + '</div><div style="font-size:12px;color:var(--text2)">' + sk.unit + ' · ' + (sk.lower_better?"↓ lower=better":"↑ higher=better") + '</div></div><div style="display:flex;gap:6px;align-items:center">' + rankBadge(rank) + (imp?'<span style="font-size:12px;color:' + (imp.ok?"var(--gold)":"var(--red)") + '">' + (imp.ok?"▲":"▼") + imp.pct + '%</span>':"") + '</div></div>' +
      (vals.length ?
        '<div style="display:flex;gap:12px;margin-bottom:10px;flex-wrap:wrap">' +
        '<div style="font-size:12px"><span style="color:var(--text3)">Latest</span> <strong>' + formatScore(last, sk) + '</strong></div>' +
        '<div style="font-size:12px"><span style="color:var(--text3)">Best</span> <strong style="color:var(--gold)">' + formatScore(best, sk) + '</strong></div>' +
        (goal ? '<div style="font-size:12px"><span style="color:var(--text3)">Goal</span> <strong style="color:var(--gold)">' + goal + ' ' + sk.unit + '</strong> <span style="color:' + ((sk.lower_better?last<=goal:last>=goal)?"#4CAF50":"var(--red)") + '">' + ((sk.lower_better?last<=goal:last>=goal)?"✓ Achieved!":"(" + Math.abs(last-goal).toFixed(1) + " away)") + '</span></div>' : "") +
        '</div>' + bars +
        (imp ? '<div style="margin-top:10px;font-size:12px;color:var(--text2);background:var(--surface2);padding:6px 10px;border-radius:6px">' + (imp.ok ? '📈 Improved by <strong style="color:var(--gold)">' + imp.pct + '%</strong> since first entry!' : '📉 Down <strong style="color:var(--red)">' + imp.pct + '%</strong> from first entry.') + '</div>' : "")
        : '<div style="text-align:center;padding:1rem;color:var(--text3);font-size:13px">No entries yet for this skill</div>') +
      '</div>';
  }).join(""));
  spStudentId = s.id;
  renderSpEntries(s.id);
  document.getElementById("sp-modal").classList.remove("hidden");
}
function closeSP() { document.getElementById("sp-modal").classList.add("hidden"); spStudentId = null; }
function saveGoals() {
  var s = (spStudentId && (students.find(function(x) { return x.id === spStudentId; }) || allStudents().find(function(x) { return x.id === spStudentId; })))
    || students.find(function(x) { return (x.first + " " + x.last) === document.getElementById("sp-name").textContent; });
  if (!s) return;
  var goals = {};
  skills.forEach(function(sk) {
    var el = document.getElementById("goal-" + sk.id);
    if (!el || !el.value) return;
    var gp = parseTimeInput(el.value, sk);
    if (gp.ok) goals[sk.id] = gp.value;
  });
  mergeGoalSave(s, goals).then(function() { openSP(s.id); });
}

function applyLocalEntryUpdate(studentId, skid, entryId, newValue) {
  var raw = entries[studentId] && entries[studentId][skid];
  if (!raw) return;
  var idx = raw.findIndex(function(e) { return e && e.id === entryId; });
  if (idx > -1) {
    if (typeof raw[idx] === "object") raw[idx].value = newValue;
    else raw[idx] = newValue;
  }
}
function applyLocalEntryDelete(studentId, skid, entryId) {
  var raw = entries[studentId] && entries[studentId][skid];
  if (!raw) return;
  var idx = raw.findIndex(function(e) { return e && e.id === entryId; });
  if (idx > -1) raw.splice(idx, 1);
}

function renderSpEntries(studentId) {
  var el = document.getElementById("sp-entries");
  if (!el) return;
  var s = students.find(function(x) { return x.id === studentId; }) || allStudents().find(function(x) { return x.id === studentId; });
  if (!s) { el.innerHTML = ""; return; }
  var html = '<div class="row" style="margin-bottom:8px">' +
    '<div style="font-family:\'Cormorant Garamond\',serif;font-size:16px;font-weight:700;color:var(--gold)">✏️ Edit scores</div>' +
    '</div>' +
    '<div id="sp-edit-alert"></div>' +
    '<div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;line-height:1.55">You can change or delete any week. Clear a time and save, or press Delete. Use ab, mu, or inj if they did not run.</div>';
  var any = false;
  skills.forEach(function(sk) {
    var list = getEntries(s.id, sk.id) || [];
    if (!list.length) return;
    any = true;
    html += '<div style="margin-bottom:16px">' +
      '<div style="font-size:13px;font-weight:600;margin-bottom:8px">' + sk.name +
      ' <span style="font-weight:400;color:var(--text-muted);font-size:11px">' + (isTimeSkill(sk) ? "sec or mm:ss" : sk.unit) + "</span></div>";
    list.forEach(function(e, i) {
      var val = typeof e === "object" ? e.value : e;
      var eid = typeof e === "object" ? e.id : "";
      var week = (typeof e === "object" && e.week_label) ? canonicalWeekLabel(e.week_label) : ("Entry " + (i + 1));
      var inputId = "sp-in-" + i + "-" + sk.id;
      var prevId = "sp-prev-" + i + "-" + sk.id;
      var shown = formatTimeValue(val, sk);
      html += '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)">' +
        '<div style="font-size:11px;color:var(--text-muted);min-width:120px">' + week + "</div>" +
        '<input class="sp-edit-input" id="' + inputId + '" value="' + String(shown).replace(/"/g, "&quot;") + '" ' +
          (isTimeSkill(sk)
            ? 'type="text" inputmode="decimal" autocomplete="off" placeholder="time, -, ab, mu, inj"'
            : 'type="number" step="0.1"') +
          ' oninput="teacherPreview(\'' + inputId + '\',\'' + prevId + '\',\'' + sk.id + '\')"' +
          ' style="width:118px;text-align:center;font-size:16px;font-weight:700;padding:8px 10px"/>' +
        '<div id="' + prevId + '" style="font-size:12px;color:var(--gold2);flex:1;min-width:160px">' + timeMeaning(shown, sk) + "</div>" +
        (eid
          ? '<button class="gold" style="width:auto;font-size:12px;padding:6px 12px" onclick="teacherSaveEntry(\'' + s.id + '\',\'' + eid + '\',\'' + sk.id + '\',\'' + inputId + '\')">Save</button>' +
            '<button style="width:auto;font-size:12px;padding:6px 10px;color:#F0A090;background:rgba(192,57,43,0.18);border-color:transparent" onclick="teacherDeleteEntry(\'' + s.id + '\',\'' + eid + '\',\'' + sk.id + '\')">Delete</button>'
          : '<span style="font-size:11px;color:var(--text-muted)">Reload to edit</span>') +
      "</div>";
    });
    html += "</div>";
  });
  if (!any) html += '<div style="font-size:13px;color:var(--text-muted);padding:6px 0">No scores yet for this student.</div>';
  el.innerHTML = html;
}
function teacherPreview(inputId, prevId, skid) {
  var sk = skills.find(function(x) { return x.id === skid; });
  var inp = document.getElementById(inputId);
  var prev = document.getElementById(prevId);
  if (!inp || !prev) return;
  prev.textContent = timeMeaning(inp.value, sk);
}
function teacherSaveEntry(studentId, entryId, skid, inputId) {
  var sk = skills.find(function(x) { return x.id === skid; });
  var inp = document.getElementById(inputId);
  var alertBox = document.getElementById("sp-edit-alert");
  function note(msg, ok) {
    if (alertBox) alertBox.innerHTML = '<div class="alert ' + (ok ? "a-ok" : "a-err") + '">' + msg + "</div>";
  }
  if (!inp || !String(inp.value).trim()) {
    teacherDeleteEntry(studentId, entryId, skid);
    return;
  }
  var parsed = parseTimeInput(inp.value, sk);
  if (!parsed.ok) { note(parsed.error || "Invalid score"); return; }
  note("Saving…", true);
  var local = getEntries(studentId, skid).find(function(e) { return e && e.id === entryId; });
  var week = local && local.week_label ? local.week_label : weekLabel();
  upsertWeekScore(studentId, skid, week, storeScoreValue(parsed.value)).then(function(id) {
    rememberWeekScore(studentId, skid, week, parsed.value, id || entryId);
    openSP(studentId);
    var box = document.getElementById("sp-edit-alert");
    if (box) box.innerHTML = '<div class="alert a-ok">✓ Saved as ' + formatScore(parsed.value, sk) + "</div>";
    renderRoster();
    renderProgress();
    renderLB();
  }).catch(function(err) { note("Error: " + (err && err.message ? err.message : "Could not save")); });
}
function teacherDeleteEntry(studentId, entryId, skid) {
  if (!confirm("Delete this score? This cannot be undone.")) return;
  sb.from("entries").delete().eq("id", entryId).select("id").then(function(r) {
    if (r.error || !r.data || !r.data.length) {
      var alertBox = document.getElementById("sp-edit-alert");
      if (alertBox) alertBox.innerHTML = '<div class="alert a-err">Error: ' + ((r.error && r.error.message) || "Could not remove that score.") + "</div>";
      return;
    }
    applyLocalEntryDelete(studentId, skid, entryId);
    openSP(studentId);
    renderRoster();
    renderProgress();
    renderLB();
  });
}

// ── UPLOAD SCORES (teacher bulk entry) ───────────────────────
var scoreRows = []; // parsed + matched rows ready to import

function dlScoreTemplate() {
  // Build template using actual student names and skills
  var lines = ["first,last,period,skill_name,value,week"];
  // Add example rows using real students if available
  var sample = students.slice(0, 3);
  var sampleSkill = skills.length ? skills[0].name : "400m Run";
  if (sample.length) {
    sample.forEach(function(s) {
      lines.push(s.first + "," + s.last + "," + s.period + "," + sampleSkill + ",," + "Week 1");
    });
  } else {
    lines.push("Alex,Johnson,1," + sampleSkill + ",72.5,Week 1");
    lines.push("Maya,Rodriguez,1," + sampleSkill + ",68.3,Week 1");
  }
  var a = document.createElement("a");
  a.href = "data:text/csv," + encodeURIComponent(lines.join("\n"));
  a.download = "score_template.csv";
  a.click();
}

function parseCSVLine(line) {
  // Properly parse CSV line handling quoted fields with commas inside
  var result = [], cur = "", inQuote = false;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (c === '"') { inQuote = !inQuote; }
    else if (c === ',' && !inQuote) { result.push(cur.trim()); cur = ""; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

function readScoresCSV(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var lines = e.target.result.trim().split(/\r?\n/).filter(function(l) { return l.trim(); });
    if (lines.length < 2) { alertEl("scores-alert", "CSV is empty or has no data rows."); return; }

    var headers = parseCSVLine(lines[0]).map(function(h) { return h.toLowerCase().replace(/[^a-z0-9_]/g, "_"); });
    console.log("Headers found:", headers);

    var need = ["first","last","period","skill_name","value","week"];
    var miss = need.filter(function(n) { return !headers.includes(n); });
    if (miss.length) {
      alertEl("scores-alert", "Missing columns: " + miss.join(", ") + "<br>Headers found: " + headers.join(", "));
      return;
    }

    var matched = 0, unmatched = 0;
    scoreRows = lines.slice(1).map(function(l) {
      var cols = parseCSVLine(l);
      var row = {};
      headers.forEach(function(h, i) { row[h] = (cols[i] || "").trim(); });

      console.log("Row:", JSON.stringify(row));

      // Match student - case insensitive, trim spaces
      var student = students.find(function(s) {
        return s.first.toLowerCase().trim() === row.first.toLowerCase() &&
               s.last.toLowerCase().trim()  === row.last.toLowerCase()  &&
               String(s.period)             === String(parseInt(row.period));
      });

      // Match skill - exact first, then partial
      var skillKey = row.skill_name.toLowerCase().trim();
      var skill = skills.find(function(sk) {
        return sk.name.toLowerCase().trim() === skillKey;
      });
      if (!skill) {
        skill = skills.find(function(sk) {
          return sk.name.toLowerCase().includes(skillKey) || skillKey.includes(sk.name.toLowerCase());
        });
      }

      // Value must be a valid number
      var val = row.value.replace(/[^0-9.]/g, "");
      var valNum = parseFloat(val);
      var valOk = !isNaN(valNum) && val !== "";

      var ok = !!(student && skill && valOk);
      if (ok) matched++; else unmatched++;

      return {
        first: row.first, last: row.last, period: row.period,
        skill_name: row.skill_name, value: val, week: row.week || "Week 1",
        student: student || null,
        skill:   skill   || null,
        ok:      ok,
        reason:  !student ? "Student not found" : !skill ? "Skill not found: " + row.skill_name : !valOk ? "Invalid value: " + row.value : ""
      };
    });

    document.getElementById("scores-count").textContent = matched + " rows ready to import";
    document.getElementById("scores-warn").textContent  = unmatched > 0 ? unmatched + " rows will be skipped" : "";

    var tbody = document.getElementById("scores-list");
    tbody.innerHTML = scoreRows.map(function(r) {
      return '<tr style="' + (r.ok ? "" : "opacity:.5") + '">' +
        '<td>' + (r.student
          ? avHTML(r.student.first, r.student.last, 22) + ' <span style="font-size:13px">' + r.first + ' ' + r.last + '</span>'
          : '<span style="color:var(--red);font-size:13px">' + r.first + ' ' + r.last + '</span>') + '</td>' +
        '<td style="font-size:13px">' + (r.skill
          ? r.skill.name
          : '<span style="color:var(--red)">' + r.skill_name + '</span>') + '</td>' +
        '<td style="font-weight:500">' + r.value + (r.skill ? ' <span style="font-size:11px;color:var(--text2)">' + r.skill.unit + '</span>' : '') + '</td>' +
        '<td style="font-size:12px;color:var(--text2)">' + r.week + '</td>' +
        '<td>' + (r.ok
          ? '<span class="badge b-green">✓ Ready</span>'
          : '<span class="badge b-red" title="' + r.reason + '">✗ ' + r.reason + '</span>') + '</td>' +
        '</tr>';
    }).join("");

    document.getElementById("scores-preview-card").classList.remove("hidden");
    alertEl("scores-alert", "");
  };
  reader.readAsText(file);
}

function importScores() {
  var toInsert = scoreRows.filter(function(r) { return r.ok; });
  if (!toInsert.length) { alertEl("scores-alert", "No valid rows to import."); return; }

  var btn = document.querySelector("#scores-preview-card button.gold");
  if (btn) { btn.disabled = true; btn.textContent = "Importing " + toInsert.length + "…"; }

  var rows = toInsert.map(function(r) {
    return {
      student_id: r.student.id,
      skill_id:   r.skill.id,
      value:      (function(){ var p = parseTimeInput(r.value, r.skill); return p.ok ? storeScoreValue(p.value) : parseFloat(r.value); })(),
      week_label: canonicalWeekLabel(r.week || weekLabel())
    };
  });

  var imported = 0, importFailed = 0, importErr = "";
  var nextImport = function(i) {
    if (i >= rows.length) {
      if (btn) { btn.disabled = false; btn.textContent = "Confirm Import"; }
      if (importFailed) { alertEl("scores-alert", imported + " imported, " + importFailed + " failed — " + importErr); return; }
      cancelScores();
      loadData();
      alertEl("scores-alert", "✓ " + imported + " scores imported successfully!", "ok");
      setTimeout(function() { alertEl("scores-alert", ""); }, 5000);
      return;
    }
    var row = rows[i];
    upsertWeekScore(row.student_id, row.skill_id, row.week_label, row.value).then(function() {
      imported++;
      nextImport(i + 1);
    }).catch(function(err) {
      importFailed++;
      if (!importErr) importErr = err && err.message ? err.message : "Could not save";
      nextImport(i + 1);
    });
  };
  nextImport(0);
}

function cancelScores() {
  scoreRows = [];
  document.getElementById("scores-preview-card").classList.add("hidden");
  document.getElementById("scores-file").value = "";
}

// ── SCORE GRID (direct entry) ────────────────────────────────
function goScoreMode(mode) {
  document.getElementById("score-grid-mode").classList.toggle("hidden", mode !== "grid");
  document.getElementById("score-csv-mode").classList.toggle("hidden", mode !== "csv");
  document.getElementById("stab-grid").classList.toggle("on", mode === "grid");
  document.getElementById("stab-csv").classList.toggle("on",  mode === "csv");
  if (mode === "grid") buildGrid();
}

function initGridFilters() {
  // Populate skill dropdown
  var gs = document.getElementById("grid-skill");
  if (gs) gs.innerHTML = skills.map(function(sk) {
    return '<option value="' + sk.id + '">' + sk.name + ' (' + sk.unit + ')</option>';
  }).join("");

  // Populate period dropdown
  var gp = document.getElementById("grid-period");
  if (gp) {
    var periods = Array.from(new Set(students.map(function(s) { return s.period; }))).sort();
    gp.innerHTML = '<option value="all">All Periods</option>' +
      periods.map(function(p) { return '<option value="' + p + '">Period ' + p + '</option>'; }).join("");
  }
  buildGrid();
}

function gridKeyNav(event, el) {
  if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    var inputs = Array.from(document.querySelectorAll("#score-grid-body input"));
    var idx = inputs.indexOf(el);
    if (inputs[idx + 1]) inputs[idx + 1].focus();
  }
}

function buildGrid() {
  var skid   = (document.getElementById("grid-skill")  || {}).value;
  var period = (document.getElementById("grid-period") || {}).value || "all";
  var sk     = skills.find(function(s) { return s.id === skid; });

  // Update column header
  var header = document.getElementById("grid-unit-header");
  if (header && sk) header.textContent = sk.name + (isTimeSkill(sk) ? " (sec or mm:ss)" : " (" + sk.unit + ")");

  var list = period === "all" ? students : students.filter(function(s) { return String(s.period) === String(period); });
  list = list.slice().sort(function(a,b) { return a.last.localeCompare(b.last); });

  var tbody = document.getElementById("score-grid-body");
  if (!tbody) return;

  var gw = document.getElementById("grid-week");
  if (gw && !String(gw.value || "").trim()) gw.value = weekLabel();
  var week = canonicalWeekLabel(((gw && gw.value) || "").trim() || weekLabel());
  tbody.innerHTML = list.map(function(s) {
    var last = getLast(s.id, skid);
    var thisWeek = findWeekEntry(s.id, skid, week);
    var shown = thisWeek ? formatTimeValue(thisWeek.value, sk) : "";
    return '<tr>' +
      '<td><div class="row">' + avHTML(s.first, s.last, 26) +
        '<div><div style="font-weight:500;font-size:13px;cursor:pointer;color:var(--gold)" onclick="openSP(\'' + s.id + '\')">' + s.first + ' ' + s.last + '</div>' +
        (thisWeek ? '<div style="font-size:11px;color:var(--gold)">This week — edit below</div>' : (last !== null ? '<div style="font-size:11px;color:var(--text3)">Last: ' + formatScore(last, sk) + '</div>' : '')) +
        '</div></div></td>' +
      '<td style="color:var(--text2);font-size:13px">P' + s.period + '</td>' +
      '<td><input ' + (isTimeSkill(sk) ? 'type="text" inputmode="decimal" autocomplete="off" placeholder="time, -, ab, mu, inj"' : 'type="number" step="0.1" inputmode="decimal" placeholder="—"') +
        ' id="grid-' + s.id + '" value="' + String(shown).replace(/"/g, "&quot;") + '"' +
        ' style="text-align:center;font-size:16px;font-weight:500;padding:8px;max-width:140px"' +
        ' onkeydown=\"gridKeyNav(event,this)\"/></td>' +
      '</tr>';
  }).join("");

  // Auto-focus first input
  var first = tbody.querySelector("input");
  if (first) setTimeout(function() { first.focus(); }, 100);
}

function clearGrid() {
  document.querySelectorAll("#score-grid-body input").forEach(function(el) { el.value = ""; });
}

function saveGrid() {
  var skid = (document.getElementById("grid-skill") || {}).value;
  var week = canonicalWeekLabel(((document.getElementById("grid-week") || {}).value || "").trim() || weekLabel());
  var sk   = skills.find(function(s) { return s.id === skid; });
  var okEl = document.getElementById("grid-ok");

  if (!sk) { if(okEl) okEl.innerHTML = '<div class="alert a-err">Select a skill first.</div>'; return; }

  var rows = [];
  var parseErr = "";
  document.querySelectorAll("#score-grid-body input").forEach(function(el) {
    if (parseErr || !el.value || el.value.trim() === "") return;
    var parsed = parseTimeInput(el.value, sk);
    if (!parsed.ok) { parseErr = parsed.error; return; }
    var sid = el.id.substring(5);
    var student = students.find(function(s) { return s.id === sid; });
    if (!student) return;
    rows.push({ student_id: sid, skill_id: skid, value: storeScoreValue(parsed.value), week_label: week });
  });
  if (parseErr) {
    if (okEl) okEl.innerHTML = '<div class="alert a-err">' + parseErr + '</div>';
    return;
  }

  if (!rows.length) {
    if (okEl) okEl.innerHTML = '<div class="alert a-err">No scores entered. Type a time or number in at least one row.</div>';
    return;
  }

  var btn = document.querySelector("#score-grid-mode button.gold");
  if (btn) { btn.disabled = true; btn.textContent = "Saving " + rows.length + " scores…"; }
  if (okEl) okEl.innerHTML = "";

  // Insert one at a time to get clear error feedback per row
  var saved = 0, failed = 0, firstErr = "";
  var next = function(i) {
    if (i >= rows.length) {
      if (btn) { btn.disabled = false; btn.textContent = "Save All Scores"; }
      loadData().then(function() { buildGrid(); renderRoster(); renderProgress(); renderLB(); });
      if (okEl) {
        var msg = failed > 0
          ? '<div class="alert a-err">' + saved + ' saved, ' + failed + ' failed — ' + firstErr + '</div>'
          : '<div class="alert a-ok">✓ ' + saved + ' scores saved for ' + sk.name + ' — ' + week + '!</div>';
        okEl.innerHTML = msg;
        setTimeout(function() { okEl.innerHTML = ""; }, 5000);
      }
      return;
    }
    var row = rows[i];
    upsertWeekScore(row.student_id, row.skill_id, row.week_label, row.value).then(function() {
      saved++;
      next(i + 1);
    }).catch(function(err) {
      failed++;
      if (!firstErr) firstErr = err && err.message ? err.message : "Could not save";
      console.error("Save failed:", row, firstErr);
      next(i + 1);
    });
  };
  next(0);
}

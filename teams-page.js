// Team maker and brackets. Loaded after the teacher page script.
// ── TEAMS ────────────────────────────────────────────────────
var lastTeamText = "";
var lastTeamPrint = "";
var lastTeamEvents = [];
var lastBrackets = [];
var lastBracketText = "";
var lastBracketPrint = "";
function teamsEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function teamsParseSkill(key) {
  var parts = String(key || "sport:*:*").split(":");
  if (parts[0] === "fit") return { source: "fit", unitId: "*", skillId: parts.slice(1).join(":") || "*" };
  return { source: "sport", unitId: parts[1] || "*", skillId: parts.slice(2).join(":") || "*" };
}
function teamsSettings() {
  var raw = String((document.getElementById("teams-count") || {}).value || "").trim();
  var count = Number(raw);
  if (raw === "" || !isFinite(count) || Math.floor(count) !== count) count = NaN;
  var choice = teamsParseSkill((document.getElementById("teams-skill") || {}).value);
  return {
    split: (document.getElementById("teams-split") || {}).value === "size" ? "size" : "teams",
    count: count,
    skillMode: (document.getElementById("teams-skill-mode") || {}).value || "off",
    genderMode: (document.getElementById("teams-gender") || {}).value || "off",
    source: choice.source,
    unitId: choice.unitId,
    skillId: choice.skillId,
    which: (document.getElementById("teams-which") || {}).value === "latest" ? "latest" : "best",
    blank: choice.source === "sport" ? 2.5 : 5.5
  };
}
function syncTeamsFields() {
  var split = document.getElementById("teams-split");
  var lbl = document.getElementById("teams-count-lbl");
  if (split && lbl) lbl.textContent = split.value === "size" ? "Students per team" : "How many teams";
  var off = ((document.getElementById("teams-skill-mode") || {}).value || "off") === "off";
  var skill = document.getElementById("teams-skill");
  var which = document.getElementById("teams-which");
  var fit = skill && String(skill.value || "").indexOf("fit:") === 0;
  if (skill) skill.disabled = off;
  if (which) which.disabled = off || !fit;
}
function teamsPeriodBlocks() {
  var choice = (document.getElementById("teams-period") || {}).value || "all";
  var all = allStudents();
  function byPeriod(list) {
    return list.slice().sort(function(a, b) {
      var na = parseInt(a, 10), nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
      return String(a).localeCompare(String(b), undefined, { numeric: true });
    });
  }
  if (choice === "each") {
    var seen = {};
    var periods = [];
    all.forEach(function(s) {
      var p = String(s.period == null ? "" : s.period);
      if (!seen[p]) { seen[p] = true; periods.push(p); }
    });
    return byPeriod(periods).map(function(p) {
      return { period: p, students: all.filter(function(s) { return String(s.period) === p; }) };
    });
  }
  if (choice === "all") return [{ period: "", students: all }];
  return [{ period: choice, students: all.filter(function(s) { return String(s.period) === String(choice); }) }];
}
function teamsMark(student, sk, which) {
  var vals = getVals(student.id, sk.id);
  if (!vals.length) return null;
  if (which === "latest") return Number(vals[vals.length - 1]);
  return sk.lower_better ? Math.min.apply(null, vals) : Math.max.apply(null, vals);
}
function teamsPlainScore(value, sk) {
  if (value == null || value === "") return "";
  var code = normalizeCode(value);
  if (code === "-") return "—";
  if (code) return codeLabel(code);
  var text = formatTimeValue(value, sk);
  if (sk && sk.unit && !isTimeSkill(sk)) text += " " + sk.unit;
  return text;
}
function teamsCatalog() {
  if (typeof currentCatalog !== "function") return { units: [] };
  try { return currentCatalog() || { units: [] }; } catch (e) { return { units: [] }; }
}
function teamsLevel(raw) {
  var n = Number(raw);
  if (!isFinite(n) || n < 1 || n > 4) return null;
  return n;
}
function teamsLevelLabel(n) {
  var id = String(n);
  var levels = (typeof MARK_LEVELS !== "undefined" && MARK_LEVELS) ? MARK_LEVELS : [
    { id: "1", name: "Beginning" }, { id: "2", name: "Developing" },
    { id: "3", name: "Proficient" }, { id: "4", name: "Advanced" }
  ];
  for (var i = 0; i < levels.length; i++) if (String(levels[i].id) === id) return levels[i].id + " " + levels[i].name;
  return id;
}
function teamsRatings(student, unitId, skillId) {
  if (typeof readVs !== "function") return [];
  var marks = (readVs(student).marks) || {};
  var units = teamsCatalog().units || [];
  if (unitId && unitId !== "*") units = units.filter(function(u) { return u.id === unitId; });
  var nums = [];
  units.forEach(function(unit) {
    var slot = marks[unit.id];
    if (!slot) return;
    if (skillId && skillId !== "*") {
      var one = teamsLevel(slot.skills && slot.skills[skillId]);
      if (one != null) nums.push(one);
      return;
    }
    var list = unit.skills || [];
    if (list.length) {
      list.forEach(function(sk) {
        var n = teamsLevel(slot.skills && slot.skills[sk.id]);
        if (n != null) nums.push(n);
      });
    } else {
      var legacy = teamsLevel(slot.skill);
      if (legacy != null) nums.push(legacy);
    }
  });
  return nums;
}
function teamsAverage(nums) {
  if (!nums.length) return null;
  var sum = 0;
  nums.forEach(function(n) { sum += n; });
  return Math.round((sum / nums.length) * 10) / 10;
}
function teamsPlayers(list, settings) {
  var bases = (list || []).map(function(s) {
    var g = genderKey(s.gender);
    return {
      id: s.id,
      name: studentName(s),
      gender: g === "unknown" ? "U" : g,
      genderText: genderShort(s.gender),
      period: String(s.period == null ? "" : s.period),
      strength: null,
      detail: "",
      raw: null,
      _student: s
    };
  });
  if (!settings || settings.skillMode === "off" || typeof VikingTeams === "undefined") {
    bases.forEach(function(p) { delete p._student; });
    return bases;
  }
  if (settings.source !== "fit") {
    bases.forEach(function(p) {
      var nums = teamsRatings(p._student, settings.unitId, settings.skillId);
      p.strength = teamsAverage(nums);
      if (!nums.length) p.detail = "no mark";
      else if (nums.length === 1 && settings.skillId && settings.skillId !== "*") p.detail = teamsLevelLabel(nums[0]);
      else p.detail = p.strength.toFixed(1);
      delete p._student;
    });
    return bases;
  }
  var selected = settings.skillId && settings.skillId !== "*"
    ? skills.filter(function(sk) { return sk.id === settings.skillId; })
    : skills.slice();
  if (!selected.length) {
    bases.forEach(function(p) { delete p._student; p.detail = "no mark"; });
    return bases;
  }
  var which = settings.which === "latest" ? "latest" : "best";
  var stats = selected.map(function(sk) {
    var vals = [];
    bases.forEach(function(p) {
      var raw = teamsMark(p._student, sk, which);
      if (raw != null && isNumericScore(raw)) vals.push(Number(raw));
    });
    return { sk: sk, min: vals.length ? Math.min.apply(null, vals) : null, max: vals.length ? Math.max.apply(null, vals) : null };
  });
  bases.forEach(function(p) {
    var parts = [];
    var rawSingle = null;
    stats.forEach(function(st) {
      var raw = teamsMark(p._student, st.sk, which);
      if (selected.length === 1) rawSingle = raw;
      var asset = VikingTeams.scaleAsset(raw, st.min, st.max, !!st.sk.lower_better);
      if (asset != null) parts.push(asset);
    });
    p.strength = VikingTeams.overallAsset(parts);
    p.raw = rawSingle != null && isNumericScore(rawSingle) ? Number(rawSingle) : null;
    if (selected.length === 1) {
      p.detail = rawSingle == null ? "no mark" : teamsPlainScore(rawSingle, selected[0]);
      if (p.strength != null) p.detail += " · " + p.strength.toFixed(1);
    } else p.detail = p.strength == null ? "no mark" : ("asset " + p.strength.toFixed(1));
    delete p._student;
  });
  return bases;
}
function teamsGenderTitle(key) {
  if (!key) return "";
  if (key === "U") return "Unspecified";
  return genderLabel(key);
}
function teamsPlanSentence(plan) {
  if (!plan) return "";
  if (plan.text) return plan.text;
  if (!plan.sections) return "";
  return plan.sections.map(function(s) {
    var teams = s.teamCount === 1 ? "1 team" : s.teamCount + " teams";
    var size = s.min === s.max ? String(s.max) : (s.max + " or " + s.min);
    return teamsGenderTitle(s.title) + ": " + teams + " of " + size;
  }).join(" · ") + ".";
}
function teamsSkillOptions() {
  var html = ['<optgroup label="Sport marks">', '<option value="sport:*:*">All sport skills</option>'];
  (teamsCatalog().units || []).forEach(function(unit) {
    html.push('<option value="sport:' + teamsEsc(unit.id) + ':*">' + teamsEsc(unit.name) + " — all skills</option>");
    (unit.skills || []).forEach(function(sk) {
      html.push('<option value="sport:' + teamsEsc(unit.id) + ":" + teamsEsc(sk.id) + '">' + teamsEsc(unit.name) + " — " + teamsEsc(sk.name) + "</option>");
    });
  });
  html.push('</optgroup><optgroup label="Fitness scores"><option value="fit:*">All fitness skills</option>');
  skills.forEach(function(sk) {
    html.push('<option value="fit:' + teamsEsc(sk.id) + '">' + teamsEsc(sk.name) + "</option>");
  });
  html.push("</optgroup>");
  return html.join("");
}
function refreshTeamsControls() {
  var periodEl = document.getElementById("teams-period");
  var skillEl = document.getElementById("teams-skill");
  if (!periodEl || !skillEl) return;
  var curP = periodEl.value || "all";
  var seen = {};
  var periods = [];
  allStudents().forEach(function(s) {
    if (!seen[s.period]) { seen[s.period] = true; periods.push(s.period); }
  });
  periods.sort(function(a, b) {
    var na = parseInt(a, 10), nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    return String(a).localeCompare(String(b), undefined, { numeric: true });
  });
  periodEl.innerHTML = '<option value="all">All students together</option><option value="each">Each period separately</option>' +
    periods.map(function(p) { return '<option value="' + teamsEsc(p) + '">Period ' + teamsEsc(p) + "</option>"; }).join("");
  if (curP === "all" || curP === "each" || periods.map(String).indexOf(String(curP)) >= 0) periodEl.value = curP;
  else periodEl.value = "all";
  var curS = skillEl.value || "sport:*:*";
  skillEl.innerHTML = teamsSkillOptions();
  var allowed = false;
  Array.prototype.forEach.call(skillEl.options || [], function(opt) { if (opt.value === curS) allowed = true; });
  skillEl.value = allowed ? curS : "sport:*:*";
  previewTeams();
}
function previewTeams() {
  syncTeamsFields();
  var el = document.getElementById("teams-plan");
  if (!el || typeof VikingTeams === "undefined") return;
  var settings = teamsSettings();
  var choice = (document.getElementById("teams-period") || {}).value || "all";
  var blocks = teamsPeriodBlocks();
  if (!blocks.length) { el.textContent = "Add students to the roster first."; return; }
  var lines = [];
  var allPlayers = [];
  blocks.forEach(function(block) {
    var players = teamsPlayers(block.students, settings);
    allPlayers = allPlayers.concat(players);
    var plan = VikingTeams.planTeams(players, settings);
    var prefix = choice === "all" ? "" : ("Period " + (block.period || "—") + ": ");
    lines.push(prefix + (plan.ok ? teamsPlanSentence(plan) : plan.error));
  });
  var notes = VikingTeams.optionNotes(settings, allPlayers);
  el.textContent = lines.join(" ") + (notes.length ? " " + notes.join(" ") : "");
}
function teamsCustomNames() {
  return String((document.getElementById("teams-names") || {}).value || "")
    .split(/[\n,]/).map(function(s) { return s.trim(); }).filter(Boolean);
}
function teamsNameAt(index, custom) {
  if (custom.length) return custom[index] || ("Team " + (index + 1));
  return (VikingTeams.NAMES && VikingTeams.NAMES[index]) || ("Team " + (index + 1));
}
function teamsGenderLine(players) {
  var rank = { M: 0, F: 1, "—": 9 };
  var counts = {};
  players.forEach(function(p) {
    var label = p.genderText || "—";
    counts[label] = (counts[label] || 0) + 1;
  });
  return Object.keys(counts).sort(function(a, b) {
    var ra = Object.prototype.hasOwnProperty.call(rank, a) ? rank[a] : 2;
    var rb = Object.prototype.hasOwnProperty.call(rank, b) ? rank[b] : 2;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  }).map(function(label) { return counts[label] + " " + label; }).join(" · ");
}
function teamsAverageMark(players, sk) {
  var nums = [];
  players.forEach(function(p) {
    if (p.raw != null && isNumericScore(p.raw)) nums.push(Number(p.raw));
  });
  if (!nums.length || !sk) return "";
  var sum = 0;
  nums.forEach(function(n) { sum += n; });
  return teamsPlainScore(sum / nums.length, sk);
}
function teamsMeta(players, settings, sk) {
  var bits = [players.length + (players.length === 1 ? " student" : " students")];
  var g = teamsGenderLine(players);
  if (g) bits.push(g);
  if (settings.skillMode !== "off") {
    var avg = VikingTeams.assetAverage(players, settings.blank);
    if (settings.source === "sport") {
      if (avg != null) bits.push("skill avg " + avg.toFixed(1));
    } else if (avg != null) {
      bits.push("asset " + avg.toFixed(1));
      var mark = sk ? teamsAverageMark(players, sk) : "";
      if (mark) bits.push("avg " + mark);
    }
  }
  return bits.join(" · ");
}
function renderTeamDraw(blocks, settings) {
  var sk = settings.source === "fit" && settings.skillId && settings.skillId !== "*"
    ? skills.find(function(s) { return s.id === settings.skillId; })
    : null;
  var custom = teamsCustomNames();
  var html = [];
  var print = [];
  var lines = [];
  blocks.forEach(function(block) {
    var nameIndex = 0;
    block.sections.forEach(function(section) {
      var heading = [];
      if (block.period !== "" && block.period != null) heading.push("Period " + block.period);
      var gTitle = teamsGenderTitle(section.title);
      if (gTitle) heading.push(gTitle);
      var title = heading.join(" · ");
      if (title) {
        html.push('<div class="team-section">' + teamsEsc(title) + "</div>");
        print.push("<h2>" + teamsEsc(title) + "</h2>");
        lines.push(title, "");
      }
      html.push('<div class="team-grid">');
      print.push('<div class="wrap">');
      section.teams.forEach(function(team) {
        var name = teamsNameAt(nameIndex++, custom);
        var people = team.slice().sort(function(a, b) {
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        });
        var meta = teamsMeta(people, settings, sk);
        html.push('<div class="card team-card"><h3>' + teamsEsc(name) + '</h3><div class="team-meta">' + teamsEsc(meta) + "</div>");
        print.push('<div class="team"><h3>' + teamsEsc(name) + '</h3><div class="meta">' + teamsEsc(meta) + "</div>");
        lines.push(name, meta);
        people.forEach(function(p) {
          var right = p.genderText || "";
          if (p.detail) right += (right ? " · " : "") + p.detail;
          html.push('<div class="team-person"><span>' + teamsEsc(p.name) + "</span><span>" + teamsEsc(right) + "</span></div>");
          print.push('<div class="person"><span>' + teamsEsc(p.name) + "</span><span>" + teamsEsc(right) + "</span></div>");
          lines.push("- " + p.name + (right ? " (" + right + ")" : ""));
        });
        html.push("</div>");
        print.push("</div>");
        lines.push("");
      });
      html.push("</div>");
      print.push("</div>");
    });
  });
  setHTML("teams-result", html.join(""));
  lastTeamText = lines.join("\n").trim();
  lastTeamPrint = print.join("");
  var copyBtn = document.getElementById("teams-copy");
  var printBtn = document.getElementById("teams-print");
  var go = document.getElementById("teams-go");
  if (copyBtn) copyBtn.disabled = !lastTeamText;
  if (printBtn) printBtn.disabled = !lastTeamText;
  if (go) go.textContent = "Draw again";
  lastTeamEvents = teamsFieldEvents(blocks, settings);
  resetBracketUi(settings.skillMode !== "off");
}
function teamsFieldEvents(blocks, settings) {
  var custom = teamsCustomNames();
  return blocks.map(function(block, bi) {
    var named = [];
    var nameIndex = 0;
    block.sections.forEach(function(section) {
      section.teams.forEach(function(team) {
        var people = team.slice().sort(function(a, b) {
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        });
        var strength = null;
        if (settings.skillMode !== "off" && typeof VikingTeams !== "undefined") {
          strength = VikingTeams.assetAverage(people, settings.blank);
        }
        named.push({
          id: "p" + bi + "t" + named.length,
          name: teamsNameAt(nameIndex++, custom),
          strength: strength,
          members: people.map(function(p) { return p.name; })
        });
      });
    });
    var title = block.period !== "" && block.period != null ? ("Period " + block.period) : "";
    return { title: title, teams: named, bySkill: settings.skillMode !== "off" };
  });
}
function syncBracketFields() {
  var format = (document.getElementById("bracket-format") || {}).value || "single";
  var wrap = document.getElementById("bracket-groups-wrap");
  if (wrap) wrap.style.display = format === "robin" ? "" : "none";
  var go = document.getElementById("bracket-go");
  if (go) go.textContent = format === "robin" ? "Make round robin" : "Make bracket";
}
function bracketOptions() {
  var format = (document.getElementById("bracket-format") || {}).value || "single";
  var raw = String((document.getElementById("bracket-groups") || {}).value || "").trim();
  var groups = raw === "" ? NaN : Number(raw);
  return { format: format, groups: groups };
}
function resetBracketUi(bySkill) {
  lastBrackets = [];
  lastBracketText = "";
  lastBracketPrint = "";
  var card = document.getElementById("teams-bracket-card");
  if (card) card.classList.remove("hidden");
  var note = document.getElementById("bracket-note");
  if (note) {
    note.textContent = bySkill
      ? "Marks are on for this draw. A round robin puts similar skill averages in the same group, strongest group first. A championship bracket seeds the strongest team as 1."
      : "Marks are off for this draw. A round robin groups teams in draw order. A championship bracket seeds the first team drawn as 1.";
  }
  setHTML("bracket-result", "");
  alertEl("bracket-alert", "");
  var copyBtn = document.getElementById("bracket-copy");
  var printBtn = document.getElementById("bracket-print");
  if (copyBtn) copyBtn.disabled = true;
  if (printBtn) printBtn.disabled = true;
  syncBracketFields();
  previewBracket();
}
function previewBracket() {
  syncBracketFields();
  var el = document.getElementById("bracket-plan");
  if (!el || typeof VikingBrackets === "undefined" || !lastTeamEvents.length) return;
  var options = bracketOptions();
  var lines = lastTeamEvents.map(function(event) {
    var built = VikingBrackets.buildBracket(event.teams, {
      format: options.format,
      groups: options.format === "robin" ? options.groups : 1,
      bySkill: event.bySkill
    });
    var prefix = event.title ? (event.title + ": ") : "";
    return prefix + (built.ok ? built.note : built.error);
  });
  el.textContent = lines.join(" ");
}
function makeBrackets() {
  if (typeof VikingBrackets === "undefined") {
    alertEl("bracket-alert", "Bracket maker did not load. Refresh the page.");
    return;
  }
  if (!lastTeamEvents.length) {
    alertEl("bracket-alert", "Draw teams first.");
    return;
  }
  var options = bracketOptions();
  var errors = [];
  lastBrackets = lastTeamEvents.map(function(event) {
    var built = VikingBrackets.buildBracket(event.teams, {
      format: options.format,
      groups: options.format === "robin" ? options.groups : 1,
      bySkill: event.bySkill
    });
    var label = event.title ? (event.title + ": ") : "";
    if (!built.ok) errors.push(label + built.error);
    return { title: event.title, built: built, results: {} };
  });
  var copyBtn = document.getElementById("bracket-copy");
  var printBtn = document.getElementById("bracket-print");
  if (errors.length && errors.length === lastBrackets.length) {
    alertEl("bracket-alert", errors.join(" "));
    setHTML("bracket-result", "");
    lastBracketText = "";
    lastBracketPrint = "";
    if (copyBtn) copyBtn.disabled = true;
    if (printBtn) printBtn.disabled = true;
    return;
  }
  var tapNote = options.format === "robin"
    ? "Tap a square to give that row the win. Tap the W again to clear it."
    : "Tap a team to mark the winner. Tap that team again to undo.";
  alertEl("bracket-alert", errors.concat([tapNote]).join(" "), errors.length ? "err" : "ok");
  renderBrackets();
}
function bracketSlotText(slot) {
  if (!slot || slot.bye) return "Bye";
  if (slot.pending) return slot.pending;
  return (slot.seed ? (slot.seed + "  ") : "") + slot.name;
}
function bracketSlotHtml(eventIndex, match, slot) {
  var won = match.status === "done" && slot.id && slot.id === match.winnerId;
  var cls = "bracket-slot" + (won ? " win" : "");
  var text = teamsEsc(bracketSlotText(slot));
  if (!slot.id || match.status === "open" || match.status === "bye") return '<div class="' + cls + '">' + text + "</div>";
  return '<button type="button" class="' + cls + '" data-event="' + eventIndex + '" data-match="' + teamsEsc(match.id) + '" data-bracket-pick="' + teamsEsc(slot.id) + '">' + text + "</button>";
}
function bracketMatchHtml(eventIndex, match) {
  if (match.status === "bye" && match.winnerId) {
    var who = match.a.id === match.winnerId ? match.a : match.b;
    return '<div class="bracket-match"><div class="bracket-slot win">' + teamsEsc(bracketSlotText(who) + "  ·  bye") + "</div></div>";
  }
  return '<div class="bracket-match">' + bracketSlotHtml(eventIndex, match, match.a) + bracketSlotHtml(eventIndex, match, match.b) + "</div>";
}
function bracketRoundsHtml(eventIndex, rounds) {
  if (!rounds || !rounds.length) return "";
  return '<div class="bracket-scroll"><div class="bracket-cols">' + rounds.map(function(round) {
    return '<div class="bracket-col"><div class="bracket-round-title">' + teamsEsc(round.title) + "</div>" +
      round.matches.map(function(match) { return bracketMatchHtml(eventIndex, match); }).join("") + "</div>";
  }).join("") + "</div></div>";
}
function bracketSeedsHtml(entrants, bySkill) {
  return '<div class="team-grid">' + entrants.map(function(team) {
    var bits = [];
    if (bySkill && team.strength != null) bits.push("skill " + Number(team.strength).toFixed(1));
    if (team.members && team.members.length) bits.push(team.members.join(", "));
    return '<div class="card team-card"><h3>' + teamsEsc(team.seed + "  " + team.name) + "</h3>" +
      (bits.length ? '<div class="team-meta">' + teamsEsc(bits.join(" · ")) + "</div>" : "") + "</div>";
  }).join("") + "</div>";
}
function bracketRobinPairs(group) {
  var pairs = {};
  (group.robin || []).forEach(function(round) {
    (round.matches || []).forEach(function(match) {
      if (!match.a.id || !match.b.id) return;
      pairs[match.a.id + "|" + match.b.id] = match;
      pairs[match.b.id + "|" + match.a.id] = match;
    });
  });
  return pairs;
}
function bracketRobinGridHtml(eventIndex, group) {
  var teams = group.entrants || [];
  var pairs = bracketRobinPairs(group);
  var head = "<th></th>" + teams.map(function(team) {
    return "<th>" + teamsEsc(team.seed + " " + team.name) + "</th>";
  }).join("");
  var body = teams.map(function(row) {
    var cells = teams.map(function(col) {
      if (row.id === col.id) return '<td class="rr-self">—</td>';
      var match = pairs[row.id + "|" + col.id];
      if (!match) return "<td></td>";
      var won = match.status === "done" && match.winnerId === row.id;
      var lost = match.status === "done" && match.winnerId && match.winnerId !== row.id;
      var cls = "rr-cell" + (won ? " win" : lost ? " loss" : "");
      return '<td><button type="button" class="' + cls + '" data-event="' + eventIndex + '" data-match="' + teamsEsc(match.id) + '" data-bracket-pick="' + teamsEsc(row.id) + '">' + (won ? "W" : lost ? "L" : "·") + "</button></td>";
    }).join("");
    return "<tr><th>" + teamsEsc(row.seed + " " + row.name) + "</th>" + cells + "</tr>";
  }).join("");
  var byes = [];
  (group.robin || []).forEach(function(round) {
    if (round.byes && round.byes.length) byes.push(round.title + ": " + round.byes.map(function(team) { return team.name; }).join(", "));
  });
  return '<div class="rr-wrap"><table class="rr-grid"><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table></div>" +
    (byes.length ? '<div class="rr-bye">Bye — ' + teamsEsc(byes.join(" · ")) + "</div>" : "") +
    '<div class="rr-help">Rows play columns. Tap a square to give that row the win.</div>';
}
function bracketRobinText(group) {
  var teams = group.entrants || [];
  var pairs = bracketRobinPairs(group);
  var rows = [];
  rows.push([""].concat(teams.map(function(team) { return team.seed + " " + team.name; })));
  teams.forEach(function(row) {
    var line = [row.seed + " " + row.name];
    teams.forEach(function(col) {
      if (row.id === col.id) { line.push("—"); return; }
      var match = pairs[row.id + "|" + col.id];
      if (!match) line.push("");
      else if (match.status === "done" && match.winnerId === row.id) line.push("W");
      else if (match.status === "done" && match.winnerId) line.push("L");
      else line.push("·");
    });
    rows.push(line);
  });
  var widths = [];
  rows.forEach(function(line) {
    line.forEach(function(cell, i) { widths[i] = Math.max(widths[i] || 0, String(cell).length); });
  });
  var text = rows.map(function(line) {
    return line.map(function(cell, i) {
      var s = String(cell);
      while (s.length < widths[i]) s += " ";
      return s;
    }).join("  ");
  }).join("\n");
  var byes = [];
  (group.robin || []).forEach(function(round) {
    if (round.byes && round.byes.length) byes.push(round.title + ": " + round.byes.map(function(team) { return team.name; }).join(", "));
  });
  if (byes.length) text += "\nBye — " + byes.join(" · ");
  return text;
}
function bracketStandingsHtml(rows, bySkill) {
  if (!rows || !rows.length) return "";
  return '<div class="card team-card" style="margin-top:10px"><h3>Standings</h3><div class="team-meta">Wins–losses</div>' +
    rows.map(function(row) {
      var skill = bySkill && row.strength != null ? (" · " + Number(row.strength).toFixed(1)) : "";
      return '<div class="team-person"><span>' + teamsEsc(row.rank + ". " + row.name + skill) + "</span><span>" +
        teamsEsc(row.wins + "–" + row.losses) + "</span></div>";
    }).join("") + "</div>";
}
function bracketMatchLine(match) {
  if (match.status === "bye" && match.winnerId) {
    var who = match.a.id === match.winnerId ? match.a : match.b;
    return bracketSlotText(who) + " — bye";
  }
  var left = bracketSlotText(match.a);
  var right = bracketSlotText(match.b);
  if (match.status === "done") {
    var winner = match.winnerId === match.a.id ? left : right;
    var loser = match.winnerId === match.a.id ? right : left;
    return winner + " def. " + loser;
  }
  return left + " vs " + right;
}
function renderBrackets() {
  var html = [];
  var lines = [];
  lastBrackets.forEach(function(item, eventIndex) {
    if (item.title) {
      html.push('<div class="team-section">' + teamsEsc(item.title) + "</div>");
      lines.push(item.title, "");
    }
    if (!item.built || !item.built.ok) {
      var err = (item.built && item.built.error) || "Could not build this bracket.";
      html.push('<div class="team-meta">' + teamsEsc(err) + "</div>");
      lines.push(err, "");
      return;
    }
    var view = VikingBrackets.viewBracket(item.built, item.results);
    html.push('<div class="team-meta">' + teamsEsc(view.note) + "</div>");
    lines.push(view.note, "");
    view.groups.forEach(function(group) {
      if (group.name) {
        html.push('<div class="team-section">' + teamsEsc(group.name) + "</div>");
        lines.push(group.name, "");
      }
      html.push(bracketSeedsHtml(group.entrants, view.bySkill));
      lines.push("Seeds");
      group.entrants.forEach(function(team) {
        var bits = [];
        if (view.bySkill && team.strength != null) bits.push(Number(team.strength).toFixed(1));
        if (team.members && team.members.length) bits.push(team.members.join(", "));
        lines.push(team.seed + " " + team.name + (bits.length ? " (" + bits.join(" · ") + ")" : ""));
      });
      lines.push("");
      if (view.format === "double" && group.winners.length) {
        html.push('<div class="team-section">Winners bracket</div>');
        lines.push("Winners bracket", "");
      }
      html.push(bracketRoundsHtml(eventIndex, group.winners));
      group.winners.forEach(function(round) {
        lines.push(round.title);
        round.matches.forEach(function(match) { lines.push(bracketMatchLine(match)); });
        lines.push("");
      });
      if (group.losers.length) {
        html.push('<div class="team-section">Losers bracket</div>');
        lines.push("Losers bracket", "");
        html.push(bracketRoundsHtml(eventIndex, group.losers));
        group.losers.forEach(function(round) {
          lines.push(round.title);
          round.matches.forEach(function(match) { lines.push(bracketMatchLine(match)); });
          lines.push("");
        });
      }
      if (group.championship.length) {
        html.push('<div class="team-section">Championship</div>');
        lines.push("Championship");
        html.push('<div class="bracket-col" style="max-width:280px">' + group.championship.map(function(match) {
          return '<div class="bracket-round-title">' + teamsEsc(match.label) + "</div>" + bracketMatchHtml(eventIndex, match);
        }).join("") + "</div>");
        group.championship.forEach(function(match) { lines.push(bracketMatchLine(match)); });
        lines.push("");
      }
      if (group.robin.length) {
        html.push(bracketRobinGridHtml(eventIndex, group));
        lines.push(bracketRobinText(group), "");
        html.push(bracketStandingsHtml(group.standings, view.bySkill));
        if (group.standings.length) {
          lines.push("Standings");
          group.standings.forEach(function(row) {
            lines.push(row.rank + ". " + row.name + " " + row.wins + "-" + row.losses);
          });
          lines.push("");
        }
        if (group.leaders.length) {
          var leaderNames = group.leaders.map(function(row) { return row.name; }).join(", ");
          var leaderLabel = group.leaders.length === 1 ? "Leading: " : "Tied for first: ";
          html.push('<div class="bracket-champ">' + teamsEsc(leaderLabel + leaderNames) + "</div>");
          lines.push(leaderLabel + leaderNames, "");
        }
      }
    });
    if (view.championName) {
      html.push('<div class="bracket-champ">Champion: ' + teamsEsc(view.championName) + "</div>");
      lines.push("Champion: " + view.championName, "");
    }
  });
  setHTML("bracket-result", html.join(""));
  lastBracketText = lines.join("\n").trim();
  lastBracketPrint = html.join("");
  var copyBtn = document.getElementById("bracket-copy");
  var printBtn = document.getElementById("bracket-print");
  var ready = !!lastBracketText;
  if (copyBtn) copyBtn.disabled = !ready;
  if (printBtn) printBtn.disabled = !ready;
}
function onBracketClick(e) {
  var btn = e.target && e.target.closest ? e.target.closest("[data-bracket-pick]") : null;
  if (!btn) return;
  var eventIndex = Number(btn.getAttribute("data-event"));
  var matchId = btn.getAttribute("data-match");
  var teamId = btn.getAttribute("data-bracket-pick");
  var item = lastBrackets[eventIndex];
  if (!item || !item.built || !item.built.ok || !matchId || !teamId) return;
  if (item.results[matchId] === teamId) delete item.results[matchId];
  else item.results[matchId] = teamId;
  renderBrackets();
}
function copyBrackets() {
  if (!lastBracketText) return;
  function done() { alertEl("bracket-alert", "Copied the bracket.", "ok"); }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(lastBracketText).then(done).catch(function() { bracketCopyFallback(); });
    return;
  }
  bracketCopyFallback();
}
function bracketCopyFallback() {
  var area = document.createElement("textarea");
  area.value = lastBracketText;
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand("copy");
    alertEl("bracket-alert", "Copied the bracket.", "ok");
  } catch (err) {
    alertEl("bracket-alert", "Could not copy. Select the bracket and copy it yourself.");
  }
  document.body.removeChild(area);
}
function printBrackets() {
  if (!lastBracketPrint) return;
  var w = window.open("", "viking-brackets");
  if (!w) { alertEl("bracket-alert", "Allow pop-up windows to print the bracket."); return; }
  w.document.open();
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>VikingStrong bracket</title><style>'
    + "body{font-family:Georgia,serif;color:#1a1e38;margin:24px}h1{font-size:22px;margin:0 0 12px}"
    + ".team-section{font-size:18px;margin:16px 0 8px}.team-meta{color:#555;font-size:12px;margin:0 0 8px}"
    + ".team-grid{display:flex;flex-wrap:wrap;gap:8px}.team-card{border:1px solid #ccc;border-radius:8px;padding:8px 10px;width:220px;break-inside:avoid}"
    + ".team-card h3{margin:0 0 4px;font-size:16px}.team-person{display:flex;justify-content:space-between;gap:8px;font-family:sans-serif;font-size:13px;padding:3px 0;border-top:1px solid #eee}"
    + ".bracket-cols{display:flex;gap:16px;align-items:flex-start}.bracket-col{min-width:190px}"
    + ".bracket-round-title{font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin:8px 0 4px}"
    + ".bracket-match{border:1px solid #ccc;border-radius:8px;margin:0 0 10px;page-break-inside:avoid}"
    + ".bracket-slot,button.bracket-slot{display:block;width:100%;text-align:left;background:#fff;color:#1a1e38;border:0;border-top:1px solid #eee;padding:6px 8px;font:13px sans-serif}"
    + ".bracket-slot.win{background:#1a1e38;color:#f0ede8;font-weight:700}.bracket-champ{font-size:18px;font-weight:700;margin:12px 0;color:#1a1e38}"
    + ".rr-wrap{overflow:visible}table.rr-grid{border-collapse:collapse;margin-top:8px}table.rr-grid th,table.rr-grid td{border:1px solid #ccc;padding:6px 8px;text-align:center;color:#1a1e38;background:#fff}"
    + "table.rr-grid th{background:#f4f1ea;text-align:left}table.rr-grid thead th{text-align:center}td.rr-self{background:#eceae4}"
    + "button.rr-cell{border:0;background:#fff;color:#1a1e38;font-weight:700}button.rr-cell.win{background:#1a1e38;color:#f0ede8}button.rr-cell.loss{background:#f6efd4}"
    + ".rr-help,.rr-bye{font-size:12px;color:#555;margin:8px 0}"
    + "</style></head><body><h1>VikingStrong bracket</h1>" + lastBracketPrint + "</body></html>");
  w.document.close();
  w.focus();
  setTimeout(function() { try { w.print(); } catch (e) {} }, 250);
}
var bracketResultEl = document.getElementById("bracket-result");
if (bracketResultEl) bracketResultEl.addEventListener("click", onBracketClick);
function makeTeams() {
  if (typeof VikingTeams === "undefined") {
    alertEl("teams-alert", "Team maker did not load. Refresh the page.");
    return;
  }
  syncTeamsFields();
  var settings = teamsSettings();
  var blocks = teamsPeriodBlocks();
  var drawn = [];
  var errors = [];
  var allPlayers = [];
  blocks.forEach(function(block) {
    var players = teamsPlayers(block.students, settings);
    var result = VikingTeams.makeDraw(players, settings);
    var label = block.period !== "" && block.period != null ? ("Period " + block.period + ": ") : "";
    if (!result.ok) errors.push(label + result.error);
    else {
      drawn.push({ period: block.period, sections: result.sections });
      allPlayers = allPlayers.concat(players);
    }
  });
  if (!drawn.length) {
    alertEl("teams-alert", errors.join(" ") || "Add students to the roster first.");
    return;
  }
  alertEl("teams-alert", errors.concat(VikingTeams.optionNotes(settings, allPlayers)).join(" "), errors.length ? "err" : "ok");
  renderTeamDraw(drawn, settings);
}
function copyTeams() {
  if (!lastTeamText) return;
  function done() { alertEl("teams-alert", "Copied the teams.", "ok"); }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(lastTeamText).then(done).catch(function() { teamsCopyFallback(); });
    return;
  }
  teamsCopyFallback();
}
function teamsCopyFallback() {
  var area = document.createElement("textarea");
  area.value = lastTeamText;
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand("copy");
    alertEl("teams-alert", "Copied the teams.", "ok");
  } catch (e) {
    alertEl("teams-alert", "Could not copy. Select the team list and copy it yourself.");
  }
  document.body.removeChild(area);
}
function printTeams() {
  if (!lastTeamPrint) return;
  var w = window.open("", "viking-teams");
  if (!w) { alertEl("teams-alert", "Allow pop-up windows to print the teams."); return; }
  w.document.open();
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>VikingStrong teams</title><style>'
    + "body{font-family:Georgia,serif;color:#1a1e38;margin:24px}h1{font-size:22px;margin:0 0 8px}"
    + "h2{font-size:16px;margin:18px 0 8px}.wrap{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}"
    + ".team{border:1px solid #ccc;border-radius:10px;padding:12px 14px;width:240px;break-inside:avoid;page-break-inside:avoid}"
    + "h3{margin:0 0 4px;font-size:18px}.meta{color:#555;font-size:12px;margin-bottom:8px}"
    + ".person{display:flex;justify-content:space-between;gap:8px;font-family:sans-serif;font-size:13px;padding:4px 0;border-top:1px solid #eee}"
    + "</style></head><body><h1>VikingStrong teams</h1>" + lastTeamPrint + "</body></html>");
  w.document.close();
  w.focus();
  setTimeout(function() { try { w.print(); } catch (e) {} }, 250);
}

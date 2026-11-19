// Period mark board.
// Skill goals and class marks share students.goals. Marks live under __vs
// so a goal save must keep that key (see mergeGoalSave).

var MARK_LEVELS = [
  { id: "1", name: "Beginning" },
  { id: "2", name: "Developing" },
  { id: "3", name: "Proficient" },
  { id: "4", name: "Advanced" }
];
var MARK_SPORTS = [
  { name: "Basketball", skills: [
    { id: "dribble", name: "Dribbling" }, { id: "pass", name: "Passing" }, { id: "shoot", name: "Shooting" },
    { id: "layup", name: "Layups" }, { id: "defense", name: "Defense" }
  ]},
  { name: "Soccer", skills: [
    { id: "dribble", name: "Dribbling" }, { id: "pass", name: "Passing" }, { id: "trap", name: "Trapping" },
    { id: "shoot", name: "Shooting" }, { id: "defense", name: "Defense" }
  ]},
  { name: "Volleyball", skills: [
    { id: "serve", name: "Serve" }, { id: "pass", name: "Forearm pass" }, { id: "set", name: "Set" },
    { id: "spike", name: "Spike" }, { id: "position", name: "Positioning" }
  ]},
  { name: "Flag football", skills: [
    { id: "throw", name: "Throwing" }, { id: "catch", name: "Catching" }, { id: "routes", name: "Routes" },
    { id: "flag", name: "Flag pull" }, { id: "handoff", name: "Handoff" }
  ]},
  { name: "Softball", skills: [
    { id: "throw", name: "Throwing" }, { id: "catch", name: "Catching" }, { id: "bat", name: "Batting" },
    { id: "field", name: "Fielding" }
  ]},
  { name: "Badminton", skills: [
    { id: "serve", name: "Serve" }, { id: "clear", name: "Clear" }, { id: "drop", name: "Drop shot" },
    { id: "smash", name: "Smash" }, { id: "rally", name: "Rally" }
  ]},
  { name: "Pickleball", skills: [
    { id: "serve", name: "Serve" }, { id: "dink", name: "Dink" }, { id: "drive", name: "Drive" },
    { id: "volley", name: "Volley" }, { id: "rally", name: "Rally" }
  ]},
  { name: "Ultimate", skills: [
    { id: "throw", name: "Throwing" }, { id: "catch", name: "Catching" }, { id: "cut", name: "Cutting" },
    { id: "mark", name: "Marking" }
  ]},
  { name: "Floor hockey", skills: [
    { id: "stick", name: "Stickhandling" }, { id: "pass", name: "Passing" }, { id: "shoot", name: "Shooting" },
    { id: "defense", name: "Defense" }
  ]},
  { name: "Tennis", skills: [
    { id: "forehand", name: "Forehand" }, { id: "backhand", name: "Backhand" }, { id: "serve", name: "Serve" },
    { id: "volley", name: "Volley" }, { id: "rally", name: "Rally" }
  ]},
  { name: "Dance", skills: [
    { id: "rhythm", name: "Rhythm" }, { id: "routine", name: "Routine" }, { id: "balance", name: "Balance" },
    { id: "expression", name: "Expression" }
  ]},
  { name: "Gymnastics", skills: [
    { id: "balance", name: "Balance" }, { id: "roll", name: "Roll" }, { id: "jump", name: "Jump" },
    { id: "flex", name: "Flexibility" }
  ]}
];
var MARK_BEHAVIORS = [
  { id: "great", name: "Great" },
  { id: "ontask", name: "On task" },
  { id: "remind", name: "Reminder" },
  { id: "offtask", name: "Off task" },
  { id: "sit", name: "Sit-out" }
];

var markPeriod = "";
var markUnitId = "";
var markKind = "skill";
var markFocus = "";
var markRestored = false;
var markCatalogCache = null;
var markSaveChain = {};
var markPushedV = -1;

function blankCatalog() { return { v: 0, units: [], kinds: [] }; }
function cloneJson(v) { return JSON.parse(JSON.stringify(v)); }
function catalogStorageKey() {
  var id = (typeof ownerId === "function" && ownerId()) || "local";
  return "vs-mark-catalog-" + id;
}
function normalizeCatalog(raw) {
  var c = raw && typeof raw === "object" ? raw : {};
  var units = [], kinds = [], seenU = {}, seenK = {};
  (c.units || []).forEach(function(u) {
    if (!u || !u.id || seenU[u.id]) return;
    var name = String(u.name || "").trim();
    if (!name) return;
    seenU[u.id] = true;
    var skills = [], seenS = {};
    (u.skills || []).forEach(function(s) {
      if (!s || !s.id || seenS[s.id]) return;
      var skillName = String(s.name || "").trim();
      if (!skillName) return;
      seenS[s.id] = true;
      skills.push({ id: String(s.id), name: skillName });
    });
    units.push({ id: String(u.id), name: name, skills: skills });
  });
  (c.kinds || []).forEach(function(k) {
    if (!k || !k.id || seenK[k.id]) return;
    var name = String(k.name || "").trim();
    if (!name) return;
    seenK[k.id] = true;
    kinds.push({ id: String(k.id), name: name });
  });
  return { v: Number(c.v) || 0, units: units, kinds: kinds };
}
function rememberCatalog(cat) {
  markCatalogCache = normalizeCatalog(cat);
  try { localStorage.setItem(catalogStorageKey(), JSON.stringify(markCatalogCache)); } catch (e) {}
  return markCatalogCache;
}
function readVs(s) {
  var g = s && s.goals;
  if (typeof g === "string") { try { g = JSON.parse(g); } catch (e) { g = {}; } }
  if (!g || typeof g !== "object") g = {};
  var vs = g.__vs && typeof g.__vs === "object" ? cloneJson(g.__vs) : {};
  if (!vs.marks || typeof vs.marks !== "object") vs.marks = {};
  return vs;
}
function scanCatalog() {
  var best = normalizeCatalog(markCatalogCache);
  try {
    var raw = localStorage.getItem(catalogStorageKey());
    if (raw) {
      var local = normalizeCatalog(JSON.parse(raw));
      if (local.v >= best.v) best = local;
    }
  } catch (e) {}
  var people = (typeof allStudents === "function") ? allStudents() : [];
  people.forEach(function(s) {
    var vs = readVs(s);
    if (!vs.catalog) return;
    var remote = normalizeCatalog(vs.catalog);
    if (remote.v >= best.v) best = remote;
  });
  return rememberCatalog(best);
}
function currentCatalog() {
  if (!markCatalogCache) scanCatalog();
  return markCatalogCache || blankCatalog();
}
function ownedStudents() {
  var tid = (typeof ownerId === "function") ? ownerId() : null;
  var people = (typeof allStudents === "function") ? allStudents() : [];
  return people.filter(function(s) { return !s.teacher_id || !tid || s.teacher_id === tid; });
}
function markStudent(id) {
  var people = (typeof allStudents === "function") ? allStudents() : [];
  for (var i = 0; i < people.length; i++) if (people[i].id === id) return people[i];
  return null;
}
function writeLocalVs(student, vs) {
  var current = student.goals;
  if (typeof current === "string") { try { current = JSON.parse(current); } catch (e) { current = {}; } }
  if (!current || typeof current !== "object") current = {};
  var goals = {};
  Object.keys(current).forEach(function(k) { goals[k] = current[k]; });
  goals.__vs = vs;
  if (typeof applyStudentPatch === "function") applyStudentPatch(student.id, { goals: goals });
  else student.goals = goals;
  if (typeof studentGoals !== "undefined" && studentGoals[student.id]) studentGoals[student.id] = goals;
}
function isoToday() {
  var d = new Date();
  function p(n) { return (n < 10 ? "0" : "") + n; }
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
function markToday() {
  var el = document.getElementById("marks-date");
  if (el && el.value) return el.value;
  var today = isoToday();
  if (el) el.value = today;
  return today;
}
function shortDay(iso) {
  var p = String(iso || "").slice(0, 10).split("-");
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var m = Number(p[1]);
  if (!m || !p[2]) return String(iso || "");
  return months[m - 1] + " " + Number(p[2]);
}
function markFirstName(s) { return String((s && s.first) || "").trim(); }
function compareByFirstName(a, b) {
  var c = markFirstName(a).localeCompare(markFirstName(b), undefined, { sensitivity: "base", numeric: true });
  if (c) return c;
  return String((a && a.last) || "").localeCompare(String((b && b.last) || ""), undefined, { sensitivity: "base" });
}
function markTone(s) {
  var k = (typeof genderKey === "function") ? genderKey(s && s.gender) : "";
  if (k === "M") return "boy";
  if (k === "F") return "girl";
  return "other";
}
function markBigName(s) {
  return markFirstName(s) || String((s && s.nickname) || "").trim() || String((s && s.last) || "").trim() || "Student";
}
function markNickLine(s) {
  var nick = String((s && s.nickname) || "").trim();
  var first = markFirstName(s);
  if (!nick || nick.toLowerCase() === first.toLowerCase()) return "";
  return nick;
}
function markLetter(s) {
  var ch = markFirstName(s).charAt(0).toUpperCase();
  return ch || "#";
}
function markPeriods() {
  var set = {};
  var people = (typeof allStudents === "function") ? allStudents() : [];
  people.forEach(function(s) {
    if (s.period == null || String(s.period).trim() === "") return;
    set[String(s.period)] = true;
  });
  return Object.keys(set).sort(function(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  });
}
function periodStudents(query) {
  var q = String(query || "").trim().toLowerCase();
  var people = (typeof allStudents === "function") ? allStudents() : [];
  var list = people.filter(function(s) {
    if (String(s.period) !== String(markPeriod)) return false;
    if (!q) return true;
    var blob = (markFirstName(s) + " " + (s.last || "") + " " + (s.nickname || "")).toLowerCase();
    return blob.indexOf(q) !== -1;
  });
  list.sort(compareByFirstName);
  return list;
}
function selectedUnit() {
  var cat = currentCatalog();
  for (var i = 0; i < cat.units.length; i++) if (cat.units[i].id === markUnitId) return cat.units[i];
  return null;
}
function ensureSelectedUnit() {
  var cat = currentCatalog();
  if (!cat.units.length) { markUnitId = ""; return null; }
  if (!selectedUnit()) markUnitId = cat.units[0].id;
  return selectedUnit();
}
function sportPack(name) {
  var key = String(name || "").trim().toLowerCase();
  for (var i = 0; i < MARK_SPORTS.length; i++) {
    if (MARK_SPORTS[i].name.toLowerCase() === key) return MARK_SPORTS[i];
  }
  return null;
}
function copySportSkills(pack) {
  return (pack.skills || []).map(function(s) { return { id: s.id, name: s.name }; });
}
function unitSkills(unit) {
  return (unit && unit.skills) || [];
}
function markTools() {
  var tools = [];
  var skills = unitSkills(selectedUnit());
  if (skills.length) {
    skills.forEach(function(s) {
      tools.push({ id: "skill:" + s.id, label: s.name, mode: "level", skillId: s.id });
    });
  } else {
    tools.push({ id: "skill", label: "Skill level", mode: "level" });
  }
  tools.push(
    { id: "loaner", label: "Loaner", mode: "toggle" },
    { id: "tardy", label: "Tardy", mode: "toggle" },
    { id: "behavior", label: "Behavior", mode: "behavior" }
  );
  currentCatalog().kinds.forEach(function(k) {
    tools.push({ id: "x:" + k.id, label: k.name, mode: "toggle", custom: true, kindId: k.id });
  });
  return tools;
}
function currentTool() {
  var tools = markTools();
  for (var i = 0; i < tools.length; i++) if (tools[i].id === markKind) return tools[i];
  var pick = tools[0];
  for (var j = 0; j < tools.length; j++) if (tools[j].mode === "level") { pick = tools[j]; break; }
  markKind = pick ? pick.id : "";
  return pick;
}
function toolHint(tool) {
  if (!tool) return "";
  if (!selectedUnit()) return "Pick a sport, or type a unit name. Each sport has its own skills to rate from 1 to 4.";
  if (tool.mode === "level" && tool.skillId) return "Tap a student, then rate " + tool.label + " from 1 Beginning to 4 Advanced.";
  if (tool.mode === "level") return "Pick a sport above to rate skills such as dribbling, passing, shooting, or the serve.";
  if (tool.mode === "behavior") return "Tap a student, then pick today’s behavior.";
  if (tool.id === "loaner") return "Tap a name to mark loaner clothes today (not wearing P.E. clothes). Tap again to clear.";
  if (tool.id === "tardy") return "Tap a name to mark a tardy today. Tap again to clear.";
  return "Tap a name to mark " + tool.label + " today. Tap again to clear.";
}
function skillScore(slot, tool) {
  if (!slot || !tool || tool.mode !== "level") return "";
  if (tool.skillId) {
    var map = slot.skills || {};
    return map[tool.skillId] ? String(map[tool.skillId]) : "";
  }
  return slot.skill ? String(slot.skill) : "";
}
function scoredSkillCount(slot, unit) {
  var skills = unitSkills(unit);
  if (!skills.length) return null;
  var map = (slot && slot.skills) || {};
  var n = 0;
  skills.forEach(function(sk) { if (map[sk.id]) n++; });
  return { n: n, total: skills.length };
}
function behaviorName(code) {
  for (var i = 0; i < MARK_BEHAVIORS.length; i++) if (MARK_BEHAVIORS[i].id === code) return MARK_BEHAVIORS[i].name;
  return code ? String(code) : "";
}
function unitSlot(vs, unitId, create) {
  if (!vs.marks) vs.marks = {};
  if (!vs.marks[unitId]) {
    if (!create) return null;
    vs.marks[unitId] = { days: {} };
  }
  if (!vs.marks[unitId].days || typeof vs.marks[unitId].days !== "object") vs.marks[unitId].days = {};
  return vs.marks[unitId];
}
function daySlot(slot, day, create) {
  if (!slot.days[day]) {
    if (!create) return null;
    slot.days[day] = {};
  }
  return slot.days[day];
}
function pruneSlot(slot) {
  Object.keys(slot.days || {}).forEach(function(d) {
    if (!slot.days[d] || !Object.keys(slot.days[d]).length) delete slot.days[d];
  });
}
function flagOn(day, tool) {
  if (!day || !tool) return false;
  if (tool.custom) return !!(day.x && day.x[tool.kindId]);
  if (tool.id === "loaner") return !!day.loaner;
  if (tool.id === "tardy") return !!day.tardy;
  if (tool.id === "behavior") return !!(day.behavior || day.behaviorNote);
  return false;
}
function assignFlag(day, tool, on) {
  if (tool.custom) {
    if (!day.x || typeof day.x !== "object") day.x = {};
    if (on) day.x[tool.kindId] = true;
    else delete day.x[tool.kindId];
    if (!Object.keys(day.x).length) delete day.x;
    return;
  }
  if (on) day[tool.id] = true;
  else delete day[tool.id];
}
function countFlag(student, unitId, key) {
  var slot = unitSlot(readVs(student), unitId, false);
  if (!slot) return 0;
  var n = 0;
  Object.keys(slot.days).forEach(function(d) {
    var day = slot.days[d] || {};
    if (String(key).indexOf("x:") === 0) { if (day.x && day.x[key.slice(2)]) n++; }
    else if (day[key]) n++;
  });
  return n;
}
function flagDates(student, unitId, tool) {
  var slot = unitSlot(readVs(student), unitId, false);
  if (!slot) return [];
  var days = [];
  Object.keys(slot.days).forEach(function(d) { if (flagOn(slot.days[d], tool)) days.push(d); });
  days.sort();
  return days;
}
function rememberSession() {
  try {
    sessionStorage.setItem("vs-mark-session", JSON.stringify({
      period: markPeriod, unit: markUnitId, kind: markKind
    }));
  } catch (e) {}
}
function restoreSession() {
  if (markRestored) return;
  markRestored = true;
  try {
    var saved = JSON.parse(sessionStorage.getItem("vs-mark-session") || "null");
    if (!saved) return;
    if (!markPeriod && saved.period) markPeriod = String(saved.period);
    if (!markUnitId && saved.unit) markUnitId = String(saved.unit);
    if (saved.kind) markKind = String(saved.kind);
  } catch (e) {}
}
function requireUnit() {
  if (selectedUnit()) return true;
  if (typeof alertEl === "function") alertEl("marks-alert", "Pick a sport or add a unit first.");
  var inp = document.getElementById("marks-unit-name");
  if (inp) inp.focus();
  return false;
}
function enqueueStudentMark(student, change) {
  if (!student) return Promise.resolve();
  var sid = student.id;
  var local = markStudent(sid) || student;
  var vs = readVs(local);
  change(vs);
  var cat = currentCatalog();
  if ((cat.v || 0) >= ((vs.catalog && Number(vs.catalog.v)) || 0)) vs.catalog = cloneJson(cat);
  writeLocalVs(local, vs);
  if (typeof renderMarkPads === "function") renderMarkPads();
  var run = (markSaveChain[sid] || Promise.resolve()).catch(function() {}).then(function() {
    if (typeof sb === "undefined" || !sb) throw new Error("Still connecting. Try again.");
    return sb.from("students").select("goals").eq("id", sid).then(function(r) {
      if (r.error) throw r.error;
      var goals = (r.data && r.data[0] && r.data[0].goals) || {};
      if (typeof goals === "string") { try { goals = JSON.parse(goals); } catch (e) { goals = {}; } }
      if (!goals || typeof goals !== "object") goals = {};
      var live = goals.__vs && typeof goals.__vs === "object" ? cloneJson(goals.__vs) : { marks: {} };
      if (!live.marks) live.marks = {};
      var remoteV = live.catalog && Number(live.catalog.v) || 0;
      if (remoteV > (currentCatalog().v || 0)) rememberCatalog(live.catalog);
      change(live);
      var nowCat = currentCatalog();
      if ((nowCat.v || 0) >= remoteV) live.catalog = cloneJson(nowCat);
      goals.__vs = live;
      return sb.from("students").update({ goals: goals }).eq("id", sid).then(function(ur) {
        if (ur.error) throw ur.error;
        if (typeof applyStudentPatch === "function") applyStudentPatch(sid, { goals: goals });
        if (typeof studentGoals !== "undefined" && studentGoals[sid]) studentGoals[sid] = goals;
        if (typeof alertEl === "function") alertEl("marks-alert", "");
      });
    });
  }).catch(function(err) {
    if (typeof alertEl === "function") alertEl("marks-alert", (err && err.message) || "Could not save that mark.");
    if (typeof sb !== "undefined" && sb) {
      sb.from("students").select("goals").eq("id", sid).then(function(r) {
        if (r.data && r.data[0] && typeof applyStudentPatch === "function") {
          applyStudentPatch(sid, { goals: r.data[0].goals || {} });
          renderMarkPads();
        }
      });
    }
    throw err;
  });
  markSaveChain[sid] = run;
  return run;
}
function persistCatalog() {
  var cat = cloneJson(currentCatalog());
  var anchor = ownedStudents()[0];
  if (!anchor) return Promise.resolve();
  return enqueueStudentMark(anchor, function(vs) { vs.catalog = cloneJson(cat); }).then(function() {
    markPushedV = cat.v;
  }).catch(function() {});
}
function refreshMarkBook() {
  scanCatalog();
  var v = currentCatalog().v || 0;
  if (v > 0 && v !== markPushedV && ownedStudents().length) {
    var bestServer = 0;
    ownedStudents().forEach(function(s) {
      var vs = readVs(s);
      var sv = vs.catalog && Number(vs.catalog.v) || 0;
      if (sv > bestServer) bestServer = sv;
    });
    if (v > bestServer) persistCatalog();
  }
  if (typeof renderRosterLaunch === "function") renderRosterLaunch();
  var pane = document.getElementById("pane-marks");
  if (pane && !pane.classList.contains("hidden") && typeof renderMarks === "function") renderMarks();
}
function renderRosterLaunch() {
  var el = document.getElementById("roster-launch");
  if (!el || typeof allStudents !== "function") return;
  var periods = markPeriods();
  if (!periods.length) { el.innerHTML = ""; return; }
  el.innerHTML = '<div style="font-size:12px;color:var(--text2);margin-bottom:8px">Open a period to mark the class</div><div class="roster-launch">' +
    periods.map(function(p) {
      var n = allStudents().filter(function(s) { return String(s.period) === String(p); }).length;
      return '<button type="button" class="roster-period" data-period="' + escHtml(p) + '">Period ' + escHtml(p) + "<span>" + n + (n === 1 ? " student" : " students") + "</span></button>";
    }).join("") + "</div>";
}
function renderMarkPeriods() {
  var grid = document.getElementById("marks-period-grid");
  if (!grid) return;
  var periods = markPeriods();
  if (!periods.length) {
    grid.innerHTML = '<div class="mark-intro">Add students on the Roster tab, then open a period here.</div>';
    return;
  }
  grid.innerHTML = periods.map(function(p) {
    var n = allStudents().filter(function(s) { return String(s.period) === String(p); }).length;
    return '<button type="button" class="mark-period" data-act="open" data-period="' + escHtml(p) + '">' +
      '<span class="kicker">Roster</span><span class="big">Period ' + escHtml(p) + '</span><span class="sub">' + n + (n === 1 ? " student" : " students") + "</span></button>";
  }).join("");
}
function backfillSportSkills() {
  var cat = currentCatalog();
  var changed = false;
  var next = cloneJson(cat);
  next.units.forEach(function(u) {
    if (u.skills && u.skills.length) return;
    var pack = sportPack(u.name);
    if (!pack) return;
    u.skills = copySportSkills(pack);
    changed = true;
  });
  if (!changed) return false;
  next.v = (next.v || 0) + 1;
  rememberCatalog(next);
  persistCatalog();
  return true;
}
function renderSportPicker(unit) {
  var box = document.getElementById("marks-sports");
  if (!box) return;
  var names = {};
  currentCatalog().units.forEach(function(u) { names[u.name.toLowerCase()] = true; });
  box.innerHTML = MARK_SPORTS.map(function(sp) {
    var selected = unit && unit.name.toLowerCase() === sp.name.toLowerCase();
    var added = !!names[sp.name.toLowerCase()];
    return '<button type="button" class="mark-unit-btn' + (selected ? " on" : "") + '" data-act="sport" data-sport="' + escHtml(sp.name) + '">' + escHtml(sp.name + (added && !selected ? " ✓" : "")) + "</button>";
  }).join("");
}
function renderMarkChrome() {
  backfillSportSkills();
  var label = document.getElementById("marks-period-label");
  if (label) label.textContent = "Period " + markPeriod;
  var unitBox = document.getElementById("marks-units");
  var kindBox = document.getElementById("marks-kinds");
  var unit = ensureSelectedUnit();
  var cat = currentCatalog();
  renderSportPicker(unit);
  if (unitBox) {
    unitBox.innerHTML = cat.units.map(function(u) {
      return '<button type="button" class="mark-unit-btn' + (unit && u.id === unit.id ? " on" : "") + '" data-act="unit" data-id="' + escHtml(u.id) + '">' + escHtml(u.name) + "</button>";
    }).join("") || '<span class="mark-hint">No unit yet. Pick a sport above.</span>';
  }
  if (kindBox) {
    var active = currentTool();
    kindBox.innerHTML = markTools().map(function(tool) {
      var on = active && tool.id === active.id ? " on" : "";
      var remove = "";
      if (tool.custom) remove = '<button type="button" data-act="remove-kind" data-kind-id="' + escHtml(tool.kindId) + '" title="Remove mark">×</button>';
      else if (tool.skillId) remove = '<button type="button" data-act="remove-skill" data-skill-id="' + escHtml(tool.skillId) + '" title="Remove skill">×</button>';
      return '<span class="mark-chiprow"><button type="button" class="mark-tool' + on + '" data-act="kind" data-kind="' + escHtml(tool.id) + '">' + escHtml(tool.label) + "</button>" + remove + "</span>";
    }).join("");
  }
  var hint = document.getElementById("marks-hint");
  if (hint) hint.textContent = toolHint(currentTool());
}
function padHtml(s, unit, tool, dayKey) {
  var tone = markTone(s);
  var skill = "", day = {}, note = "";
  if (unit) {
    var slot = unitSlot(readVs(s), unit.id, false) || { days: {} };
    skill = slot.skill || "";
    note = slot.note || "";
    day = (slot.days && slot.days[dayKey]) || {};
  }
  var score = unit ? skillScore(slot, tool) : "";
  var progress = unit ? scoredSkillCount(slot, unit) : null;
  var hit = false;
  if (tool && unit) {
    if (tool.mode === "level") hit = !!score;
    else hit = flagOn(day, tool);
  }
  var chips = [];
  if (tool && tool.mode === "level" && tool.skillId && score) chips.push(tool.label + " " + score);
  else if (skill && (!unit || !unitSkills(unit).length)) chips.push("Lv " + skill);
  if (progress && progress.n) chips.push(progress.n + "/" + progress.total);
  if (day.loaner) chips.push("Loaner");
  if (day.tardy) chips.push("Tardy");
  if (day.behavior || day.behaviorNote) chips.push(day.behavior ? behaviorName(day.behavior) : "Note");
  if (unit && day.x) {
    currentCatalog().kinds.forEach(function(k) { if (day.x[k.id]) chips.push(k.name); });
  }
  var counts = [];
  if (unit) {
    var lc = countFlag(s, unit.id, "loaner");
    var tc = countFlag(s, unit.id, "tardy");
    if (lc) counts.push("L" + lc);
    if (tc) counts.push("T" + tc);
  }
  if (note) chips.push("Note");
  var nick = markNickLine(s);
  var full = (markBigName(s) + " " + String(s.last || "")).trim();
  return '<button type="button" class="mark-pad ' + tone + (hit ? " hit" : "") + (s.id === markFocus ? " focus" : "") + '" data-act="tap" data-id="' + escHtml(s.id) + '" data-letter="' + escHtml(markLetter(s)) + '" aria-pressed="' + (hit ? "true" : "false") + '" title="' + escHtml(full) + '">' +
    '<div class="fn">' + escHtml(markBigName(s)) + "</div>" +
    (nick ? '<div class="nick">“' + escHtml(nick) + "”</div>" : "") +
    '<div class="ln">' + escHtml(String(s.last || "")) + "</div>" +
    (tone === "other" && s.gender && typeof genderShort === "function" ? '<div class="gn">' + escHtml(genderShort(s.gender)) + "</div>" : "") +
    '<div class="mark-chips">' + chips.map(function(c) { return '<span class="mark-chip">' + escHtml(c) + "</span>"; }).join("") + "</div>" +
    (counts.length ? '<div class="counts">' + escHtml(counts.join(" · ")) + "</div>" : "") +
    "</button>";
}
function renderMarkSummary(people, unit) {
  var el = document.getElementById("marks-summary");
  if (!el) return;
  if (!unit) { el.textContent = people.length + (people.length === 1 ? " student" : " students"); return; }
  var day = markToday();
  var tool = currentTool();
  var loan = 0, tardy = 0, skilled = 0;
  people.forEach(function(s) {
    var slot = unitSlot(readVs(s), unit.id, false);
    if (!slot) return;
    if (skillScore(slot, tool)) skilled++;
    var rec = (slot.days && slot.days[day]) || {};
    if (rec.loaner) loan++;
    if (rec.tardy) tardy++;
  });
  var skillLabel = tool && tool.mode === "level" ? tool.label : "Skill";
  el.textContent = people.length + " students · " + skillLabel + " set for " + skilled + " · " + loan + " loaners today · " + tardy + " tardies today";
}
function renderAlpha(list) {
  var el = document.getElementById("marks-alpha");
  if (!el) return;
  var seen = {}, letters = [];
  list.forEach(function(s) {
    var L = markLetter(s);
    if (!seen[L]) { seen[L] = true; letters.push(L); }
  });
  el.innerHTML = letters.map(function(L) {
    return '<button type="button" class="mark-letter" data-act="jump" data-letter="' + escHtml(L) + '">' + escHtml(L) + "</button>";
  }).join("");
}
function dateLine(dates) {
  if (!dates.length) return "None in this unit yet.";
  var shown = dates.slice(-8).map(shortDay).join(", ");
  var extra = dates.length > 8 ? " +" + (dates.length - 8) + " earlier" : "";
  return shown + extra + " · " + dates.length + " total";
}
function renderMarkDock() {
  var dock = document.getElementById("marks-dock");
  if (!dock) return;
  var typing = dock.contains(document.activeElement) && (document.activeElement.tagName === "TEXTAREA" || document.activeElement.tagName === "INPUT");
  if (typing && dock.getAttribute("data-sid") === markFocus && dock.getAttribute("data-kind") === markKind) return;
  if (!markFocus) { dock.classList.add("hidden"); dock.innerHTML = ""; return; }
  var s = markStudent(markFocus);
  var unit = selectedUnit();
  if (!s || !unit) { dock.classList.add("hidden"); dock.innerHTML = ""; return; }
  var tool = currentTool();
  var slot = unitSlot(readVs(s), unit.id, false) || { days: {} };
  var dayKey = markToday();
  var day = (slot.days && slot.days[dayKey]) || {};
  var html = '<div class="row" style="justify-content:space-between;align-items:flex-start"><div><div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#8A7040">Period ' + escHtml(markPeriod) + " · " + escHtml(unit.name) + '</div><h3>' + escHtml(markBigName(s)) + " " + escHtml(String(s.last || "")) + "</h3></div>" +
    '<button type="button" data-act="unfocus">Close</button></div>';
  if (tool.mode === "level") {
    var rated = skillScore(slot, tool);
    html += '<div class="mark-hint" style="margin-bottom:8px">' + escHtml(tool.skillId ? tool.label : "Skill level") + "</div>";
    html += '<div class="rowline">' + MARK_LEVELS.map(function(level) {
      var on = rated === level.id ? " on" : "";
      return '<button type="button" class="' + on + '" data-act="level" data-level="' + level.id + '">' + level.id + " " + level.name + "</button>";
    }).join("") + '<button type="button" data-act="clear">Clear</button></div>';
  } else if (tool.mode === "behavior") {
    html += '<div class="rowline">' + MARK_BEHAVIORS.map(function(b) {
      var on = day.behavior === b.id ? " on" : "";
      return '<button type="button" class="' + on + '" data-act="behavior" data-code="' + b.id + '">' + b.name + "</button>";
    }).join("") + '<button type="button" data-act="clear">Clear today</button></div>';
    html += '<textarea id="marks-behavior-note" rows="2" placeholder="Behavior note for today">' + escHtml(day.behaviorNote || "") + "</textarea>";
    html += '<div class="mark-hint" style="margin-top:8px">This unit: ' + escHtml(dateLine(flagDates(s, unit.id, tool))) + "</div>";
  } else {
    var on = flagOn(day, tool);
    html += '<div class="rowline"><strong>' + escHtml(tool.label) + " today: " + (on ? "On" : "Off") + '</strong><button type="button" data-act="clear">Clear today</button></div>';
    html += '<div class="mark-hint" style="margin-top:8px">' + escHtml(dateLine(flagDates(s, unit.id, tool))) + "</div>";
  }
  html += '<label class="lbl-dark" style="display:block;margin-top:12px;font-size:11px;letter-spacing:.06em;text-transform:uppercase">Unit note</label>';
  html += '<textarea id="marks-unit-note" rows="2" placeholder="Anything else for this unit">' + escHtml(slot.note || "") + "</textarea>";
  dock.innerHTML = html;
  dock.setAttribute("data-sid", markFocus);
  dock.setAttribute("data-kind", markKind);
  dock.classList.remove("hidden");
}
function renderMarkPads() {
  var grid = document.getElementById("marks-grid");
  if (!grid || !markPeriod) return;
  var unit = ensureSelectedUnit();
  var tool = currentTool();
  var dayKey = markToday();
  var search = (document.getElementById("marks-search") || {}).value || "";
  var shown = periodStudents(search);
  var everyone = periodStudents("");
  renderMarkSummary(everyone, unit);
  renderAlpha(shown);
  if (!shown.length) {
    grid.innerHTML = '<div class="mark-intro">No students match that search.</div>';
  } else {
    grid.innerHTML = shown.map(function(s) { return padHtml(s, unit, tool, dayKey); }).join("");
  }
  renderMarkDock();
}
function renderMarks() {
  restoreSession();
  var periods = markPeriods();
  var board = document.getElementById("marks-board");
  var picker = document.getElementById("marks-periods");
  if (!board || !picker) return;
  var show = !!markPeriod && periods.indexOf(String(markPeriod)) !== -1;
  if (markPeriod && !show) markPeriod = "";
  picker.classList.toggle("hidden", show);
  board.classList.toggle("hidden", !show);
  if (show) {
    renderMarkChrome();
    renderMarkPads();
  } else {
    renderMarkPeriods();
  }
}
function openMarks(period) {
  markPeriod = String(period || "");
  markFocus = "";
  rememberSession();
  if (typeof goTab === "function") goTab("marks");
  else renderMarks();
}
function closeMarkBoard() {
  markPeriod = "";
  markFocus = "";
  rememberSession();
  renderMarks();
}
function addUnitFromInput() {
  var input = document.getElementById("marks-unit-name");
  var name = String((input && input.value) || "").trim();
  if (!name) { if (input) input.focus(); return; }
  var cat = cloneJson(currentCatalog());
  if (cat.units.some(function(u) { return u.name.toLowerCase() === name.toLowerCase(); })) {
    if (typeof alertEl === "function") alertEl("marks-alert", "That unit is already on the list.");
    return;
  }
  var pack = sportPack(name);
  var unit = { id: "u" + Math.random().toString(36).slice(2, 8), name: pack ? pack.name : name, skills: pack ? copySportSkills(pack) : [] };
  cat.units.push(unit);
  cat.v = (cat.v || 0) + 1;
  rememberCatalog(cat);
  markUnitId = unit.id;
  if (unit.skills.length) markKind = "skill:" + unit.skills[0].id;
  if (input) input.value = "";
  if (typeof alertEl === "function") alertEl("marks-alert", "");
  rememberSession();
  persistCatalog();
  renderMarkChrome();
  renderMarkPads();
}
function renameUnitFromInput() {
  var unit = selectedUnit();
  var input = document.getElementById("marks-unit-name");
  var name = String((input && input.value) || "").trim();
  if (!unit || !name) {
    if (typeof alertEl === "function") alertEl("marks-alert", "Type the new unit name, then tap Rename.");
    return;
  }
  var cat = cloneJson(currentCatalog());
  cat.units.forEach(function(u) { if (u.id === unit.id) u.name = name; });
  cat.v = (cat.v || 0) + 1;
  rememberCatalog(cat);
  if (input) input.value = "";
  if (typeof alertEl === "function") alertEl("marks-alert", "");
  rememberSession();
  persistCatalog();
  renderMarkChrome();
}
function deleteSelectedUnit() {
  var unit = selectedUnit();
  if (!unit) return;
  if (!confirm("Delete the " + unit.name + " unit and the marks saved in it?")) return;
  var cat = cloneJson(currentCatalog());
  cat.units = cat.units.filter(function(u) { return u.id !== unit.id; });
  cat.v = (cat.v || 0) + 1;
  rememberCatalog(cat);
  markUnitId = cat.units.length ? cat.units[0].id : "";
  markFocus = "";
  rememberSession();
  persistCatalog();
  ownedStudents().forEach(function(s) {
    if (!readVs(s).marks[unit.id]) return;
    enqueueStudentMark(s, function(vs) { if (vs.marks) delete vs.marks[unit.id]; });
  });
  renderMarkChrome();
  renderMarkPads();
}
function addKindFromInput() {
  var input = document.getElementById("marks-kind-name");
  var name = String((input && input.value) || "").trim();
  if (!name) { if (input) input.focus(); return; }
  var cat = cloneJson(currentCatalog());
  if (cat.kinds.some(function(k) { return k.name.toLowerCase() === name.toLowerCase(); })) {
    if (typeof alertEl === "function") alertEl("marks-alert", "That mark is already on the list.");
    return;
  }
  var id = "k" + Math.random().toString(36).slice(2, 8);
  cat.kinds.push({ id: id, name: name });
  cat.v = (cat.v || 0) + 1;
  rememberCatalog(cat);
  markKind = "x:" + id;
  if (input) input.value = "";
  if (typeof alertEl === "function") alertEl("marks-alert", "");
  rememberSession();
  persistCatalog();
  renderMarkChrome();
  renderMarkPads();
}
function removeKind(id) {
  var cat = currentCatalog();
  var kind = null;
  for (var i = 0; i < cat.kinds.length; i++) if (cat.kinds[i].id === id) kind = cat.kinds[i];
  if (!kind) return;
  if (!confirm("Remove the " + kind.name + " mark?")) return;
  var next = cloneJson(cat);
  next.kinds = next.kinds.filter(function(k) { return k.id !== id; });
  next.v = (next.v || 0) + 1;
  rememberCatalog(next);
  if (markKind === "x:" + id) markKind = "";
  currentTool();
  rememberSession();
  persistCatalog();
  renderMarkChrome();
  renderMarkPads();
}
function tapStudent(sid) {
  markFocus = sid;
  var tool = currentTool();
  if (!requireUnit()) { renderMarkPads(); return; }
  if (tool.mode !== "toggle") {
    renderMarkPads();
    var dock = document.getElementById("marks-dock");
    if (dock && dock.scrollIntoView) dock.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  var unit = selectedUnit();
  var student = markStudent(sid);
  var dayKey = markToday();
  enqueueStudentMark(student, function(vs) {
    var slot = unitSlot(vs, unit.id, true);
    var day = daySlot(slot, dayKey, true);
    assignFlag(day, tool, !flagOn(day, tool));
    pruneSlot(slot);
  });
}
function skillIdFor(unit, name) {
  var pack = sportPack(unit && unit.name);
  var taken = {};
  unitSkills(unit).forEach(function(s) { taken[s.id] = true; });
  if (pack) {
    for (var i = 0; i < pack.skills.length; i++) {
      if (pack.skills[i].name.toLowerCase() === name.toLowerCase() && !taken[pack.skills[i].id]) return pack.skills[i].id;
    }
  }
  var id = "s" + Math.random().toString(36).slice(2, 8);
  while (taken[id]) id = "s" + Math.random().toString(36).slice(2, 8);
  return id;
}
function addSportUnit(sportName) {
  var pack = sportPack(sportName);
  if (!pack) return;
  var cat = cloneJson(currentCatalog());
  var existing = null;
  cat.units.forEach(function(u) {
    if (u.name.toLowerCase() === pack.name.toLowerCase()) existing = u;
  });
  if (existing) {
    if (!existing.skills || !existing.skills.length) {
      existing.skills = copySportSkills(pack);
      cat.v = (cat.v || 0) + 1;
      rememberCatalog(cat);
      persistCatalog();
    }
    markUnitId = existing.id;
  } else {
    var unit = { id: "u" + Math.random().toString(36).slice(2, 8), name: pack.name, skills: copySportSkills(pack) };
    cat.units.push(unit);
    cat.v = (cat.v || 0) + 1;
    rememberCatalog(cat);
    markUnitId = unit.id;
    persistCatalog();
  }
  markKind = "skill:" + pack.skills[0].id;
  markFocus = "";
  if (typeof alertEl === "function") alertEl("marks-alert", "");
  rememberSession();
  renderMarkChrome();
  renderMarkPads();
}
function addSkillFromInput() {
  if (!requireUnit()) return;
  var input = document.getElementById("marks-skill-name");
  var name = String((input && input.value) || "").trim();
  if (!name) { if (input) input.focus(); return; }
  var unit = selectedUnit();
  var cat = cloneJson(currentCatalog());
  var target = null;
  cat.units.forEach(function(u) { if (u.id === unit.id) target = u; });
  if (!target) return;
  if (!target.skills) target.skills = [];
  if (target.skills.some(function(s) { return s.name.toLowerCase() === name.toLowerCase(); })) {
    if (typeof alertEl === "function") alertEl("marks-alert", "That skill is already on this unit.");
    return;
  }
  var id = skillIdFor(target, name);
  target.skills.push({ id: id, name: name });
  cat.v = (cat.v || 0) + 1;
  rememberCatalog(cat);
  markKind = "skill:" + id;
  if (input) input.value = "";
  if (typeof alertEl === "function") alertEl("marks-alert", "");
  rememberSession();
  persistCatalog();
  renderMarkChrome();
  renderMarkPads();
}
function removeSkill(id) {
  var unit = selectedUnit();
  if (!unit) return;
  var skill = null;
  unitSkills(unit).forEach(function(s) { if (s.id === id) skill = s; });
  if (!skill) return;
  if (!confirm("Remove " + skill.name + " from " + unit.name + "?")) return;
  var next = cloneJson(currentCatalog());
  next.units.forEach(function(u) {
    if (u.id !== unit.id || !u.skills) return;
    u.skills = u.skills.filter(function(s) { return s.id !== id; });
  });
  next.v = (next.v || 0) + 1;
  rememberCatalog(next);
  if (markKind === "skill:" + id) markKind = "";
  currentTool();
  rememberSession();
  persistCatalog();
  renderMarkChrome();
  renderMarkPads();
}
function setSkillLevel(level) {
  if (!markFocus || !requireUnit()) return;
  var unit = selectedUnit();
  var student = markStudent(markFocus);
  var tool = currentTool();
  var skillId = tool && tool.skillId ? tool.skillId : "";
  enqueueStudentMark(student, function(vs) {
    var slot = unitSlot(vs, unit.id, true);
    if (skillId) {
      if (!slot.skills || typeof slot.skills !== "object") slot.skills = {};
      if (level) slot.skills[skillId] = String(level);
      else delete slot.skills[skillId];
      if (!Object.keys(slot.skills).length) delete slot.skills;
    } else if (level) slot.skill = String(level);
    else delete slot.skill;
  });
}
function setBehaviorCode(code) {
  if (!markFocus || !requireUnit()) return;
  var unit = selectedUnit();
  var student = markStudent(markFocus);
  var dayKey = markToday();
  enqueueStudentMark(student, function(vs) {
    var slot = unitSlot(vs, unit.id, true);
    var day = daySlot(slot, dayKey, true);
    if (code) day.behavior = code;
    else {
      delete day.behavior;
      delete day.behaviorNote;
    }
    pruneSlot(slot);
  });
}
function clearCurrentMark() {
  var tool = currentTool();
  if (tool.mode === "level") setSkillLevel("");
  else if (tool.mode === "behavior") setBehaviorCode("");
  else if (markFocus && selectedUnit()) {
    var unit = selectedUnit();
    var student = markStudent(markFocus);
    var dayKey = markToday();
    enqueueStudentMark(student, function(vs) {
      var slot = unitSlot(vs, unit.id, true);
      var day = daySlot(slot, dayKey, true);
      assignFlag(day, tool, false);
      pruneSlot(slot);
    });
  }
}
function saveUnitNote(text) {
  if (!markFocus || !selectedUnit()) return;
  var unit = selectedUnit();
  var student = markStudent(markFocus);
  var note = String(text || "").trim();
  enqueueStudentMark(student, function(vs) {
    var slot = unitSlot(vs, unit.id, true);
    if (note) slot.note = note;
    else delete slot.note;
  });
}
function saveBehaviorNote(text) {
  if (!markFocus || !selectedUnit()) return;
  var unit = selectedUnit();
  var student = markStudent(markFocus);
  var dayKey = markToday();
  var note = String(text || "").trim();
  enqueueStudentMark(student, function(vs) {
    var slot = unitSlot(vs, unit.id, true);
    var day = daySlot(slot, dayKey, true);
    if (note) day.behaviorNote = note;
    else delete day.behaviorNote;
    pruneSlot(slot);
  });
}
function jumpMarkLetter(letter) {
  var grid = document.getElementById("marks-grid");
  if (!grid) return;
  var nodes = grid.querySelectorAll("[data-letter]");
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].getAttribute("data-letter") === letter) {
      nodes[i].scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
  }
}
function onMarksClick(e) {
  var el = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
  if (!el) return;
  var act = el.getAttribute("data-act");
  if (act === "open") openMarks(el.getAttribute("data-period"));
  else if (act === "back") closeMarkBoard();
  else if (act === "today") { var d = document.getElementById("marks-date"); if (d) d.value = isoToday(); renderMarkPads(); }
  else if (act === "add-unit") addUnitFromInput();
  else if (act === "rename-unit") renameUnitFromInput();
  else if (act === "delete-unit") deleteSelectedUnit();
  else if (act === "add-kind") addKindFromInput();
  else if (act === "add-skill") addSkillFromInput();
  else if (act === "remove-kind") removeKind(el.getAttribute("data-kind-id"));
  else if (act === "remove-skill") removeSkill(el.getAttribute("data-skill-id"));
  else if (act === "sport") addSportUnit(el.getAttribute("data-sport"));
  else if (act === "unit") {
    markUnitId = el.getAttribute("data-id");
    markFocus = "";
    currentTool();
    rememberSession();
    renderMarkChrome();
    renderMarkPads();
  }
  else if (act === "kind") { markKind = el.getAttribute("data-kind"); rememberSession(); renderMarkChrome(); renderMarkPads(); }
  else if (act === "jump") jumpMarkLetter(el.getAttribute("data-letter"));
  else if (act === "tap") tapStudent(el.getAttribute("data-id"));
  else if (act === "level") setSkillLevel(el.getAttribute("data-level"));
  else if (act === "behavior") setBehaviorCode(el.getAttribute("data-code"));
  else if (act === "clear") clearCurrentMark();
  else if (act === "unfocus") { markFocus = ""; renderMarkPads(); }
}
function onMarksChange(e) {
  var t = e.target;
  if (!t) return;
  if (t.id === "marks-unit-note") saveUnitNote(t.value);
  if (t.id === "marks-behavior-note") saveBehaviorNote(t.value);
}
function bindMarksUI() {
  var pane = document.getElementById("pane-marks");
  if (pane && !pane.dataset.bound) {
    pane.dataset.bound = "1";
    pane.addEventListener("click", onMarksClick);
    pane.addEventListener("change", onMarksChange);
    var search = document.getElementById("marks-search");
    if (search) search.addEventListener("input", function() { renderMarkPads(); });
    var date = document.getElementById("marks-date");
    if (date) date.addEventListener("change", function() { renderMarkPads(); });
    ["marks-unit-name", "marks-kind-name", "marks-skill-name"].forEach(function(id) {
      var input = document.getElementById(id);
      if (!input) return;
      input.addEventListener("keydown", function(ev) {
        if (ev.key !== "Enter") return;
        ev.preventDefault();
        if (id === "marks-unit-name") addUnitFromInput();
        else if (id === "marks-skill-name") addSkillFromInput();
        else addKindFromInput();
      });
    });
  }
  var launch = document.getElementById("roster-launch");
  if (launch && !launch.dataset.bound) {
    launch.dataset.bound = "1";
    launch.addEventListener("click", function(e) {
      var btn = e.target && e.target.closest ? e.target.closest("[data-period]") : null;
      if (!btn) return;
      openMarks(btn.getAttribute("data-period"));
    });
  }
}
if (typeof document !== "undefined") bindMarksUI();

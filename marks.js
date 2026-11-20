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
var markOrder = "mark";
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
  if (!selectedUnit()) return "Pick a sport, or type a unit name. Each sport has its own skills to rate from 1 to 4.";
  if (markOrder === "student") {
    return markFocus
      ? "Choose this student’s skill ratings and today’s marks below."
      : "Tap a student’s name first, then choose the skill ratings and today’s marks.";
  }
  if (!tool) return "";
  if (tool.mode === "level" && tool.skillId) return "This mark is selected. Tap a student, then rate " + tool.label + " from 1 Beginning to 4 Advanced.";
  if (tool.mode === "level") return "Pick a sport above to rate skills such as dribbling, passing, shooting, or the serve.";
  if (tool.mode === "behavior") return "Behavior is selected. Tap a student, then pick today’s behavior.";
  if (tool.id === "loaner") return "Loaner is selected. Tap a name to mark loaner clothes today (not wearing P.E. clothes). Tap again to clear.";
  if (tool.id === "tardy") return "Tardy is selected. Tap a name to mark a tardy today. Tap again to clear.";
  return tool.label + " is selected. Tap a name to mark it today. Tap again to clear.";
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
      period: markPeriod, unit: markUnitId, kind: markKind, order: markOrder
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
    if (saved.order === "student" || saved.order === "mark") markOrder = saved.order;
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
      var write = sb.from("students").update({ goals: goals }).eq("id", sid);
      var pending = write.select ? write.select("id, goals") : write;
      return pending.then(function(ur) {
        if (ur.error) throw ur.error;
        if (ur.data && !ur.data.length) throw new Error("That mark did not save. Refresh the page and try again.");
        var savedGoals = (ur.data && ur.data[0] && ur.data[0].goals) || goals;
        if (typeof savedGoals === "string") { try { savedGoals = JSON.parse(savedGoals); } catch (e) { savedGoals = goals; } }
        if (goals.__vs && !(savedGoals && savedGoals.__vs)) throw new Error("That mark did not stay saved. Refresh the page and try again.");
        if (typeof applyStudentPatch === "function") applyStudentPatch(sid, { goals: savedGoals });
        if (typeof studentGoals !== "undefined" && studentGoals[sid]) studentGoals[sid] = savedGoals;
        if (typeof alertEl === "function") alertEl("marks-alert", "Saved.", "ok");
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
  var cat = currentCatalog();
  var have = {};
  var current = "";
  var yours = cat.units.map(function(u) {
    have[u.name.toLowerCase()] = true;
    if (unit && u.id === unit.id) current = "unit:" + u.id;
    return '<option value="unit:' + escHtml(u.id) + '">' + escHtml(u.name) + "</option>";
  }).join("");
  var extra = MARK_SPORTS.filter(function(sp) {
    return !have[sp.name.toLowerCase()];
  }).map(function(sp) {
    return '<option value="sport:' + escHtml(sp.name) + '">Add ' + escHtml(sp.name) + "</option>";
  }).join("");
  var html = yours ? "" : '<option value="">Choose a sport</option>';
  if (yours) html += '<optgroup label="Your sports">' + yours + "</optgroup>";
  if (extra) html += '<optgroup label="Add a sport">' + extra + "</optgroup>";
  box.innerHTML = html;
  if (current) box.value = current;
}
function renderMarkChrome() {
  backfillSportSkills();
  var label = document.getElementById("marks-period-label");
  if (label) label.textContent = "Period " + markPeriod;
  var kindBox = document.getElementById("marks-kinds");
  var unit = ensureSelectedUnit();
  renderSportPicker(unit);
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
  var markBtn = document.getElementById("marks-order-mark");
  var studentBtn = document.getElementById("marks-order-student");
  if (markBtn) markBtn.classList.toggle("on", markOrder !== "student");
  if (studentBtn) studentBtn.classList.toggle("on", markOrder === "student");
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
  var loan = 0, tardy = 0, skilled = 0, unitLoan = 0, unitTardy = 0;
  var custom = {};
  people.forEach(function(s) {
    var slot = unitSlot(readVs(s), unit.id, false);
    if (!slot) return;
    if (skillScore(slot, tool)) skilled++;
    var rec = (slot.days && slot.days[day]) || {};
    if (rec.loaner) loan++;
    if (rec.tardy) tardy++;
    Object.keys(slot.days || {}).forEach(function(d) {
      var one = slot.days[d] || {};
      if (one.loaner) unitLoan++;
      if (one.tardy) unitTardy++;
      if (!one.x) return;
      currentCatalog().kinds.forEach(function(k) { if (one.x[k.id]) custom[k.name] = (custom[k.name] || 0) + 1; });
    });
  });
  var skillLabel = tool && tool.mode === "level" ? tool.label : "Skill";
  var extras = Object.keys(custom).sort().map(function(name) { return custom[name] + " " + name; });
  el.textContent = people.length + " students · " + skillLabel + " set for " + skilled +
    " · " + loan + " loaners today · " + tardy + " tardies today" +
    " · This unit: " + unitTardy + " tardies, " + unitLoan + " loaners" +
    (extras.length ? ", " + extras.join(", ") : "");
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
function levelButtons(rated, skillAttr) {
  return MARK_LEVELS.map(function(level) {
    var on = rated === level.id ? " on" : "";
    return '<button type="button" class="' + on + '" data-act="level" data-level="' + level.id + '"' + skillAttr + '>' + level.id + " " + level.name + "</button>";
  }).join("");
}
function studentMarksHtml(slot, day) {
  var html = "";
  var skills = unitSkills(selectedUnit());
  if (skills.length) {
    skills.forEach(function(sk) {
      var rated = slot.skills && slot.skills[sk.id] ? String(slot.skills[sk.id]) : "";
      html += '<div class="skill-block"><div class="mark-hint">' + escHtml(sk.name) + "</div><div class=\"rowline\">" +
        levelButtons(rated, ' data-skill="' + escHtml(sk.id) + '"') +
        '<button type="button" data-act="clear-skill" data-skill="' + escHtml(sk.id) + '">Clear</button></div></div>';
    });
  } else {
    html += '<div class="skill-block"><div class="mark-hint">Skill level</div><div class="rowline">' +
      levelButtons(slot.skill ? String(slot.skill) : "", ' data-skill=""') +
      '<button type="button" data-act="clear-skill" data-skill="">Clear</button></div></div>';
  }
  html += '<div class="skill-block"><div class="mark-hint">Today</div><div class="rowline">';
  markTools().forEach(function(tool) {
    if (tool.mode !== "toggle") return;
    var on = flagOn(day, tool) ? " on" : "";
    html += '<button type="button" class="' + on + '" data-act="flag" data-kind="' + escHtml(tool.id) + '">' + escHtml(tool.label) + "</button>";
  });
  html += "</div></div>";
  html += '<div class="skill-block"><div class="mark-hint">Behavior</div><div class="rowline">' + MARK_BEHAVIORS.map(function(b) {
    var on = day.behavior === b.id ? " on" : "";
    return '<button type="button" class="' + on + '" data-act="behavior" data-code="' + b.id + '">' + b.name + "</button>";
  }).join("") + '<button type="button" data-act="clear-behavior">Clear today</button></div>';
  html += '<textarea id="marks-behavior-note" rows="2" placeholder="Behavior note for today">' + escHtml(day.behaviorNote || "") + "</textarea></div>";
  return html;
}
function renderMarkDock() {
  var dock = document.getElementById("marks-dock");
  if (!dock) return;
  var dockKind = markOrder === "student" ? "student" : markKind;
  var typing = dock.contains(document.activeElement) && (document.activeElement.tagName === "TEXTAREA" || document.activeElement.tagName === "INPUT");
  if (typing && dock.getAttribute("data-sid") === markFocus && dock.getAttribute("data-kind") === dockKind) return;
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
  if (markOrder === "student") html += studentMarksHtml(slot, day);
  else if (tool.mode === "level") {
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
  dock.setAttribute("data-kind", dockKind);
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
  if (markOrder === "student" || tool.mode !== "toggle") {
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
function setSkillLevel(level, skillId) {
  if (!markFocus || !requireUnit()) return;
  var unit = selectedUnit();
  var student = markStudent(markFocus);
  if (skillId == null) {
    var tool = currentTool();
    skillId = tool && tool.skillId ? tool.skillId : "";
  }
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
function toggleFocusedTool(toolId) {
  if (!markFocus || !requireUnit()) return;
  var tool = null;
  markTools().forEach(function(item) { if (item.id === toolId) tool = item; });
  if (!tool || tool.mode !== "toggle") return;
  var unit = selectedUnit();
  var student = markStudent(markFocus);
  var dayKey = markToday();
  enqueueStudentMark(student, function(vs) {
    var slot = unitSlot(vs, unit.id, true);
    var day = daySlot(slot, dayKey, true);
    assignFlag(day, tool, !flagOn(day, tool));
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
  else if (act === "report") { if (typeof goTab === "function") goTab("report"); }
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
  else if (act === "order") {
    markOrder = el.getAttribute("data-order") === "student" ? "student" : "mark";
    rememberSession();
    renderMarkChrome();
    renderMarkPads();
  }
  else if (act === "jump") jumpMarkLetter(el.getAttribute("data-letter"));
  else if (act === "tap") tapStudent(el.getAttribute("data-id"));
  else if (act === "level") setSkillLevel(el.getAttribute("data-level"), el.hasAttribute("data-skill") ? el.getAttribute("data-skill") : null);
  else if (act === "clear-skill") setSkillLevel("", el.hasAttribute("data-skill") ? el.getAttribute("data-skill") : null);
  else if (act === "behavior") setBehaviorCode(el.getAttribute("data-code"));
  else if (act === "clear-behavior") setBehaviorCode("");
  else if (act === "flag") toggleFocusedTool(el.getAttribute("data-kind"));
  else if (act === "clear") clearCurrentMark();
  else if (act === "unfocus") { markFocus = ""; renderMarkPads(); }
}
function levelName(id) {
  var key = String(id || "");
  for (var i = 0; i < MARK_LEVELS.length; i++) if (MARK_LEVELS[i].id === key) return MARK_LEVELS[i].name;
  return key;
}
function reportDayOn(dayKey, when, day) {
  return when !== "day" || dayKey === day;
}
function studentMarkFacts(student, unit, when, day) {
  var slot = unit ? unitSlot(readVs(student), unit.id, false) : null;
  var skills = {};
  unitSkills(unit).forEach(function(sk) {
    skills[sk.id] = slot && slot.skills && slot.skills[sk.id] ? String(slot.skills[sk.id]) : "";
  });
  var legacy = !unitSkills(unit).length && slot && slot.skill ? String(slot.skill) : "";
  var loaner = 0, tardy = 0, custom = {}, behavior = {};
  if (slot) {
    Object.keys(slot.days || {}).forEach(function(d) {
      if (!reportDayOn(d, when, day)) return;
      var rec = slot.days[d] || {};
      if (rec.loaner) loaner++;
      if (rec.tardy) tardy++;
      if (rec.behavior) behavior[rec.behavior] = (behavior[rec.behavior] || 0) + 1;
      if (!rec.x) return;
      Object.keys(rec.x).forEach(function(id) { if (rec.x[id]) custom[id] = (custom[id] || 0) + 1; });
    });
  }
  return { skills: skills, legacy: legacy, loaner: loaner, tardy: tardy, custom: custom, behavior: behavior };
}
function behaviorSummary(counts) {
  var parts = [];
  MARK_BEHAVIORS.forEach(function(b) { if (counts[b.id]) parts.push(counts[b.id] + " " + b.name); });
  Object.keys(counts).forEach(function(id) {
    var known = false;
    MARK_BEHAVIORS.forEach(function(b) { if (b.id === id) known = true; });
    if (!known && counts[id]) parts.push(counts[id] + " " + id);
  });
  return parts.join(", ");
}
function buildMarkReport(people, unit, when, day) {
  var kinds = currentCatalog().kinds || [];
  var skills = unitSkills(unit);
  var rows = (people || []).map(function(s) {
    return { student: s, facts: studentMarkFacts(s, unit, when, day) };
  });
  var summary = { skills: {}, legacy: 0, loaner: 0, tardy: 0, custom: {}, behavior: {}, rated: 0 };
  skills.forEach(function(sk) { summary.skills[sk.id] = { "1": 0, "2": 0, "3": 0, "4": 0, set: 0 }; });
  rows.forEach(function(row) {
    var facts = row.facts;
    var any = false;
    skills.forEach(function(sk) {
      var v = facts.skills[sk.id];
      if (v !== "1" && v !== "2" && v !== "3" && v !== "4") return;
      summary.skills[sk.id][v]++;
      summary.skills[sk.id].set++;
      any = true;
    });
    if (facts.legacy) { summary.legacy++; any = true; }
    summary.loaner += facts.loaner;
    summary.tardy += facts.tardy;
    if (facts.loaner || facts.tardy) any = true;
    Object.keys(facts.custom).forEach(function(id) {
      summary.custom[id] = (summary.custom[id] || 0) + facts.custom[id];
      any = true;
    });
    Object.keys(facts.behavior).forEach(function(id) {
      summary.behavior[id] = (summary.behavior[id] || 0) + facts.behavior[id];
      any = true;
    });
    if (any) summary.rated++;
  });
  return { rows: rows, summary: summary, skills: skills, kinds: kinds };
}
function reportSelect(el, options, preferred) {
  if (!el) return "";
  var keep = el.dataset.picked ? el.value : (preferred || el.value);
  el.dataset.picked = "1";
  el.innerHTML = options.map(function(opt) {
    return '<option value="' + escHtml(opt.value) + '">' + escHtml(opt.label) + "</option>";
  }).join("");
  var found = false;
  for (var i = 0; i < options.length; i++) if (options[i].value === keep) found = true;
  el.value = found ? keep : (options[0] ? options[0].value : "");
  return el.value;
}
function renderMarkReport() {
  var summaryEl = document.getElementById("marks-report-summary");
  var tableEl = document.getElementById("marks-report-table");
  if (!summaryEl || !tableEl) return;
  scanCatalog();
  var cat = currentCatalog();
  var period = reportSelect(document.getElementById("marks-report-period"), [{ value: "all", label: "All periods" }].concat(markPeriods().map(function(p) {
    return { value: p, label: "Period " + p };
  })), markPeriod);
  var unit = null;
  var unitId = reportSelect(document.getElementById("marks-report-unit"), cat.units.map(function(u) {
    return { value: u.id, label: u.name };
  }), markUnitId);
  for (var i = 0; i < cat.units.length; i++) if (cat.units[i].id === unitId) unit = cat.units[i];
  var whenEl = document.getElementById("marks-report-when");
  var when = whenEl && whenEl.value === "day" ? "day" : "unit";
  var dateEl = document.getElementById("marks-report-date");
  if (dateEl && !dateEl.value) dateEl.value = isoToday();
  var day = dateEl && dateEl.value ? dateEl.value : isoToday();
  var query = String((document.getElementById("marks-report-search") || {}).value || "").trim().toLowerCase();
  if (!unit) {
    summaryEl.innerHTML = "";
    tableEl.innerHTML = '<div class="mark-intro">Add a sport on the Marks tab, then rate students. This report counts those saved marks.</div>';
    return;
  }
  var people = (typeof allStudents === "function" ? allStudents() : []).filter(function(s) {
    if (period !== "all" && String(s.period) !== String(period)) return false;
    if (!query) return true;
    var blob = (markFirstName(s) + " " + (s.last || "") + " " + (s.nickname || "")).toLowerCase();
    return blob.indexOf(query) !== -1;
  });
  people.sort(compareByFirstName);
  var report = buildMarkReport(people, unit, when, day);
  var cards = [];
  report.skills.forEach(function(sk) {
    var bag = report.summary.skills[sk.id];
    cards.push('<div class="mark-stat"><div class="n">' + bag.set + '</div><div class="l">' + escHtml(sk.name) + " rated</div><div class=\"l\">" +
      bag["1"] + " Beginning · " + bag["2"] + " Developing · " + bag["3"] + " Proficient · " + bag["4"] + " Advanced</div></div>");
  });
  if (!report.skills.length) {
    cards.push('<div class="mark-stat"><div class="n">' + report.summary.legacy + '</div><div class="l">Skill level set</div></div>');
  }
  cards.push('<div class="mark-stat"><div class="n">' + report.summary.tardy + '</div><div class="l">Tardies</div></div>');
  cards.push('<div class="mark-stat"><div class="n">' + report.summary.loaner + '</div><div class="l">Loaner clothes</div></div>');
  report.kinds.forEach(function(k) {
    cards.push('<div class="mark-stat"><div class="n">' + (report.summary.custom[k.id] || 0) + '</div><div class="l">' + escHtml(k.name) + "</div></div>");
  });
  MARK_BEHAVIORS.forEach(function(b) {
    if (!report.summary.behavior[b.id]) return;
    cards.push('<div class="mark-stat"><div class="n">' + report.summary.behavior[b.id] + '</div><div class="l">' + escHtml(b.name) + "</div></div>");
  });
  summaryEl.innerHTML = cards.join("");
  var head = "<th>Student</th><th>Period</th>";
  report.skills.forEach(function(sk) { head += "<th>" + escHtml(sk.name) + "</th>"; });
  if (!report.skills.length) head += "<th>Skill level</th>";
  head += "<th>Tardies</th><th>Loaner</th>";
  report.kinds.forEach(function(k) { head += "<th>" + escHtml(k.name) + "</th>"; });
  head += "<th>Behavior</th>";
  var body = report.rows.map(function(row) {
    var s = row.student;
    var facts = row.facts;
    var cells = "<td>" + escHtml((markBigName(s) + " " + String(s.last || "")).trim()) + "</td><td>" + escHtml(String(s.period == null ? "" : s.period)) + "</td>";
    report.skills.forEach(function(sk) {
      var v = facts.skills[sk.id];
      cells += "<td>" + (v ? escHtml(v + " " + levelName(v)) : "—") + "</td>";
    });
    if (!report.skills.length) cells += "<td>" + (facts.legacy ? escHtml(facts.legacy + " " + levelName(facts.legacy)) : "—") + "</td>";
    cells += "<td>" + facts.tardy + "</td><td>" + facts.loaner + "</td>";
    report.kinds.forEach(function(k) { cells += "<td>" + (facts.custom[k.id] || 0) + "</td>"; });
    cells += "<td>" + escHtml(behaviorSummary(facts.behavior) || "—") + "</td>";
    return "<tr>" + cells + "</tr>";
  }).join("");
  tableEl.innerHTML = people.length
    ? "<table><thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table>"
    : '<div class="mark-intro">No students match that period or search.</div>';
}
function chooseSport(value) {
  var v = String(value || "");
  if (v.indexOf("unit:") === 0) {
    markUnitId = v.slice(5);
    markFocus = "";
    currentTool();
    rememberSession();
    renderMarkChrome();
    renderMarkPads();
    return;
  }
  if (v.indexOf("sport:") === 0) addSportUnit(v.slice(6));
}
function onMarksChange(e) {
  var t = e.target;
  if (!t) return;
  if (t.id === "marks-sports") chooseSport(t.value);
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
  var report = document.getElementById("pane-report");
  if (report && !report.dataset.bound) {
    report.dataset.bound = "1";
    ["marks-report-period", "marks-report-unit", "marks-report-when", "marks-report-date"].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("change", function() { renderMarkReport(); });
    });
    var reportSearch = document.getElementById("marks-report-search");
    if (reportSearch) reportSearch.addEventListener("input", function() { renderMarkReport(); });
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

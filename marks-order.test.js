var fs = require("fs");
var vm = require("vm");

var failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures += 1;
    console.error("FAIL:", msg);
  }
}

function classList() {
  var names = {};
  return {
    add: function (c) { names[c] = true; },
    remove: function (c) { delete names[c]; },
    contains: function (c) { return !!names[c]; },
    toggle: function (c, on) {
      if (arguments.length < 2) on = !names[c];
      if (on) names[c] = true;
      else delete names[c];
    }
  };
}
function makeEl(tag) {
  var attrs = {};
  return {
    tagName: tag || "DIV",
    classList: classList(),
    dataset: {},
    innerHTML: "",
    textContent: "",
    value: "",
    style: {},
    addEventListener: function () {},
    contains: function () { return false; },
    scrollIntoView: function () {},
    querySelectorAll: function () { return []; },
    setAttribute: function (k, v) { attrs[k] = String(v); },
    getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
    hasAttribute: function (k) { return Object.prototype.hasOwnProperty.call(attrs, k); },
    focus: function () {}
  };
}
var els = {};
function el(id) {
  if (!els[id]) els[id] = makeEl(id === "marks-date" || id.indexOf("name") >= 0 ? "INPUT" : "DIV");
  return els[id];
}
["pane-marks", "marks-board", "marks-periods", "marks-grid", "marks-dock", "marks-summary", "marks-alpha", "marks-hint", "marks-alert", "marks-search", "marks-date", "marks-units", "marks-kinds", "marks-sports", "marks-period-label", "marks-order-mark", "marks-order-student", "roster-launch"].forEach(el);
els["marks-date"].value = "2026-11-19";

var people = [{
  id: "s1", first: "Ana", last: "Lee", period: "1", gender: "F", teacher_id: "t1", goals: {}
}];
var saved = {};
var context = {
  console: console,
  document: {
    getElementById: function (id) { return els[id] || null; },
    activeElement: { tagName: "DIV" }
  },
  sessionStorage: {
    setItem: function (k, v) { saved[k] = v; },
    getItem: function (k) { return saved[k] || null; }
  },
  escHtml: function (s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  },
  alertEl: function () {},
  genderKey: function (g) { return g === "F" ? "F" : g === "M" ? "M" : ""; },
  genderShort: function (g) { return g || ""; },
  allStudents: function () { return people; },
  ownerId: function () { return "t1"; },
  sb: {
    from: function () {
      return {
        select: function () {
          return { eq: function () { return Promise.resolve({ data: [{ goals: JSON.parse(JSON.stringify(people[0].goals || {})) }] }); } };
        },
        update: function (patch) {
          return { eq: function () {
            if (patch && patch.goals) people[0].goals = patch.goals;
            return Promise.resolve({ error: null });
          } };
        }
      };
    }
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname + "/marks.js", "utf8"), context);

context.rememberCatalog({
  v: 1,
  units: [{ id: "uball", name: "Basketball", skills: [
    { id: "dribble", name: "Dribbling" },
    { id: "pass", name: "Passing" },
    { id: "shoot", name: "Shooting" }
  ]}],
  kinds: []
});
context.markPeriod = "1";
context.markUnitId = "uball";
context.markKind = "loaner";
context.markOrder = "student";
context.tapStudent("s1");

var vs = people[0].goals.__vs || { marks: {} };
var day = (((vs.marks || {}).uball || {}).days || {})["2026-11-19"] || {};
assert(!day.loaner, "name first does not mark loaner before a mark is chosen");
var dock = els["marks-dock"].innerHTML;
assert(dock.indexOf("Dribbling") >= 0 && dock.indexOf("Passing") >= 0 && dock.indexOf("Shooting") >= 0, "student dock lists every skill");
assert(dock.indexOf('data-skill="pass"') >= 0, "level buttons name the skill");
assert(dock.indexOf('data-act="flag"') >= 0 && dock.indexOf('data-kind="loaner"') >= 0, "daily marks are choices");
assert(context.markFocus === "s1", "the tapped student stays open");

context.onMarksClick({ target: { closest: function () {
  return {
    getAttribute: function (k) { return { "data-act": "level", "data-level": "3", "data-skill": "pass" }[k] || null; },
    hasAttribute: function (k) { return k === "data-skill"; }
  };
} } });
vs = people[0].goals.__vs;
assert(vs.marks.uball.skills.pass === "3", "choosing a level after the name sets that skill");
assert(!vs.marks.uball.skills.dribble, "other skills stay blank");

context.onMarksClick({ target: { closest: function () {
  return {
    getAttribute: function (k) { return { "data-act": "flag", "data-kind": "tardy" }[k] || null; },
    hasAttribute: function () { return false; }
  };
} } });
vs = people[0].goals.__vs;
day = (((vs.marks || {}).uball || {}).days || {})["2026-11-19"] || {};
assert(day.tardy === true && !day.loaner, "a daily mark can be chosen after the name, got " + JSON.stringify(day));

context.markOrder = "mark";
context.markKind = "loaner";
context.markFocus = "";
context.tapStudent("s1");
day = people[0].goals.__vs.marks.uball.days["2026-11-19"];
assert(day.loaner === true, "mark-first still toggles the selected daily mark");
var oneSkill = els["marks-dock"].innerHTML;
assert(oneSkill.indexOf("Passing") < 0, "mark-first dock stays on the selected mark");

if (failures) {
  console.error(failures + " failed");
  process.exit(1);
}
console.log("marks order tests passed");

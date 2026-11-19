var T = require("./team-draw.js");

var failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures += 1;
    console.error("FAIL:", msg);
  }
}

function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function kids(specs) {
  return specs.map(function (s, i) {
    return {
      id: s.id || String(i),
      name: s.name || ("P" + i),
      gender: s.gender || "U",
      strength: s.strength
    };
  });
}

function range(n, gender, start) {
  var list = [];
  for (var i = 0; i < n; i++) {
    list.push({ id: gender + i, name: gender + i, gender: gender, strength: (start || n) - i });
  }
  return list;
}

function ids(result) {
  var seen = [];
  result.sections.forEach(function (section) {
    section.teams.forEach(function (team) {
      team.forEach(function (p) { seen.push(p.id); });
    });
  });
  return seen;
}

function eff(p) {
  return p.strength == null || isNaN(Number(p.strength)) ? 5.5 : Number(p.strength);
}

assert(T.scaleAsset(10, 0, 10, false) === 10, "best higher mark is 10");
assert(T.scaleAsset(0, 0, 10, false) === 1, "worst higher mark is 1");
assert(T.scaleAsset(0, 0, 10, true) === 10, "best lower mark is 10");
assert(T.scaleAsset(10, 0, 10, true) === 1, "worst lower mark is 1");
assert(T.scaleAsset(null, 0, 10, false) == null, "blank mark has no asset");
assert(T.overallAsset([10, 4]) === 7, "overall asset averages skills");
assert(T.overallAsset([]) == null, "no skills means no asset");

var twelve = range(12, "M");
var snake = T.makeDraw(twelve, { split: "teams", count: 3, skillMode: "balance", genderMode: "off" }, mulberry32(1));
assert(snake.ok, "snake draw ok");
var sums = snake.sections[0].teams.map(function (team) {
  return team.reduce(function (s, p) { return s + p.strength; }, 0);
});
assert(sums.join(",") === "26,26,26", "snake totals match, got " + sums.join(","));

var grouped = T.makeDraw(range(8, "F"), { split: "teams", count: 2, skillMode: "group", genderMode: "off" }, mulberry32(2));
var g0 = grouped.sections[0].teams[0].map(eff).sort(function (a, b) { return b - a; });
var g1 = grouped.sections[0].teams[1].map(eff).sort(function (a, b) { return b - a; });
assert(Math.min.apply(null, g0) >= Math.max.apply(null, g1), "ability groups stay in order");

var mixed = range(4, "M").concat(range(4, "F"));
var both = T.makeDraw(mixed, { split: "teams", count: 2, skillMode: "group", genderMode: "balance" }, mulberry32(3));
both.sections[0].teams.forEach(function (team, i) {
  var m = team.filter(function (p) { return p.gender === "M"; }).length;
  var f = team.filter(function (p) { return p.gender === "F"; }).length;
  assert(m === 2 && f === 2, "team " + i + " gender mix " + m + "/" + f);
});
var high = T.assetAverage(both.sections[0].teams[0]);
var low = T.assetAverage(both.sections[0].teams[1]);
assert(high > low, "high ability team stays ahead " + high + " vs " + low);

var separated = T.makeDraw(range(10, "M").concat(range(8, "F")), {
  split: "teams", count: 4, skillMode: "off", genderMode: "group"
}, mulberry32(4));
assert(separated.ok, "gender groups ok");
var teamCount = 0;
separated.sections.forEach(function (section) {
  section.teams.forEach(function (team) {
    teamCount += 1;
    var genders = {};
    team.forEach(function (p) { genders[p.gender] = true; });
    assert(Object.keys(genders).length === 1, "same-gender team");
  });
});
assert(teamCount === 4, "four separate teams, got " + teamCount);

var sized = T.makeDraw(range(6, "M").concat(range(5, "F")), {
  split: "size", count: 4, skillMode: "balance", genderMode: "group"
}, mulberry32(5));
assert(sized.ok, "size by gender ok");
sized.sections.forEach(function (section) {
  section.teams.forEach(function (team) {
    assert(team.length <= 4, "team respects size cap when the gender is large enough");
  });
});

var blanks = kids([
  { gender: "M", strength: 10 },
  { gender: "M", strength: 9 },
  { gender: "M", strength: null },
  { gender: "M", strength: null },
  { gender: "M", strength: 2 },
  { gender: "M", strength: 1 }
]);
var mid = T.makeDraw(blanks, { split: "teams", count: 2, skillMode: "group", genderMode: "off" }, mulberry32(6));
var flat = [];
mid.sections[0].teams.forEach(function (team) { team.forEach(function (p) { flat.push(eff(p)); }); });
for (var i = 1; i < flat.length; i++) assert(flat[i] <= flat[i - 1] + 1e-9, "blanks land in the middle");

var fair = T.makeDraw(range(6, "M", 6).concat(range(6, "F", 6)), {
  split: "teams", count: 3, skillMode: "balance", genderMode: "balance"
}, mulberry32(7));
fair.sections[0].teams.forEach(function (team) {
  assert(team.filter(function (p) { return p.gender === "M"; }).length === 2, "two boys");
  assert(team.filter(function (p) { return p.gender === "F"; }).length === 2, "two girls");
});

var levels = kids([
  { gender: "M", strength: 4 },
  { gender: "M", strength: 3 },
  { gender: "F", strength: null },
  { gender: "F", strength: 1 }
]);
var sport = T.makeDraw(levels, { split: "teams", count: 2, skillMode: "group", genderMode: "off", blank: 2.5 }, mulberry32(8));
var sportFlat = [];
sport.sections[0].teams.forEach(function (team) { team.forEach(function (p) { sportFlat.push(p.strength == null ? 2.5 : p.strength); }); });
assert(sportFlat.join(",") === "4,3,2.5,1", "blank sport mark counts as 2.5, got " + sportFlat.join(","));

assert(!T.planTeams([{ gender: "M" }], { split: "teams", count: 2 }).ok, "one student fails");
assert(!T.planTeams(range(4, "M"), { split: "teams", count: 1 }).ok, "one team fails");
assert(!T.planTeams(range(4, "M"), { split: "size", count: 4 }).ok, "team size must leave 2 teams");
assert(!T.makeDraw(range(3, "M").concat(range(3, "F")).concat(range(1, "X")), {
  split: "teams", count: 2, genderMode: "group", skillMode: "off"
}).ok, "same-gender needs a team per gender");

for (var trial = 0; trial < 80; trial++) {
  var rnd = mulberry32(1000 + trial);
  var n = 2 + Math.floor(rnd() * 24);
  var players = [];
  for (var p = 0; p < n; p++) {
    var roll = rnd();
    var g = roll < 0.46 ? "M" : roll < 0.9 ? "F" : (roll < 0.97 ? "X" : "U");
    players.push({
      id: "s" + trial + "-" + p,
      name: "N" + p,
      gender: g,
      strength: rnd() < 0.12 ? null : Math.round(rnd() * 90) / 10 + 1
    });
  }
  var modes = ["off", "group", "balance"];
  modes.forEach(function (skillMode) {
    modes.forEach(function (genderMode) {
      var count = 2 + Math.floor(rnd() * Math.min(6, n - 1));
      var result = T.makeDraw(players, {
        split: "teams",
        count: count,
        skillMode: skillMode,
        genderMode: genderMode
      }, rnd);
      var label = trial + " " + skillMode + "/" + genderMode + " n=" + n + " teams=" + count;
      if (!result.ok) {
        if (genderMode === "group") return;
        assert(false, label + " " + result.error);
        return;
      }
      var got = ids(result).sort();
      var want = players.map(function (pl) { return pl.id; }).sort();
      assert(got.join() === want.join(), label + " lost a student");
      var sizes = [];
      result.sections.forEach(function (section) {
        section.teams.forEach(function (team) {
          sizes.push(team.length);
          if (genderMode === "group") {
            var set = {};
            team.forEach(function (pl) { set[pl.gender] = true; });
            assert(Object.keys(set).length === 1, label + " mixed gender");
          }
        });
      });
      if (genderMode === "balance") {
        var tally = {};
        players.forEach(function (pl) { tally[pl.gender] = (tally[pl.gender] || 0) + 1; });
        Object.keys(tally).forEach(function (g) {
          var per = [];
          result.sections[0].teams.forEach(function (team) {
            per.push(team.filter(function (pl) { return pl.gender === g; }).length);
          });
          var spread = Math.max.apply(null, per) - Math.min.apply(null, per);
          assert(spread <= 1, label + " gender " + g + " spread " + spread);
        });
      }
    });
  });
}

if (failures) {
  console.error(failures + " failed");
  process.exit(1);
}
console.log("team-draw tests passed");

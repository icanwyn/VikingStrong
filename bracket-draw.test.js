var B = require("./bracket-draw.js");

var failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures += 1;
    console.error("FAIL:", msg);
  }
}

function teams(specs) {
  return specs.map(function (spec, i) {
    if (typeof spec === "string") return { id: spec, name: spec, strength: null };
    return {
      id: spec.id || ("t" + i),
      name: spec.name || spec.id || ("t" + i),
      strength: spec.strength,
      members: spec.members || []
    };
  });
}

function pairKey(match) {
  return [match.a.id, match.b.id].sort().join("-");
}

function playFavorites(list, format) {
  var built = B.buildBracket(list, { format: format, bySkill: false, groups: 1 });
  assert(built.ok, built.error || "build");
  var results = {};
  var view = null;
  for (var guard = 0; guard < 300; guard++) {
    view = B.viewBracket(built, results);
    if (view.championId) return view;
    var ready = view.matches.filter(function (match) { return !match.hidden && match.status === "ready"; });
    if (!ready.length) return view;
    ready.forEach(function (match) {
      results[match.id] = match.a.seed <= match.b.seed ? match.a.id : match.b.id;
    });
  }
  return view;
}

assert(B.seedPositions(8).join(",") === "1,8,4,5,2,7,3,6", "seed positions");

var eight = teams(["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"]);
var single8 = B.buildBracket(eight, { format: "single", bySkill: false });
var first = B.viewBracket(single8, {}).matches.filter(function (match) {
  return match.side === "winners" && match.round === 1;
});
assert(first.map(pairKey).join(",") === "P1-P8,P4-P5,P2-P7,P3-P6", "single 8 pairings " + first.map(pairKey).join(","));

var five = teams(["P1", "P2", "P3", "P4", "P5"]);
var single5 = B.viewBracket(B.buildBracket(five, { format: "single" }), {});
var byeNames = single5.matches.filter(function (match) { return match.status === "bye" && match.winnerId; })
  .map(function (match) { return match.winnerId; }).sort();
assert(byeNames.join(",") === "P1,P2,P3", "top seeds get byes, got " + byeNames.join(","));
var live = single5.matches.filter(function (match) { return match.status === "ready"; }).map(pairKey).sort();
assert(live.join(",") === "P2-P3,P4-P5", "4 vs 5 plays, and the bye winners meet, got " + live.join(","));

[2, 3, 4, 5, 6, 7, 8, 10, 12, 16].forEach(function (count) {
  var list = [];
  for (var i = 1; i <= count; i++) list.push("P" + i);
  var view = playFavorites(teams(list), "single");
  assert(view.championId === "P1", "single " + count + " champion " + view.championId);
  var played = view.matches.filter(function (match) { return match.status === "done"; }).length;
  assert(played === count - 1, "single " + count + " played " + played);
});

[4, 8, 16].forEach(function (count) {
  var list = [];
  for (var i = 1; i <= count; i++) list.push("P" + i);
  var nodes = B.buildBracket(teams(list), { format: "double" }).nodes;
  assert(nodes.filter(function (node) { return node.side === "winners"; }).length === count - 1, "winners games " + count);
  assert(nodes.filter(function (node) { return node.side === "losers"; }).length === count - 2, "losers games " + count);
  assert(nodes.filter(function (node) { return node.side === "grand"; }).length === 1, "grand");
  assert(nodes.filter(function (node) { return node.side === "reset"; }).length === 1, "reset node");
});

[3, 4, 5, 6, 7, 8, 9, 12, 16].forEach(function (count) {
  var list = [];
  for (var i = 1; i <= count; i++) list.push("P" + i);
  var view = playFavorites(teams(list), "double");
  assert(view.championId === "P1", "double " + count + " champion " + view.championId);
  var reset = view.matches.filter(function (match) { return match.side === "reset"; })[0];
  assert(reset && reset.hidden, "double " + count + " hides the extra final");
});

var built4 = B.buildBracket(teams(["P1", "P2", "P3", "P4"]), { format: "double" });
var results = {};
function readyIds() {
  return B.viewBracket(built4, results).matches
    .filter(function (match) { return !match.hidden && match.status === "ready"; })
    .map(pairKey).sort();
}
function play(a, b, winner) {
  var match = B.viewBracket(built4, results).matches.filter(function (item) {
    return !item.hidden && item.status === "ready" && pairKey(item) === [a, b].sort().join("-");
  })[0];
  assert(!!match, "missing " + a + " vs " + b);
  results[match.id] = winner;
}
assert(readyIds().join(",") === "P1-P4,P2-P3", "double openers");
play("P1", "P4", "P1");
play("P2", "P3", "P2");
assert(readyIds().join(",") === "P1-P2,P3-P4", "winners final and losers opener");
play("P1", "P2", "P2");
play("P3", "P4", "P4");
assert(readyIds().join(",") === "P1-P4", "losers final is the dropped winner vs losers");
play("P1", "P4", "P1");
assert(readyIds().join(",") === "P1-P2", "championship");
play("P1", "P2", "P1");
var afterUpset = B.viewBracket(built4, results);
var resetShown = afterUpset.matches.filter(function (match) { return match.side === "reset"; })[0];
assert(resetShown && !resetShown.hidden && resetShown.status === "ready", "reset appears when the losers side wins the final");
assert(readyIds().join(",") === "P1-P2", "reset is the only game left");
play("P1", "P2", "P1");
assert(B.viewBracket(built4, results).championId === "P1", "reset winner is champion");

assert(!B.buildBracket(teams(["A", "B"]), { format: "double" }).ok, "double needs 3");

[2, 3, 4, 5, 6, 7, 8, 10].forEach(function (count) {
  var list = [];
  for (var i = 1; i <= count; i++) list.push("T" + i);
  var view = B.viewBracket(B.buildBracket(teams(list), { format: "robin", groups: 1 }), {});
  var games = view.matches.filter(function (match) { return match.side === "robin"; });
  var pairs = {};
  games.forEach(function (match) { pairs[pairKey(match)] = (pairs[pairKey(match)] || 0) + 1; });
  assert(Object.keys(pairs).length === count * (count - 1) / 2, "robin " + count + " pair count");
  assert(Object.keys(pairs).every(function (key) { return pairs[key] === 1; }), "robin " + count + " pairs once");
  view.groups[0].robin.forEach(function (round) {
    var seen = {};
    round.matches.forEach(function (match) {
      assert(!seen[match.a.id] && !seen[match.b.id], "robin " + count + " double booked");
      seen[match.a.id] = true;
      seen[match.b.id] = true;
    });
    var byeCount = count - Object.keys(seen).length;
    assert(byeCount === (count % 2 === 1 ? 1 : 0), "robin " + count + " byes " + byeCount);
  });
});

var skilled = teams([
  { id: "low", name: "Otters", strength: 1.2 },
  { id: "top", name: "Ravens", strength: 3.8 },
  { id: "mid", name: "Wolves", strength: 2.4 },
  { id: "high", name: "Bears", strength: 3.1 },
  { id: "tie", name: "Hawks", strength: 3.1 },
  { id: "blank", name: "Pines", strength: null }
]);
var skillBracket = B.buildBracket(skilled, { format: "single", bySkill: true });
assert(skillBracket.groups[0].entrants.map(function (team) { return team.id; }).join(",") === "top,high,tie,mid,low,blank",
  "skill seeds keep draw order on a tie");
assert(skillBracket.note.indexOf("Seed 1 is the strongest") >= 0, "seed note");

var pools = B.buildBracket(skilled, { format: "robin", groups: 2, bySkill: true });
assert(pools.groups.map(function (group) { return group.entrants.map(function (team) { return team.id; }).join("-"); }).join("|") === "top-high-tie|mid-low-blank",
  "skill groups are contiguous bands");
assert(pools.note.indexOf("Group A is the strongest") >= 0, "group note");

var plain = B.buildBracket(skilled, { format: "robin", groups: 2, bySkill: false });
assert(plain.groups[0].entrants.map(function (team) { return team.id; }).join("-") === "low-top-mid", "no-skill groups follow draw order");

var tooMany = B.buildBracket(teams(["A", "B", "C", "D", "E"]), { format: "robin", groups: 3 });
assert(!tooMany.ok && tooMany.error.indexOf("at least 2") >= 0, "group size guard");

var oneGroup = B.buildBracket(eight, { format: "robin", groups: 1, bySkill: true });
assert(oneGroup.groups.length === 1 && oneGroup.groups[0].name === "", "one group has no group label");

var scored = B.buildBracket(teams(["A", "B", "C"]), { format: "robin", groups: 1 });
var robinView = B.viewBracket(scored, {});
var firstGame = robinView.matches[0];
var robinResults = {};
robinResults[firstGame.id] = firstGame.a.id;
var table = B.viewBracket(scored, robinResults).groups[0].standings;
assert(table[0].wins >= table[1].wins, "standings sort by wins");
assert(table.filter(function (row) { return row.id === firstGame.a.id; })[0].wins === 1, "winner gets a win");
assert(table.filter(function (row) { return row.id === firstGame.b.id; })[0].losses === 1, "loser gets a loss");

if (failures) {
  console.error(failures + " failed");
  process.exit(1);
}
console.log("bracket-draw tests passed");

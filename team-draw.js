/* Random teams for VikingStrong.
   Skill "group" keeps similar assets together. Skill "balance" snakes assets
   so team totals stay close. Gender "group" keeps each gender on its own teams.
   Gender "balance" spreads each gender across the teams.
   A blank asset is treated as 5.5. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VikingTeams = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var BLANK = 5.5;
  var NAMES = ["Ravens", "Wolves", "Bears", "Stags", "Foxes", "Hawks", "Boars", "Lynx", "Otters", "Eagles", "Rams", "Seals", "Falcons", "Badgers", "Herons", "Pines"];

  function whole(n) {
    return typeof n === "number" && isFinite(n) && Math.floor(n) === n;
  }

  function planSplit(playerCount, mode, count) {
    if (playerCount < 2) return { ok: false, error: "Need at least 2 students." };
    if (!whole(count)) return { ok: false, error: "Use a whole number." };
    var teamCount;
    if (mode === "teams") {
      if (count < 2) return { ok: false, error: "Enter at least 2 teams." };
      if (count > playerCount) return { ok: false, error: "You can't have more teams than students." };
      teamCount = count;
    } else {
      if (count < 2) return { ok: false, error: "Enter at least 2 students on each team." };
      if (count >= playerCount) {
        return { ok: false, error: "Students per team has to be smaller than the class so you get at least 2 teams." };
      }
      teamCount = Math.ceil(playerCount / count);
    }
    return {
      ok: true,
      teamCount: teamCount,
      minSize: Math.floor(playerCount / teamCount),
      maxSize: Math.ceil(playerCount / teamCount)
    };
  }

  function describePlan(playerCount, plan) {
    if (!plan.ok) return plan.error;
    var teams = plan.teamCount === 1 ? "1 team" : plan.teamCount + " teams";
    if (plan.minSize === plan.maxSize) {
      var each = plan.maxSize === 1 ? "1 student" : plan.maxSize + " students";
      return playerCount + " students will be split into " + teams + " of " + each + ".";
    }
    return playerCount + " students will be split into " + teams + " of " + plan.maxSize + " or " + plan.minSize + ".";
  }

  function scaleAsset(raw, min, max, lowerBetter) {
    if (raw == null || raw === "" || isNaN(Number(raw))) return null;
    var n = Number(raw);
    if (min == null || max == null || Number(max) === Number(min)) return 10;
    var t = lowerBetter ? (Number(max) - n) / (Number(max) - Number(min)) : (n - Number(min)) / (Number(max) - Number(min));
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return Math.round((1 + t * 9) * 10) / 10;
  }

  function overallAsset(parts) {
    var nums = [];
    (parts || []).forEach(function (n) {
      if (n != null && !isNaN(Number(n))) nums.push(Number(n));
    });
    if (!nums.length) return null;
    var sum = 0;
    nums.forEach(function (n) { sum += n; });
    return Math.round((sum / nums.length) * 10) / 10;
  }

  function fillBlank(settings) {
    var n = settings && Number(settings.blank);
    return isFinite(n) ? n : BLANK;
  }

  function effective(p, blank) {
    if (!p || p.strength == null || isNaN(Number(p.strength))) return blank == null ? BLANK : blank;
    return Number(p.strength);
  }

  function assetAverage(players, blank) {
    if (!players || !players.length) return null;
    var fill = blank == null ? BLANK : blank;
    var sum = 0;
    players.forEach(function (p) { sum += effective(p, fill); });
    return Math.round((sum / players.length) * 10) / 10;
  }

  function shuffle(items, random) {
    var next = items.slice();
    for (var i = next.length - 1; i > 0; i--) {
      var j = Math.min(i, Math.floor(random() * (i + 1)));
      var cur = next[i];
      next[i] = next[j];
      next[j] = cur;
    }
    return next;
  }

  function quotas(count, teamCount, fromEnd) {
    var base = Math.floor(count / teamCount);
    var extra = count % teamCount;
    var amounts = [];
    var order = [];
    var i;
    for (i = 0; i < teamCount; i++) amounts.push(base);
    for (i = 0; i < teamCount; i++) order.push(fromEnd ? teamCount - 1 - i : i);
    for (i = 0; i < order.length; i++) {
      if (extra === 0) break;
      amounts[order[i]] += 1;
      extra -= 1;
    }
    return amounts;
  }

  function sortByStrength(players, random, blank) {
    var fill = blank == null ? BLANK : blank;
    var decorated = shuffle(players, random).map(function (p, i) {
      return { p: p, s: effective(p, fill), i: i };
    });
    decorated.sort(function (a, b) {
      if (b.s !== a.s) return b.s - a.s;
      return a.i - b.i;
    });
    return decorated.map(function (d) { return d.p; });
  }

  function genderRank(g) {
    if (g === "M") return "0";
    if (g === "F") return "1";
    if (g === "U" || !g) return "3";
    return "2" + g;
  }

  function genderKeys(players) {
    var seen = {};
    var keys = [];
    players.forEach(function (p) {
      var g = p.gender || "U";
      if (!seen[g]) {
        seen[g] = true;
        keys.push(g);
      }
    });
    keys.sort(function (a, b) {
      if (genderRank(a) < genderRank(b)) return -1;
      if (genderRank(a) > genderRank(b)) return 1;
      return 0;
    });
    return keys;
  }

  function emptyTeams(teamCount) {
    var teams = [];
    for (var i = 0; i < teamCount; i++) teams.push([]);
    return teams;
  }

  function visitTeams(teamCount, fromEnd) {
    var forward = !fromEnd;
    function rowFor(dir) {
      var row = [];
      for (var i = 0; i < teamCount; i++) row.push(dir ? i : teamCount - 1 - i);
      return row;
    }
    var row = rowFor(forward);
    var cursor = 0;
    return function () {
      var team = row[cursor] || 0;
      cursor += 1;
      if (cursor >= row.length) {
        forward = !forward;
        row = rowFor(forward);
        cursor = 0;
      }
      return team;
    };
  }

  function dealGroup(players, teams, fromEnd, bySkill, random, blank) {
    if (!players.length || !teams.length) return;
    var limits = quotas(players.length, teams.length, fromEnd);
    var ordered = bySkill ? sortByStrength(players, random, blank) : shuffle(players, random);
    var filled = [];
    var t;
    for (t = 0; t < teams.length; t++) filled.push(0);
    var visit = visitTeams(teams.length, fromEnd);
    var placed = 0;
    var guard = 0;
    var cap = ordered.length * teams.length * 2 + 4;
    while (placed < ordered.length && guard < cap) {
      guard += 1;
      var teamIndex = visit();
      if (filled[teamIndex] < limits[teamIndex]) {
        teams[teamIndex].push(ordered[placed]);
        filled[teamIndex] += 1;
        placed += 1;
      }
    }
    if (placed !== ordered.length) throw new Error("Could not place every student.");
  }

  function dealEven(players, teams, random) {
    shuffle(players, random).forEach(function (p, i) {
      teams[i % teams.length].push(p);
    });
  }

  function dealContiguous(players, teams, random, blank) {
    var ordered = sortByStrength(players, random, blank);
    var limits = quotas(ordered.length, teams.length, false);
    var cursor = 0;
    for (var t = 0; t < teams.length; t++) {
      for (var j = 0; j < limits[t]; j++) teams[t].push(ordered[cursor++]);
    }
  }

  function spreadRow(count, teamSizes) {
    var teamCount = teamSizes.length;
    var base = Math.floor(count / teamCount);
    var extra = count % teamCount;
    var order = [];
    var i;
    for (i = 0; i < teamCount; i++) order.push(i);
    order.sort(function (a, b) {
      if (teamSizes[b] !== teamSizes[a]) return teamSizes[b] - teamSizes[a];
      return a - b;
    });
    var row = [];
    for (i = 0; i < teamCount; i++) row.push(base);
    for (i = 0; i < extra; i++) row[order[i]] += 1;
    return row;
  }

  function colSum(matrix, team) {
    var sum = 0;
    for (var g = 0; g < matrix.length; g++) sum += matrix[g][team];
    return sum;
  }

  function balancedMatrix(genderCounts, teamSizes) {
    var matrix = genderCounts.map(function (count) { return spreadRow(count, teamSizes); });
    var teamCount = teamSizes.length;
    var guard = 0;
    var limit = genderCounts.length * teamCount * 8 + 8;
    while (guard++ < limit) {
      var over = -1;
      var under = -1;
      var t;
      for (t = 0; t < teamCount; t++) {
        var sum = colSum(matrix, t);
        if (sum > teamSizes[t] && over < 0) over = t;
        if (sum < teamSizes[t] && under < 0) under = t;
      }
      if (over < 0 && under < 0) return matrix;
      if (over < 0 || under < 0) throw new Error("Could not balance team sizes.");
      var best = -1;
      var bestScore = -1;
      for (var g = 0; g < matrix.length; g++) {
        if (matrix[g][over] <= matrix[g][under]) continue;
        var score = matrix[g][over] - matrix[g][under];
        if (score > bestScore) {
          bestScore = score;
          best = g;
        }
      }
      if (best < 0) {
        for (g = 0; g < matrix.length; g++) {
          if (matrix[g][over] > 0) { best = g; break; }
        }
      }
      if (best < 0) throw new Error("Could not balance team sizes.");
      matrix[best][over] -= 1;
      matrix[best][under] += 1;
    }
    throw new Error("Could not balance team sizes.");
  }

  function drawSkillGroups(players, teamCount, balanceGender, random, blank) {
    var teams = emptyTeams(teamCount);
    if (!balanceGender) {
      dealContiguous(players, teams, random, blank);
      return teams;
    }
    var keys = genderKeys(players);
    var counts = keys.map(function (k) {
      return players.filter(function (p) { return (p.gender || "U") === k; }).length;
    });
    var teamSizes = quotas(players.length, teamCount, false);
    var matrix = balancedMatrix(counts, teamSizes);
    keys.forEach(function (k, gi) {
      var sorted = sortByStrength(players.filter(function (p) { return (p.gender || "U") === k; }), random, blank);
      var cursor = 0;
      for (var t = 0; t < teamCount; t++) {
        for (var j = 0; j < matrix[gi][t]; j++) {
          if (cursor >= sorted.length) throw new Error("Could not place every student.");
          teams[t].push(sorted[cursor++]);
        }
      }
      if (cursor !== sorted.length) throw new Error("Could not place every student.");
    });
    return teams;
  }

  function drawTeams(players, teamCount, options, random) {
    random = random || Math.random;
    options = options || {};
    var skillMode = options.skillMode || "off";
    var genderMode = options.genderMode || "off";
    var blank = options.blank == null ? BLANK : options.blank;
    if (teamCount < 1 || teamCount > players.length) throw new Error("Team count is out of range.");
    if (teamCount === 1) return [players.slice()];
    var teams = emptyTeams(teamCount);
    if (genderMode === "balance") {
      if (skillMode === "group") return drawSkillGroups(players, teamCount, true, random, blank);
      genderKeys(players).forEach(function (g, i) {
        dealGroup(
          players.filter(function (p) { return (p.gender || "U") === g; }),
          teams,
          i % 2 === 1,
          skillMode === "balance",
          random,
          blank
        );
      });
      return teams;
    }
    if (skillMode === "group") return drawSkillGroups(players, teamCount, false, random, blank);
    if (skillMode === "balance") {
      dealGroup(players, teams, false, true, random, blank);
      return teams;
    }
    dealEven(players, teams, random);
    return teams;
  }

  function teamsForSize(playerCount, size) {
    if (playerCount <= 0) return 0;
    if (playerCount === 1) return 1;
    return Math.ceil(playerCount / size);
  }

  function allocateSeparate(groupSizes, teamCount) {
    var n = groupSizes.length;
    var total = 0;
    var i;
    for (i = 0; i < n; i++) total += groupSizes[i];
    if (!n) return { ok: false, error: "No students." };
    if (teamCount < n) {
      return { ok: false, error: "Same-gender teams need at least one team for each gender (" + n + ")." };
    }
    if (teamCount > total) return { ok: false, error: "That is more teams than students." };
    var assigned = [];
    for (i = 0; i < n; i++) assigned.push(1);
    var left = teamCount - n;
    var guard = 0;
    while (left > 0 && guard++ < 10000) {
      var best = -1;
      var bestScore = -1;
      for (i = 0; i < n; i++) {
        if (assigned[i] >= groupSizes[i]) continue;
        var score = groupSizes[i] / assigned[i];
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      }
      if (best < 0) return { ok: false, error: "Not enough students to make that many separate teams." };
      assigned[best] += 1;
      left -= 1;
    }
    return { ok: true, counts: assigned };
  }

  function buckets(players) {
    return genderKeys(players).map(function (k) {
      return {
        key: k,
        players: players.filter(function (p) { return (p.gender || "U") === k; })
      };
    });
  }

  function sectionPlan(title, count, teamCount) {
    return {
      title: title,
      count: count,
      teamCount: teamCount,
      min: Math.floor(count / teamCount),
      max: Math.ceil(count / teamCount)
    };
  }

  function planTeams(players, settings) {
    settings = settings || {};
    var list = players || [];
    var count = settings.count;
    if (!whole(count)) return { ok: false, error: "Use a whole number." };
    if (list.length < 2) return { ok: false, error: "Need at least 2 students." };
    if (settings.genderMode === "group" && settings.split === "size") {
      if (count < 2) return { ok: false, error: "Enter at least 2 students on each team." };
      var sized = buckets(list).map(function (b) {
        return sectionPlan(b.key, b.players.length, teamsForSize(b.players.length, count));
      }).filter(function (s) { return s.teamCount > 0; });
      var totalTeams = 0;
      sized.forEach(function (s) { totalTeams += s.teamCount; });
      if (totalTeams < 2) return { ok: false, error: "That team size makes only one team." };
      return { ok: true, sections: sized };
    }
    var plan = planSplit(list.length, settings.split === "size" ? "perTeam" : "teams", count);
    if (!plan.ok) return plan;
    if (settings.genderMode === "group") {
      var groups = buckets(list);
      var alloc = allocateSeparate(groups.map(function (b) { return b.players.length; }), plan.teamCount);
      if (!alloc.ok) return alloc;
      return {
        ok: true,
        sections: groups.map(function (b, i) {
          return sectionPlan(b.key, b.players.length, alloc.counts[i]);
        })
      };
    }
    return {
      ok: true,
      teamCount: plan.teamCount,
      minSize: plan.minSize,
      maxSize: plan.maxSize,
      text: describePlan(list.length, plan)
    };
  }

  function makeDraw(players, settings, random) {
    var plan = planTeams(players, settings);
    if (!plan.ok) return plan;
    random = random || Math.random;
    var skillMode = settings.skillMode || "off";
    var blank = fillBlank(settings);
    var drawOptions = function (genderMode) {
      return { skillMode: skillMode, genderMode: genderMode, blank: blank };
    };
    if (plan.sections) {
      return {
        ok: true,
        sections: plan.sections.map(function (s) {
          var subset = (players || []).filter(function (p) { return (p.gender || "U") === s.title; });
          return {
            title: s.title,
            teams: drawTeams(subset, s.teamCount, drawOptions("off"), random)
          };
        })
      };
    }
    return {
      ok: true,
      sections: [{
        title: "",
        teams: drawTeams(players, plan.teamCount, drawOptions(settings.genderMode === "balance" ? "balance" : "off"), random)
      }]
    };
  }

  function optionNotes(settings, players) {
    settings = settings || {};
    var notes = [];
    if (settings.skillMode === "group") notes.push("Similar marks stay together.");
    else if (settings.skillMode === "balance") notes.push("Marks are mixed so each team has a similar asset.");
    else if (settings.genderMode !== "balance" && settings.genderMode !== "group") notes.push("Students are shuffled.");
    if (settings.genderMode === "group") notes.push("Each gender stays on its own teams.");
    else if (settings.genderMode === "balance") notes.push("Each team gets a similar number of each gender.");
    var unmarked = 0;
    (players || []).forEach(function (p) {
      if (p.strength == null || isNaN(Number(p.strength))) unmarked += 1;
    });
    if (settings.skillMode && settings.skillMode !== "off") {
      var fill = fillBlank(settings);
      if (unmarked === (players || []).length) notes.push("No marks yet, so this draw is a shuffle.");
      else if (unmarked) notes.push(unmarked + (unmarked === 1 ? " student has" : " students have") + " no mark and " + (unmarked === 1 ? "counts" : "count") + " as " + fill + ".");
    }
    return notes;
  }

  return {
    BLANK: BLANK,
    NAMES: NAMES,
    planSplit: planSplit,
    describePlan: describePlan,
    scaleAsset: scaleAsset,
    overallAsset: overallAsset,
    assetAverage: assetAverage,
    fillBlank: fillBlank,
    planTeams: planTeams,
    makeDraw: makeDraw,
    optionNotes: optionNotes,
    drawTeams: drawTeams,
    allocateSeparate: allocateSeparate
  };
});

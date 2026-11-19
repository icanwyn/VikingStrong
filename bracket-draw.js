/* Brackets for a VikingStrong team draw.
   Single elimination and double elimination seed the field.
   Round robin can split the field into groups.
   Skill order puts the strongest team at seed 1 and fills Group A first.
   A blank strength is left unseeded by skill; the caller fills blanks earlier. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VikingBrackets = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function whole(n) {
    return typeof n === "number" && isFinite(n) && Math.floor(n) === n;
  }

  function nextPowerOfTwo(count) {
    var size = 1;
    while (size < count) size *= 2;
    return size;
  }

  /* 8 → [1, 8, 4, 5, 2, 7, 3, 6]. Seed 1 meets seed 2 in the final. */
  function seedPositions(size) {
    var slots = [1];
    while (slots.length < size) {
      var sum = slots.length * 2 + 1;
      var next = [];
      for (var i = 0; i < slots.length; i++) next.push(slots[i], sum - slots[i]);
      slots = next;
    }
    return slots;
  }

  function winnerRoundTitle(round, totalRounds, matchCount) {
    var fromEnd = totalRounds - round;
    if (fromEnd === 0) return "Final";
    if (fromEnd === 1) return "Semifinals";
    if (fromEnd === 2) return "Quarterfinals";
    return "Round of " + (matchCount * 2);
  }

  function groupName(index) {
    var name = "";
    var n = index;
    do {
      name = String.fromCharCode(65 + (n % 26)) + name;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return "Group " + name;
  }

  function assignSeeds(teams, bySkill) {
    var indexed = (teams || []).map(function (team, order) {
      var strength = team && team.strength != null && team.strength !== "" ? Number(team.strength) : null;
      if (strength != null && !isFinite(strength)) strength = null;
      return {
        id: String(team && team.id != null ? team.id : order),
        name: String(team && team.name ? team.name : ("Team " + (order + 1))),
        strength: strength,
        members: team && Array.isArray(team.members) ? team.members.map(function (m) { return String(m); }) : [],
        order: order
      };
    });
    var seen = {};
    for (var i = 0; i < indexed.length; i++) {
      if (seen[indexed[i].id]) return { ok: false, error: "Each team needs its own id." };
      seen[indexed[i].id] = true;
    }
    var ranked = indexed.slice();
    if (bySkill) {
      ranked.sort(function (a, b) {
        var as = a.strength == null ? -Infinity : a.strength;
        var bs = b.strength == null ? -Infinity : b.strength;
        if (bs !== as) return bs - as;
        return a.order - b.order;
      });
    }
    return {
      ok: true,
      entrants: ranked.map(function (team, index) {
        return {
          id: team.id,
          name: team.name,
          strength: team.strength,
          members: team.members,
          seed: index + 1
        };
      })
    };
  }

  function splitGroups(entrants, groupCount) {
    var count = entrants.length;
    var groups = Math.max(1, groupCount);
    var base = Math.floor(count / groups);
    var extra = count % groups;
    var out = [];
    var cursor = 0;
    for (var i = 0; i < groups; i++) {
      var size = base + (i < extra ? 1 : 0);
      out.push({
        name: groups === 1 ? "" : groupName(i),
        entrants: entrants.slice(cursor, cursor + size)
      });
      cursor += size;
    }
    return out;
  }

  function labelRow(nodes) {
    var multi = nodes.length > 1;
    nodes.forEach(function (node, index) {
      node.label = multi ? (node.title + " " + (index + 1)) : node.title;
    });
  }

  function makeNode(id, fields) {
    var node = {
      id: id,
      side: fields.side,
      group: fields.group || 0,
      round: fields.round,
      index: fields.index,
      title: fields.title,
      label: fields.title,
      feeds: fields.feeds || { a: null, b: null },
      seeds: fields.seeds || { a: null, b: null },
      hints: fields.hints || { a: null, b: null }
    };
    return node;
  }

  function circleRobin(ids, group, nextId) {
    var row = ids.slice();
    if (row.length < 2) return [];
    if (row.length % 2 === 1) row.push(null);
    var width = row.length;
    var half = width / 2;
    var nodes = [];
    for (var round = 0; round < width - 1; round++) {
      var rowNodes = [];
      for (var i = 0; i < half; i++) {
        var a = row[i];
        var b = row[width - 1 - i];
        if (!a || !b) continue;
        rowNodes.push(makeNode(nextId(), {
          side: "robin",
          group: group,
          round: round + 1,
          index: rowNodes.length,
          title: "Round " + (round + 1),
          seeds: { a: a, b: b }
        }));
      }
      labelRow(rowNodes);
      nodes = nodes.concat(rowNodes);
      var fixed = row[0];
      var rest = row.slice(1);
      rest.unshift(rest.pop());
      row = [fixed].concat(rest);
    }
    return nodes;
  }

  function buildElimination(format, entrants, nextId) {
    var fieldCount = entrants.length;
    var size = nextPowerOfTwo(Math.max(fieldCount, 2));
    var rounds = Math.log(size) / Math.log(2);
    var positions = seedPositions(size);
    var bySeed = {};
    entrants.forEach(function (team) { bySeed[team.seed] = team.id; });
    function seedOf(seed) { return seed <= fieldCount ? (bySeed[seed] || null) : null; }

    var winners = [];
    var first = [];
    var firstTitle = winnerRoundTitle(1, rounds, size / 2);
    for (var i = 0; i < size / 2; i++) {
      var hintA = positions[i * 2];
      var hintB = positions[i * 2 + 1];
      first.push(makeNode(nextId(), {
        side: "winners",
        round: 1,
        index: i,
        title: firstTitle,
        seeds: { a: seedOf(hintA), b: seedOf(hintB) },
        hints: { a: hintA <= fieldCount ? hintA : null, b: hintB <= fieldCount ? hintB : null }
      }));
    }
    labelRow(first);
    winners.push(first);

    for (var round = 2; round <= rounds; round++) {
      var prev = winners[round - 2];
      var row = [];
      var title = winnerRoundTitle(round, rounds, prev.length / 2);
      for (var m = 0; m < prev.length / 2; m++) {
        row.push(makeNode(nextId(), {
          side: "winners",
          round: round,
          index: m,
          title: title,
          feeds: {
            a: { matchId: prev[m * 2].id, outcome: "winner" },
            b: { matchId: prev[m * 2 + 1].id, outcome: "winner" }
          }
        }));
      }
      labelRow(row);
      winners.push(row);
    }

    if (format === "single") return winners.reduce(function (all, row) { return all.concat(row); }, []);

    var loserRounds = (rounds - 1) * 2;
    var losers = [];
    for (var lr = 1; lr <= loserRounds; lr++) {
      var pair = Math.floor((lr - 1) / 2);
      var count = size / Math.pow(2, pair + 2);
      var loserRow = [];
      var loserTitle = lr === loserRounds ? "Losers final" : ("Losers round " + lr);
      for (var li = 0; li < count; li++) {
        loserRow.push(makeNode(nextId(), {
          side: "losers",
          round: lr,
          index: li,
          title: loserTitle
        }));
      }
      labelRow(loserRow);
      losers.push(loserRow);
    }

    var opener = losers[0];
    for (var oi = 0; oi < opener.length; oi++) {
      opener[oi].feeds = {
        a: { matchId: winners[0][oi * 2].id, outcome: "loser" },
        b: { matchId: winners[0][oi * 2 + 1].id, outcome: "loser" }
      };
    }

    for (var lround = 2; lround <= loserRounds; lround++) {
      var current = losers[lround - 1];
      var previous = losers[lround - 2];
      if (lround % 2 === 0) {
        var winnersRound = winners[lround / 2];
        for (var di = 0; di < current.length; di++) {
          var drop = winnersRound.length - 1 - di;
          current[di].feeds = {
            a: { matchId: previous[di].id, outcome: "winner" },
            b: { matchId: winnersRound[drop].id, outcome: "loser" }
          };
        }
      } else {
        for (var ci = 0; ci < current.length; ci++) {
          current[ci].feeds = {
            a: { matchId: previous[ci * 2].id, outcome: "winner" },
            b: { matchId: previous[ci * 2 + 1].id, outcome: "winner" }
          };
        }
      }
    }

    var lastWinners = winners[winners.length - 1][0];
    var lastLosers = losers[losers.length - 1][0];
    var championship = makeNode(nextId(), {
      side: "grand",
      round: 1,
      index: 0,
      title: "Championship",
      feeds: {
        a: { matchId: lastWinners.id, outcome: "winner" },
        b: { matchId: lastLosers.id, outcome: "winner" }
      }
    });
    championship.label = "Championship";
    var reset = makeNode(nextId(), {
      side: "reset",
      round: 1,
      index: 0,
      title: "Championship (if needed)"
    });
    reset.label = "Championship (if needed)";

    return winners.reduce(function (all, row) { return all.concat(row); }, [])
      .concat(losers.reduce(function (all, row) { return all.concat(row); }, []))
      .concat([championship, reset]);
  }

  function noteFor(format, bySkill, groupCount, fieldCount) {
    if (format === "robin") {
      if (groupCount === 1) {
        return bySkill
          ? "One group. Every team plays every other team, strongest listed first."
          : "One group. Every team plays every other team.";
      }
      return bySkill
        ? (groupCount + " groups by skill average. Group A is the strongest band.")
        : (groupCount + " groups in the order the teams were drawn.");
    }
    var seed = bySkill
      ? "Seeded by skill average. Seed 1 is the strongest team."
      : "Seeded in the order the teams were drawn. Seed 1 is the first team.";
    var bye = fieldCount > 1 && nextPowerOfTwo(fieldCount) !== fieldCount ? " Byes go to the top seeds." : "";
    if (format === "double") {
      return seed + bye + " A team is out after two losses. If the losers-bracket winner takes the championship, they play one more game.";
    }
    return seed + bye;
  }

  function buildBracket(teams, options) {
    options = options || {};
    var format = options.format || "single";
    if (format !== "single" && format !== "double" && format !== "robin") {
      return { ok: false, error: "Pick single elimination, double elimination, or round robin." };
    }
    var seeded = assignSeeds(teams, !!options.bySkill);
    if (!seeded.ok) return seeded;
    var entrants = seeded.entrants;
    if (entrants.length < 2) return { ok: false, error: "Need at least 2 teams." };
    if (format === "double" && entrants.length < 3) {
      return { ok: false, error: "Double elimination needs at least 3 teams." };
    }

    var groupCount = 1;
    if (format === "robin") {
      var rawGroups = options.groups == null || options.groups === "" ? 1 : Number(options.groups);
      if (!whole(rawGroups)) return { ok: false, error: "Use a whole number of groups." };
      if (rawGroups < 1) return { ok: false, error: "Enter at least 1 group." };
      var maxGroups = Math.floor(entrants.length / 2);
      if (rawGroups > maxGroups) {
        var most = maxGroups === 1 ? "1 group" : (maxGroups + " groups");
        return {
          ok: false,
          error: "Each group needs at least 2 teams. " + most + " is the most for " + entrants.length + " teams."
        };
      }
      groupCount = rawGroups;
    }

    var groups = format === "robin"
      ? splitGroups(entrants, groupCount)
      : [{ name: "", entrants: entrants }];
    var seq = 0;
    function nextId() { seq += 1; return "m" + seq; }
    var nodes = [];
    if (format === "robin") {
      groups.forEach(function (group, index) {
        nodes = nodes.concat(circleRobin(group.entrants.map(function (team) { return team.id; }), index, nextId));
      });
    } else {
      nodes = buildElimination(format, entrants, nextId);
    }

    return {
      ok: true,
      format: format,
      bySkill: !!options.bySkill,
      note: noteFor(format, !!options.bySkill, groupCount, entrants.length),
      groups: groups,
      nodes: nodes
    };
  }

  function emptySlot(bye) {
    return { id: null, name: bye ? "Bye" : "", seed: null, bye: !!bye, pending: bye ? "" : "Waiting" };
  }

  function personSlot(person) {
    return { id: person.id, name: person.name, seed: person.seed, bye: false, pending: "" };
  }

  function applyOutcome(match, result) {
    var aId = match.a.id;
    var bId = match.b.id;
    var aWait = !aId && !match.a.bye;
    var bWait = !bId && !match.b.bye;
    match.winnerId = null;
    match.loserId = null;
    match.skip = false;
    if (aWait || bWait) { match.status = "open"; return; }
    if (match.a.bye && match.b.bye) { match.status = "bye"; match.skip = true; return; }
    if (match.a.bye && bId) { match.status = "bye"; match.winnerId = bId; return; }
    if (match.b.bye && aId) { match.status = "bye"; match.winnerId = aId; return; }
    if (!aId || !bId) { match.status = "open"; return; }
    match.status = "ready";
    if (result !== aId && result !== bId) return;
    match.status = "done";
    match.winnerId = result;
    match.loserId = result === aId ? bId : aId;
  }

  function resolveFeed(feed, seedId, people, byId) {
    if (!feed) {
      if (seedId && people[seedId]) return personSlot(people[seedId]);
      return emptySlot(true);
    }
    var source = byId[feed.matchId];
    if (!source) return emptySlot(false);
    if (source.status === "done" || source.status === "bye") {
      if (feed.outcome === "winner") {
        if (source.winnerId && people[source.winnerId]) return personSlot(people[source.winnerId]);
        return emptySlot(true);
      }
      if (source.status === "bye" || !source.loserId || !people[source.loserId]) return emptySlot(true);
      return personSlot(people[source.loserId]);
    }
    var who = feed.outcome === "winner" ? "Winner" : "Loser";
    return { id: null, name: "", seed: null, bye: false, pending: who + " of " + source.label };
  }

  function packRounds(matches, side) {
    var map = {};
    var order = [];
    matches.forEach(function (match) {
      if (match.side !== side || match.hidden || match.skip) return;
      if (!map[match.round]) { map[match.round] = []; order.push(match.round); }
      map[match.round].push(match);
    });
    order.sort(function (a, b) { return a - b; });
    return order.map(function (round) {
      var list = map[round].slice().sort(function (a, b) { return a.index - b.index; });
      return { title: list[0].title, matches: list };
    }).filter(function (round) { return round.matches.length; });
  }

  function robinRounds(entrants, matches) {
    var mine = matches.filter(function (match) { return match.side === "robin" && !match.skip; });
    var max = 0;
    mine.forEach(function (match) { if (match.round > max) max = match.round; });
    var rounds = [];
    for (var round = 1; round <= max; round++) {
      var list = mine.filter(function (match) { return match.round === round; })
        .sort(function (a, b) { return a.index - b.index; });
      var busy = {};
      list.forEach(function (match) {
        if (match.a.id) busy[match.a.id] = true;
        if (match.b.id) busy[match.b.id] = true;
      });
      rounds.push({
        title: "Round " + round,
        matches: list,
        byes: entrants.filter(function (team) { return !busy[team.id]; })
      });
    }
    return rounds;
  }

  function standingsFor(entrants, matches) {
    var rows = {};
    entrants.forEach(function (team) {
      rows[team.id] = {
        id: team.id, name: team.name, seed: team.seed, strength: team.strength,
        wins: 0, losses: 0, played: 0
      };
    });
    matches.forEach(function (match) {
      if (match.side !== "robin" || match.status !== "done" || !match.winnerId) return;
      var loserId = match.winnerId === match.a.id ? match.b.id : match.a.id;
      if (!rows[match.winnerId] || !rows[loserId]) return;
      rows[match.winnerId].wins += 1;
      rows[match.winnerId].played += 1;
      rows[loserId].losses += 1;
      rows[loserId].played += 1;
    });
    var list = Object.keys(rows).map(function (id) { return rows[id]; });
    list.sort(function (a, b) {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return a.seed - b.seed;
    });
    var rank = 1;
    list.forEach(function (row, index) {
      if (index > 0 && (row.wins !== list[index - 1].wins || row.losses !== list[index - 1].losses)) rank = index + 1;
      row.rank = rank;
    });
    return list;
  }

  function viewBracket(built, results) {
    results = results || {};
    var people = {};
    (built.groups || []).forEach(function (group) {
      group.entrants.forEach(function (team) { people[team.id] = team; });
    });
    var byId = {};
    var matches = [];
    (built.nodes || []).forEach(function (node) {
      if (node.side === "reset") return;
      var match = {
        id: node.id, side: node.side, group: node.group, round: node.round, index: node.index,
        title: node.title, label: node.label, hidden: false, skip: false,
        a: resolveFeed(node.feeds.a, node.seeds.a, people, byId),
        b: resolveFeed(node.feeds.b, node.seeds.b, people, byId)
      };
      applyOutcome(match, results[node.id]);
      byId[node.id] = match;
      matches.push(match);
    });

    var grand = matches.filter(function (match) { return match.side === "grand"; })[0] || null;
    var resetNode = (built.nodes || []).filter(function (node) { return node.side === "reset"; })[0] || null;
    if (resetNode) {
      var reset = {
        id: resetNode.id, side: "reset", group: resetNode.group, round: 1, index: 0,
        title: resetNode.title, label: resetNode.label, hidden: true, skip: false,
        a: emptySlot(false), b: emptySlot(false), status: "open", winnerId: null, loserId: null
      };
      var losersWon = grand && grand.status === "done" && grand.winnerId && grand.winnerId === grand.b.id;
      if (losersWon) {
        reset.hidden = false;
        reset.a = personSlot(people[grand.winnerId]);
        reset.b = personSlot(people[grand.loserId]);
        applyOutcome(reset, results[resetNode.id]);
      }
      byId[reset.id] = reset;
      matches.push(reset);
    }

    var championId = null;
    if (built.format === "single") {
      var finals = matches.filter(function (match) { return match.side === "winners"; })
        .sort(function (a, b) { return a.round - b.round || a.index - b.index; });
      var finalMatch = finals[finals.length - 1];
      if (finalMatch && (finalMatch.status === "done" || finalMatch.status === "bye")) championId = finalMatch.winnerId;
    } else if (built.format === "double" && grand) {
      var resetMatch = matches.filter(function (match) { return match.side === "reset"; })[0];
      if (resetMatch && !resetMatch.hidden && (resetMatch.status === "done" || resetMatch.status === "bye")) {
        championId = resetMatch.winnerId;
      } else if (grand.status === "done" && grand.winnerId && grand.winnerId === grand.a.id) {
        championId = grand.winnerId;
      }
    }

    var groups = (built.groups || []).map(function (group, index) {
      var mine = matches.filter(function (match) { return match.group === index; });
      var standings = built.format === "robin" ? standingsFor(group.entrants, mine) : [];
      return {
        name: group.name,
        entrants: group.entrants,
        winners: packRounds(mine, "winners"),
        losers: packRounds(mine, "losers"),
        championship: mine.filter(function (match) {
          return (match.side === "grand" || match.side === "reset") && !match.hidden && !match.skip;
        }),
        robin: built.format === "robin" ? robinRounds(group.entrants, mine) : [],
        standings: standings,
        leaders: standings.filter(function (row) { return row.rank === 1 && row.played > 0; })
      };
    });

    return {
      format: built.format,
      bySkill: built.bySkill,
      note: built.note,
      championId: championId,
      championName: championId && people[championId] ? people[championId].name : "",
      groups: groups,
      matches: matches
    };
  }

  return {
    nextPowerOfTwo: nextPowerOfTwo,
    seedPositions: seedPositions,
    assignSeeds: assignSeeds,
    buildBracket: buildBracket,
    viewBracket: viewBracket
  };
});

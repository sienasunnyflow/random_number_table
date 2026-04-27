const STORAGE_KEY = "tennis-random-table-state-v4";
const GENDERS = {
  male: "男性",
  female: "女性",
  other: "その他",
};
const TEAMS = {
  A: "Aチーム",
  B: "Bチーム",
};

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const elements = {
  courtCount: document.querySelector("#courtCount"),
  playerCount: document.querySelector("#playerCount"),
  hours: document.querySelector("#hours"),
  matchMinutes: document.querySelector("#matchMinutes"),
  scheduleMode: document.querySelector("#scheduleMode"),
  matchPreference: document.querySelector("#matchPreference"),
  allowBreakFixedPairs: document.querySelector("#allowBreakFixedPairs"),
  teamSettings: document.querySelector("#teamSettings"),
  teamAName: document.querySelector("#teamAName"),
  teamBName: document.querySelector("#teamBName"),
  teamACount: document.querySelector("#teamACount"),
  teamBCount: document.querySelector("#teamBCount"),
  playersList: document.querySelector("#playersList"),
  generateButton: document.querySelector("#generateButton"),
  sampleButton: document.querySelector("#sampleButton"),
  clearButton: document.querySelector("#clearButton"),
  message: document.querySelector("#message"),
  summaryPanel: document.querySelector("#summaryPanel"),
  summaryCards: document.querySelector("#summaryCards"),
  statsBody: document.querySelector("#statsBody"),
  schedulePanel: document.querySelector("#schedulePanel"),
  schedule: document.querySelector("#schedule"),
  rankingPanel: document.querySelector("#rankingPanel"),
  teamRanking: document.querySelector("#teamRanking"),
  rankingBody: document.querySelector("#rankingBody"),
};

let state = loadState();
let currentSchedule = null;

function loadState() {
  const fallback = {
    settings: {
      courtCount: 1,
      playerCount: 4,
      hours: 2,
      matchMinutes: 20,
      scheduleMode: "practice",
      matchPreference: "balanced",
      allowBreakFixedPairs: true,
      teamNames: {
        A: "Aチーム",
        B: "Bチーム",
      },
      teamCounts: {
        A: 2,
        B: 2,
      },
    },
    players: createPlayers(4),
    results: {},
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.players)) {
      return fallback;
    }

    return {
      settings: { ...fallback.settings, ...saved.settings },
      players: saved.players.slice(0, 24).map((player, index) => ({
        id: player.id || createId(),
        name: player.name || `参加者${index + 1}`,
        gender: GENDERS[player.gender] ? player.gender : "other",
        team: TEAMS[player.team] ? player.team : index % 2 === 0 ? "A" : "B",
        fixedPairId: player.fixedPairId || "",
      })),
      results: saved.results || {},
    };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createPlayers(count, startIndex = 0) {
  return Array.from({ length: count }, (_, index) => {
    const number = startIndex + index + 1;
    return {
      id: createId(),
      name: `参加者${number}`,
      gender: number % 2 === 0 ? "female" : "male",
      team: number % 2 === 0 ? "B" : "A",
      fixedPairId: "",
    };
  });
}

function applyStateToControls() {
  elements.courtCount.value = String(state.settings.courtCount);
  updatePlayerCountOptions(false, state.settings.courtCount);
  elements.playerCount.value = String(state.settings.playerCount);
  elements.hours.value = String(state.settings.hours);
  elements.matchMinutes.value = String(state.settings.matchMinutes);
  elements.scheduleMode.value = state.settings.scheduleMode;
  elements.matchPreference.value = state.settings.matchPreference;
  elements.allowBreakFixedPairs.checked = Boolean(state.settings.allowBreakFixedPairs);
  elements.teamAName.value = state.settings.teamNames.A;
  elements.teamBName.value = state.settings.teamNames.B;
  renderTeamCountOptions();
  elements.teamSettings.classList.toggle("hidden", state.settings.scheduleMode !== "team");
}

function readSettings() {
  const courtCount = clamp(Number(elements.courtCount.value), 1, 4);
  updatePlayerCountOptions(false, courtCount);
  const playerCount = getAllowedPlayerCount(courtCount, Number(elements.playerCount.value));
  const teamCounts = normalizeTeamCounts(
    playerCount,
    Number(elements.teamACount.value),
    Number(elements.teamBCount.value),
  );
  const settings = {
    courtCount,
    playerCount,
    hours: clamp(Number(elements.hours.value), 2, 8),
    matchMinutes: Number(elements.matchMinutes.value),
    scheduleMode: elements.scheduleMode.value,
    matchPreference: elements.matchPreference.value,
    allowBreakFixedPairs: elements.allowBreakFixedPairs.checked,
    teamNames: {
      A: elements.teamAName.value.trim() || "Aチーム",
      B: elements.teamBName.value.trim() || "Bチーム",
    },
    teamCounts,
  };

  state.settings = settings;
  assignTeamsByCounts();
  applyStateToControls();
  saveState();
  return settings;
}

function getPlayerCountOptions(courtCount) {
  const min = courtCount * 4;
  return Array.from({ length: 24 - min + 1 }, (_, index) => min + index);
}

function getAllowedPlayerCount(courtCount, value) {
  const options = getPlayerCountOptions(courtCount);
  if (options.includes(value)) {
    return value;
  }
  return options[0];
}

function updatePlayerCountOptions(shouldRenderPlayers = true, courtCount = Number(elements.courtCount.value)) {
  const currentValue = Number(elements.playerCount.value || state.settings.playerCount);
  const options = getPlayerCountOptions(clamp(courtCount, 1, 4));
  const nextValue = options.includes(currentValue) ? currentValue : options[0];

  elements.playerCount.innerHTML = options
    .map((count) => `<option value="${count}" ${count === nextValue ? "selected" : ""}>${count}人</option>`)
    .join("");

  if (state.settings) {
    state.settings.playerCount = nextValue;
  }

  if (shouldRenderPlayers) {
    resizePlayers(nextValue);
    assignTeamsByCounts();
    renderPlayers();
  }
}

function normalizeTeamCounts(total, preferredA, preferredB) {
  let teamA = Number.isFinite(preferredA) && preferredA > 0 ? Math.floor(preferredA) : Math.ceil(total / 2);
  let teamB = Number.isFinite(preferredB) && preferredB > 0 ? Math.floor(preferredB) : total - teamA;

  if (teamA + teamB !== total) {
    teamB = total - teamA;
  }

  if (teamA < 2) {
    teamA = 2;
    teamB = total - teamA;
  }

  if (teamB < 2) {
    teamB = 2;
    teamA = total - teamB;
  }

  return { A: teamA, B: teamB };
}

function renderTeamCountOptions() {
  const total = state.settings.playerCount;
  const min = 2;
  const max = total - min;
  const currentA = clamp(state.settings.teamCounts.A, min, max);
  const currentB = total - currentA;

  elements.teamACount.innerHTML = Array.from({ length: max - min + 1 }, (_, index) => min + index)
    .map((count) => `<option value="${count}" ${count === currentA ? "selected" : ""}>${count}人</option>`)
    .join("");
  elements.teamBCount.innerHTML = Array.from({ length: max - min + 1 }, (_, index) => min + index)
    .map((count) => `<option value="${count}" ${count === currentB ? "selected" : ""}>${count}人</option>`)
    .join("");

  state.settings.teamCounts = { A: currentA, B: currentB };
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function resizePlayers(nextCount) {
  if (state.players.length > nextCount) {
    state.players = state.players.slice(0, nextCount);
  }

  if (state.players.length < nextCount) {
    state.players.push(...createPlayers(nextCount - state.players.length, state.players.length));
  }

  assignTeamsByCounts();
  clearInvalidFixedPairs();
}

function assignTeamsByCounts() {
  const teamACount = state.settings.teamCounts?.A ?? Math.ceil(state.players.length / 2);
  state.players.forEach((player, index) => {
    player.team = index < teamACount ? "A" : "B";
  });
}

function clearInvalidFixedPairs() {
  const playerIds = new Set(state.players.map((player) => player.id));
  state.players.forEach((player) => {
    if (player.fixedPairId && !playerIds.has(player.fixedPairId)) {
      player.fixedPairId = "";
    }
  });
}

function renderPlayers() {
  const rows = state.players.map((player, index) => renderPlayerRow(player, index));

  if (state.settings.scheduleMode === "team") {
    const teamAPlayers = state.players
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => player.team === "A");
    const teamBPlayers = state.players
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => player.team === "B");

    elements.playersList.classList.add("team-players-list");
    elements.playersList.innerHTML = `
      <section class="team-player-column">
        <h3>${escapeHtml(getTeamName("A"))} <span>${teamAPlayers.length}人</span></h3>
        <div class="team-player-rows">
          ${teamAPlayers.map(({ player, index }) => renderPlayerRow(player, index)).join("")}
        </div>
      </section>
      <section class="team-player-column">
        <h3>${escapeHtml(getTeamName("B"))} <span>${teamBPlayers.length}人</span></h3>
        <div class="team-player-rows">
          ${teamBPlayers.map(({ player, index }) => renderPlayerRow(player, index)).join("")}
        </div>
      </section>
    `;
    return;
  }

  elements.playersList.classList.remove("team-players-list");
  elements.playersList.innerHTML = rows.join("");
}

function renderPlayerRow(player, index) {
  return `
        <div class="player-row">
          <label>
            名前 ${index + 1}
            <input data-index="${index}" data-field="name" value="${escapeAttribute(player.name)}" />
          </label>
          <label>
            性別
            <select data-index="${index}" data-field="gender">
              ${Object.entries(GENDERS)
                .map(
                  ([value, label]) =>
                    `<option value="${value}" ${player.gender === value ? "selected" : ""}>${label}</option>`,
                )
                .join("")}
            </select>
          </label>
          <label>
            固定ペア
            <select data-index="${index}" data-field="fixedPairId">
              <option value="">指定なし</option>
              ${state.players
                .filter((candidate) => candidate.id !== player.id)
                .map(
                  (candidate) =>
                    `<option value="${candidate.id}" ${
                      player.fixedPairId === candidate.id ? "selected" : ""
                    }>${escapeHtml(candidate.name)}</option>`,
                )
                .join("")}
            </select>
          </label>
        </div>
      `;
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function setMessage(text, isError = false) {
  elements.message.textContent = text;
  elements.message.classList.toggle("error", isError);
}

function getTeamName(teamKey) {
  return state.settings.teamNames?.[teamKey] || TEAMS[teamKey];
}

function fillSamplePlayers() {
  const maleNames = [
    "佐藤",
    "鈴木",
    "高橋",
    "田中",
    "伊藤",
    "渡辺",
    "山本",
    "中村",
    "小林",
    "加藤",
    "吉田",
    "山田",
  ];
  const femaleNames = [
    "斎藤",
    "松本",
    "井上",
    "木村",
    "林",
    "清水",
    "山崎",
    "森",
    "池田",
    "橋本",
    "石川",
    "前田",
  ];

  state.settings.playerCount = 24;
  state.settings.teamCounts = { A: 12, B: 12 };
  state.players = Array.from({ length: 24 }, (_, index) => {
    const isMale = index % 2 === 0;
    const names = isMale ? maleNames : femaleNames;
    return {
      id: createId(),
      name: names[Math.floor(index / 2)],
      gender: isMale ? "male" : "female",
      team: index < 12 ? "A" : "B",
      fixedPairId: "",
    };
  });

  applyStateToControls();
  renderPlayers();
  saveState();
  setMessage("24人のサンプル参加者を入力しました。");
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
  state = {
    settings: {
      courtCount: 1,
      playerCount: 4,
      hours: 2,
      matchMinutes: 20,
      scheduleMode: "practice",
      matchPreference: "balanced",
      allowBreakFixedPairs: true,
      teamNames: {
        A: "Aチーム",
        B: "Bチーム",
      },
      teamCounts: {
        A: 2,
        B: 2,
      },
    },
    players: createPlayers(4),
    results: {},
  };

  applyStateToControls();
  renderPlayers();
  hideResults();
  setMessage("初期状態に戻しました。");
}

function collectPlayers() {
  return state.players
    .map((player) => ({
      ...player,
      name: player.name.trim(),
    }))
    .filter((player) => player.name);
}

function generateSchedule() {
  const settings = readSettings();
  if (state.players.length !== settings.playerCount) {
    resizePlayers(settings.playerCount);
    renderPlayers();
    saveState();
  }

  const players = collectPlayers();

  if (players.length < 4) {
    hideResults();
    setMessage("参加者を4人以上入力してください。", true);
    return;
  }

  const activeCourtCount = Math.min(settings.courtCount, Math.floor(players.length / 4));
  const roundCount = Math.max(1, Math.floor((settings.hours * 60) / settings.matchMinutes));
  state.results = {};
  const result = buildSchedule(players, activeCourtCount, roundCount, settings);
  currentSchedule = result;
  saveState();

  if (result.totalMatches === 0) {
    hideResults();
    setMessage("同じ種別同士の対戦を作れません。男4人、女4人、または男女2人ずつの組み合わせが必要です。", true);
    return;
  }

  renderSummary(result, settings, activeCourtCount);
  renderSchedule(result, settings);
  renderRankings();
  setMessage(
    `${result.rounds.length}ラウンド、最大${result.maxCourtsUsed}面分の乱数表を作成しました。プレー回数差は最大${result.playSpread}回です。`,
  );
}

function buildSchedule(players, courtCount, roundCount, settings) {
  const stats = new Map(
    players.map((player) => [
      player.id,
      {
        ...player,
        playCount: 0,
        restCount: 0,
      },
    ]),
  );
  const partnerHistory = new Map();
  const opponentHistory = new Map();
  const rounds = [];

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const selected = [];
    const selectedIds = new Set(selected.map((player) => player.id));
    let remaining = [...players];
    const courts = [];

    for (let courtIndex = 0; courtIndex < courtCount; courtIndex += 1) {
      const match = pickBestMatch(
        remaining,
        stats,
        partnerHistory,
        opponentHistory,
        settings,
        roundIndex,
        roundCount,
        players,
      );
      if (!match) {
        break;
      }

      const usedPlayers = [...match.teamA, ...match.teamB];
      remaining = remaining.filter((player) => !usedPlayers.some((member) => member.id === player.id));
      match.teamA.forEach((player) => selectedIds.add(player.id));
      match.teamB.forEach((player) => selectedIds.add(player.id));
      courts.push({
        id: `round-${roundIndex + 1}-court-${courtIndex + 1}`,
        courtNumber: courtIndex + 1,
        ...match,
      });
    }

    const resting = players.filter((player) => !selectedIds.has(player.id));
    selected.push(...players.filter((player) => selectedIds.has(player.id)));

    selected.forEach((player) => {
      stats.get(player.id).playCount += 1;
    });
    resting.forEach((player) => {
      stats.get(player.id).restCount += 1;
    });
    courts.forEach((court) => recordMatch(court, partnerHistory, opponentHistory));

    if (courts.length === 0) {
      break;
    }

    rounds.push({
      roundNumber: roundIndex + 1,
      courts,
      resting,
    });
  }

  const orderedStats = [...stats.values()].sort((a, b) => {
    if (a.playCount !== b.playCount) {
      return b.playCount - a.playCount;
    }
    return a.name.localeCompare(b.name, "ja");
  });
  const playCounts = orderedStats.map((player) => player.playCount);
  const totalMatches = rounds.reduce((total, round) => total + round.courts.length, 0);
  const maxCourtsUsed = rounds.reduce((max, round) => Math.max(max, round.courts.length), 0);

  return {
    rounds,
    stats: orderedStats,
    playSpread: Math.max(...playCounts) - Math.min(...playCounts),
    totalMatches,
    maxCourtsUsed,
  };
}

function pickBestMatch(players, stats, partnerHistory, opponentHistory, settings, roundIndex, roundCount, allPlayers) {
  const allowBreakFixedPair =
    settings.allowBreakFixedPairs && roundIndex >= Math.floor(roundCount / 2);
  const candidates =
    settings.scheduleMode === "team"
      ? getTeamMatchCandidates(players, allPlayers, allowBreakFixedPair)
      : getPracticeMatchCandidates(players, allPlayers, allowBreakFixedPair);

  if (candidates.length === 0) {
    return null;
  }

  return candidates
    .map((match) => {
      const group = [...match.teamA, ...match.teamB];
      return {
        match,
        score:
          groupPlayPriorityScore(group, stats) +
          groupHistoryScore(group, partnerHistory, opponentHistory) +
          playCountSpreadPenalty(group, stats) +
          matchPreferenceScore(match.matchType, settings.matchPreference) +
          fixedPairPenalty(match, allPlayers, allowBreakFixedPair) +
          pairHistoryScore(match, partnerHistory, opponentHistory) +
          Math.random() * 0.2,
      };
    })
    .sort((a, b) => a.score - b.score)[0].match;
}

function getPracticeMatchCandidates(players, allPlayers, allowBreakFixedPair) {
  return combinations(players, 4)
    .flatMap((group) => getValidTeamPatterns(group))
    .filter((match) => fixedPairPenalty(match, allPlayers, allowBreakFixedPair) < Infinity);
}

function getTeamMatchCandidates(players, allPlayers, allowBreakFixedPair) {
  const teamAPlayers = players.filter((player) => player.team === "A");
  const teamBPlayers = players.filter((player) => player.team === "B");
  const teamAPairs = combinations(teamAPlayers, 2);
  const teamBPairs = combinations(teamBPlayers, 2);
  const candidates = [];

  teamAPairs.forEach((teamA) => {
    teamBPairs.forEach((teamB) => {
      const matchType = getTeamType(teamA);
      if (matchType !== getTeamType(teamB)) {
        return;
      }

      const match = {
        teamA,
        teamB,
        matchType,
      };

      if (fixedPairPenalty(match, allPlayers, allowBreakFixedPair) < Infinity) {
        candidates.push(match);
      }
    });
  });

  return candidates;
}

function matchPreferenceScore(matchType, preference) {
  if (preference === "mixed") {
    return matchType === "mixed" ? -18 : 6;
  }

  if (preference === "genderDoubles") {
    return matchType === "mixed" ? 8 : -10;
  }

  return 0;
}

function fixedPairPenalty(match, players, allowBreakFixedPair) {
  const selected = [...match.teamA, ...match.teamB];
  const selectedIds = new Set(selected.map((player) => player.id));
  let penalty = 0;

  for (const player of selected) {
    if (!player.fixedPairId) {
      continue;
    }

    const partner = players.find((candidate) => candidate.id === player.fixedPairId);
    if (!partner) {
      continue;
    }

    const sameTeam =
      match.teamA.some((member) => member.id === player.id) &&
      match.teamA.some((member) => member.id === partner.id);
    const sameOpponentTeam =
      match.teamB.some((member) => member.id === player.id) &&
      match.teamB.some((member) => member.id === partner.id);

    if (!selectedIds.has(partner.id) || (!sameTeam && !sameOpponentTeam)) {
      if (!allowBreakFixedPair) {
        return Infinity;
      }
      penalty += 55;
    }
  }

  return penalty;
}

function pairHistoryScore(match, partnerHistory, opponentHistory) {
  return (
    getPairCount(partnerHistory, match.teamA[0], match.teamA[1]) * 10 +
    getPairCount(partnerHistory, match.teamB[0], match.teamB[1]) * 10 +
    opponentScore(match.teamA, match.teamB, opponentHistory) * 3
  );
}

function getValidTeamPatterns(group) {
  const patterns = [
    {
      teamA: [group[0], group[1]],
      teamB: [group[2], group[3]],
    },
    {
      teamA: [group[0], group[2]],
      teamB: [group[1], group[3]],
    },
    {
      teamA: [group[0], group[3]],
      teamB: [group[1], group[2]],
    },
  ];

  return patterns
    .map((pattern) => ({
      ...pattern,
      matchType: getTeamType(pattern.teamA),
      opponentType: getTeamType(pattern.teamB),
    }))
    .filter((pattern) => pattern.matchType === pattern.opponentType)
    .map(({ teamA, teamB, matchType }) => ({ teamA, teamB, matchType }));
}

function getTeamType(team) {
  const maleCount = team.filter((player) => player.gender === "male").length;
  const femaleCount = team.filter((player) => player.gender === "female").length;

  if (maleCount === 2) {
    return "men";
  }

  if (femaleCount === 2) {
    return "women";
  }

  return "mixed";
}

function getMatchTypeLabel(matchType) {
  return {
    men: "男ダブ",
    women: "女ダブ",
    mixed: "ミックス",
  }[matchType];
}

function groupHistoryScore(group, partnerHistory, opponentHistory) {
  let score = 0;
  for (let i = 0; i < group.length; i += 1) {
    for (let j = i + 1; j < group.length; j += 1) {
      score += getPairCount(partnerHistory, group[i], group[j]) * 2;
      score += getPairCount(opponentHistory, group[i], group[j]);
    }
  }
  return score;
}

function playCountSpreadPenalty(group, stats) {
  const counts = group.map((player) => stats.get(player.id).playCount);
  return Math.max(...counts) - Math.min(...counts);
}

function groupPlayPriorityScore(group, stats) {
  return group.reduce((total, player) => {
    const playerStats = stats.get(player.id);
    return total + playerStats.playCount * 100 - playerStats.restCount * 8;
  }, 0);
}

function opponentScore(teamA, teamB, opponentHistory) {
  return teamA.reduce(
    (total, playerA) =>
      total + teamB.reduce((innerTotal, playerB) => innerTotal + getPairCount(opponentHistory, playerA, playerB), 0),
    0,
  );
}

function recordMatch(court, partnerHistory, opponentHistory) {
  incrementPair(partnerHistory, court.teamA[0], court.teamA[1]);
  incrementPair(partnerHistory, court.teamB[0], court.teamB[1]);

  court.teamA.forEach((playerA) => {
    court.teamB.forEach((playerB) => {
      incrementPair(opponentHistory, playerA, playerB);
    });
  });
}

function getPairCount(map, playerA, playerB) {
  return map.get(pairKey(playerA, playerB)) || 0;
}

function incrementPair(map, playerA, playerB) {
  const key = pairKey(playerA, playerB);
  map.set(key, (map.get(key) || 0) + 1);
}

function pairKey(playerA, playerB) {
  return [playerA.id, playerB.id].sort().join(":");
}

function combinations(items, size) {
  const result = [];

  function walk(start, selected) {
    if (selected.length === size) {
      result.push(selected);
      return;
    }

    for (let index = start; index <= items.length - (size - selected.length); index += 1) {
      walk(index + 1, [...selected, items[index]]);
    }
  }

  walk(0, []);
  return result;
}

function renderSummary(result, settings, activeCourtCount) {
  const playCounts = result.stats.map((player) => player.playCount);
  const minPlay = Math.min(...playCounts);
  const maxPlay = Math.max(...playCounts);
  const average = playCounts.reduce((total, count) => total + count, 0) / playCounts.length;

  elements.summaryCards.innerHTML = `
    <div class="summary-card"><span>ラウンド数</span><strong>${result.rounds.length}</strong></div>
    <div class="summary-card"><span>総試合数</span><strong>${result.totalMatches}</strong></div>
    <div class="summary-card"><span>プレー回数</span><strong>${minPlay} - ${maxPlay}</strong></div>
    <div class="summary-card"><span>平均</span><strong>${average.toFixed(1)}回</strong></div>
  `;

  elements.statsBody.innerHTML = result.stats
    .map(
      (player) => `
        <tr>
          <td>${escapeHtml(player.name)}</td>
          <td>${GENDERS[player.gender]}</td>
          <td>${player.playCount}回</td>
          <td>${player.restCount}回</td>
        </tr>
      `,
    )
    .join("");

  elements.summaryPanel.classList.remove("hidden");

  if (settings.courtCount !== activeCourtCount || activeCourtCount !== result.maxCourtsUsed) {
    setMessage(
      `参加者数と性別構成に合わせて最大${result.maxCourtsUsed}面で作成しました。成立しないコートは使いません。`,
    );
  }
}

function renderSchedule(result, settings) {
  elements.schedule.innerHTML = result.rounds
    .map((round) => {
      const startMinutes = (round.roundNumber - 1) * settings.matchMinutes;
      const endMinutes = round.roundNumber * settings.matchMinutes;

      return `
        <article class="round-card">
          <div class="round-header">
            <h3>${round.roundNumber}ラウンド</h3>
            <span>${formatMinutes(startMinutes)} - ${formatMinutes(endMinutes)}</span>
          </div>
          <div class="courts">
            ${round.courts
              .map(
                (court) => `
                  <div class="court-card match-${court.matchType}">
                    <h4>
                      コート${court.courtNumber}
                      <span>${getMatchTypeLabel(court.matchType)}</span>
                    </h4>
                    <div class="match-line">
                      <div class="team">${formatTeam(court.teamA)}</div>
                      <div class="versus">vs</div>
                      <div class="team">${formatTeam(court.teamB)}</div>
                    </div>
                    ${renderScoreInputs(court)}
                  </div>
                `,
              )
              .join("")}
          </div>
          <div class="resting">
            <strong>休憩:</strong>
            ${round.resting.length > 0 ? round.resting.map((player) => escapeHtml(player.name)).join("、") : "なし"}
          </div>
        </article>
      `;
    })
    .join("");
  elements.schedulePanel.classList.remove("hidden");
}

function renderScoreInputs(court) {
  const result = state.results[court.id] || {};
  const winner = getCourtWinner(court, result);
  const isTeamMode = state.settings.scheduleMode === "team";

  return `
    <div class="score-inputs">
      <label>
        ${isTeamMode ? getTeamName("A") : "左ペア"} 得点
        <input data-result-id="${court.id}" data-score-field="teamAScore" type="number" min="0" value="${
          result.teamAScore ?? ""
        }" />
      </label>
      <span>-</span>
      <label>
        ${isTeamMode ? getTeamName("B") : "右ペア"} 得点
        <input data-result-id="${court.id}" data-score-field="teamBScore" type="number" min="0" value="${
          result.teamBScore ?? ""
        }" />
      </label>
    </div>
    <div class="winner">${winner}</div>
  `;
}

function getCourtWinner(court, result) {
  const teamAScore = Number(result.teamAScore);
  const teamBScore = Number(result.teamBScore);

  if (!Number.isFinite(teamAScore) || !Number.isFinite(teamBScore) || result.teamAScore === "" || result.teamBScore === "") {
    return "結果未入力";
  }

  if (teamAScore === teamBScore) {
    return "引き分け";
  }

  return teamAScore > teamBScore
    ? `勝者: ${court.teamA.map((player) => player.name).join(" / ")}`
    : `勝者: ${court.teamB.map((player) => player.name).join(" / ")}`;
}

function renderRankings() {
  if (!currentSchedule) {
    elements.rankingPanel.classList.add("hidden");
    return;
  }

  const playerStats = new Map(
    currentSchedule.stats.map((player) => [
      player.id,
      {
        ...player,
        wins: 0,
        losses: 0,
        draws: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      },
    ]),
  );
  const teamStats = {
    A: { wins: 0, losses: 0, draws: 0, pointsFor: 0, pointsAgainst: 0 },
    B: { wins: 0, losses: 0, draws: 0, pointsFor: 0, pointsAgainst: 0 },
  };

  currentSchedule.rounds.forEach((round) => {
    round.courts.forEach((court) => {
      const result = state.results[court.id];
      if (!hasCompleteResult(result)) {
        return;
      }

      const teamAScore = Number(result.teamAScore);
      const teamBScore = Number(result.teamBScore);
      const teamAWin = teamAScore > teamBScore;
      const teamBWin = teamBScore > teamAScore;
      const draw = teamAScore === teamBScore;

      applyPlayerResult(court.teamA, playerStats, teamAScore, teamBScore, teamAWin, teamBWin, draw);
      applyPlayerResult(court.teamB, playerStats, teamBScore, teamAScore, teamBWin, teamAWin, draw);

      if (state.settings.scheduleMode === "team") {
        applyTeamResult("A", teamStats, teamAScore, teamBScore, teamAWin, teamBWin, draw);
        applyTeamResult("B", teamStats, teamBScore, teamAScore, teamBWin, teamAWin, draw);
      }
    });
  });

  const ranking = [...playerStats.values()].sort((a, b) => {
    const aMatches = getMatchCount(a);
    const bMatches = getMatchCount(b);
    const aWinRate = aMatches === 0 ? 0 : a.wins / aMatches;
    const bWinRate = bMatches === 0 ? 0 : b.wins / bMatches;

    if (aWinRate !== bWinRate) {
      return bWinRate - aWinRate;
    }
    if (a.wins !== b.wins) {
      return b.wins - a.wins;
    }
    if (getPointDiff(a) !== getPointDiff(b)) {
      return getPointDiff(b) - getPointDiff(a);
    }
    return b.pointsFor - a.pointsFor;
  });

  elements.rankingBody.innerHTML = ranking
    .map((player, index) => {
      const matches = getMatchCount(player);
      const winRate = matches === 0 ? "-" : `${((player.wins / matches) * 100).toFixed(1)}%`;
      const pointDiff = getPointDiff(player);

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(player.name)}</td>
          <td>${player.wins}勝${player.losses}敗${player.draws}分</td>
          <td>${winRate}</td>
          <td>${pointDiff >= 0 ? "+" : ""}${pointDiff}</td>
          <td>${player.pointsFor}-${player.pointsAgainst}</td>
        </tr>
      `;
    })
    .join("");

  renderTeamRanking(teamStats);
  elements.rankingPanel.classList.remove("hidden");
}

function hasCompleteResult(result) {
  return (
    result &&
    result.teamAScore !== "" &&
    result.teamBScore !== "" &&
    Number.isFinite(Number(result.teamAScore)) &&
    Number.isFinite(Number(result.teamBScore))
  );
}

function applyPlayerResult(team, playerStats, pointsFor, pointsAgainst, won, lost, draw) {
  team.forEach((player) => {
    const stats = playerStats.get(player.id);
    if (!stats) {
      return;
    }

    stats.pointsFor += pointsFor;
    stats.pointsAgainst += pointsAgainst;
    if (draw) {
      stats.draws += 1;
    } else if (won) {
      stats.wins += 1;
    } else if (lost) {
      stats.losses += 1;
    }
  });
}

function applyTeamResult(teamKey, teamStats, pointsFor, pointsAgainst, won, lost, draw) {
  const stats = teamStats[teamKey];
  stats.pointsFor += pointsFor;
  stats.pointsAgainst += pointsAgainst;
  if (draw) {
    stats.draws += 1;
  } else if (won) {
    stats.wins += 1;
  } else if (lost) {
    stats.losses += 1;
  }
}

function renderTeamRanking(teamStats) {
  if (state.settings.scheduleMode !== "team") {
    elements.teamRanking.classList.add("hidden");
    elements.teamRanking.innerHTML = "";
    return;
  }

  elements.teamRanking.innerHTML = Object.entries(teamStats)
    .map(([teamKey, stats]) => {
      const pointDiff = getPointDiff(stats);
      return `
        <div class="team-score-card">
          <strong>${escapeHtml(getTeamName(teamKey))}</strong>
          <div>${stats.wins}勝${stats.losses}敗${stats.draws}分</div>
          <div>得失 ${pointDiff >= 0 ? "+" : ""}${pointDiff}</div>
          <div>得点 ${stats.pointsFor}-${stats.pointsAgainst}</div>
        </div>
      `;
    })
    .join("");
  elements.teamRanking.classList.remove("hidden");
}

function getMatchCount(stats) {
  return stats.wins + stats.losses + stats.draws;
}

function getPointDiff(stats) {
  return stats.pointsFor - stats.pointsAgainst;
}

function formatTeam(team) {
  return team
    .map((player) => `${escapeHtml(player.name)} <small>(${GENDERS[player.gender]})</small>`)
    .join(" / ");
}

function formatMinutes(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hideResults() {
  elements.summaryPanel.classList.add("hidden");
  elements.schedulePanel.classList.add("hidden");
  elements.rankingPanel.classList.add("hidden");
  currentSchedule = null;
}

elements.playersList.addEventListener("input", (event) => {
  const target = event.target;
  const index = Number(target.dataset.index);
  const field = target.dataset.field;

  if (!Number.isInteger(index) || !field || !state.players[index]) {
    return;
  }

  state.players[index][field] = target.value;
  saveState();
});

elements.playersList.addEventListener("change", (event) => {
  const target = event.target;
  const index = Number(target.dataset.index);
  const field = target.dataset.field;

  if (!Number.isInteger(index) || !field || !state.players[index]) {
    return;
  }

  state.players[index][field] = target.value;
  saveState();
});

elements.generateButton.addEventListener("click", generateSchedule);
elements.sampleButton.addEventListener("click", fillSamplePlayers);
elements.clearButton.addEventListener("click", clearState);

elements.schedule.addEventListener("input", (event) => {
  const target = event.target;
  const resultId = target.dataset.resultId;
  const scoreField = target.dataset.scoreField;

  if (!resultId || !scoreField) {
    return;
  }

  state.results[resultId] = {
    ...(state.results[resultId] || {}),
    [scoreField]: target.value,
  };
  saveState();
  renderRankings();
});

elements.schedule.addEventListener("change", () => {
  if (currentSchedule) {
    renderSchedule(currentSchedule, state.settings);
  }
});

elements.teamACount.addEventListener("change", () => {
  const total = Number(elements.playerCount.value);
  elements.teamBCount.value = String(total - Number(elements.teamACount.value));
});

elements.teamBCount.addEventListener("change", () => {
  const total = Number(elements.playerCount.value);
  elements.teamACount.value = String(total - Number(elements.teamBCount.value));
});

elements.courtCount.addEventListener("change", () => {
  const courtCount = Number(elements.courtCount.value);
  updatePlayerCountOptions(false, courtCount);
  elements.playerCount.value = String(courtCount * 4);
});

[
  elements.courtCount,
  elements.playerCount,
  elements.hours,
  elements.matchMinutes,
  elements.scheduleMode,
  elements.matchPreference,
  elements.allowBreakFixedPairs,
  elements.teamAName,
  elements.teamBName,
  elements.teamACount,
  elements.teamBCount,
].forEach((element) => {
  element.addEventListener("change", () => {
    const settings = readSettings();
    resizePlayers(settings.playerCount);
    renderPlayers();
    hideResults();
  });
});

applyStateToControls();
renderPlayers();
setMessage("条件と参加者を入力して「乱数表を作成」を押してください。");

/**
 * Fuzzy String Matching — 오타 자동보정
 *
 * Levenshtein distance 기반으로 가장 가까운 명령어 찾기
 */

/**
 * Levenshtein distance 계산
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // 삭제
        dp[i][j - 1] + 1,      // 삽입
        dp[i - 1][j - 1] + cost // 교체
      );
    }
  }

  return dp[m][n];
}

/**
 * 입력값과 가장 가까운 명령어 찾기
 * @param {string} input - 사용자가 입력한 (오타 가능) 명령어
 * @param {string[]} validCommands - 올바른 명령어 목록
 * @param {number} threshold - 허용 오차 (기본값: 2)
 * @returns {{ match: string, distance: number } | null}
 */
export function findClosestCommand(input, validCommands, threshold = 2) {
  let best = null;
  let bestDist = Infinity;

  for (const cmd of validCommands) {
    const dist = levenshtein(input, cmd);
    if (dist < bestDist) {
      bestDist = dist;
      best = cmd;
    }
  }

  // 앞글자 매칭 (예: "md" → "model", "as" → "ask")
  for (const cmd of validCommands) {
    if (cmd.startsWith(input) && input.length >= 2) {
      return { match: cmd, distance: 0 };
    }
  }

  if (best && bestDist <= threshold) {
    return { match: best, distance: bestDist };
  }

  return null;
}

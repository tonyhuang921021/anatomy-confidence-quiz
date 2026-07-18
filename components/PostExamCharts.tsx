import type { PostExamSeasonDailyPoint } from "@/data/postExamSeasonSnapshot";
import type {
  PostExamCumulativePoint,
  PostExamPersonalSnapshot,
  PostExamSimulationResult
} from "@/lib/postExamReflection";
import { groupPostExamSimulationsByYear } from "@/lib/postExamReflection";

const numberFormatter = new Intl.NumberFormat("zh-TW");
const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  month: "numeric",
  day: "numeric"
});

function formatDate(date: string) {
  const value = date.length === 10 ? `${date}T12:00:00+08:00` : date;
  return dateFormatter.format(new Date(value));
}

function accuracy(correct: number, attempts: number, digits = 1) {
  if (attempts <= 0) return 0;
  return Number(((correct / attempts) * 100).toFixed(digits));
}

function createLinePath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
}

function createAreaPath(points: Array<{ x: number; y: number }>, baseline: number) {
  if (points.length === 0) return "";
  return [
    `M${points[0].x},${baseline}`,
    ...points.map((point) => `L${point.x},${point.y}`),
    `L${points.at(-1)?.x ?? 0},${baseline}`,
    "Z"
  ].join(" ");
}

function getTickIndexes(length: number) {
  if (length <= 1) return [0];
  return Array.from(new Set([0, Math.floor((length - 1) / 3), Math.floor(((length - 1) * 2) / 3), length - 1]));
}

export function SeasonActivityChart({
  daily,
  totalAttempts,
  correctAttempts
}: {
  daily: readonly PostExamSeasonDailyPoint[];
  totalAttempts: number;
  correctAttempts: number;
}) {
  const width = 1000;
  const height = 360;
  const margin = { left: 64, right: 64, top: 50, bottom: 48 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const maxAttempts = Math.max(...daily.map((point) => point.attempts), 1);
  const step = chartWidth / Math.max(daily.length, 1);
  const barWidth = Math.max(3, Math.min(11, step * 0.7));
  const x = (index: number) => margin.left + step * index + step / 2;
  const attemptsY = (value: number) => margin.top + chartHeight - (value / maxAttempts) * chartHeight;
  const accuracyY = (value: number) => margin.top + chartHeight - ((value - 55) / 40) * chartHeight;
  const linePoints = daily.map((point, index) => ({
    x: x(index),
    y: accuracyY(accuracy(point.correct, point.attempts))
  }));
  const peakIndex = daily.reduce(
    (best, point, index) => (point.attempts > daily[best].attempts ? index : best),
    0
  );
  const tickIndexes = getTickIndexes(daily.length);

  return (
    <figure className="min-w-0" aria-labelledby="season-chart-title">
      <figcaption className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="season-chart-title" className="text-xl font-bold text-ink sm:text-2xl">
            全站考季回顧
          </h2>
          <p className="mt-1 text-sm text-slate-500">每日作答量與正確率</p>
        </div>
        <p className="text-sm font-semibold text-slate-700">
          {numberFormatter.format(totalAttempts)} 題 · {accuracy(correctAttempts, totalAttempts, 2)}%
        </p>
      </figcaption>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto min-w-[720px] w-full"
          role="img"
          aria-label={`全站從 ${daily[0]?.date ?? ""} 到 ${daily.at(-1)?.date ?? ""}，累計 ${numberFormatter.format(totalAttempts)} 題，正確率 ${accuracy(correctAttempts, totalAttempts, 2)}%`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = margin.top + chartHeight * ratio;
            return (
              <g key={ratio}>
                <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="#d9e2dc" strokeWidth="1" />
                <text x={margin.left - 10} y={y + 4} textAnchor="end" fontSize="12" fill="#64748b">
                  {numberFormatter.format(Math.round(maxAttempts * (1 - ratio)))}
                </text>
              </g>
            );
          })}
          {daily.map((point, index) => {
            const y = attemptsY(point.attempts);
            const pointAccuracy = accuracy(point.correct, point.attempts);
            return (
              <g key={point.date}>
                <rect
                  x={x(index) - barWidth / 2}
                  y={y}
                  width={barWidth}
                  height={Math.max(1, margin.top + chartHeight - y)}
                  rx="2"
                  fill={point.partialDay ? "#6f9c88" : "#2d7d5b"}
                  opacity={point.partialDay ? 0.7 : 0.86}
                >
                  <title>{`${point.date}：${numberFormatter.format(point.attempts)} 題，正確率 ${pointAccuracy}%`}</title>
                </rect>
                <circle cx={x(index)} cy={accuracyY(pointAccuracy)} r="7" fill="transparent">
                  <title>{`${point.date} 正確率 ${pointAccuracy}%`}</title>
                </circle>
              </g>
            );
          })}
          <path d={createLinePath(linePoints)} fill="none" stroke="#d0644d" strokeWidth="3" strokeLinejoin="round" />
          {tickIndexes.map((index) => (
            <text key={daily[index].date} x={x(index)} y={height - 16} textAnchor="middle" fontSize="12" fill="#64748b">
              {formatDate(daily[index].date)}
            </text>
          ))}
          <text x={width - margin.right + 10} y={accuracyY(95) + 4} fontSize="12" fill="#9f4939">95%</text>
          <text x={width - margin.right + 10} y={accuracyY(75) + 4} fontSize="12" fill="#9f4939">75%</text>
          <text x={width - margin.right + 10} y={accuracyY(55) + 4} fontSize="12" fill="#9f4939">55%</text>
          <g transform={`translate(${x(peakIndex)},${Math.max(24, attemptsY(daily[peakIndex].attempts) - 12)})`}>
            <text textAnchor="middle" fontSize="12" fontWeight="700" fill="#1f5840">
              {formatDate(daily[peakIndex].date)} · {numberFormatter.format(daily[peakIndex].attempts)} 題
            </text>
          </g>
          <g transform={`translate(${margin.left},18)`}>
            <rect width="16" height="8" y="-6" rx="2" fill="#2d7d5b" />
            <text x="24" fontSize="12" fill="#475569">每日作答量</text>
            <line x1="112" y1="-2" x2="132" y2="-2" stroke="#d0644d" strokeWidth="3" />
            <text x="140" fontSize="12" fill="#475569">每日正確率</text>
          </g>
        </svg>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        統計截止 2026/7/17 15:00（台灣時間）；7/17 為截至截止時間的部分日。
      </p>
    </figure>
  );
}

export function PersonalCumulativeChart({ points }: { points: PostExamCumulativePoint[] }) {
  if (points.length === 0) {
    return (
      <section aria-labelledby="personal-chart-title">
        <h2 id="personal-chart-title" className="text-xl font-bold text-ink sm:text-2xl">我的作答累積</h2>
        <p className="mt-4 border-l-4 border-slate-300 pl-4 text-sm text-slate-600">截止日前沒有可納入的已完成作答回合。</p>
      </section>
    );
  }

  const width = 1000;
  const height = 340;
  const margin = { left: 64, right: 64, top: 46, bottom: 48 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const maxAttempts = Math.max(points.at(-1)?.cumulativeAttempts ?? 1, 1);
  const x = (index: number) =>
    margin.left + (points.length <= 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth);
  const attemptsY = (value: number) => margin.top + chartHeight - (value / maxAttempts) * chartHeight;
  const accuracyY = (value: number) => margin.top + chartHeight - ((value - 40) / 60) * chartHeight;
  const attemptPoints = points.map((point, index) => ({ x: x(index), y: attemptsY(point.cumulativeAttempts) }));
  const accuracyPoints = points.map((point, index) => ({ x: x(index), y: accuracyY(point.cumulativeAccuracy) }));
  const tickIndexes = getTickIndexes(points.length);
  const last = points.at(-1)!;

  return (
    <figure className="min-w-0" aria-labelledby="personal-chart-title">
      <figcaption className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="personal-chart-title" className="text-xl font-bold text-ink sm:text-2xl">我的作答累積</h2>
          <p className="mt-1 text-sm text-slate-500">完成回合累積題數與累積正確率</p>
        </div>
        <p className="text-sm font-semibold text-slate-700">
          {numberFormatter.format(last.cumulativeAttempts)} 題 · {last.cumulativeAccuracy}%
        </p>
      </figcaption>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto min-w-[720px] w-full"
          role="img"
          aria-label={`個人累積 ${numberFormatter.format(last.cumulativeAttempts)} 題，累積正確率 ${last.cumulativeAccuracy}%`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = margin.top + chartHeight * ratio;
            return (
              <g key={ratio}>
                <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="#d9e2dc" strokeWidth="1" />
                <text x={margin.left - 10} y={y + 4} textAnchor="end" fontSize="12" fill="#64748b">
                  {numberFormatter.format(Math.round(maxAttempts * (1 - ratio)))}
                </text>
              </g>
            );
          })}
          <path d={createAreaPath(attemptPoints, margin.top + chartHeight)} fill="#cfe6da" opacity="0.9" />
          <path d={createLinePath(attemptPoints)} fill="none" stroke="#2d7d5b" strokeWidth="3" />
          <path d={createLinePath(accuracyPoints)} fill="none" stroke="#d0644d" strokeWidth="3" strokeLinejoin="round" />
          {points.map((point, index) => (
            <circle key={point.date} cx={x(index)} cy={accuracyY(point.cumulativeAccuracy)} r="7" fill="transparent">
              <title>{`${point.date}：累積 ${numberFormatter.format(point.cumulativeAttempts)} 題，正確率 ${point.cumulativeAccuracy}%`}</title>
            </circle>
          ))}
          {tickIndexes.map((index) => (
            <text key={points[index].date} x={x(index)} y={height - 16} textAnchor="middle" fontSize="12" fill="#64748b">
              {formatDate(points[index].date)}
            </text>
          ))}
          <text x={width - margin.right + 10} y={accuracyY(100) + 4} fontSize="12" fill="#9f4939">100%</text>
          <text x={width - margin.right + 10} y={accuracyY(70) + 4} fontSize="12" fill="#9f4939">70%</text>
          <text x={width - margin.right + 10} y={accuracyY(40) + 4} fontSize="12" fill="#9f4939">40%</text>
          <g transform={`translate(${margin.left},18)`}>
            <rect width="16" height="8" y="-6" rx="2" fill="#2d7d5b" />
            <text x="24" fontSize="12" fill="#475569">累積作答量</text>
            <line x1="120" y1="-2" x2="140" y2="-2" stroke="#d0644d" strokeWidth="3" />
            <text x="148" fontSize="12" fill="#475569">累積正確率</text>
          </g>
          <text x={width - margin.right} y={Math.max(34, accuracyY(last.cumulativeAccuracy) - 12)} textAnchor="end" fontSize="13" fontWeight="700" fill="#9f4939">
            {last.cumulativeAccuracy}%
          </text>
        </svg>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">只計入截止時間前、已完成且可辨識的作答回合。</p>
    </figure>
  );
}

function SimulationResultCard({ result }: { result: PostExamSimulationResult }) {
  return (
    <article className="min-w-0 border-b border-slate-100 py-3 last:border-b-0 sm:py-4">
      <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-4">
        <div className="min-w-0">
          <p
            className="line-clamp-2 break-words text-xs font-semibold leading-5 text-slate-800 sm:text-sm"
            title={result.paperLabel}
          >
            {result.paperLabel}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">{formatDate(result.completedAt)}</p>
        </div>
        <p className="shrink-0 text-lg font-bold tabular-nums text-ink sm:text-xl">{result.score}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${result.score}%` }} />
      </div>
    </article>
  );
}

export function SimulationScoreChart({ results }: { results: PostExamSimulationResult[] }) {
  const med1 = results.filter((result) => result.subject === "醫學（一）");
  const med2 = results.filter((result) => result.subject === "醫學（二）");
  const yearGroups = groupPostExamSimulationsByYear(results);
  return (
    <section aria-labelledby="simulation-score-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="simulation-score-title" className="text-xl font-bold text-ink sm:text-2xl">模擬考紀錄</h2>
          <p className="mt-1 text-sm text-slate-500">完整 100 題且高於 3 分</p>
        </div>
        <span className="text-sm font-semibold text-slate-700">0–100 分</span>
      </div>
      <div className="grid grid-cols-2 gap-2 border-y border-slate-200 bg-slate-50 px-3 py-3 sm:gap-5 sm:px-5">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-ink sm:text-base">醫學（一）</h3>
          <span className="text-[11px] font-semibold text-slate-500 sm:text-xs">{med1.length} 份</span>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-ink sm:text-base">醫學（二）</h3>
          <span className="text-[11px] font-semibold text-slate-500 sm:text-xs">{med2.length} 份</span>
        </div>
      </div>
      {yearGroups.length === 0 ? (
        <p className="border-b border-slate-200 py-6 text-sm text-slate-500">沒有符合條件的完整模擬考。</p>
      ) : (
        <div>
          {yearGroups.map((group) => (
            <section key={group.key} aria-labelledby={`simulation-year-${group.key}`} className="border-b border-slate-200 py-4 sm:py-5">
              <h4
                id={`simulation-year-${group.key}`}
                className="mb-2 text-xs font-bold text-brand-700 sm:mb-3 sm:text-sm"
              >
                {group.label}
              </h4>
              <div className="grid grid-cols-2 gap-2 sm:gap-5">
                <div className="min-w-0 border-r border-slate-200 pr-2 sm:pr-5">
                  {group.med1.length > 0 ? (
                    group.med1.map((result) => <SimulationResultCard key={result.sessionId} result={result} />)
                  ) : (
                    <p className="py-4 text-center text-xs text-slate-400 sm:text-sm">—</p>
                  )}
                </div>
                <div className="min-w-0">
                  {group.med2.length > 0 ? (
                    group.med2.map((result) => <SimulationResultCard key={result.sessionId} result={result} />)
                  ) : (
                    <p className="py-4 text-center text-xs text-slate-400 sm:text-sm">—</p>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function canvasRoundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 8
) {
  const safeRadius = Math.min(Math.max(radius, 0), width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function drawCanvasSimulationResult(
  context: CanvasRenderingContext2D,
  result: PostExamSimulationResult | undefined,
  x: number,
  y: number,
  width: number
) {
  context.fillStyle = result ? "#ffffff" : "#f1f5f9";
  canvasRoundRect(context, x, y, width, 52, 7);
  context.fill();

  if (!result) {
    context.fillStyle = "#94a3b8";
    context.font = '600 18px "Noto Sans TC", sans-serif';
    context.textAlign = "center";
    context.fillText("無紀錄", x + width / 2, y + 32);
    context.textAlign = "left";
    return;
  }

  const label = result.paperLabel.length > 24 ? `${result.paperLabel.slice(0, 24)}…` : result.paperLabel;
  context.fillStyle = "#334155";
  context.font = '600 16px "Noto Sans TC", sans-serif';
  context.fillText(`${label} · ${formatDate(result.completedAt)}`, x + 16, y + 21);
  context.fillStyle = "#e8eef0";
  context.fillRect(x + 16, y + 34, width - 72, 8);
  context.fillStyle = "#2d7d5b";
  context.fillRect(x + 16, y + 34, ((width - 72) * result.score) / 100, 8);
  context.fillStyle = "#102a22";
  context.font = '700 18px "Noto Sans TC", sans-serif';
  context.textAlign = "right";
  context.fillText(String(result.score), x + width - 16, y + 24);
  context.textAlign = "left";
}

function drawCanvasChart(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  values: number[],
  lineValues: number[],
  cumulative = false,
  dateLabels?: { start: string; end: string }
) {
  const inner = { left: x + 54, right: x + width - 28, top: y + 38, bottom: y + height - 34 };
  const chartWidth = inner.right - inner.left;
  const chartHeight = inner.bottom - inner.top;
  const maxValue = Math.max(...values, 1);
  context.fillStyle = "#2d7d5b";
  context.fillRect(inner.left, y + 13, 18, 8);
  context.fillStyle = "#475569";
  context.font = '500 15px "Noto Sans TC", sans-serif';
  context.fillText(cumulative ? "累積作答量" : "每日作答量", inner.left + 28, y + 22);
  context.strokeStyle = "#d0644d";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(inner.left + 130, y + 18);
  context.lineTo(inner.left + 154, y + 18);
  context.stroke();
  context.fillStyle = "#475569";
  context.fillText(cumulative ? "累積正確率" : "每日正確率", inner.left + 164, y + 22);

  context.strokeStyle = "#dce4df";
  context.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const lineY = inner.top + (chartHeight / 4) * index;
    context.beginPath();
    context.moveTo(inner.left, lineY);
    context.lineTo(inner.right, lineY);
    context.stroke();
  }

  const step = chartWidth / Math.max(values.length - (cumulative ? 1 : 0), 1);
  if (cumulative) {
    const points = values.map((value, index) => ({
      x: inner.left + (values.length <= 1 ? chartWidth / 2 : step * index),
      y: inner.bottom - (value / maxValue) * chartHeight
    }));
    context.beginPath();
    context.moveTo(points[0]?.x ?? inner.left, inner.bottom);
    for (const point of points) context.lineTo(point.x, point.y);
    context.lineTo(points.at(-1)?.x ?? inner.right, inner.bottom);
    context.closePath();
    context.fillStyle = "#cfe6da";
    context.fill();
    context.strokeStyle = "#2d7d5b";
    context.lineWidth = 4;
    context.beginPath();
    points.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
    context.stroke();
  } else {
    const barStep = chartWidth / Math.max(values.length, 1);
    const barWidth = Math.max(3, Math.min(11, barStep * 0.65));
    context.fillStyle = "#2d7d5b";
    values.forEach((value, index) => {
      const barHeight = (value / maxValue) * chartHeight;
      context.fillRect(inner.left + barStep * index + barStep / 2 - barWidth / 2, inner.bottom - barHeight, barWidth, barHeight);
    });
  }

  context.strokeStyle = "#d0644d";
  context.lineWidth = 4;
  context.beginPath();
  lineValues.forEach((value, index) => {
    const pointX = inner.left + (lineValues.length <= 1 ? chartWidth / 2 : (index / (lineValues.length - 1)) * chartWidth);
    const pointY = inner.bottom - (Math.max(40, Math.min(100, value)) - 40) / 60 * chartHeight;
    if (index === 0) context.moveTo(pointX, pointY);
    else context.lineTo(pointX, pointY);
  });
  context.stroke();

  context.fillStyle = "#64748b";
  context.font = '500 14px "Noto Sans TC", sans-serif';
  context.textAlign = "right";
  context.fillText(numberFormatter.format(maxValue), inner.left - 10, inner.top + 5);
  context.fillText("0", inner.left - 10, inner.bottom + 5);
  context.textAlign = "left";
  context.fillText("100%", inner.right + 8, inner.top + 5);
  context.fillText("40%", inner.right + 8, inner.bottom + 5);
  if (dateLabels) {
    context.fillText(dateLabels.start, inner.left, inner.bottom + 25);
    context.textAlign = "right";
    context.fillText(dateLabels.end, inner.right, inner.bottom + 25);
    context.textAlign = "left";
  }
}

export async function downloadPostExamRecapPng({
  snapshot,
  cumulativePoints,
  seasonDaily,
  seasonTotalAttempts,
  seasonCorrectAttempts
}: {
  snapshot: PostExamPersonalSnapshot;
  cumulativePoints: PostExamCumulativePoint[];
  seasonDaily: readonly PostExamSeasonDailyPoint[];
  seasonTotalAttempts: number;
  seasonCorrectAttempts: number;
}) {
  const width = 1400;
  const simulationGroups = groupPostExamSimulationsByYear(snapshot.simulations);
  const simulationRows = Math.max(
    1,
    simulationGroups.reduce((total, group) => total + Math.max(1, group.med1.length, group.med2.length), 0)
  );
  const height = Math.max(1280, 1140 + simulationRows * 60 + simulationGroups.length * 46);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("瀏覽器無法建立 PNG 畫布。");

  context.fillStyle = "#f5f2e9";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#102a22";
  context.font = '700 46px "Noto Sans TC", sans-serif';
  context.fillText("2026 一階醫師國考題庫回顧", 72, 88);
  context.fillStyle = "#64748b";
  context.font = '500 22px "Noto Sans TC", sans-serif';
  context.fillText("統計截止 2026/7/17 15:00（台灣時間）", 72, 126);

  context.fillStyle = "#ffffff";
  canvasRoundRect(context, 56, 168, width - 112, 350);
  context.fill();
  context.fillStyle = "#102a22";
  context.font = '700 28px "Noto Sans TC", sans-serif';
  context.fillText("全站考季", 84, 212);
  context.fillStyle = "#475569";
  context.font = '600 21px "Noto Sans TC", sans-serif';
  context.fillText(`${numberFormatter.format(seasonTotalAttempts)} 題 · ${accuracy(seasonCorrectAttempts, seasonTotalAttempts, 2)}%`, 1040, 212);
  drawCanvasChart(
    context,
    76,
    220,
    width - 152,
    270,
    seasonDaily.map((point) => point.attempts),
    seasonDaily.map((point) => accuracy(point.correct, point.attempts)),
    false,
    {
      start: formatDate(seasonDaily[0]?.date ?? ""),
      end: formatDate(seasonDaily.at(-1)?.date ?? "")
    }
  );

  context.fillStyle = "#ffffff";
  canvasRoundRect(context, 56, 542, width - 112, 350);
  context.fill();
  const personalLast = cumulativePoints.at(-1);
  context.fillStyle = "#102a22";
  context.font = '700 28px "Noto Sans TC", sans-serif';
  context.fillText("我的作答累積", 84, 586);
  context.fillStyle = "#475569";
  context.font = '600 21px "Noto Sans TC", sans-serif';
  context.fillText(
    personalLast
      ? `${numberFormatter.format(personalLast.cumulativeAttempts)} 題 · ${personalLast.cumulativeAccuracy}%`
      : "截止日前沒有可納入的完成回合",
    960,
    586
  );
  if (personalLast) {
    drawCanvasChart(
      context,
      76,
      594,
      width - 152,
      270,
      cumulativePoints.map((point) => point.cumulativeAttempts),
      cumulativePoints.map((point) => point.cumulativeAccuracy),
      true,
      {
        start: formatDate(cumulativePoints[0]?.date ?? ""),
        end: formatDate(cumulativePoints.at(-1)?.date ?? "")
      }
    );
  }

  let cursorY = 930;
  context.fillStyle = "#102a22";
  context.font = '700 28px "Noto Sans TC", sans-serif';
  context.fillText("模擬考紀錄", 72, cursorY);
  cursorY += 34;
  context.fillStyle = "#64748b";
  context.font = '500 18px "Noto Sans TC", sans-serif';
  context.fillText("完整 100 題且高於 3 分", 72, cursorY);
  cursorY += 24;

  const columnGap = 20;
  const columnWidth = (width - 144 - columnGap) / 2;
  const rightColumnX = 72 + columnWidth + columnGap;
  context.fillStyle = "#e8eef0";
  canvasRoundRect(context, 72, cursorY, width - 144, 42, 7);
  context.fill();
  context.fillStyle = "#1f5840";
  context.font = '700 20px "Noto Sans TC", sans-serif';
  context.fillText(`醫學（一） · ${snapshot.simulations.filter((result) => result.subject === "醫學（一）").length} 份`, 92, cursorY + 28);
  context.fillText(`醫學（二） · ${snapshot.simulations.filter((result) => result.subject === "醫學（二）").length} 份`, rightColumnX + 20, cursorY + 28);
  cursorY += 54;

  if (simulationGroups.length === 0) {
    context.fillStyle = "#94a3b8";
    context.font = '500 18px "Noto Sans TC", sans-serif';
    context.fillText("沒有符合條件的紀錄", 72, cursorY + 24);
  }

  for (const group of simulationGroups) {
    context.fillStyle = "#1f5840";
    context.font = '700 18px "Noto Sans TC", sans-serif';
    context.fillText(group.label, 72, cursorY + 20);
    cursorY += 30;
    const rows = Math.max(1, group.med1.length, group.med2.length);
    for (let index = 0; index < rows; index += 1) {
      drawCanvasSimulationResult(context, group.med1[index], 72, cursorY, columnWidth);
      drawCanvasSimulationResult(context, group.med2[index], rightColumnX, cursorY, columnWidth);
      cursorY += 60;
    }
    cursorY += 16;
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  const anchor = document.createElement("a");
  anchor.download = "2026-國考題庫回顧.png";
  if (blob) {
    const url = URL.createObjectURL(blob);
    anchor.href = url;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    anchor.href = canvas.toDataURL("image/png");
    anchor.click();
  }
}

"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Layers3,
} from "lucide-react";
import data from "./aggregates.json";
import "./trends.css";

const fmt = (value: number | null, digits = 2) =>
  value === null
    ? "未列"
    : value.toLocaleString("zh-TW", { maximumFractionDigits: digits });
const names = ["總覽", "醫學一", "醫學二"];
const modes = ["散題練習", "模擬考", "錯題複習"];
const periods = ["6/19 以前", "6/19–6/26", "6/26–7/3", "7/3–7/10", "7/10–7/17"];
type Paper = (typeof data.papers)[number];
const paperName = (p: Paper) => `${p.year} 年第${p.term === 1 ? "一" : "二"}次`;

function SectionHeading({ title, note }: { title: string; note: string }) {
  return (
    <header className="et-section-head">
      <h2>{title}</h2>
      <p>{note}</p>
    </header>
  );
}

function PracticeTrend() {
  const [mode, setMode] = useState(0);
  const points = data.practice;
  const x = (days: number) => 32 + ((53 - days) / 53) * 420;
  const y = (v: number) => 141 - (v / 80) * 115;
  const path = points
    .map((p, i) => `${i ? "L" : "M"}${x(p.days)},${y(p.values[mode])}`)
    .join(" ");
  const last = points[points.length - 1].values[mode];
  return (
    <section className="et-panel">
      <SectionHeading
        title="考前八週，練習量怎麼變？"
        note="固定 65 個帳號，包含當期沒有作答的人。每點是該時段每帳號每日平均保存的作答題次。前 18 段各 3 天，末段 2 天。"
      />
      <div className="et-mode" aria-label="練習模式">
        {modes.map((m, i) => (
          <button key={m} aria-pressed={mode === i} onClick={() => setMode(i)}>
            {m}
          </button>
        ))}
      </div>
      <div className="et-chart-wrap">
        <div className="et-plot-title">每帳號每日平均（題次）</div>
        <svg
          viewBox="0 0 480 173"
          role="img"
          aria-label={modes[mode] + "每三天平均作答題次，完整數值見下方明細"}
        >
          {[0, 20, 40, 60, 80].map((n) => (
            <g key={n}>
              <line className="et-grid" x1="32" x2="452" y1={y(n)} y2={y(n)} />
              <text x="23" y={y(n) + 4} textAnchor="end">
                {n}
              </text>
            </g>
          ))}
          <path className="et-area" d={path + " L452,141 L32,141 Z"} />
          <path className="et-line" d={path} />
          {points.map((p) => (
            <circle
              className="et-node"
              key={p.date}
              cx={x(p.days)}
              cy={y(p.values[mode])}
              r="2.7"
            />
          ))}
          {[53, 41, 29, 17, 0].map((days) => (
            <text key={days} x={x(days)} y="164" textAnchor="middle">
              {days} 天
            </text>
          ))}
        </svg>
        <div className="et-chart-foot">
          <span>距民國 115 年 7 月 17 日</span>
          <span>區間終點</span>
        </div>
      </div>
      <div className="et-readout">
        <span>
          首段 <b>{fmt(points[0].values[mode], 1)}</b>
        </span>
        <span>
          末段 <b>{fmt(last, 1)}</b> 題次／日
        </span>
      </div>
      <details>
        <summary>查看 19 個時段的數值</summary>
        <p>
          5/22 起每 3 天一組，最後一組為 7/15 至 7/17，共 2
          天。日期為原圖的區間終點。
        </p>
        <table>
          <thead>
            <tr>
              <th>民國 115 年</th>
              <th>距考</th>
              <th>{modes[mode]}（題次／日）</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date}>
                <td>{p.date}</td>
                <td>{p.days} 天</td>
                <td>{fmt(p.values[mode], 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function Combined() {
  const [label, setLabel] = useState("115-2");
  const row = data.combined.find((r) => r.label === label)!;
  return (
    <section className="et-panel">
      <SectionHeading
        title="同一考次，兩卷合計"
        note="站內以同帳號的醫學一、二配對，總分 200 分。官方及格率另以該梯次實際到考人數為分母。"
      />
      <label className="et-picker">
        選擇考次
        <select value={label} onChange={(e) => setLabel(e.target.value)}>
          {[...data.combined].reverse().map((r) => (
            <option key={r.label} value={r.label}>
              民國 {r.label.split("-")[0]} 年第
              {r.label.endsWith("1") ? "一" : "二"}次
            </option>
          ))}
        </select>
      </label>
      <div className="et-matrix">
        <div>
          <small>站內達 120 分</small>
          <strong>{row.pair ? fmt(row.pair.pct) + "%" : "未列"}</strong>
          <span>
            {row.pair
              ? `${row.pair.passed} 人達標／${row.pair.n} 個配對帳號`
              : "此考次無配對彙總"}
          </span>
        </div>
        <div>
          <small>站內平均總分</small>
          <strong>{fmt(row.pair?.mean ?? null)}</strong>
          <span>
            滿分 200 分{row.pair?.mean != null && ` · ${row.pair.n} 個帳號`}
          </span>
        </div>
        <div>
          <small>官方及格率</small>
          <strong>{fmt(row.official.pct)}%</strong>
          <span>
            {fmt(row.official.passed)} 人及格／{fmt(row.official.n)} 人到考
          </span>
        </div>
      </div>
      {label === "115-2" && (
        <p className="et-note">115 年第二次的站內數字來自考後保存的作答。</p>
      )}
    </section>
  );
}

function PaperTrend({ paper: p }: { paper: Paper }) {
  const x = (i: number) => 44 + i * 91;
  const y = (v: number) => 120 - v;
  const last = p.periods.length - 1;
  return (
    <section className="et-panel">
      <SectionHeading
        title="這份卷的考前表現"
        note="以首次符合題數的模考計算。分數以答對率標準化至百分制，平均與中位數用於描述這批作答者的卷面表現。"
      />
      <div className="et-matrix">
        <div>
          <small>平均分／100</small>
          <strong>{fmt(p.mean)}</strong>
          <span>{p.n} 個首作帳號</span>
        </div>
        <div>
          <small>中位數／100</small>
          <strong>{fmt(p.median)}</strong>
          <span>本卷 {p.questions} 題</span>
        </div>
        <div>
          <small>中間一半的分數</small>
          <strong>
            {p.q1 !== null && p.q3 !== null
              ? `${fmt(p.q1)}–${fmt(p.q3)}`
              : "未列"}
          </strong>
          <span>第 25 至 75 百分位</span>
        </div>
      </div>
      {p.mean === null && (
        <p className="et-note">
          {p.n === 0
            ? "考前沒有符合條件的首作。"
            : "原報告依樣本數或互補隱分規則保留分數。"}
        </p>
      )}
      <h3>同卷不同時段的平均分</h3>
      <p>依原報告五個時段，各段是不同帳號。截止時間均為台北時間 15:00。</p>
      {p.periods.some((t) => t.mean !== null) && (
        <svg
          viewBox="0 0 454 150"
          role="img"
          aria-label="本卷五個時段的百分制均分，下方逐段列出帳號數"
        >
          {[0, 50, 100].map((n) => (
            <g key={n}>
              <line className="et-grid" x1="35" x2="428" y1={y(n)} y2={y(n)} />
              <text x="25" y={y(n) + 3} textAnchor="end">
                {n}
              </text>
            </g>
          ))}
          {p.periods.map((t, i) => {
            if (t.mean === null) return null;
            const prev = p.periods[i - 1]?.mean;
            return (
              <g key={i}>
                {prev != null && (
                  <line
                    className="et-line"
                    x1={x(i - 1)}
                    y1={y(prev)}
                    x2={x(i)}
                    y2={y(t.mean)}
                  />
                )}
                <circle className="et-node" cx={x(i)} cy={y(t.mean)} r="3.6" />
                <text x={x(i)} y={y(t.mean) - 9} textAnchor="middle">
                  {fmt(t.mean)}
                </text>
              </g>
            );
          })}
          {p.periods.map((t, i) => (
            <text key={i} x={x(i)} y="141" textAnchor="middle">
              {i === last ? "7/17" : "≤ " + ["6/19", "6/26", "7/3", "7/10"][i]}
            </text>
          ))}
        </svg>
      )}
      <div className="et-periods">
        {p.periods.map((t, i) => (
          <div key={i}>
            <small>{periods[i]}</small>
            <b>{t.mean === null ? "未列" : fmt(t.mean) + " 分"}</b>
            <span>{t.n} 人</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Subjects({ paper: p }: { paper: Paper }) {
  return (
    <section className="et-panel">
      <SectionHeading
        title="各科的前 25% 與後 25%"
        note="同卷 100 題逐題取跨模式、跨日期的首次有效作答，再以全卷總分分組。同分不拆，中間兩組略去。長條顯示各組平均答對幾題。"
      />
      <div className="et-key">
        <span>前 25%</span>
        <span>後 25%</span>
      </div>
      {p.subjects.map((s) => (
        <article className="et-subject" key={s.name}>
          <div className="et-subtitle">
            <h3>{s.name}</h3>
            <span>
              {s.questions} 題 · {s.n} 個帳號
            </span>
          </div>
          {s.delta === null ? (
            <p>分組平均未列。全體平均答對 {fmt(s.mean)} 題。</p>
          ) : (
            <>
              <div className="et-bars">
                {[
                  { name: "前", value: s.high, n: s.highN },
                  { name: "後", value: s.low, n: s.lowN },
                ].map((g, i) => (
                  <div key={g.name}>
                    <span>{g.name} 25%</span>
                    <div className="et-track">
                      <i
                        className={i ? "low" : ""}
                        style={{ width: (g.value! / s.questions) * 100 + "%" }}
                      />
                    </div>
                    <b>{fmt(g.value)} 題</b>
                    <small>{g.n} 人</small>
                  </div>
                ))}
              </div>
              <p className="et-gap">
                相差 <b>{fmt(s.delta)} 題</b> · 全體平均 {fmt(s.mean)} 題
              </p>
            </>
          )}
        </article>
      ))}
      <details>
        <summary>扣除該科後分組的差距與口徑</summary>
        <p>
          原主分析以其他科總分排序，可減少該科本身參與分組造成的差距。兩種分組均沿用最後交付表的門檻，全卷至少
          30 人、兩端各至少 5 人才列差距。
        </p>
        <table>
          <thead>
            <tr>
              <th>科目</th>
              <th>前／後組人數</th>
              <th>答對率差（百分點）</th>
            </tr>
          </thead>
          <tbody>
            {p.subjects.map((s) => (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td>
                  {s.mainHighN}／{s.mainLowN}
                </td>
                <td>{fmt(s.gap)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

export default function Trends() {
  const [scope, setScope] = useState(0);
  const [key, setKey] = useState("115020-1301");
  const p = data.papers.find((p) => p.key === key)!;
  const summary = data.summary[scope];
  function changeScope(i: number) {
    if (i && p.med !== i)
      setKey(
        data.papers.find(
          (q) => q.year === p.year && q.term === p.term && q.med === i,
        )!.key,
      );
    setScope(i);
  }
  return (
    <main className="exam-trends">
      <header className="et-heading">
        <div>
          <div className="et-kicker">
            <span />
            醫師第一階段
          </div>
          <h1>國考趨勢</h1>
        </div>
        <div className="et-date">
          <CalendarDays size={15} /> 考前首作截至民國 115 年 7 月 17 日
        </div>
      </header>
      <section className="et-hero">
        <div className="et-count">
          <span className="et-eyebrow">考前有效首作</span>
          <div className="et-big">
            {fmt(data.summary[0].n)} <small>份</small>
          </div>
          <p>208 個帳號 · 62 份正式考卷</p>
          <span className="et-coverage">
            民國 100 年第一次至 115 年第一次，含醫學一、二。
          </span>
        </div>
        <div className="et-finding">
          <div className="et-eyebrow">
            <ArrowUpRight size={16} /> 首作成績變化
          </div>
          <h2>後三份卷的平均分較高</h2>
          <div className="et-deltas">
            <span>
              醫學一 <b>+3.35</b> 百分點 <small>83 人</small>
            </span>
            <span>
              醫學二 <b>+2.74</b> 百分點 <small>77 人</small>
            </span>
          </div>
          <p>
            同帳號至少做過六份不同卷，比較最早與最後三份。選卷與先前見題都可能影響差距。
          </p>
        </div>
      </section>
      <div className="et-nav" aria-label="資料視圖">
        {names.map((n, i) => (
          <button
            key={n}
            aria-pressed={scope === i}
            onClick={() => changeScope(i)}
          >
            {n}
          </button>
        ))}
      </div>
      {scope === 0 ? (
        <>
          <section className="et-over">
            <SectionHeading
              title="兩科首作表現"
              note="每個帳號在同一份卷只計一次，每份首作等權。選擇科別可查看各卷分布與分科表現。"
            />
            <div className="et-medcards">
              {[1, 2].map((i) => (
                <button key={i} onClick={() => changeScope(i)}>
                  <span>
                    {names[i]}
                    <ChevronRight size={18} />
                  </span>
                  <strong>
                    {fmt(data.summary[i].mean)}
                    <small> 分／100</small>
                  </strong>
                  <i style={{ width: data.summary[i].mean + "%" }} />
                  <em>
                    {fmt(data.summary[i].n)} 份首作 · {data.summary[i].accounts}{" "}
                    個帳號 · {data.summary[i].papers} 卷
                  </em>
                </button>
              ))}
            </div>
          </section>
          <PracticeTrend />
          <Combined />
        </>
      ) : (
        <>
          <section className="et-paperhead">
            <div className="et-eyebrow">
              <Layers3 size={16} />
              {names[scope]} · 單卷檢視
            </div>
            <h2>
              {paperName(p)} · {names[scope]}
            </h2>
            <p>
              本場考前首作 {p.n} 份 · {names[scope]}考前首作合計{" "}
              {fmt(summary.n)} 份
            </p>
            <label className="et-picker">
              選擇考卷
              <select value={key} onChange={(e) => setKey(e.target.value)}>
                {data.papers
                  .filter((q) => q.med === scope)
                  .map((q) => (
                    <option key={q.key} value={q.key}>
                      民國 {paperName(q)}
                      {q.n === 0 ? "（僅有考後分科）" : ""}
                    </option>
                  ))}
              </select>
            </label>
          </section>
          <PaperTrend paper={p} />
          <Subjects paper={p} />
        </>
      )}
      <details className="et-source">
        <summary>資料來源與納入條件</summary>
        <p>
          民國 115 年 11 月 4
          日《國考網站・已完成分析》的考前版。先篩有完成時間、可辨識正式考卷、摘要正確與錯誤題數合計符合
          80 或 100 題的模擬考，排除 AI
          卷、題數不合、截止後完成，以及每題平均牆鐘時間少於 3 秒且答對率 ≤40%
          或 ≥95% 的場次，再取每帳號每卷最早符合者。考前截止為 7 月 17 日
          15:00。小於 10 人或可回推小群者保留隱分。
        </p>
        <p>
          民國 115 年 11 月 11 日「國考說明會」53 頁版第 16–19
          頁提供官方及格率、站內兩卷配對及考前練習量。11 月 5 日 27 頁報告第 5
          頁記載三天區間與末段兩天。單卷成績沿用 11 月 4 日報告的五個時段。
        </p>
        <p>
          分科採 11 月 11 日各卷逐題首答彙總。母群為最早完成、100
          題均可核對的模考帳號。取每帳號每題最早有效作答，同時刻正誤衝突或缺正誤不以後次補足。考後分科樣本可與考前整卷樣本不同。
        </p>
      </details>
    </main>
  );
}

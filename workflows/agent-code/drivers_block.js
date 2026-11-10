// ---------- reasoning engine: driver model attribution (scripts/fit_driver_model.py, table team_07_driver_model) ----------
// The change against the SAME WEEKDAYS last year (date - 364) is split into exact contributions of a fitted model:
// season dates, Easter, Christmas/New Year, school holidays per market, new snow and the season level, plus a residual.
// Drivers are only reasons when their 90 % bootstrap range excludes 0 and the effect is large enough. Bookings, free beds
// and weekday patterns are kept as observations ("what we see", "where"), never as reasons.
const DM = c.model || null;
const GROUP_LABEL = { season_calendar: 'Season dates', weekday: 'Weekday mix', calendar: 'Holiday calendar (Easter, school holidays, Christmas)',
  snow: 'New snow', level: 'General level of the season' };
const MARKET_NAME = { DE: 'Germany', NL: 'Netherlands', BE: 'Belgium', CH: 'Switzerland', UK: 'United Kingdom', AT: 'Austria' };
const DRIVER_FACT = { calendar: 'f4.driver', snow: 'f7.driver', season_calendar: 'f12.season', weekday: 'f12.weekday', level: 'f12.level' };
let drivers = null;
const observations = [];
const ruled_out = [];
if (DM && Array.isArray(c.feat_a) && c.feat_a.length && change_type !== 'data_issue') {
  const FE = DM.spec.features, GR = DM.spec.groups;
  // Forecast-only periods: "why does the forecast expect this?" -> coefficients fitted on the forecast series itself
  // (same features); the bootstrap spread of the actuals model is reused around them for the 90 % range.
  const useFc = !hasAct && Array.isArray(DM.coef_fc) && DM.coef_fc.length === DM.coef.length;
  const BETA = useFc ? DM.coef_fc : DM.coef;
  const SAMPLES = useFc ? (DM.samples || []).map((sm) => sm.map((v, j) => v - DM.coef[j] + DM.coef_fc[j])) : (DM.samples || []);
  const byB = new Map((c.feat_b || []).map((r) => [r.date, r]));
  const yOf = new Map(period.map((d) => [d.date, hasAct ? d.actual : d.forecast]));
  const pairs = [];
  for (const a of c.feat_a) {
    const yA = yOf.get(a.date), b = byB.get(addDays(a.date, -364));
    if (yA === null || yA === undefined || !b || b.stays_hist === null || b.stays_hist === undefined) continue;
    pairs.push({ date: a.date, yA: Number(yA), yB: Number(b.stays_hist), xa: a.x, xb: b.x });
  }
  if (pairs.length) {
    const YA = pairs.reduce((s, p) => s + p.yA, 0), YB = pairs.reduce((s, p) => s + p.yB, 0), gap = YA - YB;
    const W = pairs.reduce((s, p) => s + p.yB + 1, 0);
    const idx = (g) => FE.map((f, j) => (GR[f] === g ? j : -1)).filter((j) => j >= 0);
    // effect in stays if only this driver had changed: YB x (exp(weighted mean log-difference) - 1)
    const effect = (beta, js) => {
      const D = pairs.reduce((s, p) => s + (p.yB + 1) * js.reduce((t, j) => t + beta[j] * (p.xa[j] - p.xb[j]), 0), 0) / W;
      return YB * (Math.exp(D) - 1);
    };
    const minAbs = Math.max(0.05 * Math.abs(gap), 0.01 * YB, 50);
    const rows = [...new Set(Object.values(GR))].filter((g) => g !== 'base').map((g) => {
      const js = idx(g);
      const val = effect(BETA, js);
      const sm = SAMPLES.map((s) => effect(s, js)).sort((p, q) => p - q);
      const lo = sm.length ? sm[Math.floor(0.05 * sm.length)] : val, hi = sm.length ? sm[Math.ceil(0.95 * sm.length) - 1] : val;
      // sub-parts of the holiday calendar: Easter, Christmas/New Year and each source market
      const part = (pred) => js.filter((j) => pred(FE[j]));
      const sub = g !== 'calendar' ? [] : [
        { key: 'easter', label: 'Easter', js: part((f) => f.startsWith('easter')) },
        { key: 'christmas', label: 'Christmas and New Year', js: part((f) => f.startsWith('xmas') || f.startsWith('newyear')) },
        ...part((f) => f.startsWith('hol_')).map((j) => ({ key: FE[j].replace('hol_', ''), label: `School holidays ${MARKET_NAME[FE[j].replace('hol_', '')] || FE[j]}`, js: [j] })),
      ].map((x) => ({ key: x.key, label: x.label, stays: Math.round(effect(BETA, x.js)) }))
        .filter((x) => Math.abs(x.stays) >= Math.max(50, 0.02 * Math.abs(gap))).sort((p, q) => Math.abs(q.stays) - Math.abs(p.stays));
      const significant = (lo > 0 || hi < 0) && Math.abs(val) >= minAbs;
      return { group: g, label: GROUP_LABEL[g] || g, role: g === 'level' ? 'trend' : 'cause', stays: Math.round(val), ci: [Math.round(lo), Math.round(hi)],
        significant, pct_of_gap: gap ? Math.min(999, Math.round((Math.abs(val) / Math.abs(gap)) * 100)) : null, sub };
    }).sort((p, q) => Math.abs(q.stays) - Math.abs(p.stays));
    const sumAll = rows.reduce((s, r) => s + r.stays, 0);
    const expl = rows.filter((r) => r.significant).reduce((s, r) => s + r.stays, 0);
    const month = String(Number(from.slice(5, 7)));
    const mm = (DM.metrics && DM.metrics.mape_by_month) || {};
    drivers = {
      version: DM.version, basis: hasAct ? 'actual' : 'forecast', coefficients: useFc ? 'fitted on the forecast' : 'fitted on actual stays', comparison: 'same weekdays last year (date - 364 days)',
      days: pairs.length, ya: YA, yb: YB, gap, gap_pct: pct(YA, YB), explained: Math.round(expl), residual: Math.round(gap - sumAll),
      unexplained_pct: Math.abs(gap) >= Math.max(0.03 * YB, 50) ? Math.max(0, Math.min(100, Math.round((Math.abs(gap - expl) / Math.abs(gap)) * 100))) : null,
      groups: rows, backtest_mape_month: mm[month] ?? null, backtest_mape: DM.metrics ? DM.metrics.mape_in_season_weeks : null,
      forecast_noise: DM.noise && DM.noise[month] ? DM.noise[month] : null, threshold: Math.round(minAbs),
    };
    const range = (r) => `90 % range ${fmt(r.ci[0])} to ${fmt(r.ci[1])}`;
    const signed = (n) => (n > 0 ? '+' : '') + fmt(n);
    F('f12.model', 'Change against the same weekdays last year (driver model)', `${signed(gap)} stays (${fmtPct(drivers.gap_pct)})`, `${fmt(YB)} stays last year`,
      `driver model ${DM.version}`, `explained by significant drivers: ${signed(drivers.explained)} stays; backtest error in this month: ${drivers.backtest_mape_month ?? '–'} %`);

    // The last-year column is the same CALENDAR date (a different weekday). The part of the change that disappears when
    // comparing with the same weekdays is a reason of its own: "last year's figure is for a different weekday".
    const calGap = hasAct ? totals.gap_py : totals.fc_vs_py;
    if (calGap !== null && calGap !== undefined && pairs.length === (hasAct ? withAct.length : period.length)) {
      const shift = calGap - gap;
      drivers.calendar_gap = calGap;
      drivers.weekday_shift = shift;
      const base = Math.abs(calGap) || 1;
      drivers.unexplained_pct = Math.abs(calGap) >= Math.max(0.03 * YB, 50)
        ? Math.max(0, Math.min(100, Math.round((Math.abs(calGap - shift - expl) / base) * 100))) : null;
      if (Math.abs(shift) >= Math.max(0.1 * Math.abs(calGap), 0.01 * YB, 50)) {
        const d0 = from, ly = `${Number(d0.slice(0, 4)) - 1}${d0.slice(4)}`;
        F('f12.alignment', 'Change against the same calendar date vs the same weekdays last year', `${signed(calGap)} vs ${signed(gap)} stays`, `${signed(shift)} stays from the weekday shift`, 'computed',
          `the same date last year was a ${WD[dow(ly)]}; the same weekday last year was ${dLong(addDays(d0, -364))}`);
        cand({
          finding_id: 'drv_weekday_shift', group: 'drv_weekday_shift', explains: 'both', direction: sgn(shift), covers: true, driver: true, role: 'cause',
          driver_pct: Math.min(100, Math.round((Math.abs(shift) / base) * 100)),
          title: 'Last year’s figure is a different weekday',
          statement: `The last-year number is for the same date, which was a ${WD[dow(ly)]} last year${period.length === 1 ? ` (this year a ${WD[dow(d0)]})` : ''}. ` +
            `Against the same weekdays last year the change is ${signed(gap)} stays instead of ${signed(calGap)}, so ${signed(shift)} stays of it come only from the weekday shift.`,
          strength: 1, reliability: 1, confidence: 'high', evidence_refs: ['f12.alignment', 'f12.model'],
        });
      }
    }

    // season dates around the period (for the season driver's wording)
    const S2 = (c.seasons || []).map((s) => ({ ...s, close: s.close && s.close < '2090-01-01' ? s.close : null }));
    const near = (iso) => S2.find((s) => s.open <= addDays(iso, 21) && (!s.close || s.close >= addDays(iso, -21)));
    const sNow = near(from), sPy = near(addDays(from, -364));

    for (const r of rows) {
      if (!r.significant) {
        ruled_out.push({ group: r.group, label: r.label, stays: r.stays,
          why: Math.abs(r.stays) < minAbs ? 'no real difference to last year' : 'effect uncertain: the range includes zero' });
        continue;
      }
      const fid = DRIVER_FACT[r.group];
      F(fid, `${r.label}: effect on stays (driver model)`, `${signed(r.stays)} stays`, range(r), `driver model ${DM.version}`);
      let statement = '', title = '', refs = [fid, 'f12.model'];
      const dir = r.stays < 0 ? 'fewer' : 'more';
      if (r.group === 'calendar') {
        const ef = factOf('f5.easter');
        const top = r.sub.filter((x) => Math.sign(x.stays) === Math.sign(r.stays)).slice(0, 3);
        const easterPart = r.sub.find((x) => x.key === 'easter');
        title = top.length && top[0].key === 'easter' ? (r.stays < 0 ? 'Easter moved away from these days' : 'Easter moved into these days')
          : r.stays < 0 ? 'Fewer source markets on holiday' : 'More source markets on holiday';
        statement = (ef && easterPart ? `Easter Sunday is on ${dLong(String(ef.now))} this year and was on ${dLong(String(ef.ref))} last year, and the school holidays move with it. ` : '') +
          `The holiday calendar ${r.stays < 0 ? 'costs' : 'adds'} ${fmt(Math.abs(r.stays))} stays against the same weekdays last year (${range(r)})` +
          (top.length ? `: ${top.map((x) => `${x.label} ${signed(x.stays)}`).join(', ')}` : '') + '.';
        if (ef) refs.unshift('f5.easter');
        refs = refs.concat(top.filter((x) => x.key.length === 2).map((x) => `f4.hol_${x.key}`).filter((id) => factOf(id)));
      } else if (r.group === 'season_calendar') {
        const bits = [];
        if (sNow && sPy) {
          if (sNow.close && sPy.close && sNow.close !== addDays(sPy.close, 364) && to >= addDays(sNow.close, -14)) bits.push(`the season closed on ${dLong(sNow.close)} (last year ${dLong(sPy.close)})`);
          if (sNow.open !== addDays(sPy.open, 364) && from <= addDays(sNow.open, 21)) bits.push(`the season opened on ${dLong(sNow.open)} (last year ${dLong(sPy.open)})`);
        }
        title = bits.length ? (r.stays < 0 ? 'Season dates cost stays' : 'Season dates added stays') : 'Time of the season';
        statement = (bits.length ? `Compared with the same weekdays last year, ${bits.join(' and ')}. ` : 'These days sit at a different point of the season than the same weekdays last year. ') +
          `Days close to opening or closing have far fewer guests. Effect: ${signed(r.stays)} stays (${range(r)}).`;
      } else if (r.group === 'snow') {
        title = r.stays < 0 ? 'Less new snow than last year' : 'More new snow than last year';
        statement = `New snow in the days before is ${r.stays < 0 ? 'lower' : 'higher'} than last year. Effect: ${signed(r.stays)} stays (${range(r)}).`;
        if (factOf('f7.weather')) refs.push('f7.weather');
      } else if (r.group === 'weekday') {
        title = 'Weekday mix';
        statement = `The mix of weekdays differs from last year. Effect: ${signed(r.stays)} stays (${range(r)}).`;
      } else if (r.group === 'level') {
        title = r.stays < 0 ? 'Lower general level this season' : 'Higher general level this season';
        statement = `After calendar effects, this season runs ${r.stays < 0 ? 'below' : 'above'} last season as a whole: ${signed(r.stays)} stays here (${range(r)}). The data does not break this broad trend down further.`;
      }
      const explains = !hasAct ? 'expected' : r.group === 'snow' ? 'miss' : r.group === 'level' ? 'both' : 'expected';
      const narrow = Math.abs(r.ci[1] - r.ci[0]) <= Math.abs(r.stays);
      const conf = r.role === 'trend' ? 'medium' : narrow && (drivers.backtest_mape_month === null || drivers.backtest_mape_month <= 15) ? 'high' : 'medium';
      cand({
        finding_id: `drv_${r.group}`, group: `drv_${r.group}`, explains, direction: sgn(r.stays), covers: true, driver: true, role: r.role,
        driver_pct: Math.min(100, r.pct_of_gap ?? 0), title, statement, strength: 1, reliability: 1, confidence: conf, evidence_refs: refs,
      });
    }
    // the heuristic calendar/weather findings are replaced by the model; the rest become observations
    for (let i = cands.length - 1; i >= 0; i--) {
      const x = cands[i];
      if (x.driver) continue;
      if (['easter_shift', 'school_holidays', 'weather', 'forecast_expected'].includes(x.finding_id)) { cands.splice(i, 1); continue; }
      observations.push({ kind: x.group === 'miss_pattern' ? 'where' : x.group === 'demand' ? 'what_we_see' : 'context',
        finding_id: x.finding_id, title: x.title, statement: x.statement, evidence_refs: x.evidence_refs, direction: x.direction < 0 ? 'down' : 'up' });
      cands.splice(i, 1);
    }
    // noise gate: a forecast miss inside the usual forecast error of this month is not a finding
    const nz = drivers.forecast_noise;
    if (hasAct && nz && totals.gap_fc_pct !== null && totals.gap_fc_pct !== undefined && Math.abs(totals.gap_fc_pct) <= nz.p80) {
      observations.unshift({ kind: 'noise', finding_id: 'forecast_noise', title: 'Within the normal forecast error',
        statement: `Actual stays are ${fmtPct(totals.gap_fc_pct)} against the forecast. In ${MON[Number(month) - 1]} the forecast is off by up to ${nz.p80} % on 80 % of days, so this gap is normal forecast noise.`,
        evidence_refs: ['f1.gap_fc'], direction: totals.gap_fc_pct < 0 ? 'down' : 'up' });
      drivers.miss_is_noise = true;
    }
    if (ev.now && !ev.py) ruled_out.push({ group: 'events', label: 'Events', stays: null, why: 'no event data for last year, so events cannot be compared' });
    if (totals.red_days + totals.yellow_days > 0 && hasAct) {
      observations.push({ kind: 'data', finding_id: 'data_flags', title: 'Days with data warnings',
        statement: `${totals.red_days} red and ${totals.yellow_days} yellow day(s) in this period: actual and forecast differ by more than 40 %, which can also be a data or forecast error.`,
        evidence_refs: factOf('f3.quality') ? ['f3.quality'] : [], direction: 'down' });
    }
  }
}

# Cycle tracking research for Perfect Boyfriend

Researched 2026-10-15 for Tim's request: *"also allow the user to track their girlfriends period so they can know specific things like how to treat them or whatnot. I like flo's period tracker and how it's smart and will predict future period and whatnot. Check how the algorithm has changed for this."*

Labels used below: **[confirmed]** means a primary source (peer-reviewed paper or the vendor's own help docs) says it. **[company claim]** means marketing, press or vendor case study with no independent check. **[reasoned]** means my own design inference.

Elicit's paper search was unavailable (the account plan has no API access, a paid upgrade), so scholarly sources came from web search of PubMed/PMC, arXiv, JAMIA, Cochrane and journal pages.

---

## 1. How Flo predicts, and how it changed

### Timeline

| When | What changed | Status |
|---|---|---|
| 2015 | Flo founded by Yuri and Dmitry Gurski (Belarus) as a period calendar. | confirmed (Wikipedia, TechCrunch) |
| 2015–2016 | **Plain "average woman" formula**: next period = last start + average cycle length. Vendor says this had a **5.6-day error** and users stopped trusting it, especially the ~30% with irregular cycles. | company claim (InData Labs case study) |
| Dec 2016 | Seed round; Flo says it built a **neural network** making predictions "up to 50% more accurate than traditional statistical models". | company claim (TechCrunch, 15 Dec 2016) |
| Aug 2017 | Founder: ML "increased predictions accuracy by **54.2%**", error **5.6 → 2.6 days**. "The more symptoms are logged, the more unique patterns the algorithm is likely to find." 50+ loggable symptoms used as inputs. | company claim (VentureBeat, 11 Aug 2017) |
| ~2017 (undated) | Vendor InData Labs describes the design: a **two-stage model**. Per-user ML models find each user's repeating patterns; those become features for a neural network with **400+ inputs** (cycle history, symptoms, mood, sleep, activity, age, height, weight, ovulation/pregnancy tests, wearable data) and **one output: next cycle length in days**. It retrains by comparing predictions with logged outcomes. Error metric (MAE vs RMSE) never defined; gains reported only for irregular cycles. | company claim |
| Jan 2021 | FTC settlement: Flo shared health data with Facebook/Google etc. 2016–2019 despite promises. Not an algorithm change, but shapes their later privacy features. | confirmed (FTC, press) |
| Feb 2021 | AWS blog: Flo uses ML "instead of simply combining data from a user's most recent cycles"; inputs include age, period days, symptoms; models trained on SageMaker GPUs. **Symptom prediction** had just finished its MVP; **ML ovulation/fertile-window prediction was "under investigation"** (so ovulation was still calendar-style then). | company blog, no accuracy numbers |
| Jun–Sep 2022 | **Anonymous Mode** (announced 30 Jun 2022 after Dobbs, rolled out Sep 2022): use the app with no name/email tied to the account, via Cloudflare Oblivious HTTP. Predictions work the same; it is a privacy change, not an algorithm change. FTC publicly disputed Flo's "we don't share data" framing. | confirmed (Flo press) |
| Oct 2023 | **Flo for Partners**: the user links a partner by pairing code and shares cycle info; she can stop sharing any time. (This is very close to Tim's idea; see section 5.) | confirmed (Flo help center / newsroom, 19 Oct 2023) |
| 2024 | Big descriptive papers using Flo data (Scientific Reports: cycles across lifespan, 19M users; JMIR 2020: 1.58M users, only 16% had a 28-day median cycle). Descriptive, **not** validation of predictions. | confirmed |
| 2025 | Wikipedia: moved analytics/AI onto Databricks for "personalized cycle predictions". | weak (secondary) |
| Ongoing | **Wearable temperature** can be synced (rings, watches; Oura trends); Flo's CTO says models were trained on wrist and finger skin temperature. | company claim |
| 12–13 Oct 2026 | **Google partnership + investment**: from **early 2027**, opt-in Fitbit/Google Health signals (sleep, heart rate, HRV, skin temperature, respiratory rate) feed Flo's cycle predictions; joint wearable planned, no device/date yet. | confirmed announcement (Google blog, trade press) |

### What Flo's own help docs say today [confirmed]
- **One logged period is enough** to show next period, ovulation day, fertile days, and a "delay" (late) state.
- Accuracy improves with **3+ cycles (ideally 12 months)** of history; ovulation tests and BBT refine ovulation.
- When it **can't predict cycle length reliably** (irregular cycles or sparse logging), it **widens the fertile window to ~14 days**.
- "Impossible to predict ovulation with 100% accuracy"; predictions are **not birth control**.
- "90% of users say Flo accurately predicts their period start" is a **user survey**, not a measured error.

### Bottom line on Flo
- **The real change**: calendar average (≈2015) → personalised neural network on cycle history + symptoms (2016–17) → more signals (wearable temperature; Fitbit from 2027). Ovulation is still essentially "count back from next period" unless temperature/LH data exists.
- **No peer-reviewed validation of Flo's prediction accuracy was found.** All accuracy numbers (50%, 54.2%, 5.6→2.6 days) are company/vendor claims from 2016–2017 with undefined metrics.
- **Reality check from independent research** (Li et al., JAMIA 2022, Clue data, 186k users, 2M cycles): at the start of a cycle, a plain **mean of past cycles had RMSE 7.50 days, the median 7.49, and their best model 7.38**; CNN/RNN/LSTM baselines did not beat it. The big gains came **later in the cycle** (day 40: 21.9 → 11.8 days RMSE) from **modelling skipped logs**. Lesson for us: a fancy model buys little for one person's data; **honest ranges, skipped-log handling, and updating when she's late** matter most. [confirmed paper; lesson reasoned]

---

## 2. Other trackers and papers worth borrowing from

### Clue (BioWink) [confirmed, help center]
- Predictions use the **last 12 cycles**; displayed averages use the **last 6**.
- **3 cycles** are enough for core predictions; irregular cycles need more.
- Period ends after **1 full day with no bleeding** logged. **Spotting never counts** as period.
- Predicted period length = average of recent period lengths (shown as light pink beyond what's logged).
- **Ovulation = predicted next period − 13 days**; positive LH tests or BBT override.
- Forgetting to log a period leaves the app showing "X days late" and predictions stale until it's logged.
- Clue's research (Li et al., npj Digit Med 2020, 378k users, 4.9M cycles): **CLD** (cycle length difference = |this cycle − previous|). Users with **median CLD > 9 days** are "consistently highly variable" (**7.7%** of users). Engagement cleaning: if a cycle's CLD exceeds the user's median CLD by **≥ 10 days**, drop the longer cycle (89% of these had no bleeding logged in the expected window, so they were missed logs). Cycles > 90 days excluded.
- Clue's separate FDA-cleared birth-control product (2021) uses a different algorithm.

### Apple Health Cycle Tracking [confirmed, Apple support]
- **Fertile window = 6 days, from counting back 13 days (luteal phase)** from the estimated next start; a positive LH test re-anchors day 5 of the window.
- Heart-rate data (on by default) and **wrist temperature** (Watch Series 8+/Ultra, worn overnight) refine period predictions and give **retrospective ovulation estimates** (after the fact, not forecasts).
- **Cycle deviation alerts** look at the **last 6 months** for irregular, infrequent, prolonged or spotting patterns. Logging a **cycle factor (pregnancy, lactation, contraceptive) turns deviation detection off.**
- Not for birth control.

### Natural Cycles [confirmed/company]
- BBT-based: detects the post-ovulation temperature rise (plus optional LH tests), labels each day red/green. **First FDA-cleared digital contraceptive (2018)**; wearable temperature cleared 2021; sixth clearance (Jul–Aug 2026) for a rebuilt algorithm giving more green days and better handling of irregular cycles and noisy data.
- Effectiveness **93% typical / 98% perfect use** (company figures). Needs daily temperature, so it's out of scope for a partner-logged app.

### Key population numbers
| Quantity | Value | Source |
|---|---|---|
| Mean cycle length | **29.3 ± 5.2 d** (612,613 ovulatory cycles, 124,648 users) | Bull 2019 |
| Only 28-day cycles | **13%** of cycles (Bull); **16%** of users had a 28-day median (Flo data) | Bull 2019; Grieger & Norman 2020 |
| 65% of cycles | 25–30 days | Bull 2019 |
| Within-person SD | **2.6 ± 2.5 d** (higher under 25 and over 40) | Bull 2019 |
| Luteal phase | **12.4 ± 2.4 d**; 18% of cycles under 11 d | Bull 2019 |
| Follicular phase | **16.9 ± 5.3 d**; this is where most variation lives | Bull 2019; Fehring 2006 |
| Bleed length | **4.0 ± 1.5 d** (Bull); 4.08 ± 1.76 (Clue) | Bull 2019; Li 2020 |
| Age trend | cycles shorten ~0.18 d/year from 25 to 45 | Bull 2019 |
| Normal range (FIGO 2018) | frequency **24–38 d**; bleeding ≤ **8 d**; regular if shortest-to-longest spread ≤ **7–9 d** (age-dependent) | Munro 2018 via StatPearls/MSD |
| Fertile window | **6 days ending on ovulation day** | Wilcox 1995 NEJM |
| Fertile timing is unpredictable | on every day 6–21 there's ≥10% chance of being fertile; only ~30% of women have the whole window inside days 10–17 | Wilcox 2000 BMJ |
| Fehring 2006 | mean 28.9 ± 3.4 d; 95% of cycles 22–36 d; 95% of fertile windows fall within days 4–23 | Fehring 2006 |

---

## 3. Recommended algorithm (plain JavaScript, no server, no paid service)

**Shape**: a pure function of the logged data, recomputed whenever a log is added or edited. It's a small Bayesian "shrink toward population, then trust her own history" model: Clue/Apple-style counting plus the honest uncertainty and skip handling the research shows matter most. **[reasoned design on confirmed constants]**

### Inputs
- `starts[]`: period start dates (YYYY-MM-DD). Optional `periodLengths[]`.
- Optional `usualLength` (the user types "about 30 days" on setup).
- `mode`: `natural` | `hormonal_bc` | `pregnant` | `postpartum` (and `stoppedBCOn` date).

### Step 1: cycle lengths and cleaning
`L_i = start_{i+1} − start_i` (whole days, computed in UTC date math; local-time math in JS gives DST off-by-one bugs).

Drop and **flag (ask the user, don't silently fix)**:
- `L < 15`: likely spotting or a double-tap. Ask "same period?"
- `L > 90`: missed logs, pregnancy, or birth control (Clue cohort rule).
- With ≥3 valid cycles and median `m`: if `L ≈ k·m` for k ≥ 2 (|L − k·m| ≤ max(4, 0.15·L)), it's probably **k cycles with a skipped log** (the Li et al. insight). Exclude it and prompt "did you miss logging a period around <date>?"
- Clue rule: exclude if `L − m ≥ medianCLD + 10`.

Use the most recent **12** kept cycles (Clue's window).

### Step 2: typical length (works from 0 cycles up)
Exponential weights, newest = 1, half-life **h = 6 cycles**: `w_i = 0.5^((n−1−i)/h)`.
- Weighted mean `m = Σ w_i L_i / Σ w_i`; effective count `n_eff = (Σw)² / Σw²`.
- Her within-person variance, shrunk toward population: `σ² = (κ·2.6² + (n−1)·s²) / (κ + n − 1)`, with `κ = 3` pseudo-cycles, `s²` her sample variance.
- Prior for her typical length: `μ0 = usualLength ?? 29`, `τ0 = 2` if she typed it, else `4.5` (between-person spread, ≈ √(5.2² − 2.6²) from Bull).
- Posterior (normal–normal):
  `μ̂ = (μ0/τ0² + n_eff·m/σ²) / (1/τ0² + n_eff/σ²)`
  `predSD = √(σ² + 1/(1/τ0² + n_eff/σ²))`

Behaviour: 1 logged period → 29 ± 5.2 d (≈ ±7 d window, wide and honest). Five steady 28-day cycles → 28 ± 1.9 d (±2 d window).

### Step 3: next period and window
- `next = lastStart + round(μ̂)`.
- **80% window**: `± clamp(round(1.28·predSD), 2, 10)` days. Show it as "likely Oct 14–18", like Flo's range.
- **Late handling** (today − lastStart = d > μ̂): condition on "hasn't started yet" with the truncated-normal mean `E[L | L > d] = μ̂ + predSD·φ(α)/(1 − Φ(α))`, `α = (d − μ̂)/predSD`, floored at d + 1. Show "**N days late**". If late by more than ~2·predSD + 5 days (or more than 7 days for a regular cycle), say predictions are paused until a period is logged and ask about a missed log. (Health interpretation of a late period is hers, not the app's.)
- Never show a window start earlier than today.

### Step 4: period length
`P = median(last 6 logged period lengths)`, default **5** when none logged (a common app default; the evidence mean is ~4, so 5 errs toward "still on her period").

### Step 5: ovulation, fertile window, phases
- **Ovulation cycle-day** `O = round(μ̂) − 13` (Apple and Clue both use 13; Bull mean 12.4 ± 2.4). Uncertainty `ovSD = √(σ² + 2²)`.
- **Fertile window** = days `O−5 … O` (Wilcox), **padded each side by `clamp(round(1.28·ovSD) − 2, 0, 4)`** so it grows to ~14 days when irregular (matches Flo's behaviour).
- **Phases** (cycle day 1 = first day of period, `Lr = round(μ̂)`):

| Phase | Cycle days | Note |
|---|---|---|
| Menstrual | 1 … P | |
| Follicular | P+1 … O−3 | length varies most between cycles |
| Ovulatory | O−2 … O+1 | estimate only, show as "around" |
| Luteal | O+2 … Lr | |
| PMS window (part of luteal) | Lr−4 … Lr (5 days before the period) | ACOG timing; only meaningful if *she* gets PMS |

### Step 6: irregular flag
`irregular = (max − min of last 6 cycles > 9 d) || σ > 4.5`. FIGO calls ≤ 7–9 d spread regular; Clue's "highly variable" is median CLD > 9. When irregular: show the wider window, label ovulation/phase days as rough, and lean on her logged symptoms more than phase notes.

### Step 7 (the "smart" part that's actually useful to a partner): her personal symptom pattern
For each symptom she or he logs (cramps, tired, headache, low mood, etc.), compute how often it appeared on each cycle day **counted relative to the next period start** (−7 … +4), across the last 3–6 cycles. If it shows up in ≥ 50% of cycles within ±1 day → "**She often has cramps on day 1–2**". This is the cheap version of Flo's symptom prediction and beats population tips, since her pattern is what matters. [reasoned]

### Step 8: honesty check (backtest on her own history)
Leave-one-out: predict each past cycle from the ones before it, then show "**predictions were within N days for the last K periods**". Costs nothing, builds trust, and replaces Flo-style unverifiable accuracy claims. [reasoned]

### Edge cases
| Case | Handling |
|---|---|
| Nothing logged | Ask for the last period start (and optionally usual length). No predictions. |
| 1 period logged | Use the prior (29, or typed usual length): wide window, phases marked "estimated". |
| 2–3 periods | Shrinkage blends prior and data automatically; no special code. |
| Skipped log | Step 1 detector + prompt; never silently split. |
| Logged late or edited past logs | Pure recompute from the full list; dedupe identical dates; reject future dates. |
| Very irregular (PCOS, teens, perimenopause) | Irregular flag, window capped at ±10 d, ovulation shown as rough. |
| Hormonal birth control (pill/patch/ring) | **Turn off ovulation, fertile window and phases** (ovulation is suppressed; the bleed is a withdrawal bleed set by the pack). Only show logged bleeds, or a simple pack-schedule reminder if she wants. |
| Hormonal IUD / implant / shot | Bleeding is often irregular or absent: log only, no predictions. |
| Stopped birth control | Ignore cycles before the stop date; early cycles can be longer and messier, so use the prior. |
| Pregnancy / postpartum / breastfeeding | Pause predictions (Apple turns off deviation detection for these factors). Restart from the first new period. |
| Two starts < 15 days apart | Ask "same period / spotting?" Spotting never starts a period (Clue rule). |
| Timezones / DST | Store date-only strings; do day math in UTC. |

A tested reference sketch (about 100 lines, no dependencies) is in `C:\Users\timha\AppData\Local\Temp\claude\c--Users-timha-OneDrive-Desktop-my-website-Code-Projects-Perfect-Boyfriend\34bbc7d2-01d6-4e21-91bd-2181d66134bb\scratchpad\cycle.mjs`. **Verified 2026-10-15 with `node t.mjs`** on synthetic cases:
- 1 period → 29 ± 5.2 d, window ±7 d.
- Five steady 28-day cycles → 28 d, ±2 d.
- A 58-day gap → flagged "2 cycles with a skipped log", prediction stays 29 d.
- Irregular history → σ 7.1, irregular flag, 14-day fertile window.
- 7 days late → "late: 7", next moved to tomorrow.
- Pill mode → paused.

Synthetic data only, not real logs.

---

## 4. Per-phase partner notes (evidence graded)

Ground rule from the evidence: **her own logs beat population averages.** Many women have no notable cycle-linked mood change, and the strongest controlled evidence says partner *understanding* helps more than "phase-based treatment". The UI shouldn't imply her feelings are "just hormones". [reasoned from Romans 2012, Ussher & Perz]

| Phase | What the evidence says | Supportive ideas | Evidence strength |
|---|---|---|---|
| **Menstrual (days 1–~5)** | Period pain (dysmenorrhea) is common: pooled ~59% in general-population samples, with study ranges of 16–91%. **NSAIDs relieve it** (Cochrane 2015, 80 RCTs: OR 4.37 vs placebo, low-quality evidence; ~18% get no relief). **Heat helps** (Jo & Lee 2018; Yuan 2026, 57 RCTs). Sleep is worse in the first days for women with cramps or PMS (Baker & Lee 2018). Exercise performance is only *trivially* lower in the early follicular/period days (McNulty 2020). | Heating pad or hot-water bottle, the painkiller she already uses on hand, flexible plans, easy food, letting her rest. Ask, don't assume. | **Moderate** for pain and heat; partner actions are common sense, not studied. |
| **Follicular (after period → pre-ovulation)** | No good evidence for a reliable "energy/mood high" phase. Performance differences across phases are trivial and low-quality (McNulty 2020). | Nothing phase-specific; normal life. Don't promise her a "good week". | **Weak**: avoid pop-science claims. |
| **Ovulatory (~2–4 days)** | Some feel mid-cycle (ovulation) pain; Clue tracks it as a symptom. A **rise in sexual desire around ovulation is contested**: Roney & Simmons 2013 found desire tracked estradiol up and progesterone down, but a 2023 critique says the data look more like a premenstrual dip and patterns are inconsistent across studies. **Peak fertility.** | If she gets mid-cycle pain, the same comfort as for cramps. Contraception matters most now, but **this app's estimate is not birth control**. | **Weak/contested** for libido; **strong** for fertility timing in general, but the *date* estimate is rough. |
| **Luteal / PMS (last ~5 days before period)** | PMS pooled prevalence **~48%**, with huge variation by measurement tool (Direkvand-Moghadam 2014). **PMDD** (severe, a DSM-5 depressive disorder) **~3–8%** (US), **~3.2%** worldwide. ACOG: PMS symptoms appear in the **5 days before** and end **within 4 days of** the period starting, over ≥ 3 cycles; common ones are **bloating, breast tenderness, irritability, tiredness, mood swings**. But **Romans 2012** (systematic review, 47 prospective studies): only **15%** found negative mood tied to the premenstrual phase alone, and **38% found no link** to any phase; stress, physical health and **social support predicted mood more than cycle phase**. Sleep complaints rise in the late-luteal days for women with PMS (Baker & Lee). | Patience, fewer demanding plans if *her* logs show a pattern, comfort food and sleep, checking in. **Never say "are you on your period?"** to dismiss a concern. If severe mood symptoms show up every cycle, PMDD is real and treatable: gently suggest a doctor; the app shouldn't diagnose. | Physical PMS: **moderate**. Mood "PMS" in general population: **weak/mixed**. Partner understanding: **small RCT** (below). |

**Partner support specifically**: Ussher & Perz (PLOS ONE 2017, Australian RCT, n = 83 women with severe PMS). The couple-based therapy arm had the most women reporting improved partner understanding (84% vs 39% one-to-one vs 19% waitlist), and 57% reported a better relationship. Small and self-reported, and figures come from press coverage; I didn't read the paper itself. An earlier small qualitative study linked partner empathy to less distress. **Supports the app's premise, weakly.**

---

## 5. Things Tim should decide (flagged, not decided)
- **Privacy and consent (his call)**: this is sensitive health data about *another person*. Flo's own history (FTC 2021, the 2025 Meta verdict, Anonymous Mode after Dobbs) shows why this matters. Plainest default: data stays on the device (or in his own private store), and she knows about it. Flo for Partners works the other way round: *she* owns the data and chooses to share it.
- **Existing free alternative**: **Flo for Partners** (Oct 2023) already lets a girlfriend share her Flo cycle with her partner. Tim may still want his own (integrated with the rest of Perfect Boyfriend), but it's worth knowing.
- **Whether to show the fertile window at all**: it's the riskiest output to misread as contraception. If shown, it needs a "not birth control" label (Flo, Clue and Apple all say this).

---

## Sources
Flo
- TechCrunch, 15 Dec 2016, Flo seed round / neural network: https://techcrunch.com/?p=1428689
- VentureBeat, 11 Aug 2017, "Flo raises $5 million for its AI-powered femtech app": https://venturebeat.com/business/flo-raises-5-million-for-its-ai-powered-femtech-app
- InData Labs case study (undated): https://indatalabs.com/?p=4550 and https://www.casestudies.com/company/indata-labs/case-study/flo-improves-cycle-prediction-accuracy-by-542-with-indata-labs
- AWS Startups blog, 19 Feb 2021, "Using machine learning to track periods with Flo": https://aws.amazon.com/blogs/startups/using-machine-learning-to-track-periods-with-flo
- Flo help center, "Checking your cycle predictions": https://help.flo.health/hc/en-us/articles/4406826523284-Checking-your-cycle-predictions
- Flo accuracy page (14-day fertile window widening; survey claim): https://flo.health/flo-accuracy
- Flo Anonymous Mode press release (2022): https://flo.health/press-center/flo-launches-anonymous-mode
- Flo for Partners (Oct 2023): https://flo.health/newsroom/flo-for-partners and https://help.flo.health/hc/en-us/articles/19871961988116-What-is-Flo-for-Partners
- Flo science and research publication list: https://med.flo.health/science-and-research
- Grieger & Norman, JMIR 2020;22(6):e17109 (Flo data, 1.58M users): https://www.jmir.org/2020/6/e17109/
- Flo lifespan study, Scientific Reports 2024: https://pmc.ncbi.nlm.nih.gov/articles/PMC11068910
- Google + Flo partnership, Oct 2026: https://blog.google/products-and-platforms/products/google-health/commitment-womens-health-flo-health-partnership/ ; https://thenextweb.com/news/google-flo-health-investment-womens-health-wearables ; https://tryterra.co/blog/flo-is-getting-into-wearables (12 Oct 2026)
- Wikipedia, Flo (app) (founding, Databricks 2025): https://en.wikipedia.org/wiki/Flo_(app)
- 2025 Meta jury verdict (Flo data): https://femtechinsider.com/california-jury-rules-meta-violated-privacy-laws-in-flo-health-data-case/
- FTC/Anonymous Mode context: https://mlexmarketinsight.com/news-hub/editors-picks/area-of-expertise/data-privacy-and-security/reproductive-health-location-privacy-claims-in-us-ftc-crosshairs-after-abortion-decision

Other trackers
- Clue, "How are my predictions and averages calculated?" (page blocked to the fetcher; contents via search snippets): https://support.helloclue.com/hc/en-us/articles/214434406-How-are-my-predictions-and-averages-calculated
- Clue, period end / spotting: https://support.helloclue.com/hc/en-us/articles/28389082270877-How-can-I-tell-the-app-that-my-period-has-ended
- Clue, forgot to track: https://support.helloclue.com/hc/en-us/articles/7955531533844-What-happens-if-I-forget-to-track-my-period
- Apple, "Track your period with Cycle Tracking": https://support.apple.com/120356
- Natural Cycles sixth FDA clearance (2026): https://femtechinsider.com/natural-cycles-receives-sixth-fda-clearance-for-ai-powered-fertility-algorithm/ ; wearables clearance 2021: https://wearable-technologies.com/news/natural-cycles-gets-fda-clearance-to-use-its-birth-control-app-with-wearables

Cycle science and prediction papers
- Bull et al., "Real-world menstrual cycle characteristics of more than 600,000 menstrual cycles", npj Digit Med 2019: https://pmc.ncbi.nlm.nih.gov/articles/PMC6710244
- Li, Urteaga et al., "A predictive model for next cycle start date that accounts for adherence in menstrual self-tracking", JAMIA 2022;29(1):3–11: https://academic.oup.com/jamia/article/29/1/3/6371799
- Li et al., arXiv 2102.12439 (generative model, skipped tracking): https://arxiv.org/abs/2102.12439
- Urteaga et al., MLHC 2021 (calibrated predictions): https://proceedings.mlr.press/v149/urteaga21a.html
- Li et al., "Characterizing physiological and symptomatic variation in menstrual cycles…", npj Digit Med 2020 (Clue, CLD > 9 d): https://pmc.ncbi.nlm.nih.gov/articles/PMC7250828
- Wilcox, Weinberg & Baird, NEJM 1995 (6-day fertile window): https://www.ovid.com/journals/nejm/pdf/10.1056/nejm199512073332301~timing-of-sexual-intercourse-in-relation-to-ovulation---
- Wilcox, Dunson & Baird, BMJ 2000 (fertile window timing): https://pmc.ncbi.nlm.nih.gov/articles/PMC27529
- Fehring, Schneider & Raviele 2006, "Variability in the phases of the menstrual cycle": https://pubmed.ncbi.nlm.nih.gov/16700687/
- FIGO 2018 normal parameters (via StatPearls / MSD): https://www.ncbi.nlm.nih.gov/books/NBK500020 ; https://www.msdmanuals.com/professional/multimedia/table/normal-menstrual-parameters

Partner / symptom evidence
- Direkvand-Moghadam et al. 2014, worldwide PMS prevalence meta-analysis: https://ijogi.mums.ac.ir/article_1877.html?lang=en ; PMS/PMDD prevalence protocol and context: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8735714/
- ACOG premenstrual disorders guideline summary (AAFP 2024): https://www.aafp.org/afp/2024/1200/practice-guidelines-premenstrual-disorders
- Romans et al. 2012, "Mood and the menstrual cycle", Gender Medicine (press summary): https://utoronto.ca/news/pms-may-not-exist-research-shows ; CIHR summary: https://cihr-irsc.gc.ca/e/documents/igh_mythbuster_pms-en.pdf
- Ussher & Perz 2017 couple-based PMS intervention (press coverage): https://www.news-medical.net/news/20170429/Couple-based-interventions-can-help-women-cope-with-premenstrual-distress.aspx
- Cochrane, NSAIDs for dysmenorrhoea (Marjoribanks 2015): https://cochranelibrary.com/cdsr/doi/10.1002/14651858.CD001751.pub3/pdf/CDSR/CD001751/CD001751_abstract.pdf
- Heat therapy meta-analyses: Jo & Lee 2018 https://pmc.ncbi.nlm.nih.gov/articles/PMC6214933 ; Yuan et al. 2026 https://www.frontiersin.org/journals/medicine/articles/10.3389/fmed.2025.1730505/full
- Baker & Lee 2018, "Menstrual cycle effects on sleep", Sleep Med Clin: https://www.sri.com/publication/biosciences-health-pubs/menstrual-cycle-effects-on-sleep/
- McNulty et al. 2020, exercise performance across the cycle, Sports Med: https://nrl.northumbria.ac.uk/id/eprint/43759
- Roney & Simmons 2013 and critique (sexual desire across the cycle): https://padovasexlab.dpss.psy.unipd.it/wp-content/uploads/2023/09/Kiesner-Mestrual-Cycle-Desire-2.pdf

### Not verified
- Ussher & Perz 2017 figures come from press coverage, not the paper.
- Clue's 12/6-cycle windows come from search snippets of a page that blocked direct fetch.
- The 59% dysmenorrhea pooled figure comes from a search summary; the original review wasn't opened.
- What Flo for Partners actually shows the partner, and whether it's free (product pages didn't render).

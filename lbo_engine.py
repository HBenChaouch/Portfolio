# -*- coding: utf-8 -*-
"""
Sidetrade LBO engine — Python mirror of the LBO_full Excel tab.
Purpose: (1) solve affordability EVs by bisection (Excel Goal Seek equivalent),
(2) compute sensitivity matrices, (3) provide expected values for the
self-check block in LBO_full (engine vs live formulas).

Conventions (per Build Spec v3, tax fixed 15-Jul-2026):
- Interest on OPENING debt (non-circular variant, documented deviation §3.4)
- Mandatory amort 1% of initial TLB; cash sweep 75% of excess over min cash
- ATAD cap MAX(3, 30% x EBITDA); statutory tax 25% IS + 3.3% contribution
  over EUR 0.763m, cash tax floored at 0
- CIR single-count convention: the DCF EBITDA/EBIT already include the CIR
  (EUR 3.5m flat, booked as operating subsidy). The CIR is therefore
  (i) EXCLUDED from taxable income (non-taxable per CGI) and
  (ii) NOT deducted a second time from cash tax.
  Previous version double-counted it (in EBITDA and again in the tax line) —
  fixed per portfolio audit note of 15-Jul-2026, section 4.6.
- Earn-outs + ezyCollect deferred settled at close (Uses)
- Rollover: Novasque 35% stake x 35% rolled = 12.25% of equity purchase
"""
import os
from openpyxl import load_workbook

_DIR = os.path.dirname(os.path.abspath(__file__))
WB = os.path.join(_DIR, "Sidetrade_Valuation_2026_v2.xlsx")
# Cached DCF values are read from the same workbook (data_only): run a full
# Excel/LibreOffice recalculation after any openpyxl save, which wipes them.
WB_DATA = WB

# ---- Deal parameters (Cat A/B/C/D per spec v3) -------------------------
EURIBOR_3M   = 0.02373   # 09-Jun-2026, euribor-rates.eu (verified)
TLB_SPREAD   = 0.0479    # S&P Eur LevFin Monthly Mar-2026, B median
ALL_IN       = EURIBOR_3M + TLB_SPREAD
LEV_MULT     = 4.0       # x EBITDA FY25 (Capstone Q1-26 mid-market band)
MAND_RATE    = 0.01      # 1% of original TLB per year
SWEEP_PCT    = 0.75
MIN_CASH     = 8.0
FEES_TXN_PCT = 0.03      # of Entry EV (Firmex mid-market band)
FEES_FIN_PCT = 0.03      # of new TLB (arrangement + OID)
RCF_FEE      = 0.075     # 50bps x EUR 15m undrawn, per year
NOVASQUE     = 0.35      # ownership (Sidetrade PR Feb-2026)
ROLLOVER     = 0.35      # share of his consideration rolled (Cat D)
EXIT_MULT    = 15.0
IS_RATE      = 0.25      # CGI art. 219
CONTRIB      = 0.033     # CGI art. 235 ter ZC, over threshold
CONTRIB_THR  = 0.763
CIR          = 3.5       # flat, per DCF assumption Inputs!B34
NET_DEBT_PRE = 14.654
GROSS_DEBT   = 30.981
CASH_PRE     = 16.327
EARNOUTS     = 0.455     # Amalto 277k + CreditPoint 178k (Note 29)
DEFERRED     = 1.459     # ezyCollect deferred consideration (Note 13)
EBITDA_FY25  = 13.384
HOLD         = 5

# ---- Scenario operating data (cached from DCF tab) ---------------------
_COLS = {"bear": ["B","E","H","K","N"], "base": ["C","F","I","L","O"], "bull": ["D","G","J","M","P"]}

def load_scenarios():
    wb = load_workbook(WB_DATA, data_only=True)
    dcf = wb["DCF"]
    out = {}
    for sc, cols in _COLS.items():
        out[sc] = {
            "ebitda": [dcf[f"{c}12"].value for c in cols],
            "ebit":   [dcf[f"{c}14"].value for c in cols],
            "da":     [dcf[f"{c}13"].value for c in cols],
            "capex":  [dcf[f"{c}19"].value for c in cols],  # negative
            "dwc":    [dcf[f"{c}20"].value for c in cols],  # negative
        }
    # Garde-fou chaîne (audit 16/07 §P1.1) : openpyxl vide les caches de
    # formules à chaque sauvegarde — si le classeur n'a pas été recalculé
    # par Excel/LibreOffice depuis, les valeurs lues sont None et TOUT le
    # modèle serait silencieusement faux. On échoue bruyamment à la place.
    missing = [(sc, k) for sc, d in out.items() for k, vals in d.items()
               for v in vals if v is None for _ in [0]][:5]
    if missing:
        raise RuntimeError(
            "Caches de formules absents dans le workbook (exemples: "
            f"{missing}). Ouvrir et recalculer le classeur dans Excel "
            "(CalculateFullRebuild) puis relancer — ne jamais enchaîner "
            "une sauvegarde openpyxl sans recalcul.")
    return out

# ---- Core model ---------------------------------------------------------
def run_lbo(ev, sc_data, lev_mult=LEV_MULT, exit_mult=EXIT_MULT):
    tlb = lev_mult * EBITDA_FY25
    equity_purchase = ev - NET_DEBT_PRE
    rollover = NOVASQUE * ROLLOVER * equity_purchase
    uses = (equity_purchase + GROSS_DEBT + EARNOUTS + DEFERRED
            + FEES_TXN_PCT * ev + FEES_FIN_PCT * tlb + MIN_CASH)
    sponsor_entry = uses - tlb - CASH_PRE - rollover
    equity_at_close = ev - (tlb - MIN_CASH)
    mgmt_pct = rollover / equity_at_close

    debt, cash = tlb, MIN_CASH
    carry = 0.0
    years = []
    for t in range(HOLD):
        opening = debt
        interest = opening * ALL_IN
        fin = interest + RCF_FEE
        cap = max(3.0, 0.30 * sc_data["ebitda"][t])
        deduct = min(fin, cap)
        carry += fin - deduct
        taxable = sc_data["ebit"][t] - CIR - deduct   # CIR non-taxable (single count)
        theo_is = max(0.0, IS_RATE * taxable)
        contrib = CONTRIB * max(0.0, theo_is - CONTRIB_THR)
        cash_tax = max(0.0, theo_is + contrib)        # no second CIR deduction
        ni = sc_data["ebit"][t] - fin - cash_tax
        mand = min(MAND_RATE * tlb, opening)
        cbs = cash + ni + sc_data["da"][t] + sc_data["capex"][t] + sc_data["dwc"][t] - mand
        excess = max(0.0, cbs - MIN_CASH)
        sweep = min(SWEEP_PCT * excess, opening - mand)
        debt = opening - mand - sweep
        cash = cbs - sweep
        years.append(dict(opening=opening, interest=interest, fin=fin, cap=cap,
                          deduct=deduct, taxable=taxable, theo_is=theo_is,
                          contrib=contrib, cash_tax=cash_tax, ni=ni, mand=mand,
                          cbs=cbs, sweep=sweep, closing_debt=debt, closing_cash=cash))

    exit_ev = sc_data["ebitda"][4] * exit_mult
    exit_equity = exit_ev - debt + cash
    sponsor_exit = exit_equity * (1 - mgmt_pct)
    irr = (sponsor_exit / sponsor_entry) ** (1 / HOLD) - 1 if sponsor_entry > 0 else float("nan")
    return dict(ev=ev, tlb=tlb, equity_purchase=equity_purchase, rollover=rollover,
                uses=uses, sponsor_entry=sponsor_entry, equity_at_close=equity_at_close,
                mgmt_pct=mgmt_pct, years=years, exit_ev=exit_ev, exit_equity=exit_equity,
                sponsor_exit=sponsor_exit, irr=irr, mom=sponsor_exit / sponsor_entry,
                carry=carry)

def solve_ev(target_irr, sc_data, lo=60.0, hi=600.0):
    for _ in range(80):
        mid = (lo + hi) / 2
        if run_lbo(mid, sc_data)["irr"] > target_irr:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2

# ---- Main ---------------------------------------------------------------
if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    data = load_scenarios()

    print("=== Scenario data check (2030 EBITDA) ===")
    for sc in ("bear", "base", "bull"):
        print(f"  {sc}: EBITDA30={data[sc]['ebitda'][4]:.3f}  EBIT30={data[sc]['ebit'][4]:.3f}")

    print(f"\nAll-in rate: {ALL_IN:.4%}  |  TLB: {LEV_MULT}x = {LEV_MULT*EBITDA_FY25:.3f}")

    print("\n=== Affordability (9 goal-seeks) ===")
    targets = [0.18, 0.225, 0.25]
    afford = {}
    for sc in ("bear", "base", "bull"):
        afford[sc] = [solve_ev(t, data[sc]) for t in targets]
        print(f"  {sc:5s}: " + "  ".join(f"IRR {t:.1%} -> EV {e:7.2f}" for t, e in zip(targets, afford[sc])))

    print("\n=== Base @ its 22.5% solve: year-by-year ===")
    r = run_lbo(afford["base"][1], data["base"])
    print(f"  EV={r['ev']:.2f} TLB={r['tlb']:.2f} SponsorEntry={r['sponsor_entry']:.2f} "
          f"Rollover={r['rollover']:.2f} Mgmt%={r['mgmt_pct']:.2%}")
    for i, y in enumerate(r["years"]):
        print(f"  {2026+i}: open={y['opening']:6.2f} int={y['interest']:5.2f} tax={y['cash_tax']:5.2f} "
              f"ni={y['ni']:6.2f} sweep={y['sweep']:6.2f} debt={y['closing_debt']:6.2f} cash={y['closing_cash']:6.2f}")
    print(f"  Exit: EV={r['exit_ev']:.2f} equity={r['exit_equity']:.2f} sponsor={r['sponsor_exit']:.2f} "
          f"IRR={r['irr']:.2%} MoM={r['mom']:.2f}x")

    print("\n=== Check IRR at DCF Base EV 301.19 ===")
    chk = run_lbo(301.19, data["base"])
    print(f"  IRR={chk['irr']:.2%} MoM={chk['mom']:.2f}x")

    print("\n=== Sensitivity 1: Entry EV x Exit multiple -> IRR (Base) ===")
    evs = [250, 275, 300, 325, 350]
    exits = [12, 13, 15, 17, 19]
    for ev in evs:
        row = [run_lbo(ev, data["base"], exit_mult=x)["irr"] for x in exits]
        print(f"  EV {ev}: " + "  ".join(f"{v:6.1%}" for v in row))

    print("\n=== Sensitivity 2: Leverage x Exit multiple -> IRR (Base, EV=300) ===")
    levs = [3.0, 3.5, 4.0, 4.5, 5.0]
    for lv in levs:
        row = [run_lbo(300, data["base"], lev_mult=lv, exit_mult=x)["irr"] for x in exits]
        print(f"  {lv}x: " + "  ".join(f"{v:6.1%}" for v in row))

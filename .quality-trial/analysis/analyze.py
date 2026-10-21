# Per-instrument tables from findings-classified.csv: python3 -I .quality-trial/analysis/analyze.py
import csv, collections as C, os
HERE=os.path.dirname(os.path.abspath(__file__))
rows=list(csv.DictReader(open(os.path.join(HERE,'findings-classified.csv'))))
cats=sorted({r['category'] for r in rows})
V=['real','nit','known','decision','noise','dropped']
print("verdict totals", C.Counter(r['verdict'] for r in rows))
print("found_by totals", C.Counter(r['found_by'] for r in rows))
uniq=[r for r in rows if not r['same_defect_as']]
print("unique defects", len(uniq))
print("\n== category x verdict (unique defects) ==")
print("cat".ljust(24), *[v[:5].rjust(6) for v in V])
for c in cats:
    cc=C.Counter(r['verdict'] for r in uniq if r['category']==c)
    print(c.ljust(24), *[str(cc[v]).rjust(6) for v in V])
FB=['blind-review','principles-review','architecture-review','spec-review','code-review','ponytail-review','coderabbit','fallow','ast-grep','stryker','typecheck','test-or-live-check','browser','deploy-readiness','overlap-check','me','human','gate']
print("\n== category x found_by (real+nit, all attributions) ==")
print("cat".ljust(24), *[f[:6].rjust(7) for f in FB])
for c in cats:
    cc=C.Counter(r['found_by'] for r in rows if r['category']==c and r['verdict'] in('real','nit'))
    print(c.ljust(24), *[str(cc[f]).rjust(7) for f in FB])
H=['static','reading','running','human-domain']
print("\n== category x how (REAL only, unique) ==")
for c in cats:
    cc=C.Counter(r['how_found'] for r in uniq if r['category']==c and r['verdict']=='real')
    print(c.ljust(24), *[f"{h}:{cc[h]}" for h in H])
print("\n== static tools real/nit ==")
for r in rows:
    if r['found_by'] in('fallow','ast-grep','coderabbit','semgrep','typecheck') and r['verdict'] in ('real','nit'):
        print(r['id'],r['found_by'],r['verdict'],r['category'],r['same_defect_as'],r['finding'][:60])
print("\n== static noise by tool ==", C.Counter(r['found_by'] for r in rows if r['found_by'] in('fallow','ast-grep','coderabbit') and r['verdict']=='noise'))
print("\n== human found_by real, category ==", C.Counter(r['category'] for r in rows if r['found_by']=='human' and r['verdict']=='real'))
print("\n== recurrence classes ==")
rc=C.defaultdict(list)
for r in rows:
    if r['recurrence_class']: rc[r['recurrence_class']].append(r)
for k,v in sorted(rc.items(), key=lambda kv:-len({x['date'] for x in kv[1]})):
    dates=sorted({x['date'][5:] for x in v})
    print(k, len(v), dates, C.Counter(x['verdict'] for x in v).most_common(), C.Counter(x['found_by'] for x in v).most_common())

print("\n== real by severity and found_by (rows with severity only) ==")
sev=C.defaultdict(C.Counter)
for r in rows:
    if r['verdict']=='real' and r.get('severity'): sev[r['found_by']][r['severity']]+=1
if not sev: print("  none yet (severity recorded from 2026-10-16)")
for k,c in sorted(sev.items(), key=lambda kv:-(kv[1]['H']*9+kv[1]['M']*3+kv[1]['L'])):
    print(" ", k.ljust(20), f"H {c['H']}  M {c['M']}  L {c['L']}")

import os
if os.path.exists(os.path.join(HERE,'runs.csv')):
    runs=list(csv.DictReader(open(os.path.join(HERE,'runs.csv'))))
    print(f"\n== yield per run ({len(runs)} runs in runs.csv) ==")
    if not runs: print("  none yet (runs recorded from 2026-10-16)")
    by=C.defaultdict(lambda: {'n':0,'real':0,'noise':0,'tok':0,'min':0.0})
    num=lambda v: float(v) if v not in ('',None) else 0.0
    for r in runs:
        b=by[r['instrument']]; b['n']+=1; b['real']+=num(r['findings_real']); b['noise']+=num(r['findings_noise'])+num(r['findings_dropped'])
        b['tok']+=num(r['tokens']); b['min']+=num(r['minutes'])
    for k,b in sorted(by.items(), key=lambda kv:-kv[1]['real']/kv[1]['n']):
        per=f"{b['tok']/b['real']/1000:.0f}k tok/real" if b['real'] and b['tok'] else "-"
        print(" ", k.ljust(20), f"runs {b['n']:3d}  real/run {b['real']/b['n']:.2f}  noise/run {b['noise']/b['n']:.2f}  min/run {b['min']/b['n']:.1f}  {per}")

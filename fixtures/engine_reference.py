import json, os, datetime as dt
D=dt.date; one=dt.timedelta(days=1)
ev=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'sheet-a.json')))
def build():
    moves=[]; sundays={}
    for d,a in ev:
        d=D.fromisoformat(d)
        if d.weekday()==6 and d>=D(2025,1,12) and a>=2:
            sundays[d]=2.0
            if a>2: moves.append((d,a-2))
        else: moves.append((d,a))
    return moves,sundays
def rate(rates,d):
    r=0
    for f,a in rates:
        if f<=d: r=a
    return r
def series(start,end,moves,sundays,rates,today,ghost=False,future=False,allow=2.0,afrom=D(2025,1,12)):
    flows={}
    for d,a in moves: flows[d]=flows.get(d,0)+a
    for d,v in sundays.items():
        add = v if v>0 else (allow if ghost else 0)
        flows[d]=flows.get(d,0)+add
    if future:
        d=today+one
        while d<=end:
            if d.weekday()==6: flows[d]=flows.get(d,0)+allow
            d+=one
    b=0; tot=0; out={}; d=start
    while d<=end:
        it=b*rate(rates,d)/365 if d>start else 0
        b+=it+flows.get(d,0); tot+=it; out[d]=(b,it,tot); d+=one
    return out
def pending(sundays,today,afrom=D(2025,1,12)):
    d=afrom; p=[]
    while d<=today:
        if d.weekday()==6 and d not in sundays: p.append(d)
        d+=one
    return p
S=D(2025,1,1); T=D(2026,10,10); B=D(2027,4,10)
R=[(S,0.12)]
m,s=build()
p=pending(s,T)
print('V1 pending',len(p),[str(x) for x in p])
a=series(S,B,m,s,R,T)
print('V2 balance today',round(a[T][0],6),'interest total',round(a[T][2],6))
wk=sum(a[T-dt.timedelta(days=k)][1] for k in range(7)); print('V5 interest today',round(a[T][1],6),'week',round(wk,6))
print('V6 milestone',round(2/((1+0.12/365)**7-1),4))
s_b=dict(s); s_b.update({d:2.0 for d in p}); print('V7 all pending banked',round(series(S,T,m,s_b,R,T)[T][0],6))
s_k=dict(s); s_k.update({d:0 for d in p}); g=series(S,B,m,s_k,R,T,ghost=True,future=True); print('V8 all kept, ghost today',round(g[T][0],6),'ghost at bday',round(g[B][0],6))
fut=series(S,B,m,s,R,T,future=True); print('V9 bday with coins',round(fut[B][0],6),'without',round(a[B][0],6))
R2=[(S,0.12),(D(2026,11,1),0.08)]; print('V10 rate 8% from 2026-11-01, bday no coins',round(series(S,B,m,s,R2,T)[B][0],6))
x=series(S,S+dt.timedelta(days=365),[(S,100.0)],{},R,T); print('V0 100 on day0 after 365d',round(x[S+dt.timedelta(days=365)][0],6))
print('V4 bal 2025-12-31',round(a[D(2025,12,31)][0],6))

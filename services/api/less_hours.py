"""Bounded integer planning: retain income and minimize total monthly minutes."""
from array import array
from collections import deque
from engine import ENGINE_VERSION, MAX_MONTHLY_MINUTES


def less_hours(works, expenses, available):
    base_counts=[w['quantity'] for w in works]
    base_revenue=sum(n*w['net_cents'] for n,w in zip(base_counts,works))
    base_minutes=sum(n*w['minutes'] for n,w in zip(base_counts,works))
    lower=[max(w['quantity'],w.get('completed',0)) if w['max_extra']==0 or w.get('type')=='Serviço mensal' else w.get('completed',0) for w in works]
    upper=[lower[i] if w['max_extra']==0 or w.get('type')=='Serviço mensal' else max(w['quantity']+w['max_extra'],lower[i]) for i,w in enumerate(works)]
    capacity=min(base_minutes-1,available,MAX_MONTHLY_MINUTES)
    base={'engine_version':ENGINE_VERSION,'baseline_revenue_cents':base_revenue,'baseline_net_cents':base_revenue-expenses,'baseline_minutes':base_minutes,'expenses_cents':expenses,'scenarios':[]}
    if base_revenue<=0 or capacity<0:return base

    def solve(lo,hi):
        forced_minutes=sum(n*w['minutes'] for n,w in zip(lo,works))
        forced_revenue=sum(n*w['net_cents'] for n,w in zip(lo,works))
        room=capacity-forced_minutes
        if room<0 or any(a>b for a,b in zip(lo,hi)):return None
        values=[-1]*(room+1);values[0]=0;choices=[]
        # Sliding-window maximum per minute residue gives O(works * capacity),
        # independent of the number of units. Each stage has its own backtrack.
        for i,w in enumerate(works):
            duration=w['minutes'];price=w['net_cents'];limit=hi[i]-lo[i]
            next_values=[-1]*(room+1);choice=array('i',[-1])*(room+1)
            for residue in range(min(duration,room+1)):
                queue=deque()
                for k,t in enumerate(range(residue,room+1,duration)):
                    while queue and queue[0][0]<k-limit:queue.popleft()
                    if values[t]>=0:
                        score=values[t]-k*price
                        while queue and queue[-1][1]<=score:queue.pop()
                        queue.append((k,score))
                    if queue:
                        prev,score=queue[0];next_values[t]=score+k*price;choice[t]=k-prev
            values=next_values;choices.append(choice)
        reached=next((t for t,v in enumerate(values) if v>=0 and v+forced_revenue>=base_revenue),None)
        if reached is None:return None
        counts=lo.copy();cursor=reached
        for i in reversed(range(len(works))):
            n=choices[i][cursor];counts[i]+=n;cursor-=n*works[i]['minutes']
        revenue=sum(n*w['net_cents'] for n,w in zip(counts,works))
        minutes=sum(n*w['minutes'] for n,w in zip(counts,works))
        assert revenue>=base_revenue and minutes<base_minutes and minutes<=available and minutes<=MAX_MONTHLY_MINUTES
        return {'counts':counts,'revenue_cents':revenue,'net_cents':revenue-expenses,'minutes':minutes,'saved_minutes':base_minutes-minutes,'items':[{'work_id':w['id'],'name':w['name'],'quantity':n,'previous_quantity':w['quantity'],'revenue_cents':n*w['net_cents'],'minutes':n*w['minutes']} for n,w in zip(counts,works) if n or w['quantity']]}

    first=solve(lower,upper)
    if first is None:return base
    pool={tuple(first['counts']):first}
    # Exact constrained solves explore different allocations, rather than adding
    # one redundant consultation to make three nearly identical cards.
    for i in range(len(works)):
        if lower[i]==upper[i]:continue
        for numerator in (1,2,3):
            cap=lower[i]+(first['counts'][i]-lower[i])*numerator//4
            if cap<first['counts'][i]:
                hi=upper.copy();hi[i]=cap
                row=solve(lower,hi)
                if row:pool[tuple(row['counts'])]=row
            floor=lower[i]+(upper[i]-lower[i])*numerator//4
            if floor>first['counts'][i]:
                lo=lower.copy();lo[i]=floor
                row=solve(lo,upper)
                if row:pool[tuple(row['counts'])]=row
    selected=[first]
    scales=[max(1,b-a) for a,b in zip(lower,upper)]
    while len(selected)<3:
        candidates=[r for key,r in pool.items() if key not in {tuple(s['counts']) for s in selected} and all(sum(abs(a-b)*1000//scale for a,b,scale in zip(r['counts'],s['counts'],scales))>=200 for s in selected)]
        if not candidates:break
        row=max(candidates,key=lambda r:(min(sum(abs(a-b)*1000//scale for a,b,scale in zip(r['counts'],s['counts'],scales)) for s in selected),-r['minutes'],-r['revenue_cents'],tuple(r['counts'])))
        selected.append(row)
    return {**base,'scenarios':[{**r,'label':'Menor tempo possível' if i==0 else f'Outra combinação {i}'} for i,r in enumerate(selected)]}

"""Build the public, buildless site from its reviewed corpus. Python stdlib only."""
from pathlib import Path
import json,re,csv,hashlib,unicodedata,collections,sys
from order_data import compile_order_data

ROOT=Path(__file__).resolve().parents[1];RESEARCH=ROOT/'research';OUT=ROOT/'docs/data'
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def norm(s):return re.sub(r'\s+','',unicodedata.normalize('NFKC',s))
def emit(name,obj):
    (OUT/name).write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
def csvout(name,heads,rows):
    with (OUT/name).open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.writer(f,lineterminator='\n');w.writerow(heads);w.writerows(rows)

PEOPLE=[
 {'id':'student','name':'在学与初入职场','short':'在学 / 初入职场'},
 {'id':'office','name':'办公室与专业岗位','short':'办公室 / 专业岗位'},
 {'id':'field','name':'现场与技能岗位','short':'现场 / 技能岗位'},
 {'id':'flex','name':'灵活与平台就业','short':'灵活 / 平台就业'},
 {'id':'selfemployed','name':'个体与小微经营','short':'个体 / 小微经营'},
 {'id':'transition','name':'待业、转岗与再就业','short':'待业 / 转岗'},
 {'id':'older','name':'临近退休与退休','short':'临近退休 / 退休'},
]
DOMAINS=[{'id':i,'name':n} for i,n in [('education','教育'),('employment','就业'),('housing','住房'),('health','健康'),('life','生活'),('retirement','养老')]]
ACTION_PRIORITIES=[
 {'rank':1,'name':'基本保障','description':'涉及基本收入、居住、医疗和养老保障，或在适用条件下拖延可能造成较大损失。'},
 {'rank':2,'name':'日常改善','description':'有助于减少日常支出、改善工作和家庭安排，通常需要比较条件后办理。'},
 {'rank':3,'name':'长期准备','description':'用于学习探索、能力积累和可选优化，可根据时间与资源逐步安排。'},
]
RULES=[
 '主语料为六五至十五五十期官方公开文本。六五、七五采用官方公开摘要，未采用完整书版。',
 '统计从正文首个顶层部分开始，排除目录、序言/绪论、前置引言及网页页脚；包含标题与可提取的文字表格，未转写全部图像文字。',
 '统一全半角、去除空白后作字面精确匹配；每万汉字次数＝出现次数÷同一范围的U+4E00—U+9FFF汉字数×10000。',
 '八五含十年规划，九五含2010年远景目标，十四五含2035年远景目标；跨期比较不能忽略篇幅、版本与任务范围。',
 '保留篇、编、章及顶层部分的原始层级，不把章序与篇序直接相减，相对位置仅表示编排位置，需结合目标和具体条文理解。',
 '正文引文均校验为所标章节内的连续片段。展示使用提取文本的标点和字形；原件缺失的标点不补写。',
 '词频库含85个预选词；逐次命中库只覆盖14个重点词。一个词为零不等于相关议题不存在，不同词的次数不可相加为重要性。',
 '十五五在实施中。历史部署、未来目标与已经兑现的个人权利分别对待；本站没有逐地核验现行待遇或完成情况。',
]

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    sources=read(RESEARCH/'sources.json');heads=read(RESEARCH/'headings.json');terms=read(RESEARCH/'terms.json');locations=read(RESEARCH/'locations.json')
    order_topics=read(RESEARCH/'order-topics.json')
    trajectory,order_periods=compile_order_data(order_topics,heads,sources)
    by_plan={s['id']:s for s in sources};texts={};lines={};counts={};freq=[]
    for s in sources:
        p=RESEARCH/s['corpus'];raw=p.read_bytes()
        assert hashlib.sha256(raw).hexdigest()==s['corpus_sha256'],f"Corpus hash differs: {s['name']}"
        lines[s['id']]=raw.decode('utf-8').splitlines();t=norm(raw.decode('utf-8'));texts[s['id']]=t
        assert len(lines[s['id']])==len(locations[str(s['id'])])
        denominator=len(re.findall('[\u4e00-\u9fff]',t));assert denominator==s['body_hanzi']
        for term in terms:
            n=t.count(term);freq.append({'plan_id':s['id'],'term':term,'count':n,'normalized':n/denominator*10000})
    groups=collections.defaultdict(list)
    for h in heads:groups[(h['plan_id'],h['level'])].append(h)
    for key,rows in groups.items():assert [h['number'] for h in rows]==list(range(1,len(rows)+1)),key
    evidence=[];actions=[];findings=[]
    for filename,prefix,kind in [('actions-source.json','A','actions'),('development-actions.json','D','actions'),('practical-actions.json','P','actions'),('findings-source.json','F','findings')]:
        content=read(ROOT/'scripts'/filename);ids={x['id']:prefix+'-'+x['id'] for x in content['evidence']}
        for e in content['evidence']:
            level=e.get('heading_level','章');pid=e['plan_id']
            h=next(x for x in heads if x['plan_id']==pid and x['level']==level and x['number']==e['chapter_num'])
            candidates=[x for x in heads if x['plan_id']==pid and x['line']>h['line'] and (x['level']==level or (level=='章' and x['level']!='章'))]
            end=min([x['line']-1 for x in candidates],default=len(lines[pid]))
            section=norm('\n'.join(lines[pid][h['line']-1:end]));phrase=norm(e['phrase'])
            assert phrase in section,f"Quote not found in section: {e['id']} / {pid} / {level}{e['chapter_num']}"
            # Exact normalized phrase validation, not approximate semantic matching.
            import bisect
            before=sum(len(norm(line)) for line in lines[pid][:h['line']-1]);absolute=before+section.index(phrase)
            cumulative=[];offset=0
            for line in lines[pid]:offset+=len(norm(line));cumulative.append(offset)
            quote_line=bisect.bisect_right(cumulative,absolute)
            evidence.append({'id':ids[e['id']],'plan_id':pid,'plan':by_plan[pid]['name'],'level':level,'number':e['chapter_num'],'heading':h['full_title'],'quote':e['phrase'],'page':locations[str(pid)][quote_line],'line':quote_line+1,'url':h['source_url'],'version':by_plan[pid]['kind'],'checked':True})
        for item in content[kind]:
            r=dict(item);r['evidence']=[ids[x] for x in r['evidence']]
            assert r['evidence'],r['id']
            if kind=='actions':
                assert set(r['people'])<={p['id'] for p in PEOPLE};assert r['domain'] in {d['id'] for d in DOMAINS};assert len(r['steps'])==3
                assert r['priority'] in [1,2,3] and r['priority_reason'],r['id']
                r['kind']='研究推断';actions.append(r)
            else:
                for m in r.get('metrics',[]):assert next(f['count'] for f in freq if f['plan_id']==m['plan_id'] and f['term']==m['term'])==m['count'],r['id']
                findings.append(r)
    assert len({r['id'] for r in actions})==len(actions)
    actions.sort(key=lambda a:(a['priority'],int(a['id'][1:])))
    assert len({r['id'] for r in evidence})==len(evidence)
    assert all(any(p['id'] in a['people'] for a in actions) for p in PEOPLE)
    assert all(any(a['domain']==d['id'] for a in actions) for d in DOMAINS)
    public_sources=[{k:s[k] for k in ['id','name','years','kind','url','retrieved','sha256','body_hanzi','text_note']} for s in sources]
    data={'meta':{'name':'人生五年','asof':'2026-10-19','corpus_count':len(sources),'term_count':len(terms),'heading_count':len(heads),'context_count':0,'quote_count':len(evidence),'schema_version':3,'edition_date':'2026-10-23','order_topic_count':len(order_topics),'action_sort':'priority ascending, then numeric action id within each tier'},'people':PEOPLE,'domains':DOMAINS,'action_priorities':ACTION_PRIORITIES,'sources':public_sources,'headings':heads,'terms':terms,'frequencies':freq,'trajectory':trajectory,'order_topics':order_topics,'order_periods':order_periods,'evidence':evidence,'actions':actions,'findings':findings,'rules':RULES}
    # The separate contexts snapshot is corpus-derived and contains no user profile.
    context_terms=['人工智能','智能体','大模型','信息化','数字经济','房地产','养老','人口','人才','创新','就业','自立自强','安全','优先']
    contexts=[]
    import bisect
    for s in sources:
        pid=s['id'];ls=lines[pid];offsets=[];total=0
        for line in ls:total+=len(norm(line));offsets.append(total)
        hs=[h for h in heads if h['plan_id']==pid]
        for term in context_terms:
            for occurrence,match in enumerate(re.finditer(re.escape(term),texts[pid]),1):
                ln=bisect.bisect_right(offsets,match.start());hh=[h for h in hs if h['line']<=ln+1];h=hh[-1] if hh else None
                contexts.append({'plan_id':pid,'plan':s['name'],'term':term,'occurrence':occurrence,'chapter':h['full_title'] if h else '正文','page':locations[str(pid)][ln],'context':texts[pid][max(0,match.start()-80):match.end()+160],'url':h['source_url'] if h else s['url']})
    data['meta']['context_count']=len(contexts);data['meta']['context_terms']=context_terms
    emit('research.json',data)
    safe=json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
    (OUT/'site-data.js').write_text('window.PLAN_RESEARCH='+safe+';\n',encoding='utf-8')
    (OUT/'contexts.js').write_text('window.PLAN_CONTEXTS='+json.dumps(contexts,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')+';\n',encoding='utf-8')
    csvout('frequencies.csv',['规划','关键词','出现次数','汉字分母','每万汉字次数','版本'],[[by_plan[f['plan_id']]['name'],f['term'],f['count'],by_plan[f['plan_id']]['body_hanzi'],round(f['normalized'],8),by_plan[f['plan_id']]['kind']] for f in freq])
    csvout('headings.csv',['规划','层级','顺序号','同层级总数','标题','所属篇','原文定位','来源'],[[h['plan'],h['level'],h['number'],h['level_total'],h['title'],h['parent'],'HTML' if h['plan_id']==14 else ('第'+str(h['page'])+'篇网页') if h['plan_id']==11 else 'PDF第'+str(h['page'])+'页',h['source_url']] for h in heads])
    csvout('order-topics.csv',['议题','规划','层级','顺序','同层级总数','原标题','所属篇','来源'],[[r['topic'],r['plan'],r['level'],r['rank'],r['total'],r['title'],r['parent'],r['source_url']] for r in trajectory])
    checks={'asof':data['meta']['asof'],'verified_quotes':len(evidence),'frequency_records':len(freq),'headings':len(heads),'contexts':len(contexts),'actions':len(actions),'findings':len(findings),'order_topics':len(order_topics),'order_periods':len(order_periods),'raw_to_derived':'published cleaned corpus → deterministic exact matching','scope':'官方公开纲要/摘要，不含用户背景、招聘样本和外部统计快照'}
    emit('verification.json',checks)
    print(json.dumps(checks,ensure_ascii=False))

if __name__=='__main__':main()

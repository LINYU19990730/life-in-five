"""Public-release checks: evidence, deterministic output, and publication boundary."""
from pathlib import Path
import json,re,sys,subprocess,hashlib,os
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding='utf-8')

def main():
    env=dict(os.environ,PYTHONIOENCODING='utf-8')
    subprocess.run([sys.executable,str(ROOT/'scripts/build.py')],cwd=ROOT,env=env,check=True,capture_output=True)
    data=json.loads((ROOT/'docs/data/research.json').read_text(encoding='utf-8'))
    assert data['meta']['corpus_count']==10 and len(data['frequencies'])==850
    assert len(data['headings'])==567 and data['meta']['context_count']==2960
    assert len(data['actions'])==61 and len(data['findings'])==8
    assert all(a['title']==a['question'] and a['question'].endswith('？') and a['answer'] for a in data['actions'])
    assert [d['name'] for d in data['domains']]==['教育','就业','住房','健康','生活','养老','投资']
    guides=[a for a in data['actions'] if a.get('decision_guide')]
    service=[a for a in data['actions'] if not a.get('decision_guide')]
    assert len(guides)==21 and data['actions']==guides+service
    assert [a['reading_order'] for a in guides]==list(range(1,22))
    assert [a['priority'] for a in service]==sorted(a['priority'] for a in service)
    evidence={e['id']:e for e in data['evidence']}
    for guide in guides:
        assert {evidence[e]['plan_id'] for e in guide['evidence']}=={14,15}
        assert len(guide['decision'])==3 and guide['question'] and guide['answer'] and guide['output']
        assert len(guide['worksheet']['columns'])>=6
        assert guide['comparison']['before'] and guide['comparison']['after']
    assert all(sum(a['domain']==d['id'] for a in guides)>=2 for d in data['domains'])
    assert len(next(a for a in guides if a['id']=='A26')['directions'])==8
    assert sum(a['domain']=='investment' for a in guides)==6
    assert all(a['priority'] in [1,2,3] and a['priority_reason'] for a in data['actions'])
    assert next(f['count'] for f in data['frequencies'] if f['plan_id']==15 and f['term']=='人工智能')==53
    assert all(e['checked'] and e['line']>0 and e['page']>0 for e in data['evidence'])
    assert all(a['kind']=='研究推断' and a['conditions'] and a['boundary'] and len(a['steps'])==3 for a in data['actions'])
    by_id={a['id']:a for a in data['actions']}
    assert '困难残疾人' in by_id['A24']['policy_fact'] and '重度残疾人' in by_id['A24']['policy_fact']
    assert len(by_id['A11']['people'])==5
    assert [p['name'] for p in data['people']]==['学生','职工/灵活就业','待业','个体户/创业','退休']
    assert 'student' in by_id['A14']['people']
    assert 'selfemployed' in by_id['A10']['people']
    for finding in data['findings']:
        assert finding['limit'] and finding['facts'] and finding['evidence']
    # A missing title is an observed catalogue gap, never an invented zero rank.
    assert len(data['order_topics'])==20
    assert len(data['order_periods'])==len(data['order_topics'])*10
    for topic in data['order_topics']:
        periods=[p for p in data['order_periods'] if p['topic_id']==topic['id']]
        assert [p['plan_id'] for p in periods]==list(range(6,16))
        assert any(p['matched'] for p in periods)
        for period in periods:
            matches=[r for r in data['trajectory'] if r['topic_id']==topic['id'] and r['plan_id']==period['plan_id']]
            assert period['matched']==bool(matches)
            assert period['heading_count']==len(matches)
    for row in data['trajectory']:
        assert row['rank']>0 and row['total']>=row['rank']
        assert any(h['plan_id']==row['plan_id'] and h['level']==row['level'] and h['number']==row['rank'] and h['title']==row['title'] and h['source_url']==row['source_url'] for h in data['headings'])
    def period(t,p):return next(r for r in data['order_periods'] if r['topic_id']==t and r['plan_id']==p)
    assert period('housing',14)['event']=='not_repeated'
    assert period('housing',15)['event']=='resumed'
    assert '篇' in period('services',12)['levels'] and '篇' not in period('services',13)['levels']
    assert '章' in period('services',13)['levels']
    assert period('digital',10)['event']=='first_observed'
    assert '篇' in period('digital',13)['levels']
    # Generated material must be reproducible from public inputs alone.
    generated=list((ROOT/'docs/data').glob('*'))
    before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in generated}
    subprocess.run([sys.executable,str(ROOT/'scripts/build.py')],cwd=ROOT,env=env,check=True,capture_output=True)
    after={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in generated}
    assert before==after,'Non-deterministic generated files'
    public=[ROOT/n for n in ['README.md','PUBLICATION_REVIEW.md','LICENSE','DATA_LICENSE.md','CONTRIBUTING.md','CITATION.cff','package.json','.gitignore','.gitattributes']]
    for directory in ['docs','research','scripts','.github']:
        public += [p for p in (ROOT/directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts]
    # Detect private source-project identifiers, not ordinary place names in policy text.
    forbidden=[r'[A-Za-z]:[\\/](?:Users|用户)[\\/]',r'/Users/[^/]+/',r'我目前是\s*\d+\s*岁',r'"(?:personal_background|user_profile)"\s*:']
    for p in public:
        if p.suffix in ['.pyc','.png','.jpg']:continue
        content=p.read_text(encoding='utf-8-sig')
        # Generic test patterns themselves are not personal paths or profiles.
        if p.resolve()==Path(__file__).resolve():continue
        for pattern in forbidden:assert not re.search(pattern,content),f'Private identifier in {p.relative_to(ROOT)}: {pattern}'
    class Assets(HTMLParser):
        def __init__(self):super().__init__();self.paths=[]
        def handle_starttag(self,tag,attrs):
            a=dict(attrs)
            if tag in ['script','link']:
                path=a.get('src') or a.get('href')
                if path:self.paths.append(path)
    assets=Assets();assets.feed((ROOT/'docs/index.html').read_text(encoding='utf-8'))
    for path in assets.paths:
        assert not path.startswith(('https:','http:','//')),'Runtime remote dependency'
        assert (ROOT/'docs'/path.split('?',1)[0].split('#',1)[0]).is_file(),f'Missing asset: {path}'
    app=(ROOT/'docs/assets/app.js').read_text(encoding='utf-8')
    assert not re.search(r'\b(?:fetch|eval|XMLHttpRequest|WebSocket)\s*\(',app)
    if (ROOT/'.git').exists():
        ignored=subprocess.run(['git','check-ignore','--stdin'],input='outputs/private.html\ndata/private.json\ncorpus/private.txt\nsources/private.html\nnode_modules/private.js\nreport_template.md\n',cwd=ROOT,text=True,capture_output=True,encoding='utf-8',check=True).stdout.splitlines()
        assert len(ignored)==6,'Legacy private files not fully ignored'
    print(f"PASS: {len(data['evidence'])}段同章节引文，850项词频，567条标题，2960条上下文；{len(data['actions'])}条行动与8条发现。")
    print('PASS: 双次构建一致；资格限定、人群覆盖、相对资源路径、无运行时外部依赖和公开文件隐私检查。')
    print(f"PASS: {len(data['order_topics'])}个议题、完整十期目录匹配、原标题定位与新增/间断/层级变化。")

if __name__=='__main__':main()

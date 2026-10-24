import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'test-results');await fs.mkdir(output,{recursive:true});
const localEdge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let executablePath=process.env.BROWSER_EXECUTABLE;
if(!executablePath && process.platform==='win32'){try{await fs.access(localEdge);executablePath=localEdge;}catch{}}
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try {
const context=await browser.newContext({viewport:{width:1440,height:1050}});const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=process.env.SITE_TEST_URL||pathToFileURL(path.join(root,'docs/index.html')).href;
await page.goto(url);await page.waitForSelector('.finding-card');
assert.equal(await page.locator('#view-history').isVisible(),true);
assert.deepEqual(await page.locator('nav[aria-label="主导航"] .nav-button').allTextContents(),['变化趋势','结论与行动']);
assert.equal(await page.locator('.utility-nav .nav-button').count(),1);
assert.equal(await page.locator('#view-method, [data-view="method"], [data-go="method"], #sources-table').count(),0);
assert.equal(await page.locator('[data-history="plans"]').count(),0);
assert.equal(await page.locator('[data-evidence-mode="plans"]').count(),1);
assert(await page.locator('.utility-nav .nav-button').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize))<await page.locator('nav[aria-label="主导航"] .nav-button').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)));
assert.equal(await page.locator('[data-evidence-mode="quotes"]').count(),0);
const payload=await page.evaluate(()=>window.PLAN_RESEARCH);
assert.equal(payload.actions.length,61);assert.equal(payload.findings.length,8);assert(payload.evidence.length>=61);
assert.equal(await page.locator('.priority-tag, #priority-help, #action-sort-note').count(),0);
assert.deepEqual(payload.domains.map(d=>d.name),['教育','就业','住房','健康','生活','养老','投资']);
assert.equal(payload.actions.filter(a=>a.decision_guide).length,21);
await page.screenshot({path:path.join(output,'desktop-trends.png'),fullPage:true});
await page.locator('[data-view="actions"]').click();
await page.screenshot({path:path.join(output,'desktop-actions.png'),fullPage:true});
// Each two-dimensional filter must represent the actual dataset exactly.
for(const p of ['all',...payload.people.map(p=>p.id)]){
  await page.selectOption('#person-filter',p);
  for(const d of ['all',...payload.domains.map(d=>d.id)]){
    await page.locator(`[data-domain="${d}"]`).click();
    const count=payload.actions.filter(a=>(p==='all'||a.people.includes(p))&&(d==='all'||a.domain===d)).length;
    assert.equal(await page.locator('#more-actions, #action-count, #action-domain-intro, .action-reading-note').count(),0);
    assert.equal(await page.locator('.action-card').count(),count);
    assert.equal(await page.locator('#action-empty').isVisible(),count===0);
    const expected=payload.actions.filter(a=>(p==='all'||a.people.includes(p))&&(d==='all'||a.domain===d)).map(a=>a.id);
    assert.deepEqual(await page.locator('.action-card').evaluateAll(xs=>xs.map(x=>x.dataset.actionId)),expected);
  }
}
await page.locator('#reset-actions').click();await page.locator('#matrix-mode').click();
assert.equal(await page.locator('.matrix-table tbody tr').count(),5);
assert.equal(await page.locator('[data-matrix-person]').count(),35);
assert.equal(await page.locator('#action-grid').isVisible(),false);
await page.locator('[data-matrix-person="worker"][data-matrix-domain="employment"]').click();
assert.equal(await page.locator('#person-filter').inputValue(),'worker');assert.equal(await page.locator('#matrix-panel').isVisible(),false);
await page.locator('[data-open-action]').first().click();await page.waitForSelector('#detail-dialog[open]');
assert((await page.locator('#detail-body').textContent()).includes('规划中的相关内容'));
assert(!(await page.locator('#detail-body').textContent()).includes('优先级'));
assert(!(await page.locator('#detail-body').textContent()).includes('排序依据'));
assert(await page.locator('.evidence-snippet').count()>0);await page.keyboard.press('Escape');
assert.equal(await page.locator('#detail-dialog').isVisible(),false);
await page.locator('#matrix-mode').click();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(output,'desktop-matrix.png'),fullPage:true});await page.locator('#cards-mode').click();
// Historical chart, layer-aware order, and period reading.
await page.locator('[data-view="history"]').click();assert.equal(await page.locator('.finding-card').count(),8);
await page.screenshot({path:path.join(output,'desktop-history.png'),fullPage:true});
await page.locator('[data-history="words"]').click();assert.equal(await page.locator('#word-chart circle').count(),20);
await page.selectOption('#word-one','人工智能');await page.selectOption('#word-two','');await page.selectOption('#word-metric','count');
assert((await page.locator('#word-table').textContent()).includes('53'));
assert.equal(await page.locator('[data-chart-term], [data-evidence-mode="contexts"], #evidence-term, .order-chart-note').count(),0);
await page.locator('[data-view="history"]').click();await page.locator('[data-history="order"]').click();
assert.equal(await page.locator('#order-topic option').count(),20);
for(const topic of payload.order_topics){
  await page.selectOption('#order-topic',topic.name);
  assert.equal(await page.locator('#order-timeline .order-period').count(),10);
  assert.equal(await page.locator('#order-table tbody tr').count(),10);
  const levels=await page.locator('#order-level option').evaluateAll(xs=>xs.map(x=>x.value));
  assert.deepEqual(levels,['篇','章']);
  for(const level of levels){
    await page.selectOption('#order-level',level);
    const expected=payload.trajectory.filter(r=>r.topic_id===topic.id&&r.level===level);
    assert.equal(await page.locator('#order-chart .order-point').count(),expected.length);
    assert.equal(await page.locator('#order-table [data-order-level]').count(),expected.length);
    assert((await page.locator('#order-table [data-order-level]').evaluateAll(xs=>xs.map(x=>x.dataset.orderLevel))).every(x=>x===level));
    const medianFor=pid=>{const rs=expected.filter(r=>r.plan_id===pid).map(r=>r.rank).sort((a,b)=>a-b);return rs.length?(rs[Math.floor((rs.length-1)/2)]+rs[Math.floor(rs.length/2)])/2:null;};
    const markers=await page.locator('#order-chart .order-median-point').evaluateAll(xs=>xs.map(x=>[Number(x.dataset.orderPeriod),Number(x.dataset.orderMedian)]));
    assert.deepEqual(markers,payload.sources.filter(p=>medianFor(p.id)!==null).map(p=>[p.id,medianFor(p.id)]));
    const segments=await page.locator('#order-chart .order-segment').evaluateAll(xs=>xs.map(x=>[Number(x.dataset.orderFrom),Number(x.dataset.orderTo),Number(x.dataset.orderValueFrom),Number(x.dataset.orderValueTo)]));
    const expectedSegments=payload.sources.slice(1).filter((p,i)=>medianFor(payload.sources[i].id)!==null&&medianFor(p.id)!==null).length;
    assert.equal(segments.length,expectedSegments,'All adjacent periods with data should be connected');
    for(const [from,to,start,end] of segments){
      assert.equal(to-from,1,'No line may cross a missing period');
      assert.equal(start,medianFor(from));assert.equal(end,medianFor(to));
    }
  }
}
await page.selectOption('#order-topic','工业与产业体系');await page.selectOption('#order-level','章');
assert.deepEqual(await page.locator('#order-chart .order-median-point').evaluateAll(xs=>xs.map(x=>[Number(x.dataset.orderPeriod),Number(x.dataset.orderMedian)])),[[6,12],[7,10],[10,4],[11,12],[12,9.5],[13,22.5],[14,8.5],[15,4.5]]);
assert.equal(await page.locator('.order-segment[data-order-from="6"][data-order-to="7"]').count(),1);
assert((await page.locator('#order-chart').textContent()).includes('本版无章级'));
await page.locator('#order-chart').screenshot({path:path.join(output,'order-industry-chart.png')});
await page.locator('#order-chart .order-median-point[data-order-period="12"]').focus();await page.keyboard.press('Enter');await page.waitForSelector('#detail-dialog[open]');
assert((await page.locator('#detail-body').textContent()).includes('中位顺序为9.5'));await page.keyboard.press('Escape');
await page.selectOption('#order-topic','数字与网络');await page.selectOption('#order-level','篇');
assert.equal(await page.locator('#order-chart .order-point').count(),3);
await page.selectOption('#order-level','章');assert(await page.locator('#order-chart .order-point').count()>3);
await page.selectOption('#order-topic','服务业');await page.selectOption('#order-level','篇');
assert.equal(await page.locator('#order-chart .order-point').count(),2);
assert((await page.locator('[data-order-row="13"]').textContent()).includes('未匹配到相关篇标题'));
await page.screenshot({path:path.join(output,'order-services.png'),fullPage:true});
await page.selectOption('#order-topic','住房与房地产');await page.selectOption('#order-level','章');
assert((await page.locator('[data-order-row="14"]').textContent()).includes('未再匹配'));
assert((await page.locator('[data-order-row="15"]').textContent()).includes('再次匹配'));
assert.equal(await page.locator('.order-segment[data-order-from="13"][data-order-to="15"]').count(),0);
await page.screenshot({path:path.join(output,'order-housing.png'),fullPage:true});
await page.locator('#order-timeline [data-order-period="14"]').click();await page.waitForSelector('#detail-dialog[open]');
assert((await page.locator('#detail-body').textContent()).includes('本期章级目录未匹配到相关标题'));await page.keyboard.press('Escape');
await page.locator('#order-chart .order-point').first().focus();await page.keyboard.press('Enter');await page.waitForSelector('#detail-dialog[open]');
assert(await page.locator('#detail-body a').count()>0);await page.keyboard.press('Escape');
await page.goto(url+'#order/housing/14');await page.waitForSelector('#detail-dialog[open]');assert((await page.locator('#detail-title').textContent()).includes('住房与房地产'));await page.keyboard.press('Escape');
await page.goto(url+'#history/order');await page.waitForSelector('#order-topic');
await page.locator('[data-view="evidence"]').click();await page.locator('[data-evidence-mode="plans"]').click();
for(const plan of payload.sources){
  await page.locator(`[data-plan="${plan.id}"]`).click();
  assert.equal(await page.locator('.plan-top-list li').count(),payload.headings.filter(h=>h.plan_id===plan.id&&h.level!=='章').length);
  assert.equal(await page.locator('.official-source-button').getAttribute('href'),plan.url);
}
await page.locator('[data-plan="6"]').click();assert((await page.locator('#plan-detail').textContent()).includes('摘要'));
await page.locator('[data-plan="15"]').click();assert.equal(await page.locator('.plan-top-list li').count(),18);
assert(await page.locator('.official-source-button').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=16);
await page.screenshot({path:path.join(output,'evidence-reading-desktop.png'),fullPage:true});
// An invalid search must remain text, not create executable DOM.
await page.locator('[data-view="evidence"]').click();await page.locator('[data-evidence-mode="headings"]').click();await page.locator('#reset-evidence').click();
await page.fill('#evidence-query','<img src=x onerror="window.__injected=1">');assert.equal(await page.evaluate(()=>window.__injected),undefined);
await page.locator('#reset-evidence').click();assert((await page.locator('#evidence-count').textContent()).includes('567 条'));
await page.goto(url+'#evidence/A-EV01');await page.waitForSelector('#detail-dialog[open]');assert((await page.locator('#detail-body').textContent()).includes('哪些结论引用了它'));assert((await page.locator('.evidence-snippet').textContent()).includes('2021—2025'));await page.keyboard.press('Escape');
await page.locator('[data-view="evidence"]').click();
const dl=page.waitForEvent('download');await page.locator('[data-download="actions"]').click();const downloaded=await dl;assert(downloaded.suggestedFilename().endsWith('.json'));
const exportData=JSON.parse(await fs.readFile(await downloaded.path(),'utf8'));
assert(!('priority_guide' in exportData));assert(exportData.actions.every(a=>!('priority' in a)&&!('priority_reason' in a)));
assert.deepEqual(exportData.actions.map(a=>a.id),payload.actions.map(a=>a.id));
// Saved deep links open the same sourced action after a fresh load.
await page.goto(url+'#action/A27');await page.waitForSelector('#detail-dialog[open]');assert((await page.locator('#detail-body').textContent()).includes(payload.actions.find(a=>a.id==='A27').title));await page.keyboard.press('Escape');
await page.goto(url+'#%broken');await page.waitForSelector('.finding-card');assert.equal(await page.locator('#view-history').isVisible(),true);await page.locator('[data-view="actions"]').click();
await page.locator('#reset-actions').click();await page.screenshot({path:path.join(output,'desktop-final.png'),fullPage:true});
for(const width of [390,768]){
  await page.setViewportSize({width,height:900});await page.goto(url);await page.waitForSelector('.finding-card');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  await page.screenshot({path:path.join(output,`trends-${width}.png`),fullPage:true});await page.locator('[data-view="actions"]').click();
  await page.screenshot({path:path.join(output,`actions-${width}.png`),fullPage:true});
  await page.locator('[data-view="history"]').click();await page.locator('[data-history="words"]').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  await page.locator('[data-history="order"]').click();await page.selectOption('#order-topic','住房与房地产');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  await page.screenshot({path:path.join(output,`order-${width}.png`),fullPage:true});
  await page.locator('[data-view="evidence"]').click();await page.locator('[data-evidence-mode="plans"]').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  assert(await page.locator('.official-source-button').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=16);
  await page.screenshot({path:path.join(output,`evidence-reading-${width}.png`),fullPage:true});
}
assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'browser-check.json'),JSON.stringify({urlMode:url.startsWith('file:')?'file':'http',peopleDomainCombinations:48,orderTopics:20,orderPeriods:200,actions:payload.actions.length,findings:8,evidence:payload.evidence.length,jsErrors:errors,passed:['默认进入变化趋势','两个主导航与证据库入口','七个短分类','61条问答卡片仅含问题与回答','移除独立引文页签','二维筛选全部组合与排序保留','矩阵35格','原文详情与ESC','关键词切换与53次计数','20个议题篇序章序及同层级明细','完整十期且空缺不跨期连线','当前层级新增/未再匹配/恢复','目录状态和原标题详情','逐期阅读移入证据库及原文按钮放大','移除方法与来源模块','搜索注入防护','JSON下载','原文规划期','深链接','390/768px无横向溢出']},null,2));
console.log('PASS: filter matrix, sourced dialogs, charts, 53-count frequencies, downloads, deep links and responsive views.');
} finally { await browser.close(); }

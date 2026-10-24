/* Five-year plans, public reader. No dependencies, network API or user tracking. */
(() => {
  'use strict';
  const D = window.PLAN_RESEARCH;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const plans = new Map(D.sources.map(p => [p.id, p]));
  const people = new Map(D.people.map(p => [p.id, p]));
  const domains = new Map(D.domains.map(d => [d.id, d]));
  const evidence = new Map(D.evidence.map(e => [e.id, e]));
  const freq = new Map(D.frequencies.map(r => [`${r.plan_id}:${r.term}`, r]));
  const state = { view:'history', person:'all', domain:'all', matrix:false, history:'findings', evidenceMode:'plans', evidenceLimit:40, selectedPlan:15 };
  let copyText = '';
  let detailRoute = '';
  let closingForRoute = false;
  let lastTrigger;

  function locationLabel(planId, page) {
    return planId === 14 ? 'HTML原文' : planId === 11 ? `第${page}篇网页` : `PDF第${page}页`;
  }
  function sourceLink(url, planId, page) {
    return /\.pdf(?:$|\?)/i.test(url) ? `${url.split('#')[0]}#page=${page}` : url;
  }
  function officialLink(e, label = '打开官方原文 ↗') {
    return `<a class="external official-source-link" href="${esc(sourceLink(e.url, e.plan_id, e.page))}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  }
  function cleanReason(s) { return s.replace(/^研究推断[：:]\s*/, ''); }
  function short(s, n = 100) { return s.length > n ? s.slice(0, n) + '…' : s; }
  function toast(text) {
    $('#toast').textContent = text; $('#toast').hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { $('#toast').hidden = true; }, 3000);
  }
  function setHash(hash) { history.replaceState(null, '', hash); }
  function updateActionHash() { setHash(`#actions?person=${state.person}&domain=${state.domain}`); }
  function showView(view, { scroll = false, hash = true } = {}) {
    if (view==='method') view='evidence';
    if (!['actions','history','evidence'].includes(view)) view = 'history';
    state.view = view;
    $$('.view').forEach(el => { el.hidden = el.id !== `view-${view}`; });
    $$('.nav-button').forEach(b => { const active = b.dataset.view === view; b.classList.toggle('active', active); if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (view === 'evidence') renderEvidence();
    if (hash) { if (view === 'actions') updateActionHash(); else setHash('#' + view); }
    if (scroll) window.scrollTo({ top:0, behavior:'instant' });
  }

  // The two dimensions use navigation labels, not social or importance scores.
  function actionMatches(a, person = state.person, domain = state.domain) {
    return (person === 'all' || a.people.includes(person)) && (domain === 'all' || a.domain === domain);
  }
  function renderActions() {
    $('#person-filter').value = state.person;
    $$('#domain-filters button').forEach(b => { const on = b.dataset.domain === state.domain; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', String(on)); });
    const rows = D.actions.filter(a => actionMatches(a));
    $('#matrix-panel').hidden = !state.matrix;
    $('#action-grid').hidden = state.matrix;
    $('#cards-mode').classList.toggle('selected', !state.matrix); $('#cards-mode').setAttribute('aria-pressed', String(!state.matrix));
    $('#matrix-mode').classList.toggle('selected', state.matrix); $('#matrix-mode').setAttribute('aria-pressed', String(state.matrix));
    if (state.matrix) renderMatrix();
    $('#action-grid').innerHTML = rows.map(a => `<a class="action-card qa-card" data-action-id="${a.id}" data-open-action="${a.id}" href="#action/${a.id}" aria-labelledby="question-${a.id}" aria-describedby="answer-${a.id}"><h3 id="question-${a.id}">${esc(a.question)}</h3><p class="card-summary" id="answer-${a.id}">${esc(a.answer)}</p></a>`).join('');
    $('#action-empty').hidden = state.matrix || rows.length > 0;
  }
  function renderMatrix() {
    $('#action-matrix').innerHTML = `<table class="matrix-table"><thead><tr><th scope="col">处境 / 生活领域</th>${D.domains.map(d => `<th scope="col">${d.name}</th>`).join('')}</tr></thead><tbody>${D.people.map(p => `<tr><th scope="row">${p.short}</th>${D.domains.map(d => { const n = D.actions.filter(a => actionMatches(a, p.id, d.id)).length; return `<td><button data-matrix-person="${p.id}" data-matrix-domain="${d.id}" data-domain-label="${esc(d.name)}" ${n ? '' : 'disabled'} aria-label="${p.name}，${d.name}，${n}条建议">${n || '—'}</button></td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function evidenceMarkup(ids, collapsed = false) {
    return ids.map(id => {
      const e = evidence.get(id);
      const title=`${esc(e.plan)}（${esc(plans.get(e.plan_id).years)}） · ${esc(e.heading)}`;
      const repeated = ids.filter(x=>{const other=evidence.get(x);return other.plan_id===e.plan_id&&other.number===e.number;}).length>1;
      const hint = repeated ? `<small class="quote-hint">${esc(short(e.quote,30))}</small>` : '';
      const content=`<p class="quiet">${esc(e.version)} · ${locationLabel(e.plan_id, e.page)} · 与提取文本连续匹配</p><blockquote>${esc(e.quote)}</blockquote>${officialLink(e)}`;
      return collapsed ? `<details class="evidence-snippet guide-evidence" id="quote-${e.id}"><summary>${title}${hint}</summary>${content}</details>` : `<section class="evidence-snippet"><h4>${title}</h4>${content}</section>`;
    }).join('');
  }
  function evidencePlain(ids) {
    return ids.map(id => { const e = evidence.get(id); return `${e.plan} ${e.heading}（${locationLabel(e.plan_id,e.page)}）\n“${e.quote}”\n${sourceLink(e.url,e.plan_id,e.page)}`; }).join('\n\n');
  }
  function openDialog(label, html, plain, route) {
    lastTrigger = document.activeElement; $('#dialog-label').textContent = label; $('#detail-body').innerHTML = html; $('#copy-status').textContent = ''; copyText = plain; detailRoute = route;
    if (!$('#detail-dialog').open) $('#detail-dialog').showModal();
    $('#detail-dialog').scrollTop = 0; setHash('#' + route);
  }
  function openAction(id) {
    const a = D.actions.find(x => x.id === id); if (!a) return;
    const context = a.people.map(p => people.get(p).name).join('、');
    const directions=(a.directions || []).map(d=>`<details class="industry-direction"><summary>${esc(d.name)}</summary><p><b>十四五：</b>${esc(d.before.replace(/^十四五[^：]*：/,''))}</p><p><b>十五五：</b>${esc(d.after.replace(/^十五五[^：]*：/,''))}</p><p class="role-examples"><b>岗位示例（研究推断）：</b>${esc(d.roles.replace(/^可检索：/,''))}</p><p><b>进入前核实：</b>${esc(d.check)}</p><div class="direction-sources">${d.evidence.filter((eid,i,ids)=>ids.findIndex(x=>{const prev=evidence.get(x),curr=evidence.get(eid);return prev.plan_id===curr.plan_id&&prev.number===curr.number;})===i).map(eid=>{const e=evidence.get(eid);return `<button class="text-button" data-jump-evidence="${eid}">${esc(e.plan)}第${e.number}章原文 ↓</button>`;}).join('')}</div></details>`).join('');
    const refs=(a.references || []).map(r=>`<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)} ↗</a><p class="quiet">${esc(r.note)} · 核验日期：${esc(r.checked_on)}</p></li>`).join('');
    const guideContent=a.decision_guide ? `<p class="detail-answer">${esc(a.answer)}</p><h3>① 规划中的相关内容</h3><div class="plan-comparison"><section><h4>十四五 · 2021—2025</h4><p>${esc(a.comparison.before)}</p></section><section><h4>十五五 · 2026—2030</h4><p>${esc(a.comparison.after)}</p></section></div><p class="quiet">以上为文本概括；下文的判断条件、岗位示例与操作步骤是研究者据此作出的延伸，不是规划原文要求。</p>${directions?`<h3>逐项比较八类方向</h3><p class="quiet">按应用与工作场景归纳，不作行业排名。展开查看岗位示例、门槛与对应原文。</p><div class="industry-directions">${directions}</div>`:''}<h3>② 怎样判断是否适合</h3><ul class="decision-checks">${a.decision.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>` : `<p class="detail-answer">${esc(a.answer)}</p><h3>① 规划中的相关内容</h3><p>${esc(a.policy_fact)}</p><h3>② 与日常生活的联系</h3><p>${esc(cleanReason(a.reasoning))}</p>`;
    const html = `<span class="domain-tag">${domains.get(a.domain).name} · 研究推断</span><h2 id="detail-title">${esc(a.title)}</h2>${guideContent}<p class="condition"><strong>适用条件</strong><br>${esc(a.conditions)}</p><h3>③ 参考步骤</h3><ol>${a.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>${a.output?`<div class="guide-output"><strong>做完留下什么</strong><p>${esc(a.output)}</p>${a.worksheet?`<button class="secondary" data-download-worksheet="${a.id}">下载填写表（CSV）</button><small>下载空白表，按上面的步骤填写；表格只提供整理字段，不替你作决定。</small>`:''}</div>`:''}<h3>④ 适用范围与限制</h3><p class="boundary">${esc(a.boundary)}</p><h3>原文依据</h3>${a.decision_guide?'<p class="quiet">展开可读连续引文和原文位置；官方链接可查看所在章节。</p>':''}${evidenceMarkup(a.evidence,!!a.decision_guide)}${refs?`<h3>补充核验资料</h3><p class="quiet">下列为规划以外的官方资料，单独列示。</p><ul>${refs}</ul>`:''}<p class="quiet">相关处境：${esc(context)}。涉及资格、待遇或产品规则的事项，请核对当前官方规定或有效合同。</p>`;
    const directionPlain=(a.directions || []).map(d=>`${d.name}\n${d.before}\n${d.after}\n岗位示例（研究推断）：${d.roles}\n进入前核实：${d.check}`).join('\n\n');
    const plain = `${a.title}\n类型：研究推断\n${a.answer?`回答：${a.answer}\n`:''}适用条件：${a.conditions}\n规划事实：${a.policy_fact}\n推断理由：${a.reasoning}\n${directionPlain?`方向对照：\n${directionPlain}\n`:''}${a.decision?`判断条件：\n${a.decision.join('\n')}\n`:''}行动：\n${a.steps.map((s,i)=>`${i+1}. ${s}`).join('\n')}\n${a.output?`做完留下：${a.output}\n`:''}边界：${a.boundary}\n\n${evidencePlain(a.evidence)}\n${(a.references || []).map(r=>`${r.title}\n${r.url}\n核验：${r.checked_on}`).join('\n')}\n语料截止：${D.meta.asof}${a.decision_guide?`\n建议复核：${D.meta.advice_review_date}`:''}`;
    openDialog('结论与行动 / 阅读参考', html, plain, `action/${id}`);
  }
  function openFinding(id) {
    const f = D.findings.find(x => x.id === id); if (!f) return;
    const html = `<span class="domain-tag">${esc(f.kind)}</span><h2 id="detail-title">${esc(f.title)}</h2><p>${esc(f.summary)}</p><h3>文本中的具体变化</h3><ul>${f.facts.map(x => `<li>${esc(x)}</li>`).join('')}</ul><h3>如何理解</h3><p>${esc(f.interpretation)}</p><h3>比较范围与限制</h3><p class="boundary">${esc(f.limit)}</p><h3>原文依据</h3>${evidenceMarkup(f.evidence)}`;
    const plain = `${f.title}\n${f.kind}\n${f.summary}\n事实：\n${f.facts.join('\n')}\n解释：${f.interpretation}\n边界：${f.limit}\n\n${evidencePlain(f.evidence)}\n研究截止：${D.meta.asof}`;
    openDialog('变化趋势 / 文本分析', html, plain, `finding/${id}`);
  }
  function openEvidence(id) {
    const e = evidence.get(id); if (!e) return;
    const uses = [...D.actions, ...D.findings].filter(x => x.evidence.includes(id));
    openDialog('证据库 / 原文片段', `<h2 id="detail-title">${esc(e.plan)} · ${esc(e.heading)}</h2>${evidenceMarkup([id])}<h3>哪些结论引用了它</h3><ul>${uses.map(x=>`<li>${esc(x.title)}</li>`).join('')}</ul><p class="quiet">原文的任务主体、限定对象和时间范围需要一起阅读；引文不是对个人结果的承诺。</p>`, evidencePlain([id]), `evidence/${id}`);
  }
  function closeDialog() { $('#detail-dialog').close(); }
  $('#detail-dialog').addEventListener('close', () => { detailRoute = ''; if (lastTrigger?.isConnected && (document.activeElement===document.body || $('#detail-dialog').contains(document.activeElement))) lastTrigger.focus(); if (closingForRoute) { closingForRoute = false; return; } if (state.view === 'actions') updateActionHash(); else setHash('#' + state.view); });
  $('#close-dialog').addEventListener('click', closeDialog);
  $('#detail-dialog').addEventListener('click', e => { if (e.target === $('#detail-dialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog(); } });
  $('#copy-detail').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(copyText); $('#copy-status').textContent = '已复制，包含出处和推断边界。'; }
    catch { $('#copy-status').textContent = '浏览器未允许自动复制，可选中详情文字复制。'; }
  });

  function renderFindings() {
    $('#findings-grid').innerHTML = D.findings.map((f, i) => `<article class="finding-card" aria-labelledby="finding-title-${f.id}"><div class="card-meta"><div class="finding-label"><span class="finding-index" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><span class="finding-topic">${esc(f.topic)}</span></div><span class="inference-tag">${esc(f.kind)}</span></div><h3 id="finding-title-${f.id}"><a class="finding-title" href="#finding/${f.id}">${esc(f.title)}</a></h3><p class="card-summary">${esc(f.summary)}</p><div class="card-bottom"><span class="evidence-label">${f.evidence.length} 段原文</span><button class="card-link" data-open-finding="${f.id}" aria-label="${esc(`查看${f.title}的依据与解读`)}">依据与解读 ↗</button></div></article>`).join('');
  }
  function selectHistory(tab) {
    if(tab==='plans'){state.evidenceMode='plans';showView('evidence');return;}
    state.history = tab;
    $$('[data-history]').forEach(b => { const on = b.dataset.history === tab; b.classList.toggle('selected', on); b.setAttribute('aria-selected', String(on)); });
    $$('.history-panel').forEach(p => { p.hidden = p.id !== `history-${tab}`; });
    if (tab === 'words') renderWords(); if (tab === 'order') renderOrder();
  }
  function renderWords() {
    const t1 = $('#word-one').value, t2 = $('#word-two').value;
    const metric = $('#word-metric').value; const ts = [t1, t2].filter((t,i,a) => t && a.indexOf(t) === i);
    const colors = ['#24544c','#b27c38'];
    const W = 980, H = 340, L = 58, R = 28, T = 41, B = 63;
    const max = Math.max(1,...ts.flatMap(t=>D.sources.map(p=>freq.get(`${p.id}:${t}`)[metric]))) * 1.15;
    const x = i => L + i * (W-L-R)/9, y = v => H-B - v/max*(H-T-B);
    let svg = `<svg class="data-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="关键词跨期变化，${metric==='count'?'原始次数':'每万汉字次数'}"><rect x="${L-15}" y="${T-20}" width="${x(1)-L+45}" height="${H-T-B+30}" fill="#f4eddf" rx="6"/><text x="${L}" y="${T-7}" font-size="10" fill="#927748">公开摘要</text><text x="${x(9)}" y="${T-7}" text-anchor="middle" font-size="10" fill="#788879">实施中</text>`;
    for (let i=0;i<=4;i++) { const value=max*i/4; svg += `<line x1="${L}" y1="${y(value)}" x2="${W-R}" y2="${y(value)}" stroke="#e1e5da"/><text x="${L-12}" y="${y(value)+4}" text-anchor="end" font-size="11" fill="#7c887e">${metric==='count'?Math.round(value):value.toFixed(1)}</text>`; }
    ts.forEach((t, k) => {
      const vals = D.sources.map(p=>freq.get(`${p.id}:${t}`)[metric]);
      svg += `<polyline points="${vals.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="${colors[k]}" stroke-width="2.5"/>`;
      vals.forEach((v,i) => { const p=D.sources[i], r=freq.get(`${p.id}:${t}`), value=metric==='count'?r.count:v.toFixed(2); svg += `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${colors[k]}"><title>${p.name} · ${esc(t)}：${value}；原始${r.count}次</title></circle>`; });
    });
    D.sources.forEach((p,i)=> { svg += `<text x="${x(i)}" y="${H-34}" text-anchor="middle" font-size="12" fill="#53675a">${p.name}</text><text x="${x(i)}" y="${H-13}" text-anchor="middle" font-size="9" fill="#879285">${p.years}</text>`; });
    $('#word-chart').innerHTML = svg + '</svg>';
    $('#word-legend').innerHTML = ts.map((t,i)=>`<span class="legend-item" style="--series:${colors[i]}">${esc(t)}</span>`).join('');
    $('#word-table').innerHTML = `<table class="word-table"><thead><tr><th>规划</th>${ts.map(t=>`<th>${esc(t)} · 次数</th><th>${esc(t)} · 每万字</th>`).join('')}<th>汉字分母</th></tr></thead><tbody>${D.sources.map(p=>`<tr><td>${p.name}${p.id<8?'（摘要）':''}</td>${ts.map(t=>{ const r=freq.get(`${p.id}:${t}`);return `<td>${r.count}</td><td>${r.normalized.toFixed(2)}</td>`;}).join('')}<td>${p.body_hanzi.toLocaleString()}</td></tr>`).join('')}</tbody></table>`;
  }
  const orderEvents={first_observed:'首次匹配',resumed:'再次匹配',continued:'持续列题',level_changed:'层级变化',not_repeated:'未再匹配',unmatched:'标题未匹配'};
  function orderEvent(p){return p.has_level===false?'无此层级':p.is_scope_start&&p.matched?'范围起点':orderEvents[p.event];}
  function orderRows(){return D.trajectory.filter(r=>r.topic===$('#order-topic').value&&r.level===$('#order-level').value).sort((a,b)=>a.plan_id-b.plan_id||a.rank-b.rank);}
  function orderMedian(rows){if(!rows.length)return null;const ranks=rows.map(r=>r.rank).sort((a,b)=>a-b),mid=Math.floor(ranks.length/2);return ranks.length%2?ranks[mid]:(ranks[mid-1]+ranks[mid])/2;}
  function orderLocation(r){return `<a href="${esc(sourceLink(r.source_url,r.plan_id,r.page))}" target="_blank" rel="noopener noreferrer">${locationLabel(r.plan_id,r.page)} ↗</a>`;}
  function orderPeriods(topic,level) {
    let seen=false,previous=false;
    return D.sources.map((plan,i)=>{
      const hits=D.trajectory.filter(r=>r.topic_id===topic.id&&r.plan_id===plan.id&&r.level===level);
      const matched=hits.length>0;
      const event=matched?(seen?(previous?'continued':'resumed'):'first_observed'):(previous?'not_repeated':'unmatched');
      const period={plan_id:plan.id,matched,heading_count:hits.length,levels:matched?[level]:[],event,is_scope_start:i===0,has_level:D.headings.some(h=>h.plan_id===plan.id&&h.level===level)};
      seen=seen||matched;previous=matched;return period;
    });
  }
  function openOrderPeriod(pid){
    const topic=D.order_topics.find(t=>t.name===$('#order-topic').value),p=plans.get(pid),level=$('#order-level').value;
    const rows=orderRows().filter(r=>r.plan_id===pid),median=orderMedian(rows);
    const hasLevel=D.headings.some(h=>h.plan_id===pid&&h.level===level);
    const statistic=median===null?'':`<p class="order-statistic">当前${level}序匹配${rows.length}个标题，中位顺序为${median}。</p>`;
    const empty=hasLevel?`本期${level}级目录未匹配到相关标题。`:`本版未采用${level}级目录。`;
    const titles=rows.length?rows.map(r=>`<section class="order-heading-detail" data-order-level="${r.level}"><h3>第${r.rank}${r.level} / 共${r.total}${r.level} · ${esc(r.title)}</h3>${orderLocation(r)}</section>`).join(''):`<p>${empty}</p>`;
    openDialog(`篇章顺序 / ${level}序`, `<h2 id="detail-title">${esc(topic.name)} · ${p.name} · ${level}序</h2><p class="quiet">${p.years} · ${esc(p.kind)}</p>${statistic}${titles}<p class="boundary">未匹配仅表示当前层级的标题结果，不表示正文没有相关内容。</p>`,`${topic.name} · ${p.name}（${p.years}） · ${level}序\n${median===null?empty:`中位顺序：${median}\n`}${rows.map(r=>`第${r.rank}${r.level}/${r.total} · ${r.title}\n${sourceLink(r.source_url,r.plan_id,r.page)}`).join('\n')}`,`order/${topic.id}/${pid}/${level}`);
  }
  function renderOrder() {
    const topic=D.order_topics.find(t=>t.name===$('#order-topic').value);
    if(!topic)return;
    const level=$('#order-level').value;
    const rows=orderRows(),periods=orderPeriods(topic,level);
    const topicChanged=$('#order-level').dataset.topic!==topic.id;
    $('#order-level').dataset.topic=topic.id;
    const byPlan=D.sources.map(p=>rows.filter(r=>r.plan_id===p.id&&r.level===level));
    const medians=byPlan.map(orderMedian);
    $('#order-description').textContent=topic.description;
    const observed=periods.filter(p=>p.matched);
    $('#order-summary').textContent=observed.length?`${D.order_topics.length}个议题可选 · ${level}级标题在${observed.length}/${D.sources.length}期匹配 · 最早：${plans.get(observed[0].plan_id).name} · 最近：${plans.get(observed.at(-1).plan_id).name}`:`${D.order_topics.length}个议题可选 · 本议题未匹配到${level}级标题`;
    $('#order-timeline').innerHTML=periods.map(p=>{const plan=plans.get(p.plan_id);return `<button class="order-period ${p.matched?'is-listed':'is-unmatched'}" data-order-period="${p.plan_id}" aria-label="${esc(topic.name)}，${plan.name}，${orderEvent(p)}，${p.heading_count}个标题"><span class="order-period-name">${plan.name}${p.plan_id<8?'<small>摘要</small>':''}</span><span class="order-period-level">${p.matched?level:'—'}</span><span class="order-event">${orderEvent(p)}</span></button>`;}).join('');
    const W=1000,H=350,L=62,R=35,T=48,B=91;
    const points=byPlan.flat();const max=Math.max(5,...points.map(r=>r.rank));
    const x=i=>L+i*(W-L-R)/(D.sources.length-1), y=rank=>T+(rank-1)/Math.max(1,max-1)*(H-T-B);
    const step=Math.max(1,Math.ceil((max-1)/5));
    let svg=`<svg class="data-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(topic.name)}，六五至十五五${level}序原始位置与中位顺序趋势，空缺保留"><rect x="${L-23}" y="${T-22}" width="${x(1)-L+48}" height="${H-T-B+30}" fill="#f4eddf" rx="6"/><text x="${L}" y="20" font-size="12" fill="#697d6d">${level}序：数值越小，编排越靠前；折线为本期中位顺序</text>`;
    for(let r=1;r<=max;r+=step)svg+=`<line x1="${L}" y1="${y(r)}" x2="${W-R}" y2="${y(r)}" stroke="#e1e5da"/><text x="${L-14}" y="${y(r)+4}" text-anchor="end" font-size="11" fill="#7b8b7d">${r}</text>`;
    for(let i=1;i<byPlan.length;i++){
      if(medians[i-1]!==null&&medians[i]!==null){svg+=`<line class="order-segment" data-order-from="${D.sources[i-1].id}" data-order-to="${D.sources[i].id}" data-order-value-from="${medians[i-1]}" data-order-value-to="${medians[i]}" x1="${x(i-1)}" y1="${y(medians[i-1])}" x2="${x(i)}" y2="${y(medians[i])}" stroke="#b27c38" stroke-width="2.5"/>`;}
    }
    byPlan.forEach((hits,i)=>{
      const p=D.sources[i], all=rows.filter(r=>r.plan_id===p.id);
      if(!hits.length){const hasLevel=D.headings.some(h=>h.plan_id===p.id&&h.level===level);svg+=`<text class="order-gap" x="${x(i)}" y="${H-65}" text-anchor="middle" fill="#929d94" font-size="10">${!hasLevel?'本版无'+level+'级':'标题未匹配'}</text>`;}
      if(medians[i]!==null){const mx=x(i),my=y(medians[i]);svg+=`<path class="order-median-point" d="M ${mx} ${my-7} L ${mx+7} ${my} L ${mx} ${my+7} L ${mx-7} ${my} Z" fill="#b27c38" tabindex="0" role="button" data-order-period="${p.id}" data-order-median="${medians[i]}" aria-label="${p.name}，${hits.length}个标题，中位顺序${medians[i]}，查看标题"><title>${p.name} · ${hits.length}个标题 · 中位顺序${medians[i]}</title></path>`;if(hits.length>1)svg+=`<text x="${mx+(i===D.sources.length-1?-11:11)}" y="${my+4}" text-anchor="${i===D.sources.length-1?'end':'start'}" font-size="10" fill="#996c32">中位${medians[i]}</text>`;}
      hits.forEach(r=>{svg+=`<circle class="order-point" cx="${x(i)}" cy="${y(r.rank)}" r="5" fill="#24544c" tabindex="0" role="button" data-order-period="${p.id}" aria-label="${p.name}，第${r.rank}${level}，${esc(r.title)}，查看原文"><title>${p.name} · 第${r.rank}/${r.total}${level} · ${esc(r.title)}</title></circle>`;if(hits.length===1)svg+=`<text x="${x(i)}" y="${y(r.rank)-13}" text-anchor="middle" font-size="11" fill="#345344">第${r.rank}/${r.total}${level}</text>`;});
      svg+=`<text x="${x(i)}" y="${H-37}" text-anchor="middle" font-size="12" fill="#53675a">${p.name}</text><text x="${x(i)}" y="${H-17}" text-anchor="middle" font-size="9" fill="#879285">${p.years}</text>`;
    });
    $('#order-chart').innerHTML=svg+'</svg>';
    if(topicChanged&&window.matchMedia('(max-width:680px)').matches){const first=byPlan.findIndex(hits=>hits.length);$('#order-chart').scrollLeft=Math.max(0,x(first)/W*$('#order-chart').scrollWidth-70);}
    $('#order-table').innerHTML=`<table class="order-evidence-table"><thead><tr><th>规划</th><th>目录变化</th><th>匹配标题与位置（${level}）</th><th>原文定位</th></tr></thead><tbody>${periods.map(p=>{const plan=plans.get(p.plan_id),hits=rows.filter(r=>r.plan_id===p.plan_id);return `<tr data-order-row="${p.plan_id}"><td><strong>${plan.name}</strong><br><span class="quiet">${plan.years}${p.plan_id<8?' · 摘要':''}</span></td><td><span class="small-tag">${orderEvent(p)}</span>${hits.length>1?`<br><span class="quiet">${hits.length}处列示</span>`:''}</td><td>${hits.length?`<ul class="order-title-list">${hits.map(r=>`<li data-order-level="${r.level}"><span class="order-position">第${r.rank}${r.level} / 共${r.total}${r.level}</span> ${esc(r.title)}</li>`).join('')}</ul>`:`<span class="quiet">${p.has_level?`未匹配到相关${level}标题`:`本版无${level}级目录`}</span>`}</td><td>${hits.length?`<ul class="order-location-list">${hits.map(r=>`<li>第${r.rank}${r.level} · ${orderLocation(r)}</li>`).join('')}</ul>`:`<a href="${esc(plan.url)}" target="_blank" rel="noopener noreferrer">查看本期原文 ↗</a>`}</td></tr>`;}).join('')}</tbody></table>`;
  }
  function renderPlan() {
    const p = plans.get(state.selectedPlan); const hs = D.headings.filter(h=>h.plan_id===p.id && h.level!=='章');
    $$('#plan-picker button').forEach(b=>{const on=Number(b.dataset.plan)===p.id;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});
    $('#plan-detail').innerHTML = `<div class="plan-detail-head"><div><h3>${p.name} <span class="quiet">${p.years}</span></h3><p class="quiet">${esc(p.kind)} · 本研究统计${p.body_hanzi.toLocaleString()}个汉字${p.id===15?' · 尚在实施中':''}</p></div><a class="official-source-button" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">官方原文 ↗</a></div><ol class="plan-top-list">${hs.map(h=>`<li><span class="ordinal">${h.level} ${String(h.number).padStart(2,'0')}</span><span>${esc(h.title)}</span></li>`).join('')}</ol><p class="quiet">${esc(p.text_note)}</p><button class="text-button" data-plan-headings="${p.id}">查看本期完整篇章目录 ↗</button>`;
  }
  function renderEvidence() {
    const mode=state.evidenceMode==='headings'?'headings':'plans';
    state.evidenceMode=mode;
    const q=$('#evidence-query').value.trim().toLowerCase(),pid=$('#evidence-plan').value;
    $$('[data-evidence-mode]').forEach(b=>{const on=b.dataset.evidenceMode===mode;b.classList.toggle('selected',on);b.setAttribute('aria-selected',String(on));});
    const isReading=mode==='plans';$('#evidence-plans').hidden=!isReading;$('#evidence-search').hidden=isReading;
    if(isReading){renderPlan();return;}
    $('#evidence-description').textContent='保留原文的层级、顺序与所属篇。';
    const rows=D.headings.filter(h=>(!pid||h.plan_id===Number(pid))&&(!q||[h.title,h.parent,h.plan].filter(Boolean).join(' ').toLowerCase().includes(q)));
    $('#evidence-count').textContent=`${rows.length} 条匹配，显示前 ${Math.min(rows.length,state.evidenceLimit)} 条`;
    $('#more-evidence').hidden=rows.length<=state.evidenceLimit;
    if(!rows.length){$('#evidence-results').innerHTML='<div class="empty"><h3>没有匹配结果</h3><p>可以缩短关键词或清空筛选。</p></div>';return;}
    $('#evidence-results').innerHTML=`<div class="table-scroll"><table class="evidence-table"><thead><tr><th>规划</th><th>层级与顺序</th><th>标题</th><th>所属篇 / 部分</th><th>原文定位</th></tr></thead><tbody>${rows.slice(0,state.evidenceLimit).map(h=>`<tr><td data-label="规划">${h.plan}</td><td data-label="层级与顺序">第${h.number}${h.level} / ${h.level_total}</td><td data-label="标题">${esc(h.title)}</td><td data-label="所属篇 / 部分">${esc(h.parent)||'—'}</td><td data-label="原文定位"><a href="${esc(sourceLink(h.source_url,h.plan_id,h.page))}" target="_blank" rel="noopener noreferrer">${locationLabel(h.plan_id,h.page)} ↗</a></td></tr>`).join('')}</tbody></table></div>`;
  }
  function download(name,body,mime){const blob=new Blob([body],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function csvCell(v){let s=String(v??'');if(/^[=+@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
  function downloadData(type){
    if(type==='actions'){download('人生五年-结论与行动.json',JSON.stringify({asof:D.meta.asof,classification:{people:D.people,domains:D.domains},actions:D.actions.map(({priority,priority_reason,...action})=>action),findings:D.findings,evidence:D.evidence},null,2),'application/json;charset=utf-8');return;}
    let rows;
    if(type==='frequencies')rows=[['规划','关键词','次数','汉字分母','每万汉字次数','版本'],...D.frequencies.map(r=>{const p=plans.get(r.plan_id);return[p.name,r.term,r.count,p.body_hanzi,r.normalized.toFixed(8),p.kind];})];
    else rows=[['规划','层级','顺序','同层级总数','标题','所属篇','定位','来源'],...D.headings.map(h=>[h.plan,h.level,h.number,h.level_total,h.title,h.parent,locationLabel(h.plan_id,h.page),h.source_url])];
    download(`人生五年-${type==='frequencies'?'词频':'篇章'}.csv`,'\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
  }

  // Render static navigation once to keep keyboard focus stable when filtering.
  $('#corpus-stats').innerHTML=`<span><strong>${D.meta.corpus_count}</strong>期公开文本</span><span><strong>${D.meta.term_count}</strong>个关键词</span><span><strong>${D.meta.heading_count}</strong>条篇章标题</span><span>附原文与来源</span>`;
  $('#person-filter').innerHTML='<option value="all">全部处境</option>'+D.people.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  $('#domain-filters').innerHTML=[{id:'all',name:'全部领域'},...D.domains].map(d=>`<button class="chip" data-domain="${d.id}" aria-pressed="false">${d.name}</button>`).join('');
  ['#word-one','#word-two'].forEach((sel,i)=>{$(sel).innerHTML=(i?'<option value="">不比较</option>':'')+D.terms.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');});
  $('#word-one').value='信息化';$('#word-two').value='人工智能';
  $('#order-topic').innerHTML=D.order_topics.map(t=>`<option>${esc(t.name)}</option>`).join('');
  $('#plan-picker').innerHTML=D.sources.map(p=>`<button data-plan="${p.id}" aria-pressed="false">${p.name}</button>`).join('');
  $('#evidence-plan').innerHTML='<option value="">全部规划</option>'+D.sources.map(p=>`<option value="${p.id}">${p.name}${p.id<8?'（摘要）':''}</option>`).join('');
  $$('[data-history]').forEach(b=>{b.id='history-tab-'+b.dataset.history;b.setAttribute('aria-controls','history-'+b.dataset.history);const panel=$('#history-'+b.dataset.history);panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',b.id);});
  renderFindings();renderActions();

  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.view){showView(b.dataset.view,{scroll:true});return;}
    if(b.dataset.go){showView(b.dataset.go,{scroll:true});return;}
    if(b.dataset.domain){state.domain=b.dataset.domain;state.matrix=false;renderActions();updateActionHash();return;}
    if(b.dataset.openAction){openAction(b.dataset.openAction);return;}
    if(b.dataset.downloadWorksheet){const a=D.actions.find(x=>x.id===b.dataset.downloadWorksheet);if(a?.worksheet){const cols=a.worksheet.columns;download(`人生五年-${a.title}-填写表.csv`,'\uFEFF'+[cols,...Array.from({length:5},()=>cols.map(()=>''))].map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');}return;}
    if(b.dataset.jumpEvidence){const target=document.getElementById('quote-'+b.dataset.jumpEvidence);if(target){target.open=true;target.scrollIntoView({block:'start',behavior:'instant'});target.querySelector('summary').focus({preventScroll:true});}return;}
    if(b.dataset.openFinding){openFinding(b.dataset.openFinding);return;}
    if(b.dataset.openEvidence){openEvidence(b.dataset.openEvidence);return;}
    if(b.dataset.matrixPerson){state.person=b.dataset.matrixPerson;state.domain=b.dataset.matrixDomain;state.matrix=false;renderActions();updateActionHash();$('#action-grid').scrollIntoView({block:'start'});return;}
    if(b.dataset.history){selectHistory(b.dataset.history);return;}
    if(b.dataset.orderPeriod){openOrderPeriod(Number(b.dataset.orderPeriod));return;}
    if(b.dataset.plan){state.selectedPlan=Number(b.dataset.plan);renderPlan();return;}
    if(b.dataset.planHeadings){state.evidenceMode='headings';state.evidenceLimit=40;$('#evidence-query').value='';$('#evidence-plan').value=b.dataset.planHeadings;showView('evidence',{scroll:true});return;}
    if(b.dataset.evidenceMode){state.evidenceMode=b.dataset.evidenceMode;state.evidenceLimit=40;renderEvidence();return;}
    if(b.dataset.download){downloadData(b.dataset.download);return;}
  });
  document.addEventListener('click',e=>{const o=e.target.closest('.order-point, .order-median-point');if(o)openOrderPeriod(Number(o.dataset.orderPeriod));});
  document.addEventListener('keydown',e=>{
    const o=e.target.closest('.order-point, .order-median-point');if(o&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openOrderPeriod(Number(o.dataset.orderPeriod));}
    if(e.target.matches('[role="tab"]')&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const tabs=$$('[role="tab"]',e.target.parentElement);const i=tabs.indexOf(e.target);const next=tabs[(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];next.focus();next.click();}
  });
  $('#person-filter').addEventListener('change',e=>{state.person=e.target.value;state.matrix=false;renderActions();updateActionHash();});
  $('#reset-actions').addEventListener('click',()=>{state.person='all';state.domain='all';state.matrix=false;renderActions();updateActionHash();});
  $('#show-domain-actions').addEventListener('click',()=>{state.person='all';renderActions();updateActionHash();});
  $('#cards-mode').addEventListener('click',()=>{state.matrix=false;renderActions();});
  $('#matrix-mode').addEventListener('click',()=>{state.matrix=true;renderActions();});
  $('#classification-help').addEventListener('click',()=>openDialog('分类说明','<h2 id="detail-title">按工作形态与人生阶段阅读</h2><p>五类处境用于组织内容，读者可选择当前相关的一类，再按生活领域筛选。同一个人也可能对应多个入口。</p><p>这些分类由项目整理者设计，并非政策中的资格划分。具体适用条件见各条详情。</p>','五类处境按工作形态与人生阶段设置，同一人可对应多个入口。具体适用条件见各条详情。','classification'));
  ['#word-one','#word-two','#word-metric'].forEach(s=>$(s).addEventListener('change',renderWords));$('#order-topic').addEventListener('change',renderOrder);$('#order-level').addEventListener('change',renderOrder);
  $('#evidence-query').addEventListener('input',()=>{state.evidenceLimit=40;renderEvidence();});$('#evidence-plan').addEventListener('change',()=>{state.evidenceLimit=40;renderEvidence();});
  $('#reset-evidence').addEventListener('click',()=>{$('#evidence-query').value='';$('#evidence-plan').value='';state.evidenceLimit=40;renderEvidence();});
  $('#more-evidence').addEventListener('click',()=>{state.evidenceLimit+=40;renderEvidence();});
  function route(){
    let hash;try{hash=decodeURIComponent(location.hash.slice(1));}catch{hash='';}
    const routedDetail = /^(?:finding|action|order)\//.test(hash) || (hash.startsWith('evidence/') && hash!=='evidence/plans'&&hash!=='evidence/contexts') || hash==='classification';
    if ($('#detail-dialog').open && !routedDetail) { closingForRoute = true; $('#detail-dialog').close(); }
    if(!hash)selectHistory('findings');
    if(hash==='evidence/plans'||hash==='history/plans'||hash==='evidence/contexts'){state.evidenceMode='plans';showView('evidence',{hash:false});return;}
    if(hash==='history/order'){showView('history',{hash:false});selectHistory('order');return;}
    if(hash==='priority'){showView('actions',{hash:false});return;}
    if(hash.startsWith('order/')){const [,id,pid,level]=hash.split('/'),topic=D.order_topics.find(t=>t.id===id);if(topic&&plans.has(Number(pid))){$('#order-topic').value=topic.name;if(['篇','章'].includes(level))$('#order-level').value=level;showView('history',{hash:false});selectHistory('order');openOrderPeriod(Number(pid));return;}}
    if(hash.startsWith('action/')){showView('actions',{hash:false});openAction(hash.slice(7));return;}
    if(hash.startsWith('finding/')){showView('history',{hash:false});openFinding(hash.slice(8));return;}
    if(hash.startsWith('evidence/')){showView('evidence',{hash:false});openEvidence(hash.slice(9));return;}
    if(hash==='classification'){openDialog('分类说明','<h2 id="detail-title">人群与领域如何划分</h2><p>按工作形态与人生阶段设计五类处境，再与七个人生领域交叉。标签可切换，不是等级或个人待遇判定。</p>','人群与领域为研究者设计的导航标签。','classification');return;}
    const [view,query]=hash.split('?');if(view==='actions'&&query){const params=new URLSearchParams(query);const oldPerson=params.get('person'),p=({office:'worker',field:'worker',flex:'worker'})[oldPerson]||oldPerson,old=params.get('domain'),d=({career:'employment',family:'life',money:'life',mobility:'life',rights:'life'})[old]||old;if(p==='all'||people.has(p))state.person=p;if(d==='all'||domains.has(d))state.domain=d;renderActions();}
    showView(view||'history',{hash:false});
  }
  window.addEventListener('hashchange',route);route();
})();

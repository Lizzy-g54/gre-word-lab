const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle = a => { const out=[...a]; for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];} return out; };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const saved = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const state = { vocab: [], pairs: [], adjacent: new Map(), custom: saved('gre-custom-v1', []), stats: saved('gre-stats-v2', {}), daily: saved('gre-daily-v1', {}), page: 'home', libraryQuery: '', libraryDeck: 'all', wrongFilter: 'all', wrongQuery: '', quiz: null };
const save = () => localStorage.setItem('gre-stats-v2', JSON.stringify(state.stats));
const saveDaily = () => localStorage.setItem('gre-daily-v1', JSON.stringify(state.daily));
function ensureDay(){
  const current=today(), changed=state.daily.date!==current;
  let dirty=changed;
  state.daily.meaningDone ||= {};
  state.daily.pairsDone ||= {};
  state.daily.reviewDone ||= {};
  for(const type of ['meaning','pairs']){
    const items=type==='meaning'?allVocab():state.pairs;
    const doneField=type==='meaning'?'meaningDone':'pairsDone';
    const orderField=type==='meaning'?'meaningOrder':'pairsOrder';
    const keys=items.map(item=>key(type,item));
    let undone=keys.filter(k=>!state.daily[doneField][k]);
    const oldOrder=state.daily[orderField]||[];
    if(changed){
      if(keys.length && !undone.length){state.daily[doneField]={};undone=keys;}
      const oldRemaining=oldOrder.filter(k=>undone.includes(k));
      const fresh=shuffle(undone);
      if(fresh.length>1 && fresh.length===oldRemaining.length && fresh.every((k,i)=>k===oldRemaining[i]))[fresh[0],fresh[1]]=[fresh[1],fresh[0]];
      state.daily[orderField]=fresh;
    }else{
      const available=new Set(keys), kept=oldOrder.filter(k=>available.has(k)), known=new Set(kept);
      const added=shuffle(keys.filter(k=>!known.has(k)));
      if(added.length || kept.length!==oldOrder.length || !state.daily[orderField]){state.daily[orderField]=kept.concat(added);dirty=true;}
    }
  }
  if(changed){state.daily.date=current;state.daily.reviewDone={};}
  if(dirty)saveDaily();
}
const allVocab = () => [...state.vocab, ...state.custom];
const key = (type, item) => type === 'meaning' ? `m:${item.word}` : `p:${[item.a,item.b].sort().join('|')}`;
const record = (type, item) => state.stats[key(type,item)] || {wrong:0,streak:0,active:false,lastDate:'',due:''};
const doneMap = type => state.daily[type==='meaning'?'meaningDone':'pairsDone'];
const remaining = type => { ensureDay(); const items=type==='meaning'?allVocab():state.pairs,byKey=new Map(items.map(item=>[key(type,item),item])); return state.daily[type==='meaning'?'meaningOrder':'pairsOrder'].filter(k=>!doneMap(type)[k]&&byKey.has(k)).map(k=>byKey.get(k)); };
const doneCount = type => (type==='meaning'?allVocab():state.pairs).length-remaining(type).length;
const dueItems = () => {
  ensureDay();
  const items = [];
  allVocab().forEach(item => { const r=record('meaning',item); if(r.wrong>0 && !state.daily.reviewDone[key('meaning',item)]) items.push({type:'meaning',item}); });
  state.pairs.forEach(item => { const r=record('pairs',item); if(r.wrong>0 && !state.daily.reviewDone[key('pairs',item)]) items.push({type:'pairs',item}); });
  return items;
};
const totalWrong = () => Object.values(state.stats).reduce((n,r)=>n+(r.wrong||0),0);
const activeWrong = () => Object.values(state.stats).filter(r=>r.wrong>0).length;
function mark(type,item,correct,isReview){
  const k=key(type,item), r={...record(type,item)};
  if(!correct){ r.wrong=(r.wrong||0)+1; r.streak=0; r.active=true; r.lastDate=today(); }
  else if(isReview && r.wrong>0){ r.streak=(r.streak||0)+1; r.lastDate=today(); }
  state.stats[k]=r; save();
  if(isReview)state.daily.reviewDone[k]=true;
  else doneMap(type)[k]=true;
  saveDaily();
}
const pageNames={home:'总览',meaning:'认中文',pairs:'等价词',review:'每日错词',library:'我的词库'};
function go(page){ state.page=page; state.quiz=null; document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page)); $('#pageTitle').textContent=pageNames[page]; location.hash=page; render(); window.scrollTo({top:0,behavior:'smooth'}); }
function header(kicker,title,sub){return `<div class="page-head"><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${sub}</p></div>`;}
function renderHome(){
  const due=dueItems().length, m=doneCount('meaning'),p=doneCount('pairs'),mt=allVocab().length,pt=state.pairs.length;
  return `<section class="hero"><div><div class="eyebrow">TODAY'S STUDY PLAN</div><h1>今天的词表，逐项过一遍。</h1><p>没做完的跨天接着做；每天随机重排剩余内容。做完整份后，隔天开始新一轮。</p></div><div class="hero-art" aria-hidden="true"><div class="book"></div><span class="spark">✳</span></div></section>
  <div class="stats"><div class="stat"><div class="label">中文词本轮已过</div><span class="number">${m.toLocaleString()}</span><span class="suffix">/ ${mt.toLocaleString()}</span></div><div class="stat"><div class="label">词对本轮已过</div><span class="number">${p.toLocaleString()}</span><span class="suffix">/ ${pt.toLocaleString()}</span></div><div class="stat"><div class="label">错词今日待复习</div><span class="number">${due}</span><span class="suffix">项</span></div><div class="stat"><div class="label">累计答错</div><span class="number">${totalWrong()}</span><span class="suffix">次</span></div></div>
  <div class="section-heading"><h2>当前轮次</h2><span>已做进度跨天保留，每天随机重排剩余项目</span></div>
  <div class="daily-grid"><button class="daily-card" data-action="go-meaning"><span class="daily-icon">文</span><span><strong>中文释义</strong><small>剩余 ${(mt-m).toLocaleString()} 词</small></span><b>${Math.round(m/Math.max(mt,1)*100)}%</b><span class="daily-bar"><i style="width:${m/Math.max(mt,1)*100}%"></i></span></button><button class="daily-card" data-action="go-pairs"><span class="daily-icon pair">∞</span><span><strong>六选二等价词</strong><small>剩余 ${(pt-p).toLocaleString()} 组</small></span><b>${Math.round(p/Math.max(pt,1)*100)}%</b><span class="daily-bar"><i style="width:${p/Math.max(pt,1)*100}%"></i></span></button></div>
  <div class="review-banner"><div><strong>${due ? `今天还有 ${due} 项错词待复习` : '今天的错词已复习完'}</strong><p>单词和词对分开计数；所有曾经做错的项目每天在这里再过一遍。</p></div><button data-action="go-review">${due ? '开始错词复习 →' : '查看错词记录 →'}</button></div>`;
}
function startQuiz(mode,items,isReview=false){
  const batch=(isReview?shuffle(items):items).slice(0,20);
  state.quiz={mode,items:batch,index:0,selected:[],answered:false,correct:false,isReview,right:0,wrong:0,question:null,day:today()};
  buildQuestion(); render();
}
function buildQuestion(){
  const q=state.quiz;if(!q || q.index>=q.items.length)return;
  const entry=q.items[q.index];const type=q.isReview?entry.type:q.mode;const item=q.isReview?entry.item:entry;
  q.selected=[];q.answered=false;q.correct=false;
  if(type==='meaning'){
    const pool=shuffle(allVocab().filter(x=>x.word!==item.word && x.meaning!==item.meaning));
    const opts=shuffle([item,...pool.slice(0,3)]);
    q.question={type,item,options:opts.map(x=>({value:x.meaning,id:x.word})),correct:[item.word]};
  }else{
    const forbidden=new Set([item.a,item.b]);
    const pool=shuffle(state.pairs.filter(x=>!forbidden.has(x.a)&&!forbidden.has(x.b)&&x.meaningA!==item.meaningA&&x.meaningB!==item.meaningB));
    const distract=[];
    for(const p of pool){
      const w=Math.random()<.5?p.a:p.b;
      if(forbidden.has(w)||distract.includes(w))continue;
      if([...forbidden,...distract].some(other=>state.adjacent.get(w)?.has(other)))continue;
      distract.push(w);if(distract.length===4)break;
    }
    q.question={type,item,options:shuffle([item.a,item.b,...distract]).map(w=>({value:w,id:w})),correct:[item.a,item.b]};
  }
}
function renderQuiz(){
  const q=state.quiz;if(!q)return '';
  if(q.index>=q.items.length){
    const left=q.isReview?dueItems().length:remaining(q.mode).length;
    return `<div class="quiz-card finish"><div><div class="finish-icon">✓</div><h2>${left?'这一组完成了':q.isReview?'今天的错词已过完':'本轮词表已过完'}</h2><p>本组答对 ${q.right} 题 · 答错 ${q.wrong} 题。${left?`${q.isReview?'今天':'本轮'}还剩 ${left} 项。`:q.isReview?'明天继续复习全部错词。':'明天开启随机排序的新一轮。'}</p>${left?'<button class="primary" data-action="continue-quiz">继续下一组 →</button>':'<button class="primary" data-action="end-quiz">返回计划</button>'}</div></div>`;
  }
  const z=q.question;const isPair=z.type==='pairs';const counter=`${q.index+1} / ${q.items.length}`;
  let options=z.options.map((o,i)=>{const sel=q.selected.includes(o.id),right=z.correct.includes(o.id);let cls='';if(q.answered)cls=right?'correct':sel?'wrong':'';else if(sel)cls='selected';return `<button class="option ${cls}" data-choice="${esc(o.id)}" ${q.answered?'disabled':''}><span class="letter">${String.fromCharCode(65+i)}</span><span>${esc(o.value)}</span></button>`;}).join('');
  let result='';
  if(q.answered){
    const meaning=isPair?`${esc(z.item.a)}：${esc(z.item.meaningA)}<br>${esc(z.item.b)}：${esc(z.item.meaningB)}`:esc(z.item.meaning);
    result=`<div class="answer-panel ${q.correct?'':'bad'}"><strong>${q.correct?'答对了！':'已记入错词，今天再复习一次。'}</strong>${meaning}${!isPair&&z.item.example?`<div class="example">例句：${esc(z.item.example)}</div>`:''}</div>`;
  }
  return `<div class="quiz-card"><div class="quiz-top"><span>${q.isReview?'每日错词复习':isPair?'等价词每日词表':'中文释义每日词表'} · 本组 ${counter}</span><span>${q.right} 对 / ${q.wrong} 错</span></div><div class="progress-track"><div class="progress-fill" style="width:${((q.index+1)/q.items.length)*100}%"></div></div>${isPair?`<span class="pair-topic">请选择意思等价的两个词</span><h2 class="question-word" style="font-size:31px">哪两个词能配成一组？</h2><p class="question-sub">选择两个答案后自动判分</p>`:`<div class="question-label">请选择这个词的中文意思</div><h2 class="question-word">${esc(z.item.word)}</h2><p class="question-sub">先想一想，再选择你认为正确的意思。</p>`}<div class="options ${isPair?'pair-options':''}">${options}</div>${isPair&&!q.answered?'<div class="pair-hint">已选 <span id="selectedCount">'+q.selected.length+'</span> / 2</div>':''}${result}<div class="quiz-footer"><button class="quiet" data-action="end-quiz">暂时退出</button>${q.answered&&!q.correct?'<button class="primary" data-action="next-question">下一题 →</button>':q.answered?'<span class="small-note">即将进入下一题</span>':isPair?'<span class="small-note">选择两个词</span>':'<span></span>'}</div></div>`;
}
function renderPractice(type){
  const pair=type==='pairs';
  const title=pair?'本轮等价词':'本轮中文释义';
  const total=pair?state.pairs.length:allVocab().length, done=doneCount(type), left=total-done;
  const sub=pair?'没做完的词对跨天继续；每天随机调整剩余顺序。每题选两个等价词。':'没做完的单词跨天继续；每天随机调整剩余顺序。答错会进入每日错词复习。';
  return `${header(pair?'SENTENCE EQUIVALENCE':'WORD MEANING',title,sub)}<div class="today-progress"><strong>本轮进度：${done.toLocaleString()} / ${total.toLocaleString()}</strong><span>剩余 ${left.toLocaleString()} ${pair?'组':'词'}</span><div class="daily-bar"><i style="width:${done/Math.max(total,1)*100}%"></i></div></div><div class="toolbar"><div class="tabs"><button class="active">${pair?'等价词每日词表':'中文释义每日词表'}</button></div><span class="small-note">每组最多 20 题 · 退出后从未完成处继续</span></div>${state.quiz?renderQuiz():left?`<div class="empty"><div class="glyph">${pair?'∞':'文'}</div><h2>本轮还剩 ${left.toLocaleString()} ${pair?'组':'词'}</h2><p>每次做 20 题；已完成的进度保留，次日随机重排剩余项目。</p><button class="primary" data-action="start-${type}">继续今天的 20 题 →</button></div>`:`<div class="empty"><div class="glyph">✓</div><h2>本轮词表已过完</h2><p>明天会开始随机排序的新一轮。现在可以去复习错词。</p><button class="primary" data-action="go-review">查看错词 →</button></div>`}`;
}
function renderReview(){
  const due=dueItems();
  const all=Object.entries(state.stats).filter(([,r])=>r.wrong>0);
  const wordWrong=all.filter(([k])=>k.startsWith('m:')).reduce((n,[,r])=>n+r.wrong,0);
  const pairWrong=all.filter(([k])=>k.startsWith('p:')).reduce((n,[,r])=>n+r.wrong,0);
  const rows=all.filter(([k])=>(state.wrongFilter==='all'||k.startsWith(state.wrongFilter==='meaning'?'m:':'p:'))&&k.toLowerCase().includes(state.wrongQuery.toLowerCase())).sort((a,b)=>b[1].wrong-a[1].wrong);
  const list=`<div class="section-heading"><h2>逐项答错记录</h2><span>每个单词、每组词对分别累计</span></div><div class="library-tools"><div class="tabs"><button data-wrong-filter="all" class="${state.wrongFilter==='all'?'active':''}">全部</button><button data-wrong-filter="meaning" class="${state.wrongFilter==='meaning'?'active':''}">单词</button><button data-wrong-filter="pairs" class="${state.wrongFilter==='pairs'?'active':''}">词对</button></div><input class="search" id="wrongSearch" placeholder="搜索错词或词对" value="${esc(state.wrongQuery)}" aria-label="搜索错词"></div><div class="table-wrap"><table><thead><tr><th>单词 / 词对</th><th>类型</th><th>今日复习</th><th>累计答错</th></tr></thead><tbody>${rows.slice(0,100).map(([k,r])=>`<tr><td>${esc(k.slice(2).replace('|',' / '))}</td><td>${k.startsWith('m:')?'单词':'词对'}</td><td>${state.daily.reviewDone[k]?'已过':'待复习'}</td><td><span class="count-pill">${r.wrong} 次</span></td></tr>`).join('')||'<tr><td colspan="4" style="text-align:center;padding:30px;font-family:inherit">暂无符合条件的错词</td></tr>'}</tbody></table></div>${rows.length>100?`<p class="small-note">显示前 100 项，共 ${rows.length} 项；可用搜索定位其他项目。</p>`:''}`;
  return `${header('DAILY REVIEW','错词每天再过一遍','所有曾经做错的单词和词对每天复习一次，包括今天新做错的项目。答对也会在明天继续出现。')}<div class="stats"><div class="stat"><div class="label">今日待复习</div><span class="number">${due.length}</span><span class="suffix">项</span></div><div class="stat"><div class="label">错词总数</div><span class="number">${activeWrong()}</span><span class="suffix">项</span></div><div class="stat"><div class="label">单词累计答错</div><span class="number">${wordWrong}</span><span class="suffix">次</span></div><div class="stat"><div class="label">词对累计答错</div><span class="number">${pairWrong}</span><span class="suffix">次</span></div></div>${state.quiz?renderQuiz():due.length?`<div class="review-banner" style="margin:0 0 25px"><div><strong>今天还剩 ${due.length} 项错词</strong><p>每组最多 20 题，退出后继续未复习的项目。</p></div><button data-action="start-review">继续错词复习 →</button></div>`:`<div class="empty"><div class="glyph">✓</div><h2>今天的错词已过完</h2><p>所有错词明天会再次出现；今天新做错的项目也会加入这里。</p><button class="primary" data-action="go-meaning">继续今日词表 →</button></div>`}${list}`;
}
function renderLibrary(){
  const q=state.libraryQuery.toLowerCase();let items=allVocab().filter(x=>(state.libraryDeck==='all'||(state.libraryDeck==='custom'?x.source==='custom':x.source!=='custom')));
  if(q)items=items.filter(x=>x.word.includes(q)||x.meaning.includes(q));
  items=items.slice(0,100);
  return `${header('MY WORD BANK','我的词库','浏览中文释义，查看每个词的累计答错次数。你可以再导入自己的 CSV / TSV 词表。')}<div class="import-card"><div><h3>添加 3000 词表或自定义词表</h3><p>支持 CSV / TSV，前两列依次为英文单词、中文释义；可带表头。导入后仅保存在当前浏览器。</p></div><button class="secondary" data-action="import">导入词表 +</button></div><div class="import-card"><div><h3>迁移学习进度</h3><p>从旧网址下载进度备份，再到 GitHub Pages 导入；答错次数、当前轮次和自定义词表都会带过去。</p></div><div class="backup-actions"><button class="secondary" data-action="export-progress">下载进度</button><button class="secondary" data-action="import-progress">导入进度</button></div></div><div class="library-tools"><input class="search" id="librarySearch" placeholder="搜索英文或中文释义" value="${esc(state.libraryQuery)}" aria-label="搜索词库"><select class="select" id="libraryDeck"><option value="all" ${state.libraryDeck==='all'?'selected':''}>全部词库</option><option value="base" ${state.libraryDeck==='base'?'selected':''}>急救 1400 词</option><option value="custom" ${state.libraryDeck==='custom'?'selected':''}>自定义词表</option></select></div><div class="table-wrap"><table><thead><tr><th>英文单词</th><th>中文释义</th><th>答错次数</th></tr></thead><tbody>${items.map(x=>`<tr><td>${esc(x.word)}</td><td>${esc(x.meaning)}</td><td>${record('meaning',x).wrong?`<span class="count-pill">${record('meaning',x).wrong} 次</span>`:'—'}</td></tr>`).join('')||'<tr><td colspan="3" style="text-align:center;padding:36px;font-family:inherit">没有找到符合条件的词</td></tr>'}</tbody></table></div><div class="source-card"><strong>词库来源</strong>中文释义：学而思 GRE 填空急救 1400 词 Excel 版（恢复出 1400 词）。等价词：BB 六选二词表（表格速记版）、真经 GRE 等价词汇总。学而思高频六选二 1000 词 PDF 为扫描版，暂未并入。等价词并非所有语境下都能互换，请结合题目语义判断。</div>`;
}
function render(){
  ensureDay();
  if(state.quiz && state.quiz.day!==today())state.quiz=null;
  const view=$('#view');view.innerHTML=({home:renderHome,meaning:()=>renderPractice('meaning'),pairs:()=>renderPractice('pairs'),review:renderReview,library:renderLibrary}[state.page]||renderHome)();
}
function choose(id){
  const q=state.quiz;if(!q||q.answered)return;const z=q.question;
  if(z.type==='meaning'){q.selected=[id];grade();return;}
  if(q.selected.includes(id))q.selected=q.selected.filter(x=>x!==id);else if(q.selected.length<2)q.selected.push(id);
  if(q.selected.length===2)grade();else render();
}
function grade(){
  if(state.quiz.day!==today()){state.quiz=null;render();toast('已保留进度，剩余项目已重新排序。');return;}
  const q=state.quiz,z=q.question;
  q.correct=q.selected.length===z.correct.length&&q.selected.every(x=>z.correct.includes(x));q.answered=true;
  q.correct?q.right++:q.wrong++;
  mark(z.type,z.item,q.correct,q.isReview);render();
  if(q.correct)setTimeout(()=>{if(state.quiz===q && q.answered && q.correct)next();},500);
}
function next(){const q=state.quiz;if(!q)return;q.index++;buildQuestion();render();}
function toast(msg){document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.textContent=msg;document.body.append(el);setTimeout(()=>el.remove(),3500);}
function parseDelimited(text){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());const delim=lines[0]?.includes('\t')?'\t':',';
  const split=line=>{const out=[];let field='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===delim&&!quoted){out.push(field.trim());field='';}else field+=c;}out.push(field.trim());return out;};
  return lines.map(split);
}
async function importFile(file){
  if(!file)return;const rows=parseDelimited(await file.text());let added=0;const existing=new Set(allVocab().map(x=>x.word));
  for(const row of rows){const word=(row[0]||'').trim().toLowerCase(),meaning=(row[1]||'').trim();if(!/^[a-z][a-z '-]*$/.test(word)||!meaning||existing.has(word))continue;state.custom.push({word,meaning,source:'custom',example:''});existing.add(word);added++;}
  localStorage.setItem('gre-custom-v1',JSON.stringify(state.custom));toast(added?`成功导入 ${added} 个单词`:'没有找到可导入的新单词，请检查前两列');render();
}
function exportProgress(){
  ensureDay();
  const payload={version:1,exportedAt:new Date().toISOString(),stats:state.stats,daily:state.daily,custom:state.custom};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`gre-word-lab-progress-${today()}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importProgress(file){
  if(!file)return;
  try{
    const data=JSON.parse(await file.text());
    if(data.version!==1||!data.stats||typeof data.stats!=='object'||!data.daily||typeof data.daily!=='object'||!Array.isArray(data.custom))throw new Error('format');
    if(!window.confirm('导入会替换这个网址上已有的学习进度。确定继续吗？'))return;
    state.stats=data.stats;state.daily=data.daily;state.custom=data.custom;
    save();saveDaily();localStorage.setItem('gre-custom-v1',JSON.stringify(state.custom));
    ensureDay();render();toast('学习进度已导入');
  }catch{toast('进度文件无法读取，请选择本站下载的 JSON 备份');}
}
document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-page]');if(nav){go(nav.dataset.page);return;}
  const wrongFilter=e.target.closest('[data-wrong-filter]');if(wrongFilter){state.wrongFilter=wrongFilter.dataset.wrongFilter;render();return;}
  const choice=e.target.closest('[data-choice]');if(choice){choose(choice.dataset.choice);return;}
  const act=e.target.closest('[data-action]');if(!act)return;
  const a=act.dataset.action;
  if(a.startsWith('go-'))return go(a.slice(3));
  if(a==='start-meaning')return startQuiz('meaning',remaining('meaning'));
  if(a==='start-pairs')return startQuiz('pairs',remaining('pairs'));
  if(a==='start-review')return startQuiz('review',dueItems(),true);
  if(a==='continue-quiz'){const old=state.quiz;state.quiz=null;return old.isReview?startQuiz('review',dueItems(),true):startQuiz(old.mode,remaining(old.mode));}
  if(a==='next-question')return next();
  if(a==='end-quiz'){state.quiz=null;render();return;}
  if(a==='import')return $('#importFile').click();
  if(a==='export-progress')return exportProgress();
  if(a==='import-progress')return $('#progressFile').click();
});
document.addEventListener('input',e=>{if(e.target.id==='librarySearch'||e.target.id==='wrongSearch'){const field=e.target.id==='librarySearch'?'libraryQuery':'wrongQuery';state[field]=e.target.value;const pos=e.target.selectionStart;render();const input=$('#'+e.target.id);input.focus();input.setSelectionRange(pos,pos);}});
document.addEventListener('change',e=>{if(e.target.id==='libraryDeck'){state.libraryDeck=e.target.value;render();}if(e.target.id==='importFile'){importFile(e.target.files[0]);e.target.value='';}if(e.target.id==='progressFile'){importProgress(e.target.files[0]);e.target.value='';}});
document.addEventListener('keydown',e=>{if(!state.quiz||state.quiz.answered)return;const n=Number(e.key);if(n>=1&&n<=state.quiz.question.options.length){choose(state.quiz.question.options[n-1].id);}});
async function init(){
  $('#sideDate').textContent=new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date());
  try { const [v,p]=await Promise.all([fetch('./data/vocab.json').then(r=>r.json()),fetch('./data/pairs.json').then(r=>r.json())]);state.vocab=v;state.pairs=p;for(const pair of p){if(!state.adjacent.has(pair.a))state.adjacent.set(pair.a,new Set());if(!state.adjacent.has(pair.b))state.adjacent.set(pair.b,new Set());state.adjacent.get(pair.a).add(pair.b);state.adjacent.get(pair.b).add(pair.a);} }
  catch { $('#view').innerHTML='<div class="empty"><h2>词库加载失败</h2><p>请刷新页面重试。</p></div>';return; }
  ensureDay();
  const hash=location.hash.slice(1);if(pageNames[hash])go(hash);else render();
}
init();

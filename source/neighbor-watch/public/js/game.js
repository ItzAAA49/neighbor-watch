(async () => {
  const $ = id => document.getElementById(id);
  await Neighbor.restoreRemote();
  const qs = new URLSearchParams(location.search);
  const labels = {campaign:'キャンペーン',tutorial:'チュートリアル',arcade:'アーケード',nightmare:'ナイトメア',custom:'カスタム',cards:'カードゲーム'};
  let g = Neighbor.active();
  const requestedMode = qs.get('mode');
  if (requestedMode && !Object.prototype.hasOwnProperty.call(labels, requestedMode)) { location.replace('/'); return; }
  if (requestedMode && g && g.mode !== requestedMode) g = null;
  if (!g) { g={mode:requestedMode||'campaign',day:1,dead:[],createdAt:Date.now(),updatedAt:Date.now(),seed:Date.now()>>>0,visitorIndex:0,visitors:[],todayList:[],checklist:{},actions:[],score:0,captures:0,kills:0,admitted:0,minorMistakes:0,errors:0,reportErrors:0,chesterDone:false,campaignStats:{admittedNames:[],reportedNames:[],visitorCount:0,doppelVisitors:0,admittedVisitors:0,admittedDoppels:0,capturedDoppels:0,rejectedResidents:0,humanKilled:0,seenNames:[]}}; Neighbor.writeActive(g); }
  if (!labels[g.mode]) { location.replace('/'); return; }
  if (g.finished) { location.replace('/result'); return; }
  if (g.mode === 'nightmare' && !Neighbor.getSave().campaign.unlockedNightmare) { Neighbor.toast('ナイトメアはキャンペーンをクリアすると解放されます。'); Neighbor.writeActive(null); location.replace('/'); return; }
  g.day = Number.isInteger(Number(g.day)) ? Math.max(1, Math.min(5, Number(g.day))) : 1;
  g.dead = Array.isArray(g.dead) ? [...new Set(g.dead.filter(v => typeof v === 'string'))] : [];
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const finiteNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  g.visitors = Array.isArray(g.visitors) ? g.visitors.filter(v => isRecord(v) && isRecord(v.person) && typeof v.person.name === 'string').slice(0, 30) : [];
  g.visitors = g.visitors.map(visitor => {
    const person = { ...visitor.person };
    const idData = isRecord(visitor.idData) ? { ...visitor.idData } : { ...person };
    const formData = isRecord(visitor.formData) ? { ...visitor.formData } : { ...person };
    return {
      ...visitor,
      person,
      residentName: typeof visitor.residentName === 'string' ? visitor.residentName : person.name,
      truth: Boolean(visitor.truth),
      listed: Boolean(visitor.listed),
      faceTags: Array.isArray(visitor.faceTags) ? visitor.faceTags.filter(tag => typeof tag === 'string') : (Array.isArray(person.tags) ? person.tags : []),
      idData: { ...idData, name: typeof idData.name === 'string' ? idData.name : person.name },
      formData: { ...formData, name: typeof formData.name === 'string' ? formData.name : person.name },
      idMissing: Boolean(visitor.idMissing),
      formMissing: Boolean(visitor.formMissing),
      appearanceIssue: Boolean(visitor.appearanceIssue),
      idIssue: Boolean(visitor.idIssue),
      formIssue: Boolean(visitor.formIssue),
      dialog: typeof visitor.dialog === 'string' ? visitor.dialog : 'こんにちは。戻ってきました。'
    };
  });
  g.visitorIndex = Number.isInteger(Number(g.visitorIndex)) ? Math.max(0, Math.min(g.visitors.length, Number(g.visitorIndex))) : 0;
  g.todayList = Array.isArray(g.todayList) ? g.todayList.filter(v => isRecord(v) && typeof v.name === 'string' && typeof v.room === 'string').slice(0, 20) : [];
  g.checklist = isRecord(g.checklist) ? Object.fromEntries(Object.entries(g.checklist).filter(([key, value]) => ['appearance','id','form','list'].includes(key) && ['yes','no'].includes(value))) : {};
  g.actions = Array.isArray(g.actions) ? g.actions.filter(v => isRecord(v)).slice(-200) : [];
  g.phoneLog = Array.isArray(g.phoneLog) ? g.phoneLog.filter(v => isRecord(v)).slice(-100) : [];
  g.customResidents = Array.isArray(g.customResidents) ? g.customResidents.filter(v => isRecord(v) && typeof v.name === 'string' && /^F0[1-3]-0[1-4]$/.test(v.room || '') && /^\d{4}$/.test(v.phone || '') && /^\d{12}$/.test(v.id || '')).slice(0, 12) : [];
  g.paused = Boolean(g.paused);
  g.pausedAt = g.paused ? (finiteNumber(g.pausedAt, Date.now()) || Date.now()) : 0;
  g.startedAt = Math.min(Date.now(), Math.max(0, finiteNumber(g.startedAt)));
  g.timeLimit = Math.max(0, finiteNumber(g.timeLimit));
  g.finished = Boolean(g.finished);
  g.seed = finiteNumber(g.seed, Date.now()) >>> 0;
  const campaignDefaults = {admittedNames:[],reportedNames:[],visitorCount:0,doppelVisitors:0,admittedVisitors:0,admittedDoppels:0,capturedDoppels:0,rejectedResidents:0,humanKilled:0,seenNames:[]};
  const campaignSource = isRecord(g.campaignStats) ? g.campaignStats : {};
  g.campaignStats = { ...campaignDefaults, ...campaignSource };
  for (const key of ['admittedNames','reportedNames','seenNames']) g.campaignStats[key] = Array.isArray(g.campaignStats[key]) ? [...new Set(g.campaignStats[key].filter(value => typeof value === 'string'))] : [];
  for (const key of ['visitorCount','doppelVisitors','admittedVisitors','admittedDoppels','capturedDoppels','rejectedResidents','humanKilled']) g.campaignStats[key] = Math.max(0, Math.floor(finiteNumber(g.campaignStats[key])));
  g.score = Math.max(-1_000_000, Math.min(1_000_000, finiteNumber(g.score)));
  for (const key of ['captures','kills','admitted','minorMistakes','errors','reportErrors','chesterCorrect']) g[key] = Math.max(0, finiteNumber(g[key]));
  let current=null, phone='----', emergency=false, residentPage=0, soundContext=null, quizAsked=false, clockInterval=null, pausedAt=g.paused ? (Number(g.pausedAt)||Date.now()) : null, decisionBusy=false;
  const rand=()=>{g.seed=(Math.imul(g.seed,1664525)+1013904223)>>>0;return g.seed/4294967296;};
  const pick=arr=>arr[Math.floor(rand()*arr.length)];
  const esc=s=>NW_FACE.esc(s);
  const isCampaign=()=>g.mode==='campaign';
  const isNight=()=>g.mode==='nightmare';
  const isTutorial=()=>g.mode==='tutorial';
  const visitorsTarget=()=>g.mode==='campaign'?[6,8,10,11,12][Math.max(0,Math.min(4,(g.day||1)-1))]:(g.mode==='tutorial'?4:10);
  const doppelRate=()=>g.mode==='campaign'?[.25,.35,.45,.5,.55][Math.max(0,Math.min(4,(g.day||1)-1))]:(isNight()?.6:(g.mode==='tutorial'?.25:.5));
  const people=()=>{const roster=isNight()?NW_DATA.nightmare:NW_DATA.normal;const custom=g.mode==='custom'&&Array.isArray(g.customResidents)?g.customResidents:[];return g.mode==='custom'&&g.customReady&&custom.length?custom:(custom.length?[...roster.filter(p=>!custom.some(c=>c.name===p.name)),...custom]:roster);};
  function sound(kind='click'){try{soundContext=soundContext||new (window.AudioContext||window.webkitAudioContext)();if(soundContext.state==='suspended')soundContext.resume();const osc=soundContext.createOscillator(),gain=soundContext.createGain();osc.connect(gain);gain.connect(soundContext.destination);const now=soundContext.currentTime;const freqs={click:450,ring:290,alert:180,success:620,wrong:110,dial:330,door:240};osc.type=kind==='alert'?'sawtooth':'triangle';osc.frequency.setValueAtTime(freqs[kind]||400,now);osc.frequency.exponentialRampToValueAtTime((freqs[kind]||400)*.72,now+.12);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.055,now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+.2);osc.start(now);osc.stop(now+.21);}catch{}}
  function store(){Neighbor.writeActive(g);}
  function notify(msg,type='click'){Neighbor.toast(msg);sound(type);}
  function showModal(html){$('modal-content').innerHTML=html;$('modal-backdrop').hidden=false;$('modal-window').scrollTop=0;}
  function closeModal(){$('modal-backdrop').hidden=true;$('modal-content').innerHTML='';}
  $('modal-close').addEventListener('click',closeModal);$('modal-backdrop').addEventListener('click',e=>{if(e.target===$('modal-backdrop'))closeModal();});
  function buildFaceTags(person,defect){let tags=[...(person.tags||[])];if(defect==='appearance'){const swaps=[['moleLeft','moleRight'],['hat'],['mustache'],['glasses'],['bigBrow'],['longNeck'],['freckles'],['pointNose'],['curlLeft','curlRight']];const choose=pick(swaps);for(const t of choose){if(tags.includes(t))tags=tags.filter(x=>x!==t);else tags.push(t);} }return tags;}
  function buildVisitors(){
    g.startedAt=0;g.timeLimit=visitorsTarget()*60000;g.timeBonusAwarded=false;g.paused=false;g.pausedAt=0;pausedAt=null;
    const pool=people().filter(p=>!g.dead.includes(p.name));
    const phoneNames=new Set(['Albertsky Peachman','Alf Cappuccin','Dr. W. Afton','Elenois Sverchzt','Francis Mosses','Izaack Gauss','Lois Stilnsky','Margarette Bubbles','Mia Stone','Rafttellyn Cappuccin','Robertsky Peachman','Roman Stilnsky','Selenne Sverchzt','Steven Rudboys']);
    if(isCampaign()){g.campaignStats=g.campaignStats||{};for(const [key,value] of Object.entries({admittedNames:[],reportedNames:[],visitorCount:0,doppelVisitors:0,admittedVisitors:0,admittedDoppels:0,capturedDoppels:0,rejectedResidents:0,humanKilled:0,seenNames:[]})){if(g.campaignStats[key]===undefined)g.campaignStats[key]=value;}for(const key of ['admittedNames','reportedNames','seenNames'])if(!Array.isArray(g.campaignStats[key]))g.campaignStats[key]=[];}
    const seenCampaign=new Set(g.campaignStats?.seenNames||[]);
    const count=Math.min(visitorsTarget(),pool.length);g.timeLimit=Math.max(1,count)*60000;const list=[];const used=[];
    for(let i=0;i<count;i++){
      const unused=pool.filter(person=>!used.includes(person.name));
      const unseen=isCampaign()?unused.filter(person=>!seenCampaign.has(person.name)):unused;
      const requiredPhoneCandidate=isCampaign()&&i===0?unused.filter(person=>phoneNames.has(person.name)).sort((a,b)=>Number(seenCampaign.has(a.name))-Number(seenCampaign.has(b.name))):[];
      const p=pick(requiredPhoneCandidate.length?requiredPhoneCandidate:(unseen.length?unseen:(unused.length?unused:pool)));if(!p)break;used.push(p.name);if(isCampaign())seenCampaign.add(p.name);
      let truth=isTutorial()?i!==2:rand()>=doppelRate();
      let vip=null;
      if(g.mode==='campaign'&&i===count-1&&g.day===1&&rand()<.4){vip='42';truth=false;}
      if(g.mode==='campaign'&&i===count-2&&g.day===2&&rand()<.2){vip='Peach';truth=false;}
      if(isNight()&&i===count-1&&rand()<.35){vip=pick(['42','Peach','Nurse']);truth=true;}
      const issueTypes=['appearance','id','form','combined'];let defects=[];
      if(!truth){defects=[pick(issueTypes)];if(defects[0]==='combined'&&rand()<.5)defects.push('appearance');}
      if(isTutorial()&&i===2)defects=['appearance'];
      const harmlessMissingHat=truth&&Array.isArray(p.tags)&&p.tags.includes('hat')&&rand()<.1;
      if(harmlessMissingHat)defects=['missing-hat'];
      const listed=rand()<.73;
      const doc=p;
      let visitor={person:p,residentName:p.name,truth,defects,listed,faceTags:buildFaceTags(p,defects.includes('appearance')?'appearance':null),vip,redHanded:!truth&&['Albertsky Peachman','Alf Cappuccin','Dr. W. Afton','Elenois Sverchzt','Francis Mosses','Izaack Gauss','Lois Stilnsky','Margarette Bubbles','Mia Stone','Rafttellyn Cappuccin','Robertsky Peachman','Roman Stilnsky','Selenne Sverchzt','Steven Rudboys'].includes(p.name),appearanceIssue:defects.includes('appearance')||harmlessMissingHat,idIssue:defects.includes('id')||defects.includes('combined'),formIssue:defects.includes('form')||defects.includes('combined'),idData:{...doc},formData:{...doc},idMissing:false,formMissing:false,dialog:'こんにちは。戻ってきました。'};
      if(harmlessMissingHat)visitor.faceTags=visitor.faceTags.filter(tag=>tag!=='hat');
      if(defects.includes('id')||defects.includes('combined')){const mode=Math.floor(rand()*4);if(mode===0)visitor.idData.id=visitor.idData.id.slice(0,11)+'8';if(mode===1)visitor.idData.name=visitor.idData.name.replace('a','e');if(mode===2)visitor.idData.expiry='01/54';if(mode===3)visitor.idData.stamp=false;}
      if(defects.includes('form')||defects.includes('combined')){const mode=Math.floor(rand()*4);if(mode===0)visitor.formData.room='F04-09';if(mode===1)visitor.formData.job='星の管理人';if(mode===2)visitor.formData.reason='I return because yesterday future.';if(mode===3)visitor.formData.approved=false;}
      if(truth&&rand()<.035){visitor.idMissing=true;visitor.idIssue=true;}if(truth&&rand()<.025){visitor.formMissing=true;visitor.formIssue=true;}
      if(vip==='42'){visitor.person={...p,name:'42',id:'424242424242',job:'42',features:'顔に巨大な42の渦',tags:['42Face'],room:'F03-02',phone:'4122',roommate:'Francis Mossesの同居人'};visitor.residentName='42';visitor.truth=false;visitor.listed=false;visitor.faceTags=['42Face'];visitor.idData={...visitor.person,id:'424242424242',stamp:true};visitor.formData={...visitor.person,job:'42',reason:'42'};visitor.appearanceIssue=true;visitor.idIssue=true;visitor.formIssue=true;}
      if(vip==='Peach'){visitor.person={...p,name:'Peach',job:'—',features:'大きく開いた口、出っ歯、斜めの充血した目',tags:['bigSmile','bigTeeth','redEyes']};visitor.faceTags=visitor.person.tags;visitor.appearanceIssue=true;visitor.idIssue=true;visitor.formIssue=true;visitor.idData={...p,name:'Peach'};visitor.formData={...p,name:'Peach'};}
      if(vip==='Nurse'){visitor.person={...p,name:'Xuchilbara Lobsel Vith',job:'特別来訪者',features:'包帯を巻いた静かな人物',tags:['longHair','tiredEyes']};visitor.faceTags=visitor.person.tags;visitor.idData={...p,name:visitor.person.name};visitor.formData={...p,name:visitor.person.name};}
      list.push(visitor);
    }
    if(isCampaign()){
      g.campaignStats.seenNames=[...seenCampaign];
      g.campaignStats.visitorCount=(g.campaignStats.visitorCount||0)+list.length;
      g.campaignStats.doppelVisitors=(g.campaignStats.doppelVisitors||0)+list.filter(v=>!v.truth).length;
    }
    // Each campaign day includes visual, document, and phone-verifiable evidence; one visitor may carry multiple layers on low-population days.
    if(isCampaign()&&list.length){
      let visualTarget=list.find(v=>!v.truth&&!v.vip);
      if(!visualTarget)visualTarget=list.find(v=>!v.vip);
      if(visualTarget&&visualTarget.truth){visualTarget.truth=false;g.campaignStats.doppelVisitors=(g.campaignStats.doppelVisitors||0)+1;}
      if(visualTarget){visualTarget.defects=[...new Set([...(visualTarget.defects||[]),'appearance'])];visualTarget.appearanceIssue=true;visualTarget.faceTags=[...(visualTarget.faceTags||[]),'extraEyes'];visualTarget.posterIndex=Math.floor(rand()*NW_DATA.posterNames.length);visualTarget.poster=true;}
      const impostors=list.filter(v=>!v.truth&&!v.vip);
      const documentTarget=impostors[1]||impostors[0];
      if(documentTarget){documentTarget.defects=[...new Set([...(documentTarget.defects||[]),'id'])];documentTarget.idIssue=true;documentTarget.idData.expiry='01/54';}
      let phoneTarget=impostors.find(v=>phoneNames.has(v.person.name))||list.find(v=>!v.vip&&phoneNames.has(v.person.name));
      if(phoneTarget){if(phoneTarget.truth){phoneTarget.truth=false;g.campaignStats.doppelVisitors=(g.campaignStats.doppelVisitors||0)+1;}phoneTarget.redHanded=true;phoneTarget.appearanceIssue=true;phoneTarget.defects=[...new Set([...(phoneTarget.defects||[]),'appearance'])];phoneTarget.faceTags=[...new Set([...(phoneTarget.faceTags||[]),'extraEyes'])];}
    }
    g.visitors=list;g.visitorIndex=0;g.checklist={};g.actions=[];g.currentEvent=null;store();
    const candidateNames=list.filter(v=>!v.vip).map(v=>v.residentName);
    const scheduleCount=candidateNames.length?Math.min(candidateNames.length,Math.max(4,Math.min(9,Math.floor(4+rand()*6)))):0;
    for(let i=candidateNames.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[candidateNames[i],candidateNames[j]]=[candidateNames[j],candidateNames[i]];}
    const chosen=candidateNames.slice(0,Math.min(scheduleCount,candidateNames.length));
    g.todayList=chosen.map(name=>{const p=pool.find(x=>x.name===name);return p?{name:p.name,room:p.room}:null;}).filter(Boolean);
    list.forEach(v=>{v.listed=!v.vip&&chosen.includes(v.residentName);});
    store();
  }
  function updateClock(){$('time-label').textContent='時間制限なし';$('time-label').classList.remove('time-low');}
  function startClock(){if(g.paused||g.finished)return;if(!g.startedAt){g.startedAt=Date.now();store();}if(clockInterval)clearInterval(clockInterval);clockInterval=null;updateClock();}
  function pauseGame(){if(pausedAt!==null||g.finished||!g.startedAt||!$('modal-backdrop').hidden)return;pausedAt=Date.now();g.paused=true;g.pausedAt=pausedAt;if(clockInterval)clearInterval(clockInterval);clockInterval=null;$('pause-overlay').hidden=false;store();}
  function resumeGame(){if(pausedAt===null&&!g.paused){$('pause-overlay').hidden=true;return;}const duration=pausedAt===null?0:Math.max(0,Date.now()-pausedAt);if(g.startedAt)g.startedAt+=duration;pausedAt=null;g.paused=false;g.pausedAt=0;$('pause-overlay').hidden=true;startClock();store();}
  function setUpHeader(){ $('mode-label').textContent=labels[g.mode]||'勤務';$('day-label').textContent=`1955年 2月 ${g.day||1}日`;$('visitor-counter').textContent=`来訪者 ${Math.min(g.visitorIndex+1,g.visitors.length)} / ${g.visitors.length}`;document.querySelectorAll('.calendar-grid i').forEach(n=>n.classList.toggle('active',n.textContent.trim()===String(g.day||1))); }
  function initChecklist(){const box=$('checklist-items');box.innerHTML='';[['appearance','外見'],['id','IDカード'],['form','入居申請書'],['list','今日のリスト']].forEach(([key,label])=>{let row=document.createElement('div');row.className='check-row';row.innerHTML=`<span>${label}</span><button data-key="${key}" data-val="yes">YES</button><button data-key="${key}" data-val="no">NO</button>`;row.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>setCheck(key,b.dataset.val)));box.appendChild(row);});updateChecklistUI();}
  function setCheck(key,val){if(!current||emergency||!['appearance','id','form','list'].includes(key)||!['yes','no'].includes(val))return;g.checklist[key]=val;store();updateChecklistUI();sound('click');}
  function updateChecklistUI(){const keys=['appearance','id','form','list'];let done=keys.filter(k=>g.checklist[k]);$('check-count').textContent=`${done.length} / 4 完了`; $('check-progress-bar').style.width=(done.length/4*100)+'%';document.querySelectorAll('.check-row button').forEach(b=>{const selected=g.checklist[b.dataset.key]===b.dataset.val;b.classList.toggle('selected',selected);b.classList.toggle(b.dataset.val,selected);});const enabled=done.length===4&&!!current;$('decision-panel').classList.toggle('ready',done.length===4);$('admit-button').disabled=!enabled||emergency;$('reject-button').disabled=!enabled||emergency;$('report-button').disabled=!enabled||!emergency||phone!=='3312';}
  function renderToday(){const box=$('today-list');box.innerHTML='';(g.todayList||[]).forEach(item=>{const div=document.createElement('div');div.className='today-item';div.innerHTML='<b>'+esc(item.name)+'</b><small>'+esc(item.room)+'</small>';box.appendChild(div);});if(!box.children.length)box.innerHTML='<span class="today-item">予定は登録されていません</span>';box.setAttribute('role','button');box.setAttribute('tabindex','0');box.setAttribute('aria-label','今日の予定表を拡大表示');}
  function showTodayList(){const rows=(g.todayList||[]).map(item=>'<div class="today-expanded-row"><b>'+esc(item.name)+'</b><span>'+esc(item.room)+'</span></div>').join('');const d=current?.idData||{};const f=current?.formData||{};const docs=current?'<section class="directory-documents"><h3>来訪者の書類との照合</h3><div class="directory-doc-grid"><article><b>ID CARD</b><p>'+esc(d.name)+' / '+esc(d.id)+'</p></article><article><b>APPLICATION</b><p>'+esc(f.name)+' / '+esc(f.room)+' / '+esc(f.job)+'</p></article></div></section>':'';showModal('<h2 class="modal-title">本日の予定表 / TODAY\'S LIST</h2><p class="modal-note">予定に載っているかどうかは確認項目のひとつです。載っていないだけで偽物とは限りません。</p><div class="today-expanded-list">'+(rows||'<p>予定は登録されていません。</p>')+'</div>'+docs+'<div class="modal-actions"><button class="button" id="today-list-close">閉じる</button></div>');$('today-list-close').onclick=closeModal;}
  function renderVisitor(){current=g.visitors[g.visitorIndex]||null;setUpHeader();initChecklist();if(!current){resetView();finishShift();return;}
    ['id-document','form-document'].forEach(id=>{const node=$(id);node.dataset.dragX='0';node.dataset.dragY='0';node.style.transform='';});
    $('visitor-empty').hidden=true;$('visitor-display').hidden=false;$('visitor-name').textContent=current.person.name;$('visitor-role').textContent=current.person.job;$('visitor-face').innerHTML=NW_FACE.portrait({...current.person,tags:current.faceTags||current.person.tags},{night:isNight()});$('visitor-line').textContent=current.dialog;$('visitor-kind').textContent=current.vip?'SPECIAL VISITOR':(current.truth?'RESIDENT':'VISITOR');$('window-room-label').textContent=current.vip?'ROOM ??':(current.person.room?'ROOM '+current.person.room:'ROOM ??');$('window-status').textContent='審査中';$('id-document').disabled=false;$('form-document').disabled=false;$('id-doc-name').textContent=current.idMissing?'未提出':current.idData.name;$('form-doc-name').textContent=current.formMissing?'未提出':current.formData.name;$('ask-button').disabled=false;$('next-line').disabled=false;updateChecklistUI();
    if(isTutorial())$('visitor-line').textContent='研修中です。顔、書類、名簿、電話の順に確認してください。';
    if(current.vip==='42')$('visitor-line').textContent='42';else if(current.vip==='Peach')$('visitor-line').textContent='……';
    sound('ring');
  }
  function resetView(){current=null;$('visitor-empty').hidden=false;$('visitor-display').hidden=true;$('window-room-label').textContent='ROOM ??';$('visitor-line').textContent='次の来訪者をお待ちください。';$('visitor-kind').textContent='NO VISITOR';$('window-status').textContent='待機中';$('id-document').disabled=true;$('form-document').disabled=true;$('ask-button').disabled=true;$('next-line').disabled=true;['admit-button','reject-button','report-button'].forEach(id=>$(id).disabled=true);$('decision-panel').classList.remove('ready');$('check-count').textContent='0 / 4 完了';$('check-progress-bar').style.width='0%';$('checklist-items').querySelectorAll('button').forEach(b=>b.classList.remove('selected','yes','no'));}
  function showDocument(which){if(!current)return;const d=which==='id'?current.idData:current.formData;const missing=which==='id'?current.idMissing:current.formMissing;const title=which==='id'?'IDカード / IDENTIFICATION':'入居申請書 / RESIDENCE APPLICATION';const stamp=which==='id'?(d.stamp===false?'印章なし':'D.D.D. APPROVED'):(d.approved===false?'承認印なし':'APPROVED / D.D.D.');let fields=which==='id'?[['氏名',d.name],['ID番号',d.id],['有効期限',d.expiry||'08/57'],['写真',d.name+' の白黒写真'],['ロゴ・スタンプ',stamp]]:[['氏名',d.name],['部屋番号',d.room],['職業',d.job],['帰宅理由',d.reason||'仕事から帰宅しました。'],['写真',d.name+' の白黒写真'],['承認',stamp]];
    showModal(`<h2 class="modal-title">${title}</h2>${missing?'<p class="modal-note">この書類は提出されていません。</p>':''}<div class="document-preview"><div class="classified">DOPPELGÄNGER DETECTION DEPARTMENT</div><div class="doc-face">${NW_FACE.portrait({...current.person,tags:current.faceTags||current.person.tags},{})}</div><div class="doc-grid">${fields.map(([k,v])=>`<div class="doc-field"><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div></div><p class="modal-note">名簿フォルダーの正しい情報と照合してください。書類の体裁だけで真偽を判断しないこと。</p><div class="modal-actions"><button class="button" id="doc-close">閉じる</button></div>`);$('doc-close').onclick=closeModal;}
  function openFolder(){const pool=people().slice().sort((a,b)=>String(a.room||'').localeCompare(String(b.room||''))||String(a.name||'').localeCompare(String(b.name||'')));if(!pool.length)return;residentPage=((residentPage%pool.length)+pool.length)%pool.length;renderFolder();}
  function renderFolder(){
    const pool=people().slice().sort((a,b)=>String(a.room||'').localeCompare(String(b.room||''))||String(a.name||'').localeCompare(String(b.name||'')));
    const p=pool[residentPage];
    const indexHtml=pool.map((person,index)=>'<button type="button" class="resident-index-item" data-page="'+index+'"><b>'+String(index+1).padStart(2,'0')+'</b><span>'+esc(person.name)+'</span><small>'+esc(person.room)+'</small></button>').join('');
    const indexHtmlSafe=indexHtml||'<p class="modal-note">登録住人はいません。</p>';
    const visitorId=current?.idData||{};const visitorForm=current?.formData||{};
    const comparison=current?'<section class="directory-documents"><h3>来訪者の書類 — 現在の窓口と比較</h3><div class="directory-doc-grid"><article><b>ID CARD</b><p><small>氏名</small>'+esc(current.idMissing?'未提出':visitorId.name)+'</p><p><small>ID番号</small>'+esc(visitorId.id)+'</p><p><small>有効期限</small>'+esc(visitorId.expiry||'記載なし')+'</p><p><small>印章</small>'+esc(visitorId.stamp===false?'不一致':'確認')+'</p></article><article><b>RESIDENCE APPLICATION</b><p><small>氏名</small>'+esc(current.formMissing?'未提出':visitorForm.name)+'</p><p><small>部屋番号</small>'+esc(visitorForm.room)+'</p><p><small>職業</small>'+esc(visitorForm.job)+'</p><p><small>帰宅理由</small>'+esc(visitorForm.reason||'記載なし')+'</p></article></div></section>':'<section class="directory-documents"><h3>来訪者の書類</h3><p class="modal-note">来訪者が窓口に到着すると、ここに書類が並びます。</p></section>';
    showModal('<h2 class="modal-title">住人名簿 / RESIDENT DIRECTORY</h2><div class="directory-layout"><aside class="directory-index"><label for="resident-search">住人を検索</label><input id="resident-search" type="search" autocomplete="off" placeholder="名前・部屋番号を入力"><div class="directory-index-list" id="resident-index">'+indexHtmlSafe+'</div></aside><div class="directory-main"><div class="resident-profile"><div class="resident-photo">'+NW_FACE.portrait(p,{night:isNight()})+'</div><div class="resident-info"><h3>'+esc(p.name)+'</h3><p><small>ID NUMBER</small>'+esc(p.id)+'</p><p><small>ROOM / TEL</small>'+esc(p.room)+' / '+esc(p.phone)+'</p><p><small>OCCUPATION</small>'+esc(p.job)+'</p><p><small>HOUSEHOLD</small>'+esc(p.roommate)+'</p><p><small>APPEARANCE</small>'+esc(p.features)+'</p></div></div>'+comparison+'<div class="resident-nav"><button id="resident-prev">◂ 前の住人</button><span class="mono">'+(residentPage+1)+' / '+pool.length+'</span><button id="resident-next">次の住人 ▸</button></div></div></div><p class="modal-note">この名簿は唯一の100%正しい情報源です。部屋順に並んでいます。外見は服装ではなく顔の特徴で照合します。</p>');
    $('resident-prev').onclick=()=>{residentPage=(residentPage-1+pool.length)%pool.length;renderFolder();};
    $('resident-next').onclick=()=>{residentPage=(residentPage+1)%pool.length;renderFolder();};
    $('resident-index').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{residentPage=Number(button.dataset.page)||0;renderFolder();}));
    $('resident-search').addEventListener('input',()=>{const query=$('resident-search').value.trim().toLocaleLowerCase();$('resident-index').querySelectorAll('button').forEach(button=>{button.hidden=!!query&&!button.textContent.toLocaleLowerCase().includes(query);});});
  }
  function askQuestions(){if(!current)return;showModal(`<h2 class="modal-title">来訪者に質問する</h2><p class="modal-note">不自然な点を選び、説明を求めてください。</p><div class="question-list"><button data-q="face">顔や外見について質問する</button><button data-q="papers">書類について質問する</button><button data-q="list">今日の予定について質問する</button><button data-q="reason">帰宅理由について質問する</button></div>`);document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>questionAnswer(b.dataset.q));}
  function questionAnswer(type){let answer='特に問題はありません。いつも通りです。';if(current.truth){answer=type==='list'&&!current.listed?'急に予定が変わったんです。電話で確認しても構いません。':'何か問題がありますか？私はここの住人です。';}else if(current.redHanded){answer=type==='face'&&current.appearanceIssue?'ああ、顔のことですか。新しい治療を受けたんです。':'そんな質問をする必要がありますか？早く中へ入れてください。';if(type==='face'){answer+=' ……何を見ているんです？';}}
    if(current.vip==='42')answer='42';if(current.vip==='Peach')answer='……';$('visitor-line').textContent=answer;closeModal();notify('返答を記録しました。');if(!current.truth&&current.redHanded&&type==='face'&&current.appearanceIssue){showModal(`<h2 class="modal-title">不自然な反応</h2><p class="modal-note">質問への反応が急変しました。来訪者の正体に疑いがあります。</p><div class="modal-actions"><button class="button" id="reveal-close">窓口へ戻る</button></div>`);$('reveal-close').onclick=closeModal;}
  }
  function ringPhone(){if(phone.length!==4){notify('4桁の番号を入力してください。','wrong');return;}if(phone==='3312'){if(!emergency){notify('先に緊急ボタンを押してください。','wrong');return;}if(!current){notify('通報対象の来訪者がいません。','wrong');return;}confirmReport();return;}if(phone==='6666'){if(g.mode==='campaign'||g.mode==='arcade'){notify('不明な番号です。回線が切れました。','wrong');return;}notify('回線の向こうで短い笑い声がします。','alert');return;}const resident=people().find(p=>p.phone===phone);if(!resident){notify('ツー……応答がありません。','wrong');return;}let related=current?.person?.room===resident.room;let response;if(current&&related){if(current.truth){response=resident.roommate==='一人暮らし'?'呼び出し音が3回。応答はなく、ツー音に変わりました。':'同居人です。本人はまだ帰宅していないと言っています。';}else{response=resident.roommate==='一人暮らし'?'電話口から本人の声がします。「今日は誰も帰ってきていないはずです」':'同居人が応答しました。「本人は家にいます。来客の予定はありません」';}}else response='部屋の電話が鳴っています。窓口の人物とは関係がないようです。';
    $('visitor-line').textContent='電話確認：'+response;g.phoneLog=g.phoneLog||[];g.phoneLog.push({number:phone,response});store();notify(response,'dial');
  }
  function setPhone(value){phone=value.slice(0,4);$('phone-number').textContent=phone.padEnd(4,'-');updateChecklistUI();sound('dial');}
  function pressEmergency(){if(!current)return;emergency=!emergency;$('alarm-lamp').classList.toggle('active',emergency);$('emergency-button').classList.toggle('pressed',emergency);$('window-section').classList.toggle('alert-shutter',emergency);$('window-status').textContent=emergency?'緊急回線待機':'審査中';['id-document','form-document','ask-button','next-line'].forEach(id=>$(id).disabled=emergency||!current);$('folder-button').disabled=false;$('alarm-label').textContent=emergency?'3312発信前：ボタンをもう一度押すと取り消せます':'緊急時のみ使用';document.querySelectorAll('.check-row button').forEach(b=>b.disabled=emergency);if(!emergency)setPhone('----');updateChecklistUI();if(emergency){notify('1. 緊急ボタン  →  2. 3312へ発信  →  3. D.D.D.が到着します。発信前なら取り消せます。','alert');}else notify('緊急回線を解除しました。シャッターが開きました。');}
  function expectedChecklist(){
    if(!current)return {appearance:false,id:false,form:false,list:false};
    return {
      appearance:!current.appearanceIssue,
      id:!current.idIssue&&!current.idMissing,
      form:!current.formIssue&&!current.formMissing,
      list:!!current.listed
    };
  }
  function evaluateChecklist(){
    const expected=expectedChecklist();
    const keys=['appearance','id','form','list'];
    let correct=0;
    for(const key of keys){
      const chosen=g.checklist?.[key];
      if((chosen==='yes')===expected[key] && (chosen==='yes'||chosen==='no'))correct++;
    }
    return {expected,correct,errors:keys.length-correct};
  }
  function logAction(action,detail){
    g.actions=Array.isArray(g.actions)?g.actions:[];
    g.actions.push({action,detail,person:current?.person?.name||'不明'});
    store();
  }
  function addPoster(){
    if(current?.posterIndex===undefined)return;
    const save=Neighbor.getSave();
    if(!Array.isArray(save.posters))save.posters=[];
    if(!save.posters.includes(current.posterIndex))save.posters.push(current.posterIndex);
    Neighbor.setSave(save);
  }
  function campaignStats(){
    if(!isCampaign())return null;
    g.campaignStats=g.campaignStats||{};
    const defaults={admittedNames:[],reportedNames:[],visitorCount:0,doppelVisitors:0,admittedVisitors:0,admittedDoppels:0,capturedDoppels:0,rejectedResidents:0,humanKilled:0,seenNames:[]};
    for(const [key,value] of Object.entries(defaults))if(g.campaignStats[key]===undefined)g.campaignStats[key]=value;
    for(const key of ['admittedNames','reportedNames','seenNames'])if(!Array.isArray(g.campaignStats[key]))g.campaignStats[key]=[];
    return g.campaignStats;
  }
  function decide(type){
    if(decisionBusy||!current||g.finished||!['admit','reject','report'].includes(type))return;
    decisionBusy=true;
    const keys=['appearance','id','form','list'];
    if(keys.some(key=>!['yes','no'].includes(g.checklist?.[key]))){decisionBusy=false;notify('チェックリストの4項目をすべて記録してください。','wrong');return;}
    if(type==='report'&&(!emergency||phone!=='3312')){decisionBusy=false;notify('緊急ボタンを押して3312へ発信してください。','wrong');return;}

    const check=evaluateChecklist();
    g.errors=(Number(g.errors)||0)+check.errors;
    g.minorMistakes=(Number(g.minorMistakes)||0)+check.errors;
    g.score=(Number(g.score)||0)+check.correct*25;
    const truth=Boolean(current.truth);
    const safeNightVip=isNight()&&['42','Peach','Nurse'].includes(current.vip);
    const safeAdmission=truth||safeNightVip;
    const stats=campaignStats();
    let detail='';
    let fatalNow=false;

    if(stats){
      if(type==='admit'){
        stats.admittedVisitors=(stats.admittedVisitors||0)+1;
        if(!safeAdmission)stats.admittedDoppels=(stats.admittedDoppels||0)+1;
      }
      if(type==='reject'&&truth)stats.rejectedResidents=(stats.rejectedResidents||0)+1;
      if(type==='report'&&truth)stats.humanKilled=(stats.humanKilled||0)+1;
      if(type==='report'&&!truth)stats.capturedDoppels=(stats.capturedDoppels||0)+1;
    }

    if(type==='admit'){
      if(safeAdmission){
        g.score+=25;
        detail=`${current.person.name} の入室を許可。`;
        if(stats)stats.admittedNames.push(current.person.name);
        notify('入室許可。ドアが開きました。','door');
      }else{
        g.admitted=(Number(g.admitted)||0)+1;
        if(stats)stats.admittedNames.push(current.person.name);
        g.errors=(Number(g.errors)||0)+1;
        if(!isTutorial()){
          g.score=0;
          g.fatalAdmission=true;
        }
        detail=`${current.person.name} を誤って入室させた。`;
        notify(isNight()?'侵入を確認。非常事態です。':'入室後に異常反応。重大なミスです。','alert');
        if(isNight())fatalNow=true;
      }
    }else if(type==='reject'){
      if(truth){
        g.minorMistakes=(Number(g.minorMistakes)||0)+1;
        g.score-=50;
        detail=`本物の ${current.person.name} を拒否。`;
        notify('本物の住人を拒否しました。','wrong');
      }else{
        g.score+=50;
        detail=`${current.person.name} の入室を拒否。`;
        notify('入室を拒否しました。','success');
      }
    }else if(type==='report'){
      if(truth){
        if(stats){
          if(!stats.reportedNames.includes(current.person.name))stats.reportedNames.push(current.person.name);
        }
        if(!isTutorial()){
          g.kills=(Number(g.kills)||0)+1;
          g.reportErrors=(Number(g.reportErrors)||0)+1;
          g.score-=200;
          g.minorMistakes=(Number(g.minorMistakes)||0)+2;
        }
        detail=`本物の ${current.person.name} を誤通報。`;
        if(isCampaign()&&!g.dead.includes(current.person.name))g.dead.push(current.person.name);
        notify('誤通報。住人が保護対象から外れました。','wrong');
        if(isNight()){
          if(g.reportErrors>=2){g.entityDeath=true;fatalNow=true;}
          else{g.entityAppeared=true;showEntityWarning();}
        }
      }else{
        g.captures=(Number(g.captures)||0)+1;
        g.score+=200;
        detail=`${current.person.name} をD.D.D.が捕獲。`;
        addPoster();
        notify('ドッペルゲンガーを捕獲しました。','success');
      }
    }

    logAction(type,detail);
    g.lastDetail=detail;
    emergency=false;
    $('alarm-lamp').classList.remove('active');
    $('emergency-button').classList.remove('pressed');
    $('window-section').classList.remove('alert-shutter');
    $('window-frame').classList.add('door-opening');
    setTimeout(()=>$('window-frame').classList.remove('door-opening'),420);
    setPhone('----');
    g.checklist={};
    g.visitorIndex=(Number(g.visitorIndex)||0)+1;
    current=null;
    resetView();
    store();
    if(fatalNow){finishShift(true);setTimeout(()=>{decisionBusy=false;},350);return;}
    if(g.visitorIndex>=g.visitors.length)finishShift();
    else renderVisitor();
    setTimeout(()=>{decisionBusy=false;},350);
  }
  function campaignEnding(){
    const stats=g.campaignStats||{};
    const reported=new Set(stats.reportedNames||[]);
    if((stats.visitorCount||0)>0&&(stats.admittedVisitors||0)===(stats.visitorCount||0))return {title:'6 Feet Under',text:'来訪者をすべて入室させた結果、異常は建物から街へと広がりました。勤務記録はここで途切れています。'};
    if(reported.size>=20)return {title:'Entitled to One Call',text:'全住人に通報が行われ、アパートは空になりました。D.D.D.はあなたの判断記録を調査し、職務は終了しました。'};
    if((g.dead||[]).length===1&&g.dead.includes('Dr. W. Afton')&&(stats.humanKilled||0)===1&&(stats.admittedDoppels||0)===0&&(stats.capturedDoppels||0)===(stats.doppelVisitors||0))return {title:'Conspirator',text:'あなたはアフトンだけを通報し、他の住人を守りました。記録は封印されます。'};
    if((stats.humanKilled||0)===0&&(stats.admittedDoppels||0)===0&&(stats.capturedDoppels||0)===(stats.doppelVisitors||0))return {title:'Employee of the Month',text:'住人をひとりも失わず、現れたドッペルゲンガーをすべて捕獲しました。ヘンリー以来の模範的な勤務です。'};
    return {title:'Just Like Henry',text:'いくつかの部屋は空になりました。それでも、あなたは5日間の勤務を終えました。'};
  }
  function finishShift(forcedDeath=false){
    if(g.finished)return;
    const elapsed=Date.now()-(g.startedAt||Date.now());
    const limit=g.timeLimit||visitorsTarget()*60000;
    if(g.mode==='arcade'&&!forcedDeath&&!g.fatalAdmission&&!g.entityDeath&&elapsed<limit&&!g.timeBonusAwarded){g.score+=Math.floor(Math.max(0,limit-elapsed)/60000)*10;g.timeBonusAwarded=true;}
    g.finished=true;
    if(clockInterval)clearInterval(clockInterval);
    clockInterval=null;
    const rank=rankFor();
    const dead=Boolean(forcedDeath||g.fatalAdmission||g.entityDeath);
    if(g.fatalAdmission)g.score=0;
    let message=dead?(isNight()?'審査室は異常な存在に支配されました。':'ドッペルゲンガーが侵入し、勤務は失敗に終わりました。'):'勤務は終了しました。記録を確認してください。';
    if(isTutorial())message='研修は終了しました。4項目の審査手順を確認できました。';
    const save=Neighbor.getSave();
    save.records=Array.isArray(save.records)?save.records:[];
    save.achievements=Array.isArray(save.achievements)?save.achievements:[];
    save.posters=Array.isArray(save.posters)?save.posters:[];
    save.stats=save.stats||{};
    save.stats.shifts=(save.stats.shifts||0)+1;
    save.stats.captures=(save.stats.captures||0)+g.captures;
    save.stats.kills=(save.stats.kills||0)+g.kills;
    save.stats.admitted=(save.stats.admitted||0)+g.admitted;
    save.stats.highScore=Math.max(save.stats.highScore||0,g.score);
    const rankValue={S:6,A:5,B:4,C:3,D:2,F:1};
    if(rankValue[rank]&&(rankValue[rank]>(rankValue[save.stats.highRank]||0)))save.stats.highRank=rank;
    const earn=id=>{if(!save.achievements.includes(id))save.achievements.push(id);};
    if(g.mode==='arcade'&&g.score>=1000)earn('overtime');
    earn('first-shift');
    if(rank==='S')earn('clean-day');
    if(save.posters.length>=10)earn('collector');
    if(save.posters.length>=32)earn('all-posters');
    if(g.phoneLog?.length)earn('double-check');
    if(g.reportErrors)earn('false-alarm');
    const rec={id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`,createdAt:new Date().toISOString(),date:`1955/02/${g.day}`,day:g.day,mode:g.mode,modeLabel:labels[g.mode],rank,score:g.score,captures:g.captures,kills:g.kills,admitted:g.admitted};
    save.records.push(rec);
    let ending=null,next=false,nextLabel='次の日へ進む';
    if(isCampaign()){
      save.campaign.dead=[...new Set([...(save.campaign.dead||[]),...(g.dead||[])])];
      if(!dead&&g.day<5){
        save.campaign.day=g.day;save.campaign.retryDay=0;save.campaign.runStats=g.campaignStats;next=true;
      }else if(!dead&&g.day===5){
        save.campaign.completed=true;save.campaign.unlockedNightmare=true;save.campaign.day=1;save.campaign.retryDay=0;save.campaign.dead=[];ending=campaignEnding();earn('five-days');earn('night-shift');save.campaign.runStats=null;
      }else{
        save.campaign.day=g.day;save.campaign.retryDay=g.day;save.campaign.completed=false;save.campaign.runStats=g.campaignStats;
      }
    }
    if(isTutorial())next=false;
    if(isTutorial())earn('first-shift');
    Neighbor.setSave(save);
    const details=(g.actions||[]).map(action=>action.detail);if(g.phoneLog?.length)details.push(...g.phoneLog.map(entry=>`電話 ${entry.number}：${entry.response}`));details.push(`ランク内訳：住人の誤殺 ${g.kills||0}人 / ドッペルゲンガー誤入室 ${g.fatalAdmission?1:0}件 / 軽微なミス ${g.minorMistakes||0}件`);
    const result={id:rec.id,title:isTutorial()?'研修修了':(dead?'勤務失敗':'勤務結果'),rank,captures:g.captures,kills:g.kills,admitted:g.admitted,misadmitted:g.fatalAdmission?1:0,minorMistakes:g.minorMistakes||0,score:g.score,message,details,next,nextLabel,ending,tutorial:isTutorial(),mode:g.mode,day:g.day,retryDay:isCampaign()&&dead?g.day:0};
    try{localStorage.setItem(Neighbor.RESULT,JSON.stringify(result));}catch(error){console.error('Could not store shift result:',error);}
    if(dead||!next)Neighbor.writeActive(null);else Neighbor.writeActive(g);
    Neighbor.syncSave({keepalive:true}).catch(()=>{});
    if(dead&&!isTutorial()){$('fatal-fade').hidden=false;$('fatal-fade').classList.add('active');setTimeout(()=>{location.href='/result';},850);}else location.href='/result';
  }

  function showEntityWarning(){showModal(`<h2 class="modal-title">異常な応答</h2><p class="modal-note">電話回線から紫色の影が窓の向こうに現れ、しばらくあなたを見つめています。回線は不安定です。これ以上の誤通報は避けてください。</p><div class="modal-actions"><button class="button" id="entity-close">確認</button></div>`);$('entity-close').onclick=closeModal;}
  function confirmReport(){if(!current){notify('通報する来訪者がいません。');return;}if(!emergency||phone!=='3312'){notify('緊急ボタンを押して3312へ発信してください。','wrong');return;}if(['appearance','id','form','list'].some(key=>!['yes','no'].includes(g.checklist?.[key]))){notify('チェックリストを完了してください。','wrong');return;}showModal('<h2 class="modal-title">D.D.D.への通報確認</h2><p class="modal-note">本当にD.D.D.を呼びますか？間違えると本物の住人を殺してしまいます。3312への通報後は取り消せません。</p><div class="modal-actions"><button class="button button-dark" id="cancel-ddd-report">戻る</button><button class="button" id="confirm-ddd-report">D.D.D.を呼ぶ</button></div>');$('cancel-ddd-report').onclick=closeModal;$('confirm-ddd-report').onclick=()=>{closeModal();reportVisitor();};}
  function reportVisitor(){if(!current){notify('通報する来訪者がいません。');return;}if(!emergency||phone!=='3312'){notify('緊急ボタンを押し、3312へ発信してください。','wrong');return;}if(['appearance','id','form','list'].some(key=>!['yes','no'].includes(g.checklist?.[key]))){notify('チェックリストを完了してください。','wrong');return;}decide('report');}
  function showChester(){
    if(quizAsked||g.mode!=='campaign'||g.chesterDone)return false;
    quizAsked=true;const index=Math.max(0,(g.day||1)-1),answer=NW_DATA.quiz[index];
    const question=index===0?'1979年にちなんだ数字は？':index===1?'3.5日間を秒にすると？':index===2?'次の数値を答えてくれ。':index===3?'2の29乗はいくつ？':'最後の数字を答えてくれ。';
    showModal('<h2 class="modal-title">チェスター・タイトーの訪問</h2><p class="modal-note">「やあ、門番さん。ちょっとした質問だ。答えが分かるかな？」</p><p class="modal-note"><b>第'+(index+1)+'問：'+question+'</b></p><input id="chester-answer" class="quiz-input" inputmode="numeric" placeholder="答えを入力"><div class="modal-actions"><button id="chester-skip" class="button button-dark">あとで</button><button id="chester-submit" class="button">回答する</button></div>');
    $('chester-skip').onclick=()=>{g.chesterDone=true;store();closeModal();startClock();};
    $('chester-submit').onclick=()=>{
      const correct=Number($('chester-answer').value)===answer;
      if(correct){g.chesterCorrect=(g.chesterCorrect||0)+1;const save=Neighbor.getSave();save.campaign.chesterCorrect=Math.max(Number(save.campaign.chesterCorrect)||0,g.chesterCorrect);if(g.chesterCorrect>=5){save.chesterBadge=true;if(!save.achievements.includes('chester'))save.achievements.push('chester');$('chester-badge').hidden=false;}Neighbor.setSave(save);}
      g.chesterDone=true;store();closeModal();
      showModal('<h2 class="modal-title">'+(correct?'正解です':'違うようです')+'</h2><p class="modal-note">'+(correct?'チェスターが満足そうにうなずきました。':'正解は '+answer+' でした。誤答によるペナルティはありません。')+'</p><p class="modal-note">5問すべて正解すると金のチェスターバッジを獲得できます。</p><div class="modal-actions"><button class="button" id="chester-feedback-close">勤務へ戻る</button></div>');
      $('chester-feedback-close').onclick=()=>{closeModal();startClock();};
    };
    return true;
  }
  function showClown(){if(g.mode!=='campaign'||g.clownSeen||g.clownCheckedDay===g.day)return;g.clownCheckedDay=g.day;const appears=g.day>=5||randChance(.45);store();if(!appears)return;g.clownSeen=true;$('clown-flyer').hidden=false;const save=Neighbor.getSave();save.campaign.clownSeen=true;Neighbor.setSave(save);store();notify('ピエロの男が「UNLIKELY」と書かれたチラシを机に置きました。');}
  function randChance(n){return rand()<n;}
  function startCards(){
    const values=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    let player=[],cpu=[],drawPile=[],pile=0,round=1,playerWins=0,cpuWins=0,turns=0;
    const wild=c=>['J','Q','K','A'].includes(c);
    const canPlay=c=>!pile||wild(c)||Number(c)>pile;
    const makeDeck=()=>{
      const cards=[];
      values.forEach(value=>{for(let i=0;i<4;i++)cards.push(value);});
      for(let i=cards.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}
      return cards;
    };
    const drawCard=()=>drawPile.pop()||null;
    const resetRound=()=>{drawPile=makeDeck();player=Array.from({length:7},drawCard).filter(Boolean);cpu=Array.from({length:7},drawCard).filter(Boolean);pile=0;turns=0;};
    function finishMatch(){
      closeModal();
      const result=playerWins>cpuWins?'あなたの勝利です。クラウンは静かにカードを片付けました。':playerWins<cpuWins?'クラウンの勝利です。対決はここで終了しました。':'3ラウンドは引き分けです。';
      showModal(`<h2 class="modal-title">カード対決 — 結果</h2><p class="modal-note">${result}</p><p class="card-score">あなた ${playerWins} — ${cpuWins} クラウン</p><div class="modal-actions"><button class="button" id="card-finish">閉じる</button></div>`);
      $('card-finish').onclick=closeModal;
    }
    function endRound(){
      if(player.length&&cpu.length)return false;
      if(!player.length)playerWins++;else cpuWins++;
      if(round>=3){finishMatch();return true;}
      round++;resetRound();render();return true;
    }
    function endExhaustedRound(){
      if(drawPile.length)return false;
      const playerCanMove=player.some(canPlay);
      const cpuCanMove=cpu.some(canPlay);
      if(playerCanMove&&cpuCanMove)return false;
      if(!playerCanMove&&!cpuCanMove){
        if(player.length<cpu.length)playerWins++;
        else if(cpu.length<player.length)cpuWins++;
        else {playerWins+=0.5;cpuWins+=0.5;}
      }else if(!playerCanMove)cpuWins++;
      else playerWins++;
      if(round>=3){finishMatch();return true;}
      round++;resetRound();render();return true;
    }
    function render(){
      const hasMove=player.some(canPlay);
      showModal(`<h2 class="modal-title">ナイトメア・クラウン — カード対決</h2><p class="modal-note">3ラウンド制。場の数字より大きいカード、またはJ/Q/K/Aを出します。出せるカードがないときは山札から1枚引きます。</p><div class="card-table"><div class="card-opponent">クラウンの手札：${cpu.length}枚</div><div class="card-score">ラウンド ${round} / 3　あなた ${playerWins} — ${cpuWins} クラウン</div><div class="card-pile">場のカード <b>${pile||'—'}</b></div><p>あなたの手札</p><div class="playing-hand">${player.map((c,i)=>`<button data-card="${i}" class="playing-card">${c}</button>`).join('')}</div><div class="modal-actions"><button id="card-draw" class="button button-dark" ${hasMove||!drawPile.length?'disabled':''}>山札から1枚引く（残り ${drawPile.length}）</button></div><p id="card-status" class="modal-note">カードを選んでください。</p></div>`);
      document.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>play(Number(b.dataset.card)));
      $('card-draw').onclick=draw;
    }
    function cpuTurn(){
      const idx=cpu.findIndex(canPlay);
      if(idx>=0){const card=cpu.splice(idx,1)[0];pile=wild(card)?0:Number(card)||0;return;}
      const card=drawCard();
      if(card)cpu.push(card);
    }
    function play(index){
      if(!Number.isInteger(index)||index<0||index>=player.length)return;
      const card=player[index];
      if(!canPlay(card)){$('card-status').textContent='場のカードより大きい数字か、J/Q/K/Aを出してください。';return;}
      player.splice(index,1);pile=wild(card)?0:Number(card)||0;turns++;
      if(endRound())return;
      cpuTurn();
      if(endRound()||endExhaustedRound())return;
      render();
    }
    function draw(){
      if(player.some(canPlay)){$('card-status').textContent='出せるカードがあるため、今は引けません。';return;}
      const card=drawCard();
      if(!card){endExhaustedRound();return;}
      player.push(card);cpuTurn();
      if(endRound()||endExhaustedRound())return;
      render();
    }
    resetRound();render();
  }
  function showHoodedLetter(){if(g.mode!=='nightmare'||g.hoodedLetterSeen)return false;g.hoodedLetterOpen=true;store();showModal(`<h2 class="modal-title">フードの人物からの手紙</h2><div class="document-preview"><div class="classified">PRIVATE / DO NOT COPY</div><p class="modal-note">門番へ。1945年の記録には、ドッペルゲンガーが最初から自然に現れたとは書かれていない。</p><p class="mono" style="font-size:13px;letter-spacing:.14em">20-18-15-25　16-18-15-10-5-3-20</p><p class="modal-note">別紙の見出し：PROJECT TROY<br>責任者：OSWALD D. KEPPLER<br>主任研究者：DR. W. AFTON</p><p class="modal-note">D.D.D.は、何を封じ込めているのだろうか。</p></div><div class="modal-actions"><button class="button" id="hooded-close">手紙をしまう</button></div>`);$('hooded-close').onclick=()=>{g.hoodedLetterOpen=false;g.hoodedLetterSeen=true;store();closeModal();startClock();};return true;}
  function tutorialPrompt(){if(!isTutorial()||g.tutorialPromptSeen)return false;showModal(`<h2 class="modal-title">Agent #1314 — 研修開始</h2><p class="modal-note">新人門番へ。右の名簿は正確だ。まず顔を照合し、IDと申請書を確認しろ。予定表は参考になるが、載っていないだけで偽物と決めつけるな。必要なら電話を使え。</p><div class="modal-actions"><button class="button" id="tut-begin">研修を開始</button></div>`);$('tut-begin').onclick=()=>{g.tutorialPromptSeen=true;store();closeModal();startClock();};return true;}
  function customSetup(){if(g.customReady)return;showModal(`<h2 class="modal-title">カスタム住人を作成</h2><p class="modal-note">この勤務に登場する追加住人を設定できます。</p><div class="doc-grid"><label class="doc-field"><small>名前</small><input id="custom-name" maxlength="32" placeholder="例：Alex Miller"></label><label class="doc-field"><small>職業</small><input id="custom-job" maxlength="32" placeholder="例：郵便配達員"></label><label class="doc-field"><small>部屋番号</small><input id="custom-room" value="F03-04" maxlength="7"></label><label class="doc-field"><small>電話番号</small><input id="custom-phone" value="4258" inputmode="numeric" maxlength="4"></label><label class="doc-field" style="grid-column:1/-1"><small>外見の特徴</small><input id="custom-features" value="丸顔、短髪" maxlength="80"></label></div><div class="modal-actions"><button class="button" id="custom-create">住人を登録して開始</button></div>`);$('custom-create').onclick=()=>{const name=$('custom-name').value.trim();const room=$('custom-room').value.trim();const phoneNumber=$('custom-phone').value.trim();if(name.length<2){notify('名前を2文字以上で入力してください。','wrong');return;}if(!/^F0[1-3]-0[1-4]$/.test(room)){notify('部屋番号はF01-01〜F03-04の形式で入力してください。','wrong');return;}if(!/^\d{4}$/.test(phoneNumber)){notify('電話番号は4桁で入力してください。','wrong');return;}if(people().some(person=>person.name.toLocaleLowerCase()===name.toLocaleLowerCase())){notify('同じ名前の住人は登録できません。','wrong');return;}if(people().some(person=>person.phone===phoneNumber)){notify('その電話番号はすでに使われています。別の番号を指定してください。','wrong');return;}let id=String(100000000000+Math.floor(rand()*800000000000));while(people().some(person=>person.id===id))id=String(100000000000+Math.floor(rand()*800000000000));const p={name,id,room,phone:phoneNumber,job:$('custom-job').value.trim()||'自営業',roommate:'一人暮らし',features:$('custom-features').value.trim()||'丸顔',tags:['roundFace','shortHair']};g.customResidents=[p];g.customReady=true;g.visitors=[];g.visitorIndex=0;closeModal();buildVisitors();renderToday();renderVisitor();store();startClock();notify(`${name} を登録しました。`);};}
  function showBriefing(){const headlines=['D.D.D.が各地の不審な帰宅報告を調査中','市内の電話回線に短い雑音が続く','住人は身分証を必ず提示すること','夜間の窓口で奇妙な人物が目撃された','D.D.D.は門番の判断を重視すると発表'];showModal(`<h2 class="modal-title">1955年2月 ${g.day}日 — 朝刊</h2><div class="document-preview"><div class="classified">THE DAILY NEIGHBOR / MORNING EDITION</div><h3 style="font:22px var(--display);margin:10px 0">${headlines[(g.day-1)%headlines.length]}</h3><p class="modal-note">本日も冷え込みが続く見込み。D.D.D.は、住人名簿と提出書類を丁寧に照合するよう通達しています。</p><p class="mono" style="font-size:8px">VOL. 55 / FEBRUARY ${g.day}, 1955</p></div><div class="modal-actions"><button class="button" id="briefing-start">勤務を開始</button></div>`);$('briefing-start').onclick=()=>{g.briefingSeenDay=g.day;store();closeModal();showClown();if(!showChester())startClock();};}
  function initGame(){
    if(g.mode==='cards'){startCards();return;}
    if(g.mode==='custom'&&!g.customReady){customSetup();return;}
    if(!g.visitors.length)buildVisitors();
    renderToday();
    $('visitor-counter').textContent=`来訪者 ${Math.min(g.visitorIndex+1,g.visitors.length)} / ${g.visitors.length}`;
    renderVisitor();
    if(g.finished)return;
    $('chester-badge').hidden=!Neighbor.getSave().chesterBadge;
    $('clown-flyer').hidden=!g.clownSeen;
    if(isNight())$('booth-scene').classList.add('nightmare-scene');
    if(g.paused){pausedAt=Number(g.pausedAt)||Date.now();$('pause-overlay').hidden=false;return;}
    $('pause-overlay').hidden=true;
    if(isTutorial()){
      if(!tutorialPrompt())startClock();
      $('mode-label').textContent='チュートリアル';
      $('visitor-line').textContent='Agent #1314：チェックリストを使って4項目を確認してください。';
      return;
    }
    if(isCampaign()){
      if(g.briefingSeenDay!==g.day)showBriefing();
      else {showClown();if(!showChester())startClock();}
      return;
    }
    if(isNight()&&(g.hoodedLetterOpen||(!g.hoodedLetterSeen&&rand()<.3))){
      if(!showHoodedLetter())startClock();
      return;
    }
    startClock();
  }
  function rankFor(){if(isNight())return g.fatalAdmission||g.entityDeath?'不合格':'合格';if(g.fatalAdmission&&g.kills>0)return 'F';if(g.fatalAdmission)return 'F';if(g.kills>=2)return 'D';if(g.kills===1||g.minorMistakes>=4)return 'C';if(g.minorMistakes>=2)return 'B';if(g.minorMistakes===1)return 'A';return 'S';}
  // UI events
  let dragState=null,dragMoved=false;function attachPaperDrag(el,which){el.dataset.dragX='0';el.dataset.dragY='0';el.addEventListener('pointerdown',e=>{if(el.disabled)return;dragMoved=false;dragState={el,x:e.clientX,y:e.clientY,baseX:Number(el.dataset.dragX||0),baseY:Number(el.dataset.dragY||0),dx:0,dy:0};el.setPointerCapture?.(e.pointerId);});el.addEventListener('pointermove',e=>{if(!dragState||dragState.el!==el)return;const dx=e.clientX-dragState.x,dy=e.clientY-dragState.y;if(Math.abs(dx)+Math.abs(dy)>8)dragMoved=true;dragState.dx=dx;dragState.dy=dy;if(dragMoved){const x=Math.max(-420,Math.min(420,dragState.baseX+dx)),y=Math.max(-260,Math.min(240,dragState.baseY+dy));el.style.transform=`translate(${x}px,${y}px) rotate(${which==='id'?-2:2}deg)`;}});const endDrag=()=>{if(!dragState||dragState.el!==el)return;const moved=dragMoved;if(moved){el.dataset.dragX=String(Math.max(-420,Math.min(420,dragState.baseX+dragState.dx)));el.dataset.dragY=String(Math.max(-260,Math.min(240,dragState.baseY+dragState.dy)));}dragState=null;if(moved)setTimeout(()=>{dragMoved=false;},250);};el.addEventListener('pointerup',endDrag);el.addEventListener('pointercancel',endDrag);el.addEventListener('lostpointercapture',endDrag);el.addEventListener('click',e=>{if(dragMoved){e.preventDefault();e.stopImmediatePropagation();dragMoved=false;return;}showDocument(which);});}attachPaperDrag($('id-document'),'id');attachPaperDrag($('form-document'),'form');document.addEventListener('contextmenu',e=>{if(!$('modal-backdrop').hidden){e.preventDefault();closeModal();}});$('folder-button').onclick=()=>openFolder();$('today-list').onclick=showTodayList;$('today-list').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showTodayList();}};$('visitor-face').onclick=askQuestions;$('ask-button').onclick=askQuestions;$('next-line').onclick=()=>{$('visitor-line').textContent=current?.dialog||'……';};
  let dialDragging=false,suppressDialClick=false,lastDialDigit=null;
  function dialDigit(digit){if(phone.replace(/-/g,'').length>=4)return;setPhone(phone.replace(/-+$/,'')+digit);const angle=((Number(digit)||10)-1)*36;$('dial-pointer').style.transform=`translate(-50%,-100%) rotate(${angle}deg)`;}
  $('phone-dial').querySelectorAll('button').forEach(b=>{
    b.addEventListener('pointerdown',()=>{dialDragging=true;suppressDialClick=true;lastDialDigit=b.dataset.digit;dialDigit(lastDialDigit);});
    b.addEventListener('pointerenter',()=>{if(dialDragging&&lastDialDigit!==b.dataset.digit){lastDialDigit=b.dataset.digit;dialDigit(lastDialDigit);}});
    b.addEventListener('click',e=>{if(suppressDialClick){e.preventDefault();suppressDialClick=false;return;}dialDigit(b.dataset.digit);});
  });
  document.addEventListener('pointerup',()=>{dialDragging=false;setTimeout(()=>{suppressDialClick=false;lastDialDigit=null;},0);});
  $('dial-clear').onclick=()=>{setPhone('----');$('dial-pointer').style.transform='translate(-50%,-100%) rotate(0deg)';};$('dial-call').onclick=ringPhone;$('emergency-button').onclick=pressEmergency;
  $('admit-button').onclick=()=>decide('admit');$('reject-button').onclick=()=>decide('reject');$('report-button').onclick=confirmReport;
  $('pause-button').onclick=pauseGame;$('resume-button').onclick=resumeGame;
  // Keyboard support is intentionally optional; all game actions are clickable/tappable.
  initGame();
})();

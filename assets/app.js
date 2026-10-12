// ===== PARTICLE FX (canvas): красные искры + тёмные dust-частицы =====
  (function() {
    const cvs = document.getElementById('fx-canvas');
    const ctx = cvs.getContext('2d');
    let parts = [], W, H;
    function resize() {
      W = cvs.width = innerWidth; H = cvs.height = innerHeight;
      const count = Math.min(140, Math.floor(W * H / 12000));
      parts = Array.from({length: count}, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.6 + .3,
        p: Math.random() * Math.PI * 2,
        s: Math.random() * .02 + .004,
        v: Math.random() * .05 + .01,
        red: Math.random() < .35
      }));
    }
    addEventListener('resize', resize); resize();
    (function loop() {
      ctx.clearRect(0, 0, W, H);
      for (const pt of parts) {
        pt.p += pt.s; pt.y -= pt.v; if (pt.y < -2) pt.y = H + 2;
        const a = .25 + Math.sin(pt.p) * .25;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, 7);
        ctx.fillStyle = pt.red ? `rgba(255,43,53,${a})` : `rgba(160,160,175,${a * .5})`;
        ctx.fill();
      }
      requestAnimationFrame(loop);
    })();
  })();

  // ===== DATA =====
  let games = [];

  const fmt = n => n.toLocaleString('ru-RU');

  const gameLogoSlugs = {
    'standoff 2': 'standoff2', 'cs2': 'counterstrike', 'counter-strike 2': 'counterstrike',
    'dota 2': 'dota2', 'valorant': 'valorant', 'league of legends': 'leagueoflegends',
    'lol': 'leagueoflegends', 'apex legends': 'apexlegends', 'fortnite': 'fortnite',
    'rocket league': 'rocketleague', 'pubg': 'pubg', 'pubg: battlegrounds': 'pubg'
  };
  function gameLogoUrl(name) {
    const slug = gameLogoSlugs[String(name || '').trim().toLowerCase()];
    return slug ? 'https://cdn.simpleicons.org/' + slug + '/ffffff' : '';
  }
  function gameInitials(name) {
    const words = String(name || 'GG').trim().split(/\\s+/).filter(Boolean);
    return (words.length > 1 ? words.slice(0, 2).map(word => word[0]).join('') : words[0].slice(0, 2)).toUpperCase();
  }

  function gameCard(g) {
    const name=escapeHtml(g.name),genre=escapeHtml(g.genre),arg=JSON.stringify(g.name).replace(/"/g,'&quot;'),logo=gameLogoUrl(g.name),icon=logo?'<img src="'+logo+'" alt="" loading="lazy" onerror="this.parentElement.classList.add(\'no-logo\')">':'';
    return '<article class="card game-card"><div class="game-img game-brand-icon '+(logo?'':'no-logo')+'">'+icon+'<span class="fallback-icon" aria-hidden="true">'+escapeHtml(gameInitials(g.name))+'</span></div><div class="game-info"><h4>'+name+'</h4><div class="genre">'+genre+'</div><div class="online">'+fmt(g.playerCount||0)+' игроков на Squadra</div><button class="btn btn-ghost" style="margin-top:12px;width:100%;" onclick="addGameToLibrary('+arg+')"><i class="fa-solid fa-plus"></i> В библиотеку</button></div></article>';
  }
  function renderGames(){const q=(document.getElementById('gameSearch')?.value||'').toLowerCase(),gen=document.getElementById('gameGenre')?.value||'',sort=document.getElementById('gameSort')?.value||'';let list=games.filter(g=>(!q||g.name.toLowerCase().includes(q))&&(!gen||g.genre===gen));list.sort((a,b)=>(b.playerCount||0)-(a.playerCount||0));const host=document.getElementById('gamesGrid');if(host)host.innerHTML=list.map(gameCard).join('')||'<p class="subtitle">Ничего не найдено</p>';}
  async function filterPlayers(){const body=document.getElementById('playersBody');if(!body)return;if(!supabaseClient||!currentUser){body.innerHTML='<tr><td colspan="8" class="subtitle">Войди, чтобы искать игроков.</td></tr>';return;}let q=supabaseClient.from('profiles').select('id,username,display_name,avatar_url,game_name,region,rank_name,rating,level,matches_played,wins,kd,verified_color').neq('id',currentUser.id).limit(100);const name=(document.getElementById('plName')?.value||'').trim(),game=document.getElementById('plGame')?.value,rank=document.getElementById('plRank')?.value,region=document.getElementById('plRegion')?.value;if(name)q=q.ilike('username','%'+name.replace(/[%_]/g,'')+'%');if(game)q=q.eq('game_name',game);if(rank)q=q.eq('rank_name',rank);if(region)q=q.eq('region',region);const {data,error}=await q.order('rating',{ascending:false});if(error){console.error(error);body.innerHTML='<tr><td colspan="8">Не удалось загрузить игроков.</td></tr>';return;}const ids=(data||[]).map(x=>x.id),rr=ids.length?await supabaseClient.from('user_roles').select('user_id,role').in('user_id',ids).in('role',['admin','moderator']):{data:[]},roles=new Map();(rr.data||[]).forEach(x=>roles.set(x.user_id,[...(roles.get(x.user_id)||[]),x.role]));body.innerHTML=(data||[]).map(p=>{const badge=p.verified_color?'<i class="fa-solid fa-circle-check verified-badge '+p.verified_color+'"></i>':'',role=(roles.get(p.id)||[]).includes('admin')?'<span class="staff-badge admin">Администратор</span>':(roles.get(p.id)||[]).includes('moderator')?'<span class="staff-badge moderator">Модератор</span>':'';return '<tr><td><button class="player-profile-link" onclick="openPlayerProfile(\''+p.id+'\')"><strong>'+escapeHtml(p.display_name||p.username)+'</strong>'+badge+role+'<small style="display:block;color:var(--muted)">@'+escapeHtml(p.username)+'</small></button></td><td>'+escapeHtml(p.rank_name||'—')+'</td><td>'+p.level+'</td><td>'+escapeHtml(p.game_name||'—')+'</td><td>'+escapeHtml(p.region||'—')+'</td><td>'+(p.matches_played?Math.round(p.wins*100/p.matches_played):0)+'%</td><td>'+fmt(p.rating||0)+'</td><td><button class="btn btn-ghost" onclick="addFriend(\''+p.id+'\')">Друг</button><button class="btn btn-ghost" onclick="toggleFollow(\''+p.id+'\')">Подписаться</button><button class="btn btn-ghost" onclick="reportMatch(\''+p.id+'\',\''+escapeHtml(p.game_name||'')+'\')">Результат</button></td></tr>';}).join('')||'<tr><td colspan="8" class="subtitle">Игроки не найдены.</td></tr>';}
  const sectionRoutes={home:'/',games:'/games',players:'/players',teams:'/teams',tournaments:'/tournaments',community:'/community',ranking:'/ranking',profile:'/profile',library:'/library',friends:'/friends',messages:'/messages',achievements:'/achievements',history:'/history',notifications:'/notifications',settings:'/settings',matchmaking:'/matchmaking',events:'/events',admin:'/admin'};
  function routeSection(path){const p=(path||'/').replace(/\/+$/,'')||'/';if(/^\/players\/[0-9a-f-]{36}$/i.test(p))return{section:'playerProfile',id:p.split('/').pop()};if(/^\/groups\/[0-9a-f-]{36}$/i.test(p))return{section:'groupPage',id:p.split('/').pop()};return{section:Object.keys(sectionRoutes).find(k=>sectionRoutes[k]===p)||'home'};}
  function applyLocationRoute(){const r=routeSection(location.pathname);if(r.section==='admin'&&!authInitialized){document.querySelectorAll('.section').forEach(x=>x.classList.remove('active'));document.getElementById('admin')?.classList.add('active');const s=document.getElementById('adminStatus');if(s)s.textContent='Проверяем права доступа…';return;}if(r.section==='admin'&&!isModerator){if(currentUser&&!isAdmin){showNotification('Панель доступна только администраторам.');showSection('home',{replace:true});}else if(!currentUser){showSection('home',{replace:true});openModal('loginModal');}return;}showSection(r.section,{fromLocation:true,profileId:r.id});}
  function showSection(id,options={}){if(id==='admin'&&!isModerator){currentUser?showNotification('Панель доступна только администраторам.'):openModal('loginModal');return;}const section=document.getElementById(id);if(!section)return;if(id==='admin')loadAdminPanel();if(id==='ranking')loadLeaderboards();if(id==='events')loadPlatformEvents();if(id==='playerProfile'&&options.profileId)loadPlayerProfile(options.profileId);if(id==='groupPage'&&options.profileId)openGroupChat(options.profileId,{fromRoute:true});document.querySelectorAll('.section').forEach(x=>x.classList.remove('active'));section.classList.add('active');document.title=(id==='playerProfile'?'Профиль игрока':({home:'Главная',games:'Игры',players:'Игроки',teams:'Команды',tournaments:'Турниры',community:'Сообщество',ranking:'Рейтинг',profile:'Профиль',library:'Библиотека',friends:'Друзья',messages:'Сообщения',achievements:'Достижения',history:'История',notifications:'Уведомления',settings:'Настройки',matchmaking:'Подбор игроков',events:'События',admin:'Администрирование',groupPage:'Группа'}[id]||'Squadra'))+' — Squadra';document.querySelectorAll('nav a,aside li').forEach(x=>x.classList.remove('active'));document.querySelector(`nav a[onclick*="${id}"],aside li[onclick*="${id}"]`)?.classList.add('active');const path=options.path||sectionRoutes[id];if(path&&!options.fromLocation&&location.pathname!==path)history.pushState({section:id},'',path);toggleNavigation(false);window.scrollTo({top:0,behavior:'smooth'});}
  window.addEventListener('popstate',applyLocationRoute);
  function toggleNavigation(force){const open=typeof force==='boolean'?force:!document.body.classList.contains('nav-open');document.body.classList.toggle('nav-open',open);const b=document.getElementById('menuToggle');if(b){b.setAttribute('aria-expanded',String(open));b.innerHTML='<i class="fa-solid '+(open?'fa-xmark':'fa-bars')+'"></i>';}}
  function openModal(id){
    const modal=document.getElementById(id);
    if(!modal)return;
    modal.classList.add('active');
    enhanceFields(modal);
    if(id==='loginModal') initGoogleIdentity('googleLoginButton');
    if(id==='registerModal') initGoogleIdentity('googleSignupButton');
  }
  function openPlayerProfile(id){if(!id)return;const host=document.getElementById('publicPlayerCard');if(host){host.dataset.profileId=String(id);host.setAttribute('aria-busy','true');host.innerHTML='<div class="profile-skeleton" role="status" aria-label="Загрузка профиля"><div class="profile-skeleton-hero"><span class="skeleton-avatar"></span><div class="skeleton-lines"><i></i><i></i><i></i></div></div><div class="profile-skeleton-stats"><i></i><i></i><i></i><i></i></div></div>';}showSection('playerProfile',{profileId:id,path:'/players/'+id});}
  async function loadPlayerProfile(id){
    const host=document.getElementById('publicPlayerCard');if(!host)return;
    const requestId=String(id||''),sequence=playerProfileRequest=(playerProfileRequest||0)+1;
    host.dataset.profileId=requestId;host.setAttribute('aria-busy','true');
    if(!currentUser){host.innerHTML='<div class="empty-state"><p>Войди, чтобы посмотреть профиль игрока.</p><button class="btn btn-primary" onclick="openModal(\'loginModal\')">Войти</button></div>';host.removeAttribute('aria-busy');return;}
    host.innerHTML='<div class="profile-skeleton" role="status" aria-label="Загрузка профиля"><div class="profile-skeleton-hero"><span class="skeleton-avatar"></span><div class="skeleton-lines"><i></i><i></i><i></i></div></div><div class="profile-skeleton-stats"><i></i><i></i><i></i><i></i></div></div>';
    const {data:p,error}=await supabaseClient.from('profiles').select('id,username,display_name,avatar_url,bio,game_name,region,rank_name,rating,matches_played,wins,kd,level,verified_color').eq('id',id).maybeSingle();
    if(sequence!==playerProfileRequest||host.dataset.profileId!==requestId)return;
    if(error||!p){host.innerHTML='<p class="subtitle">Профиль не найден или недоступен.</p>';host.removeAttribute('aria-busy');return;}
    const {data:roles}=await supabaseClient.from('user_roles').select('role').eq('user_id',id).in('role',['admin','moderator']);
    if(sequence!==playerProfileRequest||host.dataset.profileId!==requestId)return;
    const role=(roles||[]).some(r=>r.role==='admin')?'<span class="staff-badge admin"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Администратор</span>':(roles||[]).some(r=>r.role==='moderator')?'<span class="staff-badge moderator"><i class="fa-solid fa-shield" aria-hidden="true"></i> Модератор</span>':'';
    const verified=p.verified_color?'<i class="fa-solid fa-circle-check verified-badge '+p.verified_color+'" title="Проверенный аккаунт"></i>':'';
    host.innerHTML='<div class="public-profile-hero"><img class="public-avatar" src="'+escapeHtml(p.avatar_url||'')+'" alt="" onerror="this.removeAttribute(\'src\')"><div><span class="eyebrow">ПРОФИЛЬ ИГРОКА</span><h1>'+escapeHtml(p.display_name||p.username)+' '+verified+' '+role+'</h1><p class="subtitle">@'+escapeHtml(p.username)+' • '+escapeHtml(p.region||'—')+' • '+escapeHtml(p.game_name||'—')+'</p><p>'+escapeHtml(p.bio||'Игрок Squadra.')+'</p></div><div class="profile-actions"><button class="btn btn-primary" onclick="addFriend(\''+p.id+'\')">В друзья</button><button class="btn btn-ghost" onclick="openChatWith(\''+p.id+'\')">Написать</button></div></div><div class="stats-grid"><div class="stat-box"><div class="value">'+fmt(p.rating||0)+'</div><div class="label">Рейтинг</div></div><div class="stat-box"><div class="value">'+fmt(p.level||1)+'</div><div class="label">Уровень</div></div><div class="stat-box"><div class="value">'+fmt(p.matches_played||0)+'</div><div class="label">Матчей</div></div><div class="stat-box"><div class="value">'+(p.matches_played?Math.round(100*p.wins/p.matches_played):0)+'%</div><div class="label">Побед</div></div></div><div class="card rating-how"><h3>Как повысить рейтинг</h3><p>Сыграй матч и внеси результат. После подтверждения соперником рейтинг пересчитывается по Elo: победа над игроком с высоким рейтингом даёт больше очков.</p></div>';
    host.removeAttribute('aria-busy');
  }
  function closeModal(id) { document.getElementById(id).classList.remove('active'); }
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('active'); });
  });

  // NOTIFICATIONS
  function showNotification(text) {
    const n = document.createElement('div');
    n.className = 'notification';
    n.innerHTML = '<i class="fa-solid fa-circle-check" style="color:var(--red); margin-right:8px;"></i>' + text;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
  }

  // CHAT (имитация WebSocket)
  async function sendMessage() {
    if (!currentUser) return requireAccount();
    const receiverId = document.getElementById('chatRecipient')?.value;
    const input = document.getElementById('chatInput');
    const body = input?.value.trim();
    if (!receiverId) return showNotification('Выбери друга для переписки.');
    if (!body) return;
    const { error } = await supabaseClient.from('direct_messages').insert({ sender_id:currentUser.id, receiver_id:receiverId, body });
    if (error) { console.error(error); return showNotification('Не удалось отправить сообщение.'); }
    input.value=''; input.dispatchEvent(new Event('input',{bubbles:true})); await loadDirectMessages();
  }

  function matchScore(p, ratingTol, role, region, time) {
    let s = 40;
    s += Math.max(0, 30 - Math.abs(p.r - 2847) / ratingTol * 30);
    if (role !== 'Любая' && p.role === role) s += 15; else if (role !== 'Любая') s -= 10;
    if (p.region === region) s += 10;
    if (p.time === time || time === 'Сейчас' && p.time === 'Вечер') s += 8;
    return Math.round(Math.min(99, Math.max(35, s)));
  }
  async function startMatchmaking() {
    if(!currentUser)return requireAccount();
    const preferredLevel=document.getElementById('mmLevel')?.value||'Любой';
    const prefs={user_id:currentUser.id,game_name:document.getElementById('mmGame').value,role:document.getElementById('mmRole').value,rating_tolerance:document.getElementById('mmTolerance').value,region:document.getElementById('mmRegion').value,play_time:document.getElementById('mmPlayTime').value,language:document.getElementById('mmLanguage').value,preferred_level:preferredLevel};
    const {error:saveError}=await supabaseClient.from('matchmaking_preferences').upsert(prefs);
    if(saveError){console.error(saveError);return showNotification('Не удалось сохранить параметры подбора.');}
    const {data:preferenceRows,error:prefError}=await supabaseClient.from('matchmaking_preferences').select('user_id,game_name,role,region,play_time,language,preferred_level').eq('game_name',prefs.game_name).eq('region',prefs.region).neq('user_id',currentUser.id);
    if(prefError){console.error(prefError);return showNotification('Не удалось подобрать игроков.');}
    let eligible=preferenceRows||[];
    if(prefs.role!=='Любая')eligible=eligible.filter(p=>p.role===prefs.role||p.role==='Любая');
    if(prefs.play_time!=='Сейчас')eligible=eligible.filter(p=>p.play_time===prefs.play_time||p.play_time==='Любое');
    if(prefs.language)eligible=eligible.filter(p=>p.language===prefs.language);
    if(preferredLevel!=='Любой')eligible=eligible.filter(p=>p.preferred_level===preferredLevel||p.preferred_level==='Любой');
    const ids=eligible.map(p=>p.user_id);
    const {data:profiles,error:profileError}=ids.length?await supabaseClient.from('profiles').select('id,username,display_name,game_name,region,rank_name,rating,level,matches_played,wins').in('id',ids):{data:[],error:null};
    if(profileError){console.error(profileError);return showNotification('Не удалось загрузить профили игроков.');}
    const tolerance=prefs.rating_tolerance==='Точный ранг'?0:(Number((prefs.rating_tolerance.match(/\d+/)||['500'])[0])||500);
    const mine=accountProfile?.rating||1200;
    const ranked=(profiles||[]).filter(p=>prefs.rating_tolerance==='Точный ранг'?p.rank_name===accountProfile?.rank_name:Math.abs((p.rating||1200)-mine)<=tolerance)
      .map(p=>({...p,matchScore:Math.round(Math.max(0,100-(Math.abs((p.rating||1200)-mine)/Math.max(1,tolerance||1))*30+(prefs.role!=='Любая'&&eligible.find(x=>x.user_id===p.id)?.role!==prefs.role?10:0)))}))
      .sort((a,b)=>b.matchScore-a.matchScore);
    document.getElementById('mmTitle').textContent='ПОДХОДЯЩИЕ ИГРОКИ · РЕЙТИНГ ± '+(tolerance||'точное совпадение');
    document.getElementById('mmBarWrap').style.display='block';document.getElementById('mmBar').style.width='100%';
    document.getElementById('mmIcon').innerHTML='<i class="fa-solid fa-circle-check"></i>';
    document.getElementById('matchmakingResults').innerHTML=ranked.map(p=>'<div class="card"><strong>'+escapeHtml(p.display_name||p.username)+'</strong><div class="subtitle">'+escapeHtml(p.game_name)+' • '+escapeHtml(p.region)+' • '+escapeHtml(p.rank_name)+' • рейтинг '+p.rating+' • уровень '+p.level+'</div><span class="badge badge-info">Совпадение '+p.matchScore+'%</span><button class="btn btn-primary" onclick="addFriend(&quot;'+p.id+'&quot;)">Добавить в друзья</button></div>').join('')||'<p class="subtitle">Подходящих игроков пока нет. Измени фильтры или пригласи друзей.</p>';
  }

  function switchRankTab(tab) {
    ['players','teams','games'].forEach(t => {
      document.getElementById('rank' + t[0].toUpperCase() + t.slice(1)).style.display = t === tab ? 'block' : 'none';
    });
    document.querySelectorAll('.rank-tab').forEach(b => {
      const on = b.dataset.tab === tab;
      b.className = 'btn rank-tab ' + (on ? 'btn-primary active' : 'btn-ghost');
    });
  }

function initCustomSelects(root=document){root.querySelectorAll('select').forEach(select=>{if(select.dataset.customReady)return;select.dataset.customReady='1';select.classList.add('custom-select-source');select.tabIndex=-1;select.setAttribute('aria-hidden','true');const shell=document.createElement('div');shell.className='custom-select-shell';select.parentNode.insertBefore(shell,select);shell.appendChild(select);const trigger=document.createElement('button');trigger.type='button';trigger.className='custom-select-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');const value=document.createElement('span'),icon=document.createElement('i');icon.className='fa-solid fa-chevron-down';trigger.append(value,icon);const label=select.id?document.querySelector('label[for="'+select.id+'"]'):null;if(label){trigger.setAttribute('aria-label',label.textContent.trim());label.addEventListener('click',e=>{e.preventDefault();trigger.click();});}const menu=document.createElement('div');menu.className='custom-select-menu';menu.setAttribute('role','listbox');menu.hidden=true;shell.append(trigger,menu);const render=()=>{const selected=select.options[select.selectedIndex];value.textContent=selected?.textContent||'Выбрать';menu.innerHTML=[...select.options].map((o,i)=>'<button type="button" class="custom-select-option" role="option" aria-selected="'+(i===select.selectedIndex)+'" data-index="'+i+'">'+escapeHtml(o.textContent)+'</button>').join('');};const close=()=>{menu.hidden=true;shell.classList.remove('opens-upward');trigger.setAttribute('aria-expanded','false');};const open=state=>{if(!state){close();return;}const rect=trigger.getBoundingClientRect(),below=window.innerHeight-rect.bottom-12,above=rect.top-12,up=below<Math.min(220,menu.scrollHeight)&&above>below;shell.classList.toggle('opens-upward',up);menu.style.maxHeight=Math.max(120,Math.min(280,(up?above:below)-8))+'px';menu.hidden=false;trigger.setAttribute('aria-expanded','true');};const native=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value');try{Object.defineProperty(select,'value',{configurable:true,get(){return native.get.call(this)},set(v){native.set.call(this,v);render()}})}catch{}trigger.onclick=()=>open(menu.hidden);trigger.onkeydown=e=>{if(['ArrowDown','Enter',' '].includes(e.key)){e.preventDefault();open(true);menu.querySelector('.custom-select-option')?.focus()}};menu.onkeydown=e=>{if(e.key==='Escape'){close();trigger.focus()}};menu.onclick=e=>{const option=e.target.closest('[data-index]');if(!option)return;select.selectedIndex=Number(option.dataset.index);select.dispatchEvent(new Event('change',{bubbles:true}));render();close();trigger.focus()};select.addEventListener('change',render);new MutationObserver(render).observe(select,{childList:true,subtree:true,attributes:true,characterData:true});document.addEventListener('click',e=>{if(!shell.contains(e.target))close()});window.addEventListener('resize',()=>{if(!menu.hidden)open(true)},{passive:true});render()})}
    // RENDER ON LOAD
  try {
    document.getElementById('homeGames').innerHTML = games.slice(0,4).map(gameCard).join('');
    renderGames();
    document.getElementById('playersBody').innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);">Войди, чтобы искать игроков.</td></tr>';
  } catch (error) {
    console.error('Initial content rendering failed:', error);
  }

  // Profile and admin charts now use real Supabase records; no placeholder chart data is injected.

  // ===== SUPABASE AUTH =====
  // Public client configuration only. Never put a Supabase secret/service-role key here.
  const SUPABASE_URL = 'https://vblunxderjsyudlrsrai.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_NqXL2IVq6GATI0qbTs5iDA_5bVLpzo8';
  let supabaseClient = null;
  let currentUser = null;
  let playerProfileRequest=0;
  let isAdmin = false;
  let authInitialized=false;
  let adminPanelLoading=false;
  let isModerator = false;
  let accountProfile = null;
  let accountGameStats=[];
  let accountLibrary=[];
  let followedIds=new Set();
  let communityFeedMode='all';
  let communityPostRows=[];
  let communityLiked=new Set();
  let communityCommentRows=[];
  let accountNotifications=[];
  let accountFriends = [];
  let accountMatchmakingPrefs = null;
  let communityMediaFile = null;
  let pendingTournamentId = null;

  function authIsConfigured() {
    return !SUPABASE_URL.includes('YOUR_PROJECT_REF') &&
      !SUPABASE_PUBLISHABLE_KEY.includes('YOUR_SUPABASE_PUBLISHABLE_KEY');
  }

  // Google Identity Services returns the Google ID token directly to this page.
  // Supabase validates it and creates the Squadra session without redirecting through *.supabase.co.
  const GOOGLE_CLIENT_ID = '198639216760-l2lh0amnv10r1j8nvbtf62oa10o6q27h.apps.googleusercontent.com';
  let googleAuthNonce = null;
  let googleSignInPending = false;

  async function createGoogleNonce() {
    const random = crypto.getRandomValues(new Uint8Array(32));
    const nonce = btoa(String.fromCharCode(...random));
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
    const hashedNonce = Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, '0')).join('');
    return { nonce, hashedNonce };
  }

  let googleIdentityLoader = null;
  let googleIdentityInitialized = false;

  function loadGoogleIdentityScript() {
    if (window.google?.accounts?.id) return Promise.resolve();
    if (!googleIdentityLoader) {
      googleIdentityLoader = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.onload = () => window.google?.accounts?.id
          ? resolve()
          : reject(new Error('Google Identity Services is unavailable.'));
        script.onerror = () => reject(new Error('Google Identity Services failed to load.'));
        document.head.appendChild(script);
      });
    }
    return googleIdentityLoader;
  }

  function renderGoogleIdentityButton(id) {
    const container = document.getElementById(id);
    if (!container || !googleIdentityInitialized || container.querySelector('iframe')) return;
    const fallback = container.querySelector('.google-fallback');
    if (fallback) fallback.hidden = true;
    Array.from(container.children).forEach(child => {
      if (child !== fallback) child.remove();
    });
    try {
      window.google.accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'filled_black',
        size: 'medium',
        text: id === 'googleSignupButton' ? 'signup_with' : 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 320,
        locale: 'ru'
      });
      window.setTimeout(() => {
        if (!container.querySelector('iframe') && fallback) fallback.hidden = false;
      }, 1500);
    } catch (error) {
      console.error('Could not render Google Identity button:', error);
      if (fallback) fallback.hidden = false;
    }
  }

  async function initGoogleIdentity(buttonId) {
    try {
      if (!googleIdentityInitialized) {
        await loadGoogleIdentityScript();
        const { nonce, hashedNonce } = await createGoogleNonce();
        googleAuthNonce = nonce;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashedNonce,
          use_fedcm_for_button: false,
          callback: handleGoogleCredential
        });
        googleIdentityInitialized = true;
      }
      if (buttonId) renderGoogleIdentityButton(buttonId);
    } catch (error) {
      googleIdentityLoader = null;
      googleIdentityInitialized = false;
      console.error('Google Identity Services did not initialize:', error);
      ['googleLoginButton', 'googleSignupButton'].forEach(id => {
        const fallback = document.querySelector('#' + id + ' .google-fallback');
        if (fallback) fallback.hidden = false;
      });
    }
  }

  let supabaseAuthLoader = null;

  async function ensureSupabaseClient() {
    if (!authIsConfigured()) throw new Error('Supabase Auth is not configured.');
    if (!window.supabase?.createClient) {
      if (!supabaseAuthLoader) {
        supabaseAuthLoader = new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
          script.async = true;
          script.onload = () => window.supabase?.createClient
            ? resolve()
            : reject(new Error('Supabase client failed to initialize.'));
          script.onerror = () => reject(new Error('Supabase client could not be loaded.'));
          document.head.appendChild(script);
        });
      }
      await supabaseAuthLoader;
    }
    if (!supabaseClient) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    }
    return supabaseClient;
  }

  async function handleGoogleCredential(response) {
    if (googleSignInPending) return;
    if (!response?.credential || !googleAuthNonce) {
      showNotification('Google не вернул данные авторизации. Попробуйте ещё раз.');
      return;
    }
    googleSignInPending = true;
    try {
      const client = await ensureSupabaseClient();
      const { error } = await client.auth.signInWithIdToken({
        provider: 'google',
        token: response.credential,
        nonce: googleAuthNonce
      });
      if (error) {
        console.error('Supabase Google sign-in error:', error);
        showNotification('Не удалось войти. Проверьте Google-провайдера в Supabase.');
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      showNotification('Не удалось завершить вход через Google.');
    } finally {
      googleSignInPending = false;
    }
  }

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  initCustomSelects();new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.matches?.('select'))initCustomSelects(n.parentElement||document);else initCustomSelects(n)}}))).observe(document.body,{childList:true,subtree:true});
  const requireAccount = () => { showNotification('Войди в аккаунт, чтобы сохранить эти данные.'); openModal('loginModal'); };
  const queryError = (label,error) => { if(error) console.error(label,error); return error; };

  let accountTournamentIds=[];
  async function loadAccountData() {
    if (!supabaseClient || !currentUser) return;
    const uid=currentUser.id;
    const [pr,st,lib,fr,teams,history,ach,posts,likes,prefs,regs,notifs,invites,comments,gameStats,follows] = await Promise.all([
      supabaseClient.from('profiles').select('*').eq('id',uid).maybeSingle(),
      supabaseClient.from('user_settings').select('*').eq('user_id',uid).maybeSingle(),
      supabaseClient.from('user_library').select('*').eq('user_id',uid).order('added_at'),
      supabaseClient.from('friendships').select('*').or('requester_id.eq.'+uid+',addressee_id.eq.'+uid).order('created_at',{ascending:false}),
      supabaseClient.from('team_members').select('role,teams(id,name,tag,game_name,region,description,owner_id)').eq('user_id',uid),
      supabaseClient.from('activity_history').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(30),
      supabaseClient.from('achievements').select('id,title,description,icon,target,sort_order,user_achievements(progress,unlocked_at)').order('sort_order'),
      supabaseClient.from('community_posts').select('id,user_id,body,created_at,media_url,media_type,community_post_likes(user_id)').order('created_at',{ascending:false}).limit(30),
      supabaseClient.from('community_post_likes').select('post_id').eq('user_id',uid),
      supabaseClient.from('matchmaking_preferences').select('*').eq('user_id',uid).maybeSingle(),
      supabaseClient.from('tournament_registrations').select('tournament_id').eq('user_id',uid),
      supabaseClient.from('notifications').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(20),
      supabaseClient.from('team_invites').select('id,team_id,inviter_id,invitee_id,status,teams(name,tag)').or('invitee_id.eq.'+uid+',inviter_id.eq.'+uid).eq('status','pending'),
      supabaseClient.from('community_post_comments').select('id,post_id,user_id,body,created_at').order('created_at',{ascending:true}).limit(300),
      supabaseClient.from('player_game_stats').select('game_id,rating,matches_played,wins').eq('user_id',uid),
      supabaseClient.from('user_follows').select('following_id').eq('follower_id',uid)
    ]);
    queryError('profile',pr.error);queryError('settings',st.error);queryError('library',lib.error);queryError('friendships',fr.error);queryError('teams',teams.error);queryError('history',history.error);queryError('achievements',ach.error);queryError('posts',posts.error);queryError('likes',likes.error);queryError('matchmaking',prefs.error);
    accountProfile=pr.data; accountGameStats=gameStats.data||[];accountLibrary=lib.data||[];followedIds=new Set((follows.data||[]).map(x=>x.following_id)); accountMatchmakingPrefs=prefs.data; accountFriends=await loadFriendProfiles(fr.data||[]);
    renderAccountProfile(accountProfile,st.data);renderAuthState(currentUser);
    renderLibrary(accountLibrary,accountGameStats);
    renderFriends(accountFriends);
    renderTeams(teams.data||[]);renderTeamInvites(invites.data||[]);
    renderHistory(history.data||[]);
    renderAchievements(ach.data||[]);
    const postRows=posts.data||[];
    const postUserIds=[...new Set(postRows.map(p=>p.user_id))];
    if(postUserIds.length){const {data:postProfiles}=await supabaseClient.from('profiles').select('id,username,display_name,avatar_url').in('id',postUserIds);const profileMap=Object.fromEntries((postProfiles||[]).map(p=>[p.id,p]));postRows.forEach(p=>p.profiles=profileMap[p.user_id]);}
    const commentRows=comments.data||[];const commentIds=[...new Set(commentRows.map(c=>c.user_id))];if(commentIds.length){const {data:commentProfiles}=await supabaseClient.from('profiles').select('id,username,display_name').in('id',commentIds);const commentMap=new Map((commentProfiles||[]).map(p=>[p.id,p]));commentRows.forEach(c=>c.profiles=commentMap.get(c.user_id));}
    renderCommunity(postRows,new Set((likes.data||[]).map(x=>x.post_id)),commentRows);
    fillChatRecipients(accountFriends);
    fillAccountSettings(accountProfile,st.data,prefs.data);
    accountTournamentIds=(regs.data||[]).map(x=>x.tournament_id);
    renderTournamentRegistrations(accountTournamentIds);
    await Promise.all([loadCreatedTournaments(),loadCommunityGroups(),loadTeamDirectory()]);
    accountNotifications=notifs.data||[];renderNotifications(accountNotifications);loadChatList();await Promise.all([loadPendingMatches(),loadGameCatalog(),loadLeaderboards(),loadPlatformEvents(),loadHomeTournaments()]);
    if(document.getElementById('plName')) filterPlayers();
  }

  function renderAccountProfile(p,settings) {
    if(!p)return;
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    set('profileDisplayName',p.display_name||p.username);set('profileLevel','Уровень '+p.level);
    set('profileGameRank',(p.game_name||'CS2')+' • '+(p.rank_name||'Unranked'));
    set('profileStatus','@'+p.username);
    set('profileMatches',p.matches_played);set('profileWinRate',(p.matches_played?Math.round(p.wins*100/p.matches_played):0)+'%');
    set('profileRating',fmt(p.rating));set('profileKd',Number(p.kd||0).toFixed(1));
    set('profileStatsSummary','Рейтинг растёт после подтверждённых матчей. Победа над соперником с высоким рейтингом даёт больше очков Elo. Результаты и изменения рейтинга доступны в истории.');
    const avatar=document.getElementById('profileAvatar');if(avatar&&p.avatar_url)avatar.src=p.avatar_url;
    const badges=document.getElementById('profileRoleBadge');if(badges){const role=isAdmin?'<span class="staff-badge admin"><i class="fa-solid fa-shield-halved"></i> Администратор</span>':isModerator?'<span class="staff-badge moderator"><i class="fa-solid fa-shield"></i> Модератор</span>':'';const verified=p.verified_color?'<span class="verified-badge '+p.verified_color+'"><i class="fa-solid fa-circle-check"></i> Проверен</span>':'';badges.innerHTML=role+verified;}const warning=document.getElementById('verificationWarning');if(warning)warning.hidden=!p.verified_color;
    if(document.getElementById('profileAchievementsCount')) document.getElementById('profileAchievementsCount').textContent='0';
  }

  function setTheme(name){const safe=['default','dark','light','green','blue','purple','yellow'].includes(name)?name:'default';document.body.dataset.theme=safe;localStorage.setItem('squadra-theme',safe);}
  function fillAccountSettings(p,s,prefs) {
    if(!p)return;
    document.getElementById('settingsDisplayName').value=p.display_name||'';
    document.getElementById('settingsUsername').value=p.username||'';
    document.getElementById('settingsEmail').value=currentUser?.email||'';
    document.getElementById('settingsLanguage').value=p.language||'ru';
    document.getElementById('settingsRegion').value=p.region||'EU';
    document.getElementById('settingsGame').value=p.game_name||'CS2';const theme=document.getElementById('settingsTheme');if(theme)theme.value=s?.theme||localStorage.getItem('squadra-theme')||'default';setTheme(theme?.value||'default');
    document.getElementById('settingsBio').value=p.bio||'';
    const check=(id,key,fallback)=>{const e=document.getElementById(id);if(e)e.checked=s?s[key]:fallback;};
    check('notifyMessages','notify_messages',true);check('notifyTeamInvites','notify_team_invites',true);
    check('notifyTournaments','notify_tournaments',true);check('notifyMarketing','notify_marketing',false);
    if(prefs){document.getElementById('mmGame').value=prefs.game_name;document.getElementById('mmRole').value=prefs.role;document.getElementById('mmTolerance').value=prefs.rating_tolerance;document.getElementById('mmRegion').value=prefs.region;document.getElementById('mmPlayTime').value=prefs.play_time;document.getElementById('mmLanguage').value=prefs.language;if(document.getElementById('mmLevel'))document.getElementById('mmLevel').value=prefs.preferred_level||'Любой';}
  }

  function renderLibrary(rows) {
    const el=document.getElementById('libraryGrid');if(!el)return;const stats=accountGameStats||[];
    if(!rows.length){el.innerHTML='<div class="library-empty card"><div class="empty-state"><i class="fa-solid fa-gamepad"></i><h3>Твоя игровая библиотека</h3><p>Сохраняй любимые игры, смотри игровой рейтинг и статистику по матчам.</p><button class="btn btn-primary" onclick="showSection(\'games\')">Открыть каталог игр</button></div></div>';return;}
    el.innerHTML=rows.map(r=>{const g=games.find(x=>x.name===r.game_name)||{name:r.game_name,genre:'Игра'},gameId=games.find(x=>x.name===r.game_name)?.id,s=stats.find(x=>x.game_id===gameId),wr=s?.matches_played?Math.round(100*s.wins/s.matches_played):0,logo=gameLogoUrl(g.name),icon=logo?'<img src="'+logo+'" alt="" onerror="this.parentElement.classList.add(\'no-logo\')">':'';return '<article class="card library-game-card"><div class="game-brand-icon '+(logo?'':'no-logo')+'">'+icon+'<span class="fallback-icon">'+escapeHtml(gameInitials(g.name))+'</span></div><div class="library-game-info"><span class="eyebrow">'+escapeHtml(g.genre||'ИГРА')+'</span><h3>'+escapeHtml(r.game_name)+'</h3><p class="subtitle">Добавлена '+new Date(r.added_at).toLocaleDateString('ru-RU')+'</p><div class="library-game-stats"><span><strong>'+fmt(s?.rating||0)+'</strong><small>рейтинг</small></span><span><strong>'+fmt(s?.matches_played||0)+'</strong><small>матчей</small></span><span><strong>'+wr+'%</strong><small>побед</small></span></div><button class="btn btn-ghost" onclick="showSection(\'ranking\')">Таблица лидеров</button> <button class="btn btn-ghost" onclick="removeLibraryGame(\''+r.id+'\')"><i class="fa-solid fa-trash"></i></button></div></article>';}).join('');
  }
  async function addGameToLibrary(name) {
    if(!currentUser)return requireAccount();
    const {error}=await supabaseClient.from('user_library').upsert({user_id:currentUser.id,game_name:name},{onConflict:'user_id,game_name'});
    if(error){console.error(error);return showNotification('Не удалось добавить игру.');}
    await loadAccountData();showNotification(name+' добавлена в библиотеку.');
  }
  async function removeLibraryGame(id) {
    const {error}=await supabaseClient.from('user_library').delete().eq('id',id).eq('user_id',currentUser.id);
    if(error)return showNotification('Не удалось удалить игру.');
    await loadAccountData();
  }
  function renderFriends(rows) {
    const el=document.getElementById('friendsGrid');if(!el)return;
    el.innerHTML=rows.map(f=>{const accepted=f.status==='accepted',other=f.requester_id===currentUser.id?f.addressee_id:f.requester_id,p=f.friend_profile||{},rate=p.matches_played?Math.round(100*p.wins/p.matches_played):0,verify=p.verified_color?'<i class="fa-solid fa-circle-check verified-badge '+p.verified_color+'"></i>':'';return '<article class="card friend-card"><div class="friend-card-head"><img class="mini-avatar" src="'+escapeHtml(p.avatar_url||'')+'" alt="" onerror="this.removeAttribute(\'src\')"><div><button class="player-profile-link" onclick="openPlayerProfile(\''+other+'\')"><strong>'+escapeHtml(p.display_name||p.username||'Игрок')+'</strong>'+verify+'</button><p class="subtitle">@'+escapeHtml(p.username||'')+' • '+(accepted?'В друзья':f.requester_id===currentUser.id?'Запрос отправлен':'Входящий запрос')+'</p><p class="friend-summary">'+escapeHtml(p.game_name||'Игра не выбрана')+' • '+escapeHtml(p.region||'—')+' • '+escapeHtml(p.rank_name||'Unranked')+' • '+fmt(p.rating||0)+' Elo • '+rate+'% побед</p></div></div><div class="friend-card-actions"><button class="btn btn-ghost" onclick="openPlayerProfile(\''+other+'\')">Профиль</button>'+(f.status==='pending'&&f.addressee_id===currentUser.id?'<button class="btn btn-primary" onclick="respondFriend(\''+f.id+'\',\'accepted\')">Принять</button>':'')+(accepted?'<button class="btn btn-ghost" onclick="openChatWith(\''+other+'\')"><i class="fa-solid fa-comment"></i> Написать</button>':'')+'</div></article>';}).join('')||'<p class="subtitle">Пока нет друзей и запросов.</p>';
  }  async function loadFriendProfiles(rows) {
    const ids=[...new Set(rows.map(f=>f.requester_id===currentUser.id?f.addressee_id:f.requester_id))];if(!ids.length)return rows;
    const {data}=await supabaseClient.from('profiles').select('id,username,display_name,avatar_url,game_name,region,rank_name,rating,matches_played,wins,level,verified_color').in('id',ids);
    const byId=Object.fromEntries((data||[]).map(p=>[p.id,p]));
    return rows.map(f=>({...f,friend_profile:byId[f.requester_id===currentUser.id?f.addressee_id:f.requester_id]}));
  }
  function renderTeams(rows) {
    const el=document.getElementById('teamsGrid');if(!el)return;
    el.innerHTML=rows.map(r=>{const t=r.teams;if(!t)return '';return '<div class="card"><span class="badge badge-info">'+escapeHtml(r.role)+'</span><h3>'+escapeHtml(t.name)+' <small>'+escapeHtml(t.tag)+'</small></h3><p class="subtitle">'+escapeHtml(t.game_name)+' • '+escapeHtml(t.region)+'</p><p>'+escapeHtml(t.description)+'</p>'+(t.owner_id===currentUser.id?'<button class="btn btn-ghost" onclick="inviteToTeam(\''+t.id+'\')"><i class="fa-solid fa-user-plus"></i> Пригласить игрока</button>':'')+'</div>';}).join('')||'<p class="subtitle">Ты пока не состоишь в команде.</p>';
  }
  function renderTeamInvites(rows) {
    const pending=rows.filter(x=>x.invitee_id===currentUser.id);
    if(!pending.length)return;
    const grid=document.getElementById('teamsGrid');
    const html=pending.map(x=>'<div class="card"><span class="badge badge-warning">Приглашение</span><h3>'+escapeHtml(x.teams?.name||'Команда')+'</h3><button class="btn btn-primary" onclick="respondTeamInvite(\''+x.id+'\',\'accepted\')">Принять</button> <button class="btn btn-ghost" onclick="respondTeamInvite(\''+x.id+'\',\'declined\')">Отклонить</button></div>').join('');
    grid.insertAdjacentHTML('afterbegin',html);
  }
  async function inviteToTeam(teamId) {
    const username=await askInput('Ник игрока в Squadra:');if(!username)return;
    const {data:target,error:lookupError}=await supabaseClient.from('profiles').select('id,username').ilike('username',username.trim()).maybeSingle();
    if(lookupError||!target)return showNotification('Игрок с таким ником не найден.');
    const {error}=await supabaseClient.from('team_invites').insert({team_id:teamId,inviter_id:currentUser.id,invitee_id:target.id});
    if(error){console.error(error);return showNotification('Не удалось отправить приглашение.');}
    showNotification('Приглашение отправлено @'+target.username);
  }
  async function respondTeamInvite(id,status) {
    const {error}=await supabaseClient.from('team_invites').update({status}).eq('id',id).eq('invitee_id',currentUser.id);
    if(error){console.error(error);return showNotification('Не удалось обновить приглашение.');}
    await loadAccountData();
  }
  function renderHistory(rows) {
    const el=document.getElementById('historyBody');if(!el)return;
    el.innerHTML=rows.map(r=>'<tr id="activity-'+(r.metadata?.match_id||r.metadata?.entity_id||'')+'"><td>'+new Date(r.created_at).toLocaleDateString('ru-RU')+'</td><td>'+escapeHtml(r.action)+'</td><td>'+escapeHtml(r.game_name)+'</td><td>'+escapeHtml(r.result)+'</td><td>'+(r.rating_delta??'—')+'</td></tr>').join('')||'<tr><td colspan="5" style="text-align:center;color:var(--muted);">История появится после добавления игровых событий.</td></tr>';
  }
  function renderAchievements(rows) {
    const card=a=>'<article class="card achievement-card '+(a.unlocked_at?'unlocked':'')+'"><div class="achievement-icon"><i class="fa-solid '+escapeHtml(a.icon)+'"></i></div><div><h3>'+escapeHtml(a.title)+'</h3><p class="subtitle">'+escapeHtml(a.description)+'</p><div class="progress"><div class="progress-bar" style="width:'+Math.min(100,Math.round((a.progress||0)*100/a.target))+'%"></div></div><small>'+fmt(a.progress||0)+' / '+fmt(a.target)+' • '+(a.unlocked_at?'Открыто':'Осталось '+fmt(Math.max(0,a.target-(a.progress||0))))+'</small></div></article>';
    const mapped=rows.map(a=>{const ua=Array.isArray(a.user_achievements)?a.user_achievements[0]:null;return {...a,progress:ua?.progress||0,unlocked_at:ua?.unlocked_at};});
    document.getElementById('achievementsGrid').innerHTML=mapped.map(card).join('')||'<p class="subtitle">Достижения пока не настроены.</p>';
    document.getElementById('profileAchievementsCount').textContent=mapped.filter(a=>a.unlocked_at).length;
    document.getElementById('profileRecentAchievements').innerHTML=mapped.filter(a=>a.unlocked_at).slice(0,4).map(card).join('')||'<p class="subtitle">Пока нет открытых достижений.</p>';
  }
  function setCommunityFeedMode(mode){communityFeedMode=mode==='following'?'following':'all';document.getElementById('feedAllButton')?.classList.toggle('btn-primary',communityFeedMode==='all');document.getElementById('feedAllButton')?.classList.toggle('btn-ghost',communityFeedMode!=='all');document.getElementById('feedFollowingButton')?.classList.toggle('btn-primary',communityFeedMode==='following');document.getElementById('feedFollowingButton')?.classList.toggle('btn-ghost',communityFeedMode!=='following');renderCommunity(communityPostRows,communityLiked,communityCommentRows);}
  function renderCommunity(rows,liked,comments=[]) {
    communityPostRows=rows;communityLiked=liked;communityCommentRows=comments;
    const el=document.getElementById('communityPosts');if(!el)return;
    const visible=communityFeedMode==='following'?rows.filter(p=>followedIds.has(p.user_id)):rows;
    const grouped=comments.reduce((m,c)=>{(m[c.post_id]??=[]).push(c);return m;},{});
    el.innerHTML=visible.map(p=>{
      const media=p.media_url?(p.media_type==='video'
        ?'<video controls preload="metadata" style="display:block;width:100%;max-height:480px;border-radius:10px;margin:10px 0" src="'+escapeHtml(p.media_url)+'"></video>'
        :'<img loading="lazy" style="display:block;max-width:100%;max-height:480px;border-radius:10px;margin:10px 0;object-fit:contain" src="'+escapeHtml(p.media_url)+'" alt="Изображение в публикации">'):'';
      const commentRows=grouped[p.id]||[];
      const commentsHtml=commentRows.map(c=>'<article class="post-comment"><div class="comment-head"><button class="comment-author" onclick="openPlayerProfile(&quot;'+c.user_id+'&quot;)"><span class="comment-avatar"><i class="fa-solid fa-user"></i></span><span class="comment-author-meta"><strong>'+escapeHtml(c.profiles?.display_name||c.profiles?.username||'Игрок')+'</strong><small>@'+escapeHtml(c.profiles?.username||'игрок')+'</small></span></button><time>'+new Date(c.created_at).toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})+'</time></div><p class="comment-body">'+escapeHtml(c.body)+'</p></article>').join('');
      return '<article class="card" id="community-post-'+p.id+'" style="margin-bottom:14px"><strong>'+escapeHtml(p.profiles?.display_name||p.profiles?.username||'Игрок')+'</strong><small class="subtitle"> • '+new Date(p.created_at).toLocaleString('ru-RU')+'</small>'+(p.body?'<p style="margin:14px 0;white-space:pre-wrap">'+escapeHtml(p.body)+'</p>':'')+media+'<button class="btn btn-ghost" onclick="togglePostLike(\''+p.id+'\', '+liked.has(p.id)+')"><i class="fa-solid fa-heart"></i> '+(p.community_post_likes?.length||0)+'</button> <button class="btn btn-ghost" onclick="reportCommunityPost(\''+p.id+'\',\''+p.user_id+'\')"><i class="fa-solid fa-flag"></i> Пожаловаться</button><div style="margin-top:12px;">'+commentsHtml+'<input id="comment-'+p.id+'" maxlength="2000" placeholder="Написать комментарий"><button class="btn btn-ghost" onclick="addPostComment(\''+p.id+'\')">Комментировать</button></div></article>';
    }).join('')||'<div class="empty-state"><p>'+(communityFeedMode==='following'?'В этой ленте появятся записи авторов, на которых ты подписался.':'Пока нет публикаций.')+'</p></div>';
  }
  function fillChatRecipients(rows) {
    const sel=document.getElementById('chatRecipient');if(!sel)return;
    const selected=sel.value;
    sel.innerHTML='<option value="">Выбери друга</option>'+rows.filter(f=>f.status==='accepted').map(f=>{const p=f.friend_profile||{};const id=f.requester_id===currentUser.id?f.addressee_id:f.requester_id;return '<option value="'+id+'">'+escapeHtml(p.display_name||p.username||'Друг')+'</option>';}).join('');
    if(selected)sel.value=selected;
  }
  async function loadDirectMessages() {
    const id=document.getElementById('chatRecipient')?.value,box=document.getElementById('chatMessages');
    if(!box)return;if(!id){box.innerHTML='<div class="empty-state"><i class="fa-regular fa-comments"></i><p>Выбери диалог слева или найди игрока по Squadra-нику.</p></div>';return;}
    const {data,error}=await supabaseClient.from('direct_messages').select('*').or('and(sender_id.eq.'+currentUser.id+',receiver_id.eq.'+id+'),and(sender_id.eq.'+id+',receiver_id.eq.'+currentUser.id+')').order('created_at').limit(100);
    if(error){console.error(error);box.innerHTML='<p class="subtitle">Не удалось загрузить переписку.</p>';return;}
    box.innerHTML=(data||[]).map(m=>'<div class="message '+(m.sender_id===currentUser.id?'own':'')+'"><div class="author">'+(m.sender_id===currentUser.id?'Вы':'Собеседник')+' • '+new Date(m.created_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+'</div>'+escapeHtml(m.body)+'</div>').join('')||'<p class="subtitle">Начни переписку.</p>';box.scrollTop=box.scrollHeight;
    await supabaseClient.from('direct_messages').update({read_at:new Date().toISOString()}).eq('receiver_id',currentUser.id).eq('sender_id',id).is('read_at',null);
  }
  async function openChatWith(id){if(!id)return;const friend=(accountFriends||[]).find(f=>f.status==='accepted'&&(f.requester_id===id||f.addressee_id===id));if(id!==currentUser?.id&&!friend){showNotification('Сначала добавь игрока в друзья и дождись принятия заявки.');return;}showSection('messages');const recipient=document.getElementById('chatRecipient');if(recipient)recipient.value=id;loadDirectMessages();loadChatList();loadChatProfile(id);}
  async function loadChatProfile(id){const host=document.getElementById('activeChatHeader');if(!host)return;const {data:p}=await supabaseClient.from('profiles').select('id,username,display_name,avatar_url').eq('id',id).maybeSingle();if(!p){host.innerHTML='<span class="subtitle">Игрок</span>';return;}host.innerHTML='<img class="mini-avatar" src="'+escapeHtml(p.avatar_url||'')+'" alt="" onerror="this.removeAttribute(\'src\')"><button class="player-profile-link" onclick="openPlayerProfile(\''+p.id+'\')"><strong>'+escapeHtml(p.display_name||p.username)+'</strong><small>@'+escapeHtml(p.username)+'</small></button><button class="btn btn-ghost" onclick="openPlayerProfile(\''+p.id+'\')">Профиль</button>';}
  async function loadChatList(){if(!currentUser||!supabaseClient)return;const host=document.getElementById('chatList');if(!host)return;const {data:rows,error}=await supabaseClient.from('direct_messages').select('sender_id,receiver_id,body,created_at').or('sender_id.eq.'+currentUser.id+',receiver_id.eq.'+currentUser.id).order('created_at',{ascending:false}).limit(200);if(error){host.innerHTML='<p class="subtitle">Не удалось загрузить диалоги.</p>';return;}const latest=new Map();(rows||[]).forEach(m=>{const peer=m.sender_id===currentUser.id?m.receiver_id:m.sender_id;if(!latest.has(peer))latest.set(peer,m);});if(!latest.size){host.innerHTML='<p class="subtitle">Чатов пока нет. Нажми «Новый чат».</p>';return;}const ids=[...latest.keys()],{data:profiles}=await supabaseClient.from('profiles').select('id,username,display_name,avatar_url').in('id',ids),byId=new Map((profiles||[]).map(p=>[p.id,p]));host.innerHTML=ids.map(id=>{const p=byId.get(id)||{},m=latest.get(id),active=document.getElementById('chatRecipient')?.value===id;return '<button class="chat-list-item '+(active?'active':'')+'" onclick="openChatWith(\''+id+'\')"><img class="mini-avatar" src="'+escapeHtml(p.avatar_url||'')+'" alt="" onerror="this.removeAttribute(\'src\')"><span><strong>'+escapeHtml(p.display_name||p.username||'Игрок')+'</strong><small>'+escapeHtml(m.body||'')+'</small></span><time>'+new Date(m.created_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+'</time></button>';}).join('');}
  function filterChatList(){const q=(document.getElementById('chatSearch')?.value||'').toLowerCase();document.querySelectorAll('.chat-list-item').forEach(el=>el.hidden=!el.textContent.toLowerCase().includes(q));}
  let chatSearchTimer;
  async function searchChatPlayers(){clearTimeout(chatSearchTimer);chatSearchTimer=setTimeout(async()=>{const q=(document.getElementById('newChatSearch')?.value||'').trim(),host=document.getElementById('newChatResults');if(!host)return;if(q.length<2){host.innerHTML='<p class="subtitle">Введи не менее 2 символов.</p>';return;}const {data,error}=await supabaseClient.from('profiles').select('id,username,display_name,avatar_url').ilike('username','%'+q.replace(/[%_]/g,'')+'%').neq('id',currentUser.id).limit(8);if(error){host.innerHTML='<p class="subtitle">Не удалось выполнить поиск.</p>';return;}host.innerHTML=(data||[]).map(p=>{const accepted=(accountFriends||[]).some(f=>f.status==='accepted'&&(f.requester_id===p.id||f.addressee_id===p.id));return '<article class="chat-search-result"><img class="mini-avatar" src="'+escapeHtml(p.avatar_url||'')+'" alt="" onerror="this.removeAttribute(\'src\')"><span><strong>'+escapeHtml(p.display_name||p.username)+'</strong><small>@'+escapeHtml(p.username)+'</small></span><button class="btn btn-ghost" onclick="openPlayerProfile(\''+p.id+'\')">Профиль</button>'+(accepted?'<button class="btn btn-primary" onclick="closeModal(\'newChatModal\');openChatWith(\''+p.id+'\')">Написать</button>':'<button class="btn btn-ghost" onclick="addFriend(\''+p.id+'\')">Добавить в друзья</button>')+'</article>';}).join('')||'<p class="subtitle">Ничего не найдено.</p>';},180);}
  async function addFriend(id) {
    if(!currentUser)return requireAccount();
    const {error}=await supabaseClient.from('friendships').insert({requester_id:currentUser.id,addressee_id:id});
    if(error){console.error(error);return showNotification(error.code==='23505'?'Запрос уже существует.':'Не удалось отправить запрос в друзья.');}
    showNotification('Запрос в друзья отправлен.');await loadAccountData();
  }
  async function respondFriend(id,status) {
    const {error}=await supabaseClient.from('friendships').update({status}).eq('id',id).eq('addressee_id',currentUser.id);
    if(error)return showNotification('Не удалось обновить запрос.');
    await loadAccountData();
  }
  async function loadTeamDirectory() {
    if(!supabaseClient)return;
    const gameSelect=document.getElementById('teamDirectoryGame');
    if(gameSelect&&gameSelect.options.length<=1){
      const {data:games}=await supabaseClient.from('games').select('name').eq('is_active',true).order('name');
      gameSelect.innerHTML='<option value="">Все игры</option>'+(games||[]).map(g=>'<option value="'+escapeHtml(g.name)+'">'+escapeHtml(g.name)+'</option>').join('');
    }
    const search=(document.getElementById('teamDirectorySearch')?.value||'').trim();
    let query=supabaseClient.from('teams').select('id,owner_id,name,tag,game_name,region,description,rating,matches_played,wins,is_active').eq('is_active',true).order('rating',{ascending:false}).limit(100);
    const game=gameSelect?.value,region=document.getElementById('teamDirectoryRegion')?.value;
    if(game)query=query.eq('game_name',game);if(region)query=query.eq('region',region);if(search)query=query.or('name.ilike.%'+search.replace(/[^a-zA-Z0-9а-яА-ЯёЁ -]/g,'').replace(/\./g,'')+'%,tag.ilike.%'+search.replace(/[^a-zA-Z0-9а-яА-ЯёЁ -]/g,'').replace(/\./g,'')+'%');
    const [teamResult,memberResult,myMemberResult,requestResult]=await Promise.all([
      query,
      supabaseClient.from('team_members').select('team_id,user_id'),
      currentUser?supabaseClient.from('team_members').select('team_id').eq('user_id',currentUser.id):Promise.resolve({data:[]}),
      currentUser?supabaseClient.from('team_join_requests').select('id,team_id,user_id,message,created_at,teams(name,tag)').eq('status','pending'):Promise.resolve({data:[]})
    ]);
    const el=document.getElementById('teamDirectory'),requestEl=document.getElementById('teamJoinRequests');
    if(teamResult.error){console.error(teamResult.error);if(el)el.innerHTML='<p class="subtitle">Не удалось загрузить команды.</p>';return;}
    const counts=new Map();(memberResult.data||[]).forEach(m=>counts.set(m.team_id,(counts.get(m.team_id)||0)+1));
    const myTeams=new Set((myMemberResult.data||[]).map(m=>m.team_id));
    const ownRequests=(requestResult.data||[]).filter(r=>r.user_id===currentUser?.id);
    const ownedTeams=new Set((teamResult.data||[]).filter(t=>t.owner_id===currentUser?.id).map(t=>t.id));
    const pendingForMyTeams=(requestResult.data||[]).filter(r=>ownedTeams.has(r.team_id));
    const pendingByTeam=new Set(ownRequests.map(r=>r.team_id));
    if(el)el.innerHTML=(teamResult.data||[]).map(t=>'<article class="card"><span class="badge badge-info">'+escapeHtml(t.region)+'</span><h3>'+escapeHtml(t.name)+(t.tag?' <small>['+escapeHtml(t.tag)+']</small>':'')+'</h3><p class="subtitle">'+escapeHtml(t.game_name)+' • '+(counts.get(t.id)||0)+' участников • рейтинг '+fmt(t.rating||0)+'</p><p>'+escapeHtml(t.description||'')+'</p>'+(myTeams.has(t.id)?'<span class="badge badge-info">Ты в составе</span>':pendingByTeam.has(t.id)?'<span class="badge badge-warning">Заявка отправлена</span>':!currentUser?'<button class="btn btn-primary" onclick="requireAccount()">Войди, чтобы подать заявку</button>':'<button class="btn btn-primary" onclick="sendTeamJoinRequest(&quot;'+t.id+'&quot;)">Запросить вступление</button>')+'</article>').join('')||'<p class="subtitle">Команд по этим фильтрам пока нет.</p>';
    if(requestEl)requestEl.innerHTML=pendingForMyTeams.map(r=>'<article class="card"><span class="badge badge-warning">Новая заявка</span><h3>'+escapeHtml(r.teams?.name||'Команда')+'</h3><p>'+escapeHtml(r.message||'Игрок хочет вступить в команду.')+'</p><small class="subtitle">'+new Date(r.created_at).toLocaleString('ru-RU')+'</small><div style="display:flex;gap:8px;margin-top:12px;"><button class="btn btn-primary" onclick="reviewTeamJoinRequest(&quot;'+r.id+'&quot;,&quot;accepted&quot;)">Принять</button><button class="btn btn-ghost" onclick="reviewTeamJoinRequest(&quot;'+r.id+'&quot;,&quot;declined&quot;)">Отклонить</button></div></article>').join('')||ownRequests.map(r=>'<article class="card"><span class="badge badge-warning">Заявка отправлена</span><h3>'+escapeHtml(r.teams?.name||'Команда')+'</h3><p>'+escapeHtml(r.message||'Ожидает решения владельца.')+'</p><button class="btn btn-ghost" onclick="cancelTeamJoinRequest(&quot;'+r.id+'&quot;)">Отозвать</button></article>').join('')||'<p class="subtitle">Новых заявок нет.</p>';
  }
  async function sendTeamJoinRequest(teamId) {
    if(!currentUser)return requireAccount();
    const message=await askInput('Коротко расскажи владельцу, почему хочешь вступить (необязательно):')||'';
    const {error}=await supabaseClient.from('team_join_requests').insert({team_id:teamId,user_id:currentUser.id,message:message.slice(0,500)});
    if(error){console.error(error);return showNotification('Не удалось отправить заявку. Возможно, она уже отправлена.');}
    showNotification('Заявка отправлена владельцу команды.');await loadTeamDirectory();
  }
  async function reviewTeamJoinRequest(id,status) {
    if(!currentUser)return requireAccount();
    const {error}=await supabaseClient.from('team_join_requests').update({status}).eq('id',id).eq('status','pending');
    if(error){console.error(error);return showNotification('Не удалось обработать заявку.');}
    showNotification(status==='accepted'?'Игрок добавлен в команду.':'Заявка отклонена.');
    await loadTeamDirectory();await loadAccountData();
  }
  async function cancelTeamJoinRequest(id) {
    const {error}=await supabaseClient.from('team_join_requests').delete().eq('id',id);
    if(error){console.error(error);return showNotification('Не удалось отозвать заявку.');}
    await loadTeamDirectory();
  }

  async function createTeam() {
    if(!currentUser)return requireAccount();
    const team={owner_id:currentUser.id,name:document.getElementById('teamName').value.trim(),tag:document.getElementById('teamTag').value.trim(),game_name:document.getElementById('teamGame').value,region:document.getElementById('teamRegion').value,description:document.getElementById('teamDescription').value.trim()};
    const {error}=await supabaseClient.from('teams').insert(team);
    if(error){console.error(error);return showNotification('Не удалось создать команду. Проверь название и SQL-схему.');}
    closeModal('createTeamModal');await loadAccountData();showNotification('Команда создана.');
  }
  async function saveAccountSettings() {
    if(!currentUser)return requireAccount();
    const button=document.querySelector('#settings button[onclick*="saveAccountSettings"]');
    if(button?.disabled)return;
    if(button){button.disabled=true;button.dataset.originalHtml=button.innerHTML;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Сохраняю…';}
    try {
      const username=document.getElementById('settingsUsername').value.trim(),displayName=document.getElementById('settingsDisplayName').value.trim();
      if(!/^[a-zA-Z0-9_]{3,24}$/.test(username)){showNotification('Ник: 3–24 символа, латиница, цифры или _.');return;}
      const identityChanged=username!==accountProfile?.username||displayName!==accountProfile?.display_name;
      if(accountProfile?.verified_color&&identityChanged&&!await askConfirm('Изменение имени или ника автоматически снимет значок проверки. Продолжить?'))return;
      let avatar_url=accountProfile?.avatar_url||null;
      const avatarInput=document.getElementById('settingsAvatarFile'),avatarFile=avatarInput?.files?.[0];
      if(avatarFile){
        if(!['image/jpeg','image/png','image/webp','image/gif'].includes(avatarFile.type)||avatarFile.size>5*1024*1024){showNotification('Аватар: JPG, PNG, WEBP или GIF до 5 МБ.');return;}
        const ext=avatarFile.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g,'')||'img',path=currentUser.id+'/avatar-'+crypto.randomUUID()+'.'+ext;
        const {error:uploadError}=await supabaseClient.storage.from('squadra-community').upload(path,avatarFile,{cacheControl:'3600',upsert:false,contentType:avatarFile.type});
        if(uploadError){console.error('Avatar upload failed:',uploadError);showNotification('Не удалось загрузить аватар.');return;}
        avatar_url=supabaseClient.storage.from('squadra-community').getPublicUrl(path).data.publicUrl;
      }
      const p={username,display_name:displayName,bio:document.getElementById('settingsBio').value.trim(),language:document.getElementById('settingsLanguage').value,region:document.getElementById('settingsRegion').value,game_name:document.getElementById('settingsGame').value,avatar_url};
      const st={user_id:currentUser.id,notify_messages:document.getElementById('notifyMessages').checked,notify_team_invites:document.getElementById('notifyTeamInvites').checked,notify_tournaments:document.getElementById('notifyTournaments').checked,notify_marketing:document.getElementById('notifyMarketing').checked,theme:document.getElementById('settingsTheme').value};
      const [a,b]=await Promise.all([supabaseClient.from('profiles').update(p).eq('id',currentUser.id),supabaseClient.from('user_settings').upsert(st)]);
      if(a.error||b.error){console.error('Settings save failed:',a.error||b.error);showNotification(a.error?.code==='23505'?'Этот ник уже занят.':'Настройки не сохранены. Проверь введённые данные.');return;}
      setTheme(st.theme);if(avatarInput)avatarInput.value='';
      const fileName=document.getElementById('avatarFileName');if(fileName)fileName.textContent='Файл не выбран';
      await loadAccountData();showNotification('Профиль и настройки сохранены.');
    } catch(error){console.error('Settings save failed:',error);showNotification('Не удалось сохранить профиль. Проверь соединение и попробуй ещё раз.');}
    finally{if(button){button.disabled=false;button.innerHTML=button.dataset.originalHtml||'<i class="fa-solid fa-floppy-disk"></i> Сохранить профиль';delete button.dataset.originalHtml;}}
  }
  function updateAvatarFileName(input){const name=document.getElementById('avatarFileName');if(name)name.textContent=input?.files?.[0]?.name||'Файл не выбран';}

  function selectCommunityMedia(type) {
    if(!currentUser)return requireAccount();
    const input=document.getElementById('communityMediaFile');
    input.accept=type==='video'?'video/mp4,video/webm':'image/jpeg,image/png,image/webp,image/gif';
    input.click();
  }
  function selectCommunityMediaFile(input) {
    const file=input.files?.[0];if(!file)return;
    const isVideo=file.type.startsWith('video/'),maxSize=isVideo?50*1024*1024:8*1024*1024;
    if((isVideo&&!['video/mp4','video/webm'].includes(file.type))||(!isVideo&&!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))){
      input.value='';return showNotification('Выбери JPG, PNG, WEBP, GIF, MP4 или WEBM.');
    }
    if(file.size>maxSize){input.value='';return showNotification(isVideo?'Видео должно быть до 50 МБ.':'Изображение должно быть до 8 МБ.');}
    communityMediaFile=file;
    const preview=document.getElementById('communityMediaPreview');
    preview.style.display='block';
    preview.innerHTML='<i class="fa-solid '+(isVideo?'fa-video':'fa-image')+'"></i> '+escapeHtml(file.name)+' ('+Math.max(1,Math.round(file.size/1024))+' КБ) <button type="button" class="btn btn-ghost" onclick="clearCommunityMedia()">Убрать</button>';
  }
  function clearCommunityMedia() {
    communityMediaFile=null;
    const input=document.getElementById('communityMediaFile');if(input)input.value='';
    const preview=document.getElementById('communityMediaPreview');if(preview){preview.style.display='none';preview.replaceChildren();}
  }
  async function publishCommunityPost() {
    if(!currentUser)return requireAccount();
    const input=document.getElementById('communityPostBody'),body=input?.value.trim()||'';
    if(!body&&!communityMediaFile)return showNotification('Добавь текст или выбери фото/видео.');
    let media_url=null,media_type=null,mediaPath=null;
    if(communityMediaFile){
      const file=communityMediaFile,safeName=file.name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-80);
      mediaPath=currentUser.id+'/'+Date.now()+'-'+crypto.randomUUID()+'-'+safeName;
      const {error:uploadError}=await supabaseClient.storage.from('squadra-community').upload(mediaPath,file,{cacheControl:'3600',upsert:false,contentType:file.type});
      if(uploadError){console.error('Community media upload failed:',uploadError);return showNotification('Не удалось загрузить файл. Попробуй ещё раз.');}
      media_url=supabaseClient.storage.from('squadra-community').getPublicUrl(mediaPath).data.publicUrl;
      media_type=file.type.startsWith('video/')?'video':'image';
    }
    const {error}=await supabaseClient.from('community_posts').insert({user_id:currentUser.id,body,media_url,media_type});
    if(error){
      if(mediaPath)await supabaseClient.storage.from('squadra-community').remove([mediaPath]);
      console.error(error);return showNotification('Не удалось опубликовать запись.');
    }
    input.value='';clearCommunityMedia();await loadAccountData();
  }
  async function togglePostLike(id,wasLiked) {
    if(!currentUser)return requireAccount();
    const req=wasLiked?supabaseClient.from('community_post_likes').delete().eq('post_id',id).eq('user_id',currentUser.id):supabaseClient.from('community_post_likes').insert({post_id:id,user_id:currentUser.id});
    const {error}=await req;if(error)console.error(error);await loadAccountData();
  }
  async function loadCreatedTournaments() {
    const el=document.getElementById('createdTournamentGrid');
    if(!el||!supabaseClient)return;
    const {data,error}=await supabaseClient.from('tournaments').select('id,name,game_name,status,prize,starts_at,description,participant_limit,owner_id').order('created_at',{ascending:false}).limit(100);
    if(error){console.error('Could not load tournaments:',error);el.innerHTML='<p class="subtitle">Не удалось загрузить турниры.</p>';return;}
    const ids=(data||[]).map(t=>t.id);
    const registrations=ids.length?await supabaseClient.from('tournament_registrations').select('tournament_id,team_id,user_id').in('tournament_id',ids):{data:[]};
    const allTeamIds=[...new Set((registrations.data||[]).map(x=>x.team_id).filter(Boolean))];
    const teamResult=allTeamIds.length?await supabaseClient.from('teams').select('id,name,tag').in('id',allTeamIds):{data:[]};
    const teamMap=new Map((teamResult.data||[]).map(t=>[t.id,t]));
    const registrationCounts=new Map();
    (registrations.data||[]).forEach(x=>registrationCounts.set(x.tournament_id,(registrationCounts.get(x.tournament_id)||0)+1));
    const own= (data||[]).filter(t=>t.owner_id===currentUser?.id).map(t=>'<button class="btn btn-ghost" onclick="generateTournamentBracket(\''+escapeHtml(t.id)+'\')">Сформировать сетку</button>');
    el.innerHTML=(data||[]).map(t=>{
      const count=registrationCounts.get(t.id)||0;
      const myReg=(registrations.data||[]).some(x=>x.tournament_id===t.id&&x.user_id===currentUser?.id);
      const registeredTeams=(registrations.data||[]).filter(x=>x.tournament_id===t.id&&x.team_id).map(x=>teamMap.get(x.team_id)?.name).filter(Boolean);
      return '<article class="card"><span class="badge '+(t.status==='registration'?'badge-warning':'badge-info')+'">'+escapeHtml(t.status==='registration'?'Регистрация':t.status)+'</span><h3 style="margin-top:10px">'+escapeHtml(t.name)+'</h3><p class="subtitle">'+escapeHtml(t.game_name)+(t.participant_limit?' • до '+t.participant_limit+' команд':'')+' • заявок '+count+(t.starts_at?' • '+new Date(t.starts_at).toLocaleString('ru-RU'):'')+'</p>'+(t.prize?'<p><strong style="color:var(--red)">'+escapeHtml(t.prize)+'</strong></p>':'')+(t.description?'<p>'+escapeHtml(t.description)+'</p>':'')+'<p class="subtitle">Команды: '+escapeHtml(registeredTeams.join(', ')||'пока нет команд')+'</p>'+(t.status==='registration'&&!myReg?'<button class="btn btn-primary" data-tournament-id="'+escapeHtml(t.id)+'" onclick="registerForTournament(\''+escapeHtml(t.id)+'\')">Зарегистрировать команду</button>':myReg?'<span class="badge badge-info">Заявка отправлена</span>':'')+' <button class="btn btn-ghost" onclick="loadTournamentBracket(\''+escapeHtml(t.id)+'\')">Сетка и матчи</button>'+(t.owner_id===currentUser?.id?'<button class="btn btn-ghost" onclick="generateTournamentBracket(\''+escapeHtml(t.id)+'\')">Создать сетку</button>':'')+'</article>';
    }).join('')||'<p class="subtitle">Турниров пока нет. Создай первый.</p>';
    const select=document.getElementById('tournamentBracketSelect');
    if(select){const selected=select.value;select.innerHTML='<option value="">Выбери турнир</option>'+(data||[]).map(t=>'<option value="'+escapeHtml(t.id)+'">'+escapeHtml(t.name)+'</option>').join('');if((data||[]).some(t=>t.id===selected))select.value=selected;}
    renderTournamentRegistrations(accountTournamentIds||[]);
  }

  async function generateTournamentBracket(tournamentId) {
    if(!currentUser)return requireAccount();
    const {data:tournament}=await supabaseClient.from('tournaments').select('id,owner_id,participant_limit').eq('id',tournamentId).maybeSingle();
    if(!tournament||tournament.owner_id!==currentUser.id&&!isAdmin)return showNotification('Сетку может создать организатор турнира.');
    const {data:regs,error}=await supabaseClient.from('tournament_registrations').select('team_id').eq('tournament_id',tournamentId).not('team_id','is',null);
    if(error)return showNotification('Не удалось получить список команд.');
    const teamIds=[...new Set((regs||[]).map(r=>r.team_id))];
    if(teamIds.length<2)return showNotification('Для сетки нужны заявки минимум двух команд.');
    if(tournament.participant_limit&&teamIds.length>tournament.participant_limit)return showNotification('Количество заявок превышает лимит турнира.');
    const existing=await supabaseClient.from('tournament_matches').select('id').eq('tournament_id',tournamentId).limit(1);
    if(existing.data?.length&&!await askConfirm('Сетка уже создана. Пересоздать её и удалить результаты?'))return;
    if(existing.data?.length){const del=await supabaseClient.from('tournament_matches').delete().eq('tournament_id',tournamentId);if(del.error)return showNotification('Не удалось пересоздать сетку.');}
    teamIds.sort(()=>Math.random()-.5);
    let slots=1;while(slots<teamIds.length)slots*=2;
    const rows=[];let entrants=Array.from({length:slots},(_,i)=>teamIds[i]||null);
    let round=1,matchCount=Math.ceil(slots/2),roundWinners=[];
    for(let i=0;i<matchCount;i++){
      const teamA=entrants[i*2]||null,teamB=entrants[i*2+1]||null;
      const byeWinner=teamA&&!teamB?teamA:null;
      rows.push({tournament_id:tournamentId,round_number:round,match_number:i+1,team_a_id:teamA,team_b_id:teamB,winner_id:byeWinner,status:byeWinner?'completed':'scheduled'});
      roundWinners.push(byeWinner);
    }
    while(matchCount>1){
      const previousWinners=roundWinners;
      round++;matchCount=Math.ceil(matchCount/2);roundWinners=[];
      for(let i=0;i<matchCount;i++){
        const a=previousWinners[i*2]||null,b=previousWinners[i*2+1]||null;
        const byeWinner=a&&!b?a:null;
        rows.push({tournament_id:tournamentId,round_number:round,match_number:i+1,team_a_id:a,team_b_id:b,winner_id:byeWinner,status:byeWinner?'completed':'scheduled'});
        roundWinners.push(byeWinner);
      }
    }
    const {error:saveError}=await supabaseClient.from('tournament_matches').insert(rows);
    if(saveError){console.error(saveError);return showNotification('Не удалось создать сетку. Проверь права доступа.');}
    showNotification('Турнирная сетка создана.');await loadTournamentBracket(tournamentId);await loadCreatedTournaments();
  }

  async function loadTournamentBracket(tournamentId) {
    const select=document.getElementById('tournamentBracketSelect'),el=document.getElementById('tournamentBracket');
    if(select&&tournamentId)select.value=tournamentId;
    if(!el||!tournamentId)return;
    const {data:matches,error}=await supabaseClient.from('tournament_matches').select('*').eq('tournament_id',tournamentId).order('round_number').order('match_number');
    if(error){console.error(error);el.innerHTML='<p class="subtitle">Не удалось загрузить сетку.</p>';return;}
    if(!matches?.length){el.innerHTML='<p class="subtitle">Сетка ещё не создана организатором.</p>';return;}
    const ids=[...new Set(matches.flatMap(m=>[m.team_a_id,m.team_b_id]).filter(Boolean))];
    const teams=ids.length?await supabaseClient.from('teams').select('id,name,tag').in('id',ids):{data:[]};
    const names=new Map((teams.data||[]).map(t=>[t.id,t.name+(t.tag?' ['+t.tag+']':'')]));
    const canManage=!!currentUser&&(isAdmin||(await supabaseClient.from('tournaments').select('owner_id').eq('id',tournamentId).maybeSingle()).data?.owner_id===currentUser.id);
    const rounds=new Map();matches.forEach(m=>{const list=rounds.get(m.round_number)||[];list.push(m);rounds.set(m.round_number,list);});
    el.innerHTML=[...rounds.entries()].sort((a,b)=>a[0]-b[0]).map(([round,list])=>'<div class="bracket-round"><h3>Раунд '+round+'</h3>'+list.map(m=>{
      const a=m.team_a_id?names.get(m.team_a_id)||'Команда':'Ожидает команду',b=m.team_b_id?names.get(m.team_b_id)||'Команда':'Ожидает команду';
      return '<div class="bracket-match"><div class="team '+(m.winner_id===m.team_a_id?'winner':'')+'">'+escapeHtml(a)+' <span>'+(m.score_a??'')+'</span></div><div class="team '+(m.winner_id===m.team_b_id?'winner':'')+'">'+escapeHtml(b)+' <span>'+(m.score_b??'')+'</span></div>'+(m.starts_at?'<small class="subtitle">Матч: '+new Date(m.starts_at).toLocaleString('ru-RU')+'</small>':'')+(canManage?'<button class="btn btn-ghost" onclick="scheduleTournamentMatch(&quot;'+m.id+'&quot;,&quot;'+tournamentId+'&quot;)">'+(m.starts_at?'Изменить время':'Назначить время')+'</button>':'')+(canManage&&m.team_a_id&&m.team_b_id&&m.status!=='completed'?'<button class="btn btn-ghost" onclick="recordTournamentResult(\''+m.id+'\',\''+tournamentId+'\',\''+m.team_a_id+'\',\''+m.team_b_id+'\',\''+round+'\',\''+m.match_number+'\')">Внести результат</button>':'')+'</div>';
    }).join('')+'</div>').join('');
  }

  async function scheduleTournamentMatch(matchId,tournamentId) {
    if(!currentUser)return requireAccount();
    const value=await askInput('Дата и время матча (например, 2026-11-20T19:30):');
    if(!value)return;
    const date=new Date(value);
    if(Number.isNaN(date.getTime())||date.getTime()<Date.now())return showNotification('Укажи корректную дату в будущем.');
    const {error}=await supabaseClient.from('tournament_matches').update({starts_at:date.toISOString()}).eq('id',matchId);
    if(error){console.error(error);return showNotification('Не удалось назначить время матча.');}
    await loadTournamentBracket(tournamentId);showNotification('Время матча сохранено.');
  }

  async function recordTournamentResult(matchId,tournamentId,teamA,teamB,round,matchNumber) {
    if(!currentUser)return requireAccount();
    const scoreA=Number(await askInput('Счёт команды 1 (неотрицательное целое):'));
    if(!Number.isInteger(scoreA)||scoreA<0)return;
    const scoreB=Number(await askInput('Счёт команды 2 (неотрицательное целое):'));
    if(!Number.isInteger(scoreB)||scoreB<0||scoreA===scoreB)return showNotification('Матч должен иметь победителя и целый счёт.');
    const winner=scoreA>scoreB?teamA:teamB;
    const {error}=await supabaseClient.from('tournament_matches').update({score_a:scoreA,score_b:scoreB,winner_id:winner,status:'completed'}).eq('id',matchId);
    if(error){console.error(error);return showNotification('Не удалось сохранить результат.');}
    const nextRound=Number(round)+1,nextNumber=Math.ceil(Number(matchNumber)/2),slot=Number(matchNumber)%2===1?'team_a_id':'team_b_id';
    const next=await supabaseClient.from('tournament_matches').select('id,team_a_id,team_b_id').eq('tournament_id',tournamentId).eq('round_number',nextRound).eq('match_number',nextNumber).maybeSingle();
    if(next.data&&!next.data.team_a_id&&!next.data.team_b_id){
      await supabaseClient.from('tournament_matches').update({[slot]:winner}).eq('id',next.data.id);
    } else if(next.data&&!next.data[slot]) {
      await supabaseClient.from('tournament_matches').update({[slot]:winner}).eq('id',next.data.id);
    }
    showNotification('Результат сохранён, победитель прошёл дальше.');await loadTournamentBracket(tournamentId);
  }
  async function createTournament() {
    if(!currentUser)return requireAccount();
    const name=document.getElementById('tournamentName').value.trim();
    const limit=Number(document.getElementById('tournamentLimit').value);
    if(name.length<3)return showNotification('Название турнира должно содержать минимум 3 символа.');
    if(!Number.isInteger(limit)||limit<2||limit>256)return showNotification('Укажи от 2 до 256 команд.');
    const starts=document.getElementById('tournamentStarts').value;
    const payload={id:'user-'+crypto.randomUUID(),owner_id:currentUser.id,name,game_name:document.getElementById('tournamentGame').value,status:'registration',prize:document.getElementById('tournamentPrize').value.trim(),description:document.getElementById('tournamentDescription').value.trim(),participant_limit:limit,starts_at:starts?new Date(starts).toISOString():null};
    const {error}=await supabaseClient.from('tournaments').insert(payload);
    if(error){console.error('Could not create tournament:',error);return showNotification('Не удалось создать турнир. Проверь заполнение и права доступа.');}
    closeModal('createTournamentModal');document.getElementById('tournamentName').value='';document.getElementById('tournamentDescription').value='';
    await loadCreatedTournaments();showNotification('Турнир создан и опубликован.');
  }
  async function loadCommunityGroups() {
    const el=document.getElementById('communityGroups');if(!el||!supabaseClient||!currentUser)return;
    const [groupsResult,membersResult,gamesResult]=await Promise.all([
      supabaseClient.from('community_groups').select('id,name,game_name,description,owner_id').order('name'),
      supabaseClient.from('community_group_members').select('group_id,user_id'),
      supabaseClient.from('games').select('name').eq('is_active',true).order('name')
    ]);
    if(groupsResult.error||membersResult.error){console.error('Could not load groups:',groupsResult.error||membersResult.error);el.innerHTML='<p class="subtitle">Не удалось загрузить группы.</p>';return;}
    const gameSelect=document.getElementById('communityGroupGame');
    if(gameSelect){const selected=gameSelect.value;gameSelect.innerHTML='<option value="">Выбери игру</option>'+(gamesResult.data||[]).map(g=>'<option>'+escapeHtml(g.name)+'</option>').join('');if(selected)gameSelect.value=selected;}
    const members=membersResult.data||[];
    el.innerHTML=(groupsResult.data||[]).map(g=>{
      const joined=members.some(m=>m.group_id===g.id&&m.user_id===currentUser.id),count=members.filter(m=>m.group_id===g.id).length,owner=g.owner_id===currentUser.id;
      return '<div class="list-divider friend-row"><div><strong>'+escapeHtml(g.name)+'</strong><div style="font-size:12px;color:var(--muted)">'+escapeHtml(g.game_name)+' • '+count+' участников</div><small class="subtitle">'+escapeHtml(g.description||'')+'</small></div><div><button class="btn '+(joined?'btn-primary':'btn-ghost')+'" style="padding:6px 12px;font-size:11px" onclick="toggleCommunityGroup(&quot;'+escapeHtml(g.id)+'&quot;,'+joined+')">'+(joined?'В группе':'Вступить')+'</button>'+(joined?'<button class="btn btn-ghost" style="padding:6px 12px;font-size:11px" onclick="openGroupChat(&quot;'+escapeHtml(g.id)+'&quot;)">Чат</button>':'')+(owner?'<button class="btn btn-ghost" style="padding:6px 12px;font-size:11px" onclick="editCommunityGroup(&quot;'+escapeHtml(g.id)+'&quot;)">Изменить</button><button class="btn btn-ghost" style="padding:6px 12px;font-size:11px" onclick="deleteCommunityGroup(&quot;'+escapeHtml(g.id)+'&quot;)">Удалить</button>':'')+'</div><div id="group-chat-'+escapeHtml(g.id)+'"></div></div>';
    }).join('')||'<p class="subtitle">Групп пока нет. Создай первую.</p>';
  }
  async function createCommunityGroup() {
    if(!currentUser)return requireAccount();
    const name=document.getElementById('communityGroupName').value.trim(),game=document.getElementById('communityGroupGame').value;
    if(name.length<3||!game)return showNotification('Укажи название и игру.');
    const id='group-'+crypto.randomUUID();
    const {error}=await supabaseClient.from('community_groups').insert({id,name,game_name:game,description:document.getElementById('communityGroupDescription').value.trim(),owner_id:currentUser.id});
    if(error){console.error(error);return showNotification('Не удалось создать группу.');}
    document.getElementById('communityGroupName').value='';document.getElementById('communityGroupDescription').value='';
    showNotification('Группа создана.');await loadCommunityGroups();
  }
  async function editCommunityGroup(id) {
    const name=await askInput('Новое название группы:');if(name===null)return;
    if(name.trim().length<3)return showNotification('Название должно содержать минимум 3 символа.');
    const description=await askInput('Новое описание группы:')||'';
    const {error}=await supabaseClient.from('community_groups').update({name:name.trim().slice(0,80),description:description.slice(0,300)}).eq('id',id).eq('owner_id',currentUser.id);
    if(error){console.error(error);return showNotification('Не удалось изменить группу.');}
    await loadCommunityGroups();showNotification('Группа обновлена.');
  }
  async function deleteCommunityGroup(id) {
    if(!currentUser||!await askConfirm('Удалить группу и её историю сообщений?'))return;
    const {error}=await supabaseClient.from('community_groups').delete().eq('id',id).eq('owner_id',currentUser.id);
    if(error){console.error(error);return showNotification('Не удалось удалить группу.');}
    await loadCommunityGroups();showNotification('Группа удалена.');
  }

  async function toggleCommunityGroup(groupId,joined) {
    if(!currentUser)return requireAccount();
    const request=joined
      ?supabaseClient.from('community_group_members').delete().eq('group_id',groupId).eq('user_id',currentUser.id)
      :supabaseClient.from('community_group_members').insert({group_id:groupId,user_id:currentUser.id});
    const {error}=await request;
    if(error){console.error('Could not update group membership:',error);return showNotification('Не удалось изменить участие в группе.');}
    await loadCommunityGroups();
  }

  async function registerForTournament(id) {
    if(!currentUser)return requireAccount();
    const {data:tournament,error}=await supabaseClient.from('tournaments').select('id,name,game_name,status').eq('id',id).maybeSingle();
    if(error||!tournament)return showNotification('Не удалось открыть регистрацию.');
    if(tournament.status!=='registration')return showNotification('Регистрация на этот турнир закрыта.');
    const {data:members,error:memberError}=await supabaseClient.from('team_members').select('team_id,teams(id,name,tag,game_name)').eq('user_id',currentUser.id);
    if(memberError){console.error(memberError);return showNotification('Не удалось загрузить твои команды.');}
    const teams=(members||[]).map(m=>m.teams).filter(t=>t&&t.game_name===tournament.game_name);
    if(!teams.length)return showNotification('Сначала создай команду или вступи в команду по игре '+tournament.game_name+'.');
    pendingTournamentId=id;
    const label=document.getElementById('tournamentRegistrationLabel');if(label)label.textContent=tournament.name+' • '+tournament.game_name;
    const select=document.getElementById('tournamentTeamSelect');
    if(select)select.innerHTML=teams.map(t=>'<option value="'+escapeHtml(t.id)+'">'+escapeHtml(t.name+(t.tag?' ['+t.tag+']':''))+'</option>').join('');
    openModal('tournamentRegistrationModal');
  }
  async function confirmTournamentRegistration() {
    if(!currentUser||!pendingTournamentId)return requireAccount();
    const teamId=document.getElementById('tournamentTeamSelect')?.value;
    if(!teamId)return showNotification('Выбери команду.');
    const {error}=await supabaseClient.from('tournament_registrations').insert({tournament_id:pendingTournamentId,user_id:currentUser.id,team_id:teamId});
    if(error){console.error(error);return showNotification('Не удалось зарегистрировать команду. Возможно, заявка уже отправлена.');}
    const id=pendingTournamentId;pendingTournamentId=null;closeModal('tournamentRegistrationModal');
    showNotification('Заявка команды отправлена.');await loadAccountData();await loadTournamentBracket(id);
  }
  function renderTournamentRegistrations(ids) {
    const map={'squadra-cup':'Squadra Cup','winter-league':'Winter League','spring-championship':'Spring Championship'};
    document.querySelectorAll('[data-tournament-id]').forEach(b=>{const on=ids.includes(b.dataset.tournamentId);b.disabled=on;b.textContent=on?'Вы зарегистрированы':'Участвовать';});
  }
function notificationIcon(k){return({message:'fa-comment-dots',team_invite:'fa-people-group',group_message:'fa-comments',follow:'fa-user-plus',friend:'fa-user-group',comment:'fa-comment',match_confirmation:'fa-flag-checkered',match:'fa-chart-line',team_match_result:'fa-ranking-star'}[k]||'fa-bell');}
  async function openNotification(id){const n=accountNotifications.find(x=>x.id===id);if(!n)return;await markNotificationRead(id);if(n.source_type==='message'&&n.actor_id)return openChatWith(n.actor_id);if(n.source_type==='group'&&n.source_id)return openGroupChat(n.source_id);if(n.source_type==='player'&&(n.actor_id||n.source_id))return openPlayerProfile(n.actor_id||n.source_id);if(n.source_type==='team'){showSection('teams');return;}if(n.source_type==='post'){showSection('community');if(n.source_id)setTimeout(()=>document.getElementById('community-post-'+n.source_id)?.scrollIntoView({behavior:'smooth',block:'center'}),250);return;}if(n.source_type==='match'){showSection('history');if(n.source_id)setTimeout(()=>document.getElementById('activity-'+n.source_id)?.scrollIntoView({behavior:'smooth',block:'center'}),250);return;}showSection(({message:'messages',team_invite:'teams',group_message:'community',follow:'players',friend:'friends',comment:'community',match_confirmation:'history',match:'history',team_match_result:'teams'}[n.kind]||'notifications'));}
  function renderNotifications(rows) {
    const unread=rows.filter(n=>!n.read_at).length,badge=document.getElementById('notificationCount');
    if(badge){badge.textContent=unread?String(unread):'';badge.hidden=!unread;}
    const list=document.getElementById('notificationsList');
    if(list)list.innerHTML=rows.map(n=>'<article class="card notification-card '+(n.read_at?'is-read':'')+'" onclick="openNotification(\''+n.id+'\')"><div class="notification-icon"><i class="fa-solid '+notificationIcon(n.source_type||n.kind)+'"></i></div><div class="notification-copy"><p>'+escapeHtml(n.body||'У тебя новое обновление.')+'</p><small class="subtitle">'+new Date(n.created_at).toLocaleString('ru-RU')+'</small></div><button class="btn btn-ghost" onclick="event.stopPropagation();markNotificationRead(\''+n.id+'\')">'+(n.read_at?'Открыть':'Прочитано')+'</button></article>').join('')||'<div class="empty-state"><i class="fa-regular fa-bell-slash"></i><p>Новых уведомлений пока нет.</p></div>';
  }
  async function markNotificationRead(id) {
    const {error}=await supabaseClient.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('user_id',currentUser.id);
    if(error){console.error(error);return showNotification('Не удалось отметить уведомление.');}
    await loadAccountData();
  }

  async function loadGameCatalog() {
    if(!supabaseClient)return;
    const {data,error}=await supabaseClient.from('games').select('id,name,genre,sort_order').eq('is_active',true).order('sort_order');
    if(error){console.error('Game catalog:',error);return;}
    if(!data?.length)return;
    const old=new Map(games.map(g=>[g.name,g]));
    const {data:profiles}=currentUser?await supabaseClient.from('profiles').select('game_name'):{data:[]};
    const counts=new Map();(profiles||[]).forEach(p=>counts.set(p.game_name,(counts.get(p.game_name)||0)+1));
    games=data.map(g=>({...old.get(g.name),id:g.id,name:g.name,genre:g.genre,sort_order:g.sort_order,playerCount:counts.get(g.name)||0}));
    const populate=(id,allowAny,fallback)=>{
      const el=document.getElementById(id);if(!el)return;
      const selected=el.value, options=games.map(g=>'<option value="'+escapeHtml(g.name)+'">'+escapeHtml(g.name)+'</option>').join('');
      el.innerHTML=(allowAny?'<option value="">'+(id==='plGame'?'Любая':'Выбери игру')+'</option>':'')+options;
      const next=selected&&games.some(g=>g.name===selected)?selected:fallback&&games.some(g=>g.name===fallback)?fallback:allowAny?'':'';
      el.value=next;
    };
    const genres=[...new Set(games.map(g=>g.genre).filter(Boolean))],genreSelect=document.getElementById('gameGenre'),genreValue=genreSelect?.value||'';
    if(genreSelect)genreSelect.innerHTML='<option value="">Все жанры</option>'+genres.map(g=>'<option value="'+escapeHtml(g)+'">'+escapeHtml(g)+'</option>').join('');
    if(genreSelect&&genres.includes(genreValue))genreSelect.value=genreValue;
    populate('settingsGame',false,accountProfile?.game_name||'CS2');
    populate('mmGame',false,accountMatchmakingPrefs?.game_name||accountProfile?.game_name||'CS2');
    populate('plGame',true,'');
    renderGames();renderLibrary(accountLibrary,accountGameStats);
    const home=document.getElementById('homeGames');if(home)home.innerHTML=games.slice(0,4).map(gameCard).join('');
  }

  async function loadHomeTournaments() {
    const el=document.getElementById('homeTournaments');if(!el||!supabaseClient)return;
    const {data,error}=await supabaseClient.from('tournaments').select('id,name,game_name,status,prize,starts_at,participant_limit').order('starts_at',{ascending:true,nullsFirst:false}).limit(2);
    if(error){console.error('Home tournaments:',error);el.innerHTML='<p class="subtitle">Не удалось загрузить турниры.</p>';return;}
    el.innerHTML=(data||[]).map(t=>'<article class="card"><span class="badge '+(t.status==='live'?'badge-danger':'badge-warning')+'">'+escapeHtml(t.status)+'</span><h3 style="margin-top:10px">'+escapeHtml(t.name)+'</h3><p class="subtitle">'+escapeHtml(t.game_name)+(t.participant_limit?' • до '+t.participant_limit+' команд':'')+(t.starts_at?' • '+new Date(t.starts_at).toLocaleDateString('ru-RU'):'')+'</p>'+(t.prize?'<p><strong>'+escapeHtml(t.prize)+'</strong></p>':'')+'<button class="btn btn-ghost" onclick="showSection(\'tournaments\')">Подробнее</button></article>').join('')||'<p class="subtitle">Опубликованных турниров пока нет.</p>';
  }

  async function loadSeason() {
    const {data,error}=await supabaseClient.from('seasons').select('name,starts_at,ends_at,status').eq('status','active').order('starts_at',{ascending:false}).limit(1).maybeSingle();
    if(error){console.error('Season:',error);return;}
    const title=document.getElementById('currentSeasonName'),dates=document.getElementById('currentSeasonDates');
    if(title)title.textContent=data?.name||'Активный сезон не задан';
    if(dates&&data)dates.textContent=' • '+new Date(data.starts_at).toLocaleDateString('ru-RU')+' — '+new Date(data.ends_at).toLocaleDateString('ru-RU');
  }

  async function loadLeaderboards() {
    if(!supabaseClient)return;
    const [players,teams,stats,gamesResult]=await Promise.all([
      supabaseClient.from('profiles').select('id,username,display_name,game_name,rank_name,rating,matches_played,wins,level,verified_color').order('rating',{ascending:false}).limit(100),
      supabaseClient.from('teams').select('id,name,tag,game_name,region,rating,matches_played,wins').order('rating',{ascending:false}).limit(100),
      supabaseClient.from('player_game_stats').select('user_id,game_id,rating,matches_played,wins').gt('matches_played',0),
      supabaseClient.from('games').select('id,name,genre').eq('is_active',true).order('sort_order')
    ]);
    if(players.error||teams.error||stats.error||gamesResult.error){console.error('Leaderboard load failed:',players.error||teams.error||stats.error||gamesResult.error);showNotification('Не удалось загрузить таблицу лидеров.');return;}
    const roleRows=players.data?.length?await supabaseClient.from('user_roles').select('user_id,role').in('user_id',players.data.map(p=>p.id)).in('role',['admin','moderator']):{data:[]},roleMap=new Map();
    (roleRows.data||[]).forEach(r=>roleMap.set(r.user_id,[...(roleMap.get(r.user_id)||[]),r.role]));
    const playerBody=document.getElementById('rankPlayersBody');
    if(playerBody)playerBody.innerHTML=(players.data||[]).map((p,i)=>{const role=(roleMap.get(p.id)||[]).includes('admin')?'<span class="staff-badge admin">Администратор</span>':(roleMap.get(p.id)||[]).includes('moderator')?'<span class="staff-badge moderator">Модератор</span>':'';const verify=p.verified_color?'<i class="fa-solid fa-circle-check verified-badge '+p.verified_color+'"></i>':'';return '<tr><td class="rank-pos">'+String(i+1).padStart(2,'0')+'</td><td><button class="player-profile-link" onclick="openPlayerProfile(\''+p.id+'\')"><strong>'+escapeHtml(p.display_name||p.username)+'</strong>'+verify+' '+role+'</button></td><td>'+escapeHtml(p.rank_name||'Unranked')+'</td><td>'+fmt(p.rating||0)+'</td><td>'+fmt(p.matches_played||0)+'</td><td>'+(p.matches_played?Math.round(p.wins*100/p.matches_played):0)+'%</td><td>'+escapeHtml(p.game_name||'—')+'</td></tr>';}).join('')||'<tr><td colspan="7" class="subtitle">Пока нет игроков.</td></tr>';
    const teamBody=document.getElementById('rankTeamsBody');
    if(teamBody)teamBody.innerHTML=(teams.data||[]).map((t,i)=>'<tr><td>'+String(i+1).padStart(2,'0')+'</td><td><strong>'+escapeHtml(t.name)+' '+escapeHtml(t.tag||'')+'</strong></td><td>'+escapeHtml(t.game_name)+'</td><td>'+fmt(t.rating||0)+'</td><td>'+fmt(t.matches_played||0)+'</td><td>'+(t.matches_played?Math.round(t.wins*100/t.matches_played):0)+'%</td><td>'+escapeHtml(t.region||'—')+'</td></tr>').join('')||'<tr><td colspan="7" class="subtitle">Пока нет команд.</td></tr>';
    const gameBody=document.getElementById('rankGamesBody'),gameMap=new Map((gamesResult.data||[]).map(g=>[g.id,g])),playersById=new Map((players.data||[]).map(p=>[p.id,p]));
    if(gameBody)gameBody.innerHTML=(gamesResult.data||[]).map(g=>{const top=(stats.data||[]).filter(r=>r.game_id===g.id).sort((a,b)=>b.rating-a.rating).slice(0,10),rows=top.map((r,i)=>{const p=playersById.get(r.user_id);return '<tr><td class="rank-pos">'+String(i+1).padStart(2,'0')+'</td><td><button class="player-profile-link" onclick="openPlayerProfile(\''+r.user_id+'\')">'+escapeHtml(p?.display_name||p?.username||'Игрок')+'</button></td><td>'+fmt(r.rating||0)+'</td><td>'+fmt(r.matches_played||0)+'</td><td>'+(r.matches_played?Math.round(r.wins*100/r.matches_played):0)+'%</td></tr>';}).join('');return '<article class="card game-leaderboard-card"><h3>'+escapeHtml(g.name)+' <small class="subtitle">'+escapeHtml(g.genre||'')+'</small></h3><div class="table-scroll"><table><thead><tr><th>#</th><th>Игрок</th><th>Рейтинг</th><th>Матчей</th><th>Побед</th></tr></thead><tbody>'+ (rows||'<tr><td colspan="5" class="subtitle">Нет подтверждённых матчей по этой игре.</td></tr>')+'</tbody></table></div></article>';}).join('')||'<p class="subtitle">Игры не опубликованы.</p>';
    await loadSeason();
  }

  async function toggleFollow(userId) {
    if(!currentUser)return requireAccount();
    const {data:existing,error:readError}=await supabaseClient.from('user_follows').select('follower_id').eq('follower_id',currentUser.id).eq('following_id',userId).maybeSingle();
    if(readError)return showNotification('Не удалось проверить подписку.');
    const result=existing?await supabaseClient.from('user_follows').delete().eq('follower_id',currentUser.id).eq('following_id',userId):await supabaseClient.from('user_follows').insert({follower_id:currentUser.id,following_id:userId});
    if(result.error){console.error(result.error);return showNotification('Не удалось обновить подписку.');}
    showNotification(existing?'Ты перестал следить за публикациями игрока.':'Новые публикации игрока появятся в ленте «Подписки».');await loadAccountData();
  }

  async function addPostComment(postId) {
    if(!currentUser)return requireAccount();
    const field=document.getElementById('comment-'+postId),body=field?.value.trim();
    if(!body)return;
    const {error}=await supabaseClient.from('community_post_comments').insert({post_id:postId,user_id:currentUser.id,body});
    if(error){console.error(error);return showNotification('Не удалось отправить комментарий.');}
    await loadAccountData();
  }

  async function reportCommunityPost(postId,userId) {
    if(!currentUser)return requireAccount();
    const reason=await askInput('Причина жалобы: spam, abuse, cheating или other','other');
    if(!reason)return;
    const normalized=reason.trim().toLowerCase();
    if(!['spam','abuse','cheating','other'].includes(normalized))return showNotification('Укажи spam, abuse, cheating или other.');
    const details=await askInput('Подробности (необязательно):','')||'';
    const {error}=await supabaseClient.from('community_reports').insert({reporter_id:currentUser.id,post_id:postId,reported_user_id:userId,reason:normalized,details});
    if(error){console.error(error);return showNotification('Не удалось отправить жалобу.');}
    showNotification('Жалоба передана модераторам.');
  }

  async function reviewCommunityReport(reportId,status) {
    if(!isModerator)return;
    const {error}=await supabaseClient.from('community_reports').update({status,reviewed_by:currentUser.id,reviewed_at:new Date().toISOString()}).eq('id',reportId);
    if(error){console.error(error);return showNotification('Не удалось обновить статус жалобы.');}
    await loadAdminPanel();
  }

  async function loadPlatformEvents() {
    const el=document.getElementById('eventsGrid');if(!el||!supabaseClient)return;
    const [ev,tr]=await Promise.all([
      supabaseClient.from('platform_events').select('id,owner_id,title,event_type,game_id,starts_at,description,registration_limit').order('starts_at'),
      supabaseClient.from('tournaments').select('id,name,game_name,status,starts_at,prize,description').order('starts_at',{ascending:true,nullsFirst:false})
    ]);
    if(ev.error)console.error(ev.error);
    const games=await supabaseClient.from('games').select('id,name').eq('is_active',true).order('name');
    const names=new Map((games.data||[]).map(g=>[g.id,g.name]));
    const select=document.getElementById('platformEventGame');
    if(select){const old=select.value;select.innerHTML='<option value="">Без привязки к игре</option>'+(games.data||[]).map(g=>'<option value="'+escapeHtml(g.id)+'">'+escapeHtml(g.name)+'</option>').join('');select.value=old;}
    const rows=ev.data||[],ids=rows.map(e=>e.id);
    const regs=currentUser&&ids.length?await supabaseClient.from('platform_event_registrations').select('event_id,user_id').in('event_id',ids):{data:[]};
    const counts=new Map(),mine=new Set();(regs.data||[]).forEach(x=>{counts.set(x.event_id,(counts.get(x.event_id)||0)+1);if(x.user_id===currentUser?.id)mine.add(x.event_id);});
    const list=[...rows.map(e=>({...e,_event:true})),...(tr.data||[]).map(t=>({...t,_tournament:true}))].sort((x,y)=>new Date(x.starts_at||0)-new Date(y.starts_at||0));
    el.innerHTML=list.map(e=>{
      if(e._event){
        const count=counts.get(e.id)||0,full=e.registration_limit&&count>=e.registration_limit,joined=mine.has(e.id);
        return '<article class="card"><span class="badge badge-info">'+escapeHtml(({event:'Событие',championship:'Чемпионат',league:'Лига',meetup:'Встреча'})[e.event_type]||'Событие')+'</span><h3>'+escapeHtml(e.title)+'</h3><p class="subtitle">'+escapeHtml(names.get(e.game_id)||'Все игры')+' • '+new Date(e.starts_at).toLocaleString('ru-RU')+' • '+count+(e.registration_limit?'/'+e.registration_limit:'')+' участников</p><p>'+escapeHtml(e.description||'')+'</p>'+(currentUser?(joined?'<button class="btn btn-ghost" onclick="togglePlatformEventRegistration(&quot;'+e.id+'&quot;,true)">Отменить участие</button>':!full?'<button class="btn btn-primary" onclick="togglePlatformEventRegistration(&quot;'+e.id+'&quot;,false)">Участвовать</button>':'<span class="badge badge-warning">Мест нет</span>'):'<button class="btn btn-primary" onclick="requireAccount()">Войти для участия</button>')+((e.owner_id===currentUser?.id||isAdmin)?'<button class="btn btn-ghost" onclick="deletePlatformEvent(&quot;'+e.id+'&quot;)">Удалить</button>':'')+'</article>';
      }
      return '<article class="card"><span class="badge badge-warning">'+escapeHtml(e.status)+'</span><h3>'+escapeHtml(e.name)+'</h3><p class="subtitle">'+escapeHtml(e.game_name)+' • '+(e.starts_at?new Date(e.starts_at).toLocaleString('ru-RU'):'дата не задана')+'</p>'+(e.description?'<p>'+escapeHtml(e.description)+'</p>':'')+(e.prize?'<strong>'+escapeHtml(e.prize)+'</strong>':'')+(e.status==='registration'?'<button class="btn btn-primary" onclick="registerForTournament(&quot;'+escapeHtml(e.id)+'&quot;)">Записаться в турнир</button>':'')+'</article>';
    }).join('')||'<p class="subtitle">Событий пока нет. Создай первое.</p>';
  }
  async function createPlatformEvent() {
    if(!currentUser)return requireAccount();
    const title=document.getElementById('platformEventTitle').value.trim(),starts=document.getElementById('platformEventStarts').value;
    if(title.length<3||!starts)return showNotification('Укажи название и дату события.');
    const raw=document.getElementById('platformEventLimit').value.trim(),limit=raw?Number(raw):null;
    if(limit!==null&&(!Number.isInteger(limit)||limit<2||limit>10000))return showNotification('Лимит должен быть от 2 до 10 000.');
    const {error}=await supabaseClient.from('platform_events').insert({owner_id:currentUser.id,title,event_type:document.getElementById('platformEventType').value,game_id:document.getElementById('platformEventGame').value||null,starts_at:new Date(starts).toISOString(),registration_limit:limit,description:document.getElementById('platformEventDescription').value.trim()});
    if(error){console.error(error);return showNotification('Не удалось создать событие.');}
    closeModal('createEventModal');showNotification('Событие опубликовано.');await loadPlatformEvents();
  }
  async function togglePlatformEventRegistration(eventId,isRegistered) {
    if(!currentUser)return requireAccount();
    const request=isRegistered?supabaseClient.from('platform_event_registrations').delete().eq('event_id',eventId).eq('user_id',currentUser.id):supabaseClient.from('platform_event_registrations').insert({event_id:eventId,user_id:currentUser.id});
    const {error}=await request;if(error){console.error(error);return showNotification(error.message?.includes('full')?'Все места заняты.':'Не удалось изменить регистрацию.');}
    showNotification(isRegistered?'Участие отменено.':'Ты зарегистрирован.');await loadPlatformEvents();
  }
  async function deletePlatformEvent(eventId) {
    if(!currentUser||!await askConfirm('Удалить событие?'))return;
    const {error}=await supabaseClient.from('platform_events').delete().eq('id',eventId);
    if(error){console.error(error);return showNotification('Не удалось удалить событие.');}
    await loadPlatformEvents();showNotification('Событие удалено.');
  }

  async function loadPendingMatches() {
    const el=document.getElementById('pendingMatches');if(!el||!currentUser)return;
    const {data,error}=await supabaseClient.from('matches').select('id,game_id,player_a_id,player_b_id,created_by,played_at,status').eq('status','pending').or('player_a_id.eq.'+currentUser.id+',player_b_id.eq.'+currentUser.id).order('created_at',{ascending:false});
    if(error){console.error(error);el.innerHTML='<p class="subtitle">Не удалось загрузить матчи.</p>';return;}
    const ids=[...new Set((data||[]).flatMap(m=>[m.player_a_id,m.player_b_id]))];
    const [profiles,gamesResult]=await Promise.all([ids.length?supabaseClient.from('profiles').select('id,username,display_name').in('id',ids):{data:[]},supabaseClient.from('games').select('id,name')]);
    const names=new Map((profiles.data||[]).map(p=>[p.id,p.display_name||p.username]));
    const gameNames=new Map((gamesResult.data||[]).map(g=>[g.id,g.name]));
    el.innerHTML=(data||[]).map(m=>{const other=m.player_a_id===currentUser.id?m.player_b_id:m.player_a_id;return '<article class="card"><strong>'+escapeHtml(names.get(other)||'Игрок')+'</strong><p class="subtitle">'+escapeHtml(gameNames.get(m.game_id)||m.game_id)+' • '+new Date(m.played_at).toLocaleString('ru-RU')+'</p>'+(m.created_by===currentUser.id?'<span class="badge badge-warning">Ожидает подтверждения соперника</span>':'<label>Счёт с твоей стороны, например 13-8</label><input id="match-score-'+m.id+'" maxlength="7" placeholder="13-8"><button class="btn btn-primary" onclick="confirmMatchResult(\''+m.id+'\')">Подтвердить</button><button class="btn btn-ghost" onclick="rejectMatch(\''+m.id+'\')">Отклонить</button>')+'</article>';}).join('')||'<p class="subtitle">Нет матчей, ожидающих подтверждения.</p>';
  }

  async function reportMatch(opponentId,gameName) {
    if(!currentUser)return requireAccount();
    gameName=gameName||accountProfile?.game_name||'CS2';const score=await askInput('Введи итоговый счёт со своей стороны, например 13-8');
    if(!score)return;
    const pieces=score.split(/[-:]/).map(Number);
    if(pieces.length!==2||pieces.some(n=>!Number.isInteger(n)||n<0)||pieces[0]===pieces[1])return showNotification('Счёт должен быть целым и не равным, например 13-8.');
    const {data:game}=await supabaseClient.from('games').select('id').eq('name',gameName).maybeSingle();
    if(!game)return showNotification('Эта игра ещё не добавлена в каталог.');
    const {error}=await supabaseClient.from('matches').insert({game_id:game.id,player_a_id:currentUser.id,player_b_id:opponentId,created_by:currentUser.id,score_a:pieces[0],score_b:pieces[1],winner_id:pieces[0]>pieces[1]?currentUser.id:opponentId});
    if(error){console.error(error);return showNotification('Не удалось отправить результат.');}
    showNotification('Заявка отправлена. Соперник должен подтвердить счёт.');
    await loadPendingMatches();
  }

  async function confirmMatchResult(id) {
    if(!currentUser)return;
    const value=document.getElementById('match-score-'+id)?.value||'',parts=value.split(/[-:]/).map(Number);
    if(parts.length!==2||parts.some(n=>!Number.isInteger(n)||n<0)||parts[0]===parts[1])return showNotification('Проверь счёт, например 13-8.');
    const {error}=await supabaseClient.rpc('confirm_player_match',{p_match_id:id,p_score_for_me:parts[0],p_score_for_opponent:parts[1]});
    if(error){console.error(error);return showNotification('Не удалось подтвердить результат.');}
    showNotification('Матч подтверждён, рейтинг обновлён.');
    await Promise.all([loadAccountData(),loadPendingMatches(),loadLeaderboards()]);
  }

  async function rejectMatch(id) {
    if(!currentUser)return;
    const {error}=await supabaseClient.rpc('reject_player_match',{p_match_id:id});
    if(error){console.error(error);return showNotification('Не удалось отклонить результат.');}
    await loadPendingMatches();
  }

  function setupRealtime() {
    if(!supabaseClient||!currentUser)return;
    if(realtimeChannel)supabaseClient.removeChannel(realtimeChannel);
    const uid=currentUser.id;
    realtimeChannel=supabaseClient.channel('squadra-live-'+uid)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'direct_messages',filter:'receiver_id=eq.'+uid},()=>{loadDirectMessages();loadChatList();})
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'direct_messages',filter:'sender_id=eq.'+uid},()=>{loadDirectMessages();loadChatList();})
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'direct_messages',filter:'receiver_id=eq.'+uid},()=>loadDirectMessages())
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'friendships',filter:'requester_id=eq.'+uid},()=>loadAccountData())
       .on('postgres_changes',{event:'INSERT',schema:'public',table:'friendships',filter:'addressee_id=eq.'+uid},()=>loadAccountData())
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'friendships',filter:'requester_id=eq.'+uid},()=>loadAccountData())
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'friendships',filter:'addressee_id=eq.'+uid},()=>loadAccountData())
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:'player_a_id=eq.'+uid},()=>{loadPendingMatches();loadAccountData();})
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:'player_b_id=eq.'+uid},()=>{loadPendingMatches();loadAccountData();})
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'community_posts'},()=>{if(document.getElementById('community')?.classList.contains('active'))loadAccountData();})
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'community_post_comments'},()=>{if(document.getElementById('community')?.classList.contains('active'))loadAccountData();})
       .on('postgres_changes',{event:'INSERT',schema:'public',table:'platform_events'},()=>{loadPlatformEvents();})
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'platform_event_registrations',filter:'user_id=eq.'+uid},()=>loadPlatformEvents())
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'tournament_matches'},()=>{const id=document.getElementById('tournamentBracketSelect')?.value;if(id)loadTournamentBracket(id);})
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+uid},payload=>{const el=document.getElementById('notificationCount');if(el){el.textContent=String((Number(el.textContent)||0)+1);el.hidden=false;}loadAccountData();if(payload.new?.body)showNotification(payload.new.body);})
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'community_group_messages'},()=>{if(activeCommunityGroup)loadGroupMessages(activeCommunityGroup);})
      .subscribe();
  }
  let realtimeChannel=null;
  let activeCommunityGroup=null;
  async function openGroupChat(groupId,options={}) {
    if(!currentUser)return requireAccount();activeCommunityGroup=groupId;
    if(!options.fromRoute)showSection('groupPage',{profileId:groupId,path:'/groups/'+groupId});
    const [{data:g},{data:members}] = await Promise.all([supabaseClient.from('community_groups').select('id,name,game_name,description,owner_id').eq('id',groupId).maybeSingle(),supabaseClient.from('community_group_members').select('user_id').eq('group_id',groupId)]);
    const host=document.getElementById('groupPageContent');if(!host||!g){if(host)host.innerHTML='<p class="subtitle">Группа не найдена.</p>';return;}
    host.innerHTML='<div class="section-heading"><div><span class="eyebrow">ИГРОВОЕ СООБЩЕСТВО</span><h1>'+escapeHtml(g.name)+'</h1><p class="subtitle">'+escapeHtml(g.game_name||'Любая игра')+' • '+(members||[]).length+' участников</p><p>'+escapeHtml(g.description||'')+'</p></div><button class="btn btn-ghost" onclick="showSection(\'community\')">К списку групп</button></div><div id="group-messages-'+groupId+'" class="group-messages"></div><div class="chat-input"><input id="group-input-'+groupId+'" maxlength="3000" placeholder="Сообщение группе..." onkeypress="if(event.key===\'Enter\')sendGroupMessage(\''+groupId+'\')"><button class="btn btn-primary" onclick="sendGroupMessage(\''+groupId+'\')"><i class="fa-solid fa-paper-plane"></i></button></div>';
    await loadGroupMessages(groupId);
  }
  async function loadGroupMessages(groupId) {
    const host=document.getElementById('group-messages-'+groupId);if(!host)return;
    const {data,error}=await supabaseClient.from('community_group_messages').select('id,user_id,body,created_at').eq('group_id',groupId).order('created_at').limit(100);if(error){host.innerHTML='<p class="subtitle">Вступи в группу, чтобы читать сообщения.</p>';return;}
    const ids=[...new Set((data||[]).map(m=>m.user_id))],profilesResult=ids.length?await supabaseClient.from('profiles').select('id,username,display_name').in('id',ids):{data:[]},byId=new Map((profilesResult.data||[]).map(p=>[p.id,p]));
    host.innerHTML=(data||[]).map(m=>{const p=byId.get(m.user_id)||{};return '<article class="group-chat-message"><strong>'+escapeHtml(m.user_id===currentUser.id?'Ты':p.display_name||p.username||'Игрок')+'</strong> <small>'+new Date(m.created_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+'</small><p>'+escapeHtml(m.body)+'</p></article>';}).join('')||'<p class="subtitle">Начни разговор.</p>';host.scrollTop=host.scrollHeight;
  }
  async function sendGroupMessage(groupId) {
    if(!currentUser)return requireAccount();
    const input=document.getElementById('group-input-'+groupId),body=input?.value.trim();if(!body)return;
    const {error}=await supabaseClient.from('community_group_messages').insert({group_id:groupId,user_id:currentUser.id,body});
    if(error){console.error(error);return showNotification('Нужно вступить в группу, чтобы писать.');}
    input.value='';await loadGroupMessages(groupId);
  }

  async function loadAdminAccess() {
    const uid=currentUser?.id;
    isAdmin=false;isModerator=false;
    const nav=document.querySelector('nav a[onclick*="admin"]')?.closest('li');
    if(nav)nav.hidden=true;
    if(!supabaseClient||!uid)return;
    const {data,error}=await supabaseClient.from('user_roles').select('role').eq('user_id',uid).in('role',['admin','moderator']);
    if(error){console.error('Could not check moderation role:',error);return;}
    if(currentUser?.id!==uid)return;
    const roles=(data||[]).map(r=>r.role);isAdmin=roles.includes('admin');isModerator=isAdmin||roles.includes('moderator');if(accountProfile)renderAccountProfile(accountProfile);
    if(nav)nav.hidden=true;const adminShortcut=document.getElementById('adminProfileButton');if(adminShortcut)adminShortcut.hidden=!isAdmin;
    for(const id of ['adminStatsGrid','adminChartCard','adminTeamsCard','adminTournamentsCard','adminGamesCard','adminUsersCard']){const el=document.getElementById(id);if(el)el.hidden=!isAdmin;}
    const title=document.querySelector('#admin h1'),subtitle=document.querySelector('#admin > .subtitle');
    if(title)title.innerHTML=isAdmin?'<i class="fa-solid fa-shield-halved"></i>Панель администратора':'<i class="fa-solid fa-shield-halved"></i>Модерация сообщества';
    if(subtitle)subtitle.textContent=isAdmin?'Данные платформы и модерация сообщества':'Жалобы и публикации сообщества';
    if(!isModerator&&document.getElementById('admin')?.classList.contains('active'))showSection('home');
    if(isModerator&&document.getElementById('admin')?.classList.contains('active'))loadAdminPanel();
  }

  async function loadModerationPanel() {
    const [reports,feed]=await Promise.all([
      supabaseClient.from('community_reports').select('id,reason,details,status,created_at').order('created_at',{ascending:false}).limit(100),
      supabaseClient.from('community_posts').select('id,user_id,body,created_at,media_type').order('created_at',{ascending:false}).limit(50)
    ]);
    const reportsEl=document.getElementById('adminReportsList');
    if(reportsEl)reportsEl.innerHTML=(reports.data||[]).map(r=>'<article class="list-divider" style="padding:12px 0"><strong>'+escapeHtml(r.reason)+'</strong><span class="subtitle"> • '+escapeHtml(r.status)+' • '+new Date(r.created_at).toLocaleString('ru-RU')+'</span><p>'+escapeHtml(r.details||'Без описания')+'</p><button class="btn btn-ghost" onclick="reviewCommunityReport(&quot;'+r.id+'&quot;,&quot;reviewing&quot;)">В работе</button><button class="btn btn-primary" onclick="reviewCommunityReport(&quot;'+r.id+'&quot;,&quot;resolved&quot;)">Решено</button><button class="btn btn-ghost" onclick="reviewCommunityReport(&quot;'+r.id+'&quot;,&quot;dismissed&quot;)">Отклонить</button></article>').join('')||'<p class="subtitle">Жалоб пока нет.</p>';
    const ids=[...new Set((feed.data||[]).map(p=>p.user_id))];
    const authors=ids.length?await supabaseClient.from('profiles').select('id,username,display_name').in('id',ids):{data:[]};
    const names=new Map((authors.data||[]).map(p=>[p.id,p.display_name||p.username||'Игрок']));
    const feedEl=document.getElementById('adminPostsList');
    if(feedEl)feedEl.innerHTML=(feed.data||[]).map(p=>'<article class="list-divider" style="padding:16px 0"><strong>'+escapeHtml(names.get(p.user_id)||'Игрок')+'</strong><span class="subtitle"> • '+new Date(p.created_at).toLocaleString('ru-RU')+'</span><p style="white-space:pre-wrap">'+escapeHtml(p.body||'')+'</p><button class="btn btn-danger" onclick="adminDeletePost(&quot;'+p.id+'&quot;)">Удалить публикацию</button></article>').join('')||'<p class="subtitle">Публикаций пока нет.</p>';
  }

  async function loadAdminPanel() {
    if(!isModerator||!supabaseClient||adminPanelLoading)return;
    adminPanelLoading=true;
    try { await loadAdminPanelData(); } catch(error){console.error('Admin panel load failed:',error);const status=document.getElementById('adminStatus');if(status)status.textContent='Не удалось обновить панель. Проверь соединение.';} finally {adminPanelLoading=false;}
  }
  async function loadAdminPanelData() {
    if(!isModerator||!supabaseClient)return;
    if(!isAdmin){await loadModerationPanel();return;}
    const status=document.getElementById('adminStatus');
    if(status) status.textContent='Загружаю данные…';
    const [users,teams,tournaments,posts,profiles,feed,reports,userDirectory,matchesCount]=await Promise.all([
      supabaseClient.from('profiles').select('id',{count:'exact',head:true}),
      supabaseClient.from('teams').select('id',{count:'exact',head:true}),
      supabaseClient.from('tournaments').select('id',{count:'exact',head:true}),
      supabaseClient.from('community_posts').select('id',{count:'exact',head:true}),
      supabaseClient.from('profiles').select('id,username,display_name,game_name,region,rank_name,level,rating,created_at,verified_color').order('created_at',{ascending:false}).limit(500),
      supabaseClient.from('community_posts').select('id,user_id,body,created_at,updated_at,media_url,media_type').order('created_at',{ascending:false}).limit(100),
      supabaseClient.from('community_reports').select('id,reporter_id,post_id,reported_user_id,reason,details,status,created_at').order('created_at',{ascending:false}).limit(100),
      supabaseClient.functions.invoke('admin-users',{body:{action:'users'}}),
      supabaseClient.from('matches').select('id',{count:'exact',head:true})
    ]);
    if(userDirectory.error?.context?.clone){try{userDirectory.data=await userDirectory.error.context.clone().json();}catch{}}
    const errors=[users,teams,tournaments,posts,profiles,feed,reports].filter(r=>r.error);
    if(userDirectory.error||userDirectory.data?.error) errors.push(userDirectory);
    const errorDetails=errors.map(r=>r===userDirectory?(userDirectory.data?.reason?userDirectory.data.error+': '+userDirectory.data.reason:userDirectory.data?.error||r.error?.message||'Ошибка запроса'):(r.error?.message||'Ошибка запроса'));
    if(errors.length)console.error('Admin dashboard query failed:',errorDetails);
    const count=(r)=>r.count??'—';
    document.getElementById('adminUsersCount').textContent=count(users);
    document.getElementById('adminTeamsCount').textContent=count(teams);
    document.getElementById('adminTournamentsCount').textContent=count(tournaments);
    document.getElementById('adminPostsCount').textContent=count(posts);
    document.getElementById('adminMatchesCount').textContent=count(matchesCount);
    const directory=new Map((userDirectory.data?.users||[]).map(u=>[u.id,u]));
    const userIds=(profiles.data||[]).map(p=>p.id);
    const rolesResult=userIds.length?await supabaseClient.from('user_roles').select('user_id,role').in('user_id',userIds):{data:[]};
    const roles=new Map();
    (rolesResult.data||[]).forEach(r=>{const list=roles.get(r.user_id)||[];list.push(r.role);roles.set(r.user_id,list);});
    const reportUserIds=[...new Set((reports.data||[]).flatMap(r=>[r.reporter_id,r.reported_user_id].filter(Boolean)))];
    const reportProfileResult=reportUserIds.length?await supabaseClient.from('profiles').select('id,username,display_name').in('id',reportUserIds):{data:[]};
    const reportProfiles=new Map((reportProfileResult.data||[]).map(p=>[p.id,p]));
    const reportUserLabel=id=>{const p=reportProfiles.get(id);return p?(p.display_name||p.username||'Игрок')+' (@'+(p.username||'игрок')+')':'Профиль не найден';};
    const userRows=document.getElementById('adminUsersBody');
    if(userRows) userRows.innerHTML=(profiles.data||[]).map(p=>{
      const account=directory.get(p.id)||{};
      const isBanned=!!account.bannedUntil&&new Date(account.bannedUntil)>new Date();
      const userRoles=roles.get(p.id)||[];
      const roleLabel=userRoles.includes('admin')?'Администратор':userRoles.includes('moderator')?'Модератор':'Игрок';
      const action=isBanned?'unban':'ban';
      return '<tr class="admin-entry"><td>'+escapeHtml(p.display_name||p.username||'Игрок')+'<div class="subtitle">'+escapeHtml(account.email||'')+'</div></td><td>'+escapeHtml(p.game_name||'—')+'</td><td>'+escapeHtml(p.region||'—')+'</td><td>'+escapeHtml(p.rank_name||'—')+'</td><td>'+escapeHtml(String(p.level??'—'))+'</td><td>'+escapeHtml(String(p.rating??'—'))+'</td><td>'+new Date(p.created_at).toLocaleDateString('ru-RU')+'</td><td>'+roleLabel+(isBanned?' · блокировка':'')+'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">'+'<button class="btn btn-ghost" onclick="adminInspectUser(&quot;'+p.id+'&quot;)">Подробнее</button>'+(p.id===currentUser?.id?'':('<button class="btn btn-ghost" onclick="adminUserAction(&quot;'+p.id+'&quot;,&quot;'+action+'&quot;)">'+(isBanned?'Разблокировать':'Блокировать')+'</button><button class="btn btn-ghost" onclick="adminUserAction(&quot;'+p.id+'&quot;,&quot;'+(userRoles.includes('moderator')?'revoke_role':'grant_role')+'&quot;,&quot;moderator&quot;)">'+(userRoles.includes('moderator')?'Снять модератора':'Модератор')+'</button><button class="btn btn-ghost" onclick="adminUserAction(&quot;'+p.id+'&quot;,&quot;'+(userRoles.includes('admin')?'revoke_role':'grant_role')+'&quot;,&quot;admin&quot;)">'+(userRoles.includes('admin')?'Снять админа':'Админ')+'</button><button class="btn btn-ghost" onclick="adminUserAction(&quot;'+p.id+'&quot;,&quot;verify&quot;,&quot;&quot;,&quot;'+(p.verified_color==='blue'?'':'blue')+'&quot;)">'+(p.verified_color==='blue'?'Снять синюю галочку':'Синяя галочка')+'</button><button class="btn btn-ghost" onclick="adminUserAction(&quot;'+p.id+'&quot;,&quot;verify&quot;,&quot;&quot;,&quot;green&quot;)">Зелёная галочка</button>') )+'</div></td></tr>';
    }).join('')||'<tr><td colspan="8" class="subtitle">Пока нет зарегистрированных игроков</td></tr>';
    const feedEl=document.getElementById('adminPostsList');
    const authorIds=[...new Set((feed.data||[]).map(p=>p.user_id))];
    const authorResult=authorIds.length?await supabaseClient.from('profiles').select('id,username,display_name').in('id',authorIds):{data:[]};
    const authors=new Map((authorResult.data||[]).map(p=>[p.id,p]));
    const feedIds=(feed.data||[]).map(p=>p.id);
    const [postComments,postLikes]=feedIds.length?await Promise.all([supabaseClient.from('community_post_comments').select('post_id').in('post_id',feedIds),supabaseClient.from('community_post_likes').select('post_id').in('post_id',feedIds)]):[{data:[]},{data:[]}];
    const countByPost=(rows)=>{const map=new Map();(rows||[]).forEach(row=>map.set(row.post_id,(map.get(row.post_id)||0)+1));return map;};
    const commentCounts=countByPost(postComments.data),likeCounts=countByPost(postLikes.data);
    if(feedEl) feedEl.innerHTML=(feed.data||[]).map(p=>{
      const author=authors.get(p.user_id)||{};
      const media=p.media_url?(p.media_type==='video'?'<video class="admin-post-media" controls preload="metadata" src="'+escapeHtml(p.media_url)+'"></video>':'<img class="admin-post-media" loading="lazy" src="'+escapeHtml(p.media_url)+'" alt="Медиа публикации">'):'';
      return '<article class="admin-entry admin-post-entry"><div class="admin-entry-header"><div><button class="player-profile-link" onclick="openPlayerProfile(&quot;'+p.user_id+'&quot;)"><strong>'+escapeHtml(author.display_name||author.username||'Игрок')+'</strong><small>@'+escapeHtml(author.username||'игрок')+'</small></button><div class="subtitle">'+new Date(p.created_at).toLocaleString('ru-RU')+(p.updated_at&&p.updated_at!==p.created_at?' • изменено '+new Date(p.updated_at).toLocaleString('ru-RU'):'')+'</div></div><span class="badge badge-info">'+(p.media_type?escapeHtml(p.media_type==='video'?'Видео':'Фото'):'Публикация')+'</span></div><p class="admin-post-preview">'+escapeHtml(p.body||'Без текста')+'</p>'+media+'<div class="admin-entry-footer"><span class="subtitle">♥ '+(likeCounts.get(p.id)||0)+' • Комментарии '+(commentCounts.get(p.id)||0)+'</span><div class="admin-entry-actions"><button class="btn btn-ghost" onclick="adminInspectPost(&quot;'+p.id+'&quot;)">Подробнее</button><button class="btn btn-danger" onclick="adminDeletePost(&quot;'+p.id+'&quot;)"><i class="fa-solid fa-trash"></i> Удалить</button></div></div></article>';
    }).join('')||'<p class="subtitle">Публикаций пока нет.</p>';
    const reportsEl=document.getElementById('adminReportsList');
    const reportStatusLabel={open:'Новая',reviewing:'В работе',resolved:'Решена',dismissed:'Отклонена'};
    const reportReasonLabel={spam:'Спам',abuse:'Оскорбления или травля',cheating:'Читы',other:'Другое'};
    if(reportsEl) reportsEl.innerHTML=(reports.data||[]).map(r=>'<article class="admin-entry admin-report-entry"><div class="admin-entry-header"><div><strong>'+escapeHtml(reportReasonLabel[r.reason]||r.reason)+'</strong><div class="subtitle">'+new Date(r.created_at).toLocaleString('ru-RU')+' • Жалобу подал: '+escapeHtml(reportUserLabel(r.reporter_id))+'</div></div><span class="badge '+(r.status==='open'?'badge-warning':'badge-info')+'">'+escapeHtml(reportStatusLabel[r.status]||r.status)+'</span></div><p class="admin-report-summary">'+escapeHtml(r.details||'Пользователь не добавил описание.')+'</p><div class="admin-entry-footer"><span class="subtitle">На пользователя: '+escapeHtml(r.reported_user_id?reportUserLabel(r.reported_user_id):'не указан')+'</span><div class="admin-entry-actions"><button class="btn btn-ghost" onclick="adminInspectReport(&quot;'+r.id+'&quot;)">Открыть жалобу</button>'+(r.status!=='reviewing'?'<button class="btn btn-ghost" onclick="reviewCommunityReport(&quot;'+r.id+'&quot;,&quot;reviewing&quot;)">В работу</button>':'')+(r.status!=='resolved'?'<button class="btn btn-primary" onclick="reviewCommunityReport(&quot;'+r.id+'&quot;,&quot;resolved&quot;)">Решено</button>':'')+(r.status!=='dismissed'?'<button class="btn btn-ghost" onclick="reviewCommunityReport(&quot;'+r.id+'&quot;,&quot;dismissed&quot;)">Отклонить</button>':'')+'</div></div></article>').join('')||'<p class="subtitle">Жалоб пока нет.</p>';
    if(status){const summary='Показаны последние '+(profiles.data||[]).length+' игроков и '+(feed.data||[]).length+' публикаций.';status.textContent=summary+(errors.length?' Не загрузилась часть данных: '+errorDetails.join(' • '):'');}
    await loadAdminGames();await loadAdminTeamsAndTournaments();await loadAdminRegistrationChart();
  }

  function filterAdminList(containerId,value) {
    const host=document.getElementById(containerId);if(!host)return;
    const query=String(value||'').trim().toLocaleLowerCase('ru');
    host.querySelectorAll('.admin-entry').forEach(entry=>{entry.hidden=!!query&&!entry.textContent.toLocaleLowerCase('ru').includes(query);});
  }
  function filterAdminReports() {
    const query=document.getElementById('adminReportsSearch')?.value||'';
    const status=document.getElementById('adminReportsStatus')?.value||'';
    document.querySelectorAll('#adminReportsList .admin-report-entry').forEach(entry=>{
      const matchesText=!query||entry.textContent.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'));
      const statusText=entry.querySelector('.badge')?.textContent.trim()||'';
      const expected={open:'Новая',reviewing:'В работе',resolved:'Решена',dismissed:'Отклонена'}[status];
      entry.hidden=!(matchesText&&(!status||statusText===expected));
    });
  }
  function adminDetailShell(title,content) {
    const heading=document.getElementById('adminDetailTitle'),body=document.getElementById('adminDetailBody');
    if(!heading||!body)return;
    heading.textContent=title;body.innerHTML=content||'<p class="subtitle">Нет подробной информации.</p>';openModal('adminDetailModal');
  }
  const adminDetailField=(label,value)=>'<div class="admin-detail-field"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value===null||value===undefined||value===''?'—':String(value))+'</strong></div>';
  const adminFormatDate=value=>value?new Date(value).toLocaleString('ru-RU'):'—';
  function adminActivityMarkup(rows) {
    return (rows||[]).map(x=>'<article class="admin-detail-row"><div><strong>'+escapeHtml(x.action||'Активность')+'</strong><span class="subtitle"> • '+escapeHtml(x.game_name||'без игры')+' • '+adminFormatDate(x.created_at)+'</span></div><p>'+escapeHtml(x.result||'')+(x.rating_delta!==null&&x.rating_delta!==undefined?' • рейтинг '+(x.rating_delta>0?'+':'')+x.rating_delta:'')+'</p></article>').join('')||'<p class="subtitle">История активности пока пуста.</p>';
  }
  async function adminInspectUser(id) {
    if(!isAdmin||!supabaseClient)return;
    adminDetailShell('Загружаю профиль…','<div class="admin-detail-loading"><i class="fa-solid fa-spinner fa-spin"></i> Получаю данные аккаунта</div>');
    const {data,error}=await supabaseClient.functions.invoke('admin-users',{body:{action:'user-detail',targetUserId:id}});
    if(error||data?.error){console.error('Admin user detail failed:',error||data);adminDetailShell('Не удалось открыть профиль','<p class="subtitle">Не удалось загрузить сведения аккаунта. Проверь доступ к админ-функции и повтори попытку.</p>');return;}
    const u=data.user||{},p=data.profile||{},st=data.settings||{},roles=(data.roles||[]).map(r=>r.role==='admin'?'Администратор':r.role==='moderator'?'Модератор':r.role).join(', ')||'Игрок';
    const banned=u.bannedUntil&&new Date(u.bannedUntil)>new Date()?'Заблокирован до '+adminFormatDate(u.bannedUntil):'Активен';
    const values='<div class="admin-detail-grid">'+adminDetailField('Имя профиля',p.display_name)+adminDetailField('Юзернейм',p.username?'@'+p.username:'—')+adminDetailField('Email',u.email)+adminDetailField('ID пользователя',u.id)+adminDetailField('Роль',roles)+adminDetailField('Статус аккаунта',banned)+adminDetailField('Провайдер входа',(u.providers||[]).join(', ')||'—')+adminDetailField('Зарегистрирован',adminFormatDate(u.createdAt))+adminDetailField('Последний вход',adminFormatDate(u.lastSignInAt))+adminDetailField('Email подтверждён',adminFormatDate(u.emailConfirmedAt))+adminDetailField('Создан профиль',adminFormatDate(p.created_at))+adminDetailField('Профиль обновлён',adminFormatDate(p.updated_at))+adminDetailField('Игра',p.game_name)+adminDetailField('Регион',p.region)+adminDetailField('Ранг',p.rank_name)+adminDetailField('Уровень',p.level)+adminDetailField('Рейтинг',p.rating)+adminDetailField('Матчи / победы',String(p.matches_played||0)+' / '+String(p.wins||0))+adminDetailField('K/D',p.kd)+adminDetailField('Проверка',p.verified_color?(p.verified_color==='blue'?'Синяя':'Зелёная')+' • '+adminFormatDate(p.verified_at):'Нет')+adminDetailField('Друзья',data.friendCount)+adminDetailField('Публикации',data.communityPostCount)+adminDetailField('Тема интерфейса',st.theme)+adminDetailField('Язык / регион',String(st.language||p.language||'—')+' / '+String(st.region||p.region||'—'))+adminDetailField('Профиль виден в поиске',st.discoverable===false?'Нет':'Да')+'</div><section class="admin-detail-section"><h3>О себе</h3><p class="admin-detail-bio">'+escapeHtml(p.bio||'Описание не заполнено.')+'</p></section><section class="admin-detail-section"><h3>Команды</h3>'+((data.teams||[]).map(x=>'<p>'+escapeHtml(x.teams?.name||'Команда')+(x.teams?.tag?' ['+escapeHtml(x.teams.tag)+']':'')+' • '+escapeHtml(x.role||'участник')+' • '+escapeHtml(x.teams?.game_name||'')+'</p>').join('')||'<p class="subtitle">Не состоит в командах.</p>')+'</section><section class="admin-detail-section"><h3>Последние матчи</h3>'+((data.matches||[]).map(m=>'<article class="admin-detail-row"><strong>'+escapeHtml(m.game_id||'Игра')+' • '+escapeHtml(m.status||'')+'</strong><span>'+escapeHtml(m.score_a??'—')+' : '+escapeHtml(m.score_b??'—')+' • '+adminFormatDate(m.played_at)+'</span></article>').join('')||'<p class="subtitle">Матчей пока нет.</p>')+'</section><section class="admin-detail-section"><h3>История активности</h3>'+adminActivityMarkup(data.activity)+'</section><section class="admin-detail-section"><h3>Настройки уведомлений</h3><p>'+['notify_messages','notify_team_invites','notify_tournaments','notify_marketing'].map((key,i)=>['Сообщения','Приглашения в команды','Турниры','Новости платформы'][i]+': '+(st[key]?'включены':'выключены')).join(' • ')+'</p></section>';
    adminDetailShell('Профиль игрока',values);
  }
  async function adminInspectReport(id) {
    if(!isAdmin||!supabaseClient)return;
    adminDetailShell('Загружаю жалобу…','<div class="admin-detail-loading"><i class="fa-solid fa-spinner fa-spin"></i> Загружаю связанные данные</div>');
    const {data:r,error}=await supabaseClient.from('community_reports').select('id,reporter_id,post_id,reported_user_id,reason,details,status,reviewed_by,created_at,reviewed_at').eq('id',id).maybeSingle();
    if(error||!r){adminDetailShell('Жалоба недоступна','<p class="subtitle">Не удалось загрузить жалобу.</p>');return;}
    const ids=[r.reporter_id,r.reported_user_id,r.reviewed_by].filter(Boolean);
    const [profiles,post]=await Promise.all([
      ids.length?supabaseClient.from('profiles').select('id,username,display_name,avatar_url').in('id',ids):Promise.resolve({data:[]}),
      r.post_id?supabaseClient.from('community_posts').select('id,user_id,body,created_at,media_url,media_type').eq('id',r.post_id).maybeSingle():Promise.resolve({data:null})
    ]);
    const byId=new Map((profiles.data||[]).map(p=>[p.id,p]));
    const player=userId=>{const p=byId.get(userId);return userId?'<button class="player-profile-link" onclick="closeModal(&quot;adminDetailModal&quot;);openPlayerProfile(&quot;'+userId+'&quot;)"><strong>'+escapeHtml(p?.display_name||p?.username||'Игрок')+'</strong><small>'+(p?.username?'@'+escapeHtml(p.username):escapeHtml(userId))+'</small></button>':'<span class="subtitle">Не указан</span>';};
    const postMarkup=post.data?'<section class="admin-detail-section"><div class="admin-entry-header"><h3>Связанная публикация</h3><button class="btn btn-ghost" onclick="closeModal(&quot;adminDetailModal&quot;);adminInspectPost(&quot;'+post.data.id+'&quot;)">Открыть пост</button></div><p class="admin-detail-bio">'+escapeHtml(post.data.body||'Публикация без текста')+'</p>'+(post.data.media_url?post.data.media_type==='video'?'<video class="admin-post-media" controls src="'+escapeHtml(post.data.media_url)+'"></video>':'<img class="admin-post-media" src="'+escapeHtml(post.data.media_url)+'" alt="Медиа публикации">':'')+'<p class="subtitle">Автор: '+player(post.data.user_id)+'</p></section>':r.post_id?'<p class="subtitle">Связанный пост удалён или недоступен.</p>':'<p class="subtitle">Жалоба не привязана к публикации.</p>';
    const reason={spam:'Спам',abuse:'Оскорбления или травля',cheating:'Читы',other:'Другое'}[r.reason]||r.reason;
    const html='<div class="admin-detail-grid">'+adminDetailField('Категория',reason)+adminDetailField('Статус',({open:'Новая',reviewing:'В работе',resolved:'Решена',dismissed:'Отклонена'})[r.status]||r.status)+adminDetailField('Создана',adminFormatDate(r.created_at))+adminDetailField('Обработана',adminFormatDate(r.reviewed_at))+adminDetailField('ID жалобы',r.id)+'</div><section class="admin-detail-section"><h3>Кто отправил</h3>'+player(r.reporter_id)+'</section><section class="admin-detail-section"><h3>На кого жалуются</h3>'+player(r.reported_user_id)+'</section><section class="admin-detail-section"><h3>Подробности жалобы</h3><p class="admin-detail-bio">'+escapeHtml(r.details||'Заявитель не добавил описание.')+'</p></section>'+postMarkup+'<section class="admin-detail-section"><h3>Решение модерации</h3><div class="admin-entry-actions"><button class="btn btn-ghost" onclick="reviewCommunityReport(&quot;'+r.id+'&quot;,&quot;reviewing&quot;)">В работу</button><button class="btn btn-primary" onclick="reviewCommunityReport(&quot;'+r.id+'&quot;,&quot;resolved&quot;)">Решена</button><button class="btn btn-ghost" onclick="reviewCommunityReport(&quot;'+r.id+'&quot;,&quot;dismissed&quot;)">Отклонить</button></div></section>';
    adminDetailShell('Разбор жалобы',html);
  }
  async function adminInspectPost(id) {
    if(!isAdmin||!supabaseClient)return;
    adminDetailShell('Загружаю публикацию…','<div class="admin-detail-loading"><i class="fa-solid fa-spinner fa-spin"></i> Загружаю публикацию, реакции и комментарии</div>');
    const {data:p,error}=await supabaseClient.from('community_posts').select('id,user_id,body,created_at,updated_at,media_url,media_type').eq('id',id).maybeSingle();
    if(error||!p){adminDetailShell('Публикация недоступна','<p class="subtitle">Она могла быть удалена или скрыта.</p>');return;}
    const [author,comments,likes,reports]=await Promise.all([
      supabaseClient.from('profiles').select('id,username,display_name,avatar_url').eq('id',p.user_id).maybeSingle(),
      supabaseClient.from('community_post_comments').select('id,user_id,body,created_at').eq('post_id',id).order('created_at',{ascending:true}).limit(200),
      supabaseClient.from('community_post_likes').select('user_id').eq('post_id',id),
      supabaseClient.from('community_reports').select('id,reason,details,status,created_at').eq('post_id',id).order('created_at',{ascending:false})
    ]);
    const commentIds=[...new Set((comments.data||[]).map(c=>c.user_id))];
    const commentProfiles=commentIds.length?await supabaseClient.from('profiles').select('id,username,display_name').in('id',commentIds):{data:[]};
    const commentNames=new Map((commentProfiles.data||[]).map(x=>[x.id,x]));
    const authorData=author.data||{},media=p.media_url?(p.media_type==='video'?'<video class="admin-post-media" controls src="'+escapeHtml(p.media_url)+'"></video>':'<img class="admin-post-media" src="'+escapeHtml(p.media_url)+'" alt="Медиа публикации">'):'<p class="subtitle">Медиа нет</p>';
    const commentHtml=(comments.data||[]).map(c=>{const profile=commentNames.get(c.user_id)||{};return '<article class="admin-detail-row"><button class="player-profile-link" onclick="closeModal(&quot;adminDetailModal&quot;);openPlayerProfile(&quot;'+c.user_id+'&quot;)"><strong>'+escapeHtml(profile.display_name||profile.username||'Игрок')+'</strong><small>@'+escapeHtml(profile.username||'игрок')+'</small></button><span class="subtitle">'+adminFormatDate(c.created_at)+'</span><p class="admin-detail-bio">'+escapeHtml(c.body)+'</p></article>';}).join('')||'<p class="subtitle">Комментариев пока нет.</p>';
    const reportHtml=(reports.data||[]).map(r=>'<article class="admin-detail-row"><strong>'+escapeHtml(({spam:'Спам',abuse:'Оскорбления',cheating:'Читы',other:'Другое'})[r.reason]||r.reason)+'</strong><span class="subtitle"> • '+escapeHtml(({open:'Новая',reviewing:'В работе',resolved:'Решена',dismissed:'Отклонена'})[r.status]||r.status)+' • '+adminFormatDate(r.created_at)+'</span><p>'+escapeHtml(r.details||'Без описания')+'</p><button class="btn btn-ghost" onclick="closeModal(&quot;adminDetailModal&quot;);adminInspectReport(&quot;'+r.id+'&quot;)">Разобрать жалобу</button></article>').join('')||'<p class="subtitle">Жалоб на эту публикацию нет.</p>';
    const html='<div class="admin-entry-header"><div><button class="player-profile-link" onclick="closeModal(&quot;adminDetailModal&quot;);openPlayerProfile(&quot;'+p.user_id+'&quot;)"><strong>'+escapeHtml(authorData.display_name||authorData.username||'Игрок')+'</strong><small>@'+escapeHtml(authorData.username||'игрок')+'</small></button><div class="subtitle">Опубликовано '+adminFormatDate(p.created_at)+(p.updated_at&&p.updated_at!==p.created_at?' • изменено '+adminFormatDate(p.updated_at):'')+'</div></div>'+adminDetailField('ID поста',p.id)+'</div><section class="admin-detail-section"><h3>Полный текст публикации</h3><p class="admin-detail-bio">'+escapeHtml(p.body||'Публикация без текста')+'</p>'+media+'</section><div class="admin-detail-grid">'+adminDetailField('Лайки',(likes.data||[]).length)+adminDetailField('Комментарии',(comments.data||[]).length)+adminDetailField('Жалобы',(reports.data||[]).length)+'</div><section class="admin-detail-section"><h3>Комментарии</h3>'+commentHtml+'</section><section class="admin-detail-section"><h3>Жалобы по посту</h3>'+reportHtml+'</section><div class="admin-entry-actions"><button class="btn btn-danger" onclick="adminDeletePost(&quot;'+p.id+'&quot;)"><i class="fa-solid fa-trash"></i> Удалить публикацию</button></div>';
    adminDetailShell('Публикация сообщества',html);
  }

  async function adminUserAction(targetUserId,action,role,color) {
    if(!isAdmin||!supabaseClient) return;
    let days;
    if(action==='ban') {
      const answer=await askInput('На сколько дней заблокировать аккаунт?','7');
      if(answer===null) return;
      days=Math.max(1,Math.min(365,parseInt(answer,10)||7));
    } else if(!await askConfirm('Подтвердить действие с аккаунтом?')) return;
    const {data,error}=await supabaseClient.functions.invoke('admin-users',{body:{action,targetUserId,role,days,color:color||null}});
    if(error||data?.error){console.error('Admin user action failed:',error||data);showNotification(data?.error||'Не удалось изменить аккаунт.');return;}
    showNotification(action==='ban'?'Аккаунт заблокирован.':action==='unban'?'Аккаунт разблокирован.':action==='grant_role'?'Роль назначена.':action==='verify'?(color?'Значок проверки выдан.':'Значок проверки снят.'):'Роль снята.');
    await loadAdminPanel();
  }

  async function loadAdminRegistrationChart() {
    const el=document.getElementById('adminRegistrationChart');if(!el||!isAdmin||!supabaseClient)return;
    const since=new Date();since.setDate(since.getDate()-6);since.setHours(0,0,0,0);
    const {data,error}=await supabaseClient.from('profiles').select('created_at').gte('created_at',since.toISOString());
    if(error){console.error(error);el.innerHTML='<p class="subtitle">Не удалось загрузить график.</p>';return;}
    const counts=new Map(),dates=[];
    for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const key=d.toLocaleDateString('sv-SE');dates.push(key);counts.set(key,0);}
    (data||[]).forEach(p=>{const key=new Date(p.created_at).toLocaleDateString('sv-SE');if(counts.has(key))counts.set(key,counts.get(key)+1);});
    const max=Math.max(1,...counts.values());
    el.innerHTML=dates.map(key=>'<div style="display:flex;flex-direction:column;justify-content:end;align-items:center;min-height:140px;gap:6px;"><strong>'+counts.get(key)+'</strong><div title="'+key+': '+counts.get(key)+'" style="width:min(100%,34px);height:'+Math.max(6,Math.round(96*counts.get(key)/max))+'px;background:linear-gradient(180deg,var(--red),#7c1721);border-radius:6px 6px 0 0;"></div><small class="subtitle">'+key.slice(5)+'</small></div>').join('');
  }

  async function loadAdminTeamsAndTournaments() {
    if(!isAdmin||!supabaseClient)return;
    const [teams,tournaments]=await Promise.all([
      supabaseClient.from('teams').select('id,name,tag,game_name,region,is_active,owner_id').order('created_at',{ascending:false}).limit(100),
      supabaseClient.from('tournaments').select('id,name,game_name,status,starts_at,owner_id').order('created_at',{ascending:false}).limit(100)
    ]);
    const teamEl=document.getElementById('adminTeamsList');
    if(teamEl)teamEl.innerHTML=(teams.data||[]).map(t=>'<article class="list-divider" style="padding:12px 0;display:flex;justify-content:space-between;gap:12px;align-items:center"><div><strong>'+escapeHtml(t.name)+(t.tag?' ['+escapeHtml(t.tag)+']':'')+'</strong><div class="subtitle">'+escapeHtml(t.game_name)+' • '+escapeHtml(t.region)+' • '+(t.is_active?'Опубликована':'Скрыта')+'</div></div><button class="btn '+(t.is_active?'btn-ghost':'btn-primary')+'" onclick="adminToggleTeam(&quot;'+t.id+'&quot;,'+(!t.is_active)+')">'+(t.is_active?'Скрыть':'Показать')+'</button></article>').join('')||'<p class="subtitle">Команд пока нет.</p>';
    const statusOptions=['upcoming','registration','live','completed','cancelled'];
    const tournamentEl=document.getElementById('adminTournamentsList');
    if(tournamentEl)tournamentEl.innerHTML=(tournaments.data||[]).map(t=>'<article class="list-divider" style="padding:12px 0;display:flex;justify-content:space-between;gap:12px;align-items:center"><div><strong>'+escapeHtml(t.name)+'</strong><div class="subtitle">'+escapeHtml(t.game_name)+(t.starts_at?' • '+new Date(t.starts_at).toLocaleString('ru-RU'):'')+'</div></div><select aria-label="Статус турнира" onchange="adminUpdateTournamentStatus(&quot;'+t.id+'&quot;,this.value)">'+statusOptions.map(s=>'<option value="'+s+'" '+(t.status===s?'selected':'')+'>'+s+'</option>').join('')+'</select></article>').join('')||'<p class="subtitle">Турниров пока нет.</p>';
  }
  async function adminToggleTeam(id,isActive) {
    if(!isAdmin||!await askConfirm(isActive?'Опубликовать команду?':'Скрыть команду из каталога?'))return;
    const {error}=await supabaseClient.from('teams').update({is_active:isActive}).eq('id',id);
    if(error){console.error(error);return showNotification('Не удалось изменить команду.');}
    await loadAdminTeamsAndTournaments();await loadTeamDirectory();showNotification(isActive?'Команда опубликована.':'Команда скрыта.');
  }
  async function adminUpdateTournamentStatus(id,status) {
    if(!isAdmin||!['upcoming','registration','live','completed','cancelled'].includes(status))return;
    const {error}=await supabaseClient.from('tournaments').update({status}).eq('id',id);
    if(error){console.error(error);return showNotification('Не удалось обновить статус турнира.');}
    showNotification('Статус турнира обновлён.');await Promise.all([loadAdminTeamsAndTournaments(),loadCreatedTournaments(),loadPlatformEvents(),loadHomeTournaments()]);
  }

  async function loadAdminGames() {
    const host=document.getElementById('adminGamesList');
    if(!host||!isAdmin||!supabaseClient)return;
    const {data,error}=await supabaseClient.from('games').select('id,name,genre,is_active,platform').order('sort_order').order('name');
    if(error){console.error('Could not load game catalog:',error);host.innerHTML='<p class="subtitle">Не удалось загрузить каталог.</p>';return;}
    host.innerHTML=(data||[]).map(g=>'<article class="list-divider" style="padding:12px 0;display:flex;justify-content:space-between;align-items:center;gap:14px"><div><strong>'+escapeHtml(g.name)+'</strong><div class="subtitle">'+escapeHtml(g.genre)+' • '+escapeHtml((g.platform||[]).join(', ')||'Платформы не заданы')+' • '+(g.is_active?'Активна':'Скрыта')+'</div></div><button class="btn btn-ghost" onclick="adminToggleGame(&quot;'+escapeHtml(g.id)+'&quot;,'+(!g.is_active)+')">'+(g.is_active?'Скрыть':'Опубликовать')+'</button></article>').join('')||'<p class="subtitle">Каталог пуст.</p>';
  }

  async function adminCreateGame() {
    if(!isAdmin||!supabaseClient)return;
    const name=document.getElementById('adminGameName').value.trim(),genre=document.getElementById('adminGameGenre').value.trim()||'Other';
    if(name.length<2)return showNotification('Введи название игры.');
    const id=name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'game-'+crypto.randomUUID();
    const {error}=await supabaseClient.from('games').insert({id,name,genre,is_active:true});
    if(error){console.error(error);return showNotification('Не удалось добавить игру. Возможно, она уже есть.');}
    document.getElementById('adminGameName').value='';document.getElementById('adminGameGenre').value='';
    showNotification('Игра добавлена.');await loadAdminGames();await loadGameCatalog();
  }

  async function adminToggleGame(id,isActive) {
    if(!isAdmin||!supabaseClient)return;
    const {error}=await supabaseClient.from('games').update({is_active:isActive}).eq('id',id);
    if(error){console.error(error);return showNotification('Не удалось изменить игру.');}
    await loadAdminGames();await loadGameCatalog();await loadLeaderboards();
  }

  async function adminDeletePost(postId) {
    if(!isModerator||!supabaseClient||!await askConfirm('Удалить эту публикацию для всех пользователей?')) return;
    const {error}=await supabaseClient.from('community_posts').delete().eq('id',postId);
    if(error){console.error('Could not remove community post:',error);showNotification('Не удалось удалить публикацию.');return;}
    showNotification('Публикация удалена.');
    await loadAdminPanel();
  }

  function renderAuthState(user) {
    const actions = document.querySelector('.auth-buttons');
    if (!actions) return;
    actions.replaceChildren();
    if (!user) {
      const login = document.createElement('button');
      login.className = 'btn btn-primary';
      login.setAttribute('aria-label', 'Войти в Squadra');
      login.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i><span>Войти</span>';
      login.onclick = () => openModal('loginModal');
      actions.append(login);
      return;
    }
    const identity = document.createElement('button');
    identity.className = 'account-chip';
    identity.type = 'button';
    identity.innerHTML = '<i class="fa-solid fa-circle-user"></i><span></span>';
    identity.querySelector('span').textContent = accountProfile?.display_name || accountProfile?.username || 'Мой аккаунт';
    identity.onclick = () => showSection('profile');
    identity.setAttribute('aria-label', 'Открыть профиль');
    const signOut = document.createElement('button');
    signOut.className = 'btn btn-ghost';
    signOut.setAttribute('aria-label', 'Выйти из аккаунта');
    signOut.title = 'Выйти из аккаунта';
    signOut.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i><span>Выйти</span>';
    signOut.onclick = async () => {
      const { error } = await supabaseClient.auth.signOut();
      if (error) showNotification('Не удалось выйти. Попробуйте ещё раз.');
    };
    actions.append(identity, signOut);
  }

  async function initSupabaseAuth() {
    const oauthError = new URLSearchParams(location.search).get('error_description');
    if (oauthError) {
      showNotification('Вход через Google не завершился. Проверьте настройки провайдера.');
      const cleanUrl = location.pathname + location.hash;
      history.replaceState({}, document.title, cleanUrl);
    }
    if (!authIsConfigured()) { authInitialized=true; applyLocationRoute(); return; }
    try {
      supabaseClient = await ensureSupabaseClient();
    } catch (error) {
      console.error('Supabase Auth could not initialize:', error);
      authInitialized=true;applyLocationRoute();
      showNotification('Не удалось загрузить авторизацию. Обнови страницу и попробуй ещё раз.');
      return;
    }
    let session = null;
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) console.error('Could not read Supabase session:', error);
      session = data?.session || null;
    } catch (error) {
      console.error('Could not read Supabase session:', error);
    }

    const oauthCode = new URLSearchParams(window.location.search).get('code');
    if (oauthCode) {
      try {
        const { data, error } = await supabaseClient.auth.exchangeCodeForSession(oauthCode);
        if (error) throw error;
        session = data?.session || session;
      } catch (error) {
        console.error('Could not exchange Google OAuth code for a Squadra session:', error);
        showNotification('Google подтвердил вход, но не удалось открыть сессию Squadra. Попробуй войти ещё раз.');
      } finally {
        const params = new URLSearchParams(window.location.search);
        params.delete('code');
        params.delete('error');
        params.delete('error_description');
        const query = params.toString();
        history.replaceState({}, document.title, location.pathname + (query ? '?' + query : '') + location.hash);
      }
    }

    const authParams = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = authParams.get('access_token');
    const refreshToken = authParams.get('refresh_token');
    if (!session && accessToken && refreshToken) {
      try {
        const { data, error } = await supabaseClient.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        if (error) {
          console.error('Could not create Supabase session from OAuth callback:', error);
          showNotification('Google вернул вход, но Supabase не принял сессию. Попробуй ещё раз.');
        } else {
          session = data?.session || null;
        }
      } catch (error) {
        console.error('Could not create Supabase session from OAuth callback:', error);
        showNotification('Не удалось завершить вход Google. Попробуй ещё раз.');
      }
    }
    if (accessToken || refreshToken) {
      history.replaceState({}, document.title, window.location.pathname + window.location.search);
    }

    currentUser=session?.user||null;
    renderAuthState(currentUser);
    supabaseClient.auth.onAuthStateChange((event, nextSession) => {
      currentUser=nextSession?.user||null;
      if(currentUser) { loadAccountData(); loadAdminAccess(); setupRealtime(); } else {if(realtimeChannel)supabaseClient.removeChannel(realtimeChannel);realtimeChannel=null;activeCommunityGroup=null;isAdmin=false;const adminNav=document.querySelector('nav a[onclick*="admin"]')?.closest('li');if(adminNav)adminNav.hidden=true;accountProfile=null;accountFriends=[];accountTournamentIds=[];}
      renderAuthState(currentUser);
      if (event === 'SIGNED_OUT') { location.reload(); }
      if (event === 'SIGNED_IN') {
        closeModal('loginModal');
        closeModal('registerModal');
        showNotification('Ты вошёл в Squadra. Добро пожаловать!');
      }
    });
    if(currentUser) {
      const tasks=[loadAccountData(),loadAdminAccess(),(async()=>{setupRealtime();await loadChatList();})()];
      await Promise.allSettled(tasks);
    } else {
      await Promise.allSettled([loadGameCatalog(),loadHomeTournaments(),loadCreatedTournaments(),loadPlatformEvents()]);
    }
    authInitialized=true;
    applyLocationRoute();
  }

  // Responsive tables, growing textareas and consistent limits for dynamically rendered forms.
  const fieldLimits = { gameSearch:80, plName:24, teamDirectorySearch:80, communityPostBody:3000, chatSearch:80, newChatSearch:24 };
  function enhanceFields(root=document) {
    Object.entries(fieldLimits).forEach(([id,limit]) => {
      const field=(root.matches?.('#'+id)?root:root.querySelector?.('#'+id))||document.getElementById(id);
      if(field && !field.maxLength) field.maxLength=limit;
    });
    root.querySelectorAll?.('input,textarea').forEach(field => {
      if(field.type==='file'||field.type==='hidden'||field.type==='checkbox'||field.type==='radio') return;
      field.style.resize='none';
      const max=field.maxLength;
      if(max>0 && !field.dataset.counterReady) {
        field.dataset.counterReady='true';
        const counter=document.createElement('small');
        counter.className='character-counter';
        counter.setAttribute('aria-live','polite');
        const update=()=>{counter.textContent=field.value.length+' / '+max;counter.classList.toggle('at-limit',field.value.length>=max);};
        field.addEventListener('input',update);
        field.addEventListener('change',update);
        if(field.parentElement?.classList.contains('chat-input')) field.parentElement.insertAdjacentElement('afterend',counter);
        else field.insertAdjacentElement('afterend',counter);
        update();
      }
      if(field instanceof HTMLTextAreaElement && !field.dataset.autoGrowReady) {
        field.dataset.autoGrowReady='true';
        field.style.overflowY='hidden';
        const grow=()=>{field.style.height='auto';const maxHeight=Math.min(window.innerHeight*.5,420);field.style.height=Math.min(field.scrollHeight,maxHeight)+'px';field.style.overflowY=field.scrollHeight>maxHeight?'auto':'hidden';};
        field.addEventListener('input',grow);
        field.addEventListener('change',grow);
        requestAnimationFrame(grow);
      }
    });
    root.querySelectorAll?.('table').forEach(table=>{
      if(table.parentElement?.classList.contains('table-scroll'))return;
      const wrapper=document.createElement('div');
      wrapper.className='table-scroll';
      wrapper.tabIndex=0;
      wrapper.setAttribute('role','region');
      wrapper.setAttribute('aria-label','Таблица. Прокрутите по горизонтали, чтобы увидеть остальные столбцы.');
      table.parentNode.insertBefore(wrapper,table);
      wrapper.appendChild(table);
    });
  }
  enhanceFields();
  const responsiveObserver=new MutationObserver(records=>{
    for(const record of records) for(const node of record.addedNodes) {
      if(node.nodeType===1) enhanceFields(node);
    }
  });
  responsiveObserver.observe(document.body,{childList:true,subtree:true});
  applyLocationRoute();
  window.addEventListener('load', () => { if (location.pathname !== '/') applyLocationRoute(); }, { once: true });
  initSupabaseAuth().catch(error => {
    console.error('Supabase Auth initialization failed:', error);
    authInitialized=true;applyLocationRoute();showNotification('Авторизация не загрузилась. Обнови страницу и попробуй ещё раз.');
  });
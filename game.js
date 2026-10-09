(() => {
  "use strict";
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const SAVE_KEY = "neonBurrowSave_v1";
  const now = () => Date.now();

  const upgradeDefs = [
    {id:"auto",name:"Авто-майнер",desc:"Пассивно добывает монеты каждую секунду.",icon:"⛏",kind:"passive",base:80,growth:1.15,effect:1,unit:"NB/сек"},
    {id:"quantum",name:"Квантовый тап",desc:"Увеличивает награду за каждый тап.",icon:"✦",kind:"active",base:120,growth:1.17,effect:1,unit:"NB/тап"},
    {id:"battery",name:"Энергоядро",desc:"Увеличивает максимальный запас энергии.",icon:"⚡",kind:"active",base:150,growth:1.16,effect:250,unit:"энергии"},
    {id:"drill",name:"Глубинный бур",desc:"Усиливает пассивный доход шахты.",icon:"◈",kind:"passive",base:500,growth:1.18,effect:5,unit:"NB/сек"},
    {id:"botnet",name:"Бот-сеть",desc:"Автоматические агенты собирают монеты.",icon:"⌘",kind:"passive",base:1400,growth:1.2,effect:18,unit:"NB/сек"},
    {id:"overclock",name:"Оверклок",desc:"Ускоряет восстановление энергии.",icon:"⟲",kind:"active",base:900,growth:1.19,effect:0.12,unit:"сек"}
  ];
  const skinDefs = [
    {id:"cyan",name:"Неоновый",desc:"Стандартный скин",price:0,cls:"skin-cyan"},
    {id:"pink",name:"Кибер-розовый",desc:"Розовая неоновая броня",price:2500,cls:"skin-pink"},
    {id:"gold",name:"Золотой майнер",desc:"Редкий золотой стиль",price:12000,cls:"skin-gold"},
    {id:"void",name:"Пустотный",desc:"Тёмная энергия бездны",price:50000,cls:"skin-void"}
  ];
  const freshState = () => ({
    coins:0,totalEarned:0,energy:1000,maxEnergy:1000,tapBase:1,taps:0,level:1,
    upgrades:{auto:0,quantum:0,battery:0,drill:0,botnet:0,overclock:0},
    skins:["cyan"],equippedSkin:"cyan",lastSeen:now(),lastDaily:0,dailyStreak:0,daysPlayed:1,
    lastDayKey:new Date().toDateString(),comboClaimed:false,safe:{lastPlayed:0,wonToday:false}
  });
  let state = loadState();
  let currentShop = "all", codeInput = "", safeCode = "", safeActive = false, safeEnds = 0, safeTick = null, toastTimer = null;

  function loadState(){
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return freshState();
      const s = {...freshState(), ...JSON.parse(raw)};
      s.upgrades = {...freshState().upgrades, ...(s.upgrades||{})};
      s.skins = Array.isArray(s.skins) ? s.skins : ["cyan"];
      const elapsed = Math.max(0, Math.min(30*24*3600, (now() - (Number(s.lastSeen)||now()))/1000));
      const passive = passiveRate(s) * elapsed;
      s.coins += passive;
      s.totalEarned += passive;
      s.energy = Math.min(s.maxEnergy, (Number(s.energy)||0) + elapsed * regenRate(s));
      const today = new Date().toDateString();
      if (s.lastDayKey !== today) { s.daysPlayed = (s.daysPlayed||1)+1; s.lastDayKey=today; }
      s.lastSeen = now();
      return s;
    } catch(e) { return freshState(); }
  }
  function save(){ state.lastSeen=now(); try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch(e){} }
  function passiveRate(s=state){ return (s.upgrades.auto||0)*1 + (s.upgrades.drill||0)*5 + (s.upgrades.botnet||0)*18; }
  function tapPower(s=state){ return (s.tapBase||1) + (s.upgrades.quantum||0); }
  function regenRate(s=state){ return 1 / Math.max(.45,1.2 - (s.upgrades.overclock||0)*.12); }
  function price(def){ return Math.floor(def.base * Math.pow(def.growth, state.upgrades[def.id]||0)); }
  function fmt(n){
    n = Math.floor(Math.max(0,n||0));
    if(n>=1e12)return (n/1e12).toFixed(2)+"T";
    if(n>=1e9)return (n/1e9).toFixed(2)+"B";
    if(n>=1e6)return (n/1e6).toFixed(2)+"M";
    if(n>=1e4)return (n/1e3).toFixed(1)+"K";
    return n.toLocaleString("ru-RU");
  }
  function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),1900);}
  function addCoins(n){if(n<=0)return;state.coins+=n;state.totalEarned+=n;}
  function update(){
    $("#coinBalance").innerHTML = `${fmt(state.coins)} <span>NB</span>`;
    $("#playerLevel").textContent = state.level;
    $("#profitHour").textContent = `${fmt(passiveRate()*3600)} NB`;
    $("#tapPower").textContent = `+${fmt(tapPower())} NB`;
    $("#energyText").textContent = `${fmt(state.energy)} / ${fmt(state.maxEnergy)}`;
    $("#energyFill").style.width = `${Math.max(0,Math.min(100,state.energy/state.maxEnergy*100))}%`;
    $("#energyRegen").textContent = `+1 каждые ${(1/regenRate()).toFixed(1)} сек`;
    $("#tapCombo").textContent = `COMBO ×${1+(state.upgrades.quantum||0)}`;
    $("#shopBalance").textContent = `${fmt(state.coins)} NB`;
    $("#totalEarned").textContent = `${fmt(state.totalEarned)} NB`;
    $("#totalTaps").textContent = fmt(state.taps);
    $("#totalUpgrades").textContent = fmt(Object.values(state.upgrades).reduce((a,b)=>a+b,0));
    $("#daysPlayed").textContent = state.daysPlayed||1;
    $("#profileLevel").textContent = String(state.level).padStart(2,"0");
    $("#profileRank").textContent = `${state.level>=20?"Легенда":state.level>=10?"Эксперт":state.level>=5?"Продвинутый":"Новичок"} • Уровень ${state.level}`;
    const dailyReady = now() - state.lastDaily >= 24*3600*1000;
    $("#dailyButton").disabled = !dailyReady;
    $("#dailyButton").textContent = dailyReady ? "ЗАБРАТЬ" : "ПОЛУЧЕНО";
    $("#dailyStatus").textContent = dailyReady ? `День ${Math.min(7,(state.dailyStreak||0)+1)} • награда ждёт` : "Следующая награда через 24 часа";
    $("#comboButton").disabled = state.comboClaimed || !(state.upgrades.auto>0 && state.upgrades.quantum>0);
    $("#comboStatus").textContent = state.comboClaimed ? "Комбо получено ✓" : "Бонус: +2 500 NB";
    renderUpgrades(); renderSkins();
  }
  function renderUpgrades(){
    const list=$("#upgradeList");
    list.innerHTML="";
    upgradeDefs.filter(d=>currentShop==="all"||d.kind===currentShop).forEach(def=>{
      const lvl=state.upgrades[def.id]||0, cost=price(def);
      const card=document.createElement("div");card.className="upgrade-card";
      card.innerHTML=`<div class="upgrade-icon">${def.icon}</div><div class="upgrade-info"><b>${def.name}</b><small>${def.desc}</small><div class="upgrade-level">УРОВЕНЬ ${lvl} · +${def.effect}${def.id==="overclock"?" сек к ускорению":` ${def.unit}`}</div></div><button class="buy-btn" ${state.coins<cost?"disabled":""}>КУПИТЬ<span>◈ ${fmt(cost)}</span></button>`;
      $(".buy-btn",card).addEventListener("click",()=>buyUpgrade(def));
      list.appendChild(card);
    });
  }
  function buyUpgrade(def){
    const cost=price(def); if(state.coins<cost){toast("Недостаточно монет");return;}
    state.coins-=cost;state.upgrades[def.id]=(state.upgrades[def.id]||0)+1;
    if(def.id==="battery"){state.maxEnergy+=250;state.energy=Math.min(state.maxEnergy,state.energy+250);}
    state.level=1+Math.floor(Math.sqrt(Object.values(state.upgrades).reduce((a,b)=>a+b,0)));
    save();update();toast(`${def.name}: уровень ${state.upgrades[def.id]}`);
  }
  function renderSkins(){
    const grid=$("#skinGrid");grid.innerHTML="";
    skinDefs.forEach(s=>{
      const owned=state.skins.includes(s.id), equipped=state.equippedSkin===s.id;
      const card=document.createElement("div");card.className="skin-card";
      card.innerHTML=`<div class="skin-preview"><svg viewBox="0 0 220 220" class="${s.cls}">${$(".hamster").innerHTML}</svg></div><b>${s.name}</b><small>${owned?s.desc:`Цена: ${fmt(s.price)} NB`}</small><button class="${equipped?"equipped":""}" ${equipped?"disabled":""}>${equipped?"НАДЕТО":owned?"НАДЕТЬ":`РАЗБЛОКИРОВАТЬ · ${fmt(s.price)}`}</button>`;
      $("button",card).addEventListener("click",()=>{
        if(owned){state.equippedSkin=s.id;applySkin();save();update();toast(`Скин «${s.name}» надет`);}
        else if(state.coins>=s.price){state.coins-=s.price;state.skins.push(s.id);state.equippedSkin=s.id;applySkin();save();update();toast("Новый скин разблокирован!");}
        else toast("Недостаточно монет");
      });
      grid.appendChild(card);
    });
  }
  function applySkin(){const el=$("#tapCharacter");el.classList.remove(...skinDefs.map(s=>s.cls));el.classList.add(skinDefs.find(s=>s.id===state.equippedSkin)?.cls||"skin-cyan");}
  function floating(amount,crit=false){
    const layer=$("#floatLayer"), el=document.createElement("div");el.className="float-text"+(crit?" crit":"");el.textContent=`+${fmt(amount)}${crit?" ✦":""}`;
    const x=35+Math.random()*30, y=34+Math.random()*27;el.style.left=x+"%";el.style.top=y+"%";layer.appendChild(el);setTimeout(()=>el.remove(),900);
  }
  function tap(e){
    if(state.energy<1){toast("Энергии нет — подожди восстановления");return;}
    state.energy=Math.max(0,state.energy-1);
    const crit=Math.random()<Math.min(.08+(state.upgrades.quantum||0)*.005,.25);
    const amount=tapPower()*(crit?3:1);addCoins(amount);state.taps++;
    state.level=Math.max(state.level,1+Math.floor(Math.sqrt(state.taps/30+Object.values(state.upgrades).reduce((a,b)=>a+b,0))));
    const btn=$("#tapCharacter");btn.classList.add("hit");setTimeout(()=>btn.classList.remove("hit"),100);
    floating(amount,crit);update();save();
  }
  function claimDaily(){
    if(now()-state.lastDaily<24*3600*1000){toast("Ежедневная награда уже получена");return;}
    state.dailyStreak=(state.dailyStreak||0)+1;
    const reward=500*state.dailyStreak;
    addCoins(reward);state.lastDaily=now();save();update();toast(`Ежедневный бонус: +${fmt(reward)} NB`);
  }
  function claimCombo(){
    if(state.comboClaimed||!(state.upgrades.auto>0&&state.upgrades.quantum>0))return;
    state.comboClaimed=true;addCoins(2500);save();update();toast("Комбо собрано! +2 500 NB");
  }
  function showView(id){
    $$(".view").forEach(v=>v.classList.toggle("active",v.id===id));
    $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
    if(id==="mineView")renderUpgrades();if(id==="skinsView")renderSkins();
  }
  function startSafe(){
    if(state.safe.wonToday){toast("Сейф уже взломан сегодня");return;}
    if(now()-state.safe.lastPlayed<24*3600*1000){toast("Новая попытка будет доступна через 24 часа");return;}
    safeCode=String(Math.floor(100+Math.random()*900));codeInput="";safeActive=true;safeEnds=now()+30000;
    $("#safeMessage").textContent="Введи код из трёх цифр. У тебя 30 секунд!";
    $("#startSafe").textContent="НОВАЯ ПОПЫТКА";$("#startSafe").disabled=true;updateSlots();
    clearInterval(safeTick);safeTick=setInterval(()=>{
      const left=Math.max(0,(safeEnds-now())/1000);$("#safeTimer").textContent=left.toFixed(1)+"s";
      if(left<=0){endSafe(false,"Время вышло. Сейф закрылся.");}
    },100);
  }
  function updateSlots(){for(let i=0;i<3;i++)$("#slot"+i).textContent=codeInput[i]||"?";}
  function endSafe(win,msg){
    safeActive=false;clearInterval(safeTick);state.safe.lastPlayed=now();
    if(win){state.safe.wonToday=true;addCoins(5000);state.level++;$("#safeMessage").textContent="Успех! +5 000 NB";toast("Сейф открыт: +5 000 NB");}
    else $("#safeMessage").textContent=msg;
    $("#startSafe").disabled=false;$("#startSafe").textContent=state.safe.wonToday?"ВЗЛОМАНО СЕГОДНЯ":"НАЧАТЬ ВЗЛОМ";
    save();update();
  }
  function keypadPress(btn){
    if(!safeActive){toast("Сначала начни взлом");return;}
    if(btn.dataset.digit!==undefined){if(codeInput.length<3)codeInput+=btn.dataset.digit;updateSlots();}
    else if(btn.dataset.action==="clear"){codeInput=codeInput.slice(0,-1);updateSlots();}
    else if(btn.dataset.action==="submit"){
      if(codeInput.length!==3){$("#safeMessage").textContent="Нужно ввести все три цифры.";return;}
      if(codeInput===safeCode){endSafe(true,"");return;}
      const exact=[...codeInput].filter((n,i)=>n===safeCode[i]).length;
      $("#safeMessage").textContent=`Не тот код. На правильных местах: ${exact} из 3.`;
      codeInput="";updateSlots();
    }
  }
  function resetProgress(){
    if(!confirm("Точно сбросить весь прогресс? Это действие нельзя отменить."))return;
    localStorage.removeItem(SAVE_KEY);state=freshState();codeInput="";applySkin();update();showView("tapView");toast("Прогресс сброшен");
  }

  $("#tapCharacter").addEventListener("pointerdown",tap);
  $("#dailyButton").addEventListener("click",claimDaily);
  $("#comboButton").addEventListener("click",claimCombo);
  $$(".nav-item").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
  $$(".shop-tab").forEach(b=>b.addEventListener("click",()=>{currentShop=b.dataset.shop;$$(".shop-tab").forEach(x=>x.classList.toggle("active",x===b));renderUpgrades();}));
  $("#keypad").addEventListener("click",e=>{const btn=e.target.closest("button");if(btn)keypadPress(btn);});
  $("#startSafe").addEventListener("click",startSafe);
  $("#profileButton").addEventListener("click",()=>showView("exchangeView"));
  $("#resetButton").addEventListener("click",resetProgress);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)save();else{const elapsed=Math.max(0,(now()-state.lastSeen)/1000);const income=passiveRate()*Math.min(elapsed,30*24*3600);addCoins(income);state.energy=Math.min(state.maxEnergy,state.energy+elapsed*regenRate());state.lastSeen=now();update();save();}});
  setInterval(()=>{
    const elapsed=Math.max(0,(now()-state.lastSeen)/1000);
    if(elapsed>0){const dt=Math.min(elapsed,2);const income=passiveRate()*dt;if(income){addCoins(income);}state.energy=Math.min(state.maxEnergy,state.energy+dt*regenRate());state.lastSeen=now();update();}
  },1000);
  window.addEventListener("pagehide",save);
  applySkin();update();
  if(state.coins>0)toast("С возвращением! Оффлайн-доход начислен");
})();
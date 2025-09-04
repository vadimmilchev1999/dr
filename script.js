(() => {
  // ===== Elements
  const gate = document.getElementById('gate');
  const hint = document.getElementById('hint');
  const startBtn = document.getElementById('startBtn');

  const fx = document.getElementById('fx');
  const countdown = document.getElementById('countdown');
  const countNum = countdown.querySelector('.num');
  const phrase = document.getElementById('phrase');
  const heart = document.getElementById('heart');
  const stars = document.getElementById('stars');
  const book = document.getElementById('book');

  const musicBtn = document.getElementById('musicToggle');
  const bgm = document.getElementById('bgm');

  // ===== Settings (timings tuned to match original)
  const TIMING = {
    countdownGap: 800,       // pause between numbers
    letterDelay: 90,         // stagger per letter
    letterHold: 900,         // hold after all letters shown
    phraseFadeOut: 700,      // duration of letters explosion
    heartDuration: 2000,     // pulse + fade
    postHeartGap: 100        // move to stars right after
  };

  const TEXT = "Happy Birthday to you";

  // ===== Utils
  function isLandscape(){ return innerWidth > innerHeight; }
  function on(el,ev,fn,opts){ el.addEventListener(ev,fn,Object.assign({passive:true},opts||{})); }

  // Orientation gate
  function updateGateText(){
    hint.textContent = isLandscape() ? "Готово! Нажмите «Начать»" : "Поверните устройство горизонтально";
  }
  on(window,'resize',updateGateText);
  on(window,'orientationchange',updateGateText);
  updateGateText();

  let armed = false;
  function tryStart(){
    if(!isLandscape()){ armed=true; updateGateText(); return; }
    gate.classList.add('hidden');
    begin();
  }
  on(startBtn,'click',tryStart);
  on(startBtn,'touchstart',tryStart);
  function autoStartAfterRotate(){
    if(armed && isLandscape()){ gate.classList.add('hidden'); begin(); armed=false; }
  }
  on(window,'resize',autoStartAfterRotate);
  on(window,'orientationchange',autoStartAfterRotate);

  // Music
  let playing=false;
  function toggleMusic(){
    if(!playing){ bgm.play().catch(()=>{}); }
    else { bgm.pause(); }
    playing=!playing;
    musicBtn.querySelector('.icon').textContent = playing ? '⏸' : '♪';
  }
  on(musicBtn,'click',toggleMusic);
  on(musicBtn,'touchstart',toggleMusic);

  // FX canvas (intro matrix-like)
  const fctx = fx.getContext('2d');
  function fitCanvas(c){
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio||1));
    c.width = Math.floor(innerWidth*dpr);
    c.height = Math.floor(innerHeight*dpr);
    c.style.width = innerWidth+'px'; c.style.height = innerHeight+'px';
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return ctx;
  }
  function startIntroFX(){
    fitCanvas(fx);
    const letters = "HAPPYBIRTHDAY".split("");
    const fontSize = Math.max(14, Math.floor(innerWidth/50));
    const columns = Math.floor(innerWidth / fontSize);
    const drops = Array(columns).fill(0);
    let raf;
    function frame(){
      fctx.fillStyle = "rgba(0,0,0,0.08)";
      fctx.fillRect(0,0,innerWidth,innerHeight);
      fctx.fillStyle = "#c77dff";
      fctx.font = "bold "+fontSize+"px Menlo, Consolas, monospace";
      for(let i=0;i<columns;i++){
        const text = letters[Math.floor(Math.random()*letters.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        fctx.fillText(text, x, y);
        if(y > innerHeight && Math.random()>0.975){ drops[i]=0; } else { drops[i]++; }
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return ()=> cancelAnimationFrame(raf);
  }

  // Countdown (3-2-1)
  function runCountdown(done){
    let n=3;
    countdown.classList.remove('hidden');
    countNum.textContent = n;
    function next(){
      if(n===1){
        countdown.classList.add('hidden');
        done(); return;
      }
      n--;
      // restart animation
      countNum.style.animation='none';
      // force reflow
      void countNum.offsetWidth;
      countNum.textContent = n;
      countNum.style.animation='';
      setTimeout(next, TIMING.countdownGap);
    }
    setTimeout(next, TIMING.countdownGap);
  }

  // Phrase build + exact stagger + explode out
  function buildPhrase(){
    phrase.innerHTML='';
    let i=0;
    for(const ch of TEXT){
      if(ch===' '){ const s=document.createElement('span'); s.className='space'; phrase.appendChild(s); continue; }
      const el=document.createElement('span');
      el.className='letter';
      el.textContent=ch;
      el.style.setProperty('--i', i);
      // precompute random explode vector
      const dx=((Math.random()*2-1)*80|0)+'px';
      const dy=((Math.random()*2-1)*60|0)+'px';
      const rot=((Math.random()*50-25)|0)+'deg';
      el.style.setProperty('--dx', dx);
      el.style.setProperty('--dy', dy);
      el.style.setProperty('--rot', rot);
      phrase.appendChild(el);
      i++;
    }
    phrase.classList.remove('hidden');
  }
  function phraseOut(cb){
    const letters=[...phrase.querySelectorAll('.letter')];
    // start explosive fade after hold
    setTimeout(()=>{
      letters.forEach((el,idx)=>{
        // slight additional stagger on exit to mimic original
        setTimeout(()=> el.classList.add('out'), idx*12);
      });
      setTimeout(()=>{ phrase.classList.add('hidden'); cb(); }, TIMING.phraseFadeOut + 150);
    }, TIMING.letterHold + letters.length*TIMING.letterDelay*0.1);
  }

  // Heart
  function runHeart(cb){
    heart.classList.remove('hidden');
    heart.classList.add('show');
    setTimeout(()=>{
      heart.classList.remove('show');
      heart.classList.add('hidden');
      cb();
    }, TIMING.heartDuration);
  }

  // Stars
  const sctx = stars.getContext('2d');
  function startStars(){
    stars.classList.remove('hidden');
    fitCanvas(stars);
    const count = Math.min(500, Math.floor(innerWidth*innerHeight/3000));
    const arr = Array.from({length:count}, ()=> ({
      x: Math.random()*innerWidth,
      y: Math.random()*innerHeight,
      z: Math.random()*0.7 + 0.3,
      tw: Math.random()*1000|0
    }));
    let raf;
    function frame(t){
      sctx.clearRect(0,0,innerWidth,innerHeight);
      for(const s of arr){
        const r = 0.7 + s.z*1.6;
        const a = 0.6 + Math.sin((t+s.tw)/600)*0.4;
        sctx.globalAlpha = a;
        sctx.fillStyle = '#fff';
        sctx.beginPath();
        sctx.arc(s.x, s.y, r, 0, Math.PI*2);
        sctx.fill();
      }
      sctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    frame(0);
    return ()=> cancelAnimationFrame(raf);
  }

  // Book with placeholders
  const PAGES = [
    { title: "С Днём Рождения!", text: "Пусть исполняются мечты.", img: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'><rect width='100%' height='100%' fill='%239d4edd'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='64' fill='white'>Фото 1</text></svg>" },
    { title: "Рядом с тобой тепло", text: "Спасибо, что ты есть.", img: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'><rect width='100%' height='100%' fill='%238a5adf'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='64' fill='white'>Фото 2</text></svg>" },
    { title: "Счастья и улыбок", text: "Каждый день, каждый миг.", img: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'><rect width='100%' height='100%' fill='%237b49d3'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='64' fill='white'>Фото 3</text></svg>" },
    { title: "Любви и света", text: "Пусть в сердце будет солнце.", img: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'><rect width='100%' height='100%' fill='%23643abf'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='64' fill='white'>Фото 4</text></svg>" },
  ];
  function buildBook(){
    book.innerHTML='';
    const node = document.createElement('div');
    node.className='book';
    const left = document.createElement('div');
    const right = document.createElement('div');
    left.className='page'; right.className='page';
    left.innerHTML = '<div class="inner"></div>'; right.innerHTML = '<div class="inner"></div>';
    node.appendChild(left); node.appendChild(right);
    book.appendChild(node);
    let idx=0;
    function render(){
      const l=left.querySelector('.inner'); const r=right.querySelector('.inner');
      l.innerHTML = pageHTML(PAGES[idx]);
      r.innerHTML = PAGES[idx+1] ? pageHTML(PAGES[idx+1]) : '<div class="inner"></div>';
      left.classList.remove('flipped'); right.classList.remove('flipped');
    }
    function pageHTML(p){ return `<img src="${p.img}" alt=""><h3>${p.title}</h3><p>${p.text}</p>`; }
    render();
    function next(){
      left.classList.add('flipped');
      setTimeout(()=> right.classList.add('flipped'), 80);
      setTimeout(()=>{
        idx+=2; if(idx>=PAGES.length) idx=0;
        render();
      }, 760);
    }
    on(node,'click',next);
    on(node,'touchstart',(e)=>{ e.preventDefault(); next(); },{passive:false});
  }

  // ===== Sequence controller
  function begin(){
    const stopIntro = startIntroFX();
    runCountdown(()=>{
      // Build and show phrase
      buildPhrase();
      // schedule phrase out -> heart -> stars -> book
      const letters = TEXT.replace(/\\s/g,'').length;
      const fullInTime = letters * TIMING.letterDelay + TIMING.letterHold;
      setTimeout(()=>{
        phraseOut(()=>{
          heart.classList.remove('hidden');
          heart.classList.add('show');
          runHeart(()=>{
            stopIntro();
            fx.style.display='none';
            setTimeout(()=>{
              startStars();
              book.classList.remove('hidden');
              buildBook();
            }, TIMING.postHeartGap);
          });
        });
      }, fullInTime);
    });
  }

})();
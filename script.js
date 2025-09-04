(() => {
  const PHRASE = "Happy Birthday to you";
  const phraseEl = document.getElementById('phrase');
  const heartEl = document.getElementById('heart');
  const matrix = document.getElementById('matrix');
  const starfield = document.getElementById('starfield');
  const bookSection = document.getElementById('book');
  const confettiCanvas = document.getElementById('confetti');
  const confettiCtx = confettiCanvas.getContext('2d');
  const musicBtn = document.getElementById('musicToggle');
  const bgm = document.getElementById('bgm');
  const countdown = document.getElementById('countdown');
  const startGate = document.getElementById('orientation-lock');
  const startBtn = document.getElementById('startBtn');
  const hint = document.getElementById('hint');

  // ===== Helpers =====
  function on(el, ev, fn, opts){ el.addEventListener(ev, fn, Object.assign({passive:true}, opts||{})); }
  function isPortrait(){ return window.innerHeight >= window.innerWidth; }

  // ===== Orientation gate (robust) =====
  let armed = false; // user tapped "Начать" at least once
  function updateGate(){
    if(isPortrait()){
      hint.textContent = "Готово! Нажмите «Начать»";
    }else{
      hint.textContent = "Поверните устройство вертикально";
    }
  }
  on(window, 'resize', updateGate);
  on(window, 'orientationchange', updateGate);
  updateGate();

  function hideGate(){
    startGate.classList.add('hidden');
  }

  function tryStart(){
    if(!isPortrait()){
      armed = true;
      updateGate();
      return; // wait for rotate
    }
    hideGate();
    beginSequence();
  }

  on(startBtn, 'click', tryStart);
  on(startBtn, 'touchstart', tryStart);

  // Auto-start once rotated after user armed it
  function autoBeginAfterRotate(){
    if(armed && isPortrait()){
      hideGate();
      beginSequence();
      armed = false;
    }
  }
  on(window, 'resize', autoBeginAfterRotate);
  on(window, 'orientationchange', autoBeginAfterRotate);

  // ===== Music =====
  let playing = false;
  function toggleMusic(){
    if(!playing){ bgm.play().catch(()=>{}); }
    else { bgm.pause(); }
    playing = !playing;
    musicBtn.querySelector('.icon').textContent = playing ? '⏸' : '♪';
  }
  on(musicBtn, 'click', toggleMusic);
  on(musicBtn, 'touchstart', toggleMusic);

  // ===== Countdown =====
  function resetCountdownDOM(){
    // rebuild inner to restart dot animation each time
    countdown.innerHTML = '<div class="wrap"><div class="dot"></div><div class="num">3</div></div>';
  }
  function runCountdown(seconds = 3, done){
    resetCountdownDOM();
    countdown.classList.remove('hidden');
    const num = countdown.querySelector('.num');
    let t = seconds;
    num.textContent = t;
    const timer = setInterval(() => {
      t--; num.textContent = t;
      if(t<=0){
        clearInterval(timer);
        countdown.classList.add('hidden');
        done && done();
      }
    }, 1000);
  }

  // ===== Canvas helpers =====
  function fitCanvas(c){
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    c.width = Math.floor(innerWidth * dpr);
    c.height = Math.floor(innerHeight * dpr);
    c.style.width = innerWidth+'px';
    c.style.height = innerHeight+'px';
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return ctx;
  }

  // ===== Matrix rain (intro background) =====
  const mctx = matrix.getContext('2d');
  function startMatrix(){
    fitCanvas(matrix);
    const letters = "HAPPYBIRTHDAY".split("");
    const fontSize = Math.max(14, Math.floor(innerWidth/50));
    const columns = Math.floor(innerWidth / fontSize);
    const drops = Array(columns).fill(0);
    let raf;
    function frame(){
      mctx.fillStyle = "rgba(0,0,0,0.08)";
      mctx.fillRect(0,0,innerWidth,innerHeight);
      mctx.fillStyle = "#c77dff";
      mctx.font = "bold "+fontSize+"px Menlo, Consolas, monospace";
      for(let i=0;i<columns;i++){
        const text = letters[Math.floor(Math.random()*letters.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        mctx.fillText(text, x, y);
        if(y > innerHeight && Math.random()>0.975){ drops[i]=0; } else { drops[i]++; }
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    function stop(){ cancelAnimationFrame(raf); }
    return stop;
  }

  // ===== Phrase animation =====
  function buildPhrase(){
    phraseEl.innerHTML = "";
    let i=0;
    for(const ch of PHRASE){
      if(ch === " "){
        const span = document.createElement("span");
        span.className = "space";
        phraseEl.appendChild(span);
        continue;
      }
      const span = document.createElement("span");
      span.className = "letter";
      span.style.setProperty("--i", i);
      span.textContent = ch;
      // burst on show
      span.addEventListener("animationstart", () => {
        setTimeout(() => burstFromElement(span, 10), 120);
      }, { once: true });
      phraseEl.appendChild(span);
      i++;
    }
  }
  function fadeOutPhrase(cb){
    const letters = phraseEl.querySelectorAll('.letter');
    letters.forEach((el, idx) => {
      el.style.transition = 'opacity .5s ease '+(idx*20)+'ms, transform .5s ease '+(idx*20)+'ms';
      el.style.opacity = '0';
      el.style.transform = 'translateY(12px) scale(.96)';
    });
    setTimeout(cb, 800 + letters.length*20);
  }

  // ===== Heart animation =====
  function showHeart(cb){
    heartEl.classList.add('show');
    // Big confetti burst during heart pulse
    setTimeout(() => burst(innerWidth*0.5, innerHeight*0.45, 200, 1.4), 400);
    setTimeout(() => {
      heartEl.classList.remove('show');
      cb && cb();
    }, 1300);
  }

  // ===== Starfield =====
  const sctx = starfield.getContext('2d');
  let stars = [];
  function startStarfield(){
    starfield.classList.remove('hidden');
    fitCanvas(starfield);
    const count = Math.min(400, Math.floor(innerWidth*innerHeight / 3500));
    stars = Array.from({length:count}, () => ({
      x: Math.random()*innerWidth,
      y: Math.random()*innerHeight,
      z: Math.random()*0.7 + 0.3,
      tw: Math.random()*1000|0
    }));
    let raf;
    function frame(t){
      sctx.clearRect(0,0,innerWidth,innerHeight);
      for(const s of stars){
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
    return () => cancelAnimationFrame(raf);
  }

  // ===== Book =====
  const PAGES = [
    { title: "С Днём Рождения!", text: "Пусть исполняются мечты.", img: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><rect width='100%' height='100%' fill='%239d4edd'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='48' fill='white'>Фото 1</text></svg>" },
    { title: "Рядом с тобой тепло", text: "Спасибо, что ты есть.", img: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><rect width='100%' height='100%' fill='%238a5adf'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='48' fill='white'>Фото 2</text></svg>" },
    { title: "Счастья и улыбок", text: "Каждый день, каждый миг.", img: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><rect width='100%' height='100%' fill='%237b49d3'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='48' fill='white'>Фото 3</text></svg>" },
    { title: "Любви и света", text: "Пусть в сердце будет солнце.", img: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><rect width='100%' height='100%' fill='%23643abf'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='48' fill='white'>Фото 4</text></svg>" },
  ];
  function buildBook(){
    bookSection.innerHTML = "";
    const book = document.createElement('div');
    book.className = 'book';
    const left = document.createElement('div');
    const right = document.createElement('div');
    left.className = 'page'; right.className = 'page';
    left.innerHTML = '<div class="inner"></div>'; right.innerHTML = '<div class="inner"></div>';
    book.appendChild(left); book.appendChild(right);
    bookSection.appendChild(book);

    let idx = 0;
    function render(){
      const l = left.querySelector('.inner'); const r = right.querySelector('.inner');
      l.innerHTML = pageHTML(PAGES[idx]);
      r.innerHTML = PAGES[idx+1] ? pageHTML(PAGES[idx+1]) : '<div class="inner"></div>';
      left.classList.remove('flipped'); right.classList.remove('flipped');
    }
    function pageHTML(p){
      return `<img src="${p.img}" alt=""><h3>${p.title}</h3><p>${p.text}</p>`;
    }
    render();

    // Tap to flip (each tap shows next spread)
    function next(){
      left.classList.add('flipped');
      setTimeout(()=> right.classList.add('flipped'), 80);
      setTimeout(()=>{
        idx += 2;
        if(idx >= PAGES.length) idx = 0; // loop
        render();
      }, 750);
    }
    on(book, 'click', next);
    on(book, 'touchstart', (e)=>{ e.preventDefault(); next(); }, {passive:false});
  }

  // ===== Confetti system =====
  function fitConfetti(){
    fitCanvas(confettiCanvas);
  }
  fitConfetti(); on(window, 'resize', fitConfetti);

  const COLORS = ["#ff6b6b","#ffd166","#06d6a0","#4dabf7","#f78c6b","#c492ff","#8ce99a","#fab005","#66d9e8","#ffa8a8"];
  let particles = []; let rafId = null;
  function loop(){
    confettiCtx.clearRect(0,0,innerWidth,innerHeight);
    const g = 0.18;
    for(let i = particles.length - 1; i >= 0; i--){
      const p = particles[i];
      p.vy += g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 1;
      if(p.life <= 0 || p.y > innerHeight + 50){ particles.splice(i,1); continue; }
      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rot);
      confettiCtx.globalAlpha = Math.max(0, p.life/p.maxLife);
      if(p.type === "rect"){
        confettiCtx.fillStyle = p.color;
        confettiCtx.fillRect(-p.size/2, -p.size/2, p.size, p.size*0.6);
      } else {
        confettiCtx.beginPath();
        confettiCtx.fillStyle = p.color;
        confettiCtx.arc(0,0,p.size/2,0,Math.PI*2);
        confettiCtx.fill();
      }
      confettiCtx.restore();
    }
    if(particles.length > 0){ rafId = requestAnimationFrame(loop); }
    else { cancelAnimationFrame(rafId); rafId = null; }
  }
  function pushParticles(list){
    particles.push(...list);
    if(!rafId) rafId = requestAnimationFrame(loop);
  }
  function burst(x,y,count=24,spread=1){
    const out=[];
    for(let i=0;i<count;i++){
      const ang = (Math.random()*Math.PI*2);
      const speed = (Math.random()*4 + 2) * spread;
      out.push({
        x, y,
        vx: Math.cos(ang)*speed,
        vy: Math.sin(ang)*speed - 2,
        rot: Math.random()*Math.PI,
        vr: (Math.random()-0.5)*0.2,
        size: Math.random()*8 + 6,
        color: COLORS[(Math.random()*COLORS.length)|0],
        life: 50 + (Math.random()*25|0),
        maxLife: 75,
        type: Math.random() < 0.6 ? "rect" : "circle"
      });
    }
    pushParticles(out);
  }
  function elementCenter(el){
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height*.35 };
  }
  function burstFromElement(el, count=16){
    const {x,y} = elementCenter(el);
    burst(x, y, count, 1);
  }

  // ===== Sequence =====
  let stopMatrix = null;
  function beginSequence(){
    // Start matrix
    stopMatrix = startMatrix();
    // Countdown
    runCountdown(3, () => {
      // show phrase letters
      buildPhrase();
      // After word shows, fade and heart, then starfield + book
      setTimeout(() => {
        fadeOutPhrase(() => {
          // Heart
          heartEl.classList.add('show');
          showHeart(() => {
            // Transition
            if(stopMatrix) stopMatrix();
            matrix.style.display = 'none';
            startStarfield();
            bookSection.classList.remove('hidden');
            buildBook();
          });
        });
      }, 2600);
    });
  }

})();
'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const SIZE = PlaygroundData.size;
  const PIXELS = SIZE * SIZE;
  const colors = { green: '#34553b', off: '#e5ebd7', lime: '#b7ca8b', orange: '#bb7857' };
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let presetId = 'shapes';
  let patterns = [];
  let selectedPattern = 0;
  let selectedUnit = 0;
  let model = null;
  let training = false;
  let trained = false;
  let trainingToken = 0;
  let errors = [];
  let mode = 'dream';
  let sampleCount = 0;
  const SAMPLING_STEPS = 100;
  const SNAPSHOT_STEPS = [0, 1, 10, SAMPLING_STEPS];
  let sampling = null;
  let samplingTimer = null;
  let outputPixels = Array(PIXELS).fill(0);
  let restoreInput = null;
  let drawing = Array(PIXELS).fill(0);
  let painting = false;
  let paintValue = 1;
  let rovingIndex = 0;

  function matrix(pixels) { return new LinearAlgebra.DenseMatrix(1, PIXELS, pixels); }
  function dataset() { return new LinearAlgebra.DenseMatrix(patterns.length, PIXELS, patterns.flatMap(pattern => pattern.pixels)); }
  function noise() { return Array.from({ length: PIXELS }, () => Math.random() < 0.33 ? 1 : 0); }
  function drawPixels(canvas, pixels, options = {}) {
    const ctx = canvas.getContext('2d');
    const cell = canvas.width / SIZE;
    const gap = options.gap === undefined ? cell * .12 : options.gap;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const index = y * SIZE + x;
        ctx.fillStyle = options.colorFn ? options.colorFn(pixels[index], index) : pixels[index] ? (options.on || colors.green) : (options.off || colors.off);
        ctx.fillRect(x * cell + gap / 2, y * cell + gap / 2, cell - gap, cell - gap);
      }
    }
  }
  function smallCanvas(pixels, size = 100) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.setAttribute('aria-hidden', 'true');
    drawPixels(canvas, pixels);
    return canvas;
  }
  function updateOutput(pixels, label) {
    outputPixels = pixels.slice();
    drawPixels($('outputCanvas'), outputPixels);
    $('outputCanvas').setAttribute('aria-label', label);
  }

  function drawHero() {
    const canvas = $('heroCanvas');
    const ctx = canvas.getContext('2d');
    const step = 21;
    const cx = 530;
    const cy = 380;
    let seed = 62;
    function random() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // An editorial illustration, deliberately distinct from the live model output.
    for (let y = 2; y < 32; y++) {
      for (let x = 1; x < 43; x++) {
        const px = x * step + 45;
        const py = y * step + 27;
        const dx = px - cx;
        const dy = py - cy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const ring = distance > 132 && distance < 242;
        const fade = Math.max(0, Math.min(1, (px - 170) / 530));
        const scatter = random();
        const occupied = ring ? scatter < .27 + fade * .8 : scatter < .095 * (1 - fade);
        if (!occupied) {
          if (distance < 320 && random() > .76) { ctx.fillStyle = '#a6b69321'; ctx.fillRect(px + 8, py + 8, 2, 2); }
          continue;
        }
        const palette = fade > .75 ? ['#2f4c37','#3d5b3c','#657e4c','#a3b879'] : ['#698354','#8fa56b','#b1c486','#c3d098','#9aad72'];
        ctx.fillStyle = palette[Math.floor(random() * palette.length)];
        const scale = px < 330 ? .5 + random() * .5 : 1;
        const size = 18 * scale;
        ctx.fillRect(px, py, size, size);
      }
    }
    ctx.strokeStyle = '#81946d40';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 6]);
    ctx.beginPath(); ctx.arc(cx + 10, cy, 285, -.38, 1.12); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 10, cy, 285, 2.1, 3.5); ctx.stroke();
    ctx.setLineDash([]);
    for (const [x,y] of [[820,205],[283,573],[568,65]]) {
      ctx.strokeStyle = '#6c815b70'; ctx.beginPath(); ctx.moveTo(x-6,y); ctx.lineTo(x+6,y); ctx.moveTo(x,y-6); ctx.lineTo(x,y+6); ctx.stroke();
    }
  }

  function renderConcept() {
    const shapes = PlaygroundData.presets[0].patterns;
    $('conceptPatterns').replaceChildren(...shapes.slice(0,3).map(pattern => smallCanvas(pattern.pixels)));
    const hybrid = shapes[0].pixels.map((value, i) => i % SIZE < 7 ? value : shapes[1].pixels[i]);
    drawPixels($('conceptOutput'), hybrid);
    const countVisible = 15;
    const countHidden = 8;
    let lines = '';
    let dots = '';
    for (let v = 0; v < countVisible; v++) {
      const x = 20 + v * 40;
      for (let h = 0; h < countHidden; h++) {
        const hx = 90 + h * 60;
        lines += `<line x1="${x}" y1="22" x2="${hx}" y2="130" stroke="#9aaf7e" stroke-opacity="${(v+h)%4===0 ? '.45' : '.13'}" stroke-width="${(v+h)%4===0 ? '1.3' : '.7'}"/>`;
      }
      dots += `<circle cx="${x}" cy="22" r="6" fill="${v%3 ? '#4c6a47' : '#a8bd83'}"/>`;
    }
    for (let h = 0; h < countHidden; h++) dots += `<circle cx="${90+h*60}" cy="130" r="9" fill="${h%3 ? '#bdcf97' : '#789b61'}" stroke="#90aa6f" stroke-width="1"/>`;
    $('networkDiagram').innerHTML = `<svg viewBox="0 0 600 155" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${lines}${dots}</svg>`;
  }

  function renderPatterns() {
    const hadFocus = $('trainingPatterns').contains(document.activeElement);
    const nodes = patterns.map((pattern,index) => {
      const button = document.createElement('button');
      button.className = `pattern-button${index===selectedPattern ? ' selected' : ''}`;
      button.type = 'button';
      button.setAttribute('aria-label', `Select ${pattern.name}${mode==='restore' ? ' to restore' : ' pattern'}`);
      button.setAttribute('aria-pressed', String(index===selectedPattern));
      const label = document.createElement('span');
      label.textContent = pattern.name;
      button.append(smallCanvas(pattern.pixels), label);
      button.addEventListener('click', () => {
        selectedPattern = index;
        renderPatterns();
        if (mode === 'restore') prepareRestore();
        else {
          mode = 'restore';
          syncMode();
          prepareRestore();
        }
      });
      return button;
    });
    $('trainingPatterns').replaceChildren(...nodes);
    if (hadFocus) nodes[selectedPattern].focus({preventScroll:true});
    $('exampleCount').textContent = `${patterns.length} EXAMPLES`;
    $('drawButton').disabled = patterns.length >= 18 || training;
  }

  function drawChart() {
    const canvas = $('errorChart');
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    const w = rect.width;
    const h = rect.height;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#dfe5d6';
    ctx.setLineDash([2,4]);
    for (let i=0; i<4; i++) { const y = 8 + i*(h-16)/3; ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke(); }
    ctx.setLineDash([]);
    if (!errors.length) return;
    const maxError = Math.max(.27,...errors) * 1.07;
    const total = Number($('epochs').value);
    const point = (value,index) => [index / Math.max(1,total-1) * w, h-6-(value/maxError)*(h-15)];
    ctx.beginPath();
    errors.forEach((value,index) => { const [x,y] = point(value,index); index===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y); });
    ctx.lineTo(point(0,errors.length-1)[0],h);ctx.lineTo(0,h);ctx.closePath();
    const gradient = ctx.createLinearGradient(0,0,0,h);gradient.addColorStop(0,'#829e5530');gradient.addColorStop(1,'#829e5502');ctx.fillStyle=gradient;ctx.fill();
    ctx.beginPath(); errors.forEach((value,index) => { const [x,y]=point(value,index);index===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
    ctx.strokeStyle = '#587c3e';ctx.lineWidth=1.6;ctx.lineJoin='round';ctx.stroke();
    const [x,y] = point(errors[errors.length-1],errors.length-1);ctx.beginPath();ctx.arc(x,y,2.8,0,Math.PI*2);ctx.fillStyle='#42652e';ctx.fill();
  }

  function renderUnits() {
    const hadFocus = $('hiddenUnitButtons').contains(document.activeElement);
    const count = Number($('hiddenUnits').value);
    if (selectedUnit >= count) selectedUnit = 0;
    const activations = model ? model.getHiddenUnitsGrid().values : [];
    const nodes = Array.from({length:count},(_,index) => {
      const button = document.createElement('button');
      button.type='button';
      button.className = `unit-button${index===selectedUnit ? ' selected':''}`;
      button.disabled=!trained;
      button.setAttribute('aria-label',`Inspect hidden unit ${index+1}`);
      button.setAttribute('aria-pressed',String(index===selectedUnit));
      button.title=`Hidden unit ${index+1}`;
      if (trained) button.style.background = `hsl(92 27% ${82-(activations[index] || 0)*45}%)`;
      button.addEventListener('click',()=> {selectedUnit=index;renderUnits();});
      return button;
    });
    $('hiddenUnitButtons').replaceChildren(...nodes);
    if (hadFocus && trained) nodes[selectedUnit].focus({preventScroll:true});
    if (!trained || !model) {
      drawPixels($('featureCanvas'),Array(PIXELS).fill(0),{off:'#e2e8d7'});
      $('featureStatus').textContent='Train the model to reveal its connections.';
      return;
    }
    const weights = model.weights.col(selectedUnit).values;
    const max = Math.max(.001,...weights.map(Math.abs));
    drawPixels($('featureCanvas'),weights,{colorFn:value=> {
      const strength = Math.min(1,Math.abs(value)/max);
      const base=[237,239,224]; const target=value>=0?[42,82,49]:[186,112,75];
      return `rgb(${base.map((v,i)=>Math.round(v+(target[i]-v)*strength)).join(',')})`;
    }});
    $('featureStatus').textContent=`Unit ${selectedUnit+1} of ${count} · color scaled to this unit’s strongest weight`;
    $('featureCanvas').setAttribute('aria-label',`Signed connection weights for hidden unit ${selectedUnit+1}`);
  }

  function setTrainingUI(active) {
    training = active;
    document.querySelectorAll('[data-preset], #hiddenUnits, #epochs').forEach(el=>el.disabled=active);
    $('drawButton').disabled=active || patterns.length>=18;
    $('generateButton').disabled=active || !trained;
    $('trainButtonText').textContent=active?'Pause training':trained?'Train again':'Train the model';
    $('trainButton').querySelector('.play-icon').textContent=active?'Ⅱ':'▶';
  }

  function resetModel() {
    cancelSampling();
    trainingToken++;
    model=null;trained=false;errors=[];sampleCount=0;
    setTrainingUI(false);
    $('progressFill').style.width='0%';
    $('trainingProgress').setAttribute('aria-valuenow','0');
    $('trainingProgress').setAttribute('aria-valuemax',$('epochs').value);
    $('trainingStatus').textContent='Ready when you are.';
    $('errorValue').textContent='—';
    $('epochAxis').textContent=`${Number($('epochs').value).toLocaleString()} EPOCHS`;
    $('chartEmpty').hidden=false;
    $('outputTag').textContent='BEFORE LEARNING';
    $('outputStatus').textContent='First, teach your machine a few patterns.';
    updateOutput(noise(),'Untrained random pixel pattern');
    drawChart();renderUnits();
    if(mode==='restore')prepareRestore();
  }

  function setPreset(id) {
    presetId=id;
    const preset=PlaygroundData.presets.find(item=>item.id===id);
    patterns=preset.patterns.map(pattern=>({name:pattern.name,pixels:pattern.pixels.slice()}));
    selectedPattern=0;
    document.querySelectorAll('[data-preset]').forEach(button=>{const active=button.dataset.preset===id;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    renderPatterns();resetModel();
  }

  function train() {
    cancelSampling();
    if (training) {
      trainingToken++;
      trained=errors.length>0;
      setTrainingUI(false);
      $('trainButtonText').textContent='Continue training';
      $('trainingStatus').textContent=`Paused at epoch ${errors.length}. Continue when you’re ready.`;
      $('outputTag').textContent='TRAINING PAUSED';
      $('outputStatus').textContent='Try the partly trained model, or continue learning.';
      renderUnits();
      return;
    }
    const continuing = model && errors.length > 0 && errors.length < Number($('epochs').value);
    if (!continuing) {
      model=new MachineLearning.RBM(PIXELS,Number($('hiddenUnits').value),42);
      errors=[];trained=false;sampleCount=0;
      renderUnits();
    }
    const data=dataset();
    const target=Number($('epochs').value);
    const token=++trainingToken;
    $('chartEmpty').hidden=true;
    setTrainingUI(true);
    $('trainingStatus').textContent='Finding relationships between pixels…';
    $('outputStatus').textContent='Learning a little more with every pass.';
    $('outputTag').textContent='LEARNING IN PROGRESS';
    const tick=()=> {
      if(token!==trainingToken)return;
      const start=performance.now();
      try {
        do { errors.push(model.runEpoch(data).error); } while(errors.length<target && performance.now()-start<13);
      } catch(error) {
        setTrainingUI(false);
        $('trainingStatus').textContent='Training stopped. Reset the experiment and try again.';
        console.error(error);
        return;
      }
      const epoch=errors.length;
      $('errorValue').textContent=errors[epoch-1].toFixed(4);
      $('progressFill').style.width=`${epoch/target*100}%`;
      $('trainingProgress').setAttribute('aria-valuenow',String(epoch));
      $('trainingStatus').textContent=`Epoch ${epoch.toLocaleString()} of ${target.toLocaleString()} · learning the patterns`;
      drawChart();
      if(epoch<target)requestAnimationFrame(tick);
      else {
        trained=true;
        setTrainingUI(false);
        $('trainingStatus').textContent=`${target.toLocaleString()} epochs complete. A little world, learned.`;
        renderUnits();
        if(mode==='dream')generate();
        else {prepareRestore();$('outputStatus').textContent='Ready to imagine the missing half.';}
      }
    };
    requestAnimationFrame(tick);
  }

  function syncMode() {
    cancelSampling();
    document.querySelectorAll('[data-mode]').forEach(button=>{const active=button.dataset.mode===mode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    $('randomnessControl').hidden=mode!=='dream';
    $('restoreControl').hidden=mode!=='restore';
    $('generateButtonText').textContent=mode==='dream'?'Generate a pattern':'Restore the pattern';
    $('outputDescription').textContent=mode==='dream'?'Start with noise. Let the learned relationships guide what comes next.':'Keep half the picture. Ask the model to imagine what’s missing.';
  }

  function prepareRestore() {
    cancelSampling();
    const source=patterns[selectedPattern].pixels;
    restoreInput=source.map((value,i)=>i%SIZE<7?value:0);
    updateOutput(restoreInput,`${patterns[selectedPattern].name} with its right half hidden`);
    const canvas=$('outputCanvas');
    drawPixels(canvas,restoreInput,{colorFn:(value,index)=>index%SIZE>=7?'#d1dbc0':value?colors.green:colors.off});
    $('outputTag').textContent='RIGHT HALF HIDDEN';
    $('outputStatus').textContent=trained?'The visible half will stay exactly as you left it.':'Train the model, then restore the missing pixels.';
  }

  function cancelSampling() {
    clearTimeout(samplingTimer);
    samplingTimer = null;
    // The identity check in every scheduled step also rejects stale callbacks.
    sampling = null;
    $('samplingPlayer').hidden = true;
    $('temperature').disabled = false;
    $('generateButtonText').textContent = mode === 'dream' ? 'Generate a pattern' : 'Restore the pattern';
  }

  function syncPlayback() {
    if (!sampling) return;
    const finished = sampling.step === SAMPLING_STEPS;
    $('samplingState').textContent = finished ? 'CHAIN COMPLETE' : sampling.playing ? 'IMAGINING' : 'PAUSED';
    $('playbackButton').textContent = finished ? 'Replay' : sampling.playing ? 'Pause' : 'Play';
    $('stepButton').disabled = finished || sampling.playing;
    $('temperature').disabled = !finished;
    $('generateButtonText').textContent = finished
      ? mode === 'dream' ? 'Generate another' : 'Restore again'
      : 'Start a new sample';
  }

  function renderSamplingFrame(frame) {
    sampling.step = frame.step;
    const label = sampling.mode === 'restore'
      ? `${sampling.patternName} completion, step ${frame.step}; original left half preserved`
      : `Generated sample ${sampling.number}, Gibbs step ${frame.step} of ${SAMPLING_STEPS}`;
    updateOutput(frame.visible.array(), label);
    $('samplingStep').textContent = `STEP ${String(frame.step).padStart(3, '0')} / ${SAMPLING_STEPS}`;
    $('samplingProgress').setAttribute('aria-valuenow', String(frame.step));
    $('samplingFill').style.width = `${frame.step / SAMPLING_STEPS * 100}%`;
    if (SNAPSHOT_STEPS.includes(frame.step)) {
      const canvas = $(`sampleFrame${frame.step}`);
      drawPixels(canvas, outputPixels);
      const frameLabel = frame.step === 0
        ? sampling.mode === 'restore' ? 'Known pixels plus random noise' : 'Initial noise'
        : `Step ${frame.step}`;
      canvas.setAttribute('aria-label', `${frameLabel} from this ${sampling.mode === 'restore' ? 'completion' : 'generation'}`);
      canvas.parentElement.classList.add('captured');
    }
    $('outputTag').textContent = frame.step === 0
      ? sampling.mode === 'restore' ? 'KNOWN PIXELS + RANDOM NOISE' : 'STARTING FROM RANDOM NOISE'
      : sampling.mode === 'restore' ? 'IMAGINING THE MISSING PIXELS' : `SAMPLE ${String(sampling.number).padStart(3, '0')} / GIBBS SAMPLING`;
  }

  function finishSampling() {
    clearTimeout(samplingTimer);
    samplingTimer = null;
    sampling.playing = false;
    syncPlayback();
    if (sampling.mode === 'restore') {
      $('outputTag').textContent = 'A POSSIBLE COMPLETION';
      $('outputStatus').textContent = '100 steps. Left half preserved; right half sampled.';
    } else {
      $('outputTag').textContent = `SAMPLE ${String(sampling.number).padStart(3, '0')} / 100 STEPS`;
      const closest = Math.min(...patterns.map(pattern => pattern.pixels.reduce((total, value, i) => total + (value !== outputPixels[i] ? 1 : 0), 0)));
      $('outputStatus').textContent = closest === 0
        ? 'This sample matches a learned example. Try another.'
        : `${closest} of 225 pixels differ from the closest example.`;
    }
  }

  function advanceSampling() {
    if (!sampling || sampling.step === SAMPLING_STEPS) return;
    if (sampling.step < sampling.frames.length - 1) {
      // Replaying a recorded chain does not resample or advance the model's RNG.
      renderSamplingFrame(sampling.frames[sampling.step + 1]);
    } else {
      const next = sampling.iterator.next();
      if (next.done) return;
      sampling.frames.push(next.value);
      renderSamplingFrame(next.value);
    }
    if (sampling.step === SAMPLING_STEPS) finishSampling();
  }

  function scheduleSampling() {
    clearTimeout(samplingTimer);
    if (!sampling || !sampling.playing || sampling.step === SAMPLING_STEPS) return;
    const run = sampling;
    // Give the initial noise and first few changes time to register. Every
    // later frame is still one full Gibbs step, never an interpolated image.
    const delay = run.step === 0 ? 850 : run.step < 3 ? 650 : run.step < 10 ? 220 : 75;
    samplingTimer = setTimeout(() => {
      if (sampling !== run || !run.playing) return;
      advanceSampling();
      scheduleSampling();
    }, delay / Number($('playbackSpeed').value));
  }

  function togglePlayback() {
    if (!sampling) return;
    if (sampling.step === SAMPLING_STEPS) {
      $('temperature').value = String(sampling.temperature);
      $('temperatureValue').textContent = sampling.temperature.toFixed(1);
      renderSamplingFrame(sampling.frames[0]);
      sampling.playing = true;
      $('outputStatus').textContent = 'Replaying the same sample, from its original noise.';
    } else {
      sampling.playing = !sampling.playing;
      $('outputStatus').textContent = sampling.playing
        ? 'Each update is a real sample. Patterns can settle, shift, or return.'
        : `Paused at step ${sampling.step}. Use Step to inspect the next change.`;
    }
    syncPlayback();
    scheduleSampling();
  }

  function generate() {
    if (!trained || !model || training) return;
    cancelSampling();
    if (mode === 'restore' && !restoreInput) prepareRestore();
    const iterator = mode === 'restore'
      ? model.completeSteps(matrix(restoreInput), Array.from({length: PIXELS}, (_, i) => i % SIZE < 7), SAMPLING_STEPS)
      : model.sampleSteps(SAMPLING_STEPS, Number($('temperature').value));
    if (mode === 'dream') sampleCount++;
    sampling = {
      iterator, frames: [], step: 0, playing: !motionPreference.matches,
      mode, number: sampleCount, patternName: patterns[selectedPattern].name,
      temperature: Number($('temperature').value)
    };
    for (const step of SNAPSHOT_STEPS) {
      const canvas = $(`sampleFrame${step}`);
      drawPixels(canvas, Array(PIXELS).fill(0));
      canvas.parentElement.classList.remove('captured');
      canvas.setAttribute('aria-label', `Step ${step}, not reached yet`);
    }
    $('sampleFrame0').nextElementSibling.textContent = mode === 'restore' ? 'Start' : 'Noise';
    $('samplingPlayer').hidden = false;
    const initial = iterator.next().value;
    sampling.frames.push(initial);
    renderSamplingFrame(initial);
    syncPlayback();
    $('outputStatus').textContent = motionPreference.matches
      ? 'Motion is reduced. Use Step, or choose Play to watch the chain.'
      : mode === 'restore'
        ? 'The missing half starts as noise. The visible half stays fixed.'
        : 'Watch the noise evolve. Each update is one real sampling step.';
    scheduleSampling();
  }

  function renderDrawing() {
    const nodes=Array.from({length:PIXELS},(_,index)=>{
      const button=document.createElement('button');
      button.type='button';button.className=`draw-pixel${drawing[index]?' on':''}`;
      button.dataset.pixel=String(index);
      button.setAttribute('aria-label',`Row ${Math.floor(index/SIZE)+1}, column ${index%SIZE+1}, ${drawing[index]?'on':'off'}`);
      button.setAttribute('aria-pressed',String(!!drawing[index]));
      button.tabIndex=index===rovingIndex?0:-1;
      return button;
    });
    $('drawingGrid').replaceChildren(...nodes);
  }
  function paint(index) {
    drawing[index]=paintValue;
    const pixel=$('drawingGrid').children[index];
    pixel.classList.toggle('on',!!paintValue);
    pixel.setAttribute('aria-pressed',String(!!paintValue));
    pixel.setAttribute('aria-label',`Row ${Math.floor(index/SIZE)+1}, column ${index%SIZE+1}, ${paintValue?'on':'off'}`);
    $('drawingHint').textContent='Arrow keys move. Space toggles a pixel.';
  }
  $('drawingGrid').addEventListener('pointerdown',event=>{
    const pixel=event.target.closest('[data-pixel]');if(!pixel)return;
    event.preventDefault();painting=true;const index=Number(pixel.dataset.pixel);paintValue=drawing[index]?0:1;
    $('drawingGrid').children[rovingIndex].tabIndex=-1;rovingIndex=index;pixel.tabIndex=0;pixel.focus();paint(index);
    $('drawingGrid').setPointerCapture(event.pointerId);
  });
  $('drawingGrid').addEventListener('pointermove',event=>{
    if(!painting)return;
    const pixel=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-pixel]');
    if(pixel)paint(Number(pixel.dataset.pixel));
  });
  window.addEventListener('pointerup',()=>painting=false);
  window.addEventListener('pointercancel',()=>painting=false);
  $('drawingGrid').addEventListener('click',event=>{
    if(event.detail!==0)return;
    const pixel=event.target.closest('[data-pixel]');if(!pixel)return;
    const index=Number(pixel.dataset.pixel);paintValue=drawing[index]?0:1;paint(index);
  });
  $('drawingGrid').addEventListener('keydown',event=>{
    const changes={ArrowLeft:-1,ArrowRight:1,ArrowUp:-SIZE,ArrowDown:SIZE};
    if(!(event.key in changes))return;
    event.preventDefault();
    $('drawingGrid').children[rovingIndex].tabIndex=-1;
    rovingIndex=Math.max(0,Math.min(PIXELS-1,rovingIndex+changes[event.key]));
    const next=$('drawingGrid').children[rovingIndex];next.tabIndex=0;next.focus();
  });
  $('drawButton').addEventListener('click',()=>{
    drawing=Array(PIXELS).fill(0);rovingIndex=0;renderDrawing();
    $('drawingHint').textContent='Arrow keys move. Space toggles a pixel.';
    $('drawDialog').showModal();
  });
  $('clearDrawing').addEventListener('click',()=>{drawing.fill(0);renderDrawing();});
  $('saveDrawing').addEventListener('click',()=>{
    if(!drawing.some(Boolean)){$('drawingHint').textContent='Add a few pixels before saving your pattern.';return;}
    if(patterns.some(pattern=>pattern.pixels.every((value,i)=>value===drawing[i]))){$('drawingHint').textContent='This pattern is already in the examples. Try something new.';return;}
    const customCount=patterns.filter(pattern=>pattern.custom).length;
    patterns.push({name:`Yours ${customCount+1}`,pixels:drawing.slice(),custom:true});
    selectedPattern=patterns.length-1;renderPatterns();resetModel();
    $('drawDialog').close();
    $('trainingStatus').textContent='New example added. Train to learn your expanded world.';
  });
  document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.preset!==presetId)setPreset(button.dataset.preset);}));
  document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
    mode=button.dataset.mode;syncMode();
    if(mode==='restore')prepareRestore();
    else if(trained&&!training)generate();
    else {updateOutput(noise(),'Untrained random pixel pattern');$('outputTag').textContent=training?'LEARNING IN PROGRESS':'BEFORE LEARNING';$('outputStatus').textContent='First, teach your machine a few patterns.';}
  }));
  $('hiddenUnits').addEventListener('change',resetModel);
  $('epochs').addEventListener('change',resetModel);
  $('trainButton').addEventListener('click',train);
  $('resetButton').addEventListener('click',()=>{mode='dream';syncMode();setPreset(presetId);});
  $('generateButton').addEventListener('click',generate);
  $('playbackButton').addEventListener('click', togglePlayback);
  $('stepButton').addEventListener('click', () => {
    if (!sampling || sampling.playing) return;
    advanceSampling();
    if (sampling.step < SAMPLING_STEPS) {
      $('outputStatus').textContent = `Step ${sampling.step}: sampled hidden units, then sampled pixels.`;
    }
  });
  $('playbackSpeed').addEventListener('change', scheduleSampling);
  motionPreference.addEventListener('change', event => {
    if (event.matches && sampling && sampling.playing) {
      sampling.playing = false;
      syncPlayback();
      scheduleSampling();
      $('outputStatus').textContent = 'Motion is reduced. Use Step, or choose Play to continue.';
    }
  });
  $('damageButton').addEventListener('click',prepareRestore);
  $('temperature').addEventListener('input',()=>{$('temperatureValue').textContent=Number($('temperature').value).toFixed(1);});
  window.addEventListener('resize',drawChart);
  drawHero();renderConcept();setPreset('shapes');syncMode();
})();

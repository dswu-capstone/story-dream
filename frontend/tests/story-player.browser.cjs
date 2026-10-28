// Run against a local Vite server and an isolated Chromium with --remote-debugging-port=9224.
// API/media are deterministic doubles; no backend records or physical devices are used.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const tab = await (await fetch("http://127.0.0.1:9224/json/new?about:blank", { method: "PUT" })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
  let id = 0;
  const pending = new Map(), errors = [];
  ws.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const task = pending.get(message.id); pending.delete(message.id);
      if (message.error) task.reject(message.error); else task.resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject: (error) => reject(new Error(`${method}: ${params.expression ?? ""} ${JSON.stringify(error)}`)) }); ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async (expression) => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out: ${expression}\n${await evaluate("document.body.innerText")}`);
  };
  const click = (index) => evaluate(`document.querySelectorAll('.story-reading-page__control')[${index}].click()`);
  const session = () => evaluate("JSON.parse(sessionStorage.getItem('storyDream.readingSession'))");
  const checkFooter = async (interactive = false) => {
    assert.equal(await evaluate(`(() => {
      const bar=document.querySelector('.story-progress-bar'), rect=bar.getBoundingClientRect();
      return bar.getAttribute('role') === '${interactive ? "slider" : "progressbar"}' &&
        rect.width > innerWidth * .8 && Math.abs(rect.bottom-innerHeight) < 2;
    })()`), true);
  };
  try {
    await send("Runtime.enable"); await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1024, height: 600, deviceScaleFactor: 1, mobile: false });
    await send("Page.addScriptToEvaluateOnNewDocument", { source: `
      localStorage.setItem('accessToken', 'test-only');
      localStorage.setItem('selectedChildId', '1');
      sessionStorage.clear();
      history.replaceState({usr:{startNewSession:true,childId:1,storyTitle:'테스트 동화'},key:'browser-player-start',idx:0},'');
      window.__calls = []; window.__audios = []; window.__sources = []; window.__blocked = false;
      window.__NativeAudio = window.Audio;
      window.__part = 1;
      window.__parts = [1,2,3].map((n) => ({ type: ['서론','본론','결론'][n-1], orderNum: n,
        pages: Array.from({length: n === 1 ? 2 : n === 2 ? 3 : 1}, (_, i) => ({
          pageId: n*10+i, pageNum: i+1, imageUrl: '/src/assets/reading_book.svg', audioUrl: 'test-'+n+'-'+i,
          sentences: [{sentenceIdx: 1, content: '돌리가 엉엉 울었어요.'}, {sentenceIdx: 2, content: '그리고 엄마 손을 꼬옥 잡았어요.'}, {sentenceIdx: 3, content: '엄마는 돌리 옆에 쪼그려 앉았어요.'}, {sentenceIdx: 4, content: '“많이 속상했구나.”'}]
        })) }));
      window.Audio = class {
        constructor() { this.currentTime = 0; this.paused = true; window.__audios.push(this); }
        set src(value) { this.source = value; this.currentTime = 0; }
        get src() { return this.source; }
        pause() { this.paused = true; }
        load() { this.currentTime = 0; }
        removeAttribute() { this.source = ''; }
        play() {
          if (window.__blocked) { window.__blocked = false; return Promise.reject(new DOMException('gesture', 'NotAllowedError')); }
          this.paused = false;
          queueMicrotask(() => this.onplaying?.()); return Promise.resolve();
        }
      };
      window.EventSource = class extends EventTarget {
        constructor(url) { super(); this.url = url; window.__sources.push(this); }
        close() { this.closed = true; }
      };
      speechSynthesis.speak = (utterance) => { utterance.onstart?.(); setTimeout(() => utterance.onend?.(), 5); };
      speechSynthesis.cancel = () => {};
      speechSynthesis.getVoices = () => [];
      window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined;
      window.fetch = async (input, init) => {
        const url = String(input), body = init?.body ? JSON.parse(init.body) : null;
        window.__calls.push({url, body});
        if (url.includes('/submit') && window.__rejectQuiz) {
          window.__rejectQuiz = false;
          return new Response(JSON.stringify({success:false,data:null,message:'테스트 제출 실패'}));
        }
        let data = {};
        if (url.endsWith('/focus/session')) return new Response(JSON.stringify({ok:true, enabled:true}));
        if (url.endsWith('/session')) return new Response(JSON.stringify({ok:true, focus:{source:'camera',timezone:'Asia/Seoul'},services:{realtime:false},character:{answerTimeoutMs:12000}}));
        if (url.endsWith('/state')) return new Response(JSON.stringify({ok:true,sentences:[]}));
        if (url.endsWith('/start')) { window.__part = 1; data = {readingHistoryId: 17, level: 1, partType:'서론',partOrderNum:1,pages:window.__parts[0].pages}; }
        else if (url.includes('/next-part')) { window.__part++; const part = window.__parts[window.__part-1]; data = {level:body.selectedLevel,partType:part.type,partOrderNum:part.orderNum,pages:part.pages}; }
        else if (url.includes('/api/stories/')) data = {originalStoryId:1,storyLevelId:1,title:'테스트 동화',level:1,parts:window.__parts};
        else if (url.includes('/api/quizzes?')) data = {quizzes:[1,2].map(n => ({quizId:window.__part*100+n,question:'동화 퀴즈 '+n,type:'OX',choices:['O','X']}))};
        else if (url.includes('/submit')) data = {isCorrect:true,correctAnswer:'O',lastQuizOfPart:url.includes('02/submit'),recommendedLevel:window.__part === 1 ? 2 : 2};
        else if (url.includes('/api/children/')) data = {childId:1,name:'테스트'};
        return new Response(JSON.stringify({success:true,ok:true,data}), {headers:{'Content-Type':'application/json'}});
      };
    ` });
    errors.length = 0;
    await send("Page.navigate", { url: "http://127.0.0.1:5174/stories/read?originalStoryId=1" });
    await waitFor("document.querySelectorAll('.story-reading-page__control').length === 3 && __audios.some(a => !a.paused)");
    assert.equal((await evaluate("__calls.filter(c => c.url.endsWith('/start')).length")), 1);
    assert.equal((await session()).currentPageIndex, 0);
    await checkFooter(true);
    assert.equal(await evaluate("__audios.filter(a => !a.paused).length"), 1);
    assert.equal(await evaluate("document.querySelector('.story-reading-page__image').getBoundingClientRect().bottom <= document.querySelector('.story-reading-page__actions').getBoundingClientRect().top"), true);
    await evaluate("__audios.at(-1).currentTime = 3.5");
    await click(1); assert.equal(await evaluate("__audios.at(-1).paused"), true);
    await click(1); assert.equal(await evaluate("__audios.at(-1).currentTime"), 3.5);
    await evaluate("__audios.at(-1).onended()");
    await waitFor("JSON.parse(sessionStorage.getItem('storyDream.readingSession')).currentPageIndex === 1");
    await click(0); await waitFor("__audios.at(-1).source === 'test-1-0'");
    assert.equal(await evaluate("__audios.at(-1).currentTime"), 0);
    await evaluate("__blocked = true"); await click(2);
    await waitFor("document.body.innerText.includes('재생 버튼을 누르면')");
    await click(1); await waitFor("!__audios.at(-1).paused");
    await evaluate("__audios.at(-1).onerror()");
    await waitFor("document.body.innerText.includes('음성을 불러오지 못했어요')");
    await click(1); await waitFor("!__audios.at(-1).paused");
    // Real pointer input: locked future pages clamp to the last open intro page.
    const bounds = await evaluate("(() => { const r = document.querySelector('[role=slider]').getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })()");
    await send("Input.dispatchMouseEvent", { type:"mousePressed",x:bounds.x+20,y:bounds.y+22,button:"left",clickCount:1 });
    await send("Input.dispatchMouseEvent", { type:"mouseMoved",x:bounds.x+bounds.width-5,y:bounds.y+22,button:"left",buttons:1 });
    await send("Input.dispatchMouseEvent", { type:"mouseReleased",x:bounds.x+bounds.width-5,y:bounds.y+22,button:"left",clickCount:1 });
    await waitFor("__audios.at(-1).source === 'test-1-1' && !__audios.at(-1).paused");
    assert.equal((await session()).currentPart.orderNum, 1);
    await evaluate("__audios.at(-1).onended()");
    await waitFor("location.pathname === '/stories/quiz' && document.querySelector('.story-quiz-page__ox-button')");
    assert.equal(await evaluate("__audios.every(a => a.paused)"), true);
    assert.equal(await evaluate("document.querySelector('[role=slider]') === null"), true);
    await checkFooter();
    const answer = async () => {
      await evaluate("document.querySelector('.story-quiz-page__ox-button').click()");
      await waitFor("!document.querySelector('.story-quiz-page__submit-button').disabled");
      await evaluate("document.querySelector('.story-quiz-page__submit-button').click()");
      await waitFor("location.pathname === '/stories/result'");
      await checkFooter();
    };
    await evaluate("__rejectQuiz=true; document.querySelector('.story-quiz-page__ox-button').click()");
    await waitFor("!document.querySelector('.story-quiz-page__submit-button').disabled");
    await evaluate("document.querySelector('.story-quiz-page__submit-button').click()");
    await waitFor("document.body.innerText.includes('테스트 제출 실패')");
    assert.equal((await session()).quizzesByPart[1], undefined);
    await answer(); assert.equal((await session()).quizzesByPart[1].completed, false);
    await evaluate("document.querySelector('.story-result-page__button').click()");
    await waitFor("location.pathname === '/stories/quiz' && document.querySelector('.story-quiz-page__ox-button')");
    await answer(); assert.equal((await session()).quizzesByPart[1].completed, true);
    await evaluate("document.querySelector('.story-result-page__button').click()");
    await waitFor("location.pathname.includes('level-adjust')");
    await checkFooter();
    await evaluate("document.querySelector('.interaction-page__button--accept').click()");
    await waitFor("location.pathname === '/stories/read' && __audios.at(-1).source === 'test-2-0'");
    assert.equal((await session()).selectedLevel, 2);
    await click(0); await waitFor("__audios.at(-1).source === 'test-1-1'");
    assert.equal((await session()).selectedLevel, 1);
    await evaluate("__audios.at(-1).onended()");
    await waitFor("__audios.at(-1).source === 'test-2-0'");
    assert.equal((await session()).selectedLevel, 2);
    assert.equal(await evaluate("__calls.filter(c=>c.url.includes('/next-part')).length"), 1);
    assert.equal(await evaluate("__calls.filter(c=>c.url.includes('/submit')).length"), 3);
    // Keyboard navigation and touch use the same page-based slider.
    await evaluate("document.querySelector('[role=slider]').focus()");
    await send("Input.dispatchKeyEvent", {type:"keyDown",key:"Home",code:"Home",windowsVirtualKeyCode:36});
    await waitFor("__audios.at(-1).source === 'test-1-0'");
    await send("Input.dispatchTouchEvent", { type:"touchStart",touchPoints:[{x:bounds.x+bounds.width*4/6,y:bounds.y+22}] });
    await send("Input.dispatchTouchEvent", { type:"touchMove",touchPoints:[{x:bounds.x+bounds.width*5/6,y:bounds.y+22}] });
    await send("Input.dispatchTouchEvent", { type:"touchEnd",touchPoints:[] });
    await waitFor("__audios.at(-1).source === 'test-2-2'");
    const beforeFocus = await session();
    await evaluate("__sources.filter(s=>!s.closed).forEach(s=>s.dispatchEvent(new MessageEvent('focus',{data:JSON.stringify({eventType:'focus_lost',detail:'distracted_for=5s'})})))");
    assert.equal(await evaluate("location.pathname"), "/stories/read");
    const screenshot = await send("Page.captureScreenshot", { format:"png" });
    const screenshotPath = path.join(process.env.TEMP, "storydream-player-1024.png");
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data,"base64"));
    await send("Emulation.setDeviceMetricsOverride", { width:390,height:844,deviceScaleFactor:1,mobile:false });
    await checkFooter(true);
    assert.equal(await evaluate("document.querySelector('.story-reading-page__actions').getBoundingClientRect().right <= innerWidth"), true);
    await send("Emulation.setDeviceMetricsOverride", { width:1024,height:600,deviceScaleFactor:1,mobile:false });
    await evaluate("__sources.filter(s=>!s.closed).forEach(s=>s.dispatchEvent(new MessageEvent('focus',{data:JSON.stringify({eventType:'absent',detail:'absent_for=10s'})})))");
    await waitFor("location.pathname === '/stories/interaction'");
    await checkFooter();
    assert.equal(await evaluate("__audios.every(a=>a.paused)"), true);
    await waitFor("document.querySelector('.realtime-interaction-page__answer-form')");
    await evaluate(`(() => {const input=document.querySelector('.realtime-interaction-page__answer-form input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'엄마가 위로했어요'); input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await waitFor("!document.querySelector('.realtime-interaction-page__answer-form button').disabled");
    await evaluate("document.querySelector('.realtime-interaction-page__answer-form button').click()");
    await waitFor("document.querySelector('.realtime-interaction-page__continue-button')");
    await evaluate("document.querySelector('.realtime-interaction-page__continue-button').click()");
    await waitFor("location.pathname === '/stories/read' && __audios.at(-1).source === 'test-2-2'");
    assert.equal((await session()).currentPageIndex, beforeFocus.currentPageIndex);
    for (const order of [2,3]) {
      await evaluate("__audios.at(-1).onended()");
      await waitFor("location.pathname === '/stories/quiz' && document.querySelector('.story-quiz-page__ox-button')");
      await answer(); await evaluate("document.querySelector('.story-result-page__button').click()");
      await waitFor("location.pathname === '/stories/quiz' && document.querySelector('.story-quiz-page__ox-button')");
      await answer(); await evaluate("document.querySelector('.story-result-page__button').click()");
      if (order === 2) await waitFor("location.pathname === '/stories/read' && __audios.at(-1).source === 'test-3-0'");
    }
    await waitFor("location.pathname === '/stories/complete'");
    assert.equal(await evaluate("__calls.filter(c=>c.url.endsWith('/end')).length"), 1);
    assert.equal(await evaluate("__calls.filter(c=>c.url.includes('/next-part')).length"), 2);
    assert.equal(await session(), null);
    // Exercise native HTMLAudioElement events as well as the deterministic media double.
    await evaluate(`(async () => {
      window.Audio = window.__NativeAudio;
      const { StoryAudioPlayer } = await import('/src/utils/storyAudioPlayer.ts');
      const bytes = new Uint8Array(44 + 16000), view = new DataView(bytes.buffer);
      const ascii = (offset, value) => [...value].forEach((char, i) => bytes[offset+i] = char.charCodeAt(0));
      ascii(0,'RIFF'); view.setUint32(4,bytes.length-8,true); ascii(8,'WAVE'); ascii(12,'fmt ');
      view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true);
      view.setUint32(24,8000,true); view.setUint32(28,16000,true); view.setUint16(32,2,true); view.setUint16(34,16,true);
      ascii(36,'data'); view.setUint32(40,16000,true);
      window.__nativeUrl = URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));
      window.__nativeEnds = 0; window.__nativeStatus = '';
      window.__nativePlayer = new StoryAudioPlayer({onStatus:s=>__nativeStatus=s,onEnded:()=>__nativeEnds++,onStart:()=>{},onPlaying:()=>{},onRelease:()=>{}});
      __nativePlayer.setPage(__nativeUrl);
    })()`);
    await waitFor("__nativeStatus === 'playing' || __nativeStatus === 'blocked'");
    if (await evaluate("__nativeStatus === 'blocked'")) {
      await evaluate("const button = document.createElement('button'); button.id='native-play'; button.textContent='native play'; button.onclick=()=>__nativePlayer.toggle(); button.style='position:fixed;left:0;top:0;width:100px;height:40px;z-index:9999';document.body.append(button)");
      await send("Input.dispatchMouseEvent", {type:"mousePressed",x:50,y:20,button:"left",clickCount:1});
      await send("Input.dispatchMouseEvent", {type:"mouseReleased",x:50,y:20,button:"left",clickCount:1});
    }
    await waitFor("__nativeStatus === 'playing'");
    await evaluate("__nativePlayer.toggle()");
    assert.equal(await evaluate("__nativeStatus"), "paused");
    await evaluate("__nativePlayer.toggle()");
    await waitFor("__nativeEnds === 1");
    await evaluate("__nativePlayer.stop(); URL.revokeObjectURL(__nativeUrl)");
    assert.deepEqual(errors, []);
    console.log("PASS: Strict Mode start, autoplay, pause/resume, previous/next, blocked/error retry, mouse/touch/keyboard seeking, quiz completion, cached levels/revisit, focus threshold/return, end API.");
    console.log(`Screenshot: ${screenshotPath}`);
  } finally { ws.close(); await fetch(`http://127.0.0.1:9224/json/close/${tab.id}`); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

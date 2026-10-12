// Run with Vite dev active: node scripts/tests/grass_perf.mjs [http://127.0.0.1:5180]
// Windows Chrome/D3D11 uses the real GPU. Results are equivalent FPS (GPU/CPU
// synchronized render time), not the refresh-rate-limited animation loop FPS.
import { chromium } from '../../game/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root=fileURLToPath(new URL('../..',import.meta.url));
const out=join(root,'test-results'); mkdirSync(out,{recursive:true});
const base=process.argv[2] || 'http://127.0.0.1:5180';
const browser=await chromium.launch({channel:'chrome',headless:true,args:process.platform==='win32'?['--use-angle=d3d11','--enable-gpu']:[]});
const results=[];
const zones=['zone_00','zone_01','zone_02','zone_03','zone_04','zone_05'];
try {
  const pages = {};
  for (const mode of ['before','after']) {
    const context=await browser.newContext({viewport:{width:1366,height:768}});
    await context.addInitScript(()=>{
      localStorage.setItem('fville.save.v1',JSON.stringify({v:1,created:true,player:{name:'Perf Intern',gender:'nam',look:'intern_nam',position:'developer'},zone:'zone_01',flags:[],quests:[]}));
      localStorage.setItem('fville.settings',JSON.stringify({tier:'low',detail:'sharper',sound:{mute:true}}));
    });
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    // Reference is the same app and all the same assets, with just the new
    // terrain replacement disabled. This intercept is test-only, never shipped.
    if(mode==='before')await page.route(/\/src\/world\/grass\.js(?:\?|$)/,route=>route.fulfill({contentType:'application/javascript',body:'export async function replaceGrass() {} export async function grassTexture() { return null; }'}));
    await page.goto(`${base}/?debug&net=off&title=off`);
    await page.waitForFunction(()=>window.__game?._game?.state.phase==='playing',null,{timeout:90000});
    await page.evaluate(()=>{const g=__game._game;g.input.lockSupported=false;g.input.onUnlock=null;g.runOnEnter=()=>{};g.checkZoneEvents=()=>{};window.requestAnimationFrame=()=>0;});
    pages[mode] = { context, page, errors };
  }
  // Keep both versions loaded. Alternate neighbouring samples in each zone
  // rather than measuring entire tours minutes apart as the GPU warms up.
  for(const zone of zones) {
    for(const {page} of Object.values(pages)) {
      await page.evaluate(async z=>{const g=__game._game;g.runner.abort();await g.enterZone(z,null,{fade:false,silent:true});g.setMode('play');g.cam.pitch=0.25;g.cam.distance=4.2;g.setDetail('sharper');},zone);
      await page.waitForTimeout(1500);
      await page.evaluate(()=>__game.benchmark(30));
    }
    for(let repeat=0;repeat<3;repeat++) for(const mode of ['before','after','after','before']) {
      const {page, errors} = pages[mode];
      await page.bringToFront();
      const data=await page.evaluate(()=>{
        const g=__game._game;
        const runs=Array.from({length:1},()=>{g.cam.yaw=0;return __game.benchmark(120);});
        const sorted=runs.map(r=>r.ms).sort((a,b)=>a-b);
        return {zone:g.state.zone,gpu:g.gpu,runs,medianMs:sorted[0],grass:g.zone.fixes?.grass??null,groundTexture:!!g.sky.ground?.material.map};
      });
      if(/swiftshader|software|llvmpipe/i.test(data.gpu))throw new Error(`Real GPU required for FPS comparison: ${data.gpu}`);
      if(mode==='after' && (!data.groundTexture || (/^zone_0[1234]$/.test(zone) && !data.grass)))throw new Error(`${zone}: grass was not replaced`);
      if(errors.length)throw new Error(errors.join('\n'));
      results.push({mode,...data});
      console.log(`${mode} ${zone}: ${data.medianMs.toFixed(2)} ms (${(1000/data.medianMs).toFixed(0)} equivalent FPS)`);
    }
  }
  for(const {context} of Object.values(pages))await context.close();
  const comparison=zones.map(zone=>{
    const median=mode=>{const ms=results.filter(r=>r.zone===zone&&r.mode===mode).flatMap(r=>r.runs.map(s=>s.ms)).sort((a,b)=>a-b);return (ms[2]+ms[3])/2;};
    const before=median('before'),after=median('after');
    const delta=(after/before-1)*100;
    return {zone,beforeMs:before,afterMs:after,beforeFps:1000/before,afterFps:1000/after,frameTimeChangePercent:delta,ok:delta<=10};
  });
  writeFileSync(join(out,'grass-perf.json'),JSON.stringify({viewport:[1366,768],gpu:results[0].gpu,thresholdPercent:10,results,comparison},null,2));
  for(const r of comparison)console.log(`${r.ok?'✓':'✗'} ${r.zone}: frame time ${r.frameTimeChangePercent.toFixed(1)}% (limit +10%)`);
  if(comparison.some(r=>!r.ok))process.exitCode=1;
} finally {await browser.close();}

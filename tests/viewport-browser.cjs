/* Exercise the actual exported JS/CSS with native dialog and browser media queries. */
const assert=require('node:assert/strict');
module.exports=async function(browser,base){
 for(const screen of [{width:3840,height:2160},{width:1280,height:720}]){
  const context=await browser.newContext({viewport:{width:1200,height:700},screen});
  try{
   const page=await context.newPage();
   await page.route('**/viewport-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><link rel="stylesheet" href="/desktop-viewport-guard.css"><script defer src="/desktop-viewport-guard.js"></script></head><body><main>Atlas</main></body></html>'}));
   await page.goto(base+'/viewport-fixture');
   assert.equal(await page.locator('#desktop-viewport-guard').count(),0,'Normal window must not require full screen');
   for(const [width,height,blocked] of [[800,400,true],[1516,964,false],[1200,500,true],[1200,700,false],[1000,650,false],[700,700,true]]){
    await page.setViewportSize({width,height});
    await page.waitForFunction(want=>Boolean(document.querySelector('#desktop-viewport-guard[open]'))===want,blocked,{timeout:3000});
    assert.equal(await page.locator('#desktop-viewport-guard').isVisible(),blocked,'Native dialog must visually close after resize');
   }
  }finally{await context.close();}
 }
 console.log('Exported viewport mask: native CSS queries and dialog, normal windows on laptop / 4K monitor, repeated resize OK');
};

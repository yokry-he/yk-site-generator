export type RuntimeQualitySeverity = 'error' | 'warning' | 'suggestion'
export type RuntimeQualityCategory = 'overflow' | 'touch' | 'images' | 'content' | 'accessibility'

export interface RuntimeQualityIssue {
  id: string
  severity: RuntimeQualitySeverity
  category: RuntimeQualityCategory
  title: string
  description: string
  selector?: string
  elementLabel?: string
}

export interface RuntimeQualityReport {
  viewport: { width: number; height: number; scrollWidth: number; scrollHeight: number }
  issues: RuntimeQualityIssue[]
  measuredAt: string
}

export const RUNTIME_AUDIT_REQUEST = 'siteforge-runtime-audit-request'
export const RUNTIME_AUDIT_RESULT = 'siteforge-runtime-audit-result'

export function runtimeAuditBridgeSource(): string {
  return `(() => {
    if (window.__siteforgeRuntimeAuditInstalled) return;
    window.__siteforgeRuntimeAuditInstalled = true;
    const selectorFor = (el) => {
      if (el.id) return '#' + CSS.escape(el.id);
      if (el.dataset?.sfEditorId) return '[data-sf-editor-id="' + CSS.escape(el.dataset.sfEditorId) + '"]';
      if (el.dataset?.sfSectionId) return '[data-sf-section-id="' + CSS.escape(el.dataset.sfSectionId) + '"]';
      return el.tagName.toLowerCase();
    };
    const label = (el) => ((el.getAttribute('aria-label') || el.getAttribute('alt') || el.textContent || el.tagName).trim().replace(/\\s+/g,' ').slice(0,64));
    const rgb = (value) => { const m = value.match(/rgba?\\((\\d+)[, ]+(\\d+)[, ]+(\\d+)/); return m ? [Number(m[1]),Number(m[2]),Number(m[3])] : null; };
    const luminance = (c) => { const n=c/255; return n<=.03928?n/12.92:Math.pow((n+.055)/1.055,2.4); };
    const contrast = (a,b) => { const A=.2126*luminance(a[0])+.7152*luminance(a[1])+.0722*luminance(a[2]); const B=.2126*luminance(b[0])+.7152*luminance(b[1])+.0722*luminance(b[2]); return (Math.max(A,B)+.05)/(Math.min(A,B)+.05); };
    const audit = () => {
      const issues=[]; const add=(severity,category,title,description,el)=>issues.push({id:category+':'+title+':'+issues.length,severity,category,title,description,selector:el?selectorFor(el):undefined,elementLabel:el?label(el):undefined});
      const root=document.documentElement;
      if (root.scrollWidth > innerWidth + 2) add('error','overflow','页面存在横向溢出','实际页面宽度超过当前视口，手机用户可能看到横向滚动。',root);
      [...document.querySelectorAll('body *')].forEach((el) => {
        const rect=el.getBoundingClientRect(); const style=getComputedStyle(el);
        if (rect.width > 0 && (rect.right > innerWidth + 8 || rect.left < -8)) add('warning','overflow','元素超出视口','元素边界超出当前设备宽度。',el);
        if ((el.matches('button,a,input,select,textarea,[role="button"]')) && rect.width > 0 && (rect.width < 40 || rect.height < 40)) add('suggestion','touch','点击区域偏小','建议将触控区域增大到至少 40×40 像素。',el);
        if (rect.width > 0 && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) && ['hidden','clip'].includes(style.overflow)) add('warning','content','内容可能被截断','元素内容超过可见区域且 overflow 会隐藏内容。',el);
        if (style.position === 'fixed' && rect.height > innerHeight * .35) add('warning','content','固定元素占用过多屏幕','固定区域高度超过视口的三分之一，可能遮挡主体内容。',el);
        if (el instanceof HTMLImageElement && el.complete && el.naturalWidth && rect.width && rect.height) { const natural=el.naturalWidth/el.naturalHeight; const rendered=rect.width/rect.height; if (Math.abs(natural-rendered)/natural > .22 && style.objectFit === 'fill') add('warning','images','图片可能被拉伸','图片自然比例与显示比例差异较大。',el); }
        if (el.matches('p,span,a,button,li,h1,h2,h3,h4,h5,h6') && rect.width > 0) { const fg=rgb(style.color); let bgEl=el; let bg=null; while(bgEl && !bg){const candidate=rgb(getComputedStyle(bgEl).backgroundColor);if(candidate && getComputedStyle(bgEl).backgroundColor!=='rgba(0, 0, 0, 0)')bg=candidate;bgEl=bgEl.parentElement;} if(fg&&bg){const ratio=contrast(fg,bg);const size=parseFloat(style.fontSize);const threshold=size>=18||Number(style.fontWeight)>=700?3:4.5;if(ratio<threshold)add('warning','accessibility','文字对比度不足','当前文字与背景的对比度低于 WCAG 建议值。',el);} }
      });
      const focusable=[...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].slice(0,80);
      focusable.forEach((el)=>{const style=getComputedStyle(el);if(style.outlineStyle==='none' && style.boxShadow==='none')add('suggestion','accessibility','焦点样式可能不明显','键盘用户聚焦时可能缺少清晰的视觉提示。',el);});
      parent.postMessage({source:'siteforge-runtime-quality',type:'${RUNTIME_AUDIT_RESULT}',payload:{viewport:{width:innerWidth,height:innerHeight,scrollWidth:root.scrollWidth,scrollHeight:root.scrollHeight},issues:issues.slice(0,120),measuredAt:new Date().toISOString()}},'*');
    };
    addEventListener('message',(event)=>{if(event.data?.source==='siteforge-runtime-quality-parent'&&event.data?.type==='${RUNTIME_AUDIT_REQUEST}')requestAnimationFrame(()=>requestAnimationFrame(audit));});
  })();`
}

export function runRuntimeAudit(iframe: HTMLIFrameElement, timeoutMs = 5_000): Promise<RuntimeQualityReport> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { window.removeEventListener('message', onMessage); reject(new Error('RUNTIME_AUDIT_TIMEOUT')) }, timeoutMs)
    function onMessage(event: MessageEvent) {
      if (event.source !== iframe.contentWindow) return
      const message = event.data as { source?: string; type?: string; payload?: RuntimeQualityReport }
      if (message.source !== 'siteforge-runtime-quality' || message.type !== RUNTIME_AUDIT_RESULT || !message.payload) return
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      resolve(message.payload)
    }
    window.addEventListener('message', onMessage)
    iframe.contentWindow?.postMessage({ source: 'siteforge-runtime-quality-parent', type: RUNTIME_AUDIT_REQUEST }, '*')
  })
}

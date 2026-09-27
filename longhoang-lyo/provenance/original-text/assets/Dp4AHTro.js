import{a as e,i as t}from"./BW6YWG0R.js";import{a as n,r,t as i}from"./DLabtpBR.js";import{t as a}from"./DrDnj3Lb.js";import{u as o}from"./ClujFw2l.js";import{t as s}from"./BeAPK0YT.js";import{t as c}from"./C6MU3C_D.js";var l=class extends i{constructor(e={}){super(),this.caseStudyContent=s.caseStudy,this.caseStudyConfigs=this.caseStudyContent.projects,this.currentProjectKey=e.projectKey||`hanzii`,this.currentConfig=this.caseStudyConfigs[this.currentProjectKey]||this.caseStudyConfigs.hanzii,this.closeButton=null,this.imagesColumn=null,this.imagesWrapper=null,this.tocNav=null,this.tocList=null,this.scrollBarPath=null,this.scrollBarOverlay=null,this.bottomControls=null,this.lenis=null,this.onTickerUpdate=null,this.onNativeScroll=null,this.activeTocIndex=-1,this.tocScrollTimeout=null,this.isUserTocScrolling=!1,this.userTocInteractionTimeout=null,this.init()}init(){typeof document>`u`||(this.initDOM(),this.bindEvents())}initDOM(){this.initRoot(`div`,`case-study-page`,{role:`dialog`,"aria-modal":`true`,"aria-label":this.currentConfig.pageTitle||`Case Study`}),this.renderContent(),document.body.appendChild(this.root),this.initModal({overlay:this.root,panel:this.imagesColumn,lockKey:`case-study-page`,bodyClass:`case-study-page-open`,showClass:`is-open`,route:this.currentConfig.route||`/work/${this.currentProjectKey}`,pageTitle:this.currentConfig.pageTitle,pageDescription:this.currentConfig.pageDescription,noindex:!1,pauseRender:!0})}onBeforeOpen(){this.imagesColumn&&(this.imagesColumn.scrollTop=0),this.scrollBarPath&&(this.scrollBarPath.setAttribute(`transform`,`translate(0, 0)`),this.scrollBarPath.style.opacity=`0`),this.scrollBarOverlay&&(this.scrollBarOverlay.style.opacity=`0`),this.activeTocIndex=-1,this.isUserTocScrolling=!1}onAfterOpen(){this.initLenis(),this.lenis&&(this.lenis.scrollTo(0,{immediate:!0}),this.lenis.resize()),this.updateActiveToc(),this.playVideos()}onBeforeClose(){this.destroyLenis(),this.pauseVideos()}playVideos(){this.root&&this.root.querySelectorAll(`video`).forEach(e=>{e.play().catch(()=>{})})}pauseVideos(){this.root&&this.root.querySelectorAll(`video`).forEach(e=>{e.pause()})}renderContent(){if(!this.root)return;let e=this.currentConfig,t=this.caseStudyContent.labels,n=t.ariaLabels,r=``,i=``;e.images.forEach((t,n)=>{let a=`${e.key}-img-${n}`;if(t.type===`video`||t.filename.endsWith(`.webm`)||t.filename.endsWith(`.mp4`)){let n=t.filename.replace(/\.(mp4|webm)$/iu,`.webm`),i=t.filename.replace(/\.(mp4|webm)$/iu,`.mp4`),o=`/assets/work/${e.folder}/${encodeURIComponent(n)}`,s=`/assets/work/${e.folder}/${encodeURIComponent(i)}`;r+=`
          <div class="case-study-page__image-wrapper case-study-page__video-wrapper" id="${a}">
            <video
              class="case-study-page__video"
              loop
              muted
              playsinline
              preload="none"
              width="${t.width}"
              height="${t.height}"
              style="aspect-ratio: ${t.width} / ${t.height};"
              aria-label="${t.title}"
            >
              <source src="${o}" type="video/webm" />
              <source src="${s}" type="video/mp4" />
            </video>
          </div>
        `}else{let i=encodeURIComponent(t.filename),o=`/assets/work/${e.folder}/${i}`,s=`/assets/work/${e.folder}/mobile/${i}`;r+=`
          <div class="case-study-page__image-wrapper" id="${a}">
            <picture class="case-study-page__picture">
              <source media="(max-width: 63.99em)" srcset="${s}" />
              <img
                class="case-study-page__image"
                src="${o}"
                alt="${t.title}"
                width="${t.width}"
                height="${t.height}"
                style="aspect-ratio: ${t.width} / ${t.height};"
                loading="${n<2?`eager`:`lazy`}"
                decoding="async"
              />
            </picture>
          </div>
        `}if(t.isToc){let e=t.level===1?`case-study-page__toc-item--level-1`:`case-study-page__toc-item--level-2`;i+=`
          <li class="case-study-page__toc-item ${e}">
            <button type="button" class="case-study-page__toc-btn" data-target-id="${a}">
              <span class="case-study-page__toc-indicator" aria-hidden="true">►</span>
              <span class="case-study-page__toc-label">${t.title}</span>
            </button>
          </li>
        `}});let a=`
      <div class="case-study-page__nav-buttons">
        <button type="button" class="case-study-page__nav-btn case-study-page__nav-btn--prev" aria-label="${n.prev}">
          <span class="case-study-page__nav-arrow case-study-page__nav-arrow--left" aria-hidden="true"></span>
          <span class="case-study-page__nav-text">${t.prevLabel}</span>
        </button>
        <button type="button" class="case-study-page__nav-btn case-study-page__nav-btn--next" aria-label="${n.next}">
          <span class="case-study-page__nav-text">${t.nextLabel}</span>
          <span class="case-study-page__nav-arrow case-study-page__nav-arrow--right" aria-hidden="true"></span>
        </button>
      </div>
    `,s=o({className:`case-study-page__close`,ariaLabel:n.close,hasBackground:!0});this.root.innerHTML=`
      <div class="case-study-page__layout">
        <section class="case-study-page__images-column" aria-label="${this.currentConfig.pageTitle||`Project Case Study`}">
          <h1 class="u-visually-hidden">${this.currentConfig.pageTitle||`Project Case Study`}</h1>
          <div class="case-study-page__images-wrapper">
            ${r}
          </div>
          <footer class="case-study-page__footer">
            ${a}
          </footer>
        </section>

        <aside class="case-study-page__sidebar" aria-label="${n.sidebar}">
          ${s}

          <div class="case-study-page__toc">
            <div class="case-study-page__toc-bg" aria-hidden="true"></div>
            <div class="case-study-page__toc-surface" aria-hidden="true"></div>
            <svg class="case-study-page__toc-scrollbar" viewBox="0 0 219 402" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect id="scroll_bar_overlay" opacity="0" x="195.55" y="57.92" width="5.16" height="315.59" fill="#DFDFE2" style="transition: opacity 0.3s ease;"/>
              <rect id="scroll_bar" opacity="0" x="196.7" y="58.82" width="3.1" height="41.78" fill="#11121A" style="transition: opacity 0.3s ease;"/>
            </svg>

            <div class="case-study-page__toc-content">
              <h2 class="case-study-page__toc-title">${t.tocTitle}</h2>
              <nav class="case-study-page__toc-nav">
                <ul class="case-study-page__toc-list">
                  ${i}
                </ul>
              </nav>
            </div>
          </div>

          <div class="case-study-page__bottom-controls">
            <div class="case-study-page__scroll-hint">
              <span class="case-study-page__scroll-hint-icon" aria-hidden="true"></span>
              <span>${t.scrollHint}</span>
            </div>
            ${a}
          </div>
        </aside>
      </div>
    `,this.closeButton=this.query(`.case-study-page__close`),this.imagesColumn=this.query(`.case-study-page__images-column`),this.imagesWrapper=this.query(`.case-study-page__images-wrapper`),this.tocNav=this.query(`.case-study-page__toc-nav`),this.tocList=this.query(`.case-study-page__toc-list`),this.scrollBarOverlay=this.query(`#scroll_bar_overlay`),this.scrollBarPath=this.query(`#scroll_bar`),this.bottomControls=this.query(`.case-study-page__bottom-controls`),this.panel=this.imagesColumn,this.modal&&(this.modal.panel=this.imagesColumn)}loadProject(e){let t=this.caseStudyConfigs[e]||this.caseStudyConfigs.hanzii;if(this.currentProjectKey===e&&this.root&&this.imagesColumn)return;this.currentProjectKey=e,this.currentConfig=t;let i=t.route||`/work/${e}`;this.routePath=i,this.root&&this.root.setAttribute(`aria-label`,t.pageTitle||`Case Study`),this.modal&&(this.modal.panel=this.imagesColumn,this.modal.route=i,this.modal.pageTitle=t.pageTitle,this.modal.pageDescription=t.pageDescription,this.modal.noindex=!1),this.destroyLenis(),this.renderContent(),this.bindEvents(),this.isOpen()&&(r(i),n({title:t.pageTitle,description:t.pageDescription,path:i,noindex:!1}),this.updatePaginationLinks(t),this.initLenis(),this.lenis&&this.lenis.scrollTo(0,{immediate:!0}),this.updateActiveToc())}bindEvents(){if(this.closeButton&&this.bindClick(this.closeButton,()=>this.close()),this.tocNav){let e=()=>{this.isUserTocScrolling=!0,this.userTocInteractionTimeout&&clearTimeout(this.userTocInteractionTimeout),this.userTocInteractionTimeout=this.addTimeout(()=>{this.isUserTocScrolling=!1},1500)};this.listenDOM(this.tocNav,`wheel`,e,{passive:!0}),this.listenDOM(this.tocNav,`touchstart`,e,{passive:!0}),this.listenDOM(this.tocNav,`pointerdown`,e,{passive:!0}),this.listenDOM(this.tocNav,`scroll`,()=>this.handleTocScroll())}if(this.tocList){let t=t=>{let n=t.target.closest(`.case-study-page__toc-btn`);if(!n)return;e.emit(`ui:button-click`);let r=n.getAttribute(`data-target-id`),i=this.query(`#${r}`);i&&(this.lenis?this.lenis.scrollTo(i,{offset:0,duration:1.2}):this.imagesColumn&&i.scrollIntoView({behavior:`smooth`}))};this.listenDOM(this.tocList,`click`,t),this.listenDOM(this.tocList,`keydown`,e=>{(e.key===`Enter`||e.key===` `)&&e.target.closest(`.case-study-page__toc-btn`)&&(e.preventDefault(),t(e))})}let t=t=>{e.emit(`ui:button-click`),this.caseStudyConfigs[t]?this.loadProject(t):(this.close(),e.emit(`aboutproject:open-project`,{projectKey:t}))};this.queryAll(`.case-study-page__nav-btn--prev`).forEach(e=>this.bindClick(e,()=>t(this.currentConfig.prevProject))),this.queryAll(`.case-study-page__nav-btn--next`).forEach(e=>this.bindClick(e,()=>t(this.currentConfig.nextProject))),this.subscribe(`case-study:open`,e=>this.open(e)),this.subscribe(`hanzii-page:open`,()=>this.open(`hanzii`))}initLenis(){if(!(this.lenis||this.onNativeScroll)){if(t()||typeof window<`u`&&window.matchMedia?.(`(pointer: coarse)`)?.matches){this.onNativeScroll=()=>{if(!this.imagesColumn)return;let e=this.imagesColumn.scrollTop,t=this.imagesColumn.scrollHeight-this.imagesColumn.clientHeight,n=t>0?e/t:0;this.bottomControls&&this.bottomControls.classList.toggle(`is-ended`,n>=.92)},this.listenDOM(this.imagesColumn,`scroll`,this.onNativeScroll,{passive:!0});return}this.lenis=new c({wrapper:this.imagesColumn,content:this.imagesWrapper,smoothWheel:!0,duration:1.2}),this.lenis.on(`scroll`,e=>this.handleScroll(e)),this.onTickerUpdate=e=>{this.lenis&&this.lenis.raf(e*1e3)},a.ticker.add(this.onTickerUpdate)}}destroyLenis(){this.onTickerUpdate&&=(a.ticker.remove(this.onTickerUpdate),null),this.lenis&&=(this.lenis.destroy(),null),this.onNativeScroll=null}handleScroll(e){if(!this.imagesColumn)return;let{scroll:t,limit:n}=e,r=n>0?t/n:0;this.bottomControls&&this.bottomControls.classList.toggle(`is-ended`,r>=.92),this.updateActiveToc()}handleTocScroll(){if(!this.tocNav||!this.scrollBarPath||!this.scrollBarOverlay)return;if(!this.isUserTocScrolling){this.scrollBarPath.style.opacity=`0`,this.scrollBarOverlay.style.opacity=`0`;return}let e=this.tocNav.scrollHeight-this.tocNav.clientHeight;if(e<=0){this.scrollBarPath.style.opacity=`0`,this.scrollBarOverlay.style.opacity=`0`;return}let t=Math.min(1,Math.max(0,this.tocNav.scrollTop/e))*272.8956;this.scrollBarPath.setAttribute(`transform`,`translate(0, ${t})`),this.scrollBarPath.style.opacity=`1`,this.scrollBarOverlay.style.opacity=`0.5`,this.tocScrollTimeout&&clearTimeout(this.tocScrollTimeout),this.tocScrollTimeout=this.addTimeout(()=>{this.scrollBarPath&&this.scrollBarOverlay&&(this.scrollBarPath.style.opacity=`0`,this.scrollBarOverlay.style.opacity=`0`)},1200)}updateActiveToc(){if(!this.imagesColumn||!this.tocList||!this.tocNav||this.tocNav.offsetParent===null)return;let e=Array.from(this.tocList.querySelectorAll(`.case-study-page__toc-btn`));if(!e.length)return;let t=this.imagesColumn.getBoundingClientRect().top,n=0;for(let r=0;r<e.length;r++){let i=e[r].getAttribute(`data-target-id`),a=this.query(`#${i}`);a&&a.getBoundingClientRect().top-t<=120&&(n=r)}n!==this.activeTocIndex&&(this.activeTocIndex=n,e.forEach((e,t)=>{let r=t===n,i=e.closest(`.case-study-page__toc-item`);if(i&&i.classList.toggle(`is-active`,r),e.setAttribute(`aria-current`,r?`true`:`false`),r&&i&&this.tocNav){let e=i.offsetTop,t=this.tocNav.clientHeight;this.tocNav.scrollTo({top:Math.max(0,e-t/2+15),behavior:`smooth`})}}))}updatePaginationLinks(e){if(typeof document>`u`)return;let t=document.querySelector(`link[rel="prev"]`),n=document.querySelector(`link[rel="next"]`);e?.prevProject&&this.caseStudyConfigs[e.prevProject]?(t||(t=document.createElement(`link`),t.rel=`prev`,document.head.appendChild(t)),t.href=`https://longhoang-lyo.com/work/${e.prevProject}`):t&&t.remove(),e?.nextProject&&this.caseStudyConfigs[e.nextProject]?(n||(n=document.createElement(`link`),n.rel=`next`,document.head.appendChild(n)),n.href=`https://longhoang-lyo.com/work/${e.nextProject}`):n&&n.remove()}clearPaginationLinks(){if(typeof document>`u`)return;let e=document.querySelector(`link[rel="prev"]`),t=document.querySelector(`link[rel="next"]`);e&&e.remove(),t&&t.remove()}open(e){let t=typeof e==`string`?e:e?.projectKey;t&&this.caseStudyConfigs[t]&&this.loadProject(t),this.updatePaginationLinks(this.currentConfig),super.open()}close(){this.clearPaginationLinks(),super.close()}dispose(){this.pauseVideos(),this.clearPaginationLinks(),this.tocScrollTimeout&&=(clearTimeout(this.tocScrollTimeout),null),this.userTocInteractionTimeout&&=(clearTimeout(this.userTocInteractionTimeout),null),this.destroyLenis(),super.dispose(),this.closeButton=null,this.imagesColumn=null,this.imagesWrapper=null,this.tocNav=null,this.tocList=null,this.scrollBarPath=null,this.scrollBarOverlay=null,this.bottomControls=null}};export{l as t};
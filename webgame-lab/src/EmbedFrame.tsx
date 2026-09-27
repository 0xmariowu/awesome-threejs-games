import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { embedPalettes, frameHint, observeFrameHeight, type parseEmbedParams } from './embed'
import './embed.css'

export function EmbedFrame({ options, scene, picture, children, performance }: {
  options: ReturnType<typeof parseEmbedParams>
  scene: string
  picture: ReactNode
  children: ReactNode
  performance?: ReactNode
}) {
  const frame = useRef<HTMLElement>(null)
  const pictureCard = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = document.documentElement
    const previousLang = root.lang
    root.dataset.labEmbed = 'true'
    root.dataset.labTheme = options.theme
    root.lang = options.lang
    const sizeConsole = () => {
      const picture = pictureCard.current!.getBoundingClientRect()
      frame.current!.style.setProperty('--picture-height', `${picture.height}px`)
      const console = frame.current!.querySelector('#lab-console')!.getBoundingClientRect()
      root.style.setProperty('--console-left', `${console.left}px`)
      root.style.setProperty('--console-top', `${console.top}px`)
      root.style.setProperty('--console-width', `${console.width}px`)
    }
    // Changing the console cap can resize this frame. Write on the next frame,
    // outside ResizeObserver delivery, to avoid an undelivered-notification loop.
    let pendingLayout = 0
    const layout = new ResizeObserver(() => {
      cancelAnimationFrame(pendingLayout)
      pendingLayout = requestAnimationFrame(sizeConsole)
    })
    layout.observe(pictureCard.current!)
    layout.observe(frame.current!)
    sizeConsole()
    const stop = observeFrameHeight()
    return () => {
      stop()
      layout.disconnect()
      cancelAnimationFrame(pendingLayout)
      for (const key of ['--console-left', '--console-top', '--console-width']) root.style.removeProperty(key)
      delete root.dataset.labEmbed
      delete root.dataset.labTheme
      root.lang = previousLang
    }
  }, [options.lang, options.theme])

  const hint = frameHint(scene, options.lang)
  const palette = embedPalettes[options.theme]
  const style = Object.fromEntries(Object.entries(palette).map(([key, value]) => [`--frame-${key}`, value])) as CSSProperties
  return (
    <main ref={frame} className="lab-frame" style={{ ...style, colorScheme: options.theme }}>
      <div className="lab-picture-column">
        <div ref={pictureCard} id="lab-picture" tabIndex={0} aria-label={options.lang === 'zh' ? '演示画面' : 'Demo picture'}
          onPointerDown={(event) => {
            // Original menu controls keep their native focus behavior.
            if (!(event.target as HTMLElement).closest('button, input, select, textarea, a, .ink-ui-stage')) {
              event.currentTarget.focus({ preventScroll: true })
            }
          }}>
          {picture}
        </div>
        {hint && <p className="lab-frame-hint">{hint}</p>}
      </div>
      <aside id="lab-console" aria-label={options.lang === 'zh' ? '调试台' : 'Console'}>
        <h2 className="lab-console-title">{options.lang === 'zh' ? '调试台' : 'Console'}</h2>
        <div id="lab-controls">{children}</div>
        <section className="lab-performance-group">
          <h3>{options.lang === 'zh' ? '性能' : 'Performance'}</h3>
          <div id="lab-performance">{performance}</div>
        </section>
      </aside>
    </main>
  )
}

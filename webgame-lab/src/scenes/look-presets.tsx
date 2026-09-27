import { useEffect, useState } from 'react'
import { levaStore, useControls } from 'leva'
import { setInfo } from '../lab'
import LookPost from './look-post'

// Each preset writes every Light and Post control, so switching is order-free.
// Paths are Leva store paths: look.tsx uses folder "Light", look-post.tsx "Post".
interface Preset {
  light: {
    sunElevation: number
    sunAzimuth: number
    sunIntensity: number
    sunColor: string
    environmentIntensity: number
    backgroundIntensity: number
    backgroundBlurriness: number
    shadows: boolean
  }
  post: {
    toneMapping: 'none' | 'AgX' | 'ACES Filmic' | 'Neutral' | 'Reinhard'
    exposure: number
    bloom: boolean
    bloomStrength: number
    bloomThreshold: number
    bloomRadius: number
    ao: boolean
    aoIntensity: number
    aoRadius: number
  }
}

const presets = {
  // look.tsx and look-post.tsx defaults, with tone mapping switched off.
  raw: {
    light: {
      sunElevation: Math.atan2(9, Math.hypot(-5, 5)) * 180 / Math.PI, sunAzimuth: 315,
      sunIntensity: 3, sunColor: '#fff2e3',
      environmentIntensity: 0.5, backgroundIntensity: 1, backgroundBlurriness: 0, shadows: true,
    },
    post: {
      toneMapping: 'none', exposure: 1,
      bloom: true, bloomStrength: 0.3, bloomThreshold: 1, bloomRadius: 0,
      ao: true, aoIntensity: 1, aoRadius: 0.4,
    },
  },
  // Warm low sun raking across the ground; ACES keeps contrast and saturation.
  cinematic: {
    light: {
      sunElevation: 22, sunAzimuth: 285, sunIntensity: 5, sunColor: '#ffc27a',
      environmentIntensity: 0.35, backgroundIntensity: 0.85, backgroundBlurriness: 0.05, shadows: true,
    },
    post: {
      toneMapping: 'ACES Filmic', exposure: 1.3,
      bloom: true, bloomStrength: 0.25, bloomThreshold: 0.9, bloomRadius: 0.3,
      ao: true, aoIntensity: 1.3, aoRadius: 0.5,
    },
  },
  // High midday sun and a strong sky fill; Neutral keeps colours true.
  bright: {
    light: {
      sunElevation: 70, sunAzimuth: 330, sunIntensity: 5.5, sunColor: '#fffaf0',
      environmentIntensity: 1.1, backgroundIntensity: 1.1, backgroundBlurriness: 0, shadows: true,
    },
    post: {
      toneMapping: 'Neutral', exposure: 1.2,
      bloom: true, bloomStrength: 0.1, bloomThreshold: 1.2, bloomRadius: 0.1,
      ao: true, aoIntensity: 0.8, aoRadius: 0.35,
    },
  },
  // Sun just above the horizon, orange key, dim sky and a wider glow.
  dusk: {
    light: {
      sunElevation: 10, sunAzimuth: 260, sunIntensity: 6, sunColor: '#ff8a3d',
      environmentIntensity: 0.22, backgroundIntensity: 0.45, backgroundBlurriness: 0.1, shadows: true,
    },
    post: {
      toneMapping: 'ACES Filmic', exposure: 0.9,
      bloom: true, bloomStrength: 0.7, bloomThreshold: 0.6, bloomRadius: 0.5,
      ao: true, aoIntensity: 1.2, aoRadius: 0.5,
    },
  },
  // Weak sun, blurred dim sky, light mostly from the environment, wide soft AO.
  overcast: {
    light: {
      sunElevation: 60, sunAzimuth: 315, sunIntensity: 0.6, sunColor: '#e6edf5',
      environmentIntensity: 1.5, backgroundIntensity: 0.55, backgroundBlurriness: 0.6, shadows: true,
    },
    post: {
      toneMapping: 'Neutral', exposure: 1.25,
      bloom: false, bloomStrength: 0.3, bloomThreshold: 1, bloomRadius: 0,
      ao: true, aoIntensity: 1.6, aoRadius: 1.2,
    },
  },
} satisfies Record<string, Preset>

type PresetId = keyof typeof presets

const presetOptions: Record<string, PresetId> = {
  原始: 'raw',
  电影感: 'cinematic',
  清爽明亮: 'bright',
  傍晚: 'dusk',
  阴天: 'overcast',
}

function isPresetId(value: string | null): value is PresetId {
  return value !== null && Object.hasOwn(presets, value)
}

function LookPresetControls() {
  const [initial] = useState<PresetId>(() => {
    const requested = new URLSearchParams(location.search).get('preset')
    return isPresetId(requested) ? requested : 'raw'
  })
  const { Presets: preset } = useControls({
    Presets: { value: initial, options: presetOptions },
  })

  // Passive effects run in tree order and LookPost is the earlier sibling, so
  // its useControls calls have registered the Light and Post paths by now.
  useEffect(() => {
    const id = isPresetId(preset) ? preset : 'raw'
    const { light, post } = presets[id]
    levaStore.set({
      ...Object.fromEntries(Object.entries(light).map(([key, value]) => [`Light.${key}`, value])),
      ...Object.fromEntries(Object.entries(post).map(([key, value]) => [`Post.${key}`, value])),
    }, false)
    // App's effect calls initLab(), which resets __LAB__.info; publish on the
    // next task so the value survives, as Menu does.
    const timer = window.setTimeout(() => setInfo('preset', id), 0)
    return () => window.clearTimeout(timer)
  }, [preset])

  return null
}

export default function LookPresets() {
  return (
    <>
      <LookPost />
      <LookPresetControls />
    </>
  )
}

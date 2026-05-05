import * as React from "react"

// モバイル幅かどうかを React コンポーネントから判定するための共通 hook です。
const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // 初回レンダリング時はブラウザ幅が未確定なので undefined から始めます。
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // matchMedia で画面幅の変化を監視し、768px 未満なら mobile とみなします。
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

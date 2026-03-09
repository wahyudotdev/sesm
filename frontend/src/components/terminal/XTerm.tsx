import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { useEffect, useRef } from 'react'

import type { FC } from 'react'

export type TerminalStatus = 'connecting' | 'connected' | 'disconnected'

interface XTermProps {
  wsUrl: string
  /** When true the terminal should be visible — triggers re-focus on tab switch */
  active: boolean
  onStatusChange: (status: TerminalStatus) => void
}

const XTERM_THEME = {
  background: '#0d0e17',
  foreground: '#eeeeff',
  cursor: '#4f6ef7',
  cursorAccent: '#0d0e17',
  selectionBackground: 'rgba(79, 110, 247, 0.25)',
  black: '#13141f',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#f59e0b',
  blue: '#4f6ef7',
  magenta: '#a855f7',
  cyan: '#38bdf8',
  white: '#eeeeff',
  brightBlack: '#50536a',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#fbbf24',
  brightBlue: '#818cf8',
  brightMagenta: '#c084fc',
  brightCyan: '#7dd3fc',
  brightWhite: '#ffffff',
}

export const XTerm: FC<XTermProps> = ({ wsUrl, active, onStatusChange }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  // Re-focus + re-fit when the tab becomes visible
  useEffect(() => {
    if (active && termRef.current) {
      // Tiny defer so the CSS display change settles before measuring
      const id = setTimeout(() => {
        fitRef.current?.fit()
        termRef.current?.focus()
      }, 30)
      return () => clearTimeout(id)
    }
  }, [active])

  useEffect(() => {
    if (!containerRef.current) return

    onStatusChange('connecting')

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      theme: XTERM_THEME,
      allowProposedApi: true,
      scrollback: 5000,
    })
    termRef.current = term

    const fitAddon = new FitAddon()
    fitRef.current = fitAddon
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()
    term.focus()

    const sendResize = () => {
      fitAddon.fit()
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
    }

    const ws = new WebSocket(wsUrl)
    ws.binaryType = 'arraybuffer'

    // Timers for deferred resize retries (cleared on cleanup)
    let retryTimer1: ReturnType<typeof setTimeout>
    let retryTimer2: ReturnType<typeof setTimeout>

    ws.onopen = () => {
      onStatusChange('connected')
      sendResize()
      // Re-send after delays to handle the case where session-manager-plugin
      // hasn't finished connecting to SSM yet when the first resize arrives.
      retryTimer1 = setTimeout(sendResize, 1000)
      retryTimer2 = setTimeout(sendResize, 3000)
    }

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(e.data))
        return
      }
      if (typeof e.data === 'string') {
        try {
          const msg = JSON.parse(e.data) as { type?: string; message?: string }
          if (msg.type === 'error' && msg.message) {
            term.writeln(`\r\n\x1b[31m✖ ${msg.message}\x1b[0m\r\n`)
            onStatusChange('disconnected')
            return
          }
        } catch {
          // not JSON — just write it
        }
        term.write(e.data)
      }
    }

    ws.onclose = () => {
      term.writeln('\r\n\x1b[2m── session closed ──\x1b[0m')
      onStatusChange('disconnected')
    }

    ws.onerror = () => {
      term.writeln('\r\n\x1b[31m── connection error ──\x1b[0m')
      onStatusChange('disconnected')
    }

    // Keyboard input → WebSocket (binary for proper encoding)
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(data))
      }
    })

    // Auto-fit + send resize on container dimension change
    const ro = new ResizeObserver(() => {
      fitAddon.fit()
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
    })
    ro.observe(containerRef.current)

    return () => {
      clearTimeout(retryTimer1)
      clearTimeout(retryTimer2)
      ro.disconnect()
      ws.close()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
    // wsUrl is stable per tab — intentionally not re-running on onStatusChange changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl])

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      // Clicking anywhere in the terminal area re-focuses it
      onClick={() => termRef.current?.focus()}
    />
  )
}

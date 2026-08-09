declare module 'qrcode' {
  export function toDataURL(
    text: string,
    options?: {
      errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
      type?: 'image/png' | 'image/jpeg' | 'image/svg+xml'
      quality?: number
      margin?: number
      scale?: number
      width?: number
      color?: { dark?: string; light?: string }
      boilerplate?: boolean
    }
  ): Promise<string>

  export function toString(
    text: string,
    options?: {
      type?: 'terminal' | 'svg' | 'utf8'
      errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
      margin?: number
      scale?: number
      small?: boolean
    }
  ): Promise<string>

  // Other utilities if needed
  export function toBuffer(
    text: string,
    options?: Record<string, unknown>
  ): Promise<Buffer>
}

/**
 * Minimal type declarations for react-signature-canvas@^1.0.7
 * The package ships no .d.ts files and @types/react-signature-canvas doesn't exist.
 */
declare module 'react-signature-canvas' {
  import { Component } from 'react'

  export interface SignatureCanvasProps {
    velocityFilterWeight?: number
    minWidth?: number
    maxWidth?: number
    minDistance?: number
    dotSize?: number | (() => number)
    penColor?: string
    throttle?: number
    onEnd?: () => void
    onBegin?: () => void
    canvasProps?: React.CanvasHTMLAttributes<HTMLCanvasElement>
    clearOnResize?: boolean
    backgroundColor?: string
  }

  export default class SignatureCanvas extends Component<SignatureCanvasProps> {
    clear(): void
    isEmpty(): boolean
    getCanvas(): HTMLCanvasElement
    getTrimmedCanvas(): HTMLCanvasElement
    getSignaturePad(): unknown
    toDataURL(type?: string, encoderOptions?: number): string
    fromDataURL(dataURL: string, options?: object): void
    toData(): object[]
    fromData(pointGroups: object[]): void
    on(): void
    off(): void
  }
}

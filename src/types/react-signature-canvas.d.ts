declare module 'react-signature-canvas' {
  import * as React from 'react';

  interface SignatureCanvasProps {
    penColor?: string;
    backgroundColor?: string;
    clearOnResize?: boolean;
    canvasProps?: React.CanvasHTMLAttributes<HTMLCanvasElement>;
  }

  export default class SignatureCanvas extends React.Component<SignatureCanvasProps> {
    clear: () => void;
    isEmpty: () => boolean;
    getTrimmedCanvas: () => HTMLCanvasElement;
  }
}

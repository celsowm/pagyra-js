export interface ImageInfo {
  width: number;
  height: number;
  format: 'jpeg' | 'png' | 'gif' | 'webp';
  channels: number; // 3 for RGB, 4 for RGBA
  bitsPerChannel: number;
  data: ArrayBuffer;
}

export interface ImageDecodeOptions {
  maxWidth?: number;
  maxHeight?: number;
  scale?: number;
}

export interface ImageRenderOptions {
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  position?: 'top' | 'center' | 'bottom' | 'left' | 'right';
  opacity?: number;
}

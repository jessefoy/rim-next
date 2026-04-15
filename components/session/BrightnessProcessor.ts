"use client";

/**
 * BrightnessProcessor — custom LiveKit TrackProcessor that applies
 * brightness and contrast adjustments to the outgoing video stream.
 *
 * Unlike background blur, this affects what others see of you (not just
 * your local preview). Useful for members in dim rooms.
 *
 * Implements the TrackProcessor<Track.Kind.Video> interface from livekit-client.
 * Uses canvas 2D context filter to process each video frame before publishing.
 */

export class BrightnessProcessor {
  name = "brightness-contrast";
  processedTrack: MediaStreamTrack | undefined;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animFrame: number | null = null;
  private sourceVideo: HTMLVideoElement | null = null;
  private sourceStream: MediaStream | null = null;

  constructor(
    public brightness = 1.0,
    public contrast = 1.0,
  ) {}

  async init(opts: { track: MediaStreamTrack; element?: HTMLMediaElement }): Promise<void> {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) throw new Error("Canvas 2D not available");

    // Use the provided video element if available; otherwise create one from the track
    if (opts.element instanceof HTMLVideoElement) {
      this.sourceVideo = opts.element;
    } else {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      this.sourceStream = new MediaStream([opts.track]);
      video.srcObject = this.sourceStream;
      await video.play().catch(() => {});
      this.sourceVideo = video;
    }

    this.canvas.width = this.sourceVideo.videoWidth || 640;
    this.canvas.height = this.sourceVideo.videoHeight || 480;

    const render = () => {
      const video = this.sourceVideo;
      const ctx = this.ctx;
      const canvas = this.canvas;
      if (ctx && video && canvas && video.readyState >= 2) {
        if (canvas.width !== video.videoWidth && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        ctx.filter = `brightness(${this.brightness}) contrast(${this.contrast})`;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      this.animFrame = requestAnimationFrame(render);
    };
    render();

    // Capture the processed canvas as a MediaStreamTrack
    this.processedTrack = (this.canvas as HTMLCanvasElement & {
      captureStream(fps?: number): MediaStream;
    }).captureStream(30).getVideoTracks()[0];
  }

  async restart(opts: { track: MediaStreamTrack; element?: HTMLMediaElement }): Promise<void> {
    await this.destroy();
    await this.init(opts);
  }

  async destroy(): Promise<void> {
    if (this.animFrame !== null) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    if (this.processedTrack) {
      this.processedTrack.stop();
      this.processedTrack = undefined;
    }
    if (this.sourceStream) {
      this.sourceStream.getTracks().forEach((t) => t.stop());
      this.sourceStream = null;
    }
    this.canvas = null;
    this.ctx = null;
    this.sourceVideo = null;
  }

  /** Update brightness/contrast without recreating the processor */
  setValues(brightness: number, contrast: number) {
    this.brightness = brightness;
    this.contrast = contrast;
  }
}

// audio.service.ts — MediaRecorder-based microphone capture
// Replaces the old AudioContext/ScriptProcessorNode implementation
// which produced silent PCM on Intel Smart Sound microphones.

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private onDataCallback: ((base64Data: string, mimeType: string) => void) | null = null;
  private recordedMimeType: string = 'audio/webm';

  /**
   * Start recording from the microphone using MediaRecorder.
   * The callback receives (base64Audio, mimeType) when stopRecording() is called.
   */
  async startRecording(onData: (base64Data: string, mimeType?: string) => void): Promise<void> {
    // Check MediaRecorder support
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder is not supported in this browser. Please use Chrome, Edge, or Firefox.');
    }

    try {
      this.chunks = [];
      this.onDataCallback = onData;

      // 1. Request microphone with audio processing constraints
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      // 2. Log microphone diagnostics
      const track = this.stream.getAudioTracks()[0];
      if (!track) {
        throw new Error('No microphone audio track found.');
      }
      console.log('[MIC] device:', track.label);
      console.log('[MIC] settings:', track.getSettings());

      if (!track.enabled) {
        console.warn('[MIC] Track disabled, enabling it.');
        track.enabled = true;
      }

      // 3. Select best MIME type for MediaRecorder
      this.recordedMimeType = this.selectMimeType();
      console.log('[RECORDER] mimeType:', this.recordedMimeType);

      // 4. Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.recordedMimeType,
      });

      // Collect data chunks as they arrive
      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      // When recording stops, assemble and deliver the audio
      this.mediaRecorder.onstop = () => {
        this.handleRecordingComplete();
      };

      this.mediaRecorder.onerror = (event: Event) => {
        console.error('[RECORDER] error:', event);
      };

      // 5. Start recording — request data every 1 second for chunking
      this.mediaRecorder.start(1000);
      console.log('[RECORDER] started');

    } catch (error) {
      console.error('[RECORDER] Error starting microphone:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Stop recording. The onData callback will fire asynchronously with the final audio.
   */
  stopRecording(): void {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        console.log('[RECORDER] stopping...');
        this.mediaRecorder.stop();
      } else {
        console.warn('[RECORDER] No active recording to stop.');
      }

      // Stop microphone tracks (the onstop handler will fire first)
      if (this.stream) {
        this.stream.getTracks().forEach((track) => {
          track.stop();
        });
        this.stream = null;
      }
    } catch (error) {
      console.error('[RECORDER] Error stopping recording:', error);
      this.cleanup();
    }
  }

  /**
   * Called by MediaRecorder.onstop — assembles chunks, creates debug player,
   * converts to base64, and fires the callback.
   */
  private handleRecordingComplete(): void {
    console.log('[RECORDER] stopped');

    if (this.chunks.length === 0) {
      console.error('[RECORDER] No audio chunks captured!');
      return;
    }

    // Combine all chunks into a single Blob
    const finalBlob = new Blob(this.chunks, { type: this.recordedMimeType });
    console.log('[RECORDER] final blob size:', finalBlob.size);
    console.log('[RECORDER] final MIME type:', finalBlob.type);

    if (finalBlob.size === 0) {
      console.error('[RECORDER] Final blob is empty, not sending.');
      return;
    }

    // Debug audio preview — lets you listen to exactly what was captured
    this.createDebugPlayer(finalBlob);

    // Convert to base64 and deliver via callback
    this.blobToBase64(finalBlob).then((base64Data) => {
      console.log('[RECORDER] base64 length:', base64Data.length);

      if (this.onDataCallback) {
        this.onDataCallback(base64Data, this.recordedMimeType);
      }
    }).catch((err) => {
      console.error('[RECORDER] Failed to convert to base64:', err);
    });
  }

  /**
   * Select the best supported MIME type for MediaRecorder.
   * Prefers audio/webm;codecs=opus, falls back to audio/webm, then audio/ogg.
   */
  private selectMimeType(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ];

    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }

    // Fallback: let the browser pick
    console.warn('[RECORDER] No preferred MIME type supported, using browser default.');
    return '';
  }

  /**
   * Create a temporary debug audio player in the bottom-left corner.
   * Label: "Debug Recorded Audio". Easy to remove after verification.
   */
  private createDebugPlayer(blob: Blob): void {
    // Remove any previous debug player
    const existing = document.getElementById('debug-recorded-audio');
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    container.id = 'debug-recorded-audio';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.left = '20px';
    container.style.zIndex = '99999';
    container.style.background = 'rgba(0,0,0,0.8)';
    container.style.padding = '8px 12px';
    container.style.borderRadius = '8px';
    container.style.color = '#fff';
    container.style.fontSize = '12px';
    container.style.fontFamily = 'monospace';

    const label = document.createElement('div');
    label.textContent = `Debug Recorded Audio (${(blob.size / 1024).toFixed(1)} KB, ${blob.type})`;
    label.style.marginBottom = '4px';
    container.appendChild(label);

    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = URL.createObjectURL(blob);
    audio.style.display = 'block';
    container.appendChild(audio);

    document.body.appendChild(container);
    console.log('[DEBUG] Audio player created.');
  }

  /**
   * Convert a Blob to a base64 string (without the data URL prefix).
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const base64String = reader.result.split(',')[1];
          resolve(base64String);
        } else {
          reject(new Error('Failed to convert audio blob to base64.'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Clean up all resources.
   */
  private cleanup(): void {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      this.mediaRecorder = null;

      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }

      this.chunks = [];
    } catch (error) {
      console.error('[RECORDER] Cleanup error:', error);
    }
  }
}
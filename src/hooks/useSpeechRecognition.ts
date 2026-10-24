import { useCallback, useEffect, useRef, useState } from 'react';

export interface SpeechRecognitionControls {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  error: string | null;
  language: string;
  setLanguage: (language: string) => void;
  startListening: () => void;
  stopListening: () => void;
}

const API_BASE_URL = (import.meta.env.VITE_KEBO_API_BASE_URL || 'https://kebo-ai-project.onrender.com').replace(/\/$/, '');
const configuredTranscribeUrl = import.meta.env.VITE_KEBO_TRANSCRIBE_URL;

function resolveTranscribeUrl(): string {
  if (!configuredTranscribeUrl) return API_BASE_URL + '/api/transcribe';
  const value = configuredTranscribeUrl.replace(/\/$/, '');
  if (value.startsWith('/api/')) return API_BASE_URL + value;
  if (value === API_BASE_URL) return value + '/api/transcribe';
  return value;
}

const TRANSCRIBE_URL = resolveTranscribeUrl();

export function useSpeechRecognition(onFinalTranscript: (text: string) => void): SpeechRecognitionControls {
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isSupported] = useState(() => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices && typeof MediaRecorder !== 'undefined'));
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState(() => typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US');

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  const stopListening = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setIsListening(false);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      return;
    }
    try {
      recorder.stop();
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      setIsListening(false);
      setError('Could not stop the microphone recording. You can continue using text chat.');
    }
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported || isListening) return;
    void (async () => {
      try {
        setError(null);
        setTranscript('');
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is not supported in this browser.');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        // Chrome/Edge/Firefox record webm; Safari records mp4. Pick what this browser can actually produce.
        const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
        const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        const startedAt = Date.now();
        chunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onstart = () => setIsListening(true);
        recorder.onerror = () => {
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          recorderRef.current = null;
          setIsListening(false);
          setTranscript('');
          setError('Microphone recording failed. You can continue using text chat.');
        };
        recorder.onstop = async () => {
          setIsListening(false);
          stream.getTracks().forEach((track) => track.stop());
          recorderRef.current = null;
          streamRef.current = null;
          const audio = new Blob(chunksRef.current, { type: (recorder.mimeType || 'audio/webm').split(';')[0] });
          if (Date.now() - startedAt < 600 || audio.size < 2000) {
            setError('That was too short to hear. Hold the button a little longer and speak.');
            return;
          }
          const extension = audio.type.includes('mp4') ? 'mp4' : audio.type.includes('ogg') ? 'ogg' : 'webm';
          setTranscript('Transcribing...');
          try {
            const form = new FormData();
            form.append('audio', audio, `kebo-voice.${extension}`);
            form.append('language', language);
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), 45_000);
            let response: Response;
            try {
              response = await fetch(TRANSCRIBE_URL, { method: 'POST', body: form, signal: controller.signal });
            } finally {
              window.clearTimeout(timeout);
            }
            let data: { text?: string; error?: string };
            try {
              data = (await response.json()) as { text?: string; error?: string };
            } catch {
              throw new Error(`The voice service is unavailable (HTTP ${response.status}). You can use text chat.`);
            }
            if (!response.ok || !data.text?.trim()) throw new Error(data.error || 'No speech was detected.');
            setTranscript(data.text.trim());
            onFinalTranscriptRef.current(data.text.trim());
          } catch (transcriptionError) {
            const isNetwork = transcriptionError instanceof TypeError || (transcriptionError instanceof DOMException && transcriptionError.name === 'AbortError');
            setError(isNetwork
              ? 'Could not reach the voice service (it may be waking up, which can take up to a minute). Try again, or use text chat.'
              : transcriptionError instanceof Error ? transcriptionError.message : 'Transcription failed.');
            setTranscript('');
          }
        };
        recorder.start();
        recorderRef.current = recorder;
      } catch (recordingError) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setIsListening(false);
        setError(recordingError instanceof DOMException && recordingError.name === 'NotAllowedError'
          ? 'Microphone permission was denied. You can continue using text chat.'
          : recordingError instanceof Error && recordingError.message.includes('not supported')
            ? recordingError.message
            : 'Could not start microphone recording. You can continue using text chat.');
      }
    })();
  }, [isListening, isSupported, language]);

  useEffect(() => () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  return { isSupported, isListening, transcript, error, language, setLanguage, startListening, stopListening };
}

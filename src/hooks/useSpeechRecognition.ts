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

const TRANSCRIBE_URL = import.meta.env.VITE_KEBO_TRANSCRIBE_URL || '/api/transcribe';

export function useSpeechRecognition(onFinalTranscript: (text: string) => void): SpeechRecognitionControls {
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isSupported] = useState(() => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices && typeof MediaRecorder !== 'undefined'));
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState(() => navigator.language || 'en-US');

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  const stopListening = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported || isListening) return;
    void (async () => {
      try {
        setError(null);
        setTranscript('');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        chunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onstart = () => setIsListening(true);
        recorder.onstop = async () => {
          setIsListening(false);
          stream.getTracks().forEach((track) => track.stop());
          recorderRef.current = null;
          streamRef.current = null;
          const audio = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          if (!audio.size) return;
          setTranscript('Transcribing...');
          try {
            const form = new FormData();
            form.append('audio', audio, 'kebo-voice.webm');
            form.append('language', language);
            const response = await fetch(TRANSCRIBE_URL, { method: 'POST', body: form });
            const data = (await response.json()) as { text?: string; error?: string };
            if (!response.ok || !data.text?.trim()) throw new Error(data.error || 'No speech was detected.');
            setTranscript(data.text.trim());
            onFinalTranscriptRef.current(data.text.trim());
          } catch (transcriptionError) {
            setError(transcriptionError instanceof Error ? transcriptionError.message : 'Transcription failed.');
            setTranscript('');
          }
        };
        recorder.start();
        recorderRef.current = recorder;
      } catch (recordingError) {
        setError(recordingError instanceof DOMException && recordingError.name === 'NotAllowedError' ? 'Microphone permission was denied.' : 'Could not start microphone recording.');
      }
    })();
  }, [isListening, isSupported, language]);

  useEffect(() => () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  return { isSupported, isListening, transcript, error, language, setLanguage, startListening, stopListening };
}

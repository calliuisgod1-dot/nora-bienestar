/**
 * Get all available Spanish voices
 */
export function getAvailableVoices() {
  if (!('speechSynthesis' in window)) return [];
  // Browser voices are often loaded asynchronously
  const voices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('es'));
  return voices;
}

/**
 * Free local speech synthesis using Browser API
 */
export function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  
  // Cancel any existing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-ES';
  
  const setVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const preferredVoiceName = localStorage.getItem('nora-voice');
    
    if (preferredVoiceName) {
      const voice = voices.find(v => v.name === preferredVoiceName);
      if (voice) {
        utterance.voice = voice;
        return;
      }
    }

    // Fallback: Prefer Google voices for better naturalness, or Microsoft/Apple female ones
    const femaleVoice = voices.find(v => 
      v.lang.startsWith('es') && 
      (v.name.includes('Google') || v.name.includes('Female') || v.name.includes('Helena') || v.name.includes('Monica') || v.name.includes('Luciana') || v.name.includes('Paulina'))
    );
    
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }
  };

  if (window.speechSynthesis.getVoices().length > 0) {
    setVoice();
  } else {
    window.speechSynthesis.onvoiceschanged = setVoice;
  }

  utterance.pitch = 1.05; // Friendly tone
  utterance.rate = 1.05;  // Slightly energetic but calm
  
  window.speechSynthesis.speak(utterance);
}

/**
 * Free local speech recognition using Browser API
 */
export function startRecognition(onResult: (text: string) => void, onEnd: () => void) {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    alert("Tu navegador no soporta reconocimiento de voz. Prueba con Chrome o Android.");
    onEnd();
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event: any) => {
    const text = event.results[0][0].transcript;
    onResult(text);
  };

  recognition.onerror = (event: any) => {
    console.error("Speech recognition error", event.error);
    onEnd();
  };

  recognition.onend = () => {
    onEnd();
  };

  recognition.start();
  return recognition;
}

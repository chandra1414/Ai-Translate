// Supported languages (50+)
const languages = {
    "auto": "Detect Language",
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ru": "Russian",
    "zh-CN": "Chinese (Simplified)",
    "ja": "Japanese",
    "ko": "Korean",
    "ar": "Arabic",
    "hi": "Hindi",
    "bn": "Bengali",
    "tr": "Turkish",
    "vi": "Vietnamese",
    "pl": "Polish",
    "uk": "Ukrainian",
    "nl": "Dutch",
    "sv": "Swedish",
    "fi": "Finnish",
    "no": "Norwegian",
    "el": "Greek",
    "cs": "Czech",
    "ro": "Romanian",
    "hu": "Hungarian",
    "th": "Thai",
    "id": "Indonesian",
    "fa": "Persian",
    "sr": "Serbian",
    "bg": "Bulgarian",
    "he": "Hebrew",
    "ms": "Malay",
    "sw": "Swahili",
    "ta": "Tamil",
    "te": "Telugu",
    "mr": "Marathi",
    "gu": "Gujarati",
    "kn": "Kannada",
    "ml": "Malayalam",
    "si": "Sinhala",
    "ur": "Urdu",
    "ne": "Nepali",
    "my": "Burmese",
    "km": "Khmer",
    "la": "Latin",
    "eo": "Esperanto"
};

const sourceLang = document.getElementById("sourceLang");
const targetLang = document.getElementById("targetLang");
const inputText = document.getElementById("inputText");
const outputText = document.getElementById("outputText");
const charCount = document.getElementById("charCount");
const loadingOverlay = document.getElementById("loading");

let isVoiceTranslation = false;

// Speech Recording Setup (Cross-browser backend transcription)
const recordBtn = document.getElementById("recordBtn");
const listeningOverlay = document.getElementById("listeningOverlay");
const stopRecordBtn = document.getElementById("stopRecordBtn");
const cancelRecordBtn = document.getElementById("cancelRecordBtn");

let recorder;
let isRecording = false;

function cleanupRecording() {
    if (recorder) {
        recorder.destroy();
        recorder = null;
    }
    isRecording = false;
    recordBtn.classList.remove("recording");
    listeningOverlay.classList.remove("active");
}

if (recordBtn) {
    recordBtn.addEventListener('click', async () => {
        if (!isRecording) {
            // Start recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                
                // Fallback to basic object if RecordRTC has issues
                recorder = RecordRTC(stream, {
                    type: 'audio',
                    mimeType: 'audio/wav',
                    recorderType: StereoAudioRecorder,
                    desiredSampRate: 16000
                });
                
                recorder.startRecording();
                isRecording = true;
                
                recordBtn.classList.add("recording");
                listeningOverlay.classList.add("active");
            } catch (err) {
                showToast("Microphone access denied or error occurred.");
            }
        }
    });
}

if (stopRecordBtn) {
    stopRecordBtn.addEventListener('click', () => {
        if (isRecording) {
            recorder.stopRecording(() => {
                const blob = recorder.getBlob();
                cleanupRecording();
                transcribeAudio(blob);
            });
        }
    });
}

if (cancelRecordBtn) {
    cancelRecordBtn.addEventListener('click', () => {
        if (isRecording) {
            recorder.stopRecording(() => {
                cleanupRecording();
                showToast("Recording cancelled.");
            });
        }
    });
}

async function transcribeAudio(blob) {
    showToast("Transcribing audio...");
    
    const formData = new FormData();
    formData.append("audio", blob, "recording.wav");
    formData.append("lang", sourceLang.value);
    
    try {
        const response = await fetch('/transcribe', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.error) {
            showToast("Transcription Error: " + data.error);
        } else {
            inputText.value = data.text;
            charCount.textContent = data.text.length;
            showToast("Speech captured! Translating...");
            
            isVoiceTranslation = true;
            document.getElementById("translateBtn").click();
        }
    } catch (err) {
        showToast("Failed to transcribe audio.");
    }
}

// Populate dropdowns
window.onload = () => {
    for (const [code, name] of Object.entries(languages)) {
        sourceLang.innerHTML += `<option value="${code}">${name}</option>`;
        targetLang.innerHTML += `<option value="${code}">${name}</option>`;
    }

    sourceLang.value = "auto";
    targetLang.value = "en";
};

// Character Count
inputText.addEventListener('input', () => {
    charCount.textContent = inputText.value.length;
});

// Swap languages
document.getElementById("swapBtn").addEventListener("click", () => {
    if (sourceLang.value === "auto") {
        showToast("Cannot swap when 'Detect Language' is selected");
        return;
    }
    
    const tempLang = sourceLang.value;
    sourceLang.value = targetLang.value;
    targetLang.value = tempLang;
    
    const tempText = inputText.value;
    inputText.value = outputText.value;
    outputText.value = tempText;
    
    charCount.textContent = inputText.value.length;
});

// Translate
document.getElementById("translateBtn").addEventListener("click", async () => {
    const text = inputText.value;
    const sLang = sourceLang.value;
    const tLang = targetLang.value;

    if (!text.trim()) {
        showToast("Please enter text to translate.");
        return;
    }

    loadingOverlay.classList.add("active");

    try {
        const response = await fetch("/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text, source_lang: sLang, target_lang: tLang })
        });

        const data = await response.json();
        if (data.error) {
            showToast("Error: " + data.error);
        } else {
            outputText.value = data.translated_text;
            
            // Auto-play if it was triggered by voice
            if (isVoiceTranslation) {
                setTimeout(() => speakText('outputText'), 500);
                isVoiceTranslation = false;
            }
        }
    } catch (err) {
        showToast("Translation failed. Please try again.");
    } finally {
        loadingOverlay.classList.remove("active");
    }
});

// Text-to-speech using backend gTTS
async function speakText(elementId) {
    const text = document.getElementById(elementId).value;
    if (!text) return;
    
    let lang = elementId === 'inputText' ? sourceLang.value : targetLang.value;
    if (lang === 'auto') lang = 'en';
    
    // Add loading state to button
    const btn = event.currentTarget || document.querySelector(`button[onclick="speakText('${elementId}')"]`);
    const originalHTML = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    
    try {
        const response = await fetch('/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, lang: lang })
        });
        
        if (!response.ok) {
            showToast("Error generating speech.");
            if (btn) btn.innerHTML = originalHTML;
            return;
        }
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        
        audio.onended = () => {
            if (btn) btn.innerHTML = originalHTML;
        };
        
        audio.play();
    } catch (err) {
        showToast("Text-to-speech failed.");
        if (btn) btn.innerHTML = originalHTML;
    }
}

// Copy to clipboard
function copyText(elementId) {
    const text = document.getElementById(elementId).value;
    if (!text) return;
    
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!");
}

function clearText(elementId) {
    document.getElementById(elementId).value = "";
    if (elementId === 'inputText') {
        charCount.textContent = "0";
    }
}

// Toast notification
function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

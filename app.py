import os
import io
import uuid
from flask import Flask, render_template, request, jsonify, send_file
from deep_translator import GoogleTranslator
from google.transliteration import transliterate_text
import speech_recognition as sr
from gtts import gTTS

# Explicitly define the template folder
template_dir = os.path.abspath('templates')
app = Flask(__name__, template_folder=template_dir)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/translate', methods=['POST'])
def translate_text():
    try:
        data = request.get_json()
        text = data.get('text')
        source_lang = data.get('source_lang')
        target_lang = data.get('target_lang')

        print(f"DEBUG: Original text '{text}' from {source_lang} to {target_lang}")

        # Smart Transliteration Step
        # If the user typed Romanized text (e.g., "enduku") but specified an Indic source language (like "te"),
        # we try to transliterate it to the native script ("ఎందుకు") first.
        if source_lang != 'auto' and source_lang != 'en':
            try:
                text = transliterate_text(text, lang_code=source_lang)
                print(f"DEBUG: Transliterated to '{text}'")
            except Exception as e:
                # If language is unsupported or transliteration fails, we just silently continue with original text
                print(f"DEBUG: Transliteration skipped/failed: {e}")

        # Perform translation
        translated = GoogleTranslator(source=source_lang, target=target_lang).translate(text)
        
        return jsonify({'translated_text': translated})
    
    except Exception as e:
        print(f"DEBUG: Translation Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400
        
    audio_file = request.files['audio']
    lang = request.form.get('lang', 'en-US')
    
    if lang == 'auto':
        lang = 'en-US'
        
    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(audio_file) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data, language=lang)
            return jsonify({'text': text})
    except sr.UnknownValueError:
        return jsonify({'error': 'Speech could not be understood'}), 400
    except sr.RequestError as e:
        return jsonify({'error': f'Speech service error: {e}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/tts', methods=['POST'])
def tts():
    data = request.json
    text = data.get('text', '')
    lang = data.get('lang', 'en')
    
    if not text:
        return jsonify({'error': 'No text provided'}), 400
        
    try:
        # Some language codes might have region modifiers like en-US, take primary code
        lang = lang.split('-')[0]
        
        if lang == 'auto':
            lang = 'en'
            
        filename = f"temp_{uuid.uuid4().hex}.mp3"
        filepath = os.path.join(app.root_path, filename)
        
        tts_engine = gTTS(text=text, lang=lang)
        tts_engine.save(filepath)
        
        # Read file into memory and delete from disk
        return_data = io.BytesIO()
        with open(filepath, 'rb') as f:
            return_data.write(f.read())
        return_data.seek(0)
        os.remove(filepath)
        
        return send_file(return_data, mimetype="audio/mpeg", as_attachment=False, download_name="speech.mp3")
        
    except Exception as e:
        print(f"DEBUG: TTS Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
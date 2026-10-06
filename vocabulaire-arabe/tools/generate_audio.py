#!/usr/bin/env python3
"""Génère la prononciation des mots de words.json qui n'en ont pas encore.

Chaque fichier est écrit dans audio/<id>.mp4 et le champ "audio" du mot est rempli.
Un mot peut avoir un champ facultatif "say" : le texte à prononcer, s'il doit différer de l'affichage.
La voix est une voix de synthèse arabe (Piper « miro V2 », ar-SA, via sherpa-onnx), choisie parce qu'elle marque bien les voyelles longues : écoute
toujours le résultat, et écris les mots avec leurs voyelles (harakat) pour une
prononciation correcte.

Prérequis :
    pip install sherpa-onnx soundfile numpy
    ffmpeg installé sur la machine

Utilisation (depuis la racine du projet) :
    python tools/generate_audio.py              # mots sans audio
    python tools/generate_audio.py s2-qalam     # régénérer des mots précis
"""
import json
import os
import subprocess
import sys
import tarfile
import tempfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORDS = os.path.join(ROOT, 'words.json')
AUDIO_DIR = os.path.join(ROOT, 'audio')
MODELS = os.path.join(ROOT, 'tools', '.models')
MODEL_NAME = 'vits-piper-ar_JO-SA_miro_V2-high'
MODEL_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/' + MODEL_NAME + '.tar.bz2'
SPEED = 0.8


def ensure_model():
    path = os.path.join(MODELS, MODEL_NAME)
    if os.path.isdir(path):
        return path
    os.makedirs(MODELS, exist_ok=True)
    print('Téléchargement de la voix arabe (environ 80 Mo)…')
    with tempfile.NamedTemporaryFile(suffix='.tar.bz2', delete=False) as tmp:
        urllib.request.urlretrieve(MODEL_URL, tmp.name)
        with tarfile.open(tmp.name) as tar:
            tar.extractall(MODELS)
    os.unlink(tmp.name)
    return path


def load_tts(model_dir):
    import sherpa_onnx
    vits = sherpa_onnx.OfflineTtsVitsModelConfig(
        model=os.path.join(model_dir, 'ar_JO-SA_miro_V2-high.onnx'),
        tokens=os.path.join(model_dir, 'tokens.txt'),
        data_dir=os.path.join(model_dir, 'espeak-ng-data'),
        noise_scale=0.5, noise_scale_w=0.6)
    config = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=vits, num_threads=2))
    return sherpa_onnx.OfflineTts(config)


def spoken_text(word):
    """Texte envoyé à la voix. Le champ facultatif "say" permet de forcer une prononciation.
    Contournement d'un défaut du phonétiseur espeak-ng : un kaf final avec tanwin (كٌ)
    est lu « ka-un » ; on l'écrit donc كُنْ pour obtenir « -kun »."""
    text = word.get('say') or word['ar']
    return text.replace('كٌ', 'كُنْ')


def synthesize(tts, text, out_path):
    import numpy as np
    import soundfile as sf
    audio = tts.generate(text, sid=0, speed=SPEED)
    samples = np.array(audio.samples, dtype='float32')
    peak = float(np.abs(samples).max()) or 1.0
    samples = samples / peak * 0.9
    rate = audio.sample_rate
    samples = np.concatenate([np.zeros(int(rate * 0.15), 'float32'), samples, np.zeros(int(rate * 0.25), 'float32')])
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as wav:
        sf.write(wav.name, samples, rate)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav.name, '-ac', '1', '-ar', '44100',
                    '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out_path], check=True)
    os.unlink(wav.name)


def main():
    force = set(sys.argv[1:])
    with open(WORDS, encoding='utf-8') as f:
        data = json.load(f)
    todo = []
    for w in data.get('words', []):
        target = w.get('audio') or 'audio/' + w['id'] + '.mp4'
        missing = not os.path.exists(os.path.join(ROOT, target))
        if w['id'] in force or not w.get('audio') or missing:
            todo.append((w, 'audio/' + w['id'] + '.mp4'))
    if not todo:
        print('Tous les mots ont déjà leur prononciation.')
        return
    os.makedirs(AUDIO_DIR, exist_ok=True)
    tts = load_tts(ensure_model())
    for w, rel in todo:
        synthesize(tts, spoken_text(w), os.path.join(ROOT, rel))
        w['audio'] = rel
        print('  ' + w['id'] + ' : ' + w['ar'] + ' → ' + rel)
    with open(WORDS, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(str(len(todo)) + ' prononciation(s) générée(s). Écoute-les avant de publier.')


if __name__ == '__main__':
    main()

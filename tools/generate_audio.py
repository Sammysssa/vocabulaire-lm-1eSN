#!/usr/bin/env python3
"""Génère la prononciation des mots de words.json qui n'en ont pas encore.

Chaque fichier est écrit dans audio/<id>.mp4 et le champ "audio" du mot est rempli.
Un mot peut avoir un champ facultatif "say" : le texte à prononcer, s'il doit différer
de l'affichage. Écris toujours les mots avec leurs voyelles (harakat).

La voix est une voix de synthèse arabe (Piper « miro V2 », ar-SA). Le script modifie le
modèle pour pouvoir régler la durée de chaque son : les voyelles longues (ا، ي، و de
prolongation) sont allongées pour être bien audibles, et la terminaison finale (-un, -a…)
est raccourcie. Écoute toujours le résultat avant de publier.

Prérequis :
    pip install onnx onnxruntime soundfile numpy
    espeak-ng et ffmpeg installés (macOS : brew install espeak-ng ffmpeg)

Utilisation (depuis la racine du projet) :
    python tools/generate_audio.py              # mots sans audio
    python tools/generate_audio.py s2-bab       # régénérer des mots précis
"""
import json
import os
import subprocess
import sys
import tarfile
import tempfile
import unicodedata
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORDS = os.path.join(ROOT, 'words.json')
AUDIO_DIR = os.path.join(ROOT, 'audio')
MODELS = os.path.join(ROOT, 'tools', '.models')
MODEL_NAME = 'vits-piper-ar_JO-SA_miro_V2-high'
MODEL_FILE = 'ar_JO-SA_miro_V2-high.onnx'
MODEL_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/' + MODEL_NAME + '.tar.bz2'

SPEED = 0.85          # débit général (plus petit = plus lent)
LONG_VOWEL = 2.5      # allongement des voyelles longues
FINAL_VOWEL = 0.6     # raccourcissement de la dernière voyelle brève (tanwin, fin de verbe)
NOISE, NOISE_W = 0.667, 0.4
VOWELS = set('aiueoɑæɐəɛɔʊɪ')


def ensure_model():
    folder = os.path.join(MODELS, MODEL_NAME)
    if not os.path.isdir(folder):
        os.makedirs(MODELS, exist_ok=True)
        print('Téléchargement de la voix arabe (environ 80 Mo)…')
        with tempfile.NamedTemporaryFile(suffix='.tar.bz2', delete=False) as tmp:
            urllib.request.urlretrieve(MODEL_URL, tmp.name)
            with tarfile.open(tmp.name) as tar:
                tar.extractall(MODELS)
        os.unlink(tmp.name)
    patched = os.path.join(folder, 'duration-control.onnx')
    if not os.path.exists(patched):
        import onnx
        from onnx import helper, TensorProto
        model = onnx.load(os.path.join(folder, MODEL_FILE))
        graph = model.graph
        ceil = next(n for n in graph.node if n.op_type == 'Ceil')
        graph.input.append(helper.make_tensor_value_info('dur_scale', TensorProto.FLOAT, ['batch_size', 1, 'phonemes']))
        graph.node.insert(list(graph.node).index(ceil), helper.make_node('Mul', [ceil.input[0], 'dur_scale'], ['/dur_scaled'], name='/DurScale'))
        ceil.input[0] = '/dur_scaled'
        onnx.save(model, patched)
    with open(os.path.join(folder, MODEL_FILE + '.json'), encoding='utf-8') as f:
        config = json.load(f)
    return patched, config


def spoken_text(word):
    """Contournement d'un défaut d'espeak-ng : un kaf final avec tanwin (كٌ) est lu
    « ka-un » ; on l'écrit donc كُنْ pour obtenir « -kun »."""
    text = word.get('say') or word['ar']
    return text.replace('كٌ', 'كُنْ')


def phonemize(text):
    out = subprocess.run(['espeak-ng', '-v', 'ar', '-q', '--ipa', text], capture_output=True, text=True, check=True).stdout
    return unicodedata.normalize('NFD', ' '.join(out.split()))


def encode(ipa, symbols):
    chars = [c for c in ipa if c in symbols]
    shorts = [i for i, c in enumerate(chars) if c in VOWELS and not (i + 1 < len(chars) and chars[i + 1] == 'ː')]
    last_short = shorts[-1] if shorts and shorts[-1] >= len(chars) - 3 else -1
    ids, scales = [1, 0], [1.0, 1.0]
    for i, c in enumerate(chars):
        long_vowel = c in VOWELS and i + 1 < len(chars) and chars[i + 1] == 'ː'
        length_mark = c == 'ː' and i > 0 and chars[i - 1] in VOWELS
        factor = LONG_VOWEL if (long_vowel or length_mark) else (FINAL_VOWEL if i == last_short else 1.0)
        ids += [symbols[c][0], 0]
        scales += [factor, factor]
    ids.append(2)
    scales.append(1.0)
    return ids, scales


def synthesize(session, config, text, out_path):
    import numpy as np
    import soundfile as sf
    ids, scales = encode(phonemize(text), config['phoneme_id_map'])
    audio = session.run(None, {
        'input': np.array([ids], dtype=np.int64),
        'input_lengths': np.array([len(ids)], dtype=np.int64),
        'scales': np.array([NOISE, 1.0 / SPEED, NOISE_W], dtype=np.float32),
        'dur_scale': np.array([[scales]], dtype=np.float32),
    })[0].squeeze().astype('float32')
    rate = config['audio']['sample_rate']
    audio = audio / (float(np.abs(audio).max()) or 1.0) * 0.9
    audio = np.concatenate([np.zeros(int(rate * 0.15), 'float32'), audio, np.zeros(int(rate * 0.25), 'float32')])
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as wav:
        sf.write(wav.name, audio, rate)
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
        if w['id'] in force or not w.get('audio') or not os.path.exists(os.path.join(ROOT, target)):
            todo.append((w, 'audio/' + w['id'] + '.mp4'))
    if not todo:
        print('Tous les mots ont déjà leur prononciation.')
        return
    import onnxruntime
    model_path, config = ensure_model()
    session = onnxruntime.InferenceSession(model_path, providers=['CPUExecutionProvider'])
    os.makedirs(AUDIO_DIR, exist_ok=True)
    for w, rel in todo:
        synthesize(session, config, spoken_text(w), os.path.join(ROOT, rel))
        w['audio'] = rel
        print('  ' + w['id'] + ' : ' + w['ar'] + ' → ' + rel)
    with open(WORDS, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(str(len(todo)) + ' prononciation(s) générée(s). Écoute-les avant de publier.')


if __name__ == '__main__':
    main()

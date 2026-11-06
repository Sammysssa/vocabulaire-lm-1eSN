#!/usr/bin/env python3
"""Prononciation « au meilleur de N » : plusieurs prises par texte, Whisper garde la plus claire.

La voix de synthèse (Piper miro V2, voir generate_audio.py) ne dit pas deux fois un mot de la même
façon. Ce script fait plusieurs prises en variant la durée du ه, du ر et de la voyelle finale,
fait réécouter chaque prise par Whisper (reconnaissance vocale arabe) et garde celle dont la
transcription ressemble le plus au texte attendu. Il s'arrête dès qu'une prise est parfaite.

Prérequis (en plus de ceux de generate_audio.py) :
    pip install sherpa-onnx onnx onnxruntime soundfile numpy
Les modèles sont téléchargés la première fois dans tools/.models (voix ≈ 80 Mo, Whisper ≈ 600 Mo).
La variable d'environnement AUDIO_MODELS permet d'utiliser un autre dossier.

Utilisation (depuis la racine du projet) :
    python tools/best_of.py <dossier de sortie> <fichier d'éléments.json> [id1 id2 …]

Le fichier d'éléments est une liste de :
    {"id": "g-yadrusu", "say": "يَدْرُسُ"}                  le texte à dire, avec toutes les voyelles
    + "check": "يدرس"         texte attendu, si la transcription doit être comparée à autre chose
    + "n": 3                   prises par réglage (3 par défaut)
    + "h": [1.0, 1.6]          durées essayées pour le ه
    + "r": [1.0, 1.5]          durées essayées pour le ر (utile quand on entend ل au lieu de ر)
    + "final": [0.6, 0.85]     durée de la voyelle finale
    + "person": "3fd"          forme conjuguée (3f, 3md, 2d, 3mp…, ou p3m, p3f, p2f, p1, p1p au présent) :
                               la prise n'est retenue que si les lettres du sujet s'entendent
                               (le ا du duel, le و du pluriel, le تْ de « elle », le préfixe…)

Résultat : <sortie>/<id>.mp4 pour chaque élément, toutes les prises dans <sortie>/_takes et les
notes dans <sortie>/scores.json. Une note sous 0,86 veut dire « douteux » : écoute avant de publier,
ou laisse la case sans audio.
"""
import difflib
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generate_audio as ga  # noqa: E402

if os.environ.get('AUDIO_MODELS'):
    ga.MODELS = os.environ['AUDIO_MODELS']
WHISPER = 'sherpa-onnx-whisper-small'
WHISPER_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/' + WHISPER + '.tar.bz2'

# espeak lit هُوَ / هِيَ avec une voyelle longue : on la remet courte.
FIX = [('hˈuːa', 'hˈuwa'), ('hˈiːa', 'hˈija')]
H, R, SUB, DOT = [1.0], [1.0], [[]], ['']
_phonemize, _encode = ga.phonemize, ga.encode


def phonemize(text):
    ipa = _phonemize(text)
    for a, b in FIX + SUB[0]:
        ipa = ipa.replace(a, b)
    return ipa + DOT[0]


def encode(ipa, symbols):
    ids, scales = _encode(ipa, symbols)
    hid, rid = symbols['h'][0], symbols['r'][0]
    for i, x in enumerate(ids):
        if x == hid:
            scales[i] *= H[0]; scales[i + 1] *= H[0]
        if x == rid:
            scales[i] *= R[0]; scales[i + 1] *= R[0]
    return ids, scales


ga.phonemize, ga.encode = phonemize, encode


def ensure_whisper():
    folder = os.path.join(ga.MODELS, WHISPER)
    if not os.path.isdir(folder):
        os.makedirs(ga.MODELS, exist_ok=True)
        print('Téléchargement de Whisper small (environ 600 Mo)…', flush=True)
        with tempfile.NamedTemporaryFile(suffix='.tar.bz2', delete=False) as tmp:
            urllib.request.urlretrieve(WHISPER_URL, tmp.name)
            with tarfile.open(tmp.name) as tar:
                tar.extractall(ga.MODELS)
        os.unlink(tmp.name)
    return folder + '/'


def make_asr():
    import sherpa_onnx
    m = ensure_whisper()
    rec = sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=m + 'small-encoder.int8.onnx', decoder=m + 'small-decoder.int8.onnx', tokens=m + 'small-tokens.txt',
        language='ar', task='transcribe', num_threads=4)

    def asr(path):
        pcm = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'],
                             capture_output=True).stdout
        audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768
        stream = rec.create_stream()
        stream.accept_waveform(16000, audio)
        rec.decode_stream(stream)
        return stream.result.text
    return asr


def base(t):
    t = re.sub(r'[ً-ْـ"؟?.,،!]', '', t)
    t = re.sub('[أإآ]', 'ا', t).replace('ى', 'ي')
    return re.sub(r'\s+', '', t)


def strict(hyp, target):
    a, b = base(hyp).replace('ة', 'ه'), base(target).replace('ة', 'ه')
    return difflib.SequenceMatcher(None, a, b).ratio()


# Formes conjuguées : Whisper écrit souvent la voyelle finale brève comme une longue (يسجدوا pour يَسْجُدُ),
# on compare donc le squelette, mais les lettres du sujet doivent être là.
SUFFIX = {'3f': 'ت', '2m': 'ت', '2f': 'ت', '1': 'ت', '3md': 'ا', '3fd': 'تا', '2d': 'تما',
          '3fp': 'ن', '2mp': 'تم', '2fp': 'تن', '1p': 'نا'}
PREFIX = {'p3m': 'ي', 'p3f': 'ت', 'p2f': 'ت', 'p1': 'ا', 'p1p': 'ن'}


def core(t):
    return t[:1] + re.sub('[اويه]+$', '', t[1:].replace('ا', ''))


def marker_ok(h, person):
    h = re.sub('ها$', 'ا', h)
    if person in PREFIX:
        return h.startswith(PREFIX[person]) and (person != 'p2f' or 'ين' in h)
    if person == '3mp':
        return 'و' in h[-3:]
    sfx = SUFFIX.get(person)
    if not sfx:
        return True
    if sfx.endswith('ا'):
        return sfx in h[-(len(sfx) + 2):]
    return re.sub('[اويه]+$', '', h).endswith(sfx)


def conj_score(hyp, target, person):
    h, t = base(hyp).replace('ة', 'ت'), base(target).replace('ة', 'ت')
    if not h or not marker_ok(h, person):
        return 0.0
    if t.endswith('وا') and not re.search('(وا|و|ون)$', h):
        return 0.0
    if t.endswith('ا') and not t.endswith('وا') and not re.search('(ا|ها|اه)$', h):
        return 0.0
    return difflib.SequenceMatcher(None, core(h), core(t)).ratio()


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    out_dir, items = sys.argv[1], json.load(open(sys.argv[2], encoding='utf-8'))
    only = set(sys.argv[3:])
    import onnxruntime
    model_path, config = ga.ensure_model()
    sess = onnxruntime.InferenceSession(model_path, providers=['CPUExecutionProvider'])
    asr = make_asr()
    takes_dir = os.path.join(out_dir, '_takes')
    os.makedirs(takes_dir, exist_ok=True)
    scores_path = os.path.join(out_dir, 'scores.json')
    scores = json.load(open(scores_path, encoding='utf-8')) if os.path.exists(scores_path) else {}
    for it in items:
        if only and it['id'] not in only:
            continue
        target = it.get('check') or it['say']
        person = it.get('person')
        SUB[0] = it.get('sub', [])
        best = None
        for r in it.get('r', [1.0]):
            for dot in it.get('dot', ['']):
                for final in it.get('final', [0.6]):
                    for h in it.get('h', [1.0, 1.6, 2.2]):
                        for k in range(it.get('n', 3)):
                            H[0], R[0], DOT[0], ga.FINAL_VOWEL = h, r, dot, final
                            path = os.path.join(takes_dir, '%s-%s-%s-%d%s-r%s.mp4' % (it['id'], h, final, k, 'd' if dot else '', r))
                            ga.synthesize(sess, config, ga.spoken_text({'ar': it['say']}), path)
                            heard = asr(path)
                            sc = conj_score(heard, target, person) if person else strict(heard, target)
                            if not best or sc > best[0]:
                                best = (sc, path, heard)
                            if sc >= 0.999:
                                break
                        if best and best[0] >= 0.999:
                            break
                    if best and best[0] >= 0.999:
                        break
        shutil.copy(best[1], os.path.join(out_dir, it['id'] + '.mp4'))
        scores[it['id']] = {'score': round(best[0], 3), 'heard': best[2], 'say': it['say']}
        json.dump(scores, open(scores_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('%-22s %.2f  %s  (%s)%s' % (it['id'], best[0], best[2], it['say'], '' if best[0] >= 0.86 else '  ← douteux'), flush=True)


if __name__ == '__main__':
    main()

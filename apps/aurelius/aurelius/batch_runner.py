"""Small, resumable driver for existing local Aurelius corpus commands.

This does not implement model synthesis or authorize embedding requests. Each
selected command is delegated to scripts/aurelius-corpus.py, whose own gates
remain in force.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import signal
import subprocess
import time
import uuid

from tqdm import tqdm


ROOT = Path(__file__).resolve().parents[3]
ALLOWED_ACTIONS = ('preview', 'study', 'project', 'hierarchy', 'export-map')


def corpus_hash(directory: Path) -> str:
    data = json.loads((directory / 'corpus.json').read_text())
    passages = data.get('passages', [])
    encoded = json.dumps(passages, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
    return hashlib.sha256(encoded).hexdigest()


def stage_fingerprint(root: Path, directory: Path) -> str:
    inputs = []
    for name in ('corpus.json', 'inspection.json', 'source.txt'):
        path = directory / name
        inputs.append((name, hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None))
    implementations = [root / 'scripts/aurelius-corpus.py',
                       *sorted((root / 'apps/aurelius/aurelius').rglob('*.py')),
                       root / 'apps/aurelius/requirements.lock']
    code = [(str(path.relative_to(root)), hashlib.sha256(path.read_bytes()).hexdigest())
            for path in implementations if path.is_file()]
    encoded = json.dumps({'inputs': inputs, 'implementation': code}, sort_keys=True,
                         separators=(',', ':')).encode()
    return hashlib.sha256(encoded).hexdigest()


def run(args=None, *, root=ROOT, launch=subprocess.Popen, progress=tqdm):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--action', choices=ALLOWED_ACTIONS, default='study',
                        help='existing local CLI stage; study writes a manual editorial proposal')
    parser.add_argument('--corpus-dir', action='append', type=Path,
                        help='corpus directory under .aurelius/corpora; repeat to select several')
    parser.add_argument('--max-items', type=int, default=3,
                        help='small pilot cap (default: 3; ignored with --full)')
    parser.add_argument('--full', action='store_true', help='explicitly select every discovered corpus')
    parser.add_argument('--run', action='store_true', help='execute commands; default is a dry-run')
    parser.add_argument('--resume', metavar='RUN_ID', help='resume a prior run from its durable checkpoints')
    parsed = parser.parse_args(args)
    root = Path(root).resolve()
    private = root / '.aurelius'
    if parsed.max_items < 1:
        parser.error('--max-items must be positive')

    if parsed.resume and not re.fullmatch(r'[a-f0-9]{12}', parsed.resume):
        parser.error('--resume requires a 12-character run ID printed by this command')
    run_id = parsed.resume or uuid.uuid4().hex[:12]
    run_dir = private / 'batch-runs'
    run_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    state_path = run_dir / f'{run_id}.json'
    if parsed.resume:
        if not state_path.is_file():
            parser.error(f'no checkpoint found for run {run_id}')
        state = json.loads(state_path.read_text())
        if state['action'] != parsed.action or state['dry_run'] == parsed.run:
            parser.error('resume options differ from the original run')
        selected = [root / item for item in state['selected']]
        if parsed.corpus_dir and sorted(Path(item).resolve() for item in parsed.corpus_dir) != sorted(selected):
            parser.error('--corpus-dir selection differs from the original run; resume its saved selection or start a new run')
    else:
        selected = parsed.corpus_dir or corpus_dirs_at(private)
        selected = [Path(item).resolve() for item in selected]
        for directory in selected:
            if not directory.is_relative_to(private.resolve() / 'corpora') or not (directory / 'corpus.json').is_file():
                parser.error(f'corpus directory must be an imported corpus under {private / "corpora"}: {directory}')
        selected = sorted(dict.fromkeys(selected))
        if not parsed.full:
            selected = selected[:parsed.max_items]
        if not selected:
            print('No imported corpora found under .aurelius/corpora; nothing to do.')
            return 0
        state = {'run_id': run_id, 'action': parsed.action, 'dry_run': not parsed.run,
                 'selected': [str(item.relative_to(root)) for item in selected],
                 'items': {}, 'status': 'running'}
    for directory in selected:
        if not directory.is_relative_to(private.resolve() / 'corpora') or not (directory / 'corpus.json').is_file():
            parser.error(f'checkpoint corpus is missing or outside private storage: {directory}')

    canceled = False
    active_process = None
    previous = {}

    def stop(*_):
        nonlocal canceled, active_process
        canceled = True
        if active_process is not None and active_process.poll() is None:
            active_process.terminate()

    for sig in (signal.SIGINT, signal.SIGTERM):
        previous[sig] = signal.signal(sig, stop)

    def persist():
        temp = state_path.with_suffix('.tmp')
        temp.write_text(json.dumps(state, indent=2) + '\n')
        temp.chmod(0o600)
        temp.replace(state_path)

    try:
        state['status'] = 'running'
        persist()
        bar = progress(selected, desc=f'Aurelius {parsed.action}', unit='corpus')
        for directory in bar:
            key = str(directory.relative_to(root))
            identity = corpus_hash(directory)
            fingerprint = stage_fingerprint(root, directory)
            record = state['items'].get(key, {})
            if (record.get('corpus_hash') != identity
                    or record.get('stage_fingerprint') != fingerprint):
                record = {}
            if record.get('state') == 'complete':
                continue
            if canceled:
                state['status'] = 'canceled'
                break
            command = [str(root / 'apps/aurelius/.venv/bin/python'),
                       str(root / 'scripts/aurelius-corpus.py'), parsed.action,
                       '--corpus-dir', key]
            record.update({'corpus_hash': identity, 'stage_fingerprint': fingerprint,
                           'state': 'planned' if not parsed.run else 'running',
                           'command': command})
            state['items'][key] = record
            persist()
            if not parsed.run:
                bar.set_postfix_str('dry-run')
                continue
            try:
                active_process = launch(command, cwd=root)
                while active_process.poll() is None:
                    if canceled:
                        active_process.terminate()
                    time.sleep(0.1)
                code = active_process.wait()
            except OSError as error:
                record.update(state='failed', exit_code=127, error=f'Unable to start command: {error}')
                state['status'] = 'failed'
                persist()
                break
            except KeyboardInterrupt:
                canceled = True
                code = 130
            finally:
                active_process = None
            if code == 0:
                record.update(state='complete', exit_code=0)
            elif code in (130, 143) or canceled:
                record.update(state='canceled', exit_code=code)
                state['status'] = 'canceled'
                persist()
                break
            else:
                record.update(state='failed', exit_code=code)
                state['status'] = 'failed'
                persist()
                break
            persist()
        else:
            state['status'] = 'dry_run' if not parsed.run else 'complete'
        if state['status'] == 'running':
            state['status'] = 'canceled' if canceled else ('dry_run' if not parsed.run else 'complete')
        persist()
    finally:
        for sig, handler in previous.items():
            signal.signal(sig, handler)
    print(f"Run {run_id}: {state['status']} ({state_path.relative_to(root)})")
    return 130 if state['status'] == 'canceled' else (1 if state['status'] == 'failed' else 0)


def corpus_dirs_at(private: Path):
    base = private / 'corpora'
    if not base.exists():
        return []
    return sorted(path for path in base.iterdir() if path.is_dir() and (path / 'corpus.json').is_file())


if __name__ == '__main__':
    raise SystemExit(run())

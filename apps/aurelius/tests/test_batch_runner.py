import json
from pathlib import Path
import pytest

from aurelius.batch_runner import run


class Progress:
    def __init__(self, values, **_):
        self.values = values

    def __iter__(self):
        return iter(self.values)

    def set_postfix_str(self, _):
        pass


def make_corpus(root: Path, name='pilot'):
    directory = root / '.aurelius/corpora' / name
    directory.mkdir(parents=True)
    (directory / 'corpus.json').write_text(json.dumps({'passages': [{'revision_id': 'p1:r1', 'text': 'example'}]}))
    (directory / 'inspection.json').write_text(json.dumps({'segmentation_status': 'reviewed'}))
    (directory / 'source.txt').write_text('example')
    return directory


def make_implementation(root: Path):
    cli = root / 'scripts/aurelius-corpus.py'
    module = root / 'apps/aurelius/aurelius/study.py'
    lock = root / 'apps/aurelius/requirements.lock'
    for path in (cli, module, lock):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('version one')
    return cli, module, lock


def test_batch_runner_defaults_to_dry_run_and_pilot_cap(tmp_path):
    first = make_corpus(tmp_path, 'one')
    make_corpus(tmp_path, 'two')
    calls = []

    assert run(['--corpus-dir', str(first)], root=tmp_path,
               launch=lambda *a, **k: calls.append(a), progress=Progress) == 0
    assert not calls
    state_file = next((tmp_path / '.aurelius/batch-runs').glob('*.json'))
    state = json.loads(state_file.read_text())
    assert state['status'] == 'dry_run'
    assert state['items']['.aurelius/corpora/one']['state'] == 'planned'


def test_batch_runner_checkpoints_and_resume_skips_completed(tmp_path):
    corpus = make_corpus(tmp_path)
    _, study_module, _ = make_implementation(tmp_path)
    calls = []

    class Finished:
        def poll(self):
            return 0

        def wait(self):
            return 0

    def launch(command, **_):
        calls.append(command)
        return Finished()

    assert run(['--run', '--corpus-dir', str(corpus)], root=tmp_path,
               launch=launch, progress=Progress) == 0
    state_file = next((tmp_path / '.aurelius/batch-runs').glob('*.json'))
    run_id = state_file.stem
    assert json.loads(state_file.read_text())['status'] == 'complete'
    assert run(['--run', '--corpus-dir', str(corpus), '--resume', run_id], root=tmp_path,
               launch=launch, progress=Progress) == 0
    assert len(calls) == 1
    study_module.write_text('version two')
    assert run(['--run', '--corpus-dir', str(corpus), '--resume', run_id], root=tmp_path,
               launch=launch, progress=Progress) == 0
    assert len(calls) == 2


def test_batch_runner_records_process_launch_failure(tmp_path):
    corpus = make_corpus(tmp_path)
    make_implementation(tmp_path)

    def launch(*_, **__):
        raise FileNotFoundError('missing interpreter')

    assert run(['--run', '--corpus-dir', str(corpus)], root=tmp_path,
               launch=launch, progress=Progress) == 1
    state_file = next((tmp_path / '.aurelius/batch-runs').glob('*.json'))
    state = json.loads(state_file.read_text())
    assert state['status'] == 'failed'
    item = next(iter(state['items'].values()))
    assert item['state'] == 'failed'
    assert item['exit_code'] == 127
    assert 'missing interpreter' in item['error']


def test_batch_runner_rejects_bad_resume_id(tmp_path):
    with pytest.raises(SystemExit):
        run(['--resume', '../escape'], root=tmp_path, progress=Progress)

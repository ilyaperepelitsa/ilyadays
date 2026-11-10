import os
import subprocess
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .models import Command
from .store import ROOT, Store


def create_app(directory=None):
    workspace_file = os.environ.get('AURELIUS_WORKSPACE_FILE')
    workspace_path = ROOT / workspace_file if workspace_file else None
    data_path = Path(directory or os.environ.get('AURELIUS_DATA_DIR', ROOT / '.aurelius'))
    if not data_path.is_absolute():
        data_path = ROOT / data_path
    store = Store(data_path, workspace_path)
    ui_port = int(os.environ.get('AURELIUS_UI_PORT', '3150'))
    app = FastAPI(title='Aurelius local workbench', docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=['127.0.0.1', 'localhost', 'testserver'])

    @app.middleware('http')
    async def private_boundary(request: Request, call_next):
        if request.method not in ['GET', 'HEAD']:
            if request.headers.get('origin') not in [f'http://127.0.0.1:{ui_port}', f'http://localhost:{ui_port}'] or request.headers.get('x-aurelius-local') != '1':
                return JSONResponse({'detail': 'Use the loopback workbench; cross-origin writes are disabled.'}, status_code=403)
            if request.headers.get('content-length', '0').isdigit() and int(request.headers.get('content-length', '0')) > 4_000_000:
                return JSONResponse({'detail': 'Request too large'}, status_code=413)
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    @app.get('/health')
    def health():
        return {'storage': 'sqlite', 'corpus': store.state()['corpus_kind'], 'external_processing': False, 'real_import': store.state()['corpus_kind'] != 'synthetic', 'schema_version': 1}

    @app.get('/state')
    def state():
        return store.state()

    @app.get('/analysis')
    def analysis():
        try:
            return store.analysis()
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @app.post('/commands')
    def command(value: Command):
        try:
            return store.apply(value)
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
        except subprocess.TimeoutExpired as error:
            raise HTTPException(status_code=503, detail='Local command timed out; reload to inspect the saved version.') from error

    return app

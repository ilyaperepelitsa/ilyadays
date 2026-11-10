"""Use protected production OIDC inference; no provider key is copied onto this machine."""
import base64
import json
import re
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urljoin, urlparse
import uuid

import httpx
import numpy as np


class ProductionRequestError(RuntimeError):
    def __init__(self, status_code, provider_error=None, provider_detail=None):
        self.status_code = status_code
        self.provider_error = provider_error
        self.provider_detail = provider_detail
        super().__init__('Protected production embedding request failed')


class ProductionClient:
    def __init__(self, deployment_url, access_file: Path, manifest_id):
        parsed = urlparse(deployment_url)
        if parsed.scheme != 'https' or not parsed.hostname or not parsed.hostname.endswith('.vercel.app') or parsed.username or parsed.query or parsed.fragment:
            raise ValueError('Use the exact protected HTTPS production deployment URL')
        self.origin = f'https://{parsed.netloc}'
        self.manifest_id = manifest_id
        self.client = httpx.Client(timeout=65, follow_redirects=False)
        self.embeddings = self
        access = json.loads(access_file.read_text())['url']
        if f'{urlparse(access).scheme}://{urlparse(access).netloc}' != self.origin:
            raise ValueError('Temporary production access belongs to a different deployment')
        # Keep Vercel's temporary authorization cookie only in this process. Never
        # write it into app/browser storage or include it in cache metadata/logs.
        for _ in range(5):
            try:
                response = self.client.get(access)
            except httpx.RequestError:
                raise RuntimeError('Could not authenticate the protected production connection') from None
            if response.is_redirect:
                access = urljoin(access, response.headers.get('location', ''))
                if f'{urlparse(access).scheme}://{urlparse(access).netloc}' != self.origin:
                    raise RuntimeError('Production access redirected outside the authorized deployment')
                continue
            if response.status_code >= 400:
                raise RuntimeError('Protected production access was rejected')
            break
        else:
            raise RuntimeError('Too many production authorization redirects')

    def create(self, *, model, dimensions, input, encoding_format):
        if model != 'openai/text-embedding-3-large' or dimensions != 3072 or encoding_format != 'float':
            raise ValueError('The production model/configuration is fixed')
        try:
            response = self.client.post(self.origin+'/api/aurelius/production/embed', json={'manifest_id':self.manifest_id,'request_id':uuid.uuid4().hex,'input':input})
        except httpx.RequestError:
            raise ConnectionError('Production response outcome is unknown') from None
        if response.status_code != 200:
            reason=None;detail=None
            try:
                payload=response.json();value=payload.get('error')
                if isinstance(value,str) and re.fullmatch(r'[a-z_]{1,80}',value):reason=value
                if reason=='no_providers_available' and isinstance(payload.get('diagnostic'),str):detail=payload['diagnostic']
            except (ValueError,AttributeError):pass
            raise ProductionRequestError(response.status_code,reason,detail)
        data = response.json()
        rows=[]
        for index, encoded in enumerate(data['vectors_f32_base64']):
            vector=np.frombuffer(base64.b64decode(encoded,validate=True),dtype='<f4').copy()
            rows.append(SimpleNamespace(index=index,embedding=vector))
        return SimpleNamespace(model=data['model'],data=rows,usage=SimpleNamespace(total_tokens=data['usage']['total_tokens']),_request_id=data.get('upstream_request_id'),provider_metadata={'gateway':data.get('gateway'),'production_deployment':self.origin,'input_manifest':self.manifest_id})

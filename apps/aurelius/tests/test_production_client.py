import base64
import json
import httpx
import numpy as np
import pytest
from aurelius.production_client import ProductionClient


def test_production_client_reuses_private_temporary_access_without_copying_provider_credentials(tmp_path,monkeypatch):
    calls=[]
    def handler(request):
        calls.append(request)
        if request.url.query:
            return httpx.Response(303,headers={'Location':'/','Set-Cookie':'private-vercel-test=allowed; Path=/; Secure; HttpOnly'})
        if request.method=='GET':return httpx.Response(200,text='Protected deployment')
        assert request.headers.get('cookie')=='private-vercel-test=allowed'
        assert request.headers.get('authorization') is None
        body=json.loads(request.content);assert body['manifest_id']=='manifest'
        encoded=base64.b64encode(np.ones(3072,dtype='<f4').tobytes()).decode()
        return httpx.Response(200,json={'model':'openai/text-embedding-3-large','vectors_f32_base64':[encoded],'usage':{'total_tokens':10},'gateway':{'cost':'0.0000013'}})
    actual=httpx.Client
    monkeypatch.setattr(httpx,'Client',lambda **kwargs:actual(transport=httpx.MockTransport(handler),**kwargs))
    path=tmp_path/'temporary-access.json';path.write_text(json.dumps({'url':'https://example.vercel.app/?_vercel_share=temporary-test'}))
    client=ProductionClient('https://example.vercel.app',path,'manifest')
    response=client.create(model='openai/text-embedding-3-large',dimensions=3072,input=['Original test text'],encoding_format='float')
    assert response.data[0].embedding.shape==(3072,)
    assert np.array_equal(response.data[0].embedding,np.ones(3072,dtype=np.float32))
    assert len(calls)==3
    assert '_vercel_share' not in json.dumps(response.provider_metadata)


def test_production_access_cannot_redirect_to_an_unrelated_origin(tmp_path,monkeypatch):
    actual=httpx.Client
    monkeypatch.setattr(httpx,'Client',lambda **kwargs:actual(transport=httpx.MockTransport(lambda _:httpx.Response(302,headers={'Location':'https://unrelated.example/'})),**kwargs))
    path=tmp_path/'access.json';path.write_text(json.dumps({'url':'https://example.vercel.app/?_vercel_share=test'}))
    with pytest.raises(RuntimeError,match='outside'):ProductionClient('https://example.vercel.app',path,'manifest')

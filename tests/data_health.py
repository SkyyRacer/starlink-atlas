import importlib.util,json,os,pathlib,tempfile,struct,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('health',ROOT/'scripts/ensure_data.py');health=importlib.util.module_from_spec(spec);spec.loader.exec_module(health)
with tempfile.TemporaryDirectory() as temp:
 root=pathlib.Path(temp);live=root/'live.json';backup=root/'backup.json';seed=root/'seed.json'
 expected={'source':'validated source','fetched':'2026-10-01T00:00:00Z','records':[1,2]};live.write_text(json.dumps(expected));os.utime(live,(100000,100000))
 assert health.repair(live,backup,[])['state']=='valid'
 assert backup.stat().st_mtime==live.stat().st_mtime,'Restoring a cache must not make it look freshly downloaded'
 live.write_text('{broken');assert health.repair(live,backup,[])['state']=='restored';assert json.loads(live.read_text())==expected
 assert live.stat().st_mtime==100000
 live.unlink();assert health.repair(live,backup,[])['state']=='restored'
 live.write_text('{bad');backup.write_text('{bad');seed.write_text(json.dumps(expected));assert health.repair(live,backup,[seed])['state']=='restored';assert json.loads(backup.read_text())==expected
 live.write_text('{bad');backup.write_text('{bad');seed.write_text('{bad');assert health.repair(live,backup,[seed])['state']=='unavailable';assert live.read_text()=='{bad','Never replace a broken file with another broken backup'
 expected_hash=health.digest(seed);assert health.repair(seed,backup,[],expected='000000000000')['state']=='unavailable','An asset with the wrong manifest hash cannot be used'
 model=root/'bad.glb';model.write_bytes(b'glTF'+struct.pack('<III',2,9000,2)+b'JSON{}');assert not health.validate(model)[0]
 folder=root/'ephemerides/jwst';folder.mkdir(parents=True);file=folder/'2026.json';file.write_text(json.dumps({'id':10321,'frame':'ICRF','time_scale':'UTC','samples':[[0,1,2,3,4,5,6],[10,2,3,4,5,6,7]]}));assert not health.validate(file)[0],'Never restore Voyager data into JWST'
 file.write_text(json.dumps({'id':50463,'frame':'ICRF','time_scale':'UTC','samples':[[10,1,2,3,4,5,6],[0,2,3,4,5,6,7]]}));assert not health.validate(file)[0]
 index=root/'ephemerides/tess-index.json';index.write_text(json.dumps({'source':'NASA/JPL','years':{}}));assert health.validate(index)[0],'Legacy TESS index has no target ID'
 status=root/'supgp-status.json';status.write_text(json.dumps({'matched':100}));assert health.validate(status)[0],'A status document is not a GP element list'
 iau=root/'IAU2006_XYS.json';iau.write_text(json.dumps({'samples':[1,2,3]}));assert health.validate(iau)[0],'Astronomical orientation tables are not mission vectors'
print('Data health: last-good backups, corrupt/missing data, fallback sources, original freshness, model hashes and spacecraft identity OK.')

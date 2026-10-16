"""Isolated offline API checks, synthetic fixtures never displayed in the normal app."""
import datetime as dt
import json
import gzip
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import unittest

ROOT = Path(__file__).resolve().parents[1]
BINARY = Path(os.environ.get('ATLAS_BINARY', ROOT / 'target/release/starlink-atlas')).resolve()

class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        data = Path(cls.tmp.name)
        fixture = [{"OBJECT_NAME":"STARLINK-TEST-FIXTURE","OBJECT_ID":"2020-001A","EPOCH":"2020-01-02T00:00:00","MEAN_MOTION":15.1,"ECCENTRICITY":0.001,"INCLINATION":53.0,"RA_OF_ASC_NODE":80.0,"ARG_OF_PERICENTER":20.0,"MEAN_ANOMALY":30.0,"EPHEMERIS_TYPE":0,"CLASSIFICATION_TYPE":"U","NORAD_CAT_ID":100123,"ELEMENT_SET_NO":999,"REV_AT_EPOCH":1,"BSTAR":0.00001,"MEAN_MOTION_DOT":0.0,"MEAN_MOTION_DDOT":0.0}]
        (data/'input.json').write_text(json.dumps(fixture))
        (data/'catalog.json').write_text(json.dumps([{"OBJECT_NAME":"STARLINK-TEST-FIXTURE","OBJECT_ID":"2020-001A","NORAD_CAT_ID":100123,"LAUNCH_DATE":"2020-01-01","DECAY_DATE":"2020-01-03","OPS_STATUS_CODE":"-"}]))
        history=data/'history';history.mkdir()
        old=dict(fixture[0],OBJECT_NAME='STARLINK-HISTORY-FIXTURE',NORAD_CAT_ID=100124,EPOCH='2019-06-12T12:00:00')
        with gzip.open(history/'2019-06-12.json.gz','wt') as f:json.dump([old],f)
        (history/'manifest.json').write_text(json.dumps({'days':{'2019-06-12':1},'first_epoch':old['EPOCH'],'last_epoch':old['EPOCH'],'observations':1}))
        cats=json.loads((data/'catalog.json').read_text())
        cats.append({'OBJECT_NAME':old['OBJECT_NAME'],'NORAD_CAT_ID':100124,'OBJECT_ID':'2019-029A','LAUNCH_DATE':'2019-05-24','DECAY_DATE':'2019-12-01'})
        (data/'catalog.json').write_text(json.dumps(cats))
        env = dict(os.environ, OFFLINE='1', DATA_DIR=str(data))
        for flag,file in [('--import','input.json'),('--import-catalog','catalog.json')]:
            subprocess.run([str(BINARY),flag,str(data/file)],cwd=ROOT,env=env,check=True,capture_output=True)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        env['BIND']=f'127.0.0.1:{port}'
        cls.base=f'http://127.0.0.1:{port}'
        cls.process=subprocess.Popen([str(BINARY)],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        for _ in range(100):
            try: cls.get('/api/catalog');break
            except (urllib.error.URLError,ConnectionError): time.sleep(.05)
        else: cls.process.terminate();cls.tmp.cleanup();raise RuntimeError('Server unavailable')
    @classmethod
    def tearDownClass(cls):
        cls.process.terminate();cls.process.wait(timeout=5);cls.tmp.cleanup()
    @classmethod
    def get(cls,path):
        with urllib.request.urlopen(cls.base+path,timeout=5) as r: return json.load(r)
    def test_historical_decayed_satellite(self):
        d=self.get('/api/positions?at=2020-01-02T00:00:00Z&id=100123')
        self.assertEqual(len(d['points']),1)
        self.assertEqual(d['points'][0]['id'],100123)
        self.assertTrue(400<d['points'][0]['altitude_km']<800)
        self.assertGreater(len(d['track']),100)
        self.assertEqual(len(d['future_track']),121)
        self.assertEqual(d['future_track_3d'][0],d['track_3d'][-1])
        self.assertEqual(d['future_track_3d'][0],[d['points'][0]['lat'],d['points'][0]['lon'],d['points'][0]['altitude_km']])
        self.assertTrue(all(400 < p[2] < 800 for p in d['track_3d']))
        self.assertEqual(d['future_track'][0],d['track'][-1])
        self.assertEqual(d['future_track'][0],[d['points'][0]['lat'],d['points'][0]['lon']])
        self.assertNotEqual(d['future_track'][0],d['future_track'][-1])
        near_decay=self.get('/api/positions?at=2020-01-02T23:59:00Z&id=100123')
        self.assertLess(len(near_decay['future_track']),121)
    def test_launch_and_decay_bounds(self):
        for at in ['2019-12-31T23:59:59Z','2020-01-03T00:00:00Z']:
            self.assertEqual(self.get('/api/positions?at='+at)['points'],[])
        self.assertEqual(self.get('/api/positions')['points'],[])
    def test_future_and_invalid(self):
        for at in ['bad','2099-01-01T00:00:00Z']:
            with self.assertRaises(urllib.error.HTTPError) as e:self.get('/api/positions?at='+at)
            self.assertEqual(e.exception.code,400);e.exception.close()
    def test_missing_history_suggests_available_epoch(self):
        d=self.get('/api/positions?at=2018-01-01T00:00:00Z')
        self.assertEqual(d['points'],[])
        self.assertEqual(dt.datetime.fromisoformat(d['suggested_at']),dt.datetime(2019,6,12,12,tzinfo=dt.timezone.utc))
        restored=self.get('/api/positions?at='+d['suggested_at'].replace('+','%2B'))
        self.assertEqual(len(restored['points']),1)
    def test_lazy_historical_files(self):
        d=self.get('/api/positions?at=2019-06-12T12:00:00Z&id=100124')
        self.assertEqual(len(d['points']),1)
        self.assertEqual(d['points'][0]['id'],100124)
        self.assertEqual(len(d['future_track']),121)
        self.assertEqual(d['future_track_3d'][0],d['track_3d'][-1])
        self.assertEqual(d['future_track_3d'][0],[d['points'][0]['lat'],d['points'][0]['lon'],d['points'][0]['altitude_km']])
        self.assertTrue(all(400 < p[2] < 800 for p in d['track_3d']))
        self.assertEqual(len(self.get('/api/positions?at=2020-01-02T00:00:00Z')['points']),1)
        self.assertEqual(len(self.get('/api/positions?at=2019-06-12T12:00:00Z')['points']),1)
    def test_catalog_and_config(self):
        d=self.get('/api/catalog');self.assertEqual(len(d['satellites']),2)
        self.assertEqual(d['satellites'][0]['decay'],'2020-01-03')
        self.assertEqual(self.get('/api/config')['tile_url'],'https://tile.openstreetmap.org/{z}/{x}/{y}.png')
    def test_static_and_data_isolation(self):
        with urllib.request.urlopen(self.base+'/') as r:self.assertEqual(r.status,200)
        with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(self.base+'/data/satcat.json')
        self.assertEqual(e.exception.code,404);e.exception.close()

if __name__=='__main__':unittest.main()

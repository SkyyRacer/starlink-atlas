"""Persistence and backup invariants for the full-server deployment."""
import concurrent.futures,datetime as dt,gzip,importlib.util,json,pathlib,tarfile,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/'deploy/oracle'/f'{name}.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
seed=load('seed');backup=load('backup');check=load('check')

class Deployment(unittest.TestCase):
    def test_seed_never_replaces_observations_and_keeps_epochs(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp);source=root/'seed';data=root/'data';source.mkdir();data.mkdir()
            (source/'gp-old.json').write_text('[{"EPOCH":"2001-03-23T04:57:10"}]')
            (source/'gp-existing.json').write_text('seed');(data/'gp-existing.json').write_text('newer valid data')
            (source/'history').mkdir();(source/'history/2001-03-23.json.gz').write_bytes(gzip.compress(b'[]'))
            (source/'solar').mkdir();(source/'solar/301-1-v1.json.gz').write_bytes(gzip.compress(b'{"id":301,"samples":[[1,2,3,4,5,6,7]]}'))
            crew=root/'crew.json';crew.write_text('{"people":{}}')
            seed.seed(source,data,crew);seed.seed(source,data,crew)
            self.assertEqual((data/'gp-existing.json').read_text(),'newer valid data')
            self.assertEqual(json.loads((data/'gp-old.json').read_text())[0]['EPOCH'],'2001-03-23T04:57:10')
            self.assertEqual(json.loads((data/'solar/301-1-v1.json').read_text())['samples'][0][0],1)
            self.assertEqual(gzip.decompress((data/'history/2001-03-23.json.gz').read_bytes()),b'[]')
            self.assertTrue((data/'generated/crew-archive.json').is_file())

    def test_concurrent_seed_and_invalid_compression_never_create_partial_targets(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp);source=root/'source';source.write_bytes(b'valid'*100000);target=root/'target'
            with concurrent.futures.ThreadPoolExecutor(2) as pool:list(pool.map(lambda _:seed.install(source,target),range(2)))
            self.assertEqual(target.read_bytes(),source.read_bytes())
            damaged=root/'broken.gz';damaged.write_bytes(b'bad gzip')
            with self.assertRaises(OSError):seed.install(damaged,root/'must-not-exist',True)
            self.assertFalse((root/'must-not-exist').exists())

    def test_backup_roundtrip_preserves_data_and_omits_temporary_work(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp);data=root/'data';eph=root/'ephemerides';data.mkdir();eph.mkdir()
            (data/'historical.json').write_text('{"epoch":"2001-03-23"}');(eph/'mir.json').write_bytes(b'archived vector bytes')
            (data/'x.tmp').write_text('unfinished');(data/'history-work').mkdir();(data/'history-work/scratch').write_text('rebuildable')
            file=backup.backup(root/'backups',{'data':data,'ephemerides':eph})
            self.assertEqual(file.stat().st_mode&0o777,0o600)
            with tarfile.open(file,'r:gz') as archive:
                self.assertEqual(archive.extractfile('data/historical.json').read(),(data/'historical.json').read_bytes())
                self.assertEqual(archive.extractfile('ephemerides/mir.json').read(),b'archived vector bytes')
                self.assertNotIn('data/x.tmp',archive.getnames());self.assertNotIn('data/history-work/scratch',archive.getnames())

    def test_readiness_refuses_missing_positions_and_reports_partial_groups(self):
        now=dt.datetime(2026,11,1,tzinfo=dt.timezone.utc)
        catalog=[{'id':i,'family':'galileo','name':'GSAT'+str(i)} for i in range(1,11)]
        self.assertTrue(check.coverage(catalog,[],now)['blocking'])
        partial=check.coverage(catalog,[{'id':i} for i in range(1,7)],now)
        self.assertFalse(partial['blocking']);self.assertTrue(partial['warnings'])
        self.assertTrue(check.coverage([{'id':25544,'name':'ISS'}],[{'id':99}],now)['blocking'])

if __name__=='__main__':unittest.main()

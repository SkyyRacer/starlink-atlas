"""Initialize an empty persistent volume without replacing existing observations."""
import gzip,os,pathlib,shutil,tempfile

def install(source,target,compressed=False):
    if target.exists():return
    target.parent.mkdir(parents=True,exist_ok=True)
    fd,name=tempfile.mkstemp(prefix='.atlas-seed-',dir=target.parent)
    try:
        with os.fdopen(fd,'wb') as output:
            with (gzip.open(source,'rb') if compressed else source.open('rb')) as input_file:shutil.copyfileobj(input_file,output)
        # Atomic no-overwrite installation, also when two services start together.
        try:os.link(name,target)
        except FileExistsError:pass
    finally:os.unlink(name)

def seed(source,data,crew=None):
    data.mkdir(parents=True,exist_ok=True)
    for file in source.rglob('*'):
        if not file.is_file():continue
        relative=file.relative_to(source)
        if relative.parts[0] in {'history-versions','history-updates'} or file.name=='orbital-news.json':continue
        compressed=relative.parts[0]=='solar' and file.name.endswith('.json.gz')
        target=data/(relative.with_suffix('') if compressed else relative)
        install(file,target,compressed)
    if crew and crew.is_file():install(crew,data/'generated/crew-archive.json')

if __name__=='__main__':
    root=pathlib.Path('/app')
    seed(root/'data-seed',pathlib.Path(os.environ.get('DATA_DIR','/app/data')),root/'crew-archive-seed.json')

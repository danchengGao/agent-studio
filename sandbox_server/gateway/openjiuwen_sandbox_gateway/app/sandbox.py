import json
import os
import subprocess
import tempfile
import yaml


class SandboxConfig:
    def __init__(self):
        config_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../conf/sandbox_config.yaml')
        with open(config_file, 'r') as f:
            config = yaml.safe_load(f)

        self.mounts = config['mount']
        self.envs = config.get('environment', {})
        self.sandbox_type = config['sandbox']['type']
        self.sandbox_path = config['sandbox']['path']
        self.python_path = config['interpreter']['python_path']
        self.node_path = config['interpreter']['node_path']

    @staticmethod
    def wrap_python_code(code, inputs):
        inputs = json.dumps(inputs).encode('utf8').hex()
        wrap = f'''
{code}

import json

args = Args(json.loads(bytes.fromhex('{inputs}').decode('utf8')))

res = main(args)
res = json.dumps(res).encode('ascii')
'''
        wrap = wrap + '''
print(f"\\n[[output]]{res.hex()}[[output]]", end='')
'''
        return wrap

    @staticmethod
    def wrap_js_code(code, inputs):
        inputs = json.dumps(inputs).encode('utf8').hex()
        wrap = code + '''
(async () => {
'''

        wrap = wrap + f'''
    const args = new Args(JSON.parse(Buffer.from('{inputs}', 'hex'),toString('utf-8')));
'''
        wrap = wrap + '''
    let result = main(args);
    if (result && typeof result.then === 'function') {
        result = await result;
    }
    process.stdout.write('\\n[[output]]' + Buffer.from(JSON.stringify(result)).toString('hex') + '[[output]]');
    process.exit(0);
})();
'''
        return wrap

    @staticmethod
    def parse_result(output: str):
        output_tag = '[[output]]'

        res = output[(output.rindex('\n') + 1):]

        if not res.startswith(output_tag) or not res.endswith(output_tag):
            raise Exception(f"corrupted code result \"{res}\"")
        res = res.split(output_tag)[1]
        res = json.loads(bytes.fromhex(res).decode('utf8'))
        return res


def get_sandbox(config: SandboxConfig):
    if config.sandbox_type == 'bubblewrap':
        return BubbleWrapRunner(config)
    raise Exception(f"{config.sandbox_type} not supported.")


class BubbleWrapRunner:
    def __init__(self, config):
        self._sandbox_config = config
        self._lang = ''
        self._code_dir = ''
        self._code_file = ''
        self._src_code_dir = None
        self._src_code_file = ''
        self._dst_code_dir = ''
        self._dst_code_file = ''

    def _create_sandbox(self):
        if self._lang == "python":
            ext = ".py"
        elif self._lang == "javascript":
            ext = ".js"
        self._code_dir = 'code'
        self._code_file = 'code' + ext
        self._src_code_dir = tempfile.TemporaryDirectory(prefix='bwrap_workdir_', dir='/tmp')
        self._src_code_file = os.path.join(self._src_code_dir.name, self._code_file)
        self._dst_code_dir = os.path.join('/', self._code_dir)
        self._dst_code_file = os.path.join(self._dst_code_dir, self._code_file)

        os.chmod(self._src_code_dir.name, 0o755)

    def _generate_mount_params(self):
        params = []
        for mount in self._sandbox_config.mounts:
            if mount['mode'] == 'read':
                mode = '--ro-bind'
            elif mount['mode'] == 'write':
                mode = '--bind'
            else:
                raise Exception(f"Unknown mount mode {mount['mode']}")
            params = params + [mode, mount['src'], mount['dst']]
        params = params + ['--ro-bind', self._src_code_dir.name, self._dst_code_dir]

        return params

    def run(self, code, inputs, lang, timeout):
        self._lang = lang

        self._create_sandbox()

        if self._lang == "python":
            code = SandboxConfig.wrap_python_code(code, inputs)
            interpreter = self._sandbox_config.python_path
        elif self._lang == "javascript":
            code = SandboxConfig.wrap_js_code(code, inputs)
            interpreter = self._sandbox_config.node_path

        with open(self._src_code_file, 'w') as f:
            f.write(code)

        cmd = [
            self._sandbox_config.sandbox_path,
            '--die-with-parent'
        ]

        cmd = cmd + self._generate_mount_params()

        cmd = cmd + [
            interpreter,
            self._dst_code_file
        ]

        try:
            process = subprocess.Popen(cmd,
                                        env=self._sandbox_config.envs,
                                        stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE,
                                        start_new_session=True,
                                        text=True)
            stdout, stderr = process.communicate(timeout=timeout)
            retcode = process.returncode

        except subprocess.TimeoutExpired as e:
            stdout = ''
            stderr = 'code execution timeout.'
            retcode = -1

        if retcode == 0:
            res = SandboxConfig.parse_result(stdout)
        else:
            res = ""

        self._src_code_dir.cleanup()

        return {"return": res, "error": f"{stderr}" if retcode != 0 else None}

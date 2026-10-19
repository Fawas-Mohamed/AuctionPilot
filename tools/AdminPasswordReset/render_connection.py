"""Read the fixed demo service's connection through the owner's saved Render CLI session.
Secret-bearing output is permitted only for the PowerShell wrapper's redirected private pipe.
--check-access returns only a safe status and never the setting value.
"""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

SERVICE_ID = 'srv-db19ftm0tbcc73a5l8g0'
OWNER_ID = 'tea-d9h4qt6rnols73elqu30'
REPO = 'https://github.com/Fawas-Mohamed/AuctionPilot'
ORIGIN = 'https://api.render.com/v1'
ROOT = Path(__file__).resolve().parents[2]


class ReadFailure(Exception):
    def __init__(self, code, message):
        self.code = code
        self.message = message


def reply(success, code, message, connection=None):
    value = {'success': success, 'code': code, 'message': message}
    if connection is not None:
        value['connectionString'] = connection
    print(json.dumps(value))
    return 0 if success else 1


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise ReadFailure('RenderRedirectRejected', 'Unexpected Render API redirect refused.')


def get_json(opener, path, token):
    request = urllib.request.Request(ORIGIN + path, headers={
        'Authorization': 'Bearer ' + token, 'Accept': 'application/json', 'User-Agent': 'AuctionPilot-private-recovery',
    })
    try:
        with opener.open(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        if error.code == 401:
            raise ReadFailure('RenderLoginRequired', 'Refresh Render CLI login, then retry automatic connection loading.') from None
        if error.code == 403:
            raise ReadFailure('RenderAccessDenied', 'The signed-in Render account cannot access the demo service.') from None
        if error.code == 404:
            raise ReadFailure('RenderSettingMissing', 'The fixed demo service or its direct connection setting was not found.') from None
        raise ReadFailure('RenderReadFailed', 'Render could not supply the connection setting. No service setting was changed.') from None


def read_connection():
    try:
        import yaml
    except ImportError:
        raise ReadFailure('RenderYamlUnavailable', 'Local Python YAML support is unavailable. Use manual connection input or the prepared local tooling.') from None
    # whoami refreshes an expired short-lived CLI token without exposing it.
    cli = ROOT / '.local/render/render.exe'
    if not cli.is_file():
        raise ReadFailure('RenderCliMissing', 'The prepared Render CLI is missing from .local/render/render.exe.')
    refreshed = subprocess.run([str(cli), 'whoami', '--output', 'json'], capture_output=True, timeout=60)
    if refreshed.returncode:
        raise ReadFailure('RenderLoginRequired', 'Run the local Render CLI login command and approve access in the browser.')
    config_dir = Path(os.environ.get('RENDER_CLI_CONFIG_DIR', str(Path.home() / '.render')))
    path = Path(os.environ.get('RENDER_CLI_CONFIG_PATH', str(config_dir / 'cli.yaml')))
    config = yaml.safe_load(path.read_text(encoding='utf-8'))
    token = config.get('api', {}).get('key')
    if not isinstance(token, str) or not token:
        raise ReadFailure('RenderLoginRequired', 'Saved Render authentication is unavailable. Run the local Render CLI login command.')
    opener = urllib.request.build_opener(NoRedirect())
    service = get_json(opener, '/services/' + SERVICE_ID, token)
    if service.get('id') != SERVICE_ID or service.get('ownerId') != OWNER_ID or service.get('repo', '').rstrip('/') != REPO:
        raise ReadFailure('RenderServiceMismatch', 'Service identity did not match the expected AuctionPilot demo. No secret was read.')
    entry = get_json(opener, '/services/' + SERVICE_ID + '/env-vars/ConnectionStrings__DefaultConnection', token)
    connection = entry.get('value') or entry.get('envVar', {}).get('value')
    if not isinstance(connection, str) or not connection:
        raise ReadFailure('RenderSettingMissing', 'ConnectionStrings__DefaultConnection is absent from the expected demo service.')
    return connection


def main():
    if sys.argv[1:] not in (['--private-pipe'], ['--check-access']):
        return reply(False, 'WrapperRequired', 'Use Reset-DemoAdminPassword.ps1 -UseRenderConnection; never print a connection string in a terminal.')
    private = sys.argv[1] == '--private-pipe'
    if private and sys.stdout.isatty():
        return reply(False, 'PrivatePipeRequired', 'A private redirected pipe is required. Run the PowerShell wrapper.')
    try:
        connection = read_connection()
        return reply(True, 'RenderConnectionLoaded', 'Current demo connection loaded privately from Render.', connection if private else None)
    except ReadFailure as error:
        return reply(False, error.code, error.message)
    except Exception:
        return reply(False, 'RenderReadFailed', 'Private connection loading failed. No raw details or secret values were printed.')


if __name__ == '__main__':
    sys.exit(main())

"""Behavioral smoke checks for the private recovery console and Windows PowerShell wrapper.
Uses synthetic inputs only; never opens a database connection or resets a live account.
Run from the repository root after building tools/AdminPasswordReset in Release.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DLL = ROOT / 'tools/AdminPasswordReset/bin/Release/net8.0/AdminPasswordReset.dll'
BASE = 'Host=ep-synthetic-pooler.ap-southeast-1.aws.neon.tech;Database=auctionpilot_demo;Username=synthetic_role;Password=synthetic-only;SSL Mode=VerifyFull'
PASSED = []


def console(connection, expected, success=False):
    value = {'mode': 'validate', 'connectionString': connection}
    run = subprocess.run(['dotnet', str(DLL)], input=json.dumps(value), capture_output=True, text=True,
                         encoding='utf-8', timeout=30, cwd=ROOT)
    reply = json.loads(run.stdout)
    assert reply['code'] == expected and reply['success'] is success
    assert (run.returncode == 0) is success
    assert 'synthetic-only' not in run.stdout + run.stderr
    PASSED.append('Private console diagnostic: ' + expected)


console('*', 'ConnectionMasked')
console('', 'ConnectionMissing')
console('ConnectionStrings__DefaultConnection', 'ConnectionFormatInvalid')
console('postgresql://synthetic:synthetic-only@example.invalid/demo', 'ConnectionUrlUnsupported')
console(BASE.replace('auctionpilot_demo', 'another_database'), 'ConnectionDatabaseRejected')
console(BASE.replace('VerifyFull', 'Require'), 'ConnectionTlsRequired')
console(BASE, 'ConnectionFormatChecked', True)

for connection, expected, mismatch, create_admin in [
    ('*', 'ConnectionMasked', False, False),
    ('ConnectionStrings__DefaultConnection', 'ConnectionFormatInvalid', False, False),
    (BASE.replace('ep-synthetic-pooler.ap-southeast-1.aws.neon.tech', '127.0.0.1'), 'ConnectionHostRejected', False, False),
    (BASE, 'PasswordConfirmationMismatch', True, False),
    (BASE, 'PasswordConfirmationMismatch', True, True),
]:
    script = r'''
$ErrorActionPreference='Stop'
$global:recoveryPromptCount=0
function Read-Host {
 param([string] $Prompt,[switch] $AsSecureString)
 $global:recoveryPromptCount++
 if ($Prompt -like '*email*') { return 'synthetic@example.invalid' }
 if ($Prompt -like '*connection*') { $value='CONNECTION_VALUE' }
 else { $value='Synthetic!Zluty123' }
 if (MISMATCH -and $Prompt -like 'Confirm*') { $value='Synthetic!Other123' }
 return (ConvertTo-SecureString -String $value -AsPlainText -Force)
}
try { & './tools/Reset-DemoAdminPassword.ps1' CREATE_FLAG; throw 'Guard unexpectedly allowed a reset.' }
catch {
 if ($_.Exception.Message -like '[[]EXPECTED_CODE]*') {
  Write-Output ('SAFE_DIAGNOSTIC=' + $_.Exception.Message)
  Write-Output ('PROMPTS=' + $global:recoveryPromptCount)
  exit 0
 }
 throw
}
'''.replace('CONNECTION_VALUE', connection.replace("'", "''")).replace('MISMATCH', '$true' if mismatch else '$false').replace('EXPECTED_CODE', expected).replace('CREATE_FLAG', '-CreateNewAdmin' if create_admin else '')
    run = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', script],
                         cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=180)
    output = run.stdout + run.stderr
    assert run.returncode == 0 and 'SAFE_DIAGNOSTIC=[' + expected + ']' in output, 'Wrapper failed to surface the expected safe diagnostic.'
    assert 'PROMPTS=' + ('4' if mismatch else '1') in output, 'Invalid connections must fail before password prompts.'
    assert all(s not in output for s in ['synthetic-only', 'Synthetic!Zluty123', 'Synthetic!Other123', connection if connection.startswith('Host=') else 'NEVER_ECHO_FULL_CONNECTION']), 'Synthetic input was echoed.'
    PASSED.append(('New-admin' if create_admin else 'Reset') + ' PowerShell visible diagnostic / early rejection: ' + expected)

# Saved-account access checks are mocked; the normal smoke test needs no provider account.
import importlib.util
import io
import sys
from unittest import mock
reader_path = ROOT / 'tools/AdminPasswordReset/render_connection.py'
spec = importlib.util.spec_from_file_location('recovery_render_reader', reader_path)
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)
valid_service = {'id': reader.SERVICE_ID, 'ownerId': reader.OWNER_ID, 'repo': reader.REPO}
for field in ('id', 'ownerId', 'repo'):
    wrong_service = {**valid_service, field: 'unexpected'}
    with mock.patch.object(reader.Path, 'is_file', return_value=True), mock.patch.object(reader.Path, 'read_text', return_value='api:\n  key: synthetic-only\n'), mock.patch.object(reader.subprocess, 'run', return_value=mock.Mock(returncode=0)), mock.patch.object(reader, 'get_json', return_value=wrong_service) as api:
        try:
            reader.read_connection()
            raise AssertionError('Unexpected service identity was accepted.')
        except reader.ReadFailure as error:
            assert error.code == 'RenderServiceMismatch'
        assert api.call_count == 1, 'Secret requested before service identity verification.'
    PASSED.append('Saved-session reader rejects wrong ' + field + ' before requesting a secret')
with mock.patch.object(reader.Path, 'is_file', return_value=True), mock.patch.object(reader.Path, 'read_text', return_value='api: {}\n'), mock.patch.object(reader.subprocess, 'run', return_value=mock.Mock(returncode=0)), mock.patch.object(reader, 'get_json') as api:
    try:
        reader.read_connection()
        raise AssertionError('Missing login token was accepted.')
    except reader.ReadFailure as error:
        assert error.code == 'RenderLoginRequired'
    assert not api.called
PASSED.append('Missing saved token prevents API access')
with mock.patch.object(reader.Path, 'is_file', return_value=True), mock.patch.object(reader.subprocess, 'run', return_value=mock.Mock(returncode=1)), mock.patch.object(reader, 'get_json') as api:
    try:
        reader.read_connection()
        raise AssertionError('Failed CLI authorization was accepted.')
    except reader.ReadFailure as error:
        assert error.code == 'RenderLoginRequired'
    assert not api.called
PASSED.append('Failed CLI authorization prevents API access')
with mock.patch.object(reader, 'read_connection', return_value=BASE), mock.patch.object(sys, 'argv', [str(reader_path), '--check-access']), mock.patch.object(sys, 'stdout', new_callable=io.StringIO) as output:
    assert reader.main() == 0
    access = json.loads(output.getvalue())
    assert access['success'] and 'connectionString' not in access and 'synthetic-only' not in output.getvalue()
PASSED.append('Access-only diagnostic never includes the connection secret')

(ROOT / '.local').mkdir(exist_ok=True)
(ROOT / '.local/admin-recovery-wrapper-20261017.json').write_text(json.dumps({
    'passed': PASSED, 'failed': [], 'databaseConnectionsAttempted': False, 'livePasswordResetPerformed': False,
}, indent=2) + '\n', encoding='utf-8')
for check in PASSED:
    print('PASS: ' + check)

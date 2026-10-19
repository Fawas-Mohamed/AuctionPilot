param([switch] $UseRenderConnection, [switch] $CreateNewAdmin)

# Run in your own PowerShell terminal; never pass secrets as command arguments.
$ErrorActionPreference = 'Stop'
$resetProject = Join-Path $PSScriptRoot 'AdminPasswordReset/AdminPasswordReset.csproj'
$resetDll = Join-Path $PSScriptRoot 'AdminPasswordReset/bin/Release/net8.0/AdminPasswordReset.dll'

function Convert-PrivateInput([Security.SecureString] $Value) {
    $resetPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($resetPointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($resetPointer) }
}

function Invoke-PrivateProcess($Executable, $Arguments, $Request) {
    $resetProcess = $null
    $resetWriter = $null
    $resetPayload = $null
    $resetOutput = $null
    $resetError = $null
    try {
        $resetPayload = $Request | ConvertTo-Json -Compress
        $resetStart = New-Object Diagnostics.ProcessStartInfo
        $resetStart.FileName = $Executable
        $resetStart.Arguments = $Arguments
        $resetStart.UseShellExecute = $false
        $resetStart.CreateNoWindow = $true
        $resetStart.RedirectStandardInput = $true
        $resetStart.RedirectStandardOutput = $true
        $resetStart.RedirectStandardError = $true
        $resetProcess = [Diagnostics.Process]::Start($resetStart)
        # Drain both streams asynchronously. Terminal handle inheritance is unreliable in interactive hosts.
        $resetOutputTask = $resetProcess.StandardOutput.ReadToEndAsync()
        $resetErrorTask = $resetProcess.StandardError.ReadToEndAsync()
        $resetWriter = [IO.StreamWriter]::new($resetProcess.StandardInput.BaseStream, [Text.UTF8Encoding]::new($false))
        $resetWriter.Write($resetPayload)
        $resetWriter.Dispose()
        $resetWriter = $null
        $resetProcess.WaitForExit()
        $resetOutput = $resetOutputTask.GetAwaiter().GetResult()
        $resetError = $resetErrorTask.GetAwaiter().GetResult()
        # Never echo raw process output; unexpected runtime errors can contain private details.
        $resetReply = $null
        try { $resetReply = $resetOutput | ConvertFrom-Json -ErrorAction Stop } catch { }
        if ($null -eq $resetReply -or $resetReply.success -isnot [bool] -or
            $resetReply.code -notmatch '^[A-Za-z][A-Za-z0-9]{0,63}$' -or $resetReply.message -isnot [string]) {
            throw ('[RecoveryOutputInvalid] Reset tool returned no safe diagnostic (exit {0}). Try the new login before repeating a reset; raw output was withheld.' -f $resetProcess.ExitCode)
        }
        if (($resetProcess.ExitCode -eq 0) -ne $resetReply.success) {
            throw '[RecoveryOutputInvalid] The reset status could not be confirmed. Try the new login before repeating a reset.'
        }
        return $resetReply
    } finally {
        if ($null -ne $resetWriter) { $resetWriter.Dispose() }
        if ($null -ne $resetProcess) { $resetProcess.Dispose() }
        $resetPayload = $null; $resetOutput = $null; $resetError = $null; $Request = $null
    }
}

function Invoke-PrivateReset($Request) {
    return (Invoke-PrivateProcess (Get-Command dotnet -CommandType Application).Source ('"' + $resetDll + '"') $Request)
}

function Get-PrivateRenderConnection {
    $resetPython = Get-Command python -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $resetPython) { throw '[RenderPythonMissing] Python is required for automatic loading. Use manual connection input instead.' }
    $resetReader = Join-Path $PSScriptRoot 'AdminPasswordReset/render_connection.py'
    $resetReply = Invoke-PrivateProcess $resetPython.Source ('"' + $resetReader + '" --private-pipe') @{}
    if (-not $resetReply.success) { throw ('[{0}] {1}' -f $resetReply.code, $resetReply.message) }
    if ($resetReply.connectionString -isnot [string] -or [string]::IsNullOrWhiteSpace($resetReply.connectionString)) {
        throw '[RenderSettingMissing] The private Render response had no usable connection setting.'
    }
    Write-Host 'Loaded the current demo connection privately from Render. No connection value was displayed.'
    return $resetReply.connectionString
}

function Show-ResetResult($Reply) {
    if (-not $Reply.success) { throw ('[{0}] {1}' -f $Reply.code, $Reply.message) }
    Write-Host $Reply.message
}

& dotnet build $resetProject --configuration Release --verbosity quiet
if ($LASTEXITCODE -ne 0) { throw 'Recovery tool build failed. No account was changed.' }
if ($CreateNewAdmin) {
    Write-Host 'Create a separate demo administrator. Existing accounts and auction history are preserved.'
} else {
    Write-Host 'Reset the existing AuctionPilot demo administrator. Roles and auction history are preserved.'
}
if (-not $UseRenderConnection) {
    Write-Host 'In Render -> auctionpilot-demo-api -> Environment, reveal/copy the ACTUAL value of ConnectionStrings__DefaultConnection.'
    Write-Host 'The value begins Host= and includes Database, Username, Password and SSL Mode=VerifyFull.'
    Write-Host 'Paste only that complete value at the hidden prompt, not asterisks or the variable name. Never paste it in chat.'
}
$resetConnectionSecure = $null
$resetPasswordSecure = $null
$resetConfirmSecure = $null
$resetConnection = $null
$resetPassword = $null
$resetConfirm = $null
try {
    if ($UseRenderConnection) {
        $resetConnection = Get-PrivateRenderConnection
    } else {
        $resetConnectionSecure = Read-Host 'Full Neon Npgsql connection VALUE (hidden)' -AsSecureString
        $resetConnection = Convert-PrivateInput $resetConnectionSecure
    }
    Show-ResetResult (Invoke-PrivateReset @{ mode = 'validate'; connectionString = $resetConnection })
    if ($CreateNewAdmin) {
        $resetEmail = Read-Host 'New administrator email to register (use an email you control)'
    } else {
        $resetEmail = Read-Host 'Existing administrator email'
    }
    Write-Host 'New password: at least 12 characters, including uppercase, lowercase, a number and a symbol.'
    $resetPasswordSecure = Read-Host 'New administrator password (hidden)' -AsSecureString
    $resetConfirmSecure = Read-Host 'Confirm new password (hidden)' -AsSecureString
    $resetPassword = Convert-PrivateInput $resetPasswordSecure
    $resetConfirm = Convert-PrivateInput $resetConfirmSecure
    if ([string]::IsNullOrWhiteSpace($resetEmail)) { throw '[AccountInputMissing] Administrator email is required. No account was changed.' }
    if ($resetPassword -cne $resetConfirm) { throw '[PasswordConfirmationMismatch] Passwords do not match. No account was changed.' }
    $resetMode = if ($CreateNewAdmin) { 'create' } else { 'reset' }
    Show-ResetResult (Invoke-PrivateReset @{ mode = $resetMode; connectionString = $resetConnection; email = $resetEmail; password = $resetPassword })
} finally {
    foreach ($resetSecure in @($resetConnectionSecure, $resetPasswordSecure, $resetConfirmSecure)) {
        if ($null -ne $resetSecure) { $resetSecure.Dispose() }
    }
    $resetConnection = $null; $resetPassword = $null; $resetConfirm = $null
}

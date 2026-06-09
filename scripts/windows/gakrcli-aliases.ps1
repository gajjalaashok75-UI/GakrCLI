Set-StrictMode -Version Latest

function Test-GakrCLICommand {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  return [bool](Get-Command -Name $Name -ErrorAction SilentlyContinue)
}

function Assert-GakrCLICommand {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$InstallHint
  )

  if (-not (Test-GakrCLICommand -Name $Name)) {
    throw "Required command '$Name' was not found. $InstallHint"
  }
}

function Invoke-GakrCLI {
  [CmdletBinding()]
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$GakrCLIArgs
  )

  Assert-GakrCLICommand -Name "gakrcli" -InstallHint "Install with: npm install -g @gakr-gakr/gakrcli"

  & gakrcli @GakrCLIArgs

  if ($LASTEXITCODE -ne 0) {
    throw "gakrcli failed with exit code $LASTEXITCODE."
  }
}

function Invoke-GakrCLIWithEnvironment {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Environment,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$GakrCLIArgs
  )

  $previousValues = @{}

  foreach ($name in $Environment.Keys) {
    $previousValues[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
    Set-Item -Path "Env:$name" -Value $Environment[$name]
  }

  try {
    Invoke-GakrCLI @GakrCLIArgs
  }
  finally {
    foreach ($name in $Environment.Keys) {
      if ($null -eq $previousValues[$name]) {
        Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
      }
      else {
        Set-Item -Path "Env:$name" -Value $previousValues[$name]
      }
    }
  }
}

function Get-GakrCLIQuickHelp {
  [CmdletBinding()]
  param()

  @(
    "GakrCLI quick commands:",
    "  cli [args...]              -> launch GakrCLI using the installed CLI",
    "  cli-local [args...]        -> launch GakrCLI with local/Ollama OpenAI-compatible environment hints for this invocation only",
    "  cli-fast [args...]         -> launch GakrCLI with low-latency local defaults for this invocation only",
    "  cli-provider               -> open the provider manager in GakrCLI",
    "  cli-check                  -> show Ollama install/listening/model state",
    "  cli-init                   -> pull/check the local model, then launch local/Ollama mode",
    "  cli-help                   -> show this help"
  ) -join [Environment]::NewLine
}

function cli {
  [CmdletBinding()]
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$GakrCLIArgs
  )

  Invoke-GakrCLI @GakrCLIArgs
}

function cli-local {
  [CmdletBinding()]
  param(
    [string]$Model = "llama3.1:8b",
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$GakrCLIArgs
  )

  Invoke-GakrCLIWithEnvironment `
    -Environment @{
      GAKR_CODE_USE_OPENAI = "1"
      OPENAI_BASE_URL        = "http://localhost:11434/v1"
      OPENAI_MODEL           = $Model
    } `
    @GakrCLIArgs
}

function cli-fast {
  [CmdletBinding()]
  param(
    [string]$Model = "llama3.1:8b",
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$GakrCLIArgs
  )

  Invoke-GakrCLIWithEnvironment `
    -Environment @{
      GAKR_CODE_USE_OPENAI = "1"
      OPENAI_BASE_URL        = "http://localhost:11434/v1"
      OPENAI_MODEL           = $Model
      GAKR_FAST_MODE   = "1"
    } `
    @GakrCLIArgs
}

function cli-provider {
  [CmdletBinding()]
  param()

  Invoke-GakrCLI "/provider"
}

function cli-check {
  [CmdletBinding()]
  param(
    [string]$Model = "llama3.1:8b"
  )

  Assert-GakrCLICommand -Name "ollama" -InstallHint "Install Ollama from https://ollama.com/download/windows."

  $version = & ollama --version 2>$null
  $modelNames = (& ollama list 2>$null | Select-Object -Skip 1 | ForEach-Object {
      ($_ -split "\s+")[0]
    }) | Where-Object { $_ }

  $isModelAvailable = $modelNames -contains $Model
  $probeSucceeded = $false

  try {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -TimeoutSec 3
    if ($response.models) {
      $probeSucceeded = $true
    }
  }
  catch {
    $probeSucceeded = $false
  }

  [PSCustomObject]@{
    OllamaInstalled = $true
    OllamaVersion   = $version
    OllamaListening = $probeSucceeded
    Model           = $Model
    ModelAvailable  = $isModelAvailable
  }
}

function cli-init {
  [CmdletBinding()]
  param(
    [string]$Model = "llama3.1:8b",
    [switch]$SkipModelPull
  )

  Assert-GakrCLICommand -Name "ollama" -InstallHint "Install Ollama from https://ollama.com/download/windows."

  if (-not $SkipModelPull) {
    & ollama pull $Model
    if ($LASTEXITCODE -ne 0) {
      throw "ollama pull $Model failed with exit code $LASTEXITCODE."
    }
  }

  $health = cli-check -Model $Model
  if (-not $health.OllamaListening) {
    Write-Warning "Ollama is installed but API probe to localhost:11434 did not succeed. Start Ollama and retry."
  }

  cli-local -Model $Model
}

function cli-help {
  [CmdletBinding()]
  param()

  Get-GakrCLIQuickHelp
}

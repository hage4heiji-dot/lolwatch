// LCU(League Client Update)のローカルAPIを叩いて、指定した試合のリプレイを
// モデレーターの手元のLeagueクライアントで開くPowerShellスクリプトを生成する。
//
// 前提と注意点(README/レビュー画面にも同内容を明記すること):
// - 実際のLeagueクライアント(Windows)を使った検証はできていない。LCUの
//   エンドポイント(/lol-replays/v1/rofls/{gameId}/watch)はコミュニティで
//   広く使われているパターンに基づくが、パッチにより変わる可能性がある。
// - モデレーターの手元のクライアントが対象試合と同じリージョンのアカウントで
//   ログインしている必要がある。
// - リプレイはRiot側で試合終了後 数週間程度しか保持されないため、
//   古い試合では失敗する。
export function buildReplayLaunchScript({
  gameId,
  matchId,
  incidentTimeLabel,
}: {
  gameId: string;
  matchId: string;
  incidentTimeLabel: string | null;
}): string {
  return `# lolwatch: 指定した試合のリプレイをLeagueクライアントで開くスクリプト
# 対象試合: ${matchId}
# 問題のシーンの目安時間: ${incidentTimeLabel ?? "指定なし(再生後に手動でシークしてください)"}
#
# 前提: このPCでLeagueクライアントが起動していて、対象試合と同じリージョンの
# アカウントでログインしていること。リプレイはRiot側のサーバーに試合終了後
# 数週間程度しか保持されないため、古い試合では失敗することがあります。
#
# 実行方法: このファイルを右クリック→「PowerShellで実行」、または
# PowerShellから次のように実行してください。
#   powershell -ExecutionPolicy Bypass -File .\\${scriptFileName(matchId)}

$GameId = "${gameId}"

$proc = Get-CimInstance Win32_Process -Filter "name = 'LeagueClientUx.exe'" -ErrorAction SilentlyContinue
if (-not $proc) {
    Write-Host "エラー: League クライアントが起動していません。クライアントを起動してログインしてから再実行してください。" -ForegroundColor Red
    exit 1
}

$cmd = $proc.CommandLine
$port = [regex]::Match($cmd, '--app-port=(\\d+)').Groups[1].Value
$token = [regex]::Match($cmd, '--remoting-auth-token=([\\w-]+)').Groups[1].Value

if (-not $port -or -not $token) {
    Write-Host "エラー: クライアントの接続情報(ポート/トークン)を取得できませんでした。" -ForegroundColor Red
    exit 1
}

$pair = "riot:$token"
$basicAuth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
$headers = @{ Authorization = "Basic $basicAuth" }

# LCUは自己署名証明書を使うため証明書検証をスキップする。
if ($PSVersionTable.PSVersion.Major -ge 6) {
    $skipCert = @{ SkipCertificateCheck = $true }
} else {
    if (-not ("TrustAllCertsPolicy" -as [type])) {
        Add-Type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class TrustAllCertsPolicy : ICertificatePolicy {
    public bool CheckValidationResult(ServicePoint sp, X509Certificate cert, WebRequest req, int problem) { return true; }
}
"@
    }
    [System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
    $skipCert = @{}
}

$uri = "https://127.0.0.1:$port/lol-replays/v1/rofls/$GameId/watch"

try {
    Invoke-RestMethod -Uri $uri -Method Post -Headers $headers @skipCert -ErrorAction Stop
    Write-Host "リプレイの再生を開始しました(読み込みに時間がかかる場合があります)。" -ForegroundColor Green
    Write-Host "問題のシーンの目安時間: ${incidentTimeLabel ?? "指定なし"}" -ForegroundColor Cyan
} catch {
    Write-Host "リプレイの再生開始に失敗しました: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "考えられる原因: リプレイの保持期限切れ、クライアントのリージョンが試合と異なる、クライアント側の仕様変更など。" -ForegroundColor Yellow
    exit 1
}
`;
}

export function scriptFileName(matchId: string): string {
  return `watch-${matchId}.ps1`;
}

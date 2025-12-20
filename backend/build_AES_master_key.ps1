# Generate 32 random bytes (256-bit key)
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)

# Convert to Base64 string
$key = [System.Convert]::ToBase64String($bytes)

# Output the key (so it can be captured)
$key

# Verify length: decode Base64 and check byte count
$decoded = [System.Convert]::FromBase64String($key)
if ($decoded.Length -eq 32) {
    exit 0
} else {
    Write-Error "Error: Generated key length is incorrect"
    exit 1
}
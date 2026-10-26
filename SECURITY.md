# Security

## Report a vulnerability

Please do not put credentials, personal memories, private source material, or
unredacted logs in a public issue. If GitHub offers **Report a vulnerability**
on this repository's Security tab, use that private channel. Otherwise open a
minimal issue asking for a private contact method without disclosing the exploit
or private data, then share details only after a private channel is established.

Include the affected version and platform, expected boundary, reproduction
using synthetic data, and the impact you observed. Do not attach a real database
or backup unless its contents have been reviewed and a private transfer agreed.

## Scope and boundaries

The latest stable release is the primary maintenance target. No fixed response
time or support lifetime is promised.

The Gateway binds to loopback and uses a bearer token. Keep the token private
and rotate it if exposed. Tool profiles control discovery, not permissions;
an authenticated client can call tools outside its advertised profile.
Do not expose the endpoint to a LAN or public reverse proxy.

The Desktop renderer uses IPC for privileged operations. Knowledge reads are
scoped to the selected directory; source text is data, not trusted instructions.
Optional model providers have their own privacy and retention policies.
See [Privacy and data](docs/PRIVACY.md).

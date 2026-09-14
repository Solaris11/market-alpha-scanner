# TradeVeto Command Relay

Small local relay for agent sessions that cannot type into the real Mac terminal.

The relay watches `.agent-relay/requests/*.json`, executes only named allowlisted
actions on the real Mac, and writes `.agent-relay/results/<id>.json`. It is not a
general shell runner.

## Start / Stop

```bash
tools/local/tradeveto-command-relay/install_launch_agent.sh
tools/local/tradeveto-command-relay/uninstall_launch_agent.sh
```

## Submit A Request

```bash
tools/local/tradeveto-command-relay/submit_request.py prod_ssh_probe
tools/local/tradeveto-command-relay/submit_request.py prod_status
tools/local/tradeveto-command-relay/submit_request.py git_push --branch work/terminal-ia-simplification
```

The printed result path is where an agent should read the output.

## Request Format

```json
{
  "id": "optional-stable-id",
  "action": "prod_status",
  "args": {},
  "reason": "why this is needed"
}
```

## Safety Model

- No raw shell actions.
- No arbitrary SQL. DB checks are named read-only query bundles.
- No secret/env printing.
- No force push.
- No destructive git reset/checkout.
- Production commands are fixed command templates with sanitized arguments.
- Mutating production actions are limited to explicit deploy/scan actions.

Allowed actions are listed by:

```bash
tools/local/tradeveto-command-relay/submit_request.py list_actions
```

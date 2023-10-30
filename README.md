# GitHub GitOps Action

## Config file schema

```yaml
members:
  - login: string
    email: string
    role: 'admin' | 'member'
    teams: string[] | null
    repositories: { name: string, permission: 'pull' | 'triage' | 'push' | 'maintain' | 'admin' }[] | null
    meta: object | null

outsideCollaborators:
  - login: string
    repositories: { name: string, permission: 'pull' | 'triage' | 'push' | 'maintain' | 'admin' }[]
    meta: object | null

teams:
  - name: string
    description: string | null
    visibility: 'closed' | 'secret'
    repositories: { name: string, permission: 'pull' | 'triage' | 'push' | 'maintain' | 'admin' }[] | null

repositories:
  - name: string
    description: string | null
    visibility: 'public' | 'private'
```

# GitHub GitOps Action


## Usage

```yaml
name: GitHub GitOps

on:
  push:
    branches: [main]

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4
      - uses: mechiru/github-gitops-action@main
        with:
          organization: your-organization-name      # Default is `${{ github.repository_owner }}`.
          token: ${{ secrets.MY_GITHUB_API_TOKEN }}
          file: github.yml                          # Default is `github.yml`.
          dry-run: true                             # Default is `false`.
```

Please see [action.yml](./action.yml) file.


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

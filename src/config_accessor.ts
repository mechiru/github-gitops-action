import {Config, Member, Repository, RepositoryPermission, Team, TeamRepository} from 'src/config';

export class ConfigAccessor {
  constructor(private readonly config: Config) {}

  listMember(): Map<string /* login */, Member> {
    const map = new Map<string, Member>();
    for (const m of this.config.members) {
      if (map.has(m.login)) {
        throw new Error(`[accessor] duplicate member found: member=${JSON.stringify(m)}`);
      }
      map.set(m.login, m);
    }
    return map;
  }

  listRepositoryCollaborator(): ReadonlyMap<
    string /* repository */,
    Map<string /* login */, {login: string; permission: RepositoryPermission}>
  > {
    const map = new Map<string, Map<string, {login: string; permission: RepositoryPermission}>>();
    for (const m of this.config.members ?? []) {
      for (const r of m.repositories ?? []) {
        if (!map.has(r.name)) {
          map.set(r.name, new Map());
        }
        map.get(r.name)!.set(m.login, {login: m.login, permission: r.permission});
      }
    }

    for (const c of this.config.outsideCollaborators ?? []) {
      for (const r of c.repositories) {
        if (!map.has(r.name)) {
          map.set(r.name, new Map());
        }
        map.get(r.name)!.set(c.login, {login: c.login, permission: r.permission});
      }
    }
    return map;
  }

  listRepository(): Map<string /* name */, Repository> {
    const map = new Map<string, Repository>();
    for (const r of this.config.repositories ?? []) {
      if (map.has(r.name)) {
        throw new Error(`[accessor] duplicate repository found: repository=${JSON.stringify(r)}`);
      }
      map.set(r.name, r);
    }
    return map;
  }

  listTeam(): Map<string /* name */, Team> {
    const map = new Map<string, Team>();
    for (const t of this.config.teams ?? []) {
      if (map.has(t.name)) {
        throw new Error(`[accessor] duplicate team found: team=${JSON.stringify(t)}`);
      }
      map.set(t.name, t);
    }
    return map;
  }

  listTeamMember(): Map<string /* team name */, Map<string /* login */, Member>> {
    const map = new Map<string, Map<string, Member>>();
    for (const m of this.config.members) {
      for (const t of m.teams ?? []) {
        if (!map.has(t)) {
          map.set(t, new Map());
        }
        map.get(t)!.set(m.login, m);
      }
    }
    return map;
  }

  listTeamRepository(): Map<string /* team name */, Map<string /* repository name */, TeamRepository>> {
    const map = new Map<string, Map<string, TeamRepository>>();
    for (const t of this.config.teams ?? []) {
      if (!map.has(t.name)) {
        map.set(t.name, new Map());
      }
      for (const r of t.repositories ?? []) {
        map.get(t.name)!.set(r.name, r);
      }
    }
    return map;
  }
}

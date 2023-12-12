import * as core from '@actions/core';
import {ConfigAccessor} from 'src/config_accessor';
import {GitHubClient} from 'src/github_client';
import {RepositoryPermission} from 'src/config';

export class SyncService {
  private teamSynced = false;

  constructor(
    private readonly client: GitHubClient,
    private readonly config: ConfigAccessor
  ) {}

  async syncAll() {
    const teams = await this.syncTeams();
    const members = await this.syncOrganizationMembers();
    const repositories = await this.syncOrganizationRepositories();
    const repositoryCollaborators = await this.syncRepositoryCollaborators();
    const teamMembers = await this.syncTeamMembers();
    const teamRepositories = await this.syncTeamRepositories();

    return {
      members,
      repositoryCollaborators,
      repositories,
      teams,
      teamMembers,
      teamRepositories,
    };
  }

  private async syncOrganizationMembers() {
    const desired = this.config.listMember();
    const current = await this.client.listOrganizationMember();

    const {add, sub, notEq} = diff(
      desired,
      current,
      c => c.login,
      (d, c) => d.login === c.login && d.role === c.role
    );

    if (add.length >= 0) {
      if (!this.teamSynced) {
        throw new Error('[sync/syncOrganizationMembers] organization teams are not synced');
      }

      const teams = await this.client.listTeam();

      for (const d of add) {
        core.info(`[sync/syncOrganizationMembers] add user to organization: user=${JSON.stringify(d)}`);
        await this.client.addOrganizationMember({
          ...d,
          teamIds:
            d.teams?.map(x => {
              const team = teams.find(t => x === t.name);
              if (team == null) {
                throw new Error(`[sync/syncOrganizationMembers] team is not exists: name=${x}`);
              }
              return team.id;
            }) ?? [],
        });
      }
    }

    for (const c of sub) {
      core.info(`[sync/syncOrganizationMembers] remove member from organization: member=${JSON.stringify(c)}`);
      await this.client.removeOrganizationMember({...c});
    }

    for (const [d, c] of notEq) {
      core.info(`[sync/syncOrganizationMembers] update member: member=${JSON.stringify({desired: d, current: c})}`);
      await this.client.updateOrganizationMember(d);
    }

    return {add, sub, notEq};
  }

  private async syncRepositoryCollaborators() {
    const desired = this.config.listRepositoryCollaborator();
    const current = await this.client.listOrganizationRepository({withCollaborator: true});
    const diffs = [];

    for (const repo of current) {
      core.info(`[sync/syncOutsideCollaborators] repository=${JSON.stringify(repo)}`);

      const {add, sub, notEq} = diff(
        desired.get(repo.name) ?? new Map<string, {login: string; permission: RepositoryPermission}>(),
        repo.collaborators,
        c => c.login,
        (d, c) => d.login === c.login && d.permission === c.permission
      );

      for (const d of add) {
        core.info(`[sync/syncOutsideCollaborators] add repository collaborator: collaborator=${JSON.stringify(d)}`);
        await this.client.addRepositoryCollaborator({
          ...d,
          repository: repo.name,
        });
      }

      for (const c of sub) {
        core.info(`[sync/syncOutsideCollaborators] remove repository collaborator: collaborator=${JSON.stringify(c)}`);
        await this.client.removeRepositoryCollaborator({login: c.login, repository: repo.name});
      }

      for (const [d, c] of notEq) {
        core.info(
          `[sync/syncOutsideCollaborators] update repository collaborator: collaborator=${JSON.stringify({
            desired: d,
            current: c,
          })}`
        );
        await this.client.updateRepositoryCollaborator({
          ...d,
          repository: repo.name,
        });
      }

      if (add.length > 0 || sub.length > 0 || notEq.length > 0) {
        diffs.push({name: repo.name, add, sub, notEq});
      }
    }

    return diffs;
  }

  private async syncOrganizationRepositories() {
    const desired = this.config.listRepository();
    const current = await this.client.listOrganizationRepository({withCollaborator: false});

    const {add, sub, notEq} = diff(
      desired,
      current,
      c => c.name,
      (d, c) => d.name === c.name && d.description == c.description && d.visibility === c.visibility
    );

    for (const d of add) {
      core.info(`[sync/syncOrganizationRepositories] add organization repository: repository=${JSON.stringify(d)}`);
      await this.client.createOrganizationRepository(d);
    }

    for (const c of sub) {
      core.info(`[sync/syncOrganizationRepositories] remove organization repository: repository=${JSON.stringify(c)}`);
      await this.client.deleteOrganizationRepository(c);
    }

    for (const [d, c] of notEq) {
      core.info(
        `[sync/syncOrganizationRepositories] update organization repository: repository=${JSON.stringify({
          desired: d,
          current: c,
        })}`
      );
      await this.client.updateOrganizationRepository(d);
    }

    return {add, sub, notEq};
  }

  private async syncTeams() {
    const desired = this.config.listTeam();
    const current = await this.client.listTeam();

    const {add, sub, notEq} = diff(
      desired,
      current,
      c => c.name,
      (d, c) => d.name === c.name && d.description == c.description && d.visibility === c.privacy
    );

    for (const d of add) {
      core.info(`[sync/syncTeams] add team: team=${JSON.stringify(d)}`);
      await this.client.createTeam({...d, privacy: d.visibility});
    }

    for (const c of sub) {
      core.info(`[sync/syncTeams] remove team: team=${JSON.stringify(c)}`);
      await this.client.deleteTeam({...c});
    }

    for (const [d, c] of notEq) {
      core.info(`[sync/syncTeams] update team: team=${JSON.stringify({desired: d, current: c})}`);
      await this.client.updateTeam({
        ...d,
        slug: c.slug,
        privacy: d.visibility,
      });
    }

    this.teamSynced = true;
    return {add, sub, notEq};
  }

  private async syncTeamMembers() {
    if (!this.teamSynced) {
      throw new Error('[sync/syncTeamMembers] organization teams are not synced');
    }

    const teams = await this.client.listTeam();
    const desiredTeamMembers = this.config.listTeamMember();
    const diffs = [];

    for (const team of teams) {
      core.info(`[sync/syncTeamMembers] team=${JSON.stringify({slug: team.slug, name: team.name})}`);
      const desiredMembers = desiredTeamMembers.get(team.name)!;
      const currentMembers = await this.client.listTeamMember({...team});

      const {add, sub} = diff(
        desiredMembers,
        currentMembers,
        c => c.login,
        (d, c) => d.login === c.login
      );

      for (const d of add) {
        core.info(`[sync/syncTeamMembers] add team member: member=${JSON.stringify(d)}`);
        await this.client.addTeamMember({slug: team.slug, login: d.login});
      }

      for (const c of sub) {
        core.info(`[sync/syncTeamMembers] remove team member: member=${JSON.stringify(c)}`);
        await this.client.removeTeamMember({slug: team.slug, login: c.login});
      }

      if (add.length > 0 || sub.length > 0) {
        diffs.push({name: team.name, add, sub});
      }
    }

    return diffs;
  }

  private async syncTeamRepositories() {
    if (!this.teamSynced) {
      throw new Error('[sync/syncTeamRepositories] organization teams are not synced');
    }

    const teams = await this.client.listTeam();
    const desiredTeamRepositories = this.config.listTeamRepository();
    const diffs = [];

    for (const team of teams) {
      core.info(`[sync/syncTeamRepositories] team=${JSON.stringify({slug: team.slug, name: team.name})}`);
      const desiredRepositories = desiredTeamRepositories.get(team.name)!;
      const currentRepositories = await this.client.listTeamRepository({...team});

      const {add, sub, notEq} = diff(
        desiredRepositories,
        currentRepositories,
        c => c.name,
        (d, c) => d.name === c.name && d.permission === c.permission
      );

      for (const d of add) {
        core.info(`[sync/syncTeamRepositories] add team repository: repository=${JSON.stringify(d)}`);
        await this.client.addTeamRepository({slug: team.slug, repository: d.name, permission: d.permission});
      }

      for (const c of sub) {
        core.info(`[sync/syncTeamRepositories] remove team repository: repository=${JSON.stringify(c)}`);
        await this.client.removeTeamRepository({slug: team.slug, repository: c.name});
      }

      for (const [d, c] of notEq) {
        core.info(
          `[sync/syncTeamRepositories] update team repository: repository=${JSON.stringify({desired: d, current: c})}`
        );
        await this.client.updateTeamRepository({slug: team.slug, repository: d.name, permission: d.permission});
      }

      if (add.length > 0 || sub.length > 0 || notEq.length > 0) {
        diffs.push({name: team.name, add, sub, notEq});
      }
    }

    return diffs;
  }
}

export function diff<K, D, C>(
  desired: Map<K, D>,
  current: C[],
  key: (c: C) => K,
  equal: (d: D, c: C) => boolean
): Readonly<{
  add: D[];
  sub: C[];
  eq: [D, C][];
  notEq: [D, C][];
}> {
  const sub: C[] = [];
  const eq: [D, C][] = [];
  const notEq: [D, C][] = [];

  const set = new Map(desired);

  for (const c of current) {
    const k = key(c);
    if (set.has(k)) {
      const d = set.get(k)!;
      if (equal(d, c)) {
        eq.push([d, c]);
      } else {
        notEq.push([d, c]);
      }
      set.delete(k);
    } else {
      sub.push(c);
    }
  }

  return {add: Array.from(set.values()), sub, eq, notEq};
}

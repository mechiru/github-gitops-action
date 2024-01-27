import * as core from '@actions/core';
import {
  AddCollaborator,
  AddMember,
  AddTeamMember,
  AddTeamRepository,
  CreateRepository,
  CreateTeam,
  DeleteRepository,
  DeleteTeam,
  GitHubClient as ClientInterface,
  ListRepository,
  ListTeamMember,
  ListTeamRepository,
  Member,
  RemoveCollaborator,
  RemoveMember,
  RemoveTeamMember,
  RemoveTeamRepository,
  Repository,
  Team,
  TeamMember,
  TeamRepository,
  UpdateCollaborator,
  UpdateMember,
  UpdateRepository,
  UpdateTeam,
} from 'src/github_client';
import {MemberRole, RepositoryPermission, RepositoryVisibility} from 'src/config';
import {Octokit} from '@octokit/core';
import {paginateRest, type PaginatingEndpoints} from '@octokit/plugin-paginate-rest';
import {paginateGraphql} from '@octokit/plugin-paginate-graphql';
import {throttling} from '@octokit/plugin-throttling';
import {LazyAsync} from 'src/lazy_async';

type Unwrap<T> = T extends {[K in keyof T]: infer U} ? U : never;

type OrganizationInvitation = Unwrap<PaginatingEndpoints['GET /orgs/{org}/invitations']['response']['data']>;

export class GitHubClient implements ClientInterface {
  private readonly dryRun: boolean;
  private readonly octokit: Octokit & ReturnType<typeof paginateRest> & ReturnType<typeof paginateGraphql>;
  private readonly default: Readonly<{org: string; per_page: number}>;

  private readonly pendingInvitations: LazyAsync<Map<string, OrganizationInvitation>>;

  constructor(init: {organization: string; token: string; dryRun: boolean; pageSize?: number}) {
    this.dryRun = init.dryRun;
    this.default = {
      org: init.organization,
      per_page: init.pageSize || 100,
    };
    this.octokit = new (Octokit.plugin(paginateRest, paginateGraphql, throttling))({
      auth: init.token,
      throttle: {
        onRateLimit: (retryAfter, options, octokit, retryCount) => {
          octokit.log.warn(`[client] request quota exhausted for request: ${JSON.stringify(options)}`);

          if (retryCount < 1) {
            // only retries once
            octokit.log.info(`[client] retrying after ${retryAfter} seconds!`);
            return true;
          }

          return false;
        },
        onSecondaryRateLimit: (_, options, octokit) => {
          // does not retry, only logs a warning
          octokit.log.warn(`[client] secondary rate limit detected for request: ${JSON.stringify(options)}`);
        },
      },
    });
    this.pendingInvitations = new LazyAsync(this.listOrganizationInvitation.bind(this));
  }

  // https://docs.github.com/en/rest/orgs/members?apiVersion=2022-11-28#list-pending-organization-invitations
  private async listOrganizationInvitation(): Promise<Map<string, OrganizationInvitation>> {
    const map = new Map<string, OrganizationInvitation>();
    for await (const resp of this.octokit.paginate.iterator('GET /orgs/{org}/invitations', {
      ...this.default,
    })) {
      for (const x of resp.data) {
        if (x.login != null) {
          map.set(x.login, x);
        }
      }
    }

    if (core.isDebug()) {
      core.debug(
        `[client/listOrganizationInvitation] invitations=${JSON.stringify(Array.from(map.values()), null, 2)}`
      );
    }
    core.info(`[client/listOrganizationInvitation] size=${map.size}`);

    return map;
  }

  // https://docs.github.com/en/graphql/reference/objects#organization
  async listOrganizationMember(): Promise<Member[]> {
    const resp = await this.octokit.graphql.paginate<{
      organization: {
        membersWithRole: {
          edges: {
            role: 'MEMBER' | 'ADMIN';
            node: {
              login: string;
            };
          }[];
        };
      };
    }>(
      `query listOrganizationMember($organization: String!, $cursor: String) {
  organization(login: $organization) {
    membersWithRole(first: 100, after: $cursor) {
      edges {
        role
        node {
          login
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`,
      {organization: this.default.org}
    );

    const members = resp.organization.membersWithRole.edges.map(x => ({
      login: x.node.login,
      role: x.role.toLowerCase() as MemberRole,
    }));

    if (core.isDebug()) {
      core.debug(`[client/listOrganizationMember] members=${JSON.stringify(members, null, 2)}`);
    }
    core.info(`[client/listOrganizationMember] length=${members.length}`);

    return members;
  }

  // https://docs.github.com/en/rest/orgs/members?apiVersion=2022-11-28#create-an-organization-invitation
  async addOrganizationMember(input: AddMember): Promise<void> {
    const pending = await this.pendingInvitations.value();
    if (pending.has(input.login)) {
      core.info(`[client/addOrganizationMember] already invited: member=${JSON.stringify(pending.get(input.login))}`);
      return;
    }

    if (this.dryRun) {
      core.info(`[client/addOrganizationMember/dryRun] invite to organization: member=${input}`);
      return;
    }

    const roles = {
      admin: 'admin',
      member: 'direct_member',
    } as const;

    await this.octokit.request('POST /orgs/{org}/invitations', {
      ...this.default,
      email: input.email,
      role: roles[input.role],
      team_ids: input.teamIds,
    });

    core.info(`[client/addOrganizationMember] invited to organization: member=${JSON.stringify(input)}`);
  }

  // https://docs.github.com/en/rest/orgs/members?apiVersion=2022-11-28#set-organization-membership-for-a-user
  async updateOrganizationMember(input: UpdateMember): Promise<void> {
    if (this.dryRun) {
      core.info(`[client/updateOrganizationMember/dryRun] update member: member=${JSON.stringify(input)}`);
      return;
    }

    await this.octokit.request('PUT /orgs/{org}/memberships/{username}', {
      ...this.default,
      username: input.login,
      role: input.role,
    });

    core.info(`[client/updateOrganizationMember] update member: member=${JSON.stringify(input)}`);
  }

  // https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-organization-repositories
  async listOrganizationRepository(input: ListRepository): Promise<Repository[]> {
    const resp = await this.octokit.paginate('GET /orgs/{org}/repos', {
      ...this.default,
    });

    const repos: Repository[] = [];
    for (const repo of resp) {
      repos.push({
        id: repo.id,
        name: repo.name,
        description: repo.description as string | undefined,
        visibility: repo.private ? RepositoryVisibility.private : RepositoryVisibility.public,
        collaborators: input.withCollaborator ? await this.listRepositoryCollaborator(repo.name, 'direct') : [],
      });
    }

    if (core.isDebug()) {
      core.debug(`[client/listRepositories] repositories=${JSON.stringify(repos, null, 2)}`);
    }
    core.info(`[client/listRepositories] length=${repos.length}`);

    return repos;
  }

  // https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#create-an-organization-repository
  async createOrganizationRepository(input: CreateRepository): Promise<void> {
    if (this.dryRun) {
      core.info(`[client/createOrganizationRepository/dryRun] create repository: repository=${JSON.stringify(input)}`);
      return;
    }

    await this.octokit.request('POST /orgs/{org}/repos', {
      ...this.default,
      ...input,
      private: input.visibility === RepositoryVisibility.private,
    });

    core.info(`[client/createOrganizationRepository] created repository: repository=${JSON.stringify(input)}`);
  }

  // https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#update-a-repository
  async updateOrganizationRepository(input: UpdateRepository): Promise<void> {
    if (this.dryRun) {
      core.info(`[client/updateOrganizationRepository/dryRun] update repository: repository=${JSON.stringify(input)}`);
      return;
    }

    await this.octokit.request('PATCH /repos/{owner}/{repo}', {
      owner: this.default.org,
      repo: input.name,
      description: input.description,
      private: input.visibility === RepositoryVisibility.private,
    });

    core.info(`[client/updateOrganizationRepository] updated repository: repository=${JSON.stringify(input)}`);
  }

  // https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#delete-a-repository
  async deleteOrganizationRepository(input: DeleteRepository): Promise<void> {
    if (this.dryRun) {
      core.info(`[client/deleteOrganizationRepository/dryRun] delete repository: repository=${JSON.stringify(input)}`);
      return;
    }

    await this.octokit.request('DELETE /repos/{owner}/{repo}', {
      owner: this.default.org,
      repo: input.name,
    });
    core.info(`[client/deleteOrganizationRepository] deleted repository: repository=${JSON.stringify(input)}`);
  }

  // https://docs.github.com/en/rest/orgs/members?apiVersion=2022-11-28#remove-organization-membership-for-a-user
  async removeOrganizationMember(input: RemoveMember): Promise<void> {
    if (this.dryRun) {
      core.info(`[client/removeOrganizationMember/dryRun] remove member: member=${JSON.stringify(input)}`);
      return;
    }

    await this.octokit.request('DELETE /orgs/{org}/memberships/{username}', {
      ...this.default,
      username: input.login,
    });

    core.info(`[client/removeOrganizationMember] removed member: member=${JSON.stringify(input)}`);
  }

  // https://docs.github.com/en/rest/collaborators/collaborators?apiVersion=2022-11-28#list-repository-collaborators
  private async listRepositoryCollaborator(
    repository: string,
    affiliation: 'direct' | 'outside'
  ): Promise<
    {
      login: string;
      permission: RepositoryPermission;
    }[]
  > {
    const resp = await this.octokit.paginate('GET /repos/{owner}/{repo}/collaborators', {
      owner: this.default.org,
      repo: repository,
      affiliation,
    });

    const collaborators = resp.map(x => {
      return {
        login: x.login,
        permission: toRepositoryPermission(x.permissions),
      };
    });

    if (core.isDebug()) {
      core.info(
        `[client/listRepositoryCollaborator] ${affiliation} collaborators=${JSON.stringify(collaborators, null, 2)}`
      );
    }
    core.info(`[client/listRepositoryCollaborator] length=${collaborators.length}`);

    return collaborators;
  }

  // https://docs.github.com/en/rest/collaborators/collaborators?apiVersion=2022-11-28#add-a-repository-collaborator
  private async addOrUpdateRepositoryCollaborator(
    op: 'add' | 'update',
    input: AddCollaborator | UpdateCollaborator
  ): Promise<void> {
    if (this.dryRun) {
      core.info(
        `[client/addOrUpdateRepositoryCollaborator/dryRun] ${op} collaborator: collaborator=${JSON.stringify(input)}`
      );
      return;
    }

    await this.octokit.request('PUT /repos/{owner}/{repo}/collaborators/{username}', {
      owner: this.default.org,
      repo: input.repository,
      username: input.login,
      permission: input.permission,
    });
    core.info(`[client/addOrUpdateRepositoryCollaborator] ${op} collaborator: collaborator=${JSON.stringify(input)}`);
  }

  addRepositoryCollaborator(input: AddCollaborator): Promise<void> {
    return this.addOrUpdateRepositoryCollaborator('add', input);
  }

  updateRepositoryCollaborator(input: UpdateCollaborator): Promise<void> {
    return this.addOrUpdateRepositoryCollaborator('update', input);
  }

  // https://docs.github.com/en/rest/collaborators/collaborators?apiVersion=2022-11-28#remove-a-repository-collaborator
  async removeRepositoryCollaborator(input: RemoveCollaborator): Promise<void> {
    if (this.dryRun) {
      core.info(
        `[client/removeRepositoryCollaborator/dryRun] remove collaborator: collaborator=${JSON.stringify(input)}`
      );
      return;
    }

    await this.octokit.request('DELETE /repos/{owner}/{repo}/collaborators/{username}', {
      owner: this.default.org,
      repo: input.repository,
      username: input.login,
    });
    core.info(`[client/removeRepositoryCollaborator] removed collaborator: collaborator=${JSON.stringify(input)}`);
  }

  // https://docs.github.com/en/rest/teams/teams?apiVersion=2022-11-28#list-teams
  async listTeam(): Promise<Team[]> {
    const teams = await this.octokit.paginate('GET /orgs/{org}/teams', {
      ...this.default,
    });

    if (core.isDebug()) {
      const parts = teams.map(x => ({id: x.id, name: x.name, slug: x.slug}));
      core.debug(`[client/listTeams] teams=${JSON.stringify(parts, null, 2)}`);
    }
    core.info(`[client/listTeams] length=${teams.length}`);

    return teams as Team[];
  }

  // https://docs.github.com/en/rest/teams/teams?apiVersion=2022-11-28#create-a-team
  async createTeam(input: CreateTeam): Promise<void> {
    if (this.dryRun) {
      core.info(`[client/createTeam/dryRun] create team: team=${JSON.stringify(input)}`);
      return;
    }

    await this.octokit.request('POST /orgs/{org}/teams', {
      ...this.default,
      ...input,
      parent_team_id: input.parentTeam,
    });
    core.info(`[client/createTeam] created team: team=${JSON.stringify(input)}`);
  }

  // https://docs.github.com/en/rest/teams/teams?apiVersion=2022-11-28#update-a-team
  async updateTeam(input: UpdateTeam): Promise<void> {
    if (this.dryRun) {
      core.info(`[client/updateTeam/dryRun] update team: team=${JSON.stringify(input)}`);
      return;
    }

    const resp = await this.octokit.request('PATCH /orgs/{org}/teams/{team_slug}', {
      ...this.default,
      ...input,
      team_slug: input.slug,
    });
    if (resp.status !== 201) {
      throw new Error(`[client/updateTeam] response status code error: ${resp.status}`);
    }
    core.info(`[client/updateTeam] update team: team=${JSON.stringify(input)}`);
  }

  // https://docs.github.com/en/rest/teams/teams?apiVersion=2022-11-28#delete-a-team
  async deleteTeam(input: DeleteTeam): Promise<void> {
    if (this.dryRun) {
      core.info(`[client/deleteTeam/dryRun] delete team: team=${JSON.stringify(input)}`);
      return;
    }

    await this.octokit.request('DELETE /orgs/{org}/teams/{team_slug}', {
      ...this.default,
      team_slug: input.slug,
    });
    core.info(`[client/deleteTeam] deleted team: team=${JSON.stringify(input)}`);
  }

  // https://docs.github.com/en/rest/teams/teams?apiVersion=2022-11-28#list-team-repositories
  async listTeamRepository(input: ListTeamRepository): Promise<TeamRepository[]> {
    const repos = await this.octokit.paginate('GET /orgs/{org}/teams/{team_slug}/repos', {
      ...this.default,
      team_slug: input.slug,
    });

    if (core.isDebug()) {
      core.info(`[client/listTeamRepositories] team repositories=${JSON.stringify(repos, null, 2)}`);
    }
    core.info(`[client/listTeamRepositories] length=${repos.length}`);

    return repos.map(x => ({
      id: x.id,
      name: x.name,
      permission: toRepositoryPermission(x.permissions),
    }));
  }

  // https://docs.github.com/en/rest/teams/teams?apiVersion=2022-11-28#add-or-update-team-repository-permissions
  private async addOrUpdateTeamRepository(op: 'add' | 'update', input: AddTeamRepository): Promise<void> {
    if (this.dryRun) {
      core.info(`[client/addOrUpdateTeamRepository/dryRun] ${op} repository: repository=${JSON.stringify(input)}`);
      return;
    }

    await this.octokit.request('PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}', {
      ...this.default,
      team_slug: input.slug,
      owner: this.default.org,
      repo: input.repository,
      permission: input.permission,
    });
    core.info(`[client/addOrUpdateTeamRepository] ${op} repository: repository=${JSON.stringify(input)}`);
  }

  addTeamRepository(input: AddTeamRepository): Promise<void> {
    return this.addOrUpdateTeamRepository('add', input);
  }

  updateTeamRepository(input: AddTeamRepository): Promise<void> {
    return this.addOrUpdateTeamRepository('update', input);
  }

  // https://docs.github.com/en/rest/teams/teams?apiVersion=2022-11-28#remove-a-repository-from-a-team
  async removeTeamRepository(input: RemoveTeamRepository): Promise<void> {
    if (this.dryRun) {
      core.info(`[client/removeTeamRepository/dryRun] remove team repository: repository=${JSON.stringify(input)}`);
      return;
    }

    await this.octokit.request('DELETE /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}', {
      ...this.default,
      team_slug: input.slug,
      owner: this.default.org,
      repo: input.repository,
    });
    core.info(`[client/removeTeamRepository] removed team repository:  repository=${JSON.stringify(input)}`);
  }

  // https://docs.github.com/en/rest/teams/members?apiVersion=2022-11-28#list-team-members
  async listTeamMember(input: ListTeamMember): Promise<TeamMember[]> {
    const resp = await this.octokit.paginate('GET /orgs/{org}/teams/{team_slug}/members', {
      ...this.default,
      team_slug: input.slug,
    });
    const members = resp.map(x => ({login: x.login}));

    if (core.isDebug()) {
      core.info(`[client/listTeamMembers] team members=${JSON.stringify(members, null, 2)}`);
    }
    core.info(`[client/listTeamMembers] length=${resp.length}`);

    return members;
  }

  // https://docs.github.com/en/rest/teams/members?apiVersion=2022-11-28#add-or-update-team-membership-for-a-user
  private async addOrUpdateTeamMember(op: 'add' | 'update', input: AddTeamMember): Promise<void> {
    if (this.dryRun) {
      core.info(`[client/addOrUpdateTeamMember/dryRun] ${op} team member: member=${JSON.stringify(input)}`);
      return;
    }

    await this.octokit.request('PUT /orgs/{org}/teams/{team_slug}/memberships/{username}', {
      ...this.default,
      team_slug: input.slug,
      username: input.login,
      role: 'member',
    });
    core.info(`[client/addOrUpdateTeamMember] ${op} team member: member=${JSON.stringify(input)}`);
  }

  addTeamMember(input: AddTeamMember): Promise<void> {
    return this.addOrUpdateTeamMember('add', input);
  }

  // https://docs.github.com/en/rest/teams/members?apiVersion=2022-11-28#remove-team-membership-for-a-user
  async removeTeamMember(input: RemoveTeamMember): Promise<void> {
    if (this.dryRun) {
      core.info(`[client/removeTeamMember/dryRun] remove team member: member=${JSON.stringify(input)}`);
      return;
    }

    await this.octokit.request('DELETE /orgs/{org}/teams/{team_slug}/memberships/{username}', {
      ...this.default,
      team_slug: input.slug,
      username: input.login,
    });
    core.info(`[client/removeTeamMember/dryRun] removed team member: member=${JSON.stringify(input)}`);
  }
}

function toRepositoryPermission(permissions?: {
  pull?: boolean;
  triage?: boolean;
  push?: boolean;
  maintain?: boolean;
  admin?: boolean;
}): RepositoryPermission {
  switch (true) {
    case permissions?.admin:
      return RepositoryPermission.admin;
    case permissions?.maintain:
      return RepositoryPermission.maintain;
    case permissions?.push:
      return RepositoryPermission.push;
    case permissions?.triage:
      return RepositoryPermission.triage;
    case permissions?.pull:
      return RepositoryPermission.pull;
    default:
      throw new Error('[client] failed to convert repository permission: ${JSON.stringify(permissions)}');
  }
}

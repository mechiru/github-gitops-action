import * as core from '@actions/core';
import {readFile} from 'fs/promises';
import {parse} from 'yaml';

export type Config = Readonly<{
  members: Member[];
  outsideCollaborators?: OutsideCollaborator[];
  teams?: Team[];
  repositories?: Repository[];
}>;

export type Member = Readonly<{
  login: string;
  email: string;
  role: MemberRole;
  teams?: string[];
  repositories?: MemberRepository[];
  meta?: object;
}>;

// https://docs.github.com/en/rest/orgs/members?apiVersion=2022-11-28#create-an-organization-invitation
export const MemberRole = {
  admin: 'admin',
  member: 'member',
} as const;

export type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];

export type MemberRepository = Readonly<{
  name: string;
  permission: RepositoryPermission;
}>;

export type OutsideCollaborator = Readonly<{
  login: string;
  repositories: OutsideCollaboratorRepository[];
  meta?: object;
}>;

export type OutsideCollaboratorRepository = TeamRepository;

export type Team = Readonly<{
  name: string;
  description?: string;
  visibility: TeamPrivacy;
  repositories?: TeamRepository[];
  // TODO: notification
}>;

// https://docs.github.com/en/rest/teams/teams?apiVersion=2022-11-28#create-a-team
export const TeamPrivacy = {
  closed: 'closed',
  secret: 'secret',
} as const;

export type TeamPrivacy = (typeof TeamPrivacy)[keyof typeof TeamPrivacy];

export type TeamRepository = MemberRepository;

// https://docs.github.com/en/rest/teams/teams?apiVersion=2022-11-28#add-or-update-team-repository-permissions
export const RepositoryPermission = {
  pull: 'pull',
  triage: 'triage',
  push: 'push',
  maintain: 'maintain',
  admin: 'admin',
} as const;

export type RepositoryPermission = (typeof RepositoryPermission)[keyof typeof RepositoryPermission];

export type Repository = Readonly<{
  name: string;
  description?: string;
  visibility: RepositoryVisibility;
  // TODO: rule, webhook
}>;

export const RepositoryVisibility = {
  public: 'public',
  private: 'private',
} as const;

export type RepositoryVisibility = (typeof RepositoryVisibility)[keyof typeof RepositoryVisibility];

export function parseYaml(content: string): Config {
  return parse(content) as Config;
}

export async function readConfigFile(path: string): Promise<Config> {
  const file = await readFile(path, {encoding: 'utf8'});
  if (core.isDebug()) {
    core.debug(`[config] file content: ${file}`);
  }
  return parseYaml(file);
}
